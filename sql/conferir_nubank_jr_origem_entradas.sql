-- Somente leitura. Todas as entradas da Nubank JR, sem filtro de periodo/status.
-- Sem vinculo nao comprova origem manual: pode haver integracao antiga sem vinculo.
with entradas as (
  select m.*, conta.nome as nome_conta, e.nome as empresa
  from financas.movimentos m
  join financas.contas conta on conta.id_conta=m.id_conta
                           and conta.id_empresa=m.id_empresa
  join public.empresas e on e.id_empresa=m.id_empresa
  where conta.nome ilike '%nubank%jr%' and m.tipo='entrada'
)
select m.empresa, m.nome_conta, m.id_movimento, m.valor, m.status,
       m.data_movimento, m.data_vencimento, m.data_efetivacao,
       m.documento, m.descricao,
       to_jsonb(m)->>'origem' as origem_se_registrada,
       case
         when baixas.quantidade>0 and abs(m.valor-baixas.total)>0.005
           then 'VALOR DIFERENTE DA BAIXA VINCULADA'
         when baixas.quantidade>0 and m.status='efetivado'
           then 'RECEBIMENTO COM BAIXA IDENTIFICADA'
         when baixas.quantidade>0
           then 'BAIXA IDENTIFICADA: CONFERIR STATUS DO MOVIMENTO'
         when titulos.vinculados>0
           then 'VINCULADO AO TITULO: CONFERIR BAIXA LEGADA'
         when titulos.quantidade>0
           then 'PEDIDO IDENTIFICADO, SEM VINCULO DIRETO: CONFERIR'
         else 'SEM BAIXA OU TITULO IDENTIFICADO: INVESTIGAR ORIGEM'
       end as conferencia,
       baixas.quantidade as quantidade_baixas_identificadas,
       baixas.total as valor_baixas_identificadas,
       baixas.detalhes as baixas_contas_receber,
       titulos.detalhes as titulos_relacionados
from entradas m
left join lateral (
  select count(*) as quantidade, sum(b.valor_baixa) as total,
         jsonb_agg(jsonb_build_object(
           'id_baixa',b.id_baixa,'titulo',b.id_conta,
           'cliente',coalesce(c.nome_fantasia,c.razao_social),
           'pedido',v.codigo_venda,'valor_baixa',b.valor_baixa,
           'data_baixa',b.data_baixa,'status_titulo',cr.status_recebimento,
           'valor_original',cr.valor_original,'valor_recebido',cr.valor_recebido
         ) order by b.id_baixa) as detalhes
  from public.contas_receber_baixas b
  join public.contas_receber cr on cr.id_conta=b.id_conta
                             and cr.empresa_id=m.id_empresa
  join public.clientes c on c.id_cliente=cr.id_cliente
                       and c.empresa_id=cr.empresa_id
  left join public.vendas v on v.id_venda=cr.id_venda
                          and v.empresa_id=cr.empresa_id
  where m.documento='BAIXA-CR-' || b.id_baixa::text
) baixas on true
left join lateral (
  select count(*) as quantidade,
         count(*) filter(where cr.id_movimento_financas=m.id_movimento) as vinculados,
         jsonb_agg(jsonb_build_object(
           'titulo',cr.id_conta,'cliente',coalesce(c.nome_fantasia,c.razao_social),
           'pedido',v.codigo_venda,'status',cr.status_recebimento,
           'valor_original',cr.valor_original,'valor_recebido',cr.valor_recebido,
           'movimento_vinculado',cr.id_movimento_financas,
           'vinculo_direto',cr.id_movimento_financas=m.id_movimento
         ) order by cr.id_conta) as detalhes
  from public.contas_receber cr
  join public.clientes c on c.id_cliente=cr.id_cliente
                       and c.empresa_id=cr.empresa_id
  left join public.vendas v on v.id_venda=cr.id_venda
                          and v.empresa_id=cr.empresa_id
  where cr.empresa_id=m.id_empresa
    and (cr.id_movimento_financas=m.id_movimento
      or m.documento=v.codigo_venda
      or m.descricao='Venda ' || v.codigo_venda)
) titulos on true
order by (m.valor in (2160.00,2700.00)) desc,
         m.data_movimento desc, m.id_movimento desc;
