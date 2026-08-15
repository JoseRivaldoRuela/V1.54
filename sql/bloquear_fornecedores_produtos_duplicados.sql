-- Impede novos fornecedores e produtos duplicados dentro da mesma empresa.
-- Pode ser executado mesmo que já existam duplicidades antigas; ele não apaga dados.
begin;

create or replace function public.normalizar_cadastro_duplicado(valor text)
returns text language sql immutable as $$
  select regexp_replace(
    translate(lower(trim(coalesce(valor,''))),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', '', 'g');
$$;

create or replace function public.bloquear_cadastro_duplicado()
returns trigger language plpgsql security definer set search_path=public as $$
declare existente text;
begin
  if tg_table_name='fornecedores' then
    select coalesce(f.nome_fantasia,f.razao_social) into existente
      from public.fornecedores f
     where f.empresa_id=new.empresa_id
       and (tg_op='INSERT' or f.id_fornecedor<>new.id_fornecedor)
       and (
         (regexp_replace(coalesce(new.cpf_cnpj,''),'\D','','g')<>'' and regexp_replace(coalesce(f.cpf_cnpj,''),'\D','','g')=regexp_replace(new.cpf_cnpj,'\D','','g'))
         or public.normalizar_cadastro_duplicado(f.razao_social)=public.normalizar_cadastro_duplicado(new.razao_social)
         or (public.normalizar_cadastro_duplicado(new.nome_fantasia)<>'' and public.normalizar_cadastro_duplicado(f.nome_fantasia)=public.normalizar_cadastro_duplicado(new.nome_fantasia))
       ) limit 1;
    if existente is not null then raise exception 'Fornecedor já cadastrado: %',existente using errcode='23505'; end if;
  elsif tg_table_name='produtos' then
    select p.nome_mercadoria into existente from public.produtos p
     where p.empresa_id=new.empresa_id
       and (tg_op='INSERT' or p.id_produto<>new.id_produto)
       and public.normalizar_cadastro_duplicado(p.nome_mercadoria)=public.normalizar_cadastro_duplicado(new.nome_mercadoria)
     limit 1;
    if existente is not null then raise exception 'Produto já cadastrado: %',existente using errcode='23505'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists fornecedores_sem_duplicidade on public.fornecedores;
create trigger fornecedores_sem_duplicidade before insert or update on public.fornecedores
for each row execute function public.bloquear_cadastro_duplicado();

drop trigger if exists produtos_sem_duplicidade on public.produtos;
create trigger produtos_sem_duplicidade before insert or update on public.produtos
for each row execute function public.bloquear_cadastro_duplicado();

commit;
