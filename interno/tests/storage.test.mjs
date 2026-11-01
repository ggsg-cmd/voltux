import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backup } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { openDatabase, transaction } from '../db.mjs';
test('banco persiste, reverte transação e backup é restaurável',async()=>{
  const directory=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.preview/storage',randomUUID());mkdirSync(directory,{recursive:true});
  const filename=path.join(directory,'source.sqlite'),destination=path.join(directory,'backup.sqlite');
  let db=openDatabase(filename);db.prepare('INSERT INTO categories VALUES (?,?,?)').run('custom','Categoria persistente',300);
  assert.throws(()=>transaction(db,()=>{db.prepare('INSERT INTO categories VALUES (?,?,?)').run('rollback','Reverter',100);throw new Error('Rollback esperado');}));
  assert.equal(db.prepare('SELECT * FROM categories WHERE id=?').get('rollback'),undefined);
  await backup(db,destination);db.close();db=openDatabase(filename);assert.equal(db.prepare('SELECT name FROM categories WHERE id=?').get('custom').name,'Categoria persistente');db.close();
  const restored=openDatabase(destination);assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(restored.prepare('SELECT commission_bps FROM categories WHERE id=?').get('custom').commission_bps,300);restored.close();
});
