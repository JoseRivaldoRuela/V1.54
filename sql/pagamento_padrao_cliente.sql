alter table public.clientes
  add column if not exists meio_pagamento_padrao text,
  add column if not exists parcelas_padrao integer;

alter table public.vendas
  add column if not exists quantidade_parcelas integer;
