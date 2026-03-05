import { Location, Position } from 'vscode-languageserver';
import {
  CallExprAST,
  ExprAST,
  ExprStmtAST,
  FunctionAST,
  InfixExprAST,
  LiteralExprAST,
  MissingAST,
  ModuleAST,
  ReturnStmtAST,
  StmtAST,
  VarDeclStmtAST,
  VariableExprAST,
} from './ast';
import { TokenKind } from './lexer';

export class DefinitionFinder {
  constructor(readonly ast: ModuleAST) {}

  builtInFuncNames() {
    return ['print', 'transpose'];
  }

  findCompletions(cursor: Position) {
    const current = this.findCurrentAST(cursor);
    if (!current) {
      // current position is not an identifier
      return [];
    }

    const { func, expr } = current;
    if (!(expr instanceof VariableExprAST)) {
      return [];
    }

    const completions: {
      name: string;
      kind: TokenKind;
    }[] = [];

    // completion search pattern (partial match to the input identifier)
    // i.e. "foo" -> /.*f.*o.*o.*/
    const pattern = new RegExp('.*' + [expr.name].join('.*') + '.*');

    // find all variables and parameters in the current function
    const allVars = this.findAllVariablesInFunc(func);
    for (const varDecl of allVars) {
      if (varDecl instanceof VariableExprAST && varDecl.name.match(pattern)) {
        completions.push({ name: varDecl.name, kind: 'IDENTIFIER' });
      }
      if (varDecl instanceof VarDeclStmtAST && varDecl.name.match(pattern)) {
        completions.push({ name: varDecl.name, kind: 'IDENTIFIER' });
      }
    }

    // NOTE: does not handle CallExprAST because you are only typing callee (not args) at this point
    // find functions
    for (const f of this.ast.funcs) {
      if (f.name.match(pattern)) {
        completions.push({ name: f.name, kind: 'def' });
      }
    }
    // find built-in functions
    for (const name of this.builtInFuncNames()) {
      if (name.match(pattern)) {
        completions.push({ name: name, kind: 'def' });
      }
    }

    return completions;
  }

  findDefinition(cursor: Position) {
    const current = this.findCurrentAST(cursor);
    if (!current) {
      // current position is not an identifier
      return undefined;
    }

    const { func, expr } = current;
    // find variables
    if (expr instanceof VariableExprAST) {
      const decls = this.findVariableDecl(expr, func);
      return decls[0]?.dump();
    }

    // find functions
    if (expr instanceof CallExprAST) {
      // built-in functions
      if (expr.callee === 'print') {
        return 'def print(x)';
      }
      if (expr.callee === 'transpose') {
        return 'def transpose(x)';
      }

      // user-defined functions
      const decls = this.findFuncDecl(expr);
      if (decls.length < 1) {
        return undefined;
      }
      const decl = decls[0] as FunctionAST;
      return `def ${decl.name}(${decl.params.map((p) => p.name).join(', ')})`;
    }

    return undefined;
  }

  findLoc(cursor: Position): Location[] {
    const current = this.findCurrentAST(cursor);
    if (!current) {
      // current position is not an identifier
      return [];
    }

    const { func, expr } = current;
    // find variables
    if (expr instanceof VariableExprAST) {
      return this.findVariableDecl(expr, func).map((e) => e.loc);
    }

    // find functions
    if (expr instanceof CallExprAST) {
      return this.findFuncDecl(expr).map((e) => e.loc);
    }

    return [];
  }

  findVariableDecl(expr: VariableExprAST, func: FunctionAST): ExprAST[] {
    // NOTE: since toy does not have closure, variable should be defined in the same function
    const param = this.findParam(expr.name, func);
    if (param) {
      return [param];
    }
    const variable = this.findVarDecl(expr.name, func);
    if (variable) {
      return [variable];
    }
    return [];
  }

  findFuncDecl(expr: CallExprAST): ExprAST[] {
    for (const func of this.ast.funcs) {
      if (func.name === expr.callee) {
        return [func];
      }
    }
    return [];
  }

  findParam(name: string, func: FunctionAST) {
    for (const param of func.params) {
      if (param.name === name) {
        return param;
      }
    }
  }

  findVarDecl(name: string, func: FunctionAST) {
    for (const stmt of func.body) {
      if (stmt instanceof VarDeclStmtAST && stmt.name === name) {
        return stmt;
      }
    }
  }

  findAllVariablesInFunc(func: FunctionAST): (VariableExprAST | VarDeclStmtAST)[] {
    const result: (VariableExprAST | VarDeclStmtAST)[] = [];
    for (const param of func.params) {
      result.push(param);
    }
    for (const stmt of func.body) {
      if (stmt instanceof VarDeclStmtAST) {
        result.push(stmt);
      }
    }
    return result;
  }

  findCurrentAST(cursor: Position): { func: FunctionAST; expr: ExprAST } | void {
    for (const func of this.ast.funcs) {
      // NOTE: func.loc only covers 'def' keyword, so we check params and body directly
      const expr = this.findExprAtPosition(func, cursor);
      if (expr) {
        return { func, expr };
      }
    }
  }

  private containsPosition(loc: Location, pos: Position): boolean {
    const { start, end } = loc.range;

    if (pos.line < start.line || pos.line > end.line) {
      return false;
    }

    if (pos.line === start.line && pos.character < start.character) {
      return false;
    }

    if (pos.line === end.line && pos.character > end.character) {
      return false;
    }

    return true;
  }

  private findExprAtPosition(func: FunctionAST, cursor: Position): ExprAST | void {
    // Check params first
    for (const param of func.params) {
      if (this.containsPosition(param.loc, cursor)) {
        return param;
      }
    }

    // Check statements in body
    for (const stmt of func.body) {
      const expr = this.findExprInStmt(stmt, cursor);
      if (expr) {
        return expr;
      }
    }
  }

  private findExprInStmt(stmt: StmtAST, cursor: Position): ExprAST | void {
    if (stmt instanceof VarDeclStmtAST) {
      return this.findExprInExpr(stmt.expr, cursor);
    }
    if (stmt instanceof ReturnStmtAST && stmt.expr) {
      return this.findExprInExpr(stmt.expr, cursor);
    }
    if (stmt instanceof ExprStmtAST) {
      return this.findExprInExpr(stmt.expr, cursor);
    }
  }

  private findExprInExpr(expr: ExprAST | MissingAST, cursor: Position): ExprAST | void {
    if (expr instanceof MissingAST) {
      return;
    }

    // Recursively check nested expressions first (they may have different ranges)
    if (expr instanceof InfixExprAST) {
      const left = this.findExprInExpr(expr.left, cursor);
      if (left) return left;
      const right = this.findExprInExpr(expr.right, cursor);
      if (right) return right;
    }

    if (expr instanceof LiteralExprAST) {
      for (const value of expr.values) {
        const found = this.findExprInExpr(value, cursor);
        if (found) return found;
      }
    }

    if (expr instanceof CallExprAST) {
      // Check args first since CallExprAST.loc only covers the callee name
      for (const arg of expr.args) {
        const found = this.findExprInExpr(arg, cursor);
        if (found) return found;
      }
      // If cursor is on the callee itself, return the CallExprAST
      if (this.containsPosition(expr.loc, cursor)) {
        return expr;
      }
      return;
    }

    // For VariableExprAST, NumberExprAST, etc., check if cursor is within the expression
    if (this.containsPosition(expr.loc, cursor)) {
      return expr;
    }
  }
}
