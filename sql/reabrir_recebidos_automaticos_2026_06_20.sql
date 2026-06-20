update public.contas_receber cr
set
  status_recebimento = 'PENDENTE',
  valor_recebido = 0,
  data_recebimento = null,
  data_vencimento = coalesce((v.data_entrega at time zone 'America/Sao_Paulo')::date, (v.data_venda at time zone 'America/Sao_Paulo')::date, cr.data_vencimento),
  observacoes = trim(both ' -' from concat_ws(' - ', cr.observacoes, 'Reaberto: baixa automatica desfeita'))
from public.vendas v
where cr.id_venda = v.id_venda
  and v.status_entrega = 'ENTREGUE'
  and cr.status_recebimento = 'RECEBIDO'
  and upper(coalesce(cr.meio_pagamento, v.meio_pagamento, '')) in ('PIX','DINHEIRO','CARTAO')
  and (v.data_venda at time zone 'America/Sao_Paulo')::date = date '2026-06-20';

select
  cr.id_conta,
  v.codigo_venda,
  cr.meio_pagamento,
  cr.status_recebimento,
  cr.valor_original,
  cr.valor_recebido,
  cr.data_vencimento,
  cr.data_recebimento
from public.contas_receber cr
join public.vendas v on v.id_venda = cr.id_venda
where (v.data_venda at time zone 'America/Sao_Paulo')::date = date '2026-06-20'
order by cr.id_conta desc;
