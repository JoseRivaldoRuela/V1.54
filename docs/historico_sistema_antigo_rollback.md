# Historico do sistema antigo

Lote: `HIST-ANTIGO-20220829`

O lote contem 50 resumos mensais, de 2022-03 a 2026-04. Os dados ficam isolados em
`js/historico_mensal.js`: nao criam vendas, clientes, produtos, contas ou movimentos
de estoque no banco de dados.

O arquivo `WhatsApp Image 2026-08-29 at 09.41.40.jpeg` foi ignorado por ser uma copia
exata de `042026.jpeg` (SHA-256
`D88C697759401E785F8CDEC31A5452F5DA9E4AC46FD3C17E41A72754539F2E03`).

## Como desfazer

1. Remover a tag `<script src="js/historico_mensal.js"></script>` de `index.html`.
2. Remover as funcoes e combinacoes marcadas por `historicoMensalVendas` em
   `js/vendas.js`.
3. Opcionalmente remover `js/historico_mensal.js`.

Como nenhuma tabela operacional foi alterada, o rollback nao exige exclusao no banco
e nao afeta dados cadastrados depois da importacao.
