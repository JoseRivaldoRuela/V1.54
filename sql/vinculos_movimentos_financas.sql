-- Vincula vendas/compras e seus títulos aos movimentos do sistema Finanças.
begin;

alter table public.vendas add column if not exists id_conta_financas bigint;
alter table public.compras add column if not exists id_conta_financas bigint;
alter table public.contas_receber add column if not exists id_conta_financas bigint;
alter table public.contas_receber add column if not exists id_movimento_financas bigint;
alter table public.contas_pagar add column if not exists id_conta_financas bigint;
alter table public.contas_pagar add column if not exists id_movimento_financas bigint;

create unique index if not exists contas_receber_movimento_financas_uidx
  on public.contas_receber(empresa_id,id_movimento_financas)
  where id_movimento_financas is not null;

create unique index if not exists contas_pagar_movimento_financas_uidx
  on public.contas_pagar(empresa_id,id_movimento_financas)
  where id_movimento_financas is not null;

commit;
select pg_notify('pgrst','reload schema');
