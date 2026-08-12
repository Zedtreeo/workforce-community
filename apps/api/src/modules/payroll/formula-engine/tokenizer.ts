/**
 * Formula Tokenizer
 *
 * Converts a formula string like "Basic_DA * 0.5" or "IF(Gross > 21000, 0, Gross * 0.0075)"
 * into a stream of tokens for the parser.
 *
 * Supported tokens:
 * - Numbers: 15000, 0.12, .5
 * - Identifiers: Basic_DA, HRA, MGross (pay head codes)
 * - Derived markers: [Derived] suffix on identifiers
 * - Operators: + - * / % = > < >= <= != ( ) ,
 * - Functions: IF, MIN, MAX, AVG, ROUND, CEILING, FLOOR, ABS
 * - Built-in variables: TDC (Total Days Count), PDC (Paid Days Count)
 */

export enum TokenType {
  NUMBER = 'NUMBER',
  IDENTIFIER = 'IDENTIFIER',       // Pay head code reference
  DERIVED = 'DERIVED',             // Pay head [Derived] value reference
  FUNCTION = 'FUNCTION',           // IF, MIN, MAX, etc.
  OPERATOR = 'OPERATOR',           // + - * /
  COMPARISON = 'COMPARISON',       // > < >= <= == !=
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  COMMA = 'COMMA',
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string | number;
  position: number;
}

const FUNCTIONS = new Set([
  'IF', 'MIN', 'MAX', 'AVG', 'ROUND', 'CEILING', 'FLOOR', 'ABS',
]);

const BUILT_IN_VARS = new Set([
  'TDC',   // Total Days Count (working days in month)
  'PDC',   // Paid Days Count (after LOP)
]);

export class Tokenizer {
  private pos = 0;
  private readonly input: string;

  constructor(formula: string) {
    this.input = formula.trim();
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) break;

      const ch = this.input[this.pos];

      // Numbers
      if (this.isDigit(ch) || (ch === '.' && this.isDigit(this.peek(1)))) {
        tokens.push(this.readNumber());
        continue;
      }

      // Identifiers, functions, and built-in vars
      if (this.isIdentStart(ch)) {
        tokens.push(this.readIdentifier());
        continue;
      }

      // Two-character operators
      if (ch === '>' && this.peek(1) === '=') {
        tokens.push({ type: TokenType.COMPARISON, value: '>=', position: this.pos });
        this.pos += 2;
        continue;
      }
      if (ch === '<' && this.peek(1) === '=') {
        tokens.push({ type: TokenType.COMPARISON, value: '<=', position: this.pos });
        this.pos += 2;
        continue;
      }
      if (ch === '!' && this.peek(1) === '=') {
        tokens.push({ type: TokenType.COMPARISON, value: '!=', position: this.pos });
        this.pos += 2;
        continue;
      }
      if (ch === '=' && this.peek(1) === '=') {
        tokens.push({ type: TokenType.COMPARISON, value: '==', position: this.pos });
        this.pos += 2;
        continue;
      }

      // Single-character tokens
      switch (ch) {
        case '+': case '-': case '*': case '/': case '%':
          tokens.push({ type: TokenType.OPERATOR, value: ch, position: this.pos });
          this.pos++;
          continue;
        case '>': case '<':
          tokens.push({ type: TokenType.COMPARISON, value: ch, position: this.pos });
          this.pos++;
          continue;
        case '=':
          tokens.push({ type: TokenType.COMPARISON, value: '==', position: this.pos });
          this.pos++;
          continue;
        case '(':
          tokens.push({ type: TokenType.LPAREN, value: '(', position: this.pos });
          this.pos++;
          continue;
        case ')':
          tokens.push({ type: TokenType.RPAREN, value: ')', position: this.pos });
          this.pos++;
          continue;
        case ',':
          tokens.push({ type: TokenType.COMMA, value: ',', position: this.pos });
          this.pos++;
          continue;
        default:
          throw new Error(`Unexpected character '${ch}' at position ${this.pos} in formula: ${this.input}`);
      }
    }

    tokens.push({ type: TokenType.EOF, value: '', position: this.pos });
    return tokens;
  }

  private readNumber(): Token {
    const start = this.pos;
    let hasDecimal = false;

    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (this.isDigit(ch)) {
        this.pos++;
      } else if (ch === '.' && !hasDecimal) {
        hasDecimal = true;
        this.pos++;
      } else {
        break;
      }
    }

    return {
      type: TokenType.NUMBER,
      value: parseFloat(this.input.slice(start, this.pos)),
      position: start,
    };
  }

  private readIdentifier(): Token {
    const start = this.pos;

    // Read identifier chars (letters, digits, underscore, +, &)
    // We allow + in identifiers to support heads like "Basic+DA"
    while (this.pos < this.input.length && this.isIdentChar(this.input[this.pos])) {
      this.pos++;
    }

    let name = this.input.slice(start, this.pos);

    // Check for [Derived] suffix
    if (this.input.slice(this.pos, this.pos + 9) === '[Derived]') {
      this.pos += 9;
      return { type: TokenType.DERIVED, value: name, position: start };
    }

    // Check if it's a function
    const upper = name.toUpperCase();
    if (FUNCTIONS.has(upper)) {
      return { type: TokenType.FUNCTION, value: upper, position: start };
    }

    return { type: TokenType.IDENTIFIER, value: name, position: start };
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isIdentStart(ch: string): boolean {
    return /[a-zA-Z_]/.test(ch);
  }

  private isIdentChar(ch: string): boolean {
    // Allow letters, digits, underscore, plus sign (for heads like Basic+DA)
    return /[a-zA-Z0-9_+&]/.test(ch);
  }

  private peek(offset: number): string {
    return this.input[this.pos + offset] || '';
  }
}
