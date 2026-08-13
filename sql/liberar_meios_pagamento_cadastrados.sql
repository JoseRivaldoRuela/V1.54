-- Permite usar em vendas, compras e titulos qualquer meio existente no cadastro.
-- Remove somente validacoes CHECK antigas de valores fixos. Nao altera dados.
do $$
declare
  r record;
begin
  for r in
    select n.nspname as esquema, c.relname as tabela, con.conname as restricao
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname in ('vendas', 'contas_receber', 'compras', 'contas_pagar', 'contas_receber_baixas')
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%meio_pagamento%'
  loop
    execute format('alter table %I.%I drop constraint %I', r.esquema, r.tabela, r.restricao);
  end loop;
end $$;

-- O cadastro e os lancamentos continuam isolados pelas politicas de empresa.
-- Esta consulta final permite conferir que nao restou uma lista fixa.
select c.relname as tabela,
       con.conname as restricao,
       pg_get_constraintdef(con.oid) as definicao
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('vendas', 'contas_receber', 'compras', 'contas_pagar', 'contas_receber_baixas')
   and con.contype = 'c'
   and pg_get_constraintdef(con.oid) ilike '%meio_pagamento%';
