/**
 * Formula Parser — Recursive Descent
 *
 * Parses tokenized formula into an AST (Abstract Syntax Tree).
 *
 * Grammar:
 *   expr       → comparison
 *   comparison → addition (( '>' | '<' | '>=' | '<=' | '==' | '!=' ) addition)*
 *   addition   → multiply (( '+' | '-' ) multiply)*
 *   multiply   → unary (( '*' | '/' | '%' ) unary)*
 *   unary      → '-' unary | primary
 *   primary    → NUMBER | IDENTIFIER | DERIVED | funcCall | '(' expr ')'
 *   funcCall   → FUNCTION '(' argList ')'
 *   argList    → expr (',' expr)*
 */

import { Token, TokenType } from './tokenizer';

// ── AST Node Types ──────────────────────────────────

export type ASTNode =
  | NumberNode
  | IdentifierNode
  | DerivedNode
  | BinaryOpNode
  | UnaryOpNode
  | FunctionCallNode;

export interface NumberNode {
  type: 'number';
  value: number;
}

export interface IdentifierNode {
  type: 'identifier';
  name: string;  // Pay head code or built-in var (TDC, PDC)
}

export interface DerivedNode {
  type: 'derived';
  name: string;  // Pay head code — references calculated value, not rate
}

export interface BinaryOpNode {
  type: 'binary';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryOpNode {
  type: 'unary';
  operator: string;
  operand: ASTNode;
}

export interface FunctionCallNode {
  type: 'function';
  name: string;     // IF, MIN, MAX, ROUND, etc.
  args: ASTNode[];
}

// ── Parser ──────────────────────────────────────────

export class Parser {
  private pos = 0;
  private readonly tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ASTNode {
    const ast = this.expression();
    if (this.current().type !== TokenType.EOF) {
      throw new Error(
        `Unexpected token '${this.current().value}' at position ${this.current().position}`,
      );
    }
    return ast;
  }

  private expression(): ASTNode {
    return this.comparison();
  }

  private comparison(): ASTNode {
    let left = this.addition();

    while (this.current().type === TokenType.COMPARISON) {
      const op = this.current().value as string;
      this.advance();
      const right = this.addition();
      left = { type: 'binary', operator: op, left, right };
    }

    return left;
  }

  private addition(): ASTNode {
    let left = this.multiply();

    while (
      this.current().type === TokenType.OPERATOR &&
      (this.current().value === '+' || this.current().value === '-')
    ) {
      const op = this.current().value as string;
      this.advance();
      const right = this.multiply();
      left = { type: 'binary', operator: op, left, right };
    }

    return left;
  }

  private multiply(): ASTNode {
    let left = this.unary();

    while (
      this.current().type === TokenType.OPERATOR &&
      (this.current().value === '*' || this.current().value === '/' || this.current().value === '%')
    ) {
      const op = this.current().value as string;
      this.advance();
      const right = this.unary();
      left = { type: 'binary', operator: op, left, right };
    }

    return left;
  }

  private unary(): ASTNode {
    if (
      this.current().type === TokenType.OPERATOR &&
      this.current().value === '-'
    ) {
      this.advance();
      const operand = this.unary();
      return { type: 'unary', operator: '-', operand };
    }
    return this.primary();
  }

  private primary(): ASTNode {
    const token = this.current();

    // Number literal
    if (token.type === TokenType.NUMBER) {
      this.advance();
      return { type: 'number', value: token.value as number };
    }

    // Function call
    if (token.type === TokenType.FUNCTION) {
      return this.functionCall();
    }

    // Identifier (pay head code or built-in variable)
    if (token.type === TokenType.IDENTIFIER) {
      this.advance();
      return { type: 'identifier', name: token.value as string };
    }

    // Derived reference
    if (token.type === TokenType.DERIVED) {
      this.advance();
      return { type: 'derived', name: token.value as string };
    }

    // Parenthesized expression
    if (token.type === TokenType.LPAREN) {
      this.advance(); // consume '('
      const expr = this.expression();
      this.expect(TokenType.RPAREN, ')');
      return expr;
    }

    throw new Error(
      `Unexpected token '${token.value}' (${token.type}) at position ${token.position}`,
    );
  }

  private functionCall(): ASTNode {
    const name = this.current().value as string;
    this.advance(); // consume function name
    this.expect(TokenType.LPAREN, '(');

    const args: ASTNode[] = [];
    if (this.current().type !== TokenType.RPAREN) {
      args.push(this.expression());
      while (this.current().type === TokenType.COMMA) {
        this.advance(); // consume ','
        args.push(this.expression());
      }
    }

    this.expect(TokenType.RPAREN, ')');
    return { type: 'function', name, args };
  }

  // ── Helpers ─────────────────────────────────────────

  private current(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  private expect(type: TokenType, expected: string): void {
    const token = this.current();
    if (token.type !== type) {
      throw new Error(
        `Expected '${expected}' but got '${token.value}' at position ${token.position}`,
      );
    }
    this.advance();
  }
}
