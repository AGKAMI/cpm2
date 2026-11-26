import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { splitSqlStatements } = await import("../src/lib/sql.ts");

describe("sql · statement splitting", () => {
  it("does not split semicolons inside line comments", () => {
    const statements = splitSqlStatements(`
      CREATE TABLE t (
        -- 0-90; sale price = base * (100 - discount) / 100
        discount_percent INTEGER NOT NULL DEFAULT 0
      );
      SELECT 1;
    `);
    assert.equal(statements.length, 2);
    assert.match(statements[0], /CREATE TABLE t/);
    assert.match(statements[0], /discount_percent INTEGER/);
    assert.ok(!statements.some((s) => s.startsWith("sale price")));
    assert.equal(statements[1], "SELECT 1;");
  });

  it("keeps semicolons inside quoted strings", () => {
    const statements = splitSqlStatements(`INSERT INTO t (name) VALUES ('a;b'); SELECT 2;`);
    assert.deepEqual(statements, [
      "INSERT INTO t (name) VALUES ('a;b');",
      "SELECT 2;",
    ]);
  });

  it("ignores semicolons inside block comments and handles a script without a final semicolon", () => {
    const statements = splitSqlStatements(`/* one; two */ SELECT 3`);
    assert.deepEqual(statements, ["SELECT 3;"]);
  });
});

  it("keeps CREATE TRIGGER bodies intact until their END", () => {
    const statements = splitSqlStatements(`
      CREATE TRIGGER t AFTER INSERT ON x
      BEGIN
        UPDATE y SET n = n + 1 WHERE id = NEW.id;
        SELECT CASE WHEN NEW.n > 0 THEN RAISE(ABORT, 'bad'); END;
      END;
      SELECT 4;
    `);
    assert.equal(statements.length, 2);
    assert.match(statements[0], /^CREATE TRIGGER t/);
    assert.doesNotMatch(statements[0], /SELECT 4/);
    assert.equal(statements[1], "SELECT 4;");
  });

  it("does not treat CASE in an ordinary CHECK constraint as a trigger block", () => {
    const statements = splitSqlStatements(`
      CREATE TABLE t (n INTEGER CHECK (CASE WHEN n > 0 THEN 1 ELSE 0 END));
      SELECT 5;
    `);
    assert.deepEqual(statements, [
      "CREATE TABLE t (n INTEGER CHECK (CASE WHEN n > 0 THEN 1 ELSE 0 END));",
      "SELECT 5;",
    ]);
  });
