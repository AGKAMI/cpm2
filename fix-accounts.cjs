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

(async () => {
  // First, see all accounts with their user_ids
  const all = await call([{ sql: 'SELECT id, email, user_id FROM accounts ORDER BY id', args: [] }]);
  const rows = all.results?.[0]?.response?.result?.rows || [];
  console.log('Current accounts:');
  for (const row of rows) {
    console.log(`ID: ${unwrap(row[0])}, Email: ${unwrap(row[1])}, UserID: ${unwrap(row[2])}`);
  }

  // Update all accounts to user_id = 1 so KAMI's console login sees them all
  const update = await call([{ sql: 'UPDATE accounts SET user_id = 1', args: [] }]);
  console.log('Update result:', JSON.stringify(update.results?.[0]?.response?.result, null, 2));

  // Verify
  const after = await call([{ sql: 'SELECT id, email, user_id FROM accounts ORDER BY id', args: [] }]);
  const afterRows = after.results?.[0]?.response?.result?.rows || [];
  console.log('\nAfter update:');
  for (const row of afterRows) {
    console.log(`ID: ${unwrap(row[0])}, Email: ${unwrap(row[1])}, UserID: ${unwrap(row[2])}`);
  }
})();

function unwrap(v) {
  return v && typeof v === 'object' && v.value !== undefined ? v.value : v;
}
