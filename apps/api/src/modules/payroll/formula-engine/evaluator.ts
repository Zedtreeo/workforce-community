/**
 * Formula Evaluator
 *
 * Walks the AST and evaluates the formula given a context of resolved head values.
 *
 * Context shape:
 * {
 *   heads: {
 *     'BASIC_DA': { rate: 28025, amount: 28025 },  // rate = input, amount = calculated
 *     'MGross':   { rate: 56050, amount: 56050 },
 *   },
 *   TDC: 26,   // Total Days Count (working days)
 *   PDC: 24,   // Paid Days Count
 * }
 *
 * - IDENTIFIER references → heads[name].rate  (the "rate" / input value)
 * - DERIVED references    → heads[name].amount (the calculated / derived value)
 * - TDC, PDC are built-in variables resolved from context root
 */

import { ASTNode } from './parser';

export interface HeadValue {
  rate: number;    // The base rate / input value
  amount: number;  // The calculated / derived value
}

export interface EvalContext {
  heads: Record<string, HeadValue>;
  TDC: number;  // Total Days Count
  PDC: number;  // Paid Days Count
}

export class Evaluator {
  private readonly context: EvalContext;

  constructor(context: EvalContext) {
    this.context = context;
  }

  evaluate(node: ASTNode): number {
    switch (node.type) {
      case 'number':
        return node.value;

      case 'identifier':
        return this.resolveIdentifier(node.name);

      case 'derived':
        return this.resolveDerived(node.name);

      case 'binary':
        return this.evaluateBinary(node.operator, node.left, node.right);

      case 'unary':
        return this.evaluateUnary(node.operator, node.operand);

      case 'function':
        return this.evaluateFunction(node.name, node.args);

      default:
        throw new Error(`Unknown AST node type: ${(node as any).type}`);
    }
  }

  private resolveIdentifier(name: string): number {
    // Built-in variables
    if (name === 'TDC') return this.context.TDC;
    if (name === 'PDC') return this.context.PDC;

    // Pay head rate
    const head = this.context.heads[name];
    if (!head) {
      throw new Error(`Unknown pay head: '${name}'. Available: ${Object.keys(this.context.heads).join(', ')}`);
    }
    return head.rate;
  }

  private resolveDerived(name: string): number {
    const head = this.context.heads[name];
    if (!head) {
      throw new Error(`Unknown pay head for derived value: '${name}'. Available: ${Object.keys(this.context.heads).join(', ')}`);
    }
    return head.amount;
  }

  private evaluateBinary(op: string, left: ASTNode, right: ASTNode): number {
    const l = this.evaluate(left);
    const r = this.evaluate(right);

    switch (op) {
      case '+':  return l + r;
      case '-':  return l - r;
      case '*':  return l * r;
      case '/':
        if (r === 0) return 0; // Safe division by zero
        return l / r;
      case '%':
        if (r === 0) return 0;
        return l % r;
      case '>':  return l > r  ? 1 : 0;
      case '<':  return l < r  ? 1 : 0;
      case '>=': return l >= r ? 1 : 0;
      case '<=': return l <= r ? 1 : 0;
      case '==': return l === r ? 1 : 0;
      case '!=': return l !== r ? 1 : 0;
      default:
        throw new Error(`Unknown operator: '${op}'`);
    }
  }

  private evaluateUnary(op: string, operand: ASTNode): number {
    const val = this.evaluate(operand);
    if (op === '-') return -val;
    throw new Error(`Unknown unary operator: '${op}'`);
  }

  private evaluateFunction(name: string, args: ASTNode[]): number {
    switch (name) {
      case 'IF': {
        if (args.length < 2 || args.length > 3) {
          throw new Error('IF requires 2 or 3 arguments: IF(condition, trueValue, falseValue?)');
        }
        const condition = this.evaluate(args[0]);
        if (condition !== 0) {
          return this.evaluate(args[1]);
        }
        return args.length === 3 ? this.evaluate(args[2]) : 0;
      }

      case 'MIN': {
        if (args.length < 2) throw new Error('MIN requires at least 2 arguments');
        return Math.min(...args.map((a) => this.evaluate(a)));
      }

      case 'MAX': {
        if (args.length < 2) throw new Error('MAX requires at least 2 arguments');
        return Math.max(...args.map((a) => this.evaluate(a)));
      }

      case 'AVG': {
        if (args.length === 0) throw new Error('AVG requires at least 1 argument');
        const vals = args.map((a) => this.evaluate(a));
        return vals.reduce((sum, v) => sum + v, 0) / vals.length;
      }

      case 'ROUND': {
        if (args.length < 1 || args.length > 2) {
          throw new Error('ROUND requires 1 or 2 arguments: ROUND(value, decimals?)');
        }
        const val = this.evaluate(args[0]);
        const decimals = args.length === 2 ? this.evaluate(args[1]) : 0;
        const factor = Math.pow(10, decimals);
        return Math.round(val * factor) / factor;
      }

      case 'CEILING': {
        if (args.length < 1 || args.length > 2) {
          throw new Error('CEILING requires 1 or 2 arguments: CEILING(value, significance?)');
        }
        const val = this.evaluate(args[0]);
        const sig = args.length === 2 ? this.evaluate(args[1]) : 1;
        if (sig === 0) return 0;
        return Math.ceil(val / sig) * sig;
      }

      case 'FLOOR': {
        if (args.length < 1 || args.length > 2) {
          throw new Error('FLOOR requires 1 or 2 arguments: FLOOR(value, significance?)');
        }
        const val = this.evaluate(args[0]);
        const sig = args.length === 2 ? this.evaluate(args[1]) : 1;
        if (sig === 0) return 0;
        return Math.floor(val / sig) * sig;
      }

      case 'ABS': {
        if (args.length !== 1) throw new Error('ABS requires exactly 1 argument');
        return Math.abs(this.evaluate(args[0]));
      }

      default:
        throw new Error(`Unknown function: '${name}'`);
    }
  }
}
