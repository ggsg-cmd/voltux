# Redesign visual Voltux — 11/11/2026

## Escopo aplicado

Direção aprovada: preto/grafite, ciano como assinatura e vermelho nos CTAs. Alterações na pasta pública `sites_clientes/voltux-cliente/`; a cópia aninhada `voltux/` não foi modificada. A origem da publicação ainda precisa ser confirmada antes de deploy.

- Hero com chamada e descrição claras, imagem separada do texto e composição empilhada no celular.
- Catálogo, serviços, sobre, FAQ, carrinho e rodapé com superfícies e tipografia consistentes.
- Atendimento flutuante com rótulo permanente e link real do WhatsApp, sem conversa simulada.
- Substituição dos blocos finais acumulados de efeitos por uma única seção de identidade Voltux no CSS. As regras estruturais anteriores continuam preservadas.
- Inicialização das partículas desativada; imagem principal com carregamento eager e prioridade alta.
- Preços, configuração comercial, regras do carrinho, catálogo externo e sistema interno preservados.

## Verificação realizada

Inspeção estática: nenhum ID duplicado, nenhuma âncora local sem destino e nenhum recurso local ausente no HTML. Chaves CSS balanceadas. Conferido o carregamento prioritário apenas no slot principal e preservados os seletores de integração existentes.

## Limites de validação

Node.js e Git não foram encontrados no PATH nem nos diretórios de instalação consultados. A suíte `node --test tests/loja.test.cjs` não foi executada. Não houve teste de navegador ou medição de desempenho; responsividade e interação precisam de validação visual antes de publicação.

A suíte existente espera preços anteriores (limpeza comum 69,99, premium 125 e montagem sob consulta), enquanto a configuração usa 95, 130 e 180. Esses dados não foram alterados por uma tarefa visual. Reconciliar as expectativas comerciais antes de considerar a suíte um critério de aprovação.

## Próxima validação

- Desktop e celular: navegação, cortes de imagem, leitura, atalhos e ausência de rolagem horizontal.
- Teclado: foco, carrinho, Escape e retorno ao acionador.
- Carrinho: adicionar, remover, quantidades, persistência e totalização.
- WhatsApp: telefone configurado, acentos e itens na mensagem.
- Catálogo externo e exportação do editor.
- Movimento reduzido e contraste.

Nenhum deploy, commit ou push foi realizado.

## Revisão imersiva — solicitação posterior do cliente

A direção foi refinada para priorizar fotografias de setups em tela cheia e reduzir textos auxiliares. A implementação anterior de cards no hero foi substituída por imagem de fundo com sobreposição de contraste. Os preços e as regras comerciais permanecem preservados.

- Logo do cabeçalho ampliada, com ajuste específico para celular.
- Carrinho identificado como carrinho de serviços; no celular o texto visual é abreviado para Serviços e o nome acessível permanece completo.
- CTA inicial abre diretamente o mesmo endereço de `VOLTUX_CONFIG.catalogoUrl` usado pelo CTA do catálogo.
- Hero sticky com ampliação progressiva da foto real do PC, acompanhando a rolagem. Catálogo e cuidados têm imagens em fundo com movimento discreto.
- Indicador fixo de seções: setup, catálogo, cuidados e lista de serviços. A seleção acompanha a rolagem; os links também permitem navegar.
- Rodapé VOLTUX em pontos: interação com ponteiro e onda ao clicar. Renderização pausada fora da tela ou com a aba oculta; movimento reduzido mostra resultado estático.
- `visual.js` contém os efeitos visuais e não depende das regras comerciais.

### Referências e limites

Referências fornecidas pelo usuário: Halftone Wordmark Footer, de kedhareswer, e Hero Scrub, de Jean Duthil, no 21st.dev. Código React/TypeScript fornecido nos anexos foi tratado como referência de integração. O site permanece em HTML/CSS/JavaScript; não houve instalação do shadcn, React, Tailwind ou GSAP.

O Hero Scrub original depende de uma sequência de quadros. Não existe sequência equivalente de um PC neste projeto. Esta adaptação usa zoom pela rolagem nas fotografias existentes, sem afirmar que há rotação 3D ou vídeo de produto.

### Validação real em Chrome headless

O ambiente permite Chrome headless fora do sandbox; foi usado perfil separado em `.preview`, sem acessar o perfil pessoal.

Confirmado em desktop 1440x1000 e emulação mobile 390x844:
- Sem rolagem horizontal e sem exceções JavaScript observadas.
- Seis cards de serviços renderizados; imagens carregadas sem falhas detectadas.
- Ambos os botões do catálogo usam o mesmo endereço configurado.
- Adição de serviço, abertura do carrinho, presença do item e geração do endereço WhatsApp funcionando.
- Indicador mudou para Cuidados após navegação à seção.
- Canvas do rodapé gerado.
- Movimento reduzido remove o hero estendido e a transformação da foto.
- Cabeçalho mobile corrigido e medido em 90 px após nova validação.

Capturas e relatório: `.preview/immersive-desktop.png`, `immersive-mobile.png`, `immersive-care.png`, `immersive-footer.png` e `immersive-validation.json`. O helper `.preview/verify-immersive.ps1` permite repetir a verificação no Chrome instalado. Os testes unitários Node continuam não executados. Não foram enviados pedidos ou mensagens ao WhatsApp. Nenhum deploy realizado.

### Briefing reutilizável

“Priorizar fotografias reais de setups em tela cheia, com contraste para títulos grandes e CTAs. Usar movimento associado à rolagem sem bloquear a navegação. Separar visualmente setup, catálogo, cuidados e serviços; indicar a seção ativa. Manter preto/grafite, ciano e vermelho, carrinho exclusivo de serviços e catálogo externo. Preservar acessibilidade, conteúdo comercial e modo de movimento reduzido.”

## Galerias no editor

`imagens` aceita caminho único (retrocompatível) ou array ordenado de caminhos por área. O editor exibe uma linha por foto e exporta string para uma foto ou array para várias. `intervaloFotos` opcional: inteiro de 3 a 30 segundos, padrão 6. Até 12 imagens únicas por área; validação compartilhada em loja-core.js.

`galerias.js` faz a transição com duas camadas de imagem, pula falhas nas fotos seguintes e oferece pausa e avanço. O autoplay respeita visibilidade da área/aba, foco/ponteiro nos controles e movimento reduzido. A configuração real de fotos e preços não foi alterada.

Teste real de navegador com configuração temporária injetada em memória: troca automática para 2/2, pausa manteve a foto, avanço manual voltou a 1/2; editor recuperou duas linhas e exportou ambas sem erro, preservando seis serviços. Configuração inválida rejeitada. Nenhuma exceção JS observada e nenhum overflow mobile a 390px. Relatório em `.preview/gallery-validation.json`; helper `.preview/verify-gallery.ps1`. Não houve deploy.
