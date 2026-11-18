-- Diagnóstico somente de leitura para o SQL Editor do projeto Supabase.
-- Não altera exposição de schemas, permissões, sessões ou dados financeiros.
select current_database() as banco,
       current_setting('pgrst.db_schemas', true) as schemas_na_sessao;

-- Configuração persistida por role/banco (pode sobrepor a do painel).
select coalesce(r.rolname, 'todos') as role,
       coalesce(d.datname, 'todos') as banco,
       configuracao
from pg_db_role_setting s
left join pg_roles r on r.oid=s.setrole
left join pg_database d on d.oid=s.setdatabase
cross join lateral unnest(s.setconfig) configuracao
where configuracao like 'pgrst.%'
order by 1,2,3;

-- Verificar RLS antes de propor restaurar o schema financas na API.
select n.nspname as schema, c.relname as tabela,
       c.relrowsecurity as rls_ativo,
       c.relforcerowsecurity as rls_forcado,
       (select count(*) from pg_policy p where p.polrelid=c.oid) as politicas
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','financas')
  and c.relkind in ('r','p')
  and (n.nspname='financas' or c.relname in ('vendas','venda_itens','clientes'))
order by 1,2;

select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema='financas' and grantee in ('anon','authenticated')
order by 1,2,3,4;
