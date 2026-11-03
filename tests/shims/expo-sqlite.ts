// Test-only shim: exposes the subset of expo-sqlite used by src/db/sqlite.ts on top of Node's built-in SQLite.
// @ts-ignore node:sqlite types may be absent
import { DatabaseSync } from "node:sqlite";

class ShimDb {
  private db = new DatabaseSync(":memory:");
  async execAsync(sql: string) { this.db.exec(sql); }
  private params(p: any[]) { return p.length === 1 && Array.isArray(p[0]) ? p[0] : p; }
  async runAsync(sql: string, ...p: any[]) { return this.db.prepare(sql).run(...this.params(p)); }
  async getFirstAsync<T>(sql: string, ...p: any[]): Promise<T | null> { return (this.db.prepare(sql).get(...this.params(p)) as T) ?? null; }
  async getAllAsync<T>(sql: string, ...p: any[]): Promise<T[]> { return this.db.prepare(sql).all(...this.params(p)) as T[]; }
  async withTransactionAsync(fn: () => Promise<void>) {
    this.db.exec("BEGIN");
    try { await fn(); this.db.exec("COMMIT"); } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }
}
export type SQLiteDatabase = ShimDb;
export async function openDatabaseAsync(_name: string) { return new ShimDb(); }
