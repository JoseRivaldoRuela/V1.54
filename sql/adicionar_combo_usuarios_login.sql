-- Execute no SQL Editor porque a migracao multiempresa principal ja foi aplicada.
begin;

create or replace function public.listar_usuarios_login(p_empresa_codigo text)
returns table(username text,nome text)
language sql stable security definer set search_path=public,extensions as $$
  select u.username::text,u.nome::text
  from public.usuarios u
  join public.empresas e on e.id_empresa=u.empresa_id
  where lower(e.codigo)=lower(trim(p_empresa_codigo)) and e.ativo and u.ativo
  order by u.nome
$$;

revoke all on function public.listar_usuarios_login(text) from public;
grant execute on function public.listar_usuarios_login(text) to anon,authenticated;

commit;

select * from public.listar_usuarios_login('jr');
