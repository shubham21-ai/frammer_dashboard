import { supabase } from "./supabase";

// Safely substitute $1, $2, ... placeholders into the SQL string
function substituteParams(text: string, params?: unknown[]): string {
  if (!params || params.length === 0) return text;
  let result = text;
  for (let i = params.length; i >= 1; i--) {
    const value = params[i - 1];
    let escaped: string;
    if (value === null || value === undefined) {
      escaped = "NULL";
    } else if (typeof value === "number") {
      escaped = String(value);
    } else if (typeof value === "boolean") {
      escaped = value ? "TRUE" : "FALSE";
    } else {
      escaped = `'${String(value).replace(/'/g, "''")}'`;
    }
    result = result.replace(new RegExp(`\\$${i}`, "g"), escaped);
  }
  return result;
}

// query() is for SELECT statements only. exec_sql wraps everything as
// SELECT * FROM (<sql>) t — DML and DDL cannot go through this path.
// Use supabase.from().insert()/upsert()/delete() for DML directly.
export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  // exec_sql wraps SQL as `FROM (<sql>) t` — trailing semicolons break the outer query
  const sql = substituteParams(text, params).replace(/;\s*$/, "");
  const { data, error } = await supabase.rpc("exec_sql", { query: sql });
  if (error) throw new Error(error.message);
  const rows = (Array.isArray(data) ? data : []) as T[];
  return { rows, rowCount: rows.length };
}

// DDL statements (ALTER TABLE, CREATE TABLE, etc.) cannot go through exec_sql
// because it wraps queries as FROM (<sql>) t — DDL has no RETURNING and is rejected.
// Use exec_ddl (a separate RPC that runs EXECUTE directly) for schema changes.
export async function execDDL(sql: string): Promise<void> {
  const cleanSql = sql.replace(/;\s*$/, "");
  const { error } = await supabase.rpc("exec_ddl", { sql: cleanSql });
  if (error) throw new Error(error.message);
}

// Pool compatibility shim for routes that use pool.connect() / client.query() / client.release()
export const pool = {
  connect: async () => {
    return {
      query: async <T = unknown>(text: string, params?: unknown[]) => {
        return query<T>(text, params);
      },
      release: () => {
        /* no-op */
      },
    };
  },
};
