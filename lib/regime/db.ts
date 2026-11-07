import { Pool, type QueryResultRow } from 'pg';

/**
 * Regime state uses REGIME_DATABASE_URL only.
 * Supabase keeps DATABASE_URL. This module does not read that variable.
 * The value is the pooled Neon connection (hostname contains -pooler) for
 * database regime on project dark-credit-39672712. It is never logged.
 */

export interface RegimeQuery {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: readonly unknown[]): Promise<T[]>;
}

export interface RegimeSql extends RegimeQuery {
  transaction<T>(run: (query: RegimeQuery) => Promise<T>): Promise<T>;
}

export type StoreProblem = 'unconfigured' | 'outage' | 'missing_schema';

let poolTask: Promise<Pool> | null = null;

export function regimeDatabaseUrl(): string | null {
  const url = process.env.REGIME_DATABASE_URL?.trim();
  return url ? url : null;
}

export function safeDbMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Database request failed';
  return raw
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-url]')
    .replace(/\/\/[^/\s:]+:[^@/\s]+@/g, '//[redacted]@')
    .replace(/password=\S+/gi, 'password=[redacted]')
    .slice(0, 200);
}

export function storeProblem(error: unknown): 'outage' | 'missing_schema' {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
  if (code === '42P01') return 'missing_schema';
  const message = error instanceof Error ? error.message : '';
  if (/relation ["']?regime_/i.test(message) && /does not exist/i.test(message)) return 'missing_schema';
  return 'outage';
}

async function regimePool(): Promise<Pool> {
  const connectionString = regimeDatabaseUrl();
  if (!connectionString) throw new Error('REGIME_DATABASE_URL is not set');
  if (!poolTask) {
    poolTask = (async () => {
      const pool = new Pool({
        connectionString,
        max: 1,
        idleTimeoutMillis: 5_000,
        connectionTimeoutMillis: 10_000,
        statement_timeout: 20_000,
      });
      pool.on('error', () => {
        console.error(JSON.stringify({ event: 'regime_db', phase: 'idle_client_error' }));
      });
      if (process.env.VERCEL) {
        const { attachDatabasePool } = await import('@vercel/functions');
        attachDatabasePool(pool);
      }
      return pool;
    })().catch((error) => {
      poolTask = null;
      throw error;
    });
  }
  return poolTask;
}

function rowsOf<T extends QueryResultRow>(result: { rows: T[] }): T[] {
  return result.rows;
}

export async function openRegimeSql(): Promise<RegimeSql | null> {
  if (!regimeDatabaseUrl()) return null;
  const pool = await regimePool();
  return {
    async query(text, params) {
      return rowsOf(await pool.query(text, params as unknown[] | undefined));
    },
    async transaction(run) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await run({
          async query(text, params) {
            return rowsOf(await client.query(text, params as unknown[] | undefined));
          },
        });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // The connection is already unusable. Release it below.
        }
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
