update public.contas_receber cr
set
  data_vencimento = coalesce((v.data_entrega at time zone 'America/Sao_Paulo')::date, (v.data_venda at time zone 'America/Sao_Paulo')::date, current_date),
  status_recebimento = 'RECEBIDO',
  valor_recebido = coalesce(nullif(cr.valor_recebido, 0), cr.valor_original),
  data_recebimento = coalesce(v.data_entrega, v.data_venda, now()),
  observacoes = trim(both ' -' from concat_ws(' - ', cr.observacoes, 'Baixado automaticamente: venda entregue com PIX'))
from public.vendas v
where cr.id_venda = v.id_venda
  and upper(coalesce(cr.meio_pagamento, v.meio_pagamento, '')) = 'PIX'
  and v.status_entrega = 'ENTREGUE'
  and cr.status_recebimento <> 'RECEBIDO';

select
  cr.id_conta,
  v.codigo_venda,
  cr.status_recebimento,
  cr.valor_original,
  cr.valor_recebido,
  cr.data_recebimento
from public.contas_receber cr
join public.vendas v on v.id_venda = cr.id_venda
where upper(coalesce(cr.meio_pagamento, v.meio_pagamento, '')) = 'PIX'
  and v.status_entrega = 'ENTREGUE'
order by cr.id_conta desc;
