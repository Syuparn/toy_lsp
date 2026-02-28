import { Location } from 'vscode-languageserver';

export interface AST {
  readonly loc: Location;
  dump(): string;
}

export type ExprAST = VariableExprAST | NumberExprAST | InfixExprAST | LiteralExprAST | CallExprAST;
export type StmtAST = VarDeclStmtAST | ReturnStmtAST | ExprStmtAST;

export class VariableExprAST {
  constructor(
    public readonly loc: Location,
    public readonly name: string
  ) {}

  dump(): string {
    return this.name;
  }
}

export class NumberExprAST {
  constructor(
    public readonly loc: Location,
    public readonly value: number
  ) {}

  dump(): string {
    return this.value.toString();
  }
}

export class InfixExprAST {
  constructor(
    public readonly loc: Location,
    public readonly left: ExprAST | MissingAST,
    public readonly op: string,
    public readonly right: ExprAST | MissingAST
  ) {}

  dump(): string {
    return `(${this.left.dump()} ${this.op} ${this.right.dump()})`;
  }
}

export class LiteralExprAST {
  constructor(
    public readonly loc: Location,
    // NOTE: although literalAST should only contain LiteralExprAST and NumberAST, it accepts all exprs to represent illegal object.
    // (this violation is checked in static analysis later)
    public readonly values: (ExprAST | MissingAST)[]
  ) {}

  dump(): string {
    return `[${this.values.map((v) => v.dump()).join(', ')}]`;
  }
}

export class CallExprAST {
  constructor(
    public readonly loc: Location,
    public readonly callee: string,
    public readonly args: (ExprAST | MissingAST)[]
  ) {}

  dump(): string {
    return `${this.callee}(${this.args.map((a) => a.dump()).join(', ')})`;
  }
}

export class VarDeclStmtAST {
  constructor(
    public readonly loc: Location,
    public readonly name: string,
    public readonly expr: ExprAST | MissingAST,
    public readonly varType?: number[]
  ) {}

  dump(): string {
    return `var ${this.name} = ${this.expr.dump()};`;
  }
}

export class ReturnStmtAST {
  constructor(
    public readonly loc: Location,
    public readonly expr?: ExprAST | MissingAST
  ) {}

  dump(): string {
    if (this.expr) {
      return `return ${this.expr.dump()};`;
    }
    return 'return;';
  }
}

export class ExprStmtAST {
  constructor(
    public readonly loc: Location,
    public readonly expr: ExprAST | MissingAST
  ) {}

  dump(): string {
    return `${this.expr.dump()};`;
  }
}

export class FunctionAST {
  constructor(
    public readonly loc: Location,
    public readonly name: string,
    public readonly params: VariableExprAST[],
    public readonly body: StmtAST[]
  ) {}

  dump(): string {
    const params = this.params.map((p) => p.dump()).join(', ');
    const bodyLines = this.body.map((stmt) => `  ${stmt.dump()}`).join('\n');
    return `def ${this.name}(${params}) {\n${bodyLines}\n}`;
  }
}

export class ModuleAST {
  constructor(
    public readonly loc: Location,
    public readonly funcs: FunctionAST[]
  ) {}

  dump(): string {
    return this.funcs.map((f) => f.dump()).join('\n') + '\n';
  }
}

// AST for placeholder to substitute parsing error
export class MissingAST {
  constructor(public readonly loc: Location) {}

  dump(): string {
    return '<MISSING!>';
  }
}
