import { Location } from 'vscode-languageserver';
import { Token, Tokenizer, TokenKind } from './lexer';
import {
  CallExprAST,
  ExprAST,
  LiteralExprAST,
  MissingAST,
  NumberExprAST,
  VariableExprAST,
} from './ast';

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
  CALL: 50,
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
  // Multiplicative operators
  '*': PRESEDENSE.MULTIPLICATIVE,
  '/': PRESEDENSE.MULTIPLICATIVE,
  // Call operators
  '(': PRESEDENSE.CALL,
} as const;

export class Parser {
  curToken: Token;
  peekToken: Token;
  diagnostics: Diagnostic[];
  prefixParseFns: Partial<Record<TokenKind, () => ExprAST>>;
  infixParseFns: Partial<Record<TokenKind, (expr: ExprAST) => ExprAST>>;

  constructor(public readonly tokenizer: Tokenizer) {
    this.curToken = this.tokeninzeWithoutComment();
    this.peekToken = this.tokeninzeWithoutComment();
    this.diagnostics = [];
    this.prefixParseFns = this.initPrefixParseFns();
    this.infixParseFns = this.initInfixParseFns();
  }

  match(tokenKinds: TokenKind[]) {
    return tokenKinds.includes(this.peekToken.kind);
  }

  nextToken() {
    this.curToken = this.peekToken;
    this.peekToken = this.tokeninzeWithoutComment();
  }

  private tokeninzeWithoutComment() {
    let next = this.tokenizer.tokenize();
    while (next.kind === 'COMMENT') {
      // ignore comments
      next = this.tokenizer.tokenize();
    }
    return next;
  }

  peekPrecedence() {
    return precedences[this.peekToken.kind] ?? PRESEDENSE.LOWEST;
  }

  expect(tokenKinds: TokenKind[], errMessage: string) {
    // add diagnostic if kind is not matched
    if (!tokenKinds.includes(this.peekToken.kind)) {
      this.addDiagnostic(errMessage);
      this.curToken = this.dummyToken(this.curToken);
      return;
    }

    // consume the expected token
    this.curToken = this.peekToken;
    this.peekToken = this.tokenizer.tokenize();
  }

  addDiagnostic(errMessage: string) {
    this.diagnostics.push({
      location: this.curToken.location,
      message: errMessage,
    });
  }

  private initPrefixParseFns() {
    // NOTE: bind is nesessary, otherwise the functions cannot refer `this`
    return {
      NUMBER: this.parseNumber.bind(this),
      IDENTIFIER: this.parseVariable.bind(this),
      '[': this.parseLiteral.bind(this),
    };
  }

  private initInfixParseFns() {
    // NOTE: bind is nesessary, otherwise the functions cannot refer `this`
    return {
      '(': this.parseCall.bind(this),
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
      this.expect([], `'${this.curToken.text}' cannot be parsed as an expression`);
      return new MissingAST(this.curToken.location);
    }

    let left = prefix();

    // create RHS AST recursively while the right binding power is stronger than the left one.
    while (!this.match([';']) && precedence < this.peekPrecedence()) {
      const infix = this.infixParseFns[this.peekToken.kind];
      if (infix === undefined) {
        this.expect([], `'${this.curToken.text}' cannot be parsed as an infix operator`);
        return new MissingAST(this.curToken.location);
      }

      this.nextToken();

      left = infix(left);
    }

    return left;
  }

  parseNumber() {
    return new NumberExprAST(this.curToken.location, parseFloat(this.curToken.text));
  }

  parseVariable() {
    return new VariableExprAST(this.curToken.location, this.curToken.text);
  }

  parseLiteral() {
    const loc = this.curToken.location;
    const values: (ExprAST | MissingAST)[] = [];

    // empty
    if (this.match([']'])) {
      this.nextToken();
      return new LiteralExprAST(loc, []);
    }

    this.nextToken(); // current: value
    values.push(this.parseExpression(PRESEDENSE.LOWEST));

    while (this.match([',', 'IDENTIFIER', 'NUMBER'])) {
      this.expect([','], "',' is missing");
      this.nextToken(); // current: next value
      values.push(this.parseExpression(PRESEDENSE.LOWEST));
    }

    this.expect([']'], "']' is missing");

    return new LiteralExprAST(loc, values);
  }

  parseCall(func: ExprAST) {
    const args: (ExprAST | MissingAST)[] = [];

    let name = '<UNKNOWN!>';
    if (func instanceof VariableExprAST) {
      name = func.name;
    } else {
      this.addDiagnostic(`'${func.dump()}' is not a function name`);
    }

    // empty
    if (this.match([')'])) {
      this.nextToken();
      return new CallExprAST(func.loc, name, []);
    }

    this.nextToken(); // current: arg
    args.push(this.parseExpression(PRESEDENSE.LOWEST));

    while (this.match([',', 'IDENTIFIER', 'NUMBER'])) {
      this.expect([','], "',' is missing");
      this.nextToken(); // current: next arg
      args.push(this.parseExpression(PRESEDENSE.LOWEST));
    }

    this.expect([')'], "')' is missing");

    return new CallExprAST(func.loc, name, args);
  }
}
