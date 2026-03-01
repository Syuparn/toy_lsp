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

export class DefinitionFinder {
  constructor(readonly ast: ModuleAST) {}

  find(cursor: Position): Location[] {
    const current = this.findCurrentAST(cursor);
    if (!current) {
      // current position is not an identifier
      return [];
    }

    const { func, expr } = current;
    // find variables
    if (expr instanceof VariableExprAST) {
      return this.findVariableDeclLoc(expr, func);
    }

    // find functions
    if (expr instanceof CallExprAST) {
      return this.findFuncDeclLoc(expr);
    }

    return [];
  }

  findVariableDeclLoc(expr: VariableExprAST, func: FunctionAST): Location[] {
    // NOTE: since toy does not have closure, variable should be defined in the same function
    const param = this.findParam(expr.name, func);
    if (param) {
      return [param.loc];
    }
    const variable = this.findVarDecl(expr.name, func);
    if (variable) {
      return [variable.loc];
    }
    return [];
  }

  findFuncDeclLoc(expr: CallExprAST): Location[] {
    for (const func of this.ast.funcs) {
      if (func.name === expr.callee) {
        return [func.loc];
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
