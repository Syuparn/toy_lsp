import { Location } from 'vscode-languageserver';
import {
  CallExprAST,
  ExprStmtAST,
  FunctionAST,
  InfixExprAST,
  LiteralExprAST,
  MissingAST,
  ModuleAST,
  NumberExprAST,
  ReturnStmtAST,
  VarDeclStmtAST,
  VariableExprAST,
} from './ast';

describe('ast dump', () => {
  // dummy location
  const loc: Location = {
    uri: 'dummy',
    range: {
      start: {
        line: 0,
        character: 0,
      },
      end: {
        line: 0,
        character: 0,
      },
    },
  };

  it('should dump VariableExprAST', () => {
    const ast = new VariableExprAST(loc, 'foo');
    expect(ast.dump()).toBe('foo');
  });

  it('should dump NumberExprAST', () => {
    const ast = new NumberExprAST(loc, 1);
    expect(ast.dump()).toBe('1');
  });

  it('should dump InfixExprAST', () => {
    const ast = new InfixExprAST(loc, new NumberExprAST(loc, 1), '+', new NumberExprAST(loc, 2));
    expect(ast.dump()).toBe('(1 + 2)');
  });

  it('should dump LiteralExprAST', () => {
    const ast = new LiteralExprAST(
      loc,
      [
        new LiteralExprAST(loc, [new NumberExprAST(loc, 1), new NumberExprAST(loc, 2)], [2]),
        new LiteralExprAST(loc, [new NumberExprAST(loc, 3), new NumberExprAST(loc, 4)], [2]),
      ],
      [2, 3]
    );
    expect(ast.dump()).toBe('[[1, 2], [3, 4]]');
  });

  it('should dump CallExprAST', () => {
    const ast = new CallExprAST(loc, 'foo', [new NumberExprAST(loc, 1), new NumberExprAST(loc, 2)]);
    expect(ast.dump()).toBe('foo(1, 2)');
  });

  it('should dump VarDeclStmtAST', () => {
    const ast = new VarDeclStmtAST(
      loc,
      'foo',
      { shape: [2] },
      new LiteralExprAST(loc, [new NumberExprAST(loc, 1), new NumberExprAST(loc, 2)], [2])
    );
    expect(ast.dump()).toBe('var foo = [1, 2];');
  });

  it('should dump ReturnStmtAST', () => {
    const ast = new ReturnStmtAST(loc, new NumberExprAST(loc, 1));
    expect(ast.dump()).toBe('return 1;');
  });

  it('should dump ReturnStmtAST (without expression)', () => {
    const ast = new ReturnStmtAST(loc);
    expect(ast.dump()).toBe('return;');
  });

  it('should dump ExprStmtAST', () => {
    const ast = new ExprStmtAST(loc, new NumberExprAST(loc, 1));
    expect(ast.dump()).toBe('1;');
  });

  it('should dump FunctionAST', () => {
    const ast = new FunctionAST(
      loc,
      'foo',
      [new VariableExprAST(loc, 'param1'), new VariableExprAST(loc, 'param2')],
      [new ReturnStmtAST(loc, new NumberExprAST(loc, 1))]
    );
    expect(ast.dump()).toBe('def foo(param1, param2) {\n  return 1;\n}');
  });

  it('should dump ModuleAST', () => {
    const ast = new ModuleAST(loc, [
      new FunctionAST(
        loc,
        'foo',
        [new VariableExprAST(loc, 'param1'), new VariableExprAST(loc, 'param2')],
        [new ReturnStmtAST(loc, new NumberExprAST(loc, 1))]
      ),
      new FunctionAST(
        loc,
        'bar',
        [new VariableExprAST(loc, 'param3'), new VariableExprAST(loc, 'param4')],
        [new ReturnStmtAST(loc, new NumberExprAST(loc, 2))]
      ),
    ]);
    expect(ast.dump()).toBe(
      'def foo(param1, param2) {\n  return 1;\n}\ndef bar(param3, param4) {\n  return 2;\n}\n'
    );
  });

  it('should dump MissingAST', () => {
    const ast = new MissingAST(loc);
    expect(ast.dump()).toBe('<MISSING!>');
  });
});
