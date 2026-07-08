create table if not exists public.contas_receber_baixas (
  id_baixa bigserial primary key,
  id_conta bigint not null references public.contas_receber(id_conta) on delete cascade,
  id_cliente bigint references public.clientes(id_cliente),
  valor_baixa numeric(12,2) not null check (valor_baixa > 0),
  data_baixa timestamptz not null default now(),
  meio_pagamento text,
  observacoes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_contas_receber_baixas_conta
  on public.contas_receber_baixas(id_conta);

create index if not exists idx_contas_receber_baixas_cliente_data
  on public.contas_receber_baixas(id_cliente, data_baixa desc);

grant select, insert, update, delete on public.contas_receber_baixas to anon, authenticated;
grant usage, select on sequence public.contas_receber_baixas_id_baixa_seq to anon, authenticated;
