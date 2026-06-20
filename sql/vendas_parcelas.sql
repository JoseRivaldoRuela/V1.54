alter table vendas
  add column if not exists quantidade_parcelas integer not null default 1,
  add column if not exists dias_vencimento integer not null default 0,
  add column if not exists data_vencimento date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_vendas_quantidade_parcelas'
  ) then
    alter table vendas
      add constraint chk_vendas_quantidade_parcelas
      check (quantidade_parcelas >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'chk_vendas_dias_vencimento'
  ) then
    alter table vendas
      add constraint chk_vendas_dias_vencimento
      check (dias_vencimento >= 0);
  end if;
end $$;
