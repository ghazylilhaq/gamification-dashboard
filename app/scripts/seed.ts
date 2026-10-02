/**
 * Load the CSV exports in ../docs into the local D1 database.
 *
 * Generates SQL and hands it to `wrangler d1 execute --local`, which writes to
 * the SQLite file under .wrangler/state. This never contacts Cloudflare.
 *
 *   npm run seed
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCsvDir, CSV_DIR } from './loadCsvs';
import { TABLE_COLUMNS, normaliseRow } from '../src/lib/csv/parse';
import { buildInserts, sqlLiteral } from '../src/lib/sql';
import { nowWib } from '../src/lib/time';

const DB_NAME = 'blindbox-dashboard';
function main() {
  console.log(`Reading CSVs from ${CSV_DIR}`);
  const files = loadCsvDir();
  if (files.length === 0) {
    console.error('No recognisable CSV files found.');
    process.exit(1);
  }

  const statements: string[] = ['PRAGMA defer_foreign_keys = true;'];

  // Reference data first, then daily, so a reader mid-seed never sees claims
  // pointing at boxes that do not exist yet.
  const ordered = [...files].sort((a, b) =>
    (a.def.group === 'reference' ? 0 : 1) - (b.def.group === 'reference' ? 0 : 1),
  );

  for (const file of ordered) {
    const cols = TABLE_COLUMNS[file.def.id];
    if (file.def.mode === 'replace') statements.push(`DELETE FROM ${file.def.table};`);
    else statements.push(`DELETE FROM ${file.def.table} WHERE snapshot_at = '${file.exportAt}';`);

    const values = file.rows.map((r) => normaliseRow(file.def.id, r, file.exportAt));
    for (const sql of buildInserts(file.def.table, cols, values)) statements.push(`${sql};`);

    statements.push(
      `INSERT INTO uploads (uploaded_at, uploaded_by, file_name, file_type, export_at, row_count, status, error, batch_id)
       VALUES ('${nowWib()}', 'seed-script', ${sqlLiteral(file.fileName)}, '${file.def.id}', '${file.exportAt}', ${file.rows.length}, 'published', NULL, 'seed');`,
    );

    console.log(`  ${file.def.label.padEnd(34)} ${String(file.rows.length).padStart(5)} rows  @ ${file.exportAt} WIB`);
  }

  const sqlPath = join(mkdtempSync(join(tmpdir(), 'blindbox-seed-')), 'seed.sql');
  writeFileSync(sqlPath, statements.join('\n'), 'utf8');
  console.log(`\nApplying ${statements.length} statements to local D1...`);

  execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--local', '--persist-to', './.wrangler/state', '--file', sqlPath],
    { stdio: 'inherit' },
  );

  console.log('\nSeed complete. Run `npm run dev` and open http://localhost:5173');
}

main();
