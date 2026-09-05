-- CORRECAO PASSIONE: ITAU R$400,00 / CARTEIRA R$400,00.
-- Execute o arquivo INTEIRO no SQL Editor do Supabase, com o papel postgres.
-- Base: conferencia enviada pelo usuario em 05/09/2026.
-- Mantem os titulos e o total recebido. Divide apenas o movimento 45146.
-- As funcoes da aplicacao exigem uma sessao do app, ausente no SQL Editor.
-- Por isso esta manutencao usa DML com empresa explicita e atualiza o saldo
-- como as funcoes fornecidas. Auditoria e demais gatilhos continuam ativos.
-- Nenhuma funcao/regra permanente do sistema e modificada.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';

-- Impede alteracoes concorrentes durante a divisao e a conferencia.
lock table public.contas_receber, public.contas_receber_baixas
  in share row exclusive mode;
lock table financas.movimentos in access exclusive mode;

do $correcao$
declare
  empresa constant uuid := '9bd65462-b979-4618-bb9d-851ef003d234';
  origem financas.movimentos%rowtype;
  novo_id bigint;
  saldo_itau numeric;
  saldo_carteira numeric;
  total_itau numeric;
  total_carteira numeric;
  ja_corrigido boolean := false;
begin
  perform 1 from financas.contas
    where id_empresa=empresa and id_conta in (19,31)
    order by id_conta for update;

  if (select count(*) from financas.contas
      where id_empresa=empresa and ativo and
        ((id_conta=19 and nome='ITAU') or
         (id_conta=31 and nome='Carteira'))) <> 2 then
    raise exception 'Contas ITAU/Carteira diferentes da conferencia. Nada foi alterado.';
  end if;

  -- Confere os cinco titulos, a empresa, o cliente e os vinculos originais.
  if (select count(*)
      from public.contas_receber cr
      join public.vendas v on v.id_venda=cr.id_venda
      join (values
        (193,71944,'V2608-010',239.00,239.00),
        (249,45146,'V2608-037',164.50,164.50),
        (259,52220,'V2608-046',146.50,146.50),
        (269,61337,'V2609-008',239.00,239.00),
        (275,71938,'V2609-013',50.00,11.00)
      ) e(titulo,movimento,codigo,original,recebido)
        on cr.id_conta=e.titulo
      where cr.empresa_id=empresa and cr.id_cliente=22
        and v.empresa_id=empresa and v.codigo_venda=e.codigo
        and cr.id_movimento_financas=e.movimento
        and cr.valor_original=e.original and cr.valor_recebido=e.recebido) <> 5 then
    raise exception 'Os titulos mudaram desde a conferencia. Nada foi alterado.';
  end if;

  if (select count(*) from financas.movimentos m
      join (values (71944,19,239.00),(52220,31,146.50),
                   (61337,31,239.00),(71938,31,11.00)) e(id,conta,valor)
        on m.id_movimento=e.id
      where m.id_empresa=empresa and m.id_conta=e.conta
        and m.valor=e.valor and m.tipo='entrada' and m.status='efetivado') <> 4 then
    raise exception 'Os outros recebimentos mudaram. Nada foi alterado.';
  end if;

  -- A baixa 89 e o complemento de R$3,50 pago na carteira.
  if (select count(*) from public.contas_receber_baixas
      where empresa_id=empresa and id_cliente=22 and id_conta=249
        and ((id_baixa=87 and valor_baixa=161.00
              and data_baixa='2026-09-03T22:40:00+00'::timestamptz)
          or (id_baixa=89 and valor_baixa=3.50
              and data_baixa='2026-09-04T22:41:00+00'::timestamptz))) <> 2 then
    raise exception 'Historico da venda V2608-037 diferente. Nada foi alterado.';
  end if;

  select * into strict origem from financas.movimentos
    where id_empresa=empresa and id_movimento=45146;

  if origem.documento is distinct from 'V2608-037'
     or origem.tipo is distinct from 'entrada'
     or origem.status is distinct from 'efetivado'
     or origem.id_categoria is distinct from 11::bigint
     or origem.id_fatura is not null
     or origem.id_fatura_pagamento is not null
     or origem.grupo_parcelamento is not null
     or origem.id_conta_destino is not null
     or origem.conciliado is distinct from false then
    raise exception 'Movimento 45146 diferente da conferencia. Nada foi alterado.';
  end if;

  -- Reexecucao: reconhece o ajuste completo e nao movimenta o saldo novamente.
  if exists(select 1 from financas.movimentos
      where id_empresa=empresa and documento='BAIXA-CR-89') then
    if origem.id_conta=19 and origem.valor=161.00
       and (select count(*) from financas.movimentos
            where id_empresa=empresa and documento='BAIXA-CR-89')=1
       and exists(select 1 from financas.movimentos
            where id_empresa=empresa and documento='BAIXA-CR-89'
              and id_conta=31 and valor=3.50 and tipo='entrada'
              and status='efetivado') then
      ja_corrigido := true;
    else
      raise exception 'Ja existe BAIXA-CR-89 com outra configuracao. Nada foi alterado.';
    end if;
  end if;

  -- Nao admite baixas extras ja integradas sobre os mesmos recebimentos.
  if exists(select 1 from financas.movimentos m
      join public.contas_receber_baixas b
        on m.documento='BAIXA-CR-' || b.id_baixa
      where b.empresa_id=empresa and m.id_empresa=empresa
        and b.id_conta in (193,249,259,269,275)
        and m.status<>'cancelado' and b.id_baixa<>89) then
    raise exception 'Existem outros movimentos por baixa. Requer nova conferencia.';
  end if;

  if not ja_corrigido then
    if origem.id_conta<>31 or origem.valor<>164.50 then
      raise exception 'Esperado movimento 45146 de R$164,50 na carteira.';
    end if;

    select saldo_atual into strict saldo_itau from financas.contas
      where id_empresa=empresa and id_conta=19;
    select saldo_atual into strict saldo_carteira from financas.contas
      where id_empresa=empresa and id_conta=31;
    if saldo_itau is null or saldo_carteira is null then
      raise exception 'Saldo das contas ausente. Nada foi alterado.';
    end if;

    update financas.movimentos
      set id_conta=19, valor=161.00, data_efetivacao=date '2026-09-03',
          observacoes=concat_ws(E'\n',nullif(observacoes,''),
            'Correcao Passione: R$161,00 no ITAU em 03/09; complemento R$3,50 na Carteira em 04/09 (BAIXA-CR-89).'),
          updated_at=now()
      where id_empresa=empresa and id_movimento=45146;

    -- Somente este gatilho exige sessao da aplicacao ao inserir.
    -- Suspensao restrita a esta transacao, sob bloqueio exclusivo da tabela.
    if not exists(select 1 from pg_trigger
        where tgrelid='financas.movimentos'::regclass
          and tgname='definir_empresa_atual' and tgenabled='O') then
      raise exception 'Gatilho de empresa diferente do esperado. Nada foi alterado.';
    end if;
    alter table financas.movimentos disable trigger definir_empresa_atual;
    insert into financas.movimentos (
      id_empresa,id_conta,tipo,valor,descricao,documento,status,
      data_movimento,data_vencimento,data_efetivacao,
      id_categoria,id_centro_custo,observacoes
    ) values (
      empresa,31,'entrada',3.50,'Recebimento V2608-037','BAIXA-CR-89','efetivado',
      date '2026-09-04',date '2026-09-04',date '2026-09-04',
      origem.id_categoria,origem.id_centro_custo,
      'Passione: complemento recebido na Carteira. R$161,00 no ITAU permanecem no movimento 45146.'
    ) returning id_movimento into novo_id;
    alter table financas.movimentos enable trigger definir_empresa_atual;

    -- Conforme as funcoes fornecidas, saldo e atualizado pela RPC, nao por
    -- gatilho de movimento. Aborta se essa regra mudou desde a conferencia.
    if (select saldo_atual from financas.contas where id_conta=19 and id_empresa=empresa)
         is distinct from saldo_itau
       or (select saldo_atual from financas.contas where id_conta=31 and id_empresa=empresa)
         is distinct from saldo_carteira then
      raise exception 'Saldo foi alterado automaticamente. Correcao desfeita para evitar duplicidade.';
    end if;

    update financas.contas
      set saldo_atual=saldo_atual+case when id_conta=19 then 161.00 else -161.00 end,
          updated_at=now()
      where id_empresa=empresa and id_conta in (19,31);

    if (select saldo_atual from financas.contas where id_conta=19 and id_empresa=empresa)
         is distinct from saldo_itau+161.00
       or (select saldo_atual from financas.contas where id_conta=31 and id_empresa=empresa)
         is distinct from saldo_carteira-161.00 then
      raise exception 'Conferencia dos saldos falhou. Correcao desfeita.';
    end if;
  end if;

  select coalesce(sum(valor) filter(where id_conta=19),0),
         coalesce(sum(valor) filter(where id_conta=31),0)
    into total_itau,total_carteira
    from financas.movimentos
    where id_empresa=empresa and tipo='entrada' and status='efetivado'
      and (id_movimento in (71944,45146,52220,61337,71938)
           or documento='BAIXA-CR-89');
  if total_itau<>400.00 or total_carteira<>400.00 then
    raise exception 'Totais inesperados: ITAU %, Carteira %. Correcao desfeita.',total_itau,total_carteira;
  end if;
  raise notice 'Conferido: ITAU R$400,00 / Carteira R$400,00. Ja corrigido antes desta execucao: %',ja_corrigido;
end;
$correcao$;

commit;

-- Resultado esperado: ITAU 400.00 e Carteira 400.00 (recebimentos da Passione).
select c.nome as conta, sum(m.valor) as recebido_passione
from financas.movimentos m
join financas.contas c on c.id_conta=m.id_conta and c.id_empresa=m.id_empresa
where m.id_empresa='9bd65462-b979-4618-bb9d-851ef003d234'::uuid
  and m.tipo='entrada' and m.status='efetivado'
  and (m.id_movimento in (71944,45146,52220,61337,71938)
       or m.documento='BAIXA-CR-89')
group by c.id_conta,c.nome
order by c.id_conta;
