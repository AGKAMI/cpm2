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
  const result = await call([{ sql: 'SELECT id, email, user_id, game, created_at FROM accounts ORDER BY created_at DESC', args: [] }]);
  const rows = result.results?.[0]?.response?.result?.rows || [];
  console.log('Total accounts:', rows.length);
  for (const row of rows) {
    // row is [col0, col1, col2, col3, col4]
    console.log(`ID: ${row[0]}, Email: ${row[1]}, UserID: ${row[2]}, Game: ${row[3]}, Created: ${row[4]}`);
  }
})();
