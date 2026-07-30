-- Atualizacao incremental: editar nome/status das empresas.
begin;

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

revoke all on function public.atualizar_empresa_admin(uuid,text,boolean) from public;
grant execute on function public.atualizar_empresa_admin(uuid,text,boolean) to anon,authenticated;

commit;
