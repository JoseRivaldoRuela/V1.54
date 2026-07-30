-- Cadastro central de empresas. Execute no SQL Editor apos a migracao multiempresa.
begin;

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

revoke all on function public.verificar_superadmin_jr() from public;
revoke all on function public.listar_empresas_admin() from public;
revoke all on function public.criar_empresa_com_admin(text,text,text,text,text) from public;
revoke all on function public.atualizar_empresa_admin(uuid,text,boolean) from public;
grant execute on function public.verificar_superadmin_jr() to anon,authenticated;
grant execute on function public.listar_empresas_admin() to anon,authenticated;
grant execute on function public.criar_empresa_com_admin(text,text,text,text,text) to anon,authenticated;
grant execute on function public.atualizar_empresa_admin(uuid,text,boolean) to anon,authenticated;

commit;
