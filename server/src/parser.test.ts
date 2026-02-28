import { Parser, PRESEDENCE } from './parser';
import { Tokenizer } from './lexer';
import {
  CallExprAST,
  ExprStmtAST,
  InfixExprAST,
  LiteralExprAST,
  MissingAST,
  NumberExprAST,
  ReturnStmtAST,
  VarDeclStmtAST,
  VariableExprAST,
} from './ast';

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
    expect(parser.peekPrecedence()).toBe(PRESEDENCE.ADDITIVE);
  });

  it('precedence: *', () => {
    const tokenizer = new Tokenizer(uri, '1 * 2');
    const parser = new Parser(tokenizer);
    expect(parser.peekPrecedence()).toBe(PRESEDENCE.MULTIPLICATIVE);
  });

  it('precedence: ()', () => {
    const tokenizer = new Tokenizer(uri, 'foo()');
    const parser = new Parser(tokenizer);
    expect(parser.peekPrecedence()).toBe(PRESEDENCE.CALL);
  });

  it('precedence: =', () => {
    const tokenizer = new Tokenizer(uri, 'a = 2');
    const parser = new Parser(tokenizer);
    expect(parser.peekPrecedence()).toBe(PRESEDENCE.ASSIGNMENT);
  });

  it('precedence: other', () => {
    const tokenizer = new Tokenizer(uri, 'return a');
    const parser = new Parser(tokenizer);
    expect(parser.peekPrecedence()).toBe(PRESEDENCE.LOWEST);
  });
});

describe('Number', () => {
  it('parse number', () => {
    const tokenizer = new Tokenizer(uri, '1');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new NumberExprAST(toLoc(uri, 0, 0, 0, 1), 1)
    );
  });
});

describe('Variable', () => {
  it('parse variable', () => {
    const tokenizer = new Tokenizer(uri, 'foo');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new VariableExprAST(toLoc(uri, 0, 0, 0, 3), 'foo')
    );
  });
});

describe('Literal', () => {
  it('parse literal (empty)', () => {
    const tokenizer = new Tokenizer(uri, '[]');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new LiteralExprAST(toLoc(uri, 0, 0, 0, 1), [])
    );
  });

  it('parse literal (1 element)', () => {
    const tokenizer = new Tokenizer(uri, '[1]');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new LiteralExprAST(toLoc(uri, 0, 0, 0, 1), [new NumberExprAST(toLoc(uri, 0, 1, 0, 2), 1)])
    );
  });

  it('parse literal (2 elements)', () => {
    const tokenizer = new Tokenizer(uri, '[1, 2]');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new LiteralExprAST(toLoc(uri, 0, 0, 0, 1), [
        new NumberExprAST(toLoc(uri, 0, 1, 0, 2), 1),
        new NumberExprAST(toLoc(uri, 0, 4, 0, 5), 2),
      ])
    );
  });

  it('parse literal (matrix)', () => {
    const tokenizer = new Tokenizer(uri, '[[1, 2], [3, 4]]');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
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
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new LiteralExprAST(toLoc(uri, 0, 0, 0, 1), [new VariableExprAST(toLoc(uri, 0, 1, 0, 2), 'a')])
    );
  });

  it('syntax error: missing ]', () => {
    const tokenizer = new Tokenizer(uri, '[1');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new LiteralExprAST(toLoc(uri, 0, 0, 0, 1), [new NumberExprAST(toLoc(uri, 0, 1, 0, 2), 1)])
    );
    expect(parser.diagnostics[0].message).toBe("']' is missing");
  });

  it('syntax error: missing ] (;)', () => {
    const tokenizer = new Tokenizer(uri, '[1;');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new LiteralExprAST(toLoc(uri, 0, 0, 0, 1), [new NumberExprAST(toLoc(uri, 0, 1, 0, 2), 1)])
    );
    expect(parser.diagnostics[0].message).toBe("']' is missing");
  });

  it('syntax error: missing ,', () => {
    const tokenizer = new Tokenizer(uri, '[1 2]');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
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
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
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
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new CallExprAST(toLoc(uri, 0, 0, 0, 1), 'f', [])
    );
  });

  it('parse literal (1 arg)', () => {
    const tokenizer = new Tokenizer(uri, 'f(1)');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new CallExprAST(toLoc(uri, 0, 0, 0, 1), 'f', [new NumberExprAST(toLoc(uri, 0, 2, 0, 3), 1)])
    );
  });

  it('parse literal (2 args)', () => {
    const tokenizer = new Tokenizer(uri, 'f(1, 2)');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new CallExprAST(toLoc(uri, 0, 0, 0, 1), 'f', [
        new NumberExprAST(toLoc(uri, 0, 2, 0, 3), 1),
        new NumberExprAST(toLoc(uri, 0, 5, 0, 6), 2),
      ])
    );
  });

  it('syntax error: missing )', () => {
    const tokenizer = new Tokenizer(uri, 'f(1');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new CallExprAST(toLoc(uri, 0, 0, 0, 1), 'f', [new NumberExprAST(toLoc(uri, 0, 2, 0, 3), 1)])
    );
    expect(parser.diagnostics[0].message).toBe("')' is missing");
  });

  it('syntax error: missing ) (;)', () => {
    const tokenizer = new Tokenizer(uri, 'f(1;');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new CallExprAST(toLoc(uri, 0, 0, 0, 1), 'f', [new NumberExprAST(toLoc(uri, 0, 2, 0, 3), 1)])
    );
    expect(parser.diagnostics[0].message).toBe("')' is missing");
  });

  it('syntax error: missing ,', () => {
    const tokenizer = new Tokenizer(uri, 'f(1 2)');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
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
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new CallExprAST(toLoc(uri, 0, 0, 0, 1), 'f', [
        new CallExprAST(toLoc(uri, 0, 2, 0, 3), 'g', []),
      ])
    );
    expect(parser.diagnostics[0].message).toBe("')' is missing");
  });

  it('error: callee is not a variable', () => {
    const tokenizer = new Tokenizer(uri, '1()');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new CallExprAST(toLoc(uri, 0, 0, 0, 1), '<UNKNOWN!>', [])
    );
    expect(parser.diagnostics[0].message).toBe("'1' is not a function name");
  });
});

describe('Infix', () => {
  it('+', () => {
    const tokenizer = new Tokenizer(uri, '2 + 3');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new InfixExprAST(
        toLoc(uri, 0, 2, 0, 3),
        new NumberExprAST(toLoc(uri, 0, 0, 0, 1), 2),
        '+',
        new NumberExprAST(toLoc(uri, 0, 4, 0, 5), 3)
      )
    );
  });

  it('-', () => {
    const tokenizer = new Tokenizer(uri, '2 - 3');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new InfixExprAST(
        toLoc(uri, 0, 2, 0, 3),
        new NumberExprAST(toLoc(uri, 0, 0, 0, 1), 2),
        '-',
        new NumberExprAST(toLoc(uri, 0, 4, 0, 5), 3)
      )
    );
  });

  it('*', () => {
    const tokenizer = new Tokenizer(uri, '2 * 3');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new InfixExprAST(
        toLoc(uri, 0, 2, 0, 3),
        new NumberExprAST(toLoc(uri, 0, 0, 0, 1), 2),
        '*',
        new NumberExprAST(toLoc(uri, 0, 4, 0, 5), 3)
      )
    );
  });

  it('/', () => {
    const tokenizer = new Tokenizer(uri, '2 / 3');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new InfixExprAST(
        toLoc(uri, 0, 2, 0, 3),
        new NumberExprAST(toLoc(uri, 0, 0, 0, 1), 2),
        '/',
        new NumberExprAST(toLoc(uri, 0, 4, 0, 5), 3)
      )
    );
  });

  it('* has higher precedence than +', () => {
    const tokenizer = new Tokenizer(uri, '2 + 3 * 4');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new InfixExprAST(
        toLoc(uri, 0, 2, 0, 3),
        new NumberExprAST(toLoc(uri, 0, 0, 0, 1), 2),
        '+',
        new InfixExprAST(
          toLoc(uri, 0, 6, 0, 7),
          new NumberExprAST(toLoc(uri, 0, 4, 0, 5), 3),
          '*',
          new NumberExprAST(toLoc(uri, 0, 8, 0, 9), 4)
        )
      )
    );
  });

  it('+ has lower precedence than *', () => {
    const tokenizer = new Tokenizer(uri, '2 * 3 + 4');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new InfixExprAST(
        toLoc(uri, 0, 6, 0, 7),
        new InfixExprAST(
          toLoc(uri, 0, 2, 0, 3),
          new NumberExprAST(toLoc(uri, 0, 0, 0, 1), 2),
          '*',
          new NumberExprAST(toLoc(uri, 0, 4, 0, 5), 3)
        ),
        '+',
        new NumberExprAST(toLoc(uri, 0, 8, 0, 9), 4)
      )
    );
  });

  it('grouping', () => {
    const tokenizer = new Tokenizer(uri, '(2)');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new NumberExprAST(toLoc(uri, 0, 1, 0, 2), 2)
    );
  });

  it('grouping changes precedence', () => {
    const tokenizer = new Tokenizer(uri, '2 * (3 + 4)');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new InfixExprAST(
        toLoc(uri, 0, 2, 0, 3),
        new NumberExprAST(toLoc(uri, 0, 0, 0, 1), 2),
        '*',
        new InfixExprAST(
          toLoc(uri, 0, 7, 0, 8),
          new NumberExprAST(toLoc(uri, 0, 5, 0, 6), 3),
          '+',
          new NumberExprAST(toLoc(uri, 0, 9, 0, 10), 4)
        )
      )
    );
  });

  it('syntax error: missing )', () => {
    const tokenizer = new Tokenizer(uri, '(2 + 3');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new InfixExprAST(
        toLoc(uri, 0, 3, 0, 4),
        new NumberExprAST(toLoc(uri, 0, 1, 0, 2), 2),
        '+',
        new NumberExprAST(toLoc(uri, 0, 5, 0, 6), 3)
      )
    );
    expect(parser.diagnostics[0].message).toBe("')' is missing");
  });
});

describe('Expr', () => {
  it('syntax error: unknown prefix', () => {
    const tokenizer = new Tokenizer(uri, ',');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new MissingAST(toLoc(uri, 0, 1, 0, 1))
    );
    expect(parser.diagnostics[0].message).toBe("',' cannot be parsed as an expression");
  });
});

describe('Comment', () => {
  it('ignore comment', () => {
    const tokenizer = new Tokenizer(uri, '#foo\n[1]');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENCE.LOWEST)).toStrictEqual(
      new LiteralExprAST(toLoc(uri, 1, 0, 1, 1), [new NumberExprAST(toLoc(uri, 1, 1, 1, 2), 1)])
    );
  });
});

describe('ExpressionStmt', () => {
  it('parse expression statement', () => {
    const tokenizer = new Tokenizer(uri, '1;');
    const parser = new Parser(tokenizer);
    expect(parser.parseStatement()).toStrictEqual(
      new ExprStmtAST(toLoc(uri, 0, 0, 0, 1), new NumberExprAST(toLoc(uri, 0, 0, 0, 1), 1))
    );
  });

  it('syntax error: missing ;', () => {
    const tokenizer = new Tokenizer(uri, '1 2');
    const parser = new Parser(tokenizer);
    expect(parser.parseStatement()).toStrictEqual(
      new ExprStmtAST(toLoc(uri, 0, 0, 0, 1), new NumberExprAST(toLoc(uri, 0, 0, 0, 1), 1))
    );
    expect(parser.diagnostics[0].message).toBe("';' is missing");
  });
});

describe('ReturnStmt', () => {
  it('parse return statement', () => {
    const tokenizer = new Tokenizer(uri, 'return 1;');
    const parser = new Parser(tokenizer);
    expect(parser.parseStatement()).toStrictEqual(
      new ReturnStmtAST(toLoc(uri, 0, 0, 0, 6), new NumberExprAST(toLoc(uri, 0, 7, 0, 8), 1))
    );
  });

  it('parse return statement (no value)', () => {
    const tokenizer = new Tokenizer(uri, 'return;');
    const parser = new Parser(tokenizer);
    expect(parser.parseStatement()).toStrictEqual(new ReturnStmtAST(toLoc(uri, 0, 0, 0, 6)));
  });

  it('syntax error: missing ;', () => {
    const tokenizer = new Tokenizer(uri, 'return 1 2');
    const parser = new Parser(tokenizer);
    expect(parser.parseStatement()).toStrictEqual(
      new ReturnStmtAST(toLoc(uri, 0, 0, 0, 6), new NumberExprAST(toLoc(uri, 0, 7, 0, 8), 1))
    );
    expect(parser.diagnostics[0].message).toBe("';' is missing");
  });
});

describe('VarDeclStmt', () => {
  it('parse var decl statement', () => {
    const tokenizer = new Tokenizer(uri, 'var a = 1;');
    const parser = new Parser(tokenizer);
    expect(parser.parseStatement()).toStrictEqual(
      new VarDeclStmtAST(toLoc(uri, 0, 0, 0, 3), 'a', new NumberExprAST(toLoc(uri, 0, 8, 0, 9), 1))
    );
  });

  it('parse var decl statement (with 1-dim type)', () => {
    const tokenizer = new Tokenizer(uri, 'var a<1> = [2];');
    const parser = new Parser(tokenizer);
    expect(parser.parseStatement()).toStrictEqual(
      new VarDeclStmtAST(
        toLoc(uri, 0, 0, 0, 3),
        'a',
        new LiteralExprAST(toLoc(uri, 0, 11, 0, 12), [
          new NumberExprAST(toLoc(uri, 0, 12, 0, 13), 2),
        ]),
        [1]
      )
    );
  });

  it('parse var decl statement (with 2-dim type)', () => {
    const tokenizer = new Tokenizer(uri, 'var a<2, 1> = [[3], [4]];');
    const parser = new Parser(tokenizer);
    expect(parser.parseStatement()).toStrictEqual(
      new VarDeclStmtAST(
        toLoc(uri, 0, 0, 0, 3),
        'a',
        new LiteralExprAST(toLoc(uri, 0, 14, 0, 15), [
          new LiteralExprAST(toLoc(uri, 0, 15, 0, 16), [
            new NumberExprAST(toLoc(uri, 0, 16, 0, 17), 3),
          ]),
          new LiteralExprAST(toLoc(uri, 0, 20, 0, 21), [
            new NumberExprAST(toLoc(uri, 0, 21, 0, 22), 4),
          ]),
        ]),
        [2, 1]
      )
    );
  });

  it('syntax error: not an identifier', () => {
    const tokenizer = new Tokenizer(uri, 'var 1 = 1;');
    const parser = new Parser(tokenizer);
    expect(parser.parseStatement()).toStrictEqual(
      new VarDeclStmtAST(
        toLoc(uri, 0, 0, 0, 3),
        '<UNKNOWN!>',
        new MissingAST(toLoc(uri, 0, 5, 0, 5))
      )
    );
    expect(parser.diagnostics[0].message).toBe("'1' is not an identifier");
  });

  it('syntax error: missing =', () => {
    const tokenizer = new Tokenizer(uri, 'var a 1;');
    const parser = new Parser(tokenizer);
    expect(parser.parseStatement()).toStrictEqual(
      new VarDeclStmtAST(toLoc(uri, 0, 0, 0, 3), 'a', new NumberExprAST(toLoc(uri, 0, 6, 0, 7), 1))
    );
    expect(parser.diagnostics[0].message).toBe("'=' is missing");
  });

  it('syntax error: missing ;', () => {
    const tokenizer = new Tokenizer(uri, 'var a = 1 2');
    const parser = new Parser(tokenizer);
    expect(parser.parseStatement()).toStrictEqual(
      new VarDeclStmtAST(toLoc(uri, 0, 0, 0, 3), 'a', new NumberExprAST(toLoc(uri, 0, 8, 0, 9), 1))
    );
    expect(parser.diagnostics[0].message).toBe("';' is missing");
  });

  it('syntax error: missing >', () => {
    const tokenizer = new Tokenizer(uri, 'var a<1 = [2];');
    const parser = new Parser(tokenizer);
    expect(parser.parseStatement()).toStrictEqual(
      new VarDeclStmtAST(
        toLoc(uri, 0, 0, 0, 3),
        'a',
        new LiteralExprAST(toLoc(uri, 0, 10, 0, 11), [
          new NumberExprAST(toLoc(uri, 0, 11, 0, 12), 2),
        ])
      )
    );
    expect(parser.diagnostics[0].message).toBe("'1' cannot be parsed as an infix operator");
  });

  it('syntax error: missing > (empty)', () => {
    const tokenizer = new Tokenizer(uri, 'var a< = [2];');
    const parser = new Parser(tokenizer);
    expect(parser.parseStatement()).toStrictEqual(
      new VarDeclStmtAST(
        toLoc(uri, 0, 0, 0, 3),
        'a',
        new LiteralExprAST(toLoc(uri, 0, 9, 0, 10), [
          new NumberExprAST(toLoc(uri, 0, 10, 0, 11), 2),
        ])
      )
    );
    expect(parser.diagnostics[0].message).toBe("'=' cannot be parsed as an expression");
  });

  it('error: type parameter is not a number', () => {
    const tokenizer = new Tokenizer(uri, 'var a<b> = [2];');
    const parser = new Parser(tokenizer);
    expect(parser.parseStatement()).toStrictEqual(
      new VarDeclStmtAST(
        toLoc(uri, 0, 0, 0, 3),
        'a',
        new LiteralExprAST(toLoc(uri, 0, 11, 0, 12), [
          new NumberExprAST(toLoc(uri, 0, 12, 0, 13), 2),
        ])
      )
    );
    expect(parser.diagnostics[0].message).toBe('type parameter must be numbers');
  });
});
