-- Consulta somente leitura. Reproduz o saldo aberto calculado pelo Vendas.
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
)
select *, sum(saldo_aberto) over (partition by empresa_id) as total_aberto_empresa
from titulos
where saldo_aberto > 0.005
order by empresa, data_vencimento, id_conta;
