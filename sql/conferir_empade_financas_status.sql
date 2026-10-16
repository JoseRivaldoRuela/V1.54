-- Mesma base da consulta Vendas: somente titulos abertos, sem cancelados.
-- Uma linha por titulo. Movimentos pagos/cancelados continuam visiveis
-- quando correspondem a um titulo que ainda esta aberto no Vendas.
-- Candidatos sem vinculo nao sao considerados conciliados automaticamente.
with titulos as (
  select e.nome as empresa, cr.empresa_id, cr.id_usuario,
         coalesce(c.nome_fantasia, c.razao_social) as cliente,
         cr.id_conta, v.codigo_venda as pedido,
         cr.numero_parcela, cr.total_parcelas, cr.data_vencimento,
         cr.status_recebimento, cr.valor_original, cr.valor_recebido,
         cr.id_conta_financas, cr.id_movimento_financas,
         greatest(0, coalesce(cr.valor_original, 0) -
           case when cr.status_recebimento = 'RECEBIDO'
                     and coalesce(cr.valor_recebido, 0) <= 0
                then coalesce(cr.valor_original, 0)
                else least(coalesce(cr.valor_original, 0),
                           greatest(0, coalesce(cr.valor_recebido, 0)))
           end) as saldo_aberto
  from public.contas_receber cr
  join public.clientes c on c.id_cliente = cr.id_cliente
                       and c.empresa_id = cr.empresa_id
  join public.empresas e on e.id_empresa = cr.empresa_id
  left join public.vendas v on v.id_venda = cr.id_venda
                          and v.empresa_id = cr.empresa_id
  where (c.nome_fantasia ilike '%EMPADE%'
      or c.razao_social ilike '%EMPADE%')
    and upper(trim(coalesce(cr.status_recebimento, ''))) <> 'CANCELADO'
), abertos as (
  select * from titulos where saldo_aberto > 0.005
)
select t.empresa, t.empresa_id, t.id_usuario, t.cliente,
       t.id_conta as titulo_vendas, t.pedido,
       t.numero_parcela, t.total_parcelas, t.data_vencimento as vencimento_vendas,
       t.status_recebimento as status_vendas, t.valor_original,
       t.valor_recebido, t.saldo_aberto,
       sum(t.saldo_aberto) over (partition by t.empresa_id) as total_aberto_vendas,
       t.id_movimento_financas as vinculo_gravado,
       m.id_movimento as movimento_encontrado, m.id_conta as conta_financas,
       m.valor as valor_financas, m.status as status_financas,
       case when m.id_movimento is null then 'SEM MOVIMENTO VINCULADO ENCONTRADO'
            when m.status = 'efetivado' then 'RECEBIDO / PAGO'
            when m.status = 'pendente' then 'EM ABERTO'
            when m.status = 'cancelado' then 'CANCELADO'
            else m.status end as situacao_financas,
       m.data_vencimento as vencimento_financas, m.data_efetivacao,
       case
         when t.id_movimento_financas is null and candidatos.quantidade > 0
           then 'SEM VINCULO: existem candidatos pelo pedido/baixa; conferir'
         when t.id_movimento_financas is null
           then 'SEM VINCULO E SEM CANDIDATO IDENTIFICADO'
         when m.id_movimento is null then 'VINCULO APONTA PARA MOVIMENTO NAO ENCONTRADO'
         when m.tipo <> 'entrada' then 'MOVIMENTO NAO E ENTRADA'
         when m.status = 'efetivado' then 'ABERTO NO VENDAS / RECEBIDO NO FINANCAS'
         when m.status = 'cancelado' then 'ABERTO NO VENDAS / CANCELADO NO FINANCAS'
         when m.status is distinct from 'pendente' then 'STATUS FINANCAS DIFERENTE DE PENDENTE'
         when m.valor is null or abs(m.valor-t.saldo_aberto) > 0.005 then 'VALORES DIVERGENTES'
         when m.data_vencimento::date is distinct from t.data_vencimento::date then 'VENCIMENTOS DIVERGENTES'
         when (select count(*) from public.contas_receber outro
               where outro.empresa_id=t.empresa_id
                 and outro.id_movimento_financas=t.id_movimento_financas) > 1
           then 'MOVIMENTO VINCULADO A MAIS DE UM TITULO'
         else 'CONFERIDO'
       end as conferencia,
       candidatos.movimentos as outros_movimentos_para_conferir
from abertos t
left join financas.movimentos m
       on m.id_movimento=t.id_movimento_financas and m.id_empresa=t.empresa_id
left join lateral (
  select count(*) as quantidade,
         jsonb_agg(jsonb_build_object(
           'id_movimento', candidato.id_movimento,
           'conta', candidato.id_conta, 'valor', candidato.valor,
           'status', candidato.status, 'documento', candidato.documento,
           'descricao', candidato.descricao,
           'vencimento', candidato.data_vencimento
         ) order by candidato.id_movimento) as movimentos
  from financas.movimentos candidato
  where candidato.id_empresa=t.empresa_id and candidato.tipo='entrada'
    and candidato.id_movimento is distinct from t.id_movimento_financas
    and (
      candidato.documento=t.pedido
      or candidato.descricao='Venda ' || t.pedido
      or exists (
        select 1 from public.contas_receber_baixas b
        where b.id_conta=t.id_conta
          and candidato.documento='BAIXA-CR-' || b.id_baixa::text
      )
    )
) candidatos on true
order by t.empresa, t.data_vencimento, t.id_conta;
