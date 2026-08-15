-- Execute no SQL Editor do Supabase antes de importar notas fiscais.
begin;

alter table public.compras add column if not exists tipo_entrada text not null default 'BASICA';
alter table public.compras add column if not exists numero_nota text;
alter table public.compras add column if not exists chave_nfe text;
alter table public.compras add column if not exists dados_nfe jsonb;
alter table public.compras add column if not exists xml_nfe text;
alter table public.compras add column if not exists impostos_nfe jsonb;

update public.compras set tipo_entrada='BASICA' where tipo_entrada is null;

alter table public.compras drop constraint if exists compras_tipo_entrada_check;
alter table public.compras add constraint compras_tipo_entrada_check
  check (tipo_entrada in ('BASICA','NOTA_FISCAL'));

create unique index if not exists compras_chave_nfe_idx
  on public.compras(empresa_id,chave_nfe) where chave_nfe is not null;

commit;

select pg_notify('pgrst','reload schema');
