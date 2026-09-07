# Atualizar a Voltux

1. Abra `admin.html` no navegador.
2. Altere preços, textos, imagens principais, fotos dos serviços ou o link do catálogo. “Sob consulta” deixa o serviço sem preço fixo.
3. Clique em **Baixar loja-config.js** e substitua o arquivo de mesmo nome na pasta do site. Se o navegador acrescentar `(1)` ao nome, renomeie para `loja-config.js`.
4. Recarregue `index.html`. Se o site já estiver publicado, envie também o novo arquivo para a hospedagem.

O editor gera um arquivo local; não grava alterações na hospedagem automaticamente. Não existe painel com acesso de escrita ao servidor nem login de clientes.

Também é possível editar `loja-config.js` diretamente. Os preços são números em reais, com ponto decimal: `69.99`. Use `null` para “Sob consulta”. A troca de peça exibe o valor definido no admin e o complemento “+ valor da peça”. A vitrine do site contém apenas serviços; os produtos ficam no catálogo externo.

A logo do site está em `assets/logo-voltux.png`. Quando tiver a PNG sem fundo, substitua esse arquivo mantendo o mesmo nome. As imagens principais são editadas no admin: uma preenche o espaço ao lado de “Seu próximo nível” e a outra preenche o espaço do catálogo. As fotos dos serviços estão em `assets/servicos/`; para trocá-las, informe os caminhos no editor. As fontes estão no arquivo `CREDITOS.md` dessa pasta.

O carrinho guarda apenas identificadores e quantidades no navegador. O botão de finalizar abre uma mensagem com itens, quantidades e preços de serviços no WhatsApp da Voltux. O cliente confere e envia a mensagem. Peças são orçadas na conversa. Itens de produtos de carrinhos antigos são descartados; os serviços são preservados.

O catálogo externo abre no VendaMax. Seu carrinho não é sincronizado automaticamente com o carrinho do site; o cliente também pode enviar o nome ou link do produto diretamente pelo WhatsApp.

O site não tem login de cliente, não recebe pagamento e não salva dados em servidor. A finalização abre o WhatsApp com a mensagem pronta. O HTML usa uma política de segurança para bloquear scripts externos, formulários e objetos incorporados. Quando publicar, use hospedagem com HTTPS para o selo “Site seguro” ficar coerente com o endereço do navegador. Na hospedagem, ative também cabeçalhos como `X-Frame-Options: DENY` ou `Content-Security-Policy: frame-ancestors 'none'`.

Os atalhos flutuantes ficam no canto inferior direito: Instagram em cima e WhatsApp embaixo. O WhatsApp aparece pequeno e mostra o texto quando o visitante passa o mouse ou navega pelo teclado.

Montagem de PC e instalação de programas ficaram sob consulta. Atualize seus preços no editor quando definidos.
