import { Location } from 'vscode-languageserver';
import { Token, Tokenizer, TokenKind } from './lexer';
import { ExprAST, MissingAST, NumberExprAST, VariableExprAST } from './ast';

export interface Diagnostic {
  location: Location;
  message: string;
}

export const PRESEDENSE = {
  LOWEST: 0,
  ASSIGNMENT: 10,
  COMPARISON: 20,
  ADDITIVE: 30,
  MULTIPLICATIVE: 40,
} as const;

const precedences: Partial<Record<TokenKind, number>> = {
  // Assignment (LOWEST precedence among operators)
  '=': PRESEDENSE.ASSIGNMENT,
  // Comparison operators
  '<': PRESEDENSE.COMPARISON,
  '>': PRESEDENSE.COMPARISON,
  // Additive operators
  '+': PRESEDENSE.ADDITIVE,
  '-': PRESEDENSE.ADDITIVE,
  // Multiplicative operators (highest precedence)
  '*': PRESEDENSE.MULTIPLICATIVE,
  '/': PRESEDENSE.MULTIPLICATIVE,
} as const;

export class Parser {
  curToken: Token;
  peekToken: Token;
  diagnostics: Diagnostic[];
  prefixParseFns: Partial<Record<TokenKind, () => ExprAST>>;

  constructor(public readonly tokenizer: Tokenizer) {
    this.curToken = tokenizer.tokenize();
    this.peekToken = tokenizer.tokenize();
    this.diagnostics = [];
    this.prefixParseFns = this.initPrefixParseFns();
  }

  match(tokenKinds: TokenKind[]) {
    return tokenKinds.includes(this.peekToken.kind);
  }

  nextToken() {
    this.curToken = this.peekToken;
    this.peekToken = this.tokenizer.tokenize();
  }

  peekPrecedence() {
    return precedences[this.peekToken.kind] ?? PRESEDENSE.LOWEST;
  }

  expect(tokenKinds: TokenKind[], errMessage: string) {
    // add diagnostic if kind is not matched
    if (!tokenKinds.includes(this.peekToken.kind)) {
      this.diagnostics.push({
        location: this.curToken.location,
        message: errMessage,
      });
      this.curToken = this.dummyToken(this.curToken);
      return;
    }

    // consume the expected token
    this.curToken = this.peekToken;
    this.peekToken = this.tokenizer.tokenize();
  }

  private initPrefixParseFns() {
    // NOTE: bind is nesessary, otherwise the functions cannot refer `this`
    return {
      NUMBER: this.parseNumber.bind(this),
      IDENTIFIER: this.parseVariable.bind(this),
    };
  }

  dummyToken(prevToken: Token): Token {
    return {
      kind: 'UNKNOWN',
      text: '',
      location: {
        uri: prevToken.location.uri,
        range: {
          start: prevToken.location.range.end,
          end: prevToken.location.range.end,
        },
      },
    };
  }

  parseExpression(precedence: number) {
    const prefix = this.prefixParseFns[this.curToken.kind];
    if (prefix === undefined) {
      // TODO: make proper error message
      this.expect([], `token ${this.curToken.text} cannot be parsed as a prefix`);
      return new MissingAST(this.curToken.location);
    }

    const left = prefix();

    // create RHS AST recursively while the right binding power is stronger than the left one.
    while (this.peekToken.kind !== ';' && precedence < this.peekPrecedence()) {
      // TODO: handle infix
      return left;
    }

    return left;
  }

  parseNumber() {
    return new NumberExprAST(this.curToken.location, parseFloat(this.curToken.text));
  }

  parseVariable() {
    return new VariableExprAST(this.curToken.location, this.curToken.text);
  }
}
