declare module "better-sqlite3" {
  class Database {
    constructor(filename: string, options?: { readonly?: boolean; fileMustExist?: boolean; timeout?: number; verbose?: (message: string) => void });
    prepare(sql: string): Statement;
    exec(sql: string): void;
    pragma(pragma: string, options?: { simple?: boolean }): unknown;
    close(): void;
  }

  class Statement {
    run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }

  export = Database;
}
