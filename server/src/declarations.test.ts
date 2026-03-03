import { Location } from 'vscode-languageserver';
import { Parser } from './parser';
import { Tokenizer } from './lexer';
import { DefinitionFinder } from './declarations';
import { CallExprAST, NumberExprAST, VariableExprAST } from './ast';

const uri = 'test://test.toy';

// helper function to create loc
function toLoc(
  uri: string,
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number
): Location {
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

describe('DefinitionFinder', () => {
  describe('findCurrentAST', () => {
    it('should find variable expression at cursor position', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\nreturn a;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findCurrentAST({ line: 1, character: 7 });

      expect(result).toBeDefined();
      expect(result?.func.name).toBe('f');
      expect(result?.expr).toBeInstanceOf(VariableExprAST);
      expect((result?.expr as VariableExprAST).name).toBe('a');
    });

    it('should find call expression at cursor position', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\ng();\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findCurrentAST({ line: 1, character: 0 });

      expect(result).toBeDefined();
      expect(result?.func.name).toBe('f');
      expect(result?.expr).toBeInstanceOf(CallExprAST);
      expect((result?.expr as CallExprAST).callee).toBe('g');
    });

    it('should find parameter at cursor position', () => {
      const tokenizer = new Tokenizer(uri, 'def f(a) {\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findCurrentAST({ line: 0, character: 6 });

      expect(result).toBeDefined();
      expect(result?.func.name).toBe('f');
      expect(result?.expr).toBeInstanceOf(VariableExprAST);
      expect((result?.expr as VariableExprAST).name).toBe('a');
    });

    it('should find nested expression (argument in call)', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\ng(a);\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findCurrentAST({ line: 1, character: 2 });

      expect(result).toBeDefined();
      expect(result?.expr).toBeInstanceOf(VariableExprAST);
      expect((result?.expr as VariableExprAST).name).toBe('a');
    });

    it('should return void when cursor is outside any function', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\n}\n');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findCurrentAST({ line: 2, character: 0 });

      expect(result).toBeUndefined();
    });

    it('should return void when cursor is on non-expression token', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\nreturn;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      // cursor on 'return' keyword
      const result = finder.findCurrentAST({ line: 1, character: 0 });

      expect(result).toBeUndefined();
    });

    it('should find expression in correct function when multiple functions exist', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\nreturn 1;\n}\ndef g() {\nreturn 2;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findCurrentAST({ line: 4, character: 7 });

      expect(result).toBeDefined();
      expect(result?.func.name).toBe('g');
      expect(result?.expr).toBeInstanceOf(NumberExprAST);
    });
  });

  describe('findDefinition', () => {
    it('should return variable declaration dump for variable reference', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\nvar a = 1;\nreturn a;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findDefinition({ line: 2, character: 7 });

      expect(result).toBe('var a = 1;');
    });

    it('should return parameter name for parameter reference', () => {
      const tokenizer = new Tokenizer(uri, 'def f(a) {\nreturn a;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findDefinition({ line: 1, character: 7 });

      expect(result).toBe('a');
    });

    it('should return function signature for function call', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\n}\ndef g() {\nf();\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findDefinition({ line: 3, character: 0 });

      expect(result).toBe('def f()');
    });

    it('should return function signature with parameters for function call', () => {
      const tokenizer = new Tokenizer(uri, 'def f(a, b) {\n}\ndef g() {\nf(1, 2);\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();
      const finder = new DefinitionFinder(ast);
      const result = finder.findDefinition({ line: 3, character: 0 });
      expect(result).toBe('def f(a, b)');
    });

    it('should return undefined when variable is not defined', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\nreturn a;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findDefinition({ line: 1, character: 7 });

      expect(result).toBeUndefined();
    });

    it('should return undefined when function is not defined', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\ng();\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findDefinition({ line: 1, character: 0 });

      expect(result).toBeUndefined();
    });

    it('should return undefined when cursor is not on identifier', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\nreturn;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findDefinition({ line: 1, character: 0 });

      expect(result).toBeUndefined();
    });

    it('should return undefined when cursor is on number literal', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\nreturn 42;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findDefinition({ line: 1, character: 7 });

      expect(result).toBeUndefined();
    });
  });

  describe('findLoc', () => {
    it('should find variable declaration location', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\nvar a = 1;\nreturn a;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findLoc({ line: 2, character: 7 });

      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual(toLoc(uri, 1, 0, 1, 3));
    });

    it('should find variable declaration location (two variables)', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\nvar a = 1;\nvar b = 2;\nreturn b;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findLoc({ line: 3, character: 7 });

      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual(toLoc(uri, 2, 0, 2, 3));
    });

    it('should find parameter declaration location', () => {
      const tokenizer = new Tokenizer(uri, 'def f(a) {\nreturn a;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findLoc({ line: 1, character: 7 });

      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual(toLoc(uri, 0, 6, 0, 7));
    });

    it('should find function declaration location', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\n}\ndef g() {\nf();\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findLoc({ line: 3, character: 0 });

      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual(toLoc(uri, 0, 0, 0, 3));
    });

    it('should return empty array when no definition found', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\nreturn a;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findLoc({ line: 1, character: 7 });

      expect(result).toHaveLength(0);
    });

    it('should return empty array when cursor is not on identifier', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findLoc({ line: 1, character: 0 });

      expect(result).toHaveLength(0);
    });
  });

  describe('findCompletions', () => {
    it('should return completions for variable declaration', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\nvar abc = 1;\na;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findCompletions({ line: 2, character: 0 });

      expect(result).toContainEqual({ name: 'abc', kind: 'IDENTIFIER' });
    });

    it('should return completions for parameter', () => {
      const tokenizer = new Tokenizer(uri, 'def f(abc) {\na;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findCompletions({ line: 1, character: 0 });

      expect(result).toContainEqual({ name: 'abc', kind: 'IDENTIFIER' });
    });

    it('should return completions for user-defined function', () => {
      const tokenizer = new Tokenizer(uri, 'def foo() {\n}\ndef g() {\nf;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findCompletions({ line: 3, character: 0 });

      expect(result).toContainEqual({ name: 'foo', kind: 'def' });
    });

    it('should return completions for built-in functions', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\np;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findCompletions({ line: 1, character: 0 });

      expect(result).toContainEqual({ name: 'print', kind: 'def' });
    });

    it('should return multiple function completions matching the pattern', () => {
      const tokenizer = new Tokenizer(
        uri,
        'def apple() {\n}\ndef apricot() {\n}\ndef xyz() {\n}\ndef main() {\na;\n}'
      );
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      // line 7 is "a;", pattern is .*a.* which matches names containing 'a'
      const result = finder.findCompletions({ line: 7, character: 0 });

      expect(result).toContainEqual({ name: 'apple', kind: 'def' });
      expect(result).toContainEqual({ name: 'apricot', kind: 'def' });
      expect(result).toContainEqual({ name: 'main', kind: 'def' });
      expect(result).not.toContainEqual({ name: 'xyz', kind: 'def' });
    });

    it('should return empty array when cursor is not on identifier', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\nreturn;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findCompletions({ line: 1, character: 0 });

      expect(result).toHaveLength(0);
    });

    it('should return empty array when cursor is on number literal', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\nreturn 42;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findCompletions({ line: 1, character: 7 });

      expect(result).toHaveLength(0);
    });

    it('should return empty array when cursor is outside function', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\n}\n');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findCompletions({ line: 2, character: 0 });

      expect(result).toHaveLength(0);
    });

    it('should include both variables and functions in completions', () => {
      const tokenizer = new Tokenizer(uri, 'def foo() {\n}\ndef g(foo) {\nfoo;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      // line 3 is "foo;"
      const result = finder.findCompletions({ line: 3, character: 0 });

      expect(result).toContainEqual({ name: 'foo', kind: 'def' });
      expect(result).toContainEqual({ name: 'foo', kind: 'IDENTIFIER' });
    });

    it('should return all built-in functions when pattern matches', () => {
      const tokenizer = new Tokenizer(uri, 'def f() {\nt;\n}');
      const parser = new Parser(tokenizer);
      const ast = parser.parseModule();

      const finder = new DefinitionFinder(ast);
      const result = finder.findCompletions({ line: 1, character: 0 });

      expect(result).toContainEqual({ name: 'transpose', kind: 'def' });
    });
  });
});
