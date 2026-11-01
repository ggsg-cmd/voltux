# Revisão da entrega local

Data: 14/09/2026.

## Resultado executado

- 20 testes do sistema interno aprovados: finanças, autorização, isolamento de clientes, descontos, aprovação, snapshots, senha, transações, persistência e restauração de backup.
- 6 testes da loja original aprovados. Seus arquivos não foram substituídos.
- Chrome real: configuração inicial, login de admin, cadastro de produto, orçamento com desconto, proposta/WhatsApp, follow-up e login de vendedor.
- As 9 telas foram verificadas nas larguras 320, 375, 768 e 1440 pixels, sem transbordamento horizontal do documento.
- Sem exceções JavaScript nos fluxos de navegador testados.
- Banco real iniciado vazio de produtos/clientes; só o administrador e as categorias iniciais foram criados. Dados fictícios dos testes usam bancos separados.
- Backup consistente da instalação local criado em `data/backups`.
- Servidor local respondeu HTTP 200; configuração inicial bloqueada depois da criação do administrador.

## Cobertura das regras críticas

| Regra | Evidência |
| --- | --- |
| Admin cadastra e edita custo, preço, mínimo, comissão e estoque | Testes API de produto e cadastro no navegador |
| Vendedor consulta produtos e cria orçamento | API e interface verificadas |
| Vendedor não altera dados estratégicos ou configurações | Retorno 403 nas rotas protegidas; campos extras rejeitados |
| Custo, margem e lucro não chegam ao vendedor | Projeções testadas em produto, orçamento, upgrade e dashboard |
| Cliente/orçamento de outro vendedor não é acessível | Lista, detalhe, edição, proposta e follow-up isolados |
| Desconto abaixo do mínimo é bloqueado | Testes do mínimo dos produtos e do limite global |
| Aprovação só pode ser decidida pelo admin | API testada; edição invalida aprovação antiga |
| Comissão, lucro e margem corretos | Exemplo de R$ 2.400, custo R$ 2.000 e comissão 2% testado |
| Proposta não contém campos financeiros internos | Conteúdo e URL WhatsApp testados |
| Follow-up salva, lista e conclui | API e cadastro no navegador |
| Perda exige motivo; venda fechada não é editável pelo vendedor | API testada |
| Usuário bloqueado perde acesso | Sessão existente e novo login rejeitados |
| Troca de senha exige senha atual | API testada; sessões antigas revogadas |
| CSRF, sessão e origem protegidos | Requisições inválidas rejeitadas |
| Arquivos privados não são publicados | Banco, `.env` e código servidor retornam 404 |
| Mudanças de catálogo preservam orçamento histórico | Snapshot verificado depois de editar produto |
| Banco reverte operações e permite restauração | Rollback, reabertura e integrity_check testados |

## Limites desta validação

WhatsApp foi validado pela proposta e URL gerada; nenhuma mensagem foi enviada a clientes. A responsividade foi emulada no Chrome, não testada em aparelhos físicos. A revisão e os testes não equivalem a uma auditoria externa de segurança ou ensaio de carga.

Compatibilidade automática, importação CSV/Excel e baixa automática de estoque são extensões preparadas e explicitamente não ativadas. O estoque atual é manual. Aprovação é do preço solicitado; não há limite temporário alternativo. A aplicação ainda não foi publicada para acesso externo. Detalhes operacionais estão no README.
