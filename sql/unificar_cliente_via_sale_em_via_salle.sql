-- Unifica o cliente "Via Sale" no cliente "Via Salle" da empresa JR.
--
-- Transfere vendas, contas a receber, baixas e precos especiais.
-- Os ids de movimentos do Financas gravados nas contas a receber sao preservados.
-- A operacao e atomica: qualquer divergencia cancela tudo, inclusive a exclusao.

begin;

do $$
declare
  v_empresa_id uuid;
  v_origem_id bigint;
  v_destino_id bigint;
  v_qtd integer;
  v_pendente record;
begin
  select id_empresa
    into v_empresa_id
    from public.empresas
   where lower(trim(codigo::text)) = 'jr'
   limit 1;

  if v_empresa_id is null then
    raise exception 'Empresa JR nao encontrada.';
  end if;

  select count(*), min(id_cliente)
    into v_qtd, v_origem_id
    from public.clientes
   where empresa_id = v_empresa_id
     and (
       lower(trim(coalesce(nome_fantasia, ''))) = 'via sale'
       or lower(trim(coalesce(razao_social, ''))) = 'via sale'
     );

  if v_qtd <> 1 then
    raise exception 'Esperado exatamente 1 cliente "Via Sale" na empresa JR; encontrados: %.', v_qtd;
  end if;

  select count(*), min(id_cliente)
    into v_qtd, v_destino_id
    from public.clientes
   where empresa_id = v_empresa_id
     and (
       lower(trim(coalesce(nome_fantasia, ''))) = 'via salle'
       or lower(trim(coalesce(razao_social, ''))) = 'via salle'
     );

  if v_qtd <> 1 then
    raise exception 'Esperado exatamente 1 cliente "Via Salle" na empresa JR; encontrados: %.', v_qtd;
  end if;

  if v_origem_id = v_destino_id then
    raise exception 'Os clientes de origem e destino nao podem ser o mesmo registro.';
  end if;

  -- Se os dois clientes tiverem preco especial para o mesmo produto, conserva
  -- o cadastro que ja pertence a Via Salle e elimina somente o duplicado da origem.
  delete from public.produtos_precos_especiais origem
   where origem.empresa_id = v_empresa_id
     and origem.id_cliente = v_origem_id
     and exists (
       select 1
         from public.produtos_precos_especiais destino
        where destino.empresa_id = v_empresa_id
          and destino.id_cliente = v_destino_id
          and destino.id_produto = origem.id_produto
     );

  update public.produtos_precos_especiais
     set id_cliente = v_destino_id
   where empresa_id = v_empresa_id
     and id_cliente = v_origem_id;

  update public.vendas
     set id_cliente = v_destino_id
   where empresa_id = v_empresa_id
     and id_cliente = v_origem_id;

  update public.contas_receber
     set id_cliente = v_destino_id
   where empresa_id = v_empresa_id
     and id_cliente = v_origem_id;

  update public.contas_receber_baixas
     set id_cliente = v_destino_id
   where empresa_id = v_empresa_id
     and id_cliente = v_origem_id;

  -- Protecao para tabelas adicionadas futuramente: antes de excluir o cliente,
  -- procura qualquer FK ainda apontando para a origem e interrompe a transacao.
  for v_pendente in
    select n.nspname as esquema,
           t.relname as tabela,
           a.attname as coluna
      from pg_constraint fk
      join pg_class t on t.oid = fk.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      join unnest(fk.conkey) with ordinality chave(attnum, pos) on true
      join pg_attribute a on a.attrelid = fk.conrelid and a.attnum = chave.attnum
     where fk.contype = 'f'
       and fk.confrelid = 'public.clientes'::regclass
  loop
    execute format(
      'select count(*) from %I.%I where %I = $1',
      v_pendente.esquema,
      v_pendente.tabela,
      v_pendente.coluna
    ) into v_qtd using v_origem_id;

    if v_qtd > 0 then
      raise exception 'Ainda existem % referencia(s) a Via Sale em %.%(%). Nada foi excluido.',
        v_qtd, v_pendente.esquema, v_pendente.tabela, v_pendente.coluna;
    end if;
  end loop;

  delete from public.clientes
   where empresa_id = v_empresa_id
     and id_cliente = v_origem_id;

  if not found then
    raise exception 'Via Sale nao foi excluido; a transacao foi cancelada.';
  end if;

  raise notice 'Cliente unificado: Via Sale (id=%) -> Via Salle (id=%).', v_origem_id, v_destino_id;
end $$;

commit;

-- Conferencia final: deve retornar somente Via Salle e seus totais agrupados.
select
  c.id_cliente,
  c.razao_social,
  c.nome_fantasia,
  (select count(*) from public.vendas v where v.id_cliente=c.id_cliente) as vendas,
  (select count(*) from public.contas_receber cr where cr.id_cliente=c.id_cliente) as contas_receber,
  (select coalesce(sum(cr.valor_original),0) from public.contas_receber cr where cr.id_cliente=c.id_cliente) as valor_titulos
from public.clientes c
where c.empresa_id = (select id_empresa from public.empresas where lower(trim(codigo::text))='jr' limit 1)
  and (
    lower(trim(coalesce(c.nome_fantasia, ''))) in ('via sale','via salle')
    or lower(trim(coalesce(c.razao_social, ''))) in ('via sale','via salle')
  );
