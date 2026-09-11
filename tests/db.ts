// Test fixtures only. No Node or ORM code is included in production releases.
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
type Row = Record<string, any>;
type Options = {where?: Row; orderBy?: Record<string, string>; select?: Record<string, boolean>};
const connection = new DatabaseSync(path.resolve('storage/e2e/test.db'));
connection.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
function table(name: string) {
  function where(options: Options = {}) {
    const entries = Object.entries(options.where || {});
    for (const [key] of entries) if (!/^[a-z_]+$/.test(key)) throw Error('Invalid fixture field');
    return {sql: entries.length ? ' WHERE ' + entries.map(([key]) => key + ' = ?').join(' AND ') : '', values: entries.map(([,value]) => value)};
  }
  function findMany(options: Options = {}): Row[] {
    const filter = where(options);
    const order = Object.entries(options.orderBy || {}).map(([key,direction]) => key + (direction === 'desc' ? ' DESC' : ' ASC')).join(',');
    const rows = connection.prepare('SELECT * FROM ' + name + filter.sql + (order ? ' ORDER BY ' + order : '')).all(...filter.values) as Row[];
    return options.select ? rows.map(row => Object.fromEntries(Object.keys(options.select!).map(key => [key,row[key]]))) : rows;
  }
  function findFirstOrThrow(options: Options = {}): Row {
    const result = findMany(options)[0]; if (!result) throw Error('Missing fixture row'); return result;
  }
  return {
    findMany, findFirstOrThrow, findUniqueOrThrow:findFirstOrThrow,
    count(options: Options = {}) { return findMany(options).length; },
    deleteMany(options: Options = {}) { const filter=where(options); return connection.prepare('DELETE FROM '+name+filter.sql).run(...filter.values); },
    create({data}: {data:Row}): Row {
      const now=Date.now();
      const row: Row = {id:'c'+randomBytes(12).toString('hex'),created_at:now,updated_at:now,...(name==='sites'?{icon_type:'default',icon_url:null,description:null}:{}),...data};
      connection.prepare('INSERT INTO '+name+' ('+Object.keys(row).join(',')+') VALUES ('+Object.keys(row).map(()=>'?').join(',')+')').run(...Object.values(row));
      return row;
    },
  };
}
export const database = {category:table('categories'),site:table('sites'),adminSession:table('admin_sessions'),$disconnect:()=>connection.close()};
