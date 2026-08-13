alter table public.compras
  add column if not exists quantidade_parcelas integer not null default 1,
  add column if not exists dias_vencimento integer not null default 0;

alter table public.compras
  alter column dias_vencimento set default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='chk_compras_quantidade_parcelas') then
    alter table public.compras add constraint chk_compras_quantidade_parcelas check (quantidade_parcelas >= 1);
  end if;
  if not exists (select 1 from pg_constraint where conname='chk_compras_dias_vencimento') then
    alter table public.compras add constraint chk_compras_dias_vencimento check (dias_vencimento >= 0);
  end if;
end $$;
