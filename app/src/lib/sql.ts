/**
 * SQL literal encoding for bulk inserts.
 *
 * D1 allows at most 100 bound parameters per statement, so a 21-column table
 * could only take four rows per INSERT — loading the 1,575-row spend file would
 * need ~160 statements. Writing the values inline instead brings that down to a
 * handful of statements bounded by D1's 100 KB statement limit.
 *
 * Every value reaching here has already been through normaliseRow, so it is a
 * finite number, a string, or null — never arbitrary JSON.
 *
 * No imports: shared by the browser bundle, the Functions bundle and the seed
 * script.
 */

export type SqlValue = string | number | null;

/**
 * Encode one value as a SQLite literal.
 *
 * SQLite string literals have exactly one escape: a single quote is written
 * twice. It does not process backslash escapes, so there is no second case to
 * handle. Anything non-finite becomes 0 rather than the string "NaN", which
 * SQLite would otherwise store in a numeric column.
 */
export function sqlLiteral(value: SqlValue): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function sqlRow(values: SqlValue[]): string {
  return `(${values.map(sqlLiteral).join(',')})`;
}

/** D1 rejects any single statement over 100 KB; stay comfortably under it. */
export const MAX_STATEMENT_BYTES = 80_000;

/**
 * Build as few multi-row INSERTs as the size limit allows.
 */
export function buildInserts(table: string, columns: string[], rows: SqlValue[][]): string[] {
  if (rows.length === 0) return [];
  const head = `INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES `;
  const statements: string[] = [];
  let current: string[] = [];
  let size = head.length;

  for (const row of rows) {
    const encoded = sqlRow(row);
    // +1 for the comma joining it to the previous tuple.
    if (current.length > 0 && size + encoded.length + 1 > MAX_STATEMENT_BYTES) {
      statements.push(head + current.join(','));
      current = [];
      size = head.length;
    }
    current.push(encoded);
    size += encoded.length + 1;
  }
  if (current.length > 0) statements.push(head + current.join(','));
  return statements;
}
