import { Parser, PRESEDENSE } from './parser';
import { Tokenizer } from './lexer';
import { CallExprAST, LiteralExprAST, MissingAST, NumberExprAST, VariableExprAST } from './ast';

const uri = 'test://test.toy';

// helper function to create loc
function toLoc(
  uri: string,
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number
) {
  return {
    uri: uri,
    range: {
      start: {
        line: startLine,
        character: startCharacter,
      },
      end: {
        line: endLine,
        character: endCharacter,
      },
    },
  };
}

describe('tokens', () => {
  it('initialize current and peek tokens', () => {
    const tokenizer = new Tokenizer(uri, '1 + 2');
    const parser = new Parser(tokenizer);
    expect(parser.curToken.text).toBe('1');
    expect(parser.peekToken.text).toBe('+');
  });

  it('when peekToken index out of range', () => {
    const tokenizer = new Tokenizer(uri, '1');
    const parser = new Parser(tokenizer);
    expect(parser.curToken.text).toBe('1');
    expect(parser.peekToken.kind).toBe('EOF');
  });

  it('when curToken index out of range', () => {
    const tokenizer = new Tokenizer(uri, '');
    const parser = new Parser(tokenizer);
    expect(parser.curToken.kind).toBe('EOF');
    expect(parser.peekToken.kind).toBe('EOF');
  });
});

describe('peekPrecedence', () => {
  it('precedence: +', () => {
    const tokenizer = new Tokenizer(uri, '1 + 2');
    const parser = new Parser(tokenizer);
    expect(parser.peekPrecedence()).toBe(PRESEDENSE.ADDITIVE);
  });

  it('precedence: *', () => {
    const tokenizer = new Tokenizer(uri, '1 * 2');
    const parser = new Parser(tokenizer);
    expect(parser.peekPrecedence()).toBe(PRESEDENSE.MULTIPLICATIVE);
  });

  it('precedence: ()', () => {
    const tokenizer = new Tokenizer(uri, 'foo()');
    const parser = new Parser(tokenizer);
    expect(parser.peekPrecedence()).toBe(PRESEDENSE.CALL);
  });

  it('precedence: =', () => {
    const tokenizer = new Tokenizer(uri, 'a = 2');
    const parser = new Parser(tokenizer);
    expect(parser.peekPrecedence()).toBe(PRESEDENSE.ASSIGNMENT);
  });

  it('precedence: other', () => {
    const tokenizer = new Tokenizer(uri, 'return a');
    const parser = new Parser(tokenizer);
    expect(parser.peekPrecedence()).toBe(PRESEDENSE.LOWEST);
  });
});

describe('Number', () => {
  it('parse number', () => {
    const tokenizer = new Tokenizer(uri, '1');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new NumberExprAST(toLoc(uri, 0, 0, 0, 1), 1)
    );
  });
});

describe('Variable', () => {
  it('parse variable', () => {
    const tokenizer = new Tokenizer(uri, 'foo');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new VariableExprAST(toLoc(uri, 0, 0, 0, 3), 'foo')
    );
  });
});

describe('Literal', () => {
  it('parse literal (empty)', () => {
    const tokenizer = new Tokenizer(uri, '[]');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new LiteralExprAST(toLoc(uri, 0, 0, 0, 1), [])
    );
  });

  it('parse literal (1 element)', () => {
    const tokenizer = new Tokenizer(uri, '[1]');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new LiteralExprAST(toLoc(uri, 0, 0, 0, 1), [new NumberExprAST(toLoc(uri, 0, 1, 0, 2), 1)])
    );
  });

  it('parse literal (2 elements)', () => {
    const tokenizer = new Tokenizer(uri, '[1, 2]');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new LiteralExprAST(toLoc(uri, 0, 0, 0, 1), [
        new NumberExprAST(toLoc(uri, 0, 1, 0, 2), 1),
        new NumberExprAST(toLoc(uri, 0, 4, 0, 5), 2),
      ])
    );
  });

  it('parse literal (matrix)', () => {
    const tokenizer = new Tokenizer(uri, '[[1, 2], [3, 4]]');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new LiteralExprAST(toLoc(uri, 0, 0, 0, 1), [
        new LiteralExprAST(toLoc(uri, 0, 1, 0, 2), [
          new NumberExprAST(toLoc(uri, 0, 2, 0, 3), 1),
          new NumberExprAST(toLoc(uri, 0, 5, 0, 6), 2),
        ]),
        new LiteralExprAST(toLoc(uri, 0, 9, 0, 10), [
          new NumberExprAST(toLoc(uri, 0, 10, 0, 11), 3),
          new NumberExprAST(toLoc(uri, 0, 13, 0, 14), 4),
        ]),
      ])
    );
  });

  // invalid literal is checked later in static analysis
  it('parse invalid literal', () => {
    const tokenizer = new Tokenizer(uri, '[a]');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new LiteralExprAST(toLoc(uri, 0, 0, 0, 1), [new VariableExprAST(toLoc(uri, 0, 1, 0, 2), 'a')])
    );
  });

  it('syntax error: missing ]', () => {
    const tokenizer = new Tokenizer(uri, '[1');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new LiteralExprAST(toLoc(uri, 0, 0, 0, 1), [new NumberExprAST(toLoc(uri, 0, 1, 0, 2), 1)])
    );
    expect(parser.diagnostics[0].message).toBe("']' is missing");
  });

  it('syntax error: missing ] (;)', () => {
    const tokenizer = new Tokenizer(uri, '[1;');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new LiteralExprAST(toLoc(uri, 0, 0, 0, 1), [new NumberExprAST(toLoc(uri, 0, 1, 0, 2), 1)])
    );
    expect(parser.diagnostics[0].message).toBe("']' is missing");
  });

  it('syntax error: missing ,', () => {
    const tokenizer = new Tokenizer(uri, '[1 2]');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new LiteralExprAST(toLoc(uri, 0, 0, 0, 1), [
        new NumberExprAST(toLoc(uri, 0, 1, 0, 2), 1),
        new NumberExprAST(toLoc(uri, 0, 3, 0, 4), 2),
      ])
    );
    expect(parser.diagnostics[0].message).toBe("',' is missing");
  });

  it('syntax error: nest', () => {
    const tokenizer = new Tokenizer(uri, '[[1]');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new LiteralExprAST(toLoc(uri, 0, 0, 0, 1), [
        new LiteralExprAST(toLoc(uri, 0, 1, 0, 2), [new NumberExprAST(toLoc(uri, 0, 2, 0, 3), 1)]),
      ])
    );
    expect(parser.diagnostics[0].message).toBe("']' is missing");
  });
});

describe('Call', () => {
  it('parse call (empty)', () => {
    const tokenizer = new Tokenizer(uri, 'f()');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new CallExprAST(toLoc(uri, 0, 0, 0, 1), 'f', [])
    );
  });

  it('parse literal (1 arg)', () => {
    const tokenizer = new Tokenizer(uri, 'f(1)');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new CallExprAST(toLoc(uri, 0, 0, 0, 1), 'f', [new NumberExprAST(toLoc(uri, 0, 2, 0, 3), 1)])
    );
  });

  it('parse literal (2 args)', () => {
    const tokenizer = new Tokenizer(uri, 'f(1, 2)');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new CallExprAST(toLoc(uri, 0, 0, 0, 1), 'f', [
        new NumberExprAST(toLoc(uri, 0, 2, 0, 3), 1),
        new NumberExprAST(toLoc(uri, 0, 5, 0, 6), 2),
      ])
    );
  });

  it('syntax error: missing )', () => {
    const tokenizer = new Tokenizer(uri, 'f(1');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new CallExprAST(toLoc(uri, 0, 0, 0, 1), 'f', [new NumberExprAST(toLoc(uri, 0, 2, 0, 3), 1)])
    );
    expect(parser.diagnostics[0].message).toBe("')' is missing");
  });

  it('syntax error: missing ) (;)', () => {
    const tokenizer = new Tokenizer(uri, 'f(1;');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new CallExprAST(toLoc(uri, 0, 0, 0, 1), 'f', [new NumberExprAST(toLoc(uri, 0, 2, 0, 3), 1)])
    );
    expect(parser.diagnostics[0].message).toBe("')' is missing");
  });

  it('syntax error: missing ,', () => {
    const tokenizer = new Tokenizer(uri, 'f(1 2)');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new CallExprAST(toLoc(uri, 0, 0, 0, 1), 'f', [
        new NumberExprAST(toLoc(uri, 0, 2, 0, 3), 1),
        new NumberExprAST(toLoc(uri, 0, 4, 0, 5), 2),
      ])
    );
    expect(parser.diagnostics[0].message).toBe("',' is missing");
  });

  it('syntax error: nest', () => {
    const tokenizer = new Tokenizer(uri, 'f(g()');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new CallExprAST(toLoc(uri, 0, 0, 0, 1), 'f', [
        new CallExprAST(toLoc(uri, 0, 2, 0, 3), 'g', []),
      ])
    );
    expect(parser.diagnostics[0].message).toBe("')' is missing");
  });

  it('error: callee is not a variable', () => {
    const tokenizer = new Tokenizer(uri, '1()');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new CallExprAST(toLoc(uri, 0, 0, 0, 1), '<UNKNOWN!>', [])
    );
    expect(parser.diagnostics[0].message).toBe("'1' is not a function name");
  });
});

describe('Expr', () => {
  it('syntax error: unknown prefix', () => {
    const tokenizer = new Tokenizer(uri, ',');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new MissingAST(toLoc(uri, 0, 1, 0, 1))
    );
    expect(parser.diagnostics[0].message).toBe("',' cannot be parsed as an expression");
  });
});

describe('Comment', () => {
  it('ignore comment', () => {
    const tokenizer = new Tokenizer(uri, '#foo\n[1]');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new LiteralExprAST(toLoc(uri, 1, 0, 1, 1), [new NumberExprAST(toLoc(uri, 1, 1, 1, 2), 1)])
    );
  });
});
