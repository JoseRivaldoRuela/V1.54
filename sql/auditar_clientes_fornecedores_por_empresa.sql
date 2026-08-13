-- Auditoria somente leitura: mostra exatamente a empresa proprietaria de cada
-- cliente e fornecedor e valida as protecoes de isolamento.
select 'cliente' as tipo,
       c.id_cliente as id,
       c.razao_social,
       c.nome_fantasia,
       c.ativo,
       c.empresa_id,
       e.codigo as empresa_codigo,
       e.nome as empresa_nome
from public.clientes c
left join public.empresas e on e.id_empresa=c.empresa_id
union all
select 'fornecedor',
       f.id_fornecedor,
       f.razao_social,
       f.nome_fantasia,
       f.ativo,
       f.empresa_id,
       e.codigo,
       e.nome
from public.fornecedores f
left join public.empresas e on e.id_empresa=f.empresa_id
order by empresa_nome,tipo,razao_social;

select 'clientes' as tabela,e.codigo,e.nome,count(*) as registros
from public.clientes c join public.empresas e on e.id_empresa=c.empresa_id
group by e.codigo,e.nome
union all
select 'fornecedores',e.codigo,e.nome,count(*)
from public.fornecedores f join public.empresas e on e.id_empresa=f.empresa_id
group by e.codigo,e.nome
order by codigo,tabela;

select c.relname as tabela,
       c.relrowsecurity as rls_ativo,
       string_agg(distinct p.policyname,', ') as politicas,
       string_agg(distinct t.tgname,', ') filter (where not t.tgisinternal) as triggers
from pg_class c
join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
left join pg_policies p on p.schemaname=n.nspname and p.tablename=c.relname
left join pg_trigger t on t.tgrelid=c.oid
where c.relname in ('clientes','fornecedores')
group by c.relname,c.relrowsecurity
order by c.relname;
