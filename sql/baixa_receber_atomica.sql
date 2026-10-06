-- Instalar INTEIRO no SQL Editor do Supabase, como postgres.
-- Cada chamada RPC e uma unica transacao: titulo, historico e Financas.
begin;
create table if not exists public.baixas_receber_operacoes (
  id_operacao uuid primary key,
  empresa_id uuid not null references public.empresas(id_empresa),
  id_usuario bigint not null,
  requisicao jsonb not null,
  resultado jsonb,
  criado_em timestamptz not null default now()
);
alter table public.baixas_receber_operacoes enable row level security;
drop policy if exists escopo_operacao_baixa on public.baixas_receber_operacoes;
create policy escopo_operacao_baixa on public.baixas_receber_operacoes
  for all to anon, authenticated
  using (empresa_id=public.app_empresa_atual() and id_usuario=public.app_usuario_atual())
  with check (empresa_id=public.app_empresa_atual() and id_usuario=public.app_usuario_atual());
grant select,insert,update on public.baixas_receber_operacoes to anon,authenticated;

create or replace function public.baixar_contas_receber_atomico(
  p_id_operacao uuid, p_itens jsonb, p_data_baixa timestamptz,
  p_atualizar_financas boolean, p_id_conta_financas bigint,
  p_id_categoria bigint, p_observacoes text default null
) returns jsonb
language plpgsql security invoker
set search_path=public,financas,pg_temp as $baixa$
declare
  empresa uuid := public.app_empresa_atual();
  usuario bigint := public.app_usuario_atual();
  requisicao jsonb;
  operacao public.baixas_receber_operacoes%rowtype;
  item jsonb;
  titulo public.contas_receber%rowtype;
  original financas.movimentos%rowtype;
  baixa_id bigint;
  movimento_id bigint;
  categoria_id bigint := p_id_categoria;
  valor numeric;
  recebido_antes numeric;
  recebido_depois numeric;
  saldo numeric;
  total numeric := 0;
  integrado boolean;
  codigo text;
  argumentos jsonb;
  retorno jsonb;
  chamada text;
  resultados jsonb := '[]'::jsonb;
  baixas_integradas numeric;
  legado numeric;
  data_local date := (p_data_baixa at time zone 'America/Sao_Paulo')::date;
begin
  if empresa is null or usuario is null then raise exception 'Sessao invalida ou expirada'; end if;
  if p_id_operacao is null or p_data_baixa is null
     or jsonb_typeof(p_itens) is distinct from 'array'
     or jsonb_array_length(p_itens) not between 1 and 500 then
    raise exception 'Dados da baixa invalidos';
  end if;
  if (select count(distinct (i->>'id_conta')::bigint) from jsonb_array_elements(p_itens) i)
      <> jsonb_array_length(p_itens) then raise exception 'Titulos repetidos no lote'; end if;
  requisicao := jsonb_build_object('itens',p_itens,'data',p_data_baixa,
    'integrar',p_atualizar_financas,'conta',p_id_conta_financas,
    'categoria',p_id_categoria,'observacoes',p_observacoes);
  insert into public.baixas_receber_operacoes(id_operacao,empresa_id,id_usuario,requisicao)
    values(p_id_operacao,empresa,usuario,requisicao) on conflict do nothing;
  select * into operacao from public.baixas_receber_operacoes
    where id_operacao=p_id_operacao and empresa_id=empresa and id_usuario=usuario for update;
  if not found or operacao.requisicao is distinct from requisicao then
    raise exception 'Identificador de baixa ja usado com outros dados';
  end if;
  if operacao.resultado is not null then return operacao.resultado; end if;
  select coalesce(p_atualizar_financas,false) and e.integra_vendas_financas
    into integrado from public.empresas e where e.id_empresa=empresa;
  if p_atualizar_financas and integrado is distinct from true then
    raise exception 'Configuracao da integracao mudou. Atualize a tela antes de baixar.';
  end if;
  if integrado then
    perform 1 from financas.contas where id_empresa=empresa and id_conta=p_id_conta_financas
      and ativo and tipo<>'cartao' for update;
    if not found then raise exception 'Conta do Financas invalida ou indisponivel'; end if;
    if categoria_id is null then
      select id_categoria into categoria_id from financas.categorias
        where id_empresa=empresa and ativo and uso='entrada' and lower(trim(nome))='vendas'
        order by id_categoria limit 1;
      if categoria_id is null then
        insert into financas.categorias(nome,uso,tipo,cor,descricao,ativo)
          values('Vendas','entrada',null,'#19d89f','Categoria da integracao Vendas',true)
          returning id_categoria into categoria_id;
      end if;
    end if;
    perform 1 from financas.categorias where id_empresa=empresa
      and id_categoria=categoria_id and ativo and uso='entrada';
    if not found then raise exception 'Categoria do Financas invalida ou indisponivel'; end if;
  end if;
  -- Ordem de bloqueio deterministica, independentemente da ordem de vencimento.
  perform cr.id_conta from public.contas_receber cr
    where cr.empresa_id=empresa and cr.id_conta in
      (select (i->>'id_conta')::bigint from jsonb_array_elements(p_itens) i)
    order by cr.id_conta for update;
  for item in select * from jsonb_array_elements(p_itens) loop
    select * into titulo from public.contas_receber
      where empresa_id=empresa and id_conta=(item->>'id_conta')::bigint;
    if not found then raise exception 'Titulo nao encontrado ou sem permissao'; end if;
    if titulo.valor_original is distinct from (item->>'valor_original')::numeric
       or coalesce(titulo.valor_recebido,0) is distinct from (item->>'valor_recebido')::numeric
       or titulo.status_recebimento is distinct from item->>'status_recebimento'
       or titulo.id_movimento_financas is distinct from (item->>'id_movimento_financas')::bigint
       or titulo.id_cliente is distinct from (item->>'id_cliente')::bigint then
      raise exception 'Titulo % mudou. Atualize a tela antes de baixar.',titulo.id_conta;
    end if;
    recebido_antes := least(titulo.valor_original,greatest(0,coalesce(titulo.valor_recebido,0)));
    saldo := titulo.valor_original-recebido_antes;
    valor := round((item->>'valor')::numeric,2);
    if titulo.status_recebimento in ('CANCELADO','RECEBIDO') or valor is null
       or valor<=0 or valor>saldo or saldo<=0 then raise exception 'Valor ou estado invalido no titulo %',titulo.id_conta; end if;
    original := null;
    if integrado and titulo.id_movimento_financas is not null then
      select * into original from financas.movimentos
        where id_empresa=empresa and id_movimento=titulo.id_movimento_financas for update;
      if not found or original.tipo<>'entrada' or original.status='cancelado' then
        raise exception 'Movimento original do titulo % ausente ou invalido',titulo.id_conta;
      end if;
      if original.status='efetivado' and recebido_antes=0 then
        raise exception 'Titulo % ja tem movimento efetivado no Financas, mas recebido zero. Concilie antes de baixar.',titulo.id_conta;
      end if;
    end if;
    select codigo_venda into codigo from public.vendas
      where empresa_id=empresa and id_venda=titulo.id_venda;
    recebido_depois := recebido_antes+valor;
    insert into public.contas_receber_baixas
      (id_conta,id_cliente,valor_baixa,data_baixa,meio_pagamento,observacoes)
      values(titulo.id_conta,titulo.id_cliente,valor,p_data_baixa,
        coalesce(item->>'meio_pagamento',titulo.meio_pagamento),p_observacoes)
      returning id_baixa into baixa_id;
    if integrado then
      argumentos := jsonb_build_object(
        'p_tipo','entrada','p_id_conta',p_id_conta_financas,'p_id_conta_destino',null,
        'p_valor',valor,'p_descricao',coalesce('Recebimento '||codigo,'Recebimento conta #'||titulo.id_conta),
        'p_data_movimento',data_local,'p_data_vencimento',data_local,'p_data_efetivacao',data_local,
        'p_id_categoria',categoria_id,'p_status','efetivado',
        'p_documento','BAIXA-CR-'||baixa_id,'p_observacoes',coalesce(p_observacoes,titulo.observacoes));
      -- Literais SQL escapados preservam a resolucao dos tipos das RPCs instaladas.
      select 'select to_jsonb(financas.lancar_movimento('||
        string_agg(format('%I => %L',key,value #>> '{}'),', ')||'))'
        into chamada from jsonb_each(argumentos);
      execute chamada into retorno;
      if jsonb_typeof(retorno)='array' then retorno := retorno->0; end if;
      movimento_id := coalesce(retorno->>'id_movimento',retorno->>'p_id_movimento',retorno #>> '{}')::bigint;
      if movimento_id is null or not exists(select 1 from financas.movimentos
          where id_empresa=empresa and id_movimento=movimento_id and id_conta=p_id_conta_financas
            and tipo='entrada' and status='efetivado' and movimentos.valor=(item->>'valor')::numeric
            and documento='BAIXA-CR-'||baixa_id) then
        raise exception 'O Financas nao confirmou o recebimento do titulo %',titulo.id_conta;
      end if;
      if original.id_movimento is not null then
        select coalesce(sum(m.valor),0) into baixas_integradas
          from public.contas_receber_baixas b join financas.movimentos m
            on m.documento='BAIXA-CR-'||b.id_baixa and m.id_empresa=empresa
          where b.id_conta=titulo.id_conta and b.id_baixa<>baixa_id
            and m.tipo='entrada' and m.status='efetivado';
        if baixas_integradas>recebido_antes then raise exception 'Baixas anteriores divergentes no titulo %',titulo.id_conta; end if;
        legado := recebido_antes-baixas_integradas;
        argumentos := jsonb_build_object(
          'p_id_movimento',original.id_movimento,'p_id_conta',original.id_conta,'p_id_conta_destino',null,
          'p_tipo','entrada','p_valor',case when legado>0 then legado when saldo-valor>0 then saldo-valor else titulo.valor_original end,
          'p_descricao',original.descricao,'p_data_movimento',original.data_movimento,
          'p_data_vencimento',coalesce(titulo.data_vencimento,original.data_vencimento),
          'p_data_efetivacao',coalesce(original.data_efetivacao,titulo.data_vencimento,original.data_movimento),'p_id_categoria',original.id_categoria,
          'p_status',case when legado>0 then 'efetivado' when saldo-valor>0 then 'pendente' else 'cancelado' end,
          'p_documento',original.documento,'p_observacoes',original.observacoes);
        select 'select to_jsonb(financas.alterar_movimento('||
          string_agg(format('%I => %L',key,value #>> '{}'),', ')||'))'
          into chamada from jsonb_each(argumentos);
        execute chamada into retorno;
        if not exists(select 1 from financas.movimentos m
            where m.id_empresa=empresa and m.id_movimento=original.id_movimento
              and m.status=argumentos->>'p_status' and m.valor=(argumentos->>'p_valor')::numeric) then
          raise exception 'O Financas nao confirmou o movimento original do titulo %',titulo.id_conta;
        end if;
      end if;
    end if;
    update public.contas_receber set valor_recebido=recebido_depois,
      status_recebimento=case when recebido_depois>=valor_original then 'RECEBIDO' else 'PENDENTE' end,
      data_recebimento=p_data_baixa,
      meio_pagamento=coalesce(item->>'meio_pagamento',meio_pagamento),
      observacoes=case when nullif(p_observacoes,'') is null then observacoes
        else concat_ws(' | ',nullif(observacoes,''),'Baixa: '||p_observacoes) end,
      id_conta_financas=case when integrado then p_id_conta_financas else id_conta_financas end
      where empresa_id=empresa and id_conta=titulo.id_conta returning * into titulo;
    if not found or titulo.valor_recebido<>recebido_depois then raise exception 'Atualizacao do titulo nao confirmada'; end if;
    resultados := resultados||jsonb_build_array(jsonb_build_object('conta',to_jsonb(titulo),'id_baixa',baixa_id,'aplicado',valor));
    total := total+valor;
  end loop;
  retorno := jsonb_build_object('ok',true,'aplicado',total,'qtd',jsonb_array_length(resultados),'titulos',resultados);
  update public.baixas_receber_operacoes set resultado=retorno where id_operacao=p_id_operacao;
  return retorno;
  -- Sem EXCEPTION de recuperacao: qualquer falha desfaz toda a chamada RPC.
end $baixa$;
revoke all on function public.baixar_contas_receber_atomico(uuid,jsonb,timestamptz,boolean,bigint,bigint,text) from public;
grant execute on function public.baixar_contas_receber_atomico(uuid,jsonb,timestamptz,boolean,bigint,bigint,text) to anon,authenticated;
notify pgrst, 'reload schema';
commit;
