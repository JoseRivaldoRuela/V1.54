-- Corrige o vazamento de compras entre empresas sem apagar, mover ou alterar
-- qualquer lancamento. Execute no SQL Editor do Supabase.
begin;

do $$
declare
  tabela text;
  nulos bigint;
begin
  if to_regprocedure('public.app_pode_acessar_registro(uuid,bigint)') is null
     or to_regprocedure('public.app_escopo_usuario_insert()') is null then
    raise exception 'Execute multiempresa_seguranca.sql antes desta correcao';
  end if;

  foreach tabela in array array['compras','compra_itens','contas_pagar','estoque_movimentacoes'] loop
    if to_regclass('public.'||tabela) is null then
      raise exception 'Tabela public.% nao encontrada', tabela;
    end if;
    execute format('select count(*) from public.%I where empresa_id is null or id_usuario is null',tabela) into nulos;
    if nulos > 0 then
      raise exception 'A tabela public.% possui % registros sem empresa/usuario. Nenhum dado foi alterado.',tabela,nulos;
    end if;
  end loop;

  if exists (
    select 1 from public.compra_itens i
    join public.compras c on c.id_compra=i.id_compra
    where i.empresa_id<>c.empresa_id
  ) then
    raise exception 'Existem itens ligados a uma compra de outra empresa. Nenhum dado foi alterado.';
  end if;

  if exists (
    select 1 from public.contas_pagar cp
    join public.compras c on c.id_compra=cp.id_compra
    where cp.empresa_id<>c.empresa_id
  ) then
    raise exception 'Existem contas ligadas a uma compra de outra empresa. Nenhum dado foi alterado.';
  end if;
end $$;

do $$
declare
  tabela text;
  politica record;
begin
  foreach tabela in array array['compras','compra_itens','contas_pagar','estoque_movimentacoes'] loop
    execute format('alter table public.%I enable row level security',tabela);

    for politica in
      select policyname from pg_policies
      where schemaname='public' and tablename=tabela
    loop
      execute format('drop policy if exists %I on public.%I',politica.policyname,tabela);
    end loop;

    execute format('drop trigger if exists app_definir_escopo on public.%I',tabela);
    execute format(
      'create trigger app_definir_escopo before insert on public.%I for each row execute function public.app_escopo_usuario_insert()',
      tabela
    );
    execute format(
      'create policy escopo_empresa_usuario on public.%I for all to anon,authenticated using (public.app_pode_acessar_registro(empresa_id,id_usuario)) with check (public.app_pode_acessar_registro(empresa_id,id_usuario))',
      tabela
    );
  end loop;
end $$;

commit;

-- Conferencia: deve retornar RLS ativo e apenas a politica fechada.
select c.relname as tabela,
       c.relrowsecurity as rls_ativo,
       string_agg(p.policyname,', ' order by p.policyname) as politicas
from pg_class c
join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
left join pg_policies p on p.schemaname=n.nspname and p.tablename=c.relname
where c.relname in ('compras','compra_itens','contas_pagar','estoque_movimentacoes')
group by c.relname,c.relrowsecurity
order by c.relname;

-- Conferencia de quantidade por empresa. Nenhuma contagem deve mudar.
select 'compras' as tabela,empresa_id,count(*) as registros from public.compras group by empresa_id
union all select 'compra_itens',empresa_id,count(*) from public.compra_itens group by empresa_id
union all select 'contas_pagar',empresa_id,count(*) from public.contas_pagar group by empresa_id
union all select 'estoque_movimentacoes',empresa_id,count(*) from public.estoque_movimentacoes group by empresa_id
order by tabela,empresa_id;
