export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const check = (condition, message, status = 400) => { if (!condition) throw new AppError(message, status); };
export function text(value, name, max = 500, required = false) {
  check(typeof value === 'string' && value.length <= max && (!required || value.trim()), `${name}: valor inválido.`);
  return value.trim();
}
export function integer(value, name, min = 0, max = 100000000) {
  check(Number.isSafeInteger(value) && value >= min && value <= max, `${name}: valor inválido.`);
  return value;
}
export function fields(value, allowed) {
  check(value && typeof value === 'object' && !Array.isArray(value), 'Dados inválidos.');
  check(Object.keys(value).every(key => allowed.includes(key)), 'Campo não permitido.');
}
export const statuses = ['Rascunho', 'Enviado', 'Em negociação', 'Aguardando cliente', 'Follow-up', 'Fechado', 'Perdido', 'Cancelado'];
export const lossReasons = ['Preço', 'Prazo', 'Encontrou concorrente', 'Desistiu', 'Sem resposta', 'Orçamento insuficiente', 'Queria outra configuração', 'Forma de pagamento', 'Outro'];
export const editable = status => !['Fechado', 'Perdido', 'Cancelado'].includes(status);
export const currency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
// Dinheiro em centavos; comissão em pontos-base (200 = 2%). Margem sobre venda.
// Desconto rateado por maior resto: soma das linhas sempre igual ao total final.
export function calculate(items, discount) {
  integer(discount, 'Desconto');
  const normal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  check(normal > 0 && normal <= 100000000, 'Total do orçamento inválido.');
  check(discount < normal, 'Desconto deve ser menor que o total.');
  const final = normal - discount;
  const weights = items.map((i, index) => {
    const numerator = BigInt(i.price * i.quantity) * BigInt(final);
    return { index, value: Number(numerator / BigInt(normal)), remainder: Number(numerator % BigInt(normal)) };
  });
  let rest = final - weights.reduce((s, i) => s + i.value, 0);
  for (const i of [...weights].sort((a, b) => b.remainder - a.remainder)) if (rest-- > 0) i.value++;
  const lines = items.map((i, n) => ({ ...i, sale: weights[n].value, commission: Math.round(weights[n].value * i.commission_bps / 10000) }));
  const cost = items.reduce((s, i) => s + i.cost * i.quantity, 0);
  const minimum = items.reduce((s, i) => s + i.minimum * i.quantity, 0);
  const commission = lines.reduce((s, i) => s + i.commission, 0);
  return { normal, minimum, discount, final, cost, commission, gross_profit: final - cost, net_profit: final - cost - commission, margin: (final - cost - commission) / final * 100, lines };
}
export function publicProduct(p) {
  return Object.fromEntries(['id', 'name', 'category_id', 'category', 'brand', 'model', 'description', 'price', 'minimum', 'stock', 'sku', 'image', 'active', 'specifications'].map(k => [k, p[k]]));
}
export function commercialBudget(b) {
  const safe = Object.fromEntries(['id', 'owner_id', 'owner', 'customer', 'type', 'needs', 'payment', 'included', 'status', 'loss_reason', 'loss_note', 'version', 'created_at', 'updated_at', 'approval', 'followups', 'normal', 'minimum', 'discount', 'final'].map(k => [k, b[k]]));
  safe.items = b.items.map(i => Object.fromEntries(['product_id', 'name', 'category', 'quantity', 'price', 'minimum', 'sale', 'replaces', 'replaces_id', 'upgrade_difference'].map(k => [k, i[k]])));
  safe.items = safe.items.map(i => ({ ...i, upgrade_difference: i.upgrade_difference ? { price: i.upgrade_difference.price } : null }));
  return safe;
}
export function proposal(b, settings) {
  return [`${settings.company}\nORÇAMENTO #${b.id.slice(0, 8)}`, `Cliente: ${b.customer.name}`, `Data: ${new Date(b.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, `\n${b.type}`, ...b.items.map(i => `• ${i.quantity}× ${i.category}: ${i.name}${i.replaces ? ` (substitui ${i.replaces})` : ''}`), `\nTotal: ${currency(b.final)}`, `Condição de pagamento: ${b.payment}`, b.included ? `Incluído:\n${b.included}` : '', settings.warranty ? `Garantia: ${settings.warranty}` : '', settings.proposal_text, '\nFalar com a Voltux', settings.contact].filter(Boolean).join('\n');
}
