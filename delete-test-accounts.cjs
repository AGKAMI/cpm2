const fs = require('fs');

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = parseEnv(fs.readFileSync('.env.local', 'utf8'));
const url = env.TURSO_DATABASE_URL.replace(/^libsql:\/\//, 'https://');
const token = env.TURSO_AUTH_TOKEN;

async function call(stmts) {
  const resp = await fetch(`${url}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: stmts.map(s => ({ type: 'execute', stmt: { sql: s.sql, args: s.args.map(v => ({ type: 'text', value: v })) } })),
    }),
  });
  return resp.json();
}

async function unwrapVal(v) {
  return v && typeof v === 'object' && v.value !== undefined ? v.value : v;
}

(async () => {
  // First check what accounts exist with user_id = 1
  const all = await call([{ sql: 'SELECT id, email, user_id FROM accounts ORDER BY id', args: [] }]);
  const rows = all.results?.[0]?.response?.result?.rows || [];
  console.log('All accounts:');
  for (const row of rows) {
    console.log(`ID: ${unwrapVal(row[0])}, Email: ${unwrapVal(row[1])}, UserID: ${unwrapVal(row[2])}`);
  }

  // Delete test accounts #28 and #29 (Kermes' test accounts)
  console.log('\nDeleting test accounts #28 and #29...');
  const delResult = await call([{ sql: 'DELETE FROM accounts WHERE id IN (28, 29)', args: [] }]);
  console.log('Delete result:', JSON.stringify(delResult.results?.[0]?.response?.result, null, 2));

  // Verify remaining accounts
  const after = await call([{ sql: 'SELECT id, email, user_id FROM accounts ORDER BY id', args: [] }]);
  const afterRows = after.results?.[0]?.response?.result?.rows || [];
  console.log('\nRemaining accounts:');
  for (const row of afterRows) {
    console.log(`ID: ${unwrapVal(row[0])}, Email: ${unwrapVal(row[1])}, UserID: ${unwrapVal(row[2])}`);
  }
  console.log(`\nTotal remaining: ${afterRows.length}`);
})();
