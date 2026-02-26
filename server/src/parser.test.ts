import { Parser, PRESEDENSE } from './parser';
import { Tokenizer } from './lexer';
import { NumberExprAST, VariableExprAST } from './ast';

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
  const uri = 'test://test.toy';

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
  const uri = 'test://test.toy';

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
  const uri = 'test://test.toy';

  it('parse number', () => {
    const tokenizer = new Tokenizer(uri, '1');
    const parser = new Parser(tokenizer);
    expect(parser.parseNumber()).toStrictEqual(new NumberExprAST(toLoc(uri, 0, 0, 0, 1), 1));
  });

  it('parse number as expression', () => {
    const tokenizer = new Tokenizer(uri, '1');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new NumberExprAST(toLoc(uri, 0, 0, 0, 1), 1)
    );
  });
});

describe('Variable', () => {
  const uri = 'test://test.toy';

  it('parse variable', () => {
    const tokenizer = new Tokenizer(uri, 'foo');
    const parser = new Parser(tokenizer);
    expect(parser.parseVariable()).toStrictEqual(
      new VariableExprAST(toLoc(uri, 0, 0, 0, 3), 'foo')
    );
  });

  it('parse variable as expression', () => {
    const tokenizer = new Tokenizer(uri, 'foo');
    const parser = new Parser(tokenizer);
    expect(parser.parseExpression(PRESEDENSE.LOWEST)).toStrictEqual(
      new VariableExprAST(toLoc(uri, 0, 0, 0, 3), 'foo')
    );
  });
});
