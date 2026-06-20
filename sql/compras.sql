create table if not exists public.compras (
  id_compra bigserial primary key,
  codigo_compra text,
  id_fornecedor bigint not null,
  id_produto bigint,
  data_compra timestamptz not null default now(),
  quantidade numeric(12,2),
  preco_entrada numeric(12,2),
  valor_total numeric(12,2) not null,
  meio_pagamento text,
  prazo_dias integer not null default 0,
  data_vencimento date,
  status_compra text not null default 'PENDENTE',
  estoque_anterior numeric(12,2),
  estoque_atual numeric(12,2),
  observacoes text,
  data_cadastro timestamptz not null default now(),
  constraint chk_compras_quantidade check (quantidade > 0),
  constraint chk_compras_preco_entrada check (preco_entrada >= 0),
  constraint chk_compras_prazo check (prazo_dias >= 0),
  constraint chk_compras_status check (status_compra in ('PENDENTE','LIBERADA','CANCELADA'))
);

create table if not exists public.compra_itens (
  id_item_compra bigserial primary key,
  id_compra bigint not null,
  id_produto bigint not null,
  quantidade numeric(12,2) not null,
  preco_entrada numeric(12,2) not null,
  subtotal numeric(12,2) not null,
  estoque_anterior numeric(12,2),
  estoque_atual numeric(12,2),
  preco_custo_atualizado numeric(12,2),
  preco_venda_atualizado numeric(12,2),
  data_cadastro timestamptz not null default now(),
  constraint chk_compra_itens_quantidade check (quantidade > 0),
  constraint chk_compra_itens_preco check (preco_entrada >= 0)
);

create table if not exists public.contas_pagar (
  id_conta_pagar bigserial primary key,
  id_compra bigint,
  id_fornecedor bigint,
  data_vencimento date,
  valor_original numeric(12,2) not null default 0,
  valor_pago numeric(12,2),
  meio_pagamento text,
  status_pagamento text not null default 'PENDENTE',
  data_pagamento timestamptz,
  observacoes text,
  data_cadastro timestamptz not null default now(),
  constraint chk_contas_pagar_status check (status_pagamento in ('PENDENTE','PAGO','CANCELADO'))
);

alter table public.compras
  add column if not exists codigo_compra text,
  add column if not exists id_fornecedor bigint,
  add column if not exists id_produto bigint,
  add column if not exists data_compra timestamptz not null default now(),
  add column if not exists quantidade numeric(12,2),
  add column if not exists preco_entrada numeric(12,2),
  add column if not exists valor_total numeric(12,2),
  add column if not exists meio_pagamento text,
  add column if not exists prazo_dias integer not null default 0,
  add column if not exists data_vencimento date,
  add column if not exists status_compra text not null default 'PENDENTE',
  add column if not exists estoque_anterior numeric(12,2),
  add column if not exists estoque_atual numeric(12,2),
  add column if not exists observacoes text,
  add column if not exists data_cadastro timestamptz not null default now();

alter table public.compras
  alter column id_produto drop not null,
  alter column quantidade drop not null,
  alter column preco_entrada drop not null;

alter table public.compra_itens
  add column if not exists id_compra bigint,
  add column if not exists id_produto bigint,
  add column if not exists quantidade numeric(12,2),
  add column if not exists preco_entrada numeric(12,2),
  add column if not exists subtotal numeric(12,2),
  add column if not exists estoque_anterior numeric(12,2),
  add column if not exists estoque_atual numeric(12,2),
  add column if not exists preco_custo_atualizado numeric(12,2),
  add column if not exists preco_venda_atualizado numeric(12,2),
  add column if not exists data_cadastro timestamptz not null default now();

alter table public.contas_pagar
  add column if not exists id_compra bigint,
  add column if not exists id_fornecedor bigint,
  add column if not exists data_vencimento date,
  add column if not exists valor_original numeric(12,2) not null default 0,
  add column if not exists valor_pago numeric(12,2),
  add column if not exists meio_pagamento text,
  add column if not exists status_pagamento text not null default 'PENDENTE',
  add column if not exists data_pagamento timestamptz,
  add column if not exists observacoes text,
  add column if not exists data_cadastro timestamptz not null default now();

create index if not exists idx_compras_fornecedor on public.compras(id_fornecedor);
create index if not exists idx_compras_produto on public.compras(id_produto);
create index if not exists idx_compras_status on public.compras(status_compra);
create index if not exists idx_compra_itens_compra on public.compra_itens(id_compra);
create index if not exists idx_compra_itens_produto on public.compra_itens(id_produto);
create index if not exists idx_contas_pagar_compra on public.contas_pagar(id_compra);
create index if not exists idx_contas_pagar_vencimento on public.contas_pagar(data_vencimento);

alter table public.compras no force row level security;
alter table public.compra_itens no force row level security;
alter table public.contas_pagar no force row level security;
alter table public.compras disable row level security;
alter table public.compra_itens disable row level security;
alter table public.contas_pagar disable row level security;

drop policy if exists compras_anon_all on public.compras;
drop policy if exists compras_auth_all on public.compras;
drop policy if exists compra_itens_anon_all on public.compra_itens;
drop policy if exists compra_itens_auth_all on public.compra_itens;
drop policy if exists contas_pagar_anon_all on public.contas_pagar;
drop policy if exists contas_pagar_auth_all on public.contas_pagar;

create policy compras_anon_all
  on public.compras
  for all
  to anon
  using (true)
  with check (true);

create policy compras_auth_all
  on public.compras
  for all
  to authenticated
  using (true)
  with check (true);

create policy compra_itens_anon_all
  on public.compra_itens
  for all
  to anon
  using (true)
  with check (true);

create policy compra_itens_auth_all
  on public.compra_itens
  for all
  to authenticated
  using (true)
  with check (true);

create policy contas_pagar_anon_all
  on public.contas_pagar
  for all
  to anon
  using (true)
  with check (true);

create policy contas_pagar_auth_all
  on public.contas_pagar
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.compras to anon, authenticated;
grant select, insert, update, delete on public.compra_itens to anon, authenticated;
grant select, insert, update, delete on public.contas_pagar to anon, authenticated;
grant usage, select on sequence compras_id_compra_seq to anon, authenticated;
grant usage, select on sequence compra_itens_id_item_compra_seq to anon, authenticated;
grant usage, select on sequence contas_pagar_id_conta_pagar_seq to anon, authenticated;
