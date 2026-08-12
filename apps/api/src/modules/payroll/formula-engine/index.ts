/**
 * Formula Engine — Public API
 *
 * Usage:
 *   import { calculatePayStructure, validateFormula } from './formula-engine';
 */

export { Tokenizer, TokenType } from './tokenizer';
export type { Token } from './tokenizer';

export { Parser } from './parser';
export type { ASTNode, NumberNode, IdentifierNode, DerivedNode, BinaryOpNode, UnaryOpNode, FunctionCallNode } from './parser';

export { Evaluator } from './evaluator';
export type { EvalContext, HeadValue } from './evaluator';

export {
  calculatePayStructure,
  validateFormula,
  getDependencyGraph,
} from './calculator';
export type {
  PayComponent,
  CalculationInput,
  CalculatedLine,
  CalculationResult,
} from './calculator';

export {
  INDIA_STATUTORY_HEADS,
  INDIA_DEFAULT_EARNING_HEADS,
  buildStatutoryBases,
} from './statutory-india';
