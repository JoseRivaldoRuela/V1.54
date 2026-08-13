-- O codigo da venda deve ser unico dentro da empresa, nao no sistema inteiro.
-- Esta migracao nao altera nem exclui vendas existentes.
begin;

alter table public.vendas
  drop constraint if exists vendas_codigo_venda_key;

-- Evita criar a mesma restricao duas vezes se o script for executado novamente.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.vendas'::regclass
       and conname = 'vendas_empresa_codigo_venda_key'
  ) then
    alter table public.vendas
      add constraint vendas_empresa_codigo_venda_key
      unique (empresa_id, codigo_venda);
  end if;
end $$;

commit;

-- Conferencia: cada linha retornada e um codigo repetido dentro da mesma empresa.
-- O resultado correto e nenhuma linha.
select empresa_id, codigo_venda, count(*) as quantidade
  from public.vendas
 group by empresa_id, codigo_venda
having count(*) > 1;
