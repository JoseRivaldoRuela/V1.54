-- Permite contas a receber manuais, sem venda vinculada.
-- Nao apaga nem altera os lancamentos existentes.
begin;

alter table public.contas_receber
  alter column id_venda drop not null;

comment on column public.contas_receber.id_venda is
  'Venda de origem. Nulo quando o titulo foi lancado manualmente.';

commit;

-- Conferencia da estrutura e das quantidades. Os totais existentes nao mudam.
select column_name,is_nullable
from information_schema.columns
where table_schema='public'
  and table_name='contas_receber'
  and column_name='id_venda';

select
  count(*) as total_titulos,
  count(*) filter (where id_venda is not null) as originados_de_venda,
  count(*) filter (where id_venda is null) as lancamentos_manuais
from public.contas_receber;
