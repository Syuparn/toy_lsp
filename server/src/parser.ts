import { Location } from 'vscode-languageserver';
import { Token, Tokenizer, TokenKind } from './lexer';
import { NumberExprAST, VariableExprAST } from './ast';

export interface Diagnostic {
  location: Location;
  message: string;
}

export const PRESEDENSE = {
  LOWESt: 0,
  ASSIGNMENT: 10,
  COMPARISON: 20,
  ADDITIVE: 30,
  MULTIPLICATIVE: 40,
} as const;

const precedences: Record<TokenKind, number> = {
  // Punctuation (not used as binary operators)
  ';': PRESEDENSE.LOWESt,
  '(': PRESEDENSE.LOWESt,
  ')': PRESEDENSE.LOWESt,
  '{': PRESEDENSE.LOWESt,
  '}': PRESEDENSE.LOWESt,
  '[': PRESEDENSE.LOWESt,
  ']': PRESEDENSE.LOWESt,
  ',': PRESEDENSE.LOWESt,
  // Assignment (lowest precedence among operators)
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
  // Keywords (not used as operators)
  return: PRESEDENSE.LOWESt,
  var: PRESEDENSE.LOWESt,
  def: PRESEDENSE.LOWESt,
  // Literals and identifiers
  IDENTIFIER: PRESEDENSE.LOWESt,
  NUMBER: PRESEDENSE.LOWESt,
  // Special tokens
  COMMENT: PRESEDENSE.LOWESt,
  EOF: PRESEDENSE.LOWESt,
  UNKNOWN: PRESEDENSE.LOWESt,
} as const;

export class Parser {
  curToken: Token;
  peekToken: Token;
  diagnostics: Diagnostic[];

  constructor(public readonly tokenizer: Tokenizer) {
    this.curToken = tokenizer.tokenize();
    this.peekToken = tokenizer.tokenize();
    this.diagnostics = [];
  }

  match(tokenKinds: TokenKind[]) {
    return tokenKinds.includes(this.peekToken.kind);
  }

  nextToken() {
    this.curToken = this.peekToken;
    this.peekToken = this.tokenizer.tokenize();
  }

  peekPrecedence() {
    return precedences[this.peekToken.kind];
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

  parseNumber() {
    return new NumberExprAST(this.curToken.location, parseFloat(this.curToken.text));
  }

  parseVariable() {
    return new VariableExprAST(this.curToken.location, this.curToken.text);
  }
}
