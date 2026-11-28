/**
 * Split a SQL script into executable statements.
 *
 * A naive `schema.split(";")` breaks on semicolons inside comments, quoted
 * strings and — added later — the bodies of `CREATE TRIGGER ... BEGIN ... END`
 * blocks. On a fresh database that produced incomplete statements, the batch
 * failed and every later query died with "no such table". Existing deployments
 * hid the bug because their tables had been created by an older schema.
 *
 * This scanner ignores comments and quoted strings while it looks for
 * terminators, and keeps trigger bodies intact until their matching END.
 * It keeps the trailing semicolon so each statement stays valid on its own.
 */

function keywordAt(sql: string, index: number, word: string): boolean {
  const upper = word.toUpperCase();
  if (sql.slice(index, index + upper.length).toUpperCase() !== upper) return false;
  const before = index === 0 ? "" : sql[index - 1];
  const after = sql[index + upper.length] ?? "";
  return !/[A-Za-z0-9_]/.test(before) && !/[A-Za-z0-9_]/.test(after);
}

export function splitSqlStatements(script: string): string[] {
  const statements: string[] = [];
  let current = "";
  let quote: string | null = null;
  // CREATE TRIGGER bodies contain semicolons that are NOT statement
  // terminators. Track BEGIN/CASE … END nesting only inside a trigger, so a
  // CASE expression in an ordinary CHECK constraint stays part of its DDL.
  let inTrigger = false;
  let blockDepth = 0;

  for (let i = 0; i < script.length; i += 1) {
    const char = script[i];
    const next = script[i + 1];

    if (quote) {
      current += char;
      if (char === quote) {
        // SQL escapes a quote inside a string by doubling it.
        if (next === quote) {
          current += next;
          i += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (char === "-" && next === "-") {
      // Skip to (but not including) the newline; whitespace is harmless.
      while (i < script.length && script[i] !== "\n") i += 1;
      if (i < script.length) current += "\n";
      continue;
    }

    if (char === "/" && next === "*") {
      i += 2;
      while (i < script.length && !(script[i] === "*" && script[i + 1] === "/")) i += 1;
      i += 1; // consume the closing slash
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      current += char;
      continue;
    }

    if (!inTrigger && /^CREATE\s+TRIGGER\b/i.test(current.trimStart())) {
      inTrigger = true;
    }
    if (inTrigger) {
      if (keywordAt(script, i, "BEGIN") || keywordAt(script, i, "CASE")) {
        blockDepth += 1;
      } else if (keywordAt(script, i, "END")) {
        blockDepth = Math.max(0, blockDepth - 1);
      }
    }

    if (char === ";" && (!inTrigger || blockDepth === 0)) {
      const statement = current.trim();
      if (statement) statements.push(`${statement};`);
      current = "";
      inTrigger = false;
      blockDepth = 0;
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) statements.push(`${tail};`);
  return statements;
}
