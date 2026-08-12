/**
 * Pay Structure Calculator (Orchestrator)
 *
 * Given a pay structure template (list of components with formulas),
 * an employee's CTC/rate, and attendance data, this:
 *
 * 1. Topologically sorts components by dependency order
 * 2. Evaluates each formula in sequence
 * 3. Applies rounding modes
 * 4. Prorates by attendance (paid days / total days)
 * 5. Returns itemized earnings, deductions, gross, and net
 *
 * Design matches the reference system screenshots:
 * - Heads reference other heads by code
 * - [Derived] suffix references calculated amount (not rate)
 * - Variable heads get their value from manual input (rate field)
 * - Attendance proration: amount * (PDC / TDC)
 */

import { Tokenizer } from './tokenizer';
import { Parser, ASTNode } from './parser';
import { Evaluator, EvalContext, HeadValue } from './evaluator';

// ── Types ───────────────────────────────────────────

export interface PayComponent {
  headId: string;
  headCode: string;
  headName: string;
  headType: 'EARNING' | 'DEDUCTION';
  formula: string | null;        // null = fixed/manual value
  isVariable: boolean;           // Manual input per employee
  showOnPayslip: boolean;
  hasArrear: boolean;
  affectsPf: boolean;
  affectsEsi: boolean;
  affectsPt: boolean;
  affectsGratuity: boolean;
  roundingMode: 'NORMAL' | 'FLOOR' | 'CEILING' | 'NONE';
  roundingPrecision: number;
  sortOrder: number;
  isStatutory: boolean;
  statutoryType?: string | null;
}

export interface CalculationInput {
  /** Monthly CTC or gross input amount */
  ctcMonthly: number;

  /** Working days in month (TDC) */
  totalDays: number;

  /** Paid days after LOP (PDC) */
  paidDays: number;

  /** Manual overrides for variable heads: { headCode: amount } */
  variableInputs?: Record<string, number>;

  /** Arrear amounts: { headCode: arrearAmount } */
  arrearInputs?: Record<string, number>;
}

export interface CalculatedLine {
  headId: string;
  headCode: string;
  headName: string;
  headType: 'EARNING' | 'DEDUCTION';
  rate: number;           // Pre-proration / base value
  amount: number;         // After proration + rounding
  arrearAmount: number;
  totalAmount: number;    // amount + arrearAmount
  formula: string | null;
  showOnPayslip: boolean;
  sortOrder: number;
}

export interface CalculationResult {
  lines: CalculatedLine[];
  summary: {
    totalEarnings: number;
    totalDeductions: number;
    netPay: number;
    pfBase: number;       // Sum of components that affect PF
    esiBase: number;      // Sum of components that affect ESI
    ptBase: number;
    gratuityBase: number;
  };
}

// ── Parsed formula cache ────────────────────────────

const formulaCache = new Map<string, ASTNode>();

function parseFormula(formula: string): ASTNode {
  let ast = formulaCache.get(formula);
  if (!ast) {
    const tokens = new Tokenizer(formula).tokenize();
    ast = new Parser(tokens).parse();
    formulaCache.set(formula, ast);
    // Keep cache bounded
    if (formulaCache.size > 500) {
      const first = formulaCache.keys().next().value;
      if (first) formulaCache.delete(first);
    }
  }
  return ast;
}

// ── Dependency Resolution ───────────────────────────

/**
 * Extract head code references from a formula string.
 * Returns codes that this formula depends on.
 */
function extractDependencies(formula: string): string[] {
  const deps: string[] = [];
  try {
    const tokens = new Tokenizer(formula).tokenize();
    for (const token of tokens) {
      if (token.type === 'IDENTIFIER' || token.type === 'DERIVED') {
        const name = token.value as string;
        // Skip built-in vars
        if (name !== 'TDC' && name !== 'PDC') {
          deps.push(name);
        }
      }
    }
  } catch {
    // If formula can't be tokenized, return empty deps
  }
  return [...new Set(deps)];
}

/**
 * Topological sort of components based on formula dependencies.
 * Components without formulas (fixed/variable) come first.
 */
function topologicalSort(components: PayComponent[]): PayComponent[] {
  const codeToComp = new Map<string, PayComponent>();
  for (const comp of components) {
    codeToComp.set(comp.headCode, comp);
  }

  const adjList = new Map<string, string[]>();
  for (const comp of components) {
    const deps = comp.formula ? extractDependencies(comp.formula) : [];
    // Filter to only deps that are actual components in this structure
    adjList.set(comp.headCode, deps.filter((d) => codeToComp.has(d)));
  }

  // Kahn's algorithm
  const inDegree = new Map<string, number>();
  for (const comp of components) {
    inDegree.set(comp.headCode, 0);
  }
  for (const [, deps] of adjList) {
    for (const dep of deps) {
      inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
    }
  }

  // Wait — in our dependency model, if A depends on B, then B must be calculated first.
  // So edges go from dependent → dependency, and we need reverse topological order.
  // Actually, let's flip: inDegree should count how many things depend on each node.
  // No — standard approach: if A depends on B, edge B → A. Process B before A.

  // Rebuild: edges from dependency → dependent
  const reverseAdj = new Map<string, string[]>();
  const revInDegree = new Map<string, number>();
  for (const comp of components) {
    reverseAdj.set(comp.headCode, []);
    revInDegree.set(comp.headCode, 0);
  }

  for (const [code, deps] of adjList) {
    revInDegree.set(code, deps.length);
    for (const dep of deps) {
      reverseAdj.get(dep)!.push(code);
    }
  }

  const queue: string[] = [];
  for (const [code, deg] of revInDegree) {
    if (deg === 0) queue.push(code);
  }

  const sorted: PayComponent[] = [];
  while (queue.length > 0) {
    const code = queue.shift()!;
    sorted.push(codeToComp.get(code)!);

    for (const dependent of reverseAdj.get(code) || []) {
      const newDeg = revInDegree.get(dependent)! - 1;
      revInDegree.set(dependent, newDeg);
      if (newDeg === 0) queue.push(dependent);
    }
  }

  if (sorted.length !== components.length) {
    const missing = components
      .filter((c) => !sorted.includes(c))
      .map((c) => c.headCode);
    throw new Error(
      `Circular dependency detected in pay structure involving: ${missing.join(', ')}`,
    );
  }

  return sorted;
}

// ── Main Calculator ─────────────────────────────────

export function calculatePayStructure(
  components: PayComponent[],
  input: CalculationInput,
): CalculationResult {
  // Sort by dependency order
  const sorted = topologicalSort(components);

  const payRatio = input.totalDays > 0 ? input.paidDays / input.totalDays : 1;

  // Build evaluation context incrementally
  const heads: Record<string, HeadValue> = {};

  // Seed with CTC as a virtual head that formulas can reference
  heads['CTC'] = { rate: input.ctcMonthly, amount: input.ctcMonthly };

  const lines: CalculatedLine[] = [];
  let pfBase = 0;
  let esiBase = 0;
  let ptBase = 0;
  let gratuityBase = 0;

  for (const comp of sorted) {
    let rate: number;

    if (comp.isVariable) {
      // Variable head — value comes from manual input
      rate = input.variableInputs?.[comp.headCode] ?? 0;
    } else if (!comp.formula) {
      // Fixed value with no formula — use CTC as implicit value
      // (Shouldn't normally happen if structure is well-defined)
      rate = 0;
    } else {
      // Formula-based — evaluate
      const context: EvalContext = {
        heads,
        TDC: input.totalDays,
        PDC: input.paidDays,
      };

      const ast = parseFormula(comp.formula);
      const evaluator = new Evaluator(context);
      rate = evaluator.evaluate(ast);
    }

    // Apply rounding to the rate
    rate = applyRounding(rate, comp.roundingMode, comp.roundingPrecision);

    // Prorate by attendance
    let amount = rate * payRatio;
    amount = applyRounding(amount, comp.roundingMode, comp.roundingPrecision);

    // Store in context for downstream formulas to reference
    heads[comp.headCode] = { rate, amount };

    // Track statutory bases
    if (comp.headType === 'EARNING') {
      if (comp.affectsPf)       pfBase += amount;
      if (comp.affectsEsi)      esiBase += amount;
      if (comp.affectsPt)       ptBase += amount;
      if (comp.affectsGratuity) gratuityBase += amount;
    }

    // Arrears
    const arrearAmount = input.arrearInputs?.[comp.headCode] ?? 0;
    const totalAmount = amount + arrearAmount;

    lines.push({
      headId: comp.headId,
      headCode: comp.headCode,
      headName: comp.headName,
      headType: comp.headType,
      rate,
      amount,
      arrearAmount,
      totalAmount,
      formula: comp.formula,
      showOnPayslip: comp.showOnPayslip,
      sortOrder: comp.sortOrder,
    });
  }

  // Calculate totals — only include items visible on payslip
  // Hidden items (like MGross) are intermediate calculation helpers
  const totalEarnings = lines
    .filter((l) => l.headType === 'EARNING' && l.showOnPayslip)
    .reduce((sum, l) => sum + l.totalAmount, 0);

  const totalDeductions = lines
    .filter((l) => l.headType === 'DEDUCTION' && l.showOnPayslip)
    .reduce((sum, l) => sum + Math.abs(l.totalAmount), 0);

  const netPay = totalEarnings - totalDeductions;

  return {
    lines,
    summary: {
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      netPay: Math.round(netPay * 100) / 100,
      pfBase: Math.round(pfBase * 100) / 100,
      esiBase: Math.round(esiBase * 100) / 100,
      ptBase: Math.round(ptBase * 100) / 100,
      gratuityBase: Math.round(gratuityBase * 100) / 100,
    },
  };
}

// ── Rounding ────────────────────────────────────────

function applyRounding(
  value: number,
  mode: 'NORMAL' | 'FLOOR' | 'CEILING' | 'NONE',
  precision: number,
): number {
  if (mode === 'NONE') return value;

  const factor = Math.pow(10, precision);

  switch (mode) {
    case 'NORMAL':
      return Math.round(value * factor) / factor;
    case 'FLOOR':
      return Math.floor(value * factor) / factor;
    case 'CEILING':
      return Math.ceil(value * factor) / factor;
    default:
      return Math.round(value * factor) / factor;
  }
}

// ── Validation ──────────────────────────────────────

/**
 * Validate a formula string. Returns null if valid, or an error message.
 */
export function validateFormula(
  formula: string,
  availableHeadCodes: string[],
): string | null {
  try {
    const tokens = new Tokenizer(formula).tokenize();
    const ast = new Parser(tokens).parse();

    // Check all referenced heads exist
    const available = new Set([...availableHeadCodes, 'CTC', 'TDC', 'PDC']);
    const deps = extractDependencies(formula);
    for (const dep of deps) {
      if (!available.has(dep)) {
        return `Unknown reference: '${dep}'. Available: ${[...available].join(', ')}`;
      }
    }

    // Try a dry-run evaluation with dummy values
    const dummyContext: EvalContext = {
      heads: {},
      TDC: 26,
      PDC: 26,
    };
    for (const code of availableHeadCodes) {
      dummyContext.heads[code] = { rate: 1000, amount: 1000 };
    }
    dummyContext.heads['CTC'] = { rate: 50000, amount: 50000 };

    const evaluator = new Evaluator(dummyContext);
    evaluator.evaluate(ast);

    return null; // Valid
  } catch (err: any) {
    return err.message || 'Invalid formula';
  }
}

/**
 * Get the dependency graph for a set of components.
 * Useful for the UI to show dependency visualization.
 */
export function getDependencyGraph(
  components: PayComponent[],
): { code: string; dependsOn: string[] }[] {
  return components.map((comp) => ({
    code: comp.headCode,
    dependsOn: comp.formula ? extractDependencies(comp.formula) : [],
  }));
}
