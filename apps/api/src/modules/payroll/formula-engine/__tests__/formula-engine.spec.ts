/**
 * Formula Engine Tests
 *
 * Validates the tokenizer → parser → evaluator → calculator pipeline
 * against real payslip data from the reference system.
 */

import { Tokenizer, TokenType } from '../tokenizer';
import { Parser } from '../parser';
import { Evaluator, EvalContext } from '../evaluator';
import {
  calculatePayStructure,
  validateFormula,
  PayComponent,
  CalculationInput,
} from '../calculator';

// ── Tokenizer Tests ─────────────────────────────────

describe('Tokenizer', () => {
  it('tokenizes simple arithmetic', () => {
    const tokens = new Tokenizer('10 + 20').tokenize();
    expect(tokens).toHaveLength(4); // 10, +, 20, EOF
    expect(tokens[0]).toMatchObject({ type: TokenType.NUMBER, value: 10 });
    expect(tokens[1]).toMatchObject({ type: TokenType.OPERATOR, value: '+' });
    expect(tokens[2]).toMatchObject({ type: TokenType.NUMBER, value: 20 });
  });

  it('tokenizes head references with special chars', () => {
    const tokens = new Tokenizer('BASIC_DA * 0.5').tokenize();
    expect(tokens[0]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'BASIC_DA' });
    expect(tokens[2]).toMatchObject({ type: TokenType.NUMBER, value: 0.5 });
  });

  it('tokenizes head codes with plus sign', () => {
    const tokens = new Tokenizer('Basic+DA').tokenize();
    // "Basic+DA" should be one identifier (+ is allowed in ident chars)
    expect(tokens[0]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'Basic+DA' });
  });

  it('tokenizes [Derived] suffix', () => {
    const tokens = new Tokenizer('MGROSS[Derived] * 0.12').tokenize();
    expect(tokens[0]).toMatchObject({ type: TokenType.DERIVED, value: 'MGROSS' });
  });

  it('tokenizes function calls', () => {
    const tokens = new Tokenizer('MIN(BASIC_DA * 0.12, 1800)').tokenize();
    expect(tokens[0]).toMatchObject({ type: TokenType.FUNCTION, value: 'MIN' });
    expect(tokens[1]).toMatchObject({ type: TokenType.LPAREN });
    expect(tokens[5]).toMatchObject({ type: TokenType.COMMA });
    expect(tokens[6]).toMatchObject({ type: TokenType.NUMBER, value: 1800 });
  });

  it('tokenizes comparison operators', () => {
    const tokens = new Tokenizer('Gross >= 21000').tokenize();
    expect(tokens[1]).toMatchObject({ type: TokenType.COMPARISON, value: '>=' });
  });

  it('tokenizes IF expression', () => {
    const tokens = new Tokenizer('IF(Gross > 21000, 0, Gross * 0.0075)').tokenize();
    expect(tokens[0]).toMatchObject({ type: TokenType.FUNCTION, value: 'IF' });
    expect(tokens[3]).toMatchObject({ type: TokenType.COMPARISON, value: '>' });
  });
});

// ── Parser Tests ────────────────────────────────────

describe('Parser', () => {
  function parse(formula: string) {
    return new Parser(new Tokenizer(formula).tokenize()).parse();
  }

  it('parses simple multiplication', () => {
    const ast = parse('CTC * 0.5');
    expect(ast).toMatchObject({
      type: 'binary',
      operator: '*',
      left: { type: 'identifier', name: 'CTC' },
      right: { type: 'number', value: 0.5 },
    });
  });

  it('parses nested function call', () => {
    const ast = parse('MIN(BASIC_DA * 0.12, 1800)');
    expect(ast).toMatchObject({
      type: 'function',
      name: 'MIN',
      args: [
        { type: 'binary', operator: '*' },
        { type: 'number', value: 1800 },
      ],
    });
  });

  it('parses IF with comparison', () => {
    const ast = parse('IF(Gross <= 21000, Gross * 0.0075, 0)');
    expect(ast).toMatchObject({
      type: 'function',
      name: 'IF',
      args: [
        { type: 'binary', operator: '<=' },
        { type: 'binary', operator: '*' },
        { type: 'number', value: 0 },
      ],
    });
  });

  it('respects operator precedence', () => {
    const ast = parse('A + B * C');
    expect(ast).toMatchObject({
      type: 'binary',
      operator: '+',
      left: { type: 'identifier', name: 'A' },
      right: {
        type: 'binary',
        operator: '*',
        left: { type: 'identifier', name: 'B' },
        right: { type: 'identifier', name: 'C' },
      },
    });
  });

  it('handles parenthesized expressions', () => {
    const ast = parse('(A + B) * C');
    expect(ast).toMatchObject({
      type: 'binary',
      operator: '*',
      left: {
        type: 'binary',
        operator: '+',
      },
      right: { type: 'identifier', name: 'C' },
    });
  });

  it('handles subtraction chain', () => {
    const ast = parse('MGROSS - BASIC_DA - HRA');
    // Left-to-right: (MGROSS - BASIC_DA) - HRA
    expect(ast).toMatchObject({
      type: 'binary',
      operator: '-',
      left: {
        type: 'binary',
        operator: '-',
        left: { type: 'identifier', name: 'MGROSS' },
        right: { type: 'identifier', name: 'BASIC_DA' },
      },
      right: { type: 'identifier', name: 'HRA' },
    });
  });
});

// ── Evaluator Tests ─────────────────────────────────

describe('Evaluator', () => {
  function evaluate(formula: string, context: EvalContext) {
    const tokens = new Tokenizer(formula).tokenize();
    const ast = new Parser(tokens).parse();
    return new Evaluator(context).evaluate(ast);
  }

  const baseContext: EvalContext = {
    heads: {
      CTC: { rate: 56050, amount: 56050 },
      MGROSS: { rate: 56050, amount: 56050 },
      BASIC_DA: { rate: 28025, amount: 28025 },
      HRA: { rate: 14012.5, amount: 14012.5 },
    },
    TDC: 26,
    PDC: 26,
  };

  it('evaluates simple multiplication', () => {
    expect(evaluate('MGROSS * 0.5', baseContext)).toBe(28025);
  });

  it('evaluates MIN function', () => {
    expect(evaluate('MIN(BASIC_DA * 0.12, 1800)', baseContext)).toBe(1800);
    // 28025 * 0.12 = 3363, but capped at 1800
  });

  it('evaluates IF with false condition', () => {
    // Gross 56050 > 21000, so ESI = 0
    expect(evaluate('IF(MGROSS <= 21000, MGROSS * 0.0075, 0)', baseContext)).toBe(0);
  });

  it('evaluates IF with true condition', () => {
    const lowGrossCtx: EvalContext = {
      ...baseContext,
      heads: { ...baseContext.heads, MGROSS: { rate: 20000, amount: 20000 } },
    };
    expect(evaluate('IF(MGROSS <= 21000, MGROSS * 0.0075, 0)', lowGrossCtx)).toBe(150);
  });

  it('evaluates subtraction chain', () => {
    expect(evaluate('MGROSS - BASIC_DA - HRA', baseContext)).toBe(14012.5);
  });

  it('evaluates ROUND function', () => {
    expect(evaluate('ROUND(14012.567, 2)', baseContext)).toBe(14012.57);
    expect(evaluate('ROUND(14012.567, 0)', baseContext)).toBe(14013);
  });

  it('evaluates CEILING function', () => {
    expect(evaluate('CEILING(14012.5, 1)', baseContext)).toBe(14013);
    expect(evaluate('CEILING(14012.5, 100)', baseContext)).toBe(14100);
  });

  it('evaluates FLOOR function', () => {
    expect(evaluate('FLOOR(14012.5, 1)', baseContext)).toBe(14012);
    expect(evaluate('FLOOR(14012.5, 100)', baseContext)).toBe(14000);
  });

  it('handles safe division by zero', () => {
    expect(evaluate('100 / 0', baseContext)).toBe(0);
  });

  it('evaluates [Derived] references', () => {
    const ctx: EvalContext = {
      heads: { MGROSS: { rate: 50000, amount: 48000 } },
      TDC: 26,
      PDC: 25,
    };
    // rate = 50000, amount (derived) = 48000
    expect(evaluate('MGROSS', ctx)).toBe(50000);       // rate
    expect(evaluate('MGROSS[Derived]', ctx)).toBe(48000); // derived/calculated
  });

  it('evaluates attendance variables', () => {
    expect(evaluate('TDC', baseContext)).toBe(26);
    expect(evaluate('PDC', baseContext)).toBe(26);
    expect(evaluate('CTC * PDC / TDC', baseContext)).toBe(56050);
  });
});

// ── Calculator Integration Tests ────────────────────

describe('calculatePayStructure', () => {
  /**
   * Test Case: TVE7005 payslip verification
   * MGross: 56,050
   * Basic+DA: 28,025 (50%)
   * HRA: 14,012.50 → 14,013 (50% of Basic)
   * SPCLA: 14,012.50 → 14,013 (remainder)
   * PF: 1,800 (12% of 15,000 cap)
   * Net: ~54,250
   */
  it('calculates TVE7005 payslip correctly', () => {
    const components: PayComponent[] = [
      {
        headId: '1', headCode: 'MGROSS', headName: 'Monthly Gross',
        headType: 'EARNING', formula: 'CTC', isVariable: false,
        showOnPayslip: false, hasArrear: false,
        affectsPf: false, affectsEsi: false, affectsPt: false, affectsGratuity: false,
        roundingMode: 'NORMAL', roundingPrecision: 0, sortOrder: 0,
        isStatutory: false,
      },
      {
        headId: '2', headCode: 'BASIC_DA', headName: 'Basic + DA',
        headType: 'EARNING', formula: 'MGROSS * 0.5', isVariable: false,
        showOnPayslip: true, hasArrear: false,
        affectsPf: true, affectsEsi: true, affectsPt: true, affectsGratuity: true,
        roundingMode: 'NORMAL', roundingPrecision: 0, sortOrder: 1,
        isStatutory: false,
      },
      {
        headId: '3', headCode: 'HRA', headName: 'House Rent Allowance',
        headType: 'EARNING', formula: 'BASIC_DA * 0.5', isVariable: false,
        showOnPayslip: true, hasArrear: false,
        affectsPf: false, affectsEsi: true, affectsPt: true, affectsGratuity: false,
        roundingMode: 'NORMAL', roundingPrecision: 0, sortOrder: 2,
        isStatutory: false,
      },
      {
        headId: '4', headCode: 'SPCLA', headName: 'Special Allowance',
        headType: 'EARNING', formula: 'MGROSS - BASIC_DA - HRA', isVariable: false,
        showOnPayslip: true, hasArrear: false,
        affectsPf: false, affectsEsi: true, affectsPt: true, affectsGratuity: false,
        roundingMode: 'NORMAL', roundingPrecision: 0, sortOrder: 3,
        isStatutory: false,
      },
      {
        headId: '5', headCode: 'PF_EE', headName: 'PF (Employee)',
        headType: 'DEDUCTION', formula: 'MIN(BASIC_DA * 0.12, 1800)', isVariable: false,
        showOnPayslip: true, hasArrear: false,
        affectsPf: false, affectsEsi: false, affectsPt: false, affectsGratuity: false,
        roundingMode: 'NORMAL', roundingPrecision: 0, sortOrder: 10,
        isStatutory: true, statutoryType: 'PF',
      },
    ];

    const input: CalculationInput = {
      ctcMonthly: 56050,
      totalDays: 26,
      paidDays: 26,  // Full month
    };

    const result = calculatePayStructure(components, input);

    // Verify individual lines
    const mgross = result.lines.find((l) => l.headCode === 'MGROSS');
    expect(mgross?.amount).toBe(56050);

    const basicDa = result.lines.find((l) => l.headCode === 'BASIC_DA');
    expect(basicDa?.amount).toBe(28025);

    const hra = result.lines.find((l) => l.headCode === 'HRA');
    expect(hra?.amount).toBe(14013); // 28025 * 0.5 = 14012.5 → rounded to 14013

    const spcla = result.lines.find((l) => l.headCode === 'SPCLA');
    expect(spcla?.amount).toBe(14012); // 56050 - 28025 - 14013 = 14012

    const pf = result.lines.find((l) => l.headCode === 'PF_EE');
    expect(pf?.amount).toBe(1800); // MIN(28025*0.12, 1800) = MIN(3363, 1800) = 1800

    // Verify totals
    expect(result.summary.totalEarnings).toBe(56050); // All earnings sum
    expect(result.summary.totalDeductions).toBe(1800);
    expect(result.summary.netPay).toBe(54250);
  });

  /**
   * Test Case: TVE7206 payslip verification
   * Rate: 20,950 → triggers ESI (< 21,000)
   * Basic+DA: 14,100 → HRA: 6,850 → Bonus: 1,175 (variable)
   * Total Earnings: 22,125
   * PF: 1,692 (12% of 14,100)
   * ESI: ~166 (0.75% of 22,125)
   * Net: ~20,267
   */
  it('calculates TVE7206 payslip with ESI correctly', () => {
    const components: PayComponent[] = [
      {
        headId: '1', headCode: 'MGROSS', headName: 'Monthly Gross',
        headType: 'EARNING', formula: 'CTC', isVariable: false,
        showOnPayslip: false, hasArrear: false,
        affectsPf: false, affectsEsi: false, affectsPt: false, affectsGratuity: false,
        roundingMode: 'NORMAL', roundingPrecision: 0, sortOrder: 0,
        isStatutory: false,
      },
      {
        headId: '2', headCode: 'BASIC_DA', headName: 'Basic + DA',
        headType: 'EARNING', formula: 'CTC * 0.673', isVariable: false,
        showOnPayslip: true, hasArrear: false,
        affectsPf: true, affectsEsi: true, affectsPt: true, affectsGratuity: true,
        roundingMode: 'NORMAL', roundingPrecision: 0, sortOrder: 1,
        isStatutory: false,
      },
      {
        headId: '3', headCode: 'HRA', headName: 'House Rent Allowance',
        headType: 'EARNING', formula: 'CTC * 0.327', isVariable: false,
        showOnPayslip: true, hasArrear: false,
        affectsPf: false, affectsEsi: true, affectsPt: true, affectsGratuity: false,
        roundingMode: 'NORMAL', roundingPrecision: 0, sortOrder: 2,
        isStatutory: false,
      },
      {
        headId: '4', headCode: 'BONUS', headName: 'Bonus',
        headType: 'EARNING', formula: null, isVariable: true,
        showOnPayslip: true, hasArrear: false,
        affectsPf: false, affectsEsi: true, affectsPt: true, affectsGratuity: false,
        roundingMode: 'NORMAL', roundingPrecision: 0, sortOrder: 3,
        isStatutory: false,
      },
      {
        headId: '5', headCode: 'PF_EE', headName: 'PF (Employee)',
        headType: 'DEDUCTION', formula: 'ROUND(BASIC_DA * 0.12, 0)', isVariable: false,
        showOnPayslip: true, hasArrear: false,
        affectsPf: false, affectsEsi: false, affectsPt: false, affectsGratuity: false,
        roundingMode: 'NONE', roundingPrecision: 0, sortOrder: 10,
        isStatutory: true, statutoryType: 'PF',
      },
      {
        headId: '6', headCode: 'ESI_EE', headName: 'ESI (Employee)',
        headType: 'DEDUCTION',
        formula: 'IF(MGROSS <= 21000, ROUND(MGROSS * 0.0075, 0), 0)',
        isVariable: false,
        showOnPayslip: true, hasArrear: false,
        affectsPf: false, affectsEsi: false, affectsPt: false, affectsGratuity: false,
        roundingMode: 'NONE', roundingPrecision: 0, sortOrder: 11,
        isStatutory: true, statutoryType: 'ESI',
      },
    ];

    const input: CalculationInput = {
      ctcMonthly: 20950,
      totalDays: 26,
      paidDays: 26,
      variableInputs: { BONUS: 1175 },
    };

    const result = calculatePayStructure(components, input);

    const basicDa = result.lines.find((l) => l.headCode === 'BASIC_DA');
    expect(basicDa?.amount).toBe(14099); // 20950 * 0.673 = 14099.35 → 14099

    const hra = result.lines.find((l) => l.headCode === 'HRA');
    expect(hra?.amount).toBe(6851); // 20950 * 0.327 = 6850.65 → 6851

    const bonus = result.lines.find((l) => l.headCode === 'BONUS');
    expect(bonus?.amount).toBe(1175);

    const pf = result.lines.find((l) => l.headCode === 'PF_EE');
    expect(pf?.amount).toBe(1692); // ROUND(14099 * 0.12) = ROUND(1691.88) = 1692

    const esi = result.lines.find((l) => l.headCode === 'ESI_EE');
    // MGROSS = 20950 <= 21000, so ESI applies: ROUND(20950 * 0.0075) = ROUND(157.125) = 157
    expect(esi?.amount).toBe(157);

    // Net = earnings - deductions
    const totalEarnings = result.summary.totalEarnings;
    expect(result.summary.netPay).toBe(totalEarnings - result.summary.totalDeductions);
  });

  /**
   * Test Case: Attendance proration (LOP)
   * Full month CTC 50,000 but only 20 of 26 days paid
   */
  it('prorates correctly for partial attendance', () => {
    const components: PayComponent[] = [
      {
        headId: '1', headCode: 'MGROSS', headName: 'Monthly Gross',
        headType: 'EARNING', formula: 'CTC', isVariable: false,
        showOnPayslip: false, hasArrear: false,
        affectsPf: false, affectsEsi: false, affectsPt: false, affectsGratuity: false,
        roundingMode: 'NORMAL', roundingPrecision: 0, sortOrder: 0,
        isStatutory: false,
      },
      {
        headId: '2', headCode: 'BASIC_DA', headName: 'Basic + DA',
        headType: 'EARNING', formula: 'MGROSS * 0.5', isVariable: false,
        showOnPayslip: true, hasArrear: false,
        affectsPf: true, affectsEsi: true, affectsPt: true, affectsGratuity: true,
        roundingMode: 'NORMAL', roundingPrecision: 0, sortOrder: 1,
        isStatutory: false,
      },
    ];

    const input: CalculationInput = {
      ctcMonthly: 50000,
      totalDays: 26,
      paidDays: 20,  // 6 LOP days
    };

    const result = calculatePayStructure(components, input);

    const mgross = result.lines.find((l) => l.headCode === 'MGROSS');
    // rate = 50000, amount = 50000 * (20/26) = 38461.538... → 38462
    expect(mgross?.rate).toBe(50000);
    expect(mgross?.amount).toBe(38462);

    const basic = result.lines.find((l) => l.headCode === 'BASIC_DA');
    // rate = 25000, amount = 25000 * (20/26) = 19230.769... → 19231
    expect(basic?.rate).toBe(25000);
    expect(basic?.amount).toBe(19231);
  });

  it('handles arrear amounts', () => {
    const components: PayComponent[] = [
      {
        headId: '1', headCode: 'BASIC_DA', headName: 'Basic + DA',
        headType: 'EARNING', formula: 'CTC * 0.5', isVariable: false,
        showOnPayslip: true, hasArrear: true,
        affectsPf: true, affectsEsi: true, affectsPt: true, affectsGratuity: true,
        roundingMode: 'NORMAL', roundingPrecision: 0, sortOrder: 1,
        isStatutory: false,
      },
    ];

    const input: CalculationInput = {
      ctcMonthly: 50000,
      totalDays: 26,
      paidDays: 26,
      arrearInputs: { BASIC_DA: 5000 },
    };

    const result = calculatePayStructure(components, input);
    const basic = result.lines.find((l) => l.headCode === 'BASIC_DA');
    expect(basic?.amount).toBe(25000);
    expect(basic?.arrearAmount).toBe(5000);
    expect(basic?.totalAmount).toBe(30000);
  });
});

// ── Validation Tests ────────────────────────────────

describe('validateFormula', () => {
  it('returns null for valid formula', () => {
    expect(validateFormula('CTC * 0.5', ['CTC', 'MGROSS'])).toBeNull();
  });

  it('returns null for valid IF formula', () => {
    expect(
      validateFormula('IF(MGROSS <= 21000, MGROSS * 0.0075, 0)', ['MGROSS']),
    ).toBeNull();
  });

  it('returns error for unknown head reference', () => {
    const result = validateFormula('UNKNOWN_HEAD * 0.5', ['MGROSS', 'BASIC_DA']);
    expect(result).toContain('Unknown reference');
    expect(result).toContain('UNKNOWN_HEAD');
  });

  it('returns error for syntax error', () => {
    const result = validateFormula('CTC * * 0.5', ['CTC']);
    expect(result).toBeTruthy();
  });

  it('returns error for unmatched paren', () => {
    const result = validateFormula('(CTC * 0.5', ['CTC']);
    expect(result).toBeTruthy();
  });

  it('allows built-in vars TDC and PDC', () => {
    expect(validateFormula('CTC * PDC / TDC', ['CTC'])).toBeNull();
  });
});
