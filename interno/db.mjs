import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export function openDatabase(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','seller')),active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,last_login TEXT);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,commission_bps INTEGER NOT NULL DEFAULT 200);
    CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,category_id TEXT NOT NULL REFERENCES categories(id),name TEXT NOT NULL,brand TEXT NOT NULL,model TEXT NOT NULL,description TEXT NOT NULL,cost INTEGER NOT NULL CHECK(cost>=0),price INTEGER NOT NULL CHECK(price>0),minimum INTEGER NOT NULL CHECK(minimum>=0 AND minimum<=price),commission_bps INTEGER NOT NULL CHECK(commission_bps BETWEEN 0 AND 10000),stock INTEGER NOT NULL CHECK(stock>=0),sku TEXT,image TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,specifications TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS product_sku ON products(sku) WHERE sku IS NOT NULL;
    CREATE INDEX IF NOT EXISTS product_category ON products(category_id,active);
    CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,whatsapp TEXT NOT NULL,city TEXT NOT NULL,source TEXT NOT NULL,notes TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS budgets(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),customer_id TEXT NOT NULL REFERENCES customers(id),type TEXT NOT NULL,needs TEXT NOT NULL,payment TEXT NOT NULL,included TEXT NOT NULL,status TEXT NOT NULL,loss_reason TEXT NOT NULL DEFAULT '',loss_note TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,normal INTEGER NOT NULL,minimum INTEGER NOT NULL,discount INTEGER NOT NULL,final INTEGER NOT NULL,cost INTEGER NOT NULL,commission INTEGER NOT NULL,gross_profit INTEGER NOT NULL,net_profit INTEGER NOT NULL,margin REAL NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS budgets_owner_status ON budgets(owner_id,status);
    CREATE TABLE IF NOT EXISTS budget_items(id TEXT PRIMARY KEY,budget_id TEXT NOT NULL REFERENCES budgets(id),product_id TEXT NOT NULL REFERENCES products(id),snapshot TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS items_budget ON budget_items(budget_id);
    CREATE TABLE IF NOT EXISTS approvals(id TEXT PRIMARY KEY,budget_id TEXT NOT NULL REFERENCES budgets(id),version INTEGER NOT NULL,requested_by TEXT NOT NULL REFERENCES users(id),reason TEXT NOT NULL,proposed INTEGER NOT NULL,minimum INTEGER NOT NULL,status TEXT NOT NULL,decided_by TEXT REFERENCES users(id),decision_note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,decided_at TEXT);
    CREATE INDEX IF NOT EXISTS approvals_budget ON approvals(budget_id,version,status);
    CREATE TABLE IF NOT EXISTS followups(id TEXT PRIMARY KEY,budget_id TEXT NOT NULL REFERENCES budgets(id),due_at TEXT NOT NULL,note TEXT NOT NULL,result TEXT NOT NULL,next_action TEXT NOT NULL,done INTEGER NOT NULL DEFAULT 0,created_by TEXT NOT NULL REFERENCES users(id));
    CREATE INDEX IF NOT EXISTS followups_due ON followups(done,due_at);
    CREATE TABLE IF NOT EXISTS audit_logs(id TEXT PRIMARY KEY,actor_id TEXT REFERENCES users(id),action TEXT NOT NULL,entity_id TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS audit_date ON audit_logs(created_at);
    CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS compatibility_rules(id TEXT PRIMARY KEY,name TEXT NOT NULL,definition TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS stock_movements(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id),budget_id TEXT REFERENCES budgets(id),delta INTEGER NOT NULL,reason TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS import_jobs(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL,report TEXT NOT NULL,created_at TEXT NOT NULL);
    PRAGMA user_version=1;`);
  const cats = ['CPU','GPU','Placa-mãe','Memória RAM','SSD','HD','Fonte','Gabinete','Cooler','Monitor','Teclado','Mouse','Headset','Mousepad','Periféricos','Cabos','Serviços','PC Completo','Outros'];
  for (const [i, name] of cats.entries()) db.prepare('INSERT OR IGNORE INTO categories VALUES (?,?,?)').run(`cat-${i}`, name, name === 'Serviços' ? 500 : i >= 9 && i <= 15 ? 300 : 200);
  db.prepare('INSERT OR IGNORE INTO settings VALUES (1,?)').run(JSON.stringify({ company: 'VOLTUX', contact: '', whatsapp: '', payment: 'A combinar', included: '', warranty: '', proposal_text: 'Se quiser, posso te ajudar a finalizar o pedido.', max_discount_bps: 10000, min_margin_bps: 0 }));
  return db;
}
export function transaction(db, fn) { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } }
