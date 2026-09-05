# Scripts do banco

Os arquivos desta pasta sao executados manualmente no Supabase. O aplicativo
nao executa estes SQLs ao iniciar.

Mantenha os scripts que definem tabelas, funcoes, permissoes, seguranca e
integracoes: eles documentam a estrutura e ajudam na manutencao do banco.
As consultas de auditoria, backup e recalculo tambem sao ferramentas reutilizaveis.
Esta pasta nao representa uma sequencia automatica de migracoes; nao execute
todos os arquivos em lote.

## Correcoes pendentes de confirmacao

- `corrigir_passione_itau_carteira_2026_09.sql`: ajuste preparado para os
  recebimentos da Passione. A execucao no banco ainda nao foi confirmada.
- `corrigir_bloqueio_estoque_produto_inativo.sql` e
  `produtos_faturar_sem_saldo.sql`: scripts locais preservados; aplicacao no
  banco nao verificada nesta limpeza.

## Limpeza de 05/09/2026

Foram retirados da pasta os lotes fixos de importacao de maio/junho de 2026,
as correcoes de desconto de 02/07 e recebidos de 20/06, a unificacao especifica
Via Sale/Via Salle e a rotina de zerar transacoes. Sao operacoes pontuais,
sem chamadas no aplicativo; a limpeza nao confirma sua execucao no banco.
As versoes removidas continuam recuperaveis pelo historico Git.

A consulta `conferir_baixas_passione.sql` tambem foi retirada: seu resultado
ja foi recebido e utilizado para preparar a correcao acima.
