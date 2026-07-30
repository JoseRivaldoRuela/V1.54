-- Isolamento por empresa e usuario para o Painel Comercial.
-- Execute uma unica vez no SQL Editor do Supabase, em horario de manutencao.
begin;

create extension if not exists pgcrypto;

create table if not exists public.empresas (
  id_empresa uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into public.empresas (codigo,nome)
values ('jr','JR Representacoes')
on conflict (codigo) do nothing;

alter table public.usuarios add column if not exists empresa_id uuid;
update public.usuarios
set empresa_id=(select id_empresa from public.empresas where codigo='jr')
where empresa_id is null;
alter table public.usuarios alter column empresa_id set not null;
alter table public.usuarios drop constraint if exists usuarios_empresa_fk;
alter table public.usuarios add constraint usuarios_empresa_fk foreign key (empresa_id) references public.empresas(id_empresa);
create index if not exists usuarios_empresa_idx on public.usuarios(empresa_id);
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid='public.usuarios'::regclass and contype='u'
      and conkey=array[(select attnum::smallint from pg_attribute where attrelid='public.usuarios'::regclass and attname='username')]::smallint[]
  loop execute format('alter table public.usuarios drop constraint %I',c.conname); end loop;
end $$;
create unique index if not exists usuarios_empresa_username_uidx on public.usuarios(empresa_id,lower(username));

create table if not exists public.sessoes_empresa (
  id_sessao uuid primary key default gen_random_uuid(),
  token_hash bytea not null unique,
  id_usuario bigint not null references public.usuarios(id_usuario) on delete cascade,
  empresa_id uuid not null references public.empresas(id_empresa) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  revogado_em timestamptz
);
create index if not exists sessoes_empresa_token_idx on public.sessoes_empresa(token_hash) where revogado_em is null;

-- Adiciona o escopo da empresa a todas as entidades do sistema.
do $$
declare t text;
begin
  foreach t in array array[
    'clientes','fornecedores','tipo_mercadoria','produtos','produtos_precos_especiais','tipo_cobranca',
    'vendas','venda_itens','contas_receber','contas_receber_baixas',
    'compras','compra_itens','contas_pagar','estoque_movimentacoes'
  ] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I add column if not exists empresa_id uuid',t);
      execute format('update public.%I set empresa_id=(select id_empresa from public.empresas where codigo=''jr'') where empresa_id is null',t);
      execute format('alter table public.%I alter column empresa_id set not null',t);
      execute format('create index if not exists %I on public.%I(empresa_id)',t||'_empresa_idx',t);
    end if;
  end loop;
end $$;

-- Operacoes pertencem ao usuario que as criou; administradores veem toda a empresa.
do $$
declare t text; usuario_padrao bigint;
begin
  select coalesce(min(id_usuario) filter (where admin),min(id_usuario)) into usuario_padrao
  from public.usuarios where empresa_id=(select id_empresa from public.empresas where codigo='jr');
  foreach t in array array['vendas','venda_itens','contas_receber','contas_receber_baixas','compras','compra_itens','contas_pagar','estoque_movimentacoes'] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I add column if not exists id_usuario bigint',t);
      execute format('update public.%I set id_usuario=$1 where id_usuario is null',t) using usuario_padrao;
      if usuario_padrao is not null then execute format('alter table public.%I alter column id_usuario set not null',t); end if;
      execute format('create index if not exists %I on public.%I(empresa_id,id_usuario)',t||'_escopo_idx',t);
    end if;
  end loop;
end $$;

create or replace function public.app_token_requisicao() returns text
language sql stable security definer set search_path=public,extensions as $$
  select nullif(coalesce(current_setting('request.headers',true),'{}')::jsonb->>'x-app-session','')
$$;

create or replace function public.app_usuario_atual() returns bigint
language sql stable security definer set search_path=public,extensions as $$
  select s.id_usuario from public.sessoes_empresa s
  join public.usuarios u on u.id_usuario=s.id_usuario and u.ativo
  join public.empresas e on e.id_empresa=s.empresa_id and e.ativo
  where s.token_hash=digest(coalesce(public.app_token_requisicao(),''),'sha256')
    and s.revogado_em is null and s.expira_em>now() limit 1
$$;

create or replace function public.app_empresa_atual() returns uuid
language sql stable security definer set search_path=public,extensions as $$
  select s.empresa_id from public.sessoes_empresa s
  join public.usuarios u on u.id_usuario=s.id_usuario and u.ativo
  join public.empresas e on e.id_empresa=s.empresa_id and e.ativo
  where s.token_hash=digest(coalesce(public.app_token_requisicao(),''),'sha256')
    and s.revogado_em is null and s.expira_em>now() limit 1
$$;

create or replace function public.app_admin_atual() returns boolean
language sql stable security definer set search_path=public,extensions as $$
  select coalesce((select u.admin from public.usuarios u where u.id_usuario=public.app_usuario_atual()),false)
$$;

create or replace function public.app_pode_acessar_empresa(p_empresa uuid) returns boolean
language sql stable security definer set search_path=public,extensions as $$
  select p_empresa=public.app_empresa_atual()
$$;

create or replace function public.app_pode_acessar_registro(p_empresa uuid,p_usuario bigint) returns boolean
language sql stable security definer set search_path=public,extensions as $$
  select p_empresa=public.app_empresa_atual() and (public.app_admin_atual() or p_usuario=public.app_usuario_atual())
$$;

create or replace function public.app_escopo_empresa_insert() returns trigger
language plpgsql security definer set search_path=public,extensions as $$
begin
  new := jsonb_populate_record(new,to_jsonb(new)||jsonb_build_object('empresa_id',public.app_empresa_atual()));
  return new;
end $$;

create or replace function public.app_escopo_usuario_insert() returns trigger
language plpgsql security definer set search_path=public,extensions as $$
begin
  new := jsonb_populate_record(new,to_jsonb(new)||jsonb_build_object('empresa_id',public.app_empresa_atual(),'id_usuario',public.app_usuario_atual()));
  return new;
end $$;

-- Remove politicas abertas, cria triggers de escopo e ativa RLS.
do $$
declare t text; p record; transacionais text[]:=array['vendas','venda_itens','contas_receber','contas_receber_baixas','compras','compra_itens','contas_pagar','estoque_movimentacoes'];
begin
  foreach t in array array['clientes','fornecedores','tipo_mercadoria','produtos','produtos_precos_especiais','tipo_cobranca','vendas','venda_itens','contas_receber','contas_receber_baixas','compras','compra_itens','contas_pagar','estoque_movimentacoes'] loop
    if to_regclass('public.'||t) is null then continue; end if;
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I',p.policyname,t);
    end loop;
    execute format('alter table public.%I enable row level security',t);
    execute format('drop trigger if exists app_definir_escopo on public.%I',t);
    if t=any(transacionais) then
      execute format('create trigger app_definir_escopo before insert on public.%I for each row execute function public.app_escopo_usuario_insert()',t);
      execute format('create policy escopo_empresa_usuario on public.%I for all to anon,authenticated using (public.app_pode_acessar_registro(empresa_id,id_usuario)) with check (public.app_pode_acessar_registro(empresa_id,id_usuario))',t);
    else
      execute format('create trigger app_definir_escopo before insert on public.%I for each row execute function public.app_escopo_empresa_insert()',t);
      execute format('create policy escopo_empresa on public.%I for all to anon,authenticated using (public.app_pode_acessar_empresa(empresa_id)) with check (public.app_pode_acessar_empresa(empresa_id))',t);
    end if;
  end loop;
end $$;

alter table public.usuarios enable row level security;
alter table public.empresas enable row level security;
alter table public.sessoes_empresa enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='usuarios' loop
    execute format('drop policy if exists %I on public.usuarios',p.policyname);
  end loop;
end $$;
drop policy if exists usuarios_da_empresa on public.usuarios;
create policy usuarios_da_empresa on public.usuarios for all to anon,authenticated
using (empresa_id=public.app_empresa_atual() and (public.app_admin_atual() or id_usuario=public.app_usuario_atual()))
with check (empresa_id=public.app_empresa_atual() and public.app_admin_atual());
drop policy if exists empresa_atual on public.empresas;
create policy empresa_atual on public.empresas for select to anon,authenticated using (id_empresa=public.app_empresa_atual());

create or replace function public.iniciar_sessao_empresa(p_empresa_codigo text,p_username text,p_senha text) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare u record; senha_armazenada text; token text;
begin
  select us.*,e.nome empresa_nome into u from public.usuarios us join public.empresas e on e.id_empresa=us.empresa_id
  where lower(e.codigo)=lower(trim(p_empresa_codigo)) and lower(us.username)=lower(trim(p_username)) and us.ativo and e.ativo limit 1;
  if u.id_usuario is null then return jsonb_build_object('autenticado',false); end if;
  senha_armazenada:=coalesce(to_jsonb(u)->>'senha_hash',to_jsonb(u)->>'senha');
  if senha_armazenada is null or not (senha_armazenada=crypt(p_senha,senha_armazenada) or senha_armazenada=p_senha) then
    return jsonb_build_object('autenticado',false);
  end if;
  token:=encode(gen_random_bytes(32),'hex');
  insert into public.sessoes_empresa(token_hash,id_usuario,empresa_id,expira_em)
  values(digest(token,'sha256'),u.id_usuario,u.empresa_id,now()+interval '12 hours');
  return jsonb_build_object('autenticado',true,'token',token,'id_usuario',u.id_usuario,'nome',u.nome,'username',u.username,'admin',u.admin,'empresa_id',u.empresa_id,'empresa_nome',u.empresa_nome);
end $$;

create or replace function public.app_criar_usuario(p_nome text,p_username text,p_senha text,p_ativo boolean,p_admin boolean) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare coluna_senha text; novo_id bigint;
begin
  if not public.app_admin_atual() then raise exception 'Acesso negado'; end if;
  if exists(select 1 from public.usuarios where empresa_id=public.app_empresa_atual() and lower(username)=lower(trim(p_username))) then return jsonb_build_object('ok',false,'message','username ja existe'); end if;
  select column_name into coluna_senha from information_schema.columns where table_schema='public' and table_name='usuarios' and column_name in ('senha_hash','senha') order by case when column_name='senha_hash' then 0 else 1 end limit 1;
  if coluna_senha is null then raise exception 'Coluna de senha nao encontrada'; end if;
  execute format('insert into public.usuarios(nome,username,%I,ativo,admin,empresa_id) values($1,$2,$3,$4,$5,$6) returning id_usuario',coluna_senha)
    into novo_id using trim(p_nome),trim(p_username),crypt(p_senha,gen_salt('bf')),p_ativo,p_admin,public.app_empresa_atual();
  return jsonb_build_object('ok',true,'id_usuario',novo_id);
end $$;

create or replace function public.app_alterar_senha(p_id bigint,p_senha text) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare coluna_senha text;
begin
  if not public.app_admin_atual() then raise exception 'Acesso negado'; end if;
  if not exists(select 1 from public.usuarios where id_usuario=p_id and empresa_id=public.app_empresa_atual()) then raise exception 'Usuario invalido'; end if;
  select column_name into coluna_senha from information_schema.columns where table_schema='public' and table_name='usuarios' and column_name in ('senha_hash','senha') order by case when column_name='senha_hash' then 0 else 1 end limit 1;
  execute format('update public.usuarios set %I=$1 where id_usuario=$2 and empresa_id=$3',coluna_senha)
    using crypt(p_senha,gen_salt('bf')),p_id,public.app_empresa_atual();
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.encerrar_sessao_empresa() returns boolean
language plpgsql security definer set search_path=public,extensions as $$
begin
  update public.sessoes_empresa set revogado_em=now()
  where token_hash=digest(coalesce(public.app_token_requisicao(),''),'sha256') and revogado_em is null;
  return true;
end $$;

create or replace function public.listar_usuarios_login(p_empresa_codigo text)
returns table(username text,nome text)
language sql stable security definer set search_path=public,extensions as $$
  select u.username::text,u.nome::text
  from public.usuarios u
  join public.empresas e on e.id_empresa=u.empresa_id
  where lower(e.codigo)=lower(trim(p_empresa_codigo)) and e.ativo and u.ativo
  order by u.nome
$$;

create or replace function public.verificar_superadmin_jr() returns boolean
language sql stable security definer set search_path=public,extensions as $$
  select public.app_admin_atual() and exists(
    select 1 from public.empresas e where e.id_empresa=public.app_empresa_atual() and lower(e.codigo)='jr'
  )
$$;

create or replace function public.listar_empresas_admin()
returns table(id_empresa uuid,codigo text,nome text,ativo boolean,total_usuarios bigint,criado_em timestamptz)
language plpgsql stable security definer set search_path=public,extensions as $$
begin
  if not public.verificar_superadmin_jr() then raise exception 'Acesso negado'; end if;
  return query select e.id_empresa,e.codigo::text,e.nome::text,e.ativo,count(u.id_usuario),e.criado_em
  from public.empresas e left join public.usuarios u on u.empresa_id=e.id_empresa
  group by e.id_empresa,e.codigo,e.nome,e.ativo,e.criado_em order by e.nome;
end $$;

create or replace function public.criar_empresa_com_admin(p_codigo text,p_nome text,p_usuario_nome text,p_username text,p_senha text) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare nova_empresa uuid; novo_usuario bigint; coluna_senha text; codigo_normalizado text:=lower(trim(p_codigo));
begin
  if not public.verificar_superadmin_jr() then raise exception 'Acesso negado'; end if;
  if codigo_normalizado!~'^[a-z0-9_-]{2,40}$' then return jsonb_build_object('ok',false,'message','Codigo da empresa invalido'); end if;
  if length(trim(p_nome))<2 or length(trim(p_usuario_nome))<2 or length(trim(p_username))<2 or length(p_senha)<6 then return jsonb_build_object('ok',false,'message','Preencha os dados corretamente'); end if;
  if exists(select 1 from public.empresas where lower(codigo)=codigo_normalizado) then return jsonb_build_object('ok',false,'message','Codigo da empresa ja existe'); end if;
  insert into public.empresas(codigo,nome,ativo) values(codigo_normalizado,trim(p_nome),true) returning id_empresa into nova_empresa;
  select column_name into coluna_senha from information_schema.columns
  where table_schema='public' and table_name='usuarios' and column_name in ('senha_hash','senha','password_hash','password')
  order by case column_name when 'senha_hash' then 1 when 'senha' then 2 when 'password_hash' then 3 else 4 end limit 1;
  if coluna_senha is null then raise exception 'Coluna de senha nao encontrada'; end if;
  execute format('insert into public.usuarios(nome,username,%I,ativo,admin,empresa_id) values($1,$2,$3,true,true,$4) returning id_usuario',coluna_senha)
    into novo_usuario using trim(p_usuario_nome),trim(p_username),crypt(p_senha,gen_salt('bf')),nova_empresa;
  return jsonb_build_object('ok',true,'id_empresa',nova_empresa,'id_usuario',novo_usuario,'codigo',codigo_normalizado);
end $$;

create or replace function public.atualizar_empresa_admin(p_id_empresa uuid,p_nome text,p_ativo boolean) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare codigo_alvo text;
begin
  if not public.verificar_superadmin_jr() then raise exception 'Acesso negado'; end if;
  select lower(codigo) into codigo_alvo from public.empresas where id_empresa=p_id_empresa;
  if codigo_alvo is null then return jsonb_build_object('ok',false,'message','Empresa nao encontrada'); end if;
  if codigo_alvo='jr' and not p_ativo then return jsonb_build_object('ok',false,'message','A empresa JR nao pode ser desativada'); end if;
  if length(trim(p_nome))<2 then return jsonb_build_object('ok',false,'message','Nome invalido'); end if;
  update public.empresas set nome=trim(p_nome),ativo=p_ativo where id_empresa=p_id_empresa;
  if not p_ativo then update public.sessoes_empresa set revogado_em=now() where empresa_id=p_id_empresa and revogado_em is null; end if;
  return jsonb_build_object('ok',true);
end $$;

revoke all on public.sessoes_empresa from anon,authenticated;
grant execute on function public.iniciar_sessao_empresa(text,text,text) to anon,authenticated;
grant execute on function public.app_criar_usuario(text,text,text,boolean,boolean) to anon,authenticated;
grant execute on function public.app_alterar_senha(bigint,text) to anon,authenticated;
grant execute on function public.encerrar_sessao_empresa() to anon,authenticated;
revoke all on function public.listar_usuarios_login(text) from public;
grant execute on function public.listar_usuarios_login(text) to anon,authenticated;
revoke all on function public.verificar_superadmin_jr() from public;
revoke all on function public.listar_empresas_admin() from public;
revoke all on function public.criar_empresa_com_admin(text,text,text,text,text) from public;
revoke all on function public.atualizar_empresa_admin(uuid,text,boolean) from public;
grant execute on function public.verificar_superadmin_jr() to anon,authenticated;
grant execute on function public.listar_empresas_admin() to anon,authenticated;
grant execute on function public.criar_empresa_com_admin(text,text,text,text,text) to anon,authenticated;
grant execute on function public.atualizar_empresa_admin(uuid,text,boolean) to anon,authenticated;

commit;
