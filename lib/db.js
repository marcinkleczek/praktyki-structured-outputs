// Dwie instancje Knex — tylko jako query buildery (bez realnego połączenia).
// .toSQL() kompiluje zapytanie do SQL-a właściwego dla dialektu.
const knex = require('knex');

const sqlite = knex({ client: 'sqlite3', useNullAsDefault: true });
const mysql = knex({ client: 'mysql2' });

// Dodaje pojedynczą kolumnę do schema buildera wg definicji z JSON-a.
function addColumn(t, c) {
  let col;
  if (c.autoIncrement && c.primary) {
    col = t.increments(c.name);
  } else {
    switch (c.type) {
      case 'integer':  col = t.integer(c.name); break;
      case 'string':   col = t.string(c.name, c.length || 255); break;
      case 'text':     col = t.text(c.name); break;
      case 'float':    col = t.float(c.name); break;
      case 'boolean':  col = t.boolean(c.name); break;
      case 'datetime': col = t.datetime(c.name); break;
      default: throw new Error(`Nieznany typ: ${c.type}`);
    }
    if (c.primary) col.primary();
  }
  if (c.notNull) col.notNullable();
  if (c.unique) col.unique();
  if (c.default !== undefined) col.defaultTo(c.default);
}

// Buduje zapytanie dla podanego dialektu. Zwraca obiekt { sql, bindings }.
function buildQuery(kx, intent) {
  const op = intent.operation;

  if (op === 'create_table') {
    const sqls = kx.schema.createTable(intent.table, (t) => {
      for (const c of intent.columns || []) addColumn(t, c);
      // MySQL-only: kodowanie/kolacja (Knex pomija je dla SQLite)
      if (kx.client.config.client === 'mysql2') {
        if (intent.charset) t.charset(intent.charset);
        if (intent.collate) t.collate(intent.collate);
      }
    }).toSQL();
    return { sql: sqls.map(s => s.sql).join(';\n'), bindings: sqls.flatMap(s => s.bindings) };
  }

  if (op === 'select') {
    let q = kx(intent.table).select(intent.select && intent.select.length ? intent.select : '*');
    for (const w of intent.where || []) q = q.where(w.column, w.op || '=', w.value);
    for (const o of intent.orderBy || []) q = q.orderBy(o.column, o.direction || 'asc');
    if (intent.limit) q = q.limit(intent.limit);
    return q.toSQL();
  }

  if (op === 'insert')  return kx(intent.table).insert(intent.values).toSQL();

  if (op === 'update') {
    let q = kx(intent.table).update(intent.set);
    for (const w of intent.where || []) q = q.where(w.column, w.op || '=', w.value);
    return q.toSQL();
  }

  if (op === 'delete') {
    let q = kx(intent.table).del();
    for (const w of intent.where || []) q = q.where(w.column, w.op || '=', w.value);
    return q.toSQL();
  }

  throw new Error(`Nieznana operacja: ${op}`);
}

module.exports = { sqlite, mysql, buildQuery };
