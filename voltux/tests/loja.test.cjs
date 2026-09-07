const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const core = require('../loja-core.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'loja-config.js'), 'utf8'), context);
const config = JSON.parse(JSON.stringify(context.window.VOLTUX_CONFIG));

test('a configuração usa os serviços e valores aprovados', () => {
  assert.deepEqual(core.validateConfig(config), []);
  const items = core.itemsById(config);
  assert.equal(items.get('troca-peca').preco, 25);
  assert.equal(items.get('troca-peca').observacaoPreco, '+ valor da peça');
  assert.equal(items.get('limpeza-comum').preco, 69.99);
  assert.equal(items.get('limpeza-premium').preco, 125);
  assert.equal(items.get('formatacao').preco, 89);
  assert.equal(items.get('montagem-pc').preco, null);
  assert.deepEqual(config.produtos, []);
});

test('mensagem inclui serviços e peça cobrada à parte e descarta produtos antigos', () => {
  const message = core.messageForCart([{ id: 'pc-gamer', quantidade: 1 }, { id: 'troca-peca', quantidade: 2 }, { id: 'limpeza-comum', quantidade: 1 }, { id: 'montagem-pc', quantidade: 1 }], config);
  assert.doesNotMatch(message, /PC gamer/);
  assert.match(message, /2x Troca de peça \(serviço; A partir de R\$\s25,00 por unidade \+ valor da peça\)/);
  assert.match(message, /Limpeza comum \(serviço; R\$\s69,99/);
  assert.match(message, /Montagem de PC \(serviço; Sob consulta\)/);
  assert.doesNotMatch(message, /total final|R\$\s0,00/);
  const url = new URL(core.whatsappUrl(config.whatsapp, message));
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.pathname, '/5531997125608');
  assert.equal(url.searchParams.get('text'), message);
});

test('nomes com acentos e caracteres reservados chegam intactos ao WhatsApp', () => {
  const changed = structuredClone(config);
  changed.servicos[0].nome = 'PC João & Maria + RGB #1 / 100%';
  const message = core.messageForCart([{ id: 'troca-peca', quantidade: 1 }], changed);
  assert.equal(new URL(core.whatsappUrl(changed.whatsapp, message)).searchParams.get('text'), message);
  assert.ok(message.includes(changed.servicos[0].nome));
});

test('carrinho persistido descarta itens obsoletos e quantidades inválidas', () => {
  assert.deepEqual(core.normalizeCart([{ id: 'formatacao', quantidade: 2 }, { id: 'formatacao', quantidade: 3 }, { id: 'removido', quantidade: 1 }, { id: 'teclado', quantidade: -1 }, { id: 'mouse', quantidade: 1.5 }, null, { id: 'headset', quantidade: '2' }, { id: 'troca-peca', quantidade: 1000 }], config), [{ id: 'formatacao', quantidade: 5 }, { id: 'troca-peca', quantidade: 99 }]);
  assert.deepEqual(core.normalizeCart({ id: 'formatacao', quantidade: 2 }, config), []);
});

test('sob consulta é diferente de serviço com preço zero', () => {
  assert.equal(core.formatPrice({ preco: null }), 'Sob consulta');
  assert.match(core.formatPrice({ preco: 0 }), /R\$\s0,00/);
  assert.match(core.formatPrice({ preco: 99.5, aPartirDe: true }), /A partir de R\$\s99,50/);
});

test('editor rejeita identificadores repetidos, URLs executáveis e preços negativos', () => {
  const invalid = structuredClone(config);
  invalid.servicos[0].id = invalid.servicos[1].id;
  invalid.servicos[0].preco = -35;
  invalid.catalogoUrl = 'javascript:alert(1)';
  const errors = core.validateConfig(invalid);
  assert.equal(errors.length, 3);
  assert.equal(core.safeWebUrl('data:text/html,<script>'), '');
  assert.equal(core.safeWebUrl('https://user:pass@example.com'), '');
});
