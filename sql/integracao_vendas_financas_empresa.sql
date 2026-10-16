-- Primeiro passo da integração: configuração por empresa.
begin;

alter table public.empresas
  add column if not exists integra_vendas_financas boolean not null default false;

create or replace function public.provisionar_categorias_contas_financas(p_id_empresa uuid) returns void
language plpgsql security definer set search_path=public,financas,extensions as $$
declare empresa_modelo uuid; gatilho_desativado boolean := false;
begin
  if p_id_empresa is null then return; end if;

  select id_empresa into empresa_modelo
    from public.empresas
   where lower(codigo)='jr'
   limit 1;

  if empresa_modelo is null then
    raise exception 'Empresa modelo JR nao encontrada para provisionar categorias de contas do Financas';
  end if;

  lock table financas.categorias in share row exclusive mode;

  if exists(select 1 from pg_trigger
      where tgrelid='financas.categorias'::regclass
        and tgname='definir_empresa_atual'
        and tgenabled='O') then
    alter table financas.categorias disable trigger definir_empresa_atual;
    gatilho_desativado := true;
  end if;

  insert into financas.categorias(id_empresa,nome,tipo,descricao,cor,ativo,uso,id_centro_custo)
  select p_id_empresa,c.nome,c.tipo,c.descricao,c.cor,c.ativo,c.uso,null
    from financas.categorias c
   where c.id_empresa=empresa_modelo
     and c.ativo
     and exists (
       select 1
         from financas.contas conta_modelo
        where conta_modelo.id_empresa=empresa_modelo
          and conta_modelo.id_categoria=c.id_categoria
     )
     and not exists (
       select 1
         from financas.categorias destino
        where destino.id_empresa=p_id_empresa
          and lower(trim(destino.nome))=lower(trim(c.nome))
          and coalesce(destino.uso,'')=coalesce(c.uso,'')
          and coalesce(destino.tipo,'')=coalesce(c.tipo,'')
     );

  if gatilho_desativado and exists(select 1 from pg_trigger
      where tgrelid='financas.categorias'::regclass
        and tgname='definir_empresa_atual'
        and tgenabled='D') then
    alter table financas.categorias enable trigger definir_empresa_atual;
  end if;
end $$;

drop function if exists public.listar_empresas_admin();
create function public.listar_empresas_admin()
returns table(id_empresa uuid,codigo text,nome text,ativo boolean,integra_vendas_financas boolean,total_usuarios bigint,criado_em timestamptz)
language plpgsql stable security definer set search_path=public,extensions as $$
begin
  if not public.verificar_superadmin_jr() then raise exception 'Acesso negado'; end if;
  return query
    select e.id_empresa,e.codigo::text,e.nome::text,e.ativo,e.integra_vendas_financas,count(u.id_usuario),e.criado_em
      from public.empresas e left join public.usuarios u on u.empresa_id=e.id_empresa
     group by e.id_empresa,e.codigo,e.nome,e.ativo,e.integra_vendas_financas,e.criado_em
     order by e.nome;
end $$;

create or replace function public.criar_empresa_com_admin(
  p_codigo text,p_nome text,p_usuario_nome text,p_username text,p_senha text,p_integra_vendas_financas boolean
) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare nova_empresa uuid; novo_usuario bigint; coluna_senha text; codigo_normalizado text:=lower(trim(p_codigo));
begin
  if not public.verificar_superadmin_jr() then raise exception 'Acesso negado'; end if;
  if codigo_normalizado!~'^[a-z0-9_-]{2,40}$' then return jsonb_build_object('ok',false,'message','Codigo da empresa invalido'); end if;
  if length(trim(p_nome))<2 or length(trim(p_usuario_nome))<2 or length(trim(p_username))<2 or length(p_senha)<6 then return jsonb_build_object('ok',false,'message','Preencha os dados corretamente'); end if;
  if exists(select 1 from public.empresas where lower(codigo)=codigo_normalizado) then return jsonb_build_object('ok',false,'message','Codigo da empresa ja existe'); end if;
  insert into public.empresas(codigo,nome,ativo,integra_vendas_financas)
  values(codigo_normalizado,trim(p_nome),true,coalesce(p_integra_vendas_financas,false)) returning id_empresa into nova_empresa;
  select column_name into coluna_senha from information_schema.columns
   where table_schema='public' and table_name='usuarios' and column_name in ('senha_hash','senha','password_hash','password')
   order by case column_name when 'senha_hash' then 1 when 'senha' then 2 when 'password_hash' then 3 else 4 end limit 1;
  if coluna_senha is null then raise exception 'Coluna de senha nao encontrada'; end if;
  execute format('insert into public.usuarios(nome,username,%I,ativo,admin,empresa_id) values($1,$2,$3,true,true,$4) returning id_usuario',coluna_senha)
    into novo_usuario using trim(p_usuario_nome),trim(p_username),crypt(p_senha,gen_salt('bf')),nova_empresa;
  if coalesce(p_integra_vendas_financas,false) then
    perform public.provisionar_categorias_contas_financas(nova_empresa);
  end if;
  return jsonb_build_object('ok',true,'id_empresa',nova_empresa,'id_usuario',novo_usuario,'codigo',codigo_normalizado);
end $$;

create or replace function public.atualizar_empresa_admin(
  p_id_empresa uuid,p_nome text,p_ativo boolean,p_integra_vendas_financas boolean
) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare codigo_alvo text;
begin
  if not public.verificar_superadmin_jr() then raise exception 'Acesso negado'; end if;
  select lower(codigo) into codigo_alvo from public.empresas where id_empresa=p_id_empresa;
  if codigo_alvo is null then return jsonb_build_object('ok',false,'message','Empresa nao encontrada'); end if;
  if codigo_alvo='jr' and not p_ativo then return jsonb_build_object('ok',false,'message','A empresa JR nao pode ser desativada'); end if;
  if length(trim(p_nome))<2 then return jsonb_build_object('ok',false,'message','Nome invalido'); end if;
  update public.empresas set nome=trim(p_nome),ativo=p_ativo,
    integra_vendas_financas=coalesce(p_integra_vendas_financas,false)
   where id_empresa=p_id_empresa;
  if coalesce(p_integra_vendas_financas,false) then
    perform public.provisionar_categorias_contas_financas(p_id_empresa);
  end if;
  if not p_ativo then update public.sessoes_empresa set revogado_em=now() where empresa_id=p_id_empresa and revogado_em is null; end if;
  return jsonb_build_object('ok',true);
end $$;

select public.provisionar_categorias_contas_financas(id_empresa)
  from public.empresas
 where integra_vendas_financas;

revoke all on function public.provisionar_categorias_contas_financas(uuid) from public;
revoke all on function public.listar_empresas_admin() from public;
revoke all on function public.criar_empresa_com_admin(text,text,text,text,text,boolean) from public;
revoke all on function public.atualizar_empresa_admin(uuid,text,boolean,boolean) from public;
grant execute on function public.listar_empresas_admin() to anon,authenticated;
grant execute on function public.criar_empresa_com_admin(text,text,text,text,text,boolean) to anon,authenticated;
grant execute on function public.atualizar_empresa_admin(uuid,text,boolean,boolean) to anon,authenticated;

commit;
select pg_notify('pgrst','reload schema');
