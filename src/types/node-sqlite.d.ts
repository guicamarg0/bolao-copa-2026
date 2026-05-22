declare module "node:sqlite" {
  export interface StatementRunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export class StatementSync {
    run(...parameters: unknown[]): StatementRunResult;
    get(...parameters: unknown[]): unknown;
    all(...parameters: unknown[]): unknown[];
  }

  export class DatabaseSync {
    constructor(path: string, options?: unknown);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
