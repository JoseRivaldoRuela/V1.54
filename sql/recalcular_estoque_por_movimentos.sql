-- Recalcula produtos.estoque_atual usando os movimentos reais do sistema.
--
-- Regra:
-- - venda ENTREGUE baixa estoque
-- - venda CANCELADO devolve estoque
-- - compra LIBERADA entra estoque
-- - compra CANCELADA estorna estoque
-- - ajuste manual entra/sai conforme tipo_movimentacao
--
-- Use este script quando vendas/compras/tickets ja foram importados,
-- mas o saldo dos produtos precisa ser conferido/reconstruido.

with movimentos as (
  select
    vi.id_produto,
    sum(
      case
        when v.status_entrega = 'ENTREGUE' then -coalesce(vi.quantidade, 0)
        when v.status_entrega = 'CANCELADO' then coalesce(vi.quantidade, 0)
        else 0
      end
    ) as quantidade
  from public.venda_itens vi
  join public.vendas v on v.id_venda = vi.id_venda
  group by vi.id_produto

  union all

  select
    ci.id_produto,
    sum(
      case
        when c.status_compra = 'LIBERADA' then coalesce(ci.quantidade, 0)
        when c.status_compra = 'CANCELADA' then -coalesce(ci.quantidade, 0)
        else 0
      end
    ) as quantidade
  from public.compra_itens ci
  join public.compras c on c.id_compra = ci.id_compra
  group by ci.id_produto

  union all

  select
    em.id_produto,
    sum(
      case
        when em.tipo_movimentacao = 'ENTRADA_AJUSTE' then coalesce(em.quantidade, 0)
        when em.tipo_movimentacao = 'SAIDA_AJUSTE' then -coalesce(em.quantidade, 0)
        else 0
      end
    ) as quantidade
  from public.estoque_movimentacoes em
  group by em.id_produto
),
saldos as (
  select id_produto, round(sum(quantidade), 2) as saldo
  from movimentos
  group by id_produto
)
update public.produtos p
   set estoque_atual = coalesce(s.saldo, 0)
  from saldos s
 where p.id_produto = s.id_produto;

-- Zera produtos que nao possuem nenhum movimento.
update public.produtos p
   set estoque_atual = 0
 where not exists (
   select 1
   from public.venda_itens vi
   where vi.id_produto = p.id_produto
 )
   and not exists (
   select 1
   from public.compra_itens ci
   where ci.id_produto = p.id_produto
 )
   and not exists (
   select 1
   from public.estoque_movimentacoes em
   where em.id_produto = p.id_produto
 );

select
  p.nome_mercadoria,
  p.estoque_atual
from public.produtos p
where coalesce(p.estoque_atual, 0) <> 0
order by p.nome_mercadoria;
