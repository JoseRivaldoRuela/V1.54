-- Identifica grupos e parcelas de contas a receber/pagar.
-- Preserva integralmente todos os lancamentos existentes.
begin;

create extension if not exists pgcrypto;

alter table public.contas_receber
  add column if not exists grupo_parcelamento uuid,
  add column if not exists numero_parcela integer not null default 1,
  add column if not exists total_parcelas integer not null default 1,
  add column if not exists valor_total_titulo numeric(14,2);

alter table public.contas_pagar
  add column if not exists grupo_parcelamento uuid,
  add column if not exists numero_parcela integer not null default 1,
  add column if not exists total_parcelas integer not null default 1,
  add column if not exists valor_total_titulo numeric(14,2);

-- Registros antigos recebem grupo individual. Contas originadas da mesma venda
-- ou compra recebem o mesmo grupo, sem mudar valores, status ou vencimentos.
update public.contas_receber
set grupo_parcelamento=coalesce(grupo_parcelamento,gen_random_uuid()),
    valor_total_titulo=coalesce(valor_total_titulo,valor_original)
where grupo_parcelamento is null or valor_total_titulo is null;

update public.contas_pagar
set grupo_parcelamento=coalesce(grupo_parcelamento,gen_random_uuid()),
    valor_total_titulo=coalesce(valor_total_titulo,valor_original)
where grupo_parcelamento is null or valor_total_titulo is null;

-- Reconhece parcelas antigas originadas da mesma venda/compra.
with grupos as (
  select id_conta,
         min(grupo_parcelamento::text) over(partition by empresa_id,id_venda)::uuid as grupo,
         row_number() over(partition by empresa_id,id_venda order by data_vencimento,id_conta) as numero,
         count(*) over(partition by empresa_id,id_venda) as total,
         sum(valor_original) over(partition by empresa_id,id_venda) as valor_total
  from public.contas_receber where id_venda is not null
)
update public.contas_receber c
set grupo_parcelamento=g.grupo,numero_parcela=g.numero,total_parcelas=g.total,valor_total_titulo=g.valor_total
from grupos g where g.id_conta=c.id_conta;

with grupos as (
  select id_conta_pagar,
         min(grupo_parcelamento::text) over(partition by empresa_id,id_compra)::uuid as grupo,
         row_number() over(partition by empresa_id,id_compra order by data_vencimento,id_conta_pagar) as numero,
         count(*) over(partition by empresa_id,id_compra) as total,
         sum(valor_original) over(partition by empresa_id,id_compra) as valor_total
  from public.contas_pagar where id_compra is not null
)
update public.contas_pagar c
set grupo_parcelamento=g.grupo,numero_parcela=g.numero,total_parcelas=g.total,valor_total_titulo=g.valor_total
from grupos g where g.id_conta_pagar=c.id_conta_pagar;

alter table public.contas_receber alter column grupo_parcelamento set default gen_random_uuid();
alter table public.contas_pagar alter column grupo_parcelamento set default gen_random_uuid();

create index if not exists contas_receber_grupo_idx on public.contas_receber(empresa_id,grupo_parcelamento);
create index if not exists contas_pagar_grupo_idx on public.contas_pagar(empresa_id,grupo_parcelamento);

commit;
