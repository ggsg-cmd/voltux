(() => {
  'use strict';
  const original = window.VOLTUX_CONFIG;
  const core = window.VoltuxCore;
  const form = document.getElementById('config-form');
  const status = document.getElementById('admin-status');
  let rowCounter = 0;
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function field(parent, title, key, value, type = 'text') {
    const label = element('label', '', title);
    const input = element(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') input.type = type;
    input.dataset.field = key;
    input.value = value ?? '';
    input.maxLength = type === 'textarea' ? 500 : 500;
    if (key === 'nome') { input.required = true; input.maxLength = 120; }
    label.append(input);
    parent.append(label);
    return input;
  }
  function checkbox(parent, title, key, checked) {
    const label = element('label', 'checkbox-label');
    const input = element('input');
    input.type = 'checkbox';
    input.dataset.field = key;
    input.checked = Boolean(checked);
    label.append(input, document.createTextNode(title));
    parent.append(label);
    return input;
  }
  function addRow(item, service) {
    const row = element('fieldset', 'editor-item');
    row.dataset.id = item.id;
    row.dataset.type = service ? 'servico' : 'produto';
    row.append(element('legend', '', service ? 'Serviço' : 'Produto'));
    field(row, 'Nome', 'nome', item.nome);
    field(row, 'Descrição curta', 'descricao', item.descricao, 'textarea');
    if (!service) field(row, 'Categoria', 'categoria', item.categoria);
    let price;
    let consult;
    let from;
    if (service) {
      const priceRow = element('div', 'editor-row');
      price = field(priceRow, 'Preço em reais', 'preco', item.preco, 'number');
      price.min = '0'; price.max = '10000000'; price.step = '0.01'; price.inputMode = 'decimal';
      consult = checkbox(priceRow, 'Sob consulta', 'consulta', item.preco === null);
      row.append(priceRow);
      field(row, 'Complemento do preço (opcional)', 'observacaoPreco', item.observacaoPreco || '');
      from = checkbox(row, 'Exibir “A partir de”', 'aPartirDe', item.aPartirDe);
    }
    field(row, 'Imagem: caminho do arquivo ou URL', 'imagem', item.imagem);
    const bottom = element('div', 'editor-bottom');
    const preview = element('span', 'price-preview', service ? '' : 'Sem preço no site');
    const remove = element('button', 'delete-row', 'Excluir da lista');
    remove.type = 'button';
    remove.addEventListener('click', () => { row.remove(); status.textContent = 'Lista alterada. Baixe a configuração para aplicar.'; });
    bottom.append(preview, remove);
    row.append(bottom);
    if (service) {
      const updatePrice = () => {
        price.disabled = consult.checked;
        price.required = !consult.checked;
        preview.textContent = consult.checked ? 'Sob consulta' : (price.value !== '' && price.validity.valid ? core.formatPrice({ preco: Number(price.value), aPartirDe: from.checked }) : 'Informe o preço');
      };
      row.addEventListener('input', updatePrice);
      updatePrice();
    }
    document.getElementById(service ? 'service-editor' : 'product-editor').append(row);
    return row;
  }
  document.getElementById('setting-whatsapp').value = original.whatsapp;
  document.getElementById('setting-catalog').value = original.catalogoUrl;
  document.getElementById('setting-instagram').value = original.instagram;
  document.getElementById('setting-image-hero').value = core.imageSources(original.imagens?.hero).join('\n');
  document.getElementById('setting-image-catalog').value = core.imageSources(original.imagens?.catalogo).join('\n');
  document.getElementById('setting-image-services').value = core.imageSources(original.imagens?.servicos).join('\n');
  document.getElementById('setting-image-about').value = core.imageSources(original.imagens?.sobre).join('\n');
  document.getElementById('setting-image-footer').value = core.imageSources(original.imagens?.rodape).join('\n');
  document.getElementById('setting-image-interval').value = original.intervaloFotos || 6;
  const readImages = id => { const sources = core.imageSources(document.getElementById(id).value); return sources.length > 1 ? sources : sources[0] || ''; };
  const locationSection=element('section','admin-section');locationSection.id='location-editor';locationSection.append(element('h2','','Localização com globo e satélite'));
  locationSection.append(element('p','admin-help','Informe o endereço. Coordenadas exatas são opcionais e devem ser confirmadas no Maps. Para o satélite dentro do site, cole uma URL de incorporação do Google Maps ou uma chave restrita à Maps Embed API.'));
  const locationFields=element('div','admin-settings');
  for(const [key,label,type] of [['address','Endereço completo'],['lat','Latitude exata','number'],['lng','Longitude exata','number'],['embedUrl','URL de incorporação Google Maps (somente src)','url'],['googleMapsKey','Chave pública Maps Embed API (opcional)']]){const input=field(locationFields,label,key,original.localizacao?.[key],type);input.maxLength=5000;if(type==='number')input.step='any';}
  locationSection.append(locationFields);form.querySelector('.admin-section').after(locationSection);
  original.servicos.forEach(item => addRow(item, true));
  function newId(prefix) { return `${prefix}-${Date.now().toString(36)}-${++rowCounter}`; }
  document.getElementById('add-service').addEventListener('click', () => {
    const row = addRow({ id: newId('servico'), nome: '', descricao: '', preco: null, aPartirDe: false, imagem: '' }, true);
    row.querySelector('input').focus();
  });
  function readRow(row, service) {
    const value = key => row.querySelector(`[data-field="${key}"]`).value.trim();
    const item = { id: row.dataset.id, nome: value('nome'), descricao: value('descricao'), imagem: value('imagem') };
    if (service) {
      item.preco = row.querySelector('[data-field="consulta"]').checked ? null : Number(value('preco'));
      item.observacaoPreco = value('observacaoPreco');
      item.aPartirDe = row.querySelector('[data-field="aPartirDe"]').checked;
    } else item.categoria = value('categoria') || 'Outros';
    return item;
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const config = {
      versao: 1,
      localizacao:Object.fromEntries([...locationFields.querySelectorAll('input')].map(input=>[input.dataset.field,['lat','lng'].includes(input.dataset.field)?(input.value===''?null:Number(input.value)):input.value.trim()])),
      intervaloFotos: Number(document.getElementById('setting-image-interval').value),
      whatsapp: document.getElementById('setting-whatsapp').value.trim(),
      instagram: document.getElementById('setting-instagram').value.trim(),
      catalogoUrl: document.getElementById('setting-catalog').value.trim(),
      imagens: {
        hero: readImages('setting-image-hero'),
        catalogo: readImages('setting-image-catalog'),
        servicos: readImages('setting-image-services'),
        sobre: readImages('setting-image-about'),
        rodape: readImages('setting-image-footer')
      },
      produtos: [],
      servicos: [...document.querySelectorAll('#service-editor .editor-item')].map(row => readRow(row, true))
    };
    const errors = core.validateConfig(config);
    status.classList.toggle('is-error', errors.length > 0);
    if (errors.length) { status.textContent = errors.join('\n'); return; }
    const source = '// Configuração da Voltux. Gerada pelo editor local.\nwindow.VOLTUX_CONFIG = ' + JSON.stringify(config, null, 2) + ';\n';
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript;charset=utf-8' }));
    const link = element('a');
    link.href = url;
    link.download = 'loja-config.js';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    status.textContent = 'Configuração baixada. Substitua loja-config.js na pasta do site por este arquivo e recarregue a página. Se houver hospedagem, publique também o arquivo atualizado.';
  });
})();

