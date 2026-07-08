-- Atualiza vendas.valor_final e contas_receber para considerar desconto_total
-- Uso: revise o SELECT de preview antes de aplicar em produção.

BEGIN;

-- Preview: consulte os registros que serão afetados
-- WITH venda_preview AS (
--   SELECT
--     v.id_venda,
--     v.codigo_venda,
--     v.desconto_total,
--     round(coalesce(sum(coalesce(vi.subtotal, (vi.quantidade * vi.preco_unitario) - coalesce(vi.desconto_item,0))),0) - coalesce(v.desconto_total,0),2) AS novo_valor_final,
--     count(cr.*) FILTER (WHERE cr.id_conta IS NOT NULL) AS contas_qtd,
--     round(coalesce(sum(cr.valor_original),0),2) AS soma_contas,
--     round(coalesce(sum(cr.valor_recebido),0),2) AS soma_recebido
--   FROM public.vendas v
--   LEFT JOIN public.venda_itens vi ON vi.id_venda = v.id_venda
--   LEFT JOIN public.contas_receber cr ON cr.id_venda = v.id_venda
--   WHERE coalesce(v.desconto_total,0) <> 0
--   GROUP BY v.id_venda, v.codigo_venda, v.desconto_total
-- )
-- SELECT *
-- FROM venda_preview vp
-- WHERE vp.novo_valor_final IS DISTINCT FROM round(coalesce((SELECT valor_final FROM public.vendas v2 WHERE v2.id_venda = vp.id_venda),0),2)
-- ORDER BY vp.id_venda;

-- Atualiza valor_final nas vendas usando o total dos itens menos o desconto_total
WITH venda_total AS (
  SELECT
    v.id_venda,
    round(
      coalesce(sum(coalesce(vi.subtotal, (vi.quantidade * vi.preco_unitario) - coalesce(vi.desconto_item,0))),0)
      - coalesce(v.desconto_total,0)
    , 2) AS novo_valor_final
  FROM public.vendas v
  LEFT JOIN public.venda_itens vi ON vi.id_venda = v.id_venda
  GROUP BY v.id_venda, v.desconto_total
)
UPDATE public.vendas v
SET valor_final = vt.novo_valor_final
FROM venda_total vt
WHERE v.id_venda = vt.id_venda
  AND coalesce(v.desconto_total,0) <> 0
  AND round(coalesce(v.valor_final,0),2) <> vt.novo_valor_final;

-- Atualiza contas_receber para refletir as correções de valor_final
WITH contas_por_venda AS (
  SELECT id_venda, sum(valor_original) AS soma_original
  FROM public.contas_receber
  GROUP BY id_venda
)
UPDATE public.contas_receber cr
SET
  valor_original = round(
    CASE
      WHEN cpv.soma_original > 0 THEN (v.valor_final * cr.valor_original / cpv.soma_original)
      ELSE v.valor_final
    END
  , 2),
  valor_recebido = CASE
    WHEN cr.status_recebimento = 'RECEBIDO' THEN
      round(
        CASE
          WHEN cpv.soma_original > 0 THEN (v.valor_final * cr.valor_original / cpv.soma_original)
          ELSE v.valor_final
        END
      , 2)
    ELSE 0
  END
FROM public.vendas v
LEFT JOIN contas_por_venda cpv ON cpv.id_venda = cr.id_venda
WHERE cr.id_venda = v.id_venda
  AND v.id_venda IN (
    SELECT id_venda FROM public.vendas WHERE coalesce(desconto_total,0) <> 0
  )
  AND (
    cr.valor_original IS DISTINCT FROM round(
      CASE
        WHEN cpv.soma_original > 0 THEN (v.valor_final * cr.valor_original / cpv.soma_original)
        ELSE v.valor_final
      END
    , 2)
    OR cr.valor_recebido IS DISTINCT FROM CASE
      WHEN cr.status_recebimento = 'RECEBIDO' THEN
        round(
          CASE
            WHEN cpv.soma_original > 0 THEN (v.valor_final * cr.valor_original / cpv.soma_original)
            ELSE v.valor_final
          END
        , 2)
      ELSE 0
    END
  );

COMMIT;

-- Observações:
-- 1) Faça backup antes de executar em produção.
-- 2) Descomente o bloco de preview para validar registros antes de rodar.
-- 3) O UPDATE de contas_receber preserva a proporção entre parcelas quando há mais de um registro por venda.
-- 4) Se sua venda tiver valores recebidos parciais, revise manualmente após a aplicação.
-- 5) No Supabase, cole este SQL no Query Editor ou execute via psql com a string de conexão do banco.
