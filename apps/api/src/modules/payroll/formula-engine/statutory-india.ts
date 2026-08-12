/**
 * Indian Statutory Calculations
 *
 * Pre-built formulas for common Indian payroll statutory deductions.
 * These can be used as defaults when setting up pay structures,
 * or users can override with custom formulas.
 *
 * Reference (from analyzed payslips):
 * - PF: 12% of PF-eligible earnings, capped at ₹15,000 base (max ₹1,800/month)
 * - ESI: 0.75% employee share when gross ≤ ₹21,000
 * - ESI Employer: 3.25% when gross ≤ ₹21,000
 * - Professional Tax: State-specific, typically ₹200/month
 * - Gratuity: (Basic × 15) / 26 per year of service
 * - TDS: Based on income tax slab (calculated externally or flat estimate)
 */

export interface StatutoryHead {
  code: string;
  name: string;
  type: 'EARNING' | 'DEDUCTION';
  category: 'STATUTORY';
  statutoryType: string;
  formula: string;
  formulaDisplay: string;
  description: string;
  affectsPf: boolean;
  affectsEsi: boolean;
}

/**
 * Default Indian statutory pay heads.
 * These are seeded when a tenant first sets up payroll for India.
 */
export const INDIA_STATUTORY_HEADS: StatutoryHead[] = [
  {
    code: 'PF_EE',
    name: 'Provident Fund (Employee)',
    type: 'DEDUCTION',
    category: 'STATUTORY',
    statutoryType: 'PF',
    // 12% of PF-eligible base, capped at ₹15,000 ceiling
    formula: 'MIN(ROUND(PF_BASE * 0.12, 0), 1800)',
    formulaDisplay: 'MIN(PF Base × 12%, ₹1,800)',
    description: 'Employee PF contribution: 12% of basic (ceiling ₹15,000 base = ₹1,800/month)',
    affectsPf: false,
    affectsEsi: false,
  },
  {
    code: 'PF_ER',
    name: 'Provident Fund (Employer)',
    type: 'DEDUCTION',
    category: 'STATUTORY',
    statutoryType: 'PF',
    formula: 'MIN(ROUND(PF_BASE * 0.12, 0), 1800)',
    formulaDisplay: 'MIN(PF Base × 12%, ₹1,800)',
    description: 'Employer PF contribution: 12% of basic (ceiling ₹15,000 base = ₹1,800/month)',
    affectsPf: false,
    affectsEsi: false,
  },
  {
    code: 'ESI_EE',
    name: 'ESI (Employee)',
    type: 'DEDUCTION',
    category: 'STATUTORY',
    statutoryType: 'ESI',
    // 0.75% of gross when gross ≤ 21,000
    formula: 'IF(ESI_BASE <= 21000, ROUND(ESI_BASE * 0.0075, 0), 0)',
    formulaDisplay: 'IF(ESI Base ≤ ₹21,000, ESI Base × 0.75%, 0)',
    description: 'Employee ESI: 0.75% of gross earnings when gross ≤ ₹21,000/month',
    affectsPf: false,
    affectsEsi: false,
  },
  {
    code: 'ESI_ER',
    name: 'ESI (Employer)',
    type: 'DEDUCTION',
    category: 'STATUTORY',
    statutoryType: 'ESI',
    formula: 'IF(ESI_BASE <= 21000, ROUND(ESI_BASE * 0.0325, 0), 0)',
    formulaDisplay: 'IF(ESI Base ≤ ₹21,000, ESI Base × 3.25%, 0)',
    description: 'Employer ESI: 3.25% of gross earnings when gross ≤ ₹21,000/month',
    affectsPf: false,
    affectsEsi: false,
  },
  {
    code: 'PT',
    name: 'Professional Tax',
    type: 'DEDUCTION',
    category: 'STATUTORY',
    statutoryType: 'PT',
    // Standard ₹200/month (varies by state — this is configurable)
    formula: '200',
    formulaDisplay: '₹200 (Fixed)',
    description: 'Professional Tax: ₹200/month (standard rate, varies by state)',
    affectsPf: false,
    affectsEsi: false,
  },
];

/**
 * Default Indian earning pay heads (non-statutory).
 * Common structure: CTC → Basic+DA (50%) → HRA (50% of Basic) → Special Allowance (remainder).
 */
export const INDIA_DEFAULT_EARNING_HEADS = [
  {
    code: 'MGROSS',
    name: 'Monthly Gross',
    type: 'EARNING' as const,
    category: 'FIXED' as const,
    formula: 'CTC',
    formulaDisplay: 'CTC (Monthly)',
    description: 'Monthly gross salary (CTC input)',
    affectsPf: true,
    affectsEsi: true,
    affectsPt: true,
    affectsGratuity: false,
    sortOrder: 0,
  },
  {
    code: 'BASIC_DA',
    name: 'Basic + DA',
    type: 'EARNING' as const,
    category: 'FIXED' as const,
    formula: 'MGROSS * 0.5',
    formulaDisplay: 'Monthly Gross × 50%',
    description: 'Basic salary + DA: 50% of monthly gross',
    affectsPf: true,
    affectsEsi: true,
    affectsPt: true,
    affectsGratuity: true,
    sortOrder: 1,
  },
  {
    code: 'HRA',
    name: 'House Rent Allowance',
    type: 'EARNING' as const,
    category: 'FIXED' as const,
    formula: 'BASIC_DA * 0.5',
    formulaDisplay: 'Basic+DA × 50%',
    description: 'HRA: 50% of Basic+DA',
    affectsPf: false,
    affectsEsi: true,
    affectsPt: true,
    affectsGratuity: false,
    sortOrder: 2,
  },
  {
    code: 'SPCLA',
    name: 'Special Allowance',
    type: 'EARNING' as const,
    category: 'FIXED' as const,
    formula: 'MGROSS - BASIC_DA - HRA',
    formulaDisplay: 'MGross − Basic+DA − HRA',
    description: 'Special allowance: remainder after Basic+DA and HRA',
    affectsPf: false,
    affectsEsi: true,
    affectsPt: true,
    affectsGratuity: false,
    sortOrder: 3,
  },
];

/**
 * Build PF_BASE and ESI_BASE virtual heads from component flags.
 * These are injected into the eval context before statutory formulas run.
 */
export function buildStatutoryBases(
  pfBase: number,
  esiBase: number,
): Record<string, { rate: number; amount: number }> {
  return {
    PF_BASE: { rate: Math.min(pfBase, 15000), amount: Math.min(pfBase, 15000) },
    ESI_BASE: { rate: esiBase, amount: esiBase },
  };
}
