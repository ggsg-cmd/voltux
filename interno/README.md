# Voltux · Sistema interno comercial

Aplicação independente em `interno/`. A loja pública, o carrinho, o catálogo externo e o editor `admin.html` original permanecem intactos. Esse editor antigo continua sendo apenas um exportador de configuração do site; não administra o banco interno.

## Acesso local

Execute `iniciar.ps1` no PowerShell, dentro desta pasta. Abra **http://127.0.0.1:3100**. O processo deve permanecer em execução. O endereço é acessível neste computador; não é um link publicado na internet.

No primeiro acesso, informe o token de configuração definido no `.env` e escolha seu nome, e-mail e senha (mínimo 12 caracteres). O token deixa de funcionar assim que o primeiro administrador é criado. Remova `SETUP_TOKEN` do ambiente depois disso. Não há senha padrão nem contas de demonstração no banco real.

O administrador cadastra os vendedores em **Usuários**. Ali pode alterar dados, bloquear e redefinir a senha. Alterações de acesso revogam as sessões anteriores. Senhas são armazenadas exclusivamente como hashes scrypt com salt aleatório. O ambiente de exemplo contém apenas placeholders.

Todos os usuários podem trocar sua própria senha em **Minha senha**, informando a senha atual. A alternativa de configuração pelo terminal é `node setup-local.mjs [email-do-admin]`: gera uma senha aleatória, mostra uma única vez e grava somente o hash no banco. O comando se recusa a alterar uma instalação que já tenha usuários.

## Execução em outro ambiente

Requer Node.js 24.14 ou superior, com `node:sqlite` disponível. Não há dependências npm externas. A API SQLite desse runtime ainda emite aviso de recurso experimental; valide a versão antes de atualizar a instalação.

1. Copie `.env.example` para `.env` e defina um `SETUP_TOKEN` aleatório com pelo menos 32 caracteres.
2. Execute `node --env-file-if-exists=.env server.mjs`.
3. Configure o primeiro administrador no navegador.

Em produção, use um servidor com armazenamento persistente e proxy HTTPS. Configure `NODE_ENV=production`, `APP_ORIGIN=https://seu-dominio` e faça o proxy preservar o Host. A aplicação rejeita origens e hosts diferentes do configurado. Cookies em produção têm `Secure`; as sessões duram oito horas. Não publique esta pasta inteira como arquivos estáticos. O servidor fornece somente HTML, CSS, JavaScript e logo por uma lista explícita.

## Fluxo comercial

1. Admin cadastra produtos, custos, preços, mínimos, comissões e estoque. As 19 categorias iniciais já estão disponíveis.
2. Vendedor cria orçamento, informa cliente/necessidade, pesquisa itens, quantidades e desconto.
3. O servidor consulta o catálogo e calcula os valores. Campos financeiros enviados indevidamente na requisição são recusados.
4. Acima do mínimo, pode gerar proposta. Abaixo do mínimo, só salva como rascunho mediante **Solicitar aprovação**, com motivo obrigatório.
5. Admin aprova ou recusa em **Aprovações**. A aprovação vale apenas para aquele orçamento e conteúdo. Editar os itens ou condições invalida a autorização anterior e retorna o orçamento para rascunho.
6. Gere a proposta, copie ou abra o WhatsApp. A mensagem precisa ser enviada pelo usuário; a aplicação não envia automaticamente. Depois, altere o status e agende o contato.
7. Ao fechar, os indicadores passam a reconhecer faturamento, comissão e lucro. Perdas exigem motivo. Vendedores não reabrem nem editam orçamentos encerrados; admin pode fazê-lo, com auditoria.

O catálogo e o resumo mostram ao vendedor o mínimo comercial, mas nunca custo, comissão configurada, lucro ou margem. A proposta usa uma lista explícita de campos e não inclui nem o preço mínimo. A comissão dos indicadores é reconhecida em vendas fechadas; a comissão de um orçamento aberto é uma estimativa.

## Regras financeiras

- Dinheiro: centavos inteiros. Percentuais configuráveis: pontos-base (`200 = 2%`).
- `normal`: preço normal × quantidade; `discount`: desconto total; `final`: faturamento proposto.
- `cost`: custo total; `commission`: comissão sobre a venda final, rateada por item.
- `gross_profit = final - cost`.
- `net_profit = final - cost - commission`.
- `margin = net_profit / final × 100`, margem após comissão sobre venda.
- O desconto é rateado proporcionalmente pelo método do maior resto; aritmética BigInt evita perda de centavos no rateio.
- Mínimo do orçamento: maior entre a soma dos mínimos dos produtos e o piso decorrente do desconto máximo global.
- Margem mínima configurada é verificada nos próximos cadastros/edições de produto. Mudar essa regra não reescreve preços existentes.
- Comissão da categoria é padrão para novos produtos; cada produto preserva seu percentual próprio.
- Edições de orçamento usam preços atuais do catálogo. Orçamentos sem edição preservam seus snapshots, inclusive custo e comissão.

Upgrade permite comparar a peça nova com uma peça cadastrada anterior. A diferença de preço, custo e lucro bruto é armazenada na linha; o vendedor recebe apenas a diferença comercial. O total cobra os itens novos. A comparação **não** concede crédito por peça usada nem implementa recompra. Não existe uma regra de recompra cadastrada.

## Arquitetura e integridade

- `server.mjs`: HTTP, autenticação, autorização, validação, rotas e operações transacionais.
- `domain.mjs`: cálculos, projeções permitidas e proposta.
- `db.mjs`: schema SQLite, relações, índices, WAL e categorias iniciais.
- `public/`: interface responsiva, sem frameworks, conteúdo não confiável renderizado por `textContent`.
- `tests/system.test.mjs`: testes de API e regras financeiras.
- `tests/browser.mjs`: teste real no Chrome, banco em memória e credenciais aleatórias descartáveis.

Tabelas: users, sessions, categories, products, customers, budgets, budget_items, approvals, followups, audit_logs, settings, compatibility_rules, stock_movements e import_jobs. Clientes pertencem ao vendedor e são registrados por orçamento, evitando que a edição de outro atendimento altere o cliente de uma proposta histórica. SQLite usa chaves estrangeiras, índices, queries parametrizadas e transações nas alterações críticas. Produtos são desativados, preservando referências.

O servidor protege APIs por sessão, função e proprietário, valida origens/CSRF, limita corpo e frequência de requisições, usa CSP e não expõe arquivos de banco ou ambiente. O limite de login usa o endereço de conexão, sem confiar em `X-Forwarded-For`; atrás de proxy ele é compartilhado pelos usuários. Ajuste essa política com proxies confiáveis quando ampliar a instalação. Esta versão usa um processo e uma instância de banco; não é uma arquitetura distribuída.

## Backup e restauração

Execute `node --env-file-if-exists=.env backup.mjs`. A API de backup SQLite cria uma cópia consistente em `data/backups/`, inclusive com o servidor ativo. Agende esse comando no ambiente de hospedagem, copie os backups para armazenamento privado externo e defina retenção. O backup local sozinho não protege contra perda do computador.

Para restaurar: pare o servidor, preserve a pasta `data` atual como uma cópia completa, coloque o backup como `voltux.sqlite` em uma pasta de dados nova e configure `DB_PATH` para ela. Inicie e valide o acesso. Não sobreponha um banco com arquivos WAL antigos ainda em uso. Backups contêm dados de clientes e hashes de acesso; restrinja as permissões e use criptografia do disco/armazenamento.

## Validação

```
node --test tests/system.test.mjs
node tests/browser.mjs
```

O teste de navegador usa o Chrome instalado no caminho padrão do Windows. Ele cria um perfil separado em `.preview` e não acessa o perfil pessoal. Relatório e screenshots ficam nessa pasta ignorada pelo Git.

## Extensões preparadas, ainda não ativadas

- Compatibilidade: tabela de regras e campo de especificações; nenhuma compatibilidade é afirmada automaticamente.
- Estoque: alterações manuais auditadas e tabela de movimentos. Fechamento **não** baixa estoque nem faz reserva.
- CSV/Excel: tabela de jobs e caminho de validação de produtos preparado; tela de importação ainda não implementada. A futura importação deve ter prévia, erros por linha e commit transacional explícito.
- Aprovação: aprova ou recusa o preço exato solicitado; limite temporário alternativo ainda não implementado.
- Hospedagem pública, automações externas e agendamento do backup dependem da infraestrutura escolhida; não estão publicados por esta entrega local.
