(function (root) {
  'use strict';
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatPrice = item => item.preco === null || item.preco === undefined ? 'Sob consulta' : `${item.aPartirDe ? 'A partir de ' : ''}${money.format(item.preco)}`;
  function safeWebUrl(value) {
    if (!value) return '';
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
  }
  function validateConfig(config) {
    const errors = [];
    if (!config || typeof config !== 'object') return ['Configuração inválida.'];
    if (!/^\d{12,15}$/.test(config.whatsapp || '')) errors.push('Informe o WhatsApp com DDI e DDD, usando somente números.');
    if (!safeWebUrl(config.instagram)) errors.push('Informe um link válido para o Instagram.');
    if (config.catalogoUrl && !safeWebUrl(config.catalogoUrl)) errors.push('O catálogo precisa de um link completo, começando com https:// ou http://.');
    const ids = new Set();
    for (const [key, label] of [['produtos', 'produto'], ['servicos', 'serviço']]) {
      if (!Array.isArray(config[key])) { errors.push(`A lista de ${key} é inválida.`); continue; }
      for (const item of config[key]) {
        if (!item || typeof item !== 'object') { errors.push(`Há um ${label} inválido.`); continue; }
        if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(item.id || '') || ids.has(item.id)) errors.push(`O identificador de ${item.nome || label} é inválido ou repetido.`);
        ids.add(item.id);
        if (typeof item.nome !== 'string' || !item.nome.trim()) errors.push(`Preencha o nome de cada ${label}.`);
        if (typeof item.descricao !== 'string') errors.push(`Preencha a descrição de ${item.nome || label}.`);
        if (key === 'servicos' && item.preco !== null && (typeof item.preco !== 'number' || !Number.isFinite(item.preco) || item.preco < 0 || item.preco > 10000000)) errors.push(`O preço de ${item.nome || label} deve ser um número não negativo ou ficar sob consulta.`);
      }
    }
    return errors;
  }
  function itemsById(config) {
    return new Map(config.servicos.map(item => [item.id, { ...item, tipo: 'serviço' }]));
  }
  function normalizeCart(value, config) {
    if (!Array.isArray(value)) return [];
    const items = itemsById(config);
    const merged = new Map();
    for (const entry of value.slice(0, 500)) {
      if (!entry || !items.has(entry.id) || !Number.isInteger(entry.quantidade) || entry.quantidade < 1) continue;
      merged.set(entry.id, Math.min(99, (merged.get(entry.id) || 0) + entry.quantidade));
    }
    return [...merged].map(([id, quantidade]) => ({ id, quantidade }));
  }
  function messageForCart(cart, config) {
    const items = itemsById(config);
    const lines = normalizeCart(cart, config).map(entry => {
      const item = items.get(entry.id);
      const detail = item.tipo === 'serviço' ? `${formatPrice(item)}${item.preco === null ? '' : ' por unidade'}${item.observacaoPreco ? ` ${item.observacaoPreco}` : ''}` : 'opções e valores a consultar';
      return `- ${entry.quantidade}x ${item.nome} (${item.tipo}; ${detail})`;
    });
    return lines.length ? `Olá, Voltux! Vim pelo site e tenho interesse nestes itens:\n\n${lines.join('\n')}\n\nPodem confirmar as opções, os valores e combinar o atendimento comigo?` : 'Olá, Voltux! Vim pelo site e gostaria de conversar.';
  }
  function whatsappUrl(phone, message) { return `https://wa.me/${String(phone).replace(/\D/g, '')}?text=${encodeURIComponent(message)}`; }
  const api = { money, formatPrice, safeWebUrl, validateConfig, itemsById, normalizeCart, messageForCart, whatsappUrl };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VoltuxCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
