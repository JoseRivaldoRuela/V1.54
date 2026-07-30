-- Backup interno antes da migracao multiempresa.
-- Execute este arquivo INTEIRO no SQL Editor do Supabase.
-- Ele nao altera nem apaga os dados atuais.
-- ATENCAO: a copia usa espaco adicional dentro do limite do projeto Free.

begin;

do $$
begin
  if exists (select 1 from pg_namespace where nspname='backup_pre_multiempresa') then
    raise exception 'O schema backup_pre_multiempresa ja existe. Nada foi alterado.';
  end if;
end $$;

create schema backup_pre_multiempresa;

create table backup_pre_multiempresa._manifesto (
  tabela text primary key,
  linhas bigint not null,
  tamanho_original_bytes bigint not null,
  criado_em timestamptz not null default now()
);

create table backup_pre_multiempresa._colunas as
select table_name,column_name,ordinal_position,column_default,is_nullable,data_type,udt_name,
       character_maximum_length,numeric_precision,numeric_scale
from information_schema.columns
where table_schema='public';

create table backup_pre_multiempresa._views as
select schemaname,viewname,viewowner,definition
from pg_views where schemaname='public';

create table backup_pre_multiempresa._funcoes as
select n.nspname schema_nome,
       p.proname funcao_nome,
       pg_get_function_identity_arguments(p.oid) argumentos,
       pg_get_functiondef(p.oid) definicao
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind in ('f','p');

create table backup_pre_multiempresa._politicas as
select * from pg_policies where schemaname='public';

create table backup_pre_multiempresa._sequencias (
  sequencia text primary key,
  ultimo_valor bigint,
  chamada boolean
);

do $$
declare r record; qtd bigint; ultimo bigint; foi_chamada boolean;
begin
  for r in
    select c.relname tabela
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
    order by c.relname
  loop
    -- CTAS cria colunas simples, evitando falha em tabelas com identity/generated.
    -- Definicoes originais ficam preservadas nas tabelas de metadados acima.
    execute format('create table backup_pre_multiempresa.%I as select * from public.%I with no data',r.tabela,r.tabela);
    execute format('insert into backup_pre_multiempresa.%I select * from public.%I',r.tabela,r.tabela);
    execute format('select count(*) from backup_pre_multiempresa.%I',r.tabela) into qtd;
    insert into backup_pre_multiempresa._manifesto(tabela,linhas,tamanho_original_bytes)
    values(r.tabela,qtd,pg_total_relation_size(format('public.%I',r.tabela)::regclass));
  end loop;

  for r in
    select c.relname sequencia
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='S'
  loop
    execute format('select last_value,is_called from public.%I',r.sequencia) into ultimo,foi_chamada;
    insert into backup_pre_multiempresa._sequencias values(r.sequencia,ultimo,foi_chamada);
  end loop;
end $$;

-- Confere se a quantidade copiada coincide com cada tabela original.
do $$
declare r record; qtd_atual bigint;
begin
  for r in select tabela,linhas from backup_pre_multiempresa._manifesto loop
    execute format('select count(*) from public.%I',r.tabela) into qtd_atual;
    if qtd_atual<>r.linhas then
      raise exception 'Falha ao conferir %. Original: %, backup: %',r.tabela,qtd_atual,r.linhas;
    end if;
  end loop;
end $$;

commit;

-- Resultado esperado: uma linha por tabela, todas com status OK.
select tabela,
       linhas,
       pg_size_pretty(tamanho_original_bytes) tamanho_original,
       'OK' status,
       criado_em
from backup_pre_multiempresa._manifesto
order by tabela;

select pg_size_pretty(sum(tamanho_original_bytes)) tamanho_aproximado_do_backup
from backup_pre_multiempresa._manifesto;
