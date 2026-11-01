import http from 'node:http';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { openDatabase, transaction } from './db.mjs';
import { AppError, check, fields, text, integer, calculate, publicProduct, commercialBudget, proposal, statuses, lossReasons, editable } from './domain.mjs';
const scrypt = promisify(scryptCallback);
const hash = value => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const id = () => randomUUID();
const root = path.dirname(fileURLToPath(import.meta.url));
export async function passwordHash(password) {
  text(password, 'Senha', 128, true); check(password.length >= 12, 'Use uma senha de pelo menos 12 caracteres.');
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
}
async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [salt, digest] = encoded.split(':');
  return timingSafeEqual(await scrypt(password, salt, 64), Buffer.from(digest, 'hex'));
}
export function createApp({ dbPath = process.env.DB_PATH || path.join(root, 'data/voltux.sqlite'), origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3100', production = process.env.NODE_ENV === 'production', setupToken = process.env.SETUP_TOKEN || '' } = {}) {
  check(!production || origin.startsWith('https://'), 'Produção exige APP_ORIGIN com HTTPS.');
  const db = openDatabase(dbPath);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const settings = () => JSON.parse(get('SELECT value FROM settings WHERE id=1').value);
  const audit = (actor, action, entity, detail = {}) => run('INSERT INTO audit_logs VALUES (?,?,?,?,?,?)', id(), actor?.id || null, action, entity, JSON.stringify(detail), now());
  const admin = user => check(user.role === 'admin', 'Acesso exclusivo do administrador.', 403);
  const safeUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, last_login: u.last_login });
  const product = productId => get('SELECT p.*,c.name category FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=?', productId);
  function budget(budgetId, user) {
    const b = get('SELECT b.*,u.name owner FROM budgets b JOIN users u ON u.id=b.owner_id WHERE b.id=?', budgetId);
    check(b && (user.role === 'admin' || b.owner_id === user.id), 'Orçamento não encontrado.', 404);
    b.customer = get('SELECT id,name,whatsapp,city,source,notes FROM customers WHERE id=?', b.customer_id);
    b.needs = JSON.parse(b.needs);
    b.items = all('SELECT snapshot FROM budget_items WHERE budget_id=? ORDER BY rowid', b.id).map(i => JSON.parse(i.snapshot));
    b.approval = get('SELECT id,status,reason,decision_note,proposed,minimum,created_at FROM approvals WHERE budget_id=? AND version=? ORDER BY rowid DESC LIMIT 1', b.id, b.version) || null;
    b.followups = all('SELECT * FROM followups WHERE budget_id=? ORDER BY due_at', b.id);
    return b;
  }
  const expose = (b, user) => user.role === 'admin' ? b : commercialBudget(b);
  function canSell(b) { check(b.final >= b.minimum || b.approval?.status === 'approved', 'Preço abaixo do mínimo autorizado. Solicite aprovação do administrador.', 409); }
  function validateProduct(body) {
    fields(body, ['name','category_id','brand','model','description','cost','price','minimum','commission_bps','stock','sku','image','active','specifications']);
    const p = {};
    for (const k of ['name','category_id','brand','model','description','sku','image','specifications']) p[k] = text(body[k] ?? '', k, k === 'description' || k === 'specifications' ? 2000 : 250, ['name','category_id'].includes(k));
    const category = get('SELECT * FROM categories WHERE id=?', p.category_id); check(category, 'Categoria inválida.');
    for (const k of ['cost','price','minimum','stock']) p[k] = integer(body[k], k, k === 'price' ? 1 : 0);
    p.commission_bps = integer(body.commission_bps ?? category.commission_bps, 'Comissão', 0, 10000);
    p.active = integer(body.active ?? 1, 'Ativo', 0, 1); p.sku ||= null;
    check(p.minimum <= p.price, 'Preço mínimo não pode superar o normal.');
    check(!p.image || /^https:\/\//.test(p.image), 'Imagem deve usar HTTPS.');
    const rule = settings();
    check(p.minimum > 0 && (p.minimum - p.cost - Math.round(p.minimum * p.commission_bps / 10000)) * 10000 / p.minimum >= rule.min_margin_bps, 'Preço mínimo não atende à margem configurada.');
    return p;
  }
  function saveBudget(body, user, previous) {
    fields(body, ['customer','type','needs','payment','included','items','discount','version','request_approval','approval_reason']);
    if (previous) { check(user.role === 'admin' || editable(previous.status), 'Orçamento encerrado não pode ser editado.', 403); check(body.version === previous.version, 'Orçamento alterado por outro usuário. Reabra antes de salvar.', 409); }
    fields(body.customer, ['name','whatsapp','city','source','notes']);
    const customer = {};
    for (const k of ['name','whatsapp','city','source','notes']) customer[k] = text(body.customer[k] ?? '', k, k === 'notes' ? 2000 : 160, k === 'name');
    check(!customer.whatsapp || /^\d{10,15}$/.test(customer.whatsapp), 'WhatsApp: use DDI e DDD, somente números.');
    check(['PC Completo','Periféricos','Upgrade','Serviço','Outros'].includes(body.type), 'Tipo inválido.');
    fields(body.needs, ['use','approximate','programs','notes']);
    const needs = { use: text(body.needs.use ?? '', 'Uso', 80), approximate: integer(body.needs.approximate ?? 0, 'Orçamento aproximado'), programs: text(body.needs.programs ?? '', 'Programas', 500), notes: text(body.needs.notes ?? '', 'Observações', 2000) };
    const payment = text(body.payment, 'Pagamento', 1000, true), included = text(body.included ?? '', 'Incluído', 2000);
    check(Array.isArray(body.items) && body.items.length > 0 && body.items.length <= 100, 'Adicione de 1 a 100 produtos.');
    const seen = new Set();
    const items = body.items.map(entry => {
      fields(entry, ['product_id','quantity','replaces_id']);
      const p = product(text(entry.product_id, 'Produto', 80, true)); check(p?.active, 'Produto indisponível ou desativado.');
      check(!seen.has(p.id), 'Produto duplicado; ajuste a quantidade.'); seen.add(p.id);
      const quantity = integer(entry.quantity, 'Quantidade', 1, 999);
      let replaces = '', upgrade_difference = null;
      if (entry.replaces_id) {
        check(body.type === 'Upgrade', 'Substituição só é permitida em upgrade.');
        const base = product(entry.replaces_id); check(base, 'Componente anterior inválido.');
        replaces = base.name; upgrade_difference = { price: p.price - base.price, cost: p.cost - base.cost, gross_profit: (p.price - base.price) - (p.cost - base.cost) };
      }
      return { product_id: p.id, name: p.name, category: p.category, quantity, price: p.price, minimum: p.minimum, cost: p.cost, commission_bps: p.commission_bps, replaces, replaces_id: entry.replaces_id || '', upgrade_difference };
    });
    const sums = calculate(items, body.discount);
    // Limite global e mínimos por produto são avaliados em conjunto no servidor.
    sums.minimum = Math.max(sums.minimum, Math.ceil(sums.normal * (10000 - settings().max_discount_bps) / 10000));
    const under = sums.final < sums.minimum;
    check(!under || body.request_approval === true, 'Preço abaixo do mínimo autorizado. Solicite aprovação do administrador.', 409);
    const reason = under ? text(body.approval_reason, 'Motivo do desconto', 1000, true) : '';
    return transaction(db, () => {
      const budgetId = previous?.id || id(), customerId = previous?.customer_id || id(), timestamp = now();
      if (previous) run('UPDATE customers SET name=?,whatsapp=?,city=?,source=?,notes=? WHERE id=?', ...Object.values(customer), customerId);
      else run('INSERT INTO customers VALUES (?,?,?,?,?,?,?)', customerId, user.id, ...Object.values(customer));
      const data = [body.type, JSON.stringify(needs), payment, included, previous?.status || 'Rascunho', sums.normal, sums.minimum, sums.discount, sums.final, sums.cost, sums.commission, sums.gross_profit, sums.net_profit, sums.margin, timestamp];
      if (previous) {
        // Toda edição invalida aprovação e volta a negociação para evitar venda com autorização antiga.
        data[4] = 'Rascunho';
        run('UPDATE budgets SET type=?,needs=?,payment=?,included=?,status=?,normal=?,minimum=?,discount=?,final=?,cost=?,commission=?,gross_profit=?,net_profit=?,margin=?,updated_at=?,version=version+1 WHERE id=?', ...data, budgetId);
        run('DELETE FROM budget_items WHERE budget_id=?', budgetId);
        run("UPDATE approvals SET status='superseded' WHERE budget_id=? AND status='pending'", budgetId);
      } else run('INSERT INTO budgets(id,owner_id,customer_id,type,needs,payment,included,status,normal,minimum,discount,final,cost,commission,gross_profit,net_profit,margin,updated_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', budgetId, user.id, customerId, ...data, timestamp);
      for (const item of sums.lines) run('INSERT INTO budget_items VALUES (?,?,?,?)', id(), budgetId, item.product_id, JSON.stringify(item));
      if (under) run('INSERT INTO approvals(id,budget_id,version,requested_by,reason,proposed,minimum,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)', id(), budgetId, (previous?.version || 0) + 1, user.id, reason, sums.final, sums.minimum, 'pending', timestamp);
      audit(user, previous ? 'budget.updated' : 'budget.created', budgetId, { before: previous ? { final: previous.final, discount: previous.discount, status: previous.status } : null, after: { final: sums.final, discount: sums.discount, approval_requested: under } });
      return expose(budget(budgetId, user), user);
    });
  }
  const limits = new Map();
  function limit(key, maximum, window = 60000) {
    const time = Date.now();
    if (limits.size > 5000) for (const [k, value] of limits) if (value.until < time) limits.delete(k);
    const bucket = limits.get(key); const current = !bucket || bucket.until < time ? { count: 0, until: time + window } : bucket;
    current.count++; limits.set(key, current); check(current.count <= maximum, 'Muitas tentativas. Aguarde alguns minutos.', 429);
  }
  async function bodyOf(req) {
    check((req.headers['content-type'] || '').startsWith('application/json'), 'Use JSON.', 415);
    let size = 0, chunks = [];
    for await (const chunk of req) { size += chunk.length; check(size <= 100000, 'Requisição muito grande.', 413); chunks.push(chunk); }
    try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new AppError('JSON inválido.'); }
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    const send = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    try {
      const url = new URL(req.url, origin), route = url.pathname, method = req.method;
      check(req.headers.host === new URL(origin).host, 'Host inválido.', 403);
      if (!route.startsWith('/api/')) {
        check(method === 'GET', 'Método não permitido.', 405);
        const files = { '/': ['public/index.html','text/html'], '/app.js': ['public/app.js','text/javascript'], '/style.css': ['public/style.css','text/css'], '/logo.png': ['../assets/logo-voltux.png','image/png'] };
        check(files[route], 'Não encontrado.', 404);
        const [file, mime] = files[route]; res.setHeader('Content-Type', `${mime}; charset=utf-8`); res.end(await readFile(path.join(root, file))); return;
      }
      limit(`api:${req.socket.remoteAddress}`, 300);
      if (method !== 'GET') check(req.headers.origin === origin, 'Origem inválida.', 403);
      if (route === '/api/setup' && method === 'GET') { send({ required: !get('SELECT id FROM users LIMIT 1') }); return; }
      if ((route === '/api/login' || route === '/api/setup') && method === 'POST') {
        limit(`auth:${req.socket.remoteAddress}`, 10, 15 * 60000);
        const body = await bodyOf(req); fields(body, route === '/api/setup' ? ['name','email','password','token'] : ['email','password']);
        const email = text(body.email, 'E-mail', 200, true).toLowerCase(); check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'E-mail inválido.');
        if (route === '/api/setup') {
          check(!get('SELECT id FROM users LIMIT 1'), 'Administrador já configurado.', 403);
          check(setupToken.length >= 32 && typeof body.token === 'string' && timingSafeEqual(Buffer.from(hash(body.token)), Buffer.from(hash(setupToken))), 'Token de configuração inválido.', 403);
          const name = text(body.name, 'Nome', 120, true), encoded = await passwordHash(body.password);
          transaction(db, () => { check(!get('SELECT id FROM users LIMIT 1'), 'Administrador já configurado.', 403); const userId = id(); run('INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)', userId, name, email, encoded, 'admin', now()); audit({ id: userId }, 'user.bootstrap', userId); });
          send({ message: 'Administrador criado. Faça login.' }, 201); return;
        }
        const user = get('SELECT * FROM users WHERE email=?', email);
        const dummy = '00000000000000000000000000000000:' + '00'.repeat(64);
        const verified = await verifyPassword(body.password, user?.password_hash || dummy);
        check(user?.active && verified, 'E-mail ou senha inválidos.', 401);
        const token = randomBytes(32).toString('hex'), csrf = randomBytes(24).toString('hex');
        transaction(db, () => { run('DELETE FROM sessions WHERE expires<?', Date.now()); run('INSERT INTO sessions VALUES (?,?,?,?)', hash(token), user.id, csrf, Date.now() + 8 * 3600000); run('UPDATE users SET last_login=? WHERE id=?', now(), user.id); audit(user, 'user.login', user.id); });
        res.setHeader('Set-Cookie', `voltux_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${production ? '; Secure' : ''}`); send({ user: safeUser(user), csrf }); return;
      }
      const token = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('voltux_session='))?.split('=')[1] || '';
      const session = get('SELECT s.*,u.name,u.email,u.role,u.active,u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?', hash(token), Date.now());
      check(session?.active, 'Faça login para continuar.', 401);
      const user = session;
      if (method !== 'GET') check(req.headers['x-csrf-token'] === session.csrf, 'Sessão inválida. Recarregue a página.', 403);
      if (route === '/api/me' && method === 'GET') { send({ user: safeUser(user), csrf: session.csrf }); return; }
      if (route === '/api/logout' && method === 'POST') { run('DELETE FROM sessions WHERE token_hash=?', hash(token)); res.setHeader('Set-Cookie', `voltux_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production ? '; Secure' : ''}`); send({ message: 'Sessão encerrada.' }); return; }
      const body = method === 'GET' ? null : await bodyOf(req);
      if (route === '/api/password' && method === 'PUT') {
        fields(body, ['current_password','new_password']);
        limit(`password:${user.id}`, 5, 15 * 60000);
        const current = get('SELECT password_hash FROM users WHERE id=?', user.id);
        check(await verifyPassword(body.current_password, current.password_hash), 'Senha atual incorreta.', 403);
        const encoded = await passwordHash(body.new_password);
        transaction(db, () => {
          check(get('SELECT active,password_hash FROM users WHERE id=?', user.id)?.password_hash === current.password_hash, 'Acesso alterado. Faça login novamente.', 409);
          run('UPDATE users SET password_hash=? WHERE id=?', encoded, user.id);
          run('DELETE FROM sessions WHERE user_id=?', user.id); audit(user, 'user.password_changed', user.id);
        });
        res.setHeader('Set-Cookie', `voltux_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production ? '; Secure' : ''}`);
        send({ message: 'Senha atualizada. Faça login novamente.' }); return;
      }
      if (route === '/api/settings') {
        if (method === 'GET') { const s = settings(); send(user.role === 'admin' ? s : Object.fromEntries(['company','contact','whatsapp','payment','included','warranty','proposal_text'].map(k => [k,s[k]]))); return; }
        admin(user); check(method === 'PUT', 'Método inválido.', 405); fields(body, Object.keys(settings())); const value = {};
        for (const k of ['company','contact','whatsapp','payment','included','warranty','proposal_text']) value[k] = text(body[k], k, 2000, k === 'company');
        check(!value.whatsapp || /^\d{10,15}$/.test(value.whatsapp), 'WhatsApp inválido.');
        for (const k of ['max_discount_bps','min_margin_bps']) value[k] = integer(body[k], k, 0, 10000);
        transaction(db, () => { audit(user, 'settings.updated', '1', { before: settings(), after: value }); run('UPDATE settings SET value=? WHERE id=1', JSON.stringify(value)); }); send(value); return;
      }
      if (route === '/api/categories') {
        if (method === 'GET') { send(all('SELECT * FROM categories ORDER BY name').map(c => user.role === 'admin' ? c : { id: c.id, name: c.name })); return; }
        admin(user); check(['POST','PUT'].includes(method), 'Método inválido.', 405); fields(body, ['id','name','commission_bps']);
        const categoryId = method === 'PUT' ? text(body.id, 'Categoria', 80, true) : id(), name = text(body.name, 'Categoria', 120, true), bps = integer(body.commission_bps, 'Comissão', 0, 10000);
        transaction(db, () => { if (method === 'PUT') { check(get('SELECT id FROM categories WHERE id=?', categoryId), 'Categoria não encontrada.', 404); run('UPDATE categories SET name=?,commission_bps=? WHERE id=?', name, bps, categoryId); } else run('INSERT INTO categories VALUES (?,?,?)', categoryId, name, bps); audit(user, 'category.saved', categoryId, { name, commission_bps: bps }); }); send({ id: categoryId }); return;
      }
      if (route === '/api/products' && method === 'GET') {
        let products = all('SELECT p.*,c.name category FROM products p JOIN categories c ON c.id=p.category_id ORDER BY p.name');
        if (user.role !== 'admin') products = products.filter(p => p.active);
        send(products.map(p => user.role === 'admin' ? { ...p, normal_finance: calculate([{ ...p, quantity: 1 }], 0), minimum_finance: calculate([{ ...p, quantity: 1 }], p.price - p.minimum) } : publicProduct(p))); return;
      }
      const productMatch = route.match(/^\/api\/products(?:\/([^/]+))?$/);
      if (productMatch && ['POST','PUT'].includes(method)) {
        admin(user); check((method === 'POST') !== !!productMatch[1], 'Rota inválida.'); const p = validateProduct(body), productId = productMatch[1] || id(), old = product(productId);
        if (method === 'PUT') check(old, 'Produto não encontrado.', 404);
        transaction(db, () => {
          const keys = Object.keys(p), values = Object.values(p), timestamp = now();
          if (old) run(`UPDATE products SET ${keys.map(k => `${k}=?`).join(',')},updated_at=? WHERE id=?`, ...values, timestamp, productId);
          else run(`INSERT INTO products(id,${keys.join(',')},created_at,updated_at) VALUES (${Array(keys.length + 3).fill('?').join(',')})`, productId, ...values, timestamp, timestamp);
          const delta = p.stock - (old?.stock || 0); if (delta) run('INSERT INTO stock_movements VALUES (?,?,?,?,?,?,?)', id(), productId, null, delta, 'Ajuste manual pelo administrador', user.id, timestamp);
          audit(user, old ? 'product.updated' : 'product.created', productId, { before: old || null, after: p });
        }); send(product(productId)); return;
      }
      if (route === '/api/users') {
        admin(user);
        if (method === 'GET') { send(all('SELECT * FROM users ORDER BY name').map(safeUser)); return; }
        check(['POST','PUT'].includes(method), 'Método inválido.', 405); fields(body, ['id','name','email','password','active']);
        const name = text(body.name, 'Nome', 120, true), email = text(body.email, 'E-mail', 200, true).toLowerCase(); check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'E-mail inválido.');
        const active = integer(body.active ?? 1, 'Ativo', 0, 1), userId = method === 'PUT' ? text(body.id, 'Usuário', 80, true) : id();
        const old = get('SELECT * FROM users WHERE id=?', userId); if (method === 'PUT') check(old?.role === 'seller', 'Use este painel para gerenciar vendedores.');
        const encoded = body.password ? await passwordHash(body.password) : old?.password_hash; check(encoded, 'Informe a senha.');
        transaction(db, () => { if (old) { run('UPDATE users SET name=?,email=?,password_hash=?,active=? WHERE id=?', name, email, encoded, active, userId); run('DELETE FROM sessions WHERE user_id=?', userId); } else run('INSERT INTO users(id,name,email,password_hash,role,active,created_at) VALUES (?,?,?,?,?,?,?)', userId, name, email, encoded, 'seller', active, now()); audit(user, old ? 'user.updated' : 'user.created', userId, { name, email, active, access_reset: !!body.password }); }); send(safeUser(get('SELECT * FROM users WHERE id=?', userId))); return;
      }
      if (route === '/api/budgets' && method === 'GET') { send(all(`SELECT id FROM budgets ${user.role === 'admin' ? '' : 'WHERE owner_id=?'} ORDER BY updated_at DESC`, ...(user.role === 'admin' ? [] : [user.id])).map(row => expose(budget(row.id, user), user))); return; }
      if (route === '/api/budgets' && method === 'POST') { send(saveBudget(body, user), 201); return; }
      const match = route.match(/^\/api\/budgets\/([^/]+)(?:\/(status|proposal|followups))?$/);
      if (match) {
        const b = budget(match[1], user), action = match[2];
        if (!action && method === 'GET') { send(expose(b, user)); return; }
        if (!action && method === 'PUT') { send(saveBudget(body, user, b)); return; }
        if (action === 'proposal' && method === 'GET') {
          canSell(b); check(!['Perdido','Cancelado'].includes(b.status), 'Orçamento encerrado.');
          const message = proposal(b, settings()); send({ text: message, whatsapp: b.customer.whatsapp ? `https://wa.me/${b.customer.whatsapp}?text=${encodeURIComponent(message)}` : null, contact_url: settings().whatsapp ? `https://wa.me/${settings().whatsapp}` : null }); return;
        }
        if (action === 'status' && method === 'PUT') {
          fields(body, ['status','loss_reason','loss_note','version']); check(statuses.includes(body.status), 'Status inválido.'); check(body.version === b.version, 'Orçamento atualizado. Reabra antes de continuar.', 409);
          check(user.role === 'admin' || editable(b.status), 'Somente o administrador pode reabrir um orçamento.', 403);
          if (!['Rascunho','Perdido','Cancelado'].includes(body.status)) canSell(b);
          const loss = body.status === 'Perdido' ? body.loss_reason : ''; if (body.status === 'Perdido') check(lossReasons.includes(loss), 'Informe o motivo da perda.');
          const note = text(body.loss_note ?? '', 'Observação', 1000);
          transaction(db, () => {
            // Status não altera o conteúdo aprovado; versão é preservada para a autorização.
            run('UPDATE budgets SET status=?,loss_reason=?,loss_note=?,updated_at=? WHERE id=?', body.status, loss, note, now(), b.id);
            audit(user, 'budget.status', b.id, { before: b.status, after: body.status, loss_reason: loss, note });
          }); send(expose(budget(b.id, user), user)); return;
        }
        if (action === 'followups' && method === 'POST') {
          fields(body, ['due_at','note','result','next_action']); check(editable(b.status), 'Orçamento encerrado.');
          const due = new Date(text(body.due_at, 'Próximo contato', 50, true)); check(Number.isFinite(due.getTime()), 'Data inválida.');
          transaction(db, () => { const followupId = id(); run('INSERT INTO followups VALUES (?,?,?,?,?,?,?,?)', followupId, b.id, due.toISOString(), text(body.note ?? '', 'Observação', 1500), text(body.result ?? '', 'Resultado', 1000), text(body.next_action ?? '', 'Próxima ação', 1000), 0, user.id); audit(user, 'followup.created', b.id, { followup_id: followupId, due_at: due.toISOString() }); }); send({ message: 'Follow-up registrado.' }); return;
        }
      }
      if (route === '/api/followups' && method === 'GET') { send(all(`SELECT f.*,c.name customer,b.final,b.status FROM followups f JOIN budgets b ON b.id=f.budget_id JOIN customers c ON c.id=b.customer_id WHERE f.done=0 AND b.status NOT IN ('Fechado','Perdido','Cancelado') ${user.role === 'admin' ? '' : 'AND b.owner_id=?'} ORDER BY due_at`, ...(user.role === 'admin' ? [] : [user.id]))); return; }
      const followupMatch = route.match(/^\/api\/followups\/([^/]+)$/);
      if (followupMatch && method === 'PUT') {
        fields(body, ['result']); const f = get('SELECT * FROM followups WHERE id=?', followupMatch[1]); check(f, 'Follow-up não encontrado.', 404); budget(f.budget_id, user);
        transaction(db, () => { const result = text(body.result, 'Resultado', 1000, true); run('UPDATE followups SET done=1,result=? WHERE id=?', result, f.id); audit(user, 'followup.completed', f.budget_id, { result }); }); send({ message: 'Contato concluído.' }); return;
      }
      if (route === '/api/approvals' && method === 'GET') { admin(user); send(all("SELECT a.*,u.name seller,c.name customer,b.type FROM approvals a JOIN budgets b ON b.id=a.budget_id JOIN users u ON u.id=a.requested_by JOIN customers c ON c.id=b.customer_id ORDER BY a.created_at DESC")); return; }
      const approvalMatch = route.match(/^\/api\/approvals\/([^/]+)$/);
      if (approvalMatch && method === 'PUT') {
        admin(user); fields(body, ['status','note']); check(['approved','rejected'].includes(body.status), 'Decisão inválida.');
        transaction(db, () => { const a = get('SELECT * FROM approvals WHERE id=?', approvalMatch[1]); check(a?.status === 'pending', 'Solicitação já decidida ou inexistente.', 409); const b = budget(a.budget_id, user); check(b.version === a.version && editable(b.status), 'Orçamento alterado ou encerrado.', 409); const note = text(body.note ?? '', 'Decisão', 1000); run('UPDATE approvals SET status=?,decided_by=?,decision_note=?,decided_at=? WHERE id=?', body.status, user.id, note, now(), a.id); audit(user, 'approval.decided', b.id, { approval_id: a.id, status: body.status, note, version: a.version, proposed: a.proposed }); }); send({ message: 'Decisão registrada.' }); return;
      }
      if (route === '/api/audit' && method === 'GET') { admin(user); send(all('SELECT a.*,u.name actor FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.rowid DESC LIMIT 500')); return; }
      if (route === '/api/dashboard' && method === 'GET') {
        const rows = all(`SELECT * FROM budgets ${user.role === 'admin' ? '' : 'WHERE owner_id=?'}`, ...(user.role === 'admin' ? [] : [user.id]));
        const closed = rows.filter(b => b.status === 'Fechado'), sum = key => closed.reduce((s, b) => s + b[key], 0);
        const output = { budgets: rows.length, sent: rows.filter(b => b.status !== 'Rascunho').length, sales: closed.length, revenue: sum('final'), conversion: rows.length ? closed.length / rows.length * 100 : 0, waiting: rows.filter(b => ['Enviado','Em negociação','Aguardando cliente'].includes(b.status)).length, ticket: closed.length ? Math.round(sum('final') / closed.length) : 0 };
        if (user.role === 'admin') {
          Object.assign(output, { commission: sum('commission'), gross_profit: sum('gross_profit'), net_profit: sum('net_profit'), margin: sum('final') ? sum('net_profit') / sum('final') * 100 : 0 });
          const group = (values, key, amount) => Object.entries(values.reduce((acc, x) => { acc[key(x)] = (acc[key(x)] || 0) + amount(x); return acc; }, {})).map(([label,value]) => ({ label,value })).sort((a,b) => b.value-a.value);
          output.sellers = group(closed, b => get('SELECT name FROM users WHERE id=?', b.owner_id).name, b => b.final);
          const lines = closed.flatMap(b => budget(b.id, user).items);
          output.categories = group(lines, i => i.category, i => i.sale); output.products = group(lines, i => i.name, i => i.quantity).slice(0,10); output.losses = group(rows.filter(b => b.status === 'Perdido'), b => b.loss_reason, () => 1);
        }
        send(output); return;
      }
      throw new AppError('Rota não encontrada.', 404);
    } catch (error) {
      const constraint = error.code?.startsWith('ERR_SQLITE') && /UNIQUE constraint/.test(error.message);
      const status = error.status || (constraint ? 409 : 500);
      if (status === 500) console.error('Falha interna:', error.message);
      send({ error: error.status ? error.message : constraint ? 'Já existe um registro com esse e-mail, SKU ou nome.' : 'Não foi possível concluir. Tente novamente.' }, status);
    }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  return { server, db };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server, db } = createApp();
  server.listen(Number(process.env.PORT || 3100), process.env.HOST || '127.0.0.1', () => console.log(`Voltux interno: ${process.env.APP_ORIGIN || 'http://127.0.0.1:3100'}`));
  const stop = () => server.close(() => { db.close(); process.exit(0); }); process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
