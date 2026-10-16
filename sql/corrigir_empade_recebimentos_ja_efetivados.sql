-- Execute INTEIRO no SQL Editor do Supabase, como postgres.
-- Conciliacao dos dados enviados em 06/10/2026: titulos 281 e 296.
-- Regulariza apenas Contas a Receber. Nao cria nem altera movimento financeiro.
-- Nao inventa uma baixa historica: registra a conciliacao nas observacoes.
-- A data recuperada e a data de efetivacao registrada no Financas.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';

do $conciliacao$
declare
  empresa constant uuid := '9bd65462-b979-4618-bb9d-851ef003d234';
  alvo record;
  titulo public.contas_receber%rowtype;
  movimento financas.movimentos%rowtype;
  saldo_antes numeric;
  movimentos_antes jsonb;
  aberto_antes numeric;
  aberto_depois numeric;
  reducao numeric := 0;
begin
  -- Bloqueia alteracoes concorrentes enquanto confere o total e os movimentos.
  lock table public.contas_receber in share row exclusive mode;
  perform 1 from financas.movimentos
    where id_empresa=empresa and id_movimento in (87890,88662)
    order by id_movimento for share;
  select saldo_atual into strict saldo_antes from financas.contas
    where id_empresa=empresa and id_conta=23 and nome ilike '%nubank%jr%'
    for share;
  select jsonb_agg(to_jsonb(m) order by m.id_movimento) into movimentos_antes
    from financas.movimentos m
    where m.id_empresa=empresa and m.id_movimento in (87890,88662);

  select coalesce(sum(greatest(0,coalesce(cr.valor_original,0)-
    case when cr.status_recebimento='RECEBIDO' and coalesce(cr.valor_recebido,0)<=0
         then coalesce(cr.valor_original,0)
         else least(coalesce(cr.valor_original,0),greatest(0,coalesce(cr.valor_recebido,0))) end)),0)
    into aberto_antes
    from public.contas_receber cr join public.clientes c
      on c.id_cliente=cr.id_cliente and c.empresa_id=cr.empresa_id
    where cr.empresa_id=empresa
      and upper(trim(coalesce(cr.status_recebimento,'')))<>'CANCELADO'
      and (c.nome_fantasia ilike '%EMPADE%' or c.razao_social ilike '%EMPADE%');

  for alvo in select * from (values
    (281::bigint,87890::bigint,'V2609-020',2700.00::numeric,date '2026-09-23'),
    (296::bigint,88662::bigint,'V2609-032',2160.00::numeric,date '2026-09-29')
  ) as esperados(titulo,movimento,pedido,valor,data_recebimento)
  loop
    select * into strict titulo from public.contas_receber
      where empresa_id=empresa and id_conta=alvo.titulo for update;
    select * into strict movimento from financas.movimentos
      where id_empresa=empresa and id_movimento=alvo.movimento;
    if titulo.id_usuario is distinct from 1::bigint
       or titulo.id_movimento_financas is distinct from alvo.movimento
       or titulo.id_conta_financas is distinct from 23::bigint
       or titulo.valor_original is distinct from alvo.valor
       or not exists(select 1 from public.vendas v join public.clientes c
           on c.id_cliente=v.id_cliente and c.empresa_id=v.empresa_id
           where v.id_venda=titulo.id_venda and v.empresa_id=empresa
             and v.codigo_venda=alvo.pedido and c.id_cliente=titulo.id_cliente
             and (c.nome_fantasia ilike '%EMPADE%' or c.razao_social ilike '%EMPADE%'))
       or movimento.id_conta is distinct from 23::bigint
       or movimento.tipo is distinct from 'entrada'
       or movimento.status is distinct from 'efetivado'
       or movimento.valor is distinct from alvo.valor
       or movimento.documento is distinct from alvo.pedido
       or movimento.data_efetivacao::date is distinct from alvo.data_recebimento then
      raise exception 'Titulo % ou movimento % mudou desde a conferencia. Correcao desfeita.',alvo.titulo,alvo.movimento;
    end if;

    -- Reexecucao nao soma outro recebimento.
    if titulo.status_recebimento='RECEBIDO' and titulo.valor_recebido=alvo.valor then
      continue;
    end if;
    if titulo.status_recebimento is distinct from 'PENDENTE'
       or titulo.valor_recebido is distinct from 0::numeric then
      raise exception 'Titulo % nao esta mais pendente com recebido zero. Correcao desfeita.',alvo.titulo;
    end if;
    reducao := reducao + alvo.valor;
    update public.contas_receber
      set valor_recebido=alvo.valor, status_recebimento='RECEBIDO',
          data_recebimento=(alvo.data_recebimento::timestamp at time zone 'America/Sao_Paulo'),
          observacoes=concat_ws(E'\n',nullif(observacoes,''),
            format('Conciliacao EMPADE em 06/10/2026: recebimento recuperado do movimento %s ja efetivado na Nubank JR. Sem nova entrada financeira. Data recuperada do Financas, nao de comprovante bancario.',alvo.movimento))
      where empresa_id=empresa and id_conta=alvo.titulo;
  end loop;

  select coalesce(sum(greatest(0,coalesce(cr.valor_original,0)-
    case when cr.status_recebimento='RECEBIDO' and coalesce(cr.valor_recebido,0)<=0
         then coalesce(cr.valor_original,0)
         else least(coalesce(cr.valor_original,0),greatest(0,coalesce(cr.valor_recebido,0))) end)),0)
    into aberto_depois
    from public.contas_receber cr join public.clientes c
      on c.id_cliente=cr.id_cliente and c.empresa_id=cr.empresa_id
    where cr.empresa_id=empresa
      and upper(trim(coalesce(cr.status_recebimento,'')))<>'CANCELADO'
      and (c.nome_fantasia ilike '%EMPADE%' or c.razao_social ilike '%EMPADE%');
  if aberto_depois is distinct from aberto_antes-reducao then
    raise exception 'Conferencia do saldo aberto falhou. Correcao desfeita.';
  end if;
  if (select saldo_atual from financas.contas where id_empresa=empresa and id_conta=23)
       is distinct from saldo_antes
     or (select jsonb_agg(to_jsonb(m) order by m.id_movimento)
         from financas.movimentos m where m.id_empresa=empresa and m.id_movimento in (87890,88662))
       is distinct from movimentos_antes then
    raise exception 'O Financas sofreu alteracao inesperada. Correcao desfeita.';
  end if;
  raise notice 'Regularizado: R$ %. Aberto antes: R$ %. Aberto depois: R$ %. Nubank JR preservada.',reducao,aberto_antes,aberto_depois;
end $conciliacao$;

-- Resultado final dos dois titulos, antes do commit.
select cr.id_conta, v.codigo_venda, cr.valor_original, cr.valor_recebido,
       cr.status_recebimento, cr.data_recebimento, cr.id_movimento_financas,
       m.status as status_financas, m.valor as valor_financas
from public.contas_receber cr
join public.vendas v on v.id_venda=cr.id_venda and v.empresa_id=cr.empresa_id
join financas.movimentos m on m.id_movimento=cr.id_movimento_financas
                         and m.id_empresa=cr.empresa_id
where cr.empresa_id='9bd65462-b979-4618-bb9d-851ef003d234'::uuid
  and cr.id_conta in (281,296)
order by cr.id_conta;
commit;
