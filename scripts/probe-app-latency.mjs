// Timing probe: app API vs direct Turso, repeated with short gaps.
const url = "http://127.0.0.1:3001";
const covers = `${url}/api/store/media/covers?ids=30,31,32,33,34,35,36,37`;

const time = async (label, fn) => {
  const t0 = Date.now();
  await fn();
  console.log(label.padEnd(28), ((Date.now() - t0) / 1000).toFixed(2) + "s");
};

for (let i = 1; i <= 5; i++) {
  await time(`covers #${i} (1s apart)`, async () => {
    await new Promise((r) => setTimeout(r, 1000));
    const r = await fetch(covers);
    await r.text();
  });
}

// DNS + raw connect to the Turso host
const { readFileSync } = await import("node:fs");
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']*$/g, "").replace(/\\r|\\n/g, "").trim();
}
const host = env.TURSO_DATABASE_URL.replace(/^libsql:\/\//, "https://").split("/")[2];
const dns = await import("node:dns/promises");
await time("dns lookup turso host", async () => {
  const addrs = await dns.lookup(host, { all: true });
  console.log("  ->", addrs.map((a) => a.address).join(","));
});
