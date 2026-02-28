import { Location } from 'vscode-languageserver';
import { Token, Tokenizer, TokenKind } from './lexer';
import {
  CallExprAST,
  ExprAST,
  ExprStmtAST,
  InfixExprAST,
  LiteralExprAST,
  MissingAST,
  NumberExprAST,
  ReturnStmtAST,
  VarDeclStmtAST,
  VariableExprAST,
} from './ast';

export interface Diagnostic {
  location: Location;
  message: string;
}

export const PRESEDENCE = {
  LOWEST: 0,
  ASSIGNMENT: 10,
  ADDITIVE: 20,
  MULTIPLICATIVE: 30,
  CALL: 40,
} as const;

const precedences: Partial<Record<TokenKind, number>> = {
  // Assignment (LOWEST precedence among operators)
  '=': PRESEDENCE.ASSIGNMENT,
  // Additive operators
  '+': PRESEDENCE.ADDITIVE,
  '-': PRESEDENCE.ADDITIVE,
  // Multiplicative operators
  '*': PRESEDENCE.MULTIPLICATIVE,
  '/': PRESEDENCE.MULTIPLICATIVE,
  // Call operators
  '(': PRESEDENCE.CALL,
} as const;

export class Parser {
  curToken: Token;
  peekToken: Token;
  diagnostics: Diagnostic[];
  prefixParseFns: Partial<Record<TokenKind, () => ExprAST | MissingAST>>;
  infixParseFns: Partial<Record<TokenKind, (expr: ExprAST | MissingAST) => ExprAST | MissingAST>>;

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

  curPrecedence() {
    return precedences[this.curToken.kind] ?? PRESEDENCE.LOWEST;
  }

  peekPrecedence() {
    return precedences[this.peekToken.kind] ?? PRESEDENCE.LOWEST;
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
      '(': this.parseGroup.bind(this),
    };
  }

  private initInfixParseFns() {
    // NOTE: bind is nesessary, otherwise the functions cannot refer `this`
    return {
      '(': this.parseCall.bind(this),
      '+': this.parseInfix.bind(this),
      '-': this.parseInfix.bind(this),
      '*': this.parseInfix.bind(this),
      '/': this.parseInfix.bind(this),
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

  parseStatement() {
    switch (this.curToken.kind) {
      case 'return':
        return this.parseReturnStatement();
      case 'var':
        return this.parseVarDeclStatement();
      default:
        return this.parseExpressionStatement();
    }
  }

  parseReturnStatement() {
    const loc = this.curToken.location;
    if (this.match([';'])) {
      this.nextToken(); // current: ;
      this.nextToken(); // current: next line
      return new ReturnStmtAST(loc);
    }

    this.nextToken(); // current: value

    const expr = this.parseExpression(PRESEDENCE.LOWEST);
    this.expect([';'], "';' is missing");
    return new ReturnStmtAST(loc, expr);
  }

  parseVarDeclStatement() {
    const loc = this.curToken.location;
    this.expect(['IDENTIFIER'], `'${this.peekToken.text}' is not an identifier`);

    let name = '<UNKNOWN!>';
    if (this.curToken.kind === 'IDENTIFIER') {
      const variable = this.parseVariable();
      name = variable.name;
    }

    let types: number[] | undefined = undefined;
    if (this.match(['<'])) {
      this.nextToken();
      const exprs = this.parseExpressions('>');
      if (exprs.every((e) => e instanceof NumberExprAST)) {
        types = exprs.map((e) => e.value);
      } else {
        this.addDiagnostic('type parameter must be numbers');
      }
    }

    this.expect(['='], `'=' is missing`);
    this.nextToken();
    const expr = this.parseExpression(PRESEDENCE.LOWEST);
    this.expect([';'], "';' is missing");
    return new VarDeclStmtAST(loc, name, expr, types);
  }

  parseExpressionStatement() {
    const loc = this.curToken.location;
    const expr = this.parseExpression(PRESEDENCE.LOWEST);
    this.expect([';'], "';' is missing");
    return new ExprStmtAST(loc, expr);
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
    const values = this.parseExpressions(']');
    return new LiteralExprAST(loc, values);
  }

  parseCall(func: ExprAST | MissingAST) {
    let name = '<UNKNOWN!>';
    if (func instanceof VariableExprAST) {
      name = func.name;
    } else {
      this.addDiagnostic(`'${func.dump()}' is not a function name`);
    }

    const args = this.parseExpressions(')');
    return new CallExprAST(func.loc, name, args);
  }

  parseExpressions(endKind: TokenKind) {
    const exprs: (ExprAST | MissingAST)[] = [];

    // empty
    if (this.match([endKind])) {
      this.nextToken();
      return [];
    }

    this.nextToken(); // current: value
    exprs.push(this.parseExpression(PRESEDENCE.LOWEST));

    while (this.match([',', 'IDENTIFIER', 'NUMBER'])) {
      this.expect([','], "',' is missing");
      this.nextToken(); // current: next value
      exprs.push(this.parseExpression(PRESEDENCE.LOWEST));
    }

    this.expect([endKind], `'${endKind}' is missing`);
    return exprs;
  }

  parseInfix(left: ExprAST | MissingAST) {
    const loc = this.curToken.location;
    const op = this.curToken.text;

    const precedence = this.curPrecedence();
    this.nextToken(); // current: right value
    const right = this.parseExpression(precedence);
    return new InfixExprAST(loc, left, op, right);
  }

  parseGroup() {
    this.nextToken(); // current: value

    // set presedence LOWEST for right binding
    const expr = this.parseExpression(PRESEDENCE.LOWEST);
    this.expect([')'], `')' is missing`);

    return expr;
  }
}
