begin;

-- INICIALIZACAO DO MOVIMENTO DO SISTEMA
--
-- Este script APAGA dados transacionais e zera saldo de estoque.
--
-- Mantem:
-- - usuarios
-- - configuracoes/tipo_cobranca
-- - clientes
-- - fornecedores
-- - produtos
-- - tipo_mercadoria
-- - produtos_precos_especiais
--
-- Apaga:
-- - contas_receber
-- - contas_pagar
-- - venda_itens
-- - vendas
-- - compra_itens
-- - compras
-- - estoque_movimentacoes
--
-- Kardex nao e uma tabela fisica neste projeto: ele e calculado a partir
-- de vendas, compras e movimentacoes de estoque. Ao limpar essas tabelas,
-- o Kardex tambem fica zerado.

do $$
declare
  r record;
  seq_name text;
begin
  -- Financeiro primeiro, para nao sobrar referencia de venda/compra.
  if to_regclass('public.contas_receber') is not null then
    delete from public.contas_receber;
  end if;

  if to_regclass('public.contas_pagar') is not null then
    delete from public.contas_pagar;
  end if;

  -- Itens antes dos cabecalhos.
  if to_regclass('public.venda_itens') is not null then
    delete from public.venda_itens;
  end if;

  if to_regclass('public.compra_itens') is not null then
    delete from public.compra_itens;
  end if;

  -- Cabecalhos.
  if to_regclass('public.vendas') is not null then
    delete from public.vendas;
  end if;

  if to_regclass('public.compras') is not null then
    delete from public.compras;
  end if;

  -- Movimentacoes manuais de estoque.
  if to_regclass('public.estoque_movimentacoes') is not null then
    delete from public.estoque_movimentacoes;
  end if;

  -- Zera saldo dos produtos, mantendo cadastro, custo, venda, fornecedor e tipo.
  if to_regclass('public.produtos') is not null then
    update public.produtos
       set estoque_atual = 0;
  end if;

  -- Reinicia sequencias apenas das tabelas transacionais.
  for r in
    select *
    from (
      values
        ('public.contas_receber', 'id_conta'),
        ('public.contas_pagar', 'id_conta_pagar'),
        ('public.venda_itens', 'id_item'),
        ('public.vendas', 'id_venda'),
        ('public.compra_itens', 'id_item_compra'),
        ('public.compras', 'id_compra'),
        ('public.estoque_movimentacoes', 'id_movimentacao')
    ) as s(table_name, column_name)
  loop
    if to_regclass(r.table_name) is not null then
      select pg_get_serial_sequence(r.table_name, r.column_name) into seq_name;
      if seq_name is not null then
        execute format('alter sequence %s restart with 1', seq_name::regclass);
      end if;
    end if;
  end loop;
end $$;

-- Conferencia final.
select 'vendas' as tabela, count(*) as registros from public.vendas
union all select 'venda_itens', count(*) from public.venda_itens
union all select 'compras', count(*) from public.compras
union all select 'compra_itens', count(*) from public.compra_itens
union all select 'contas_receber', count(*) from public.contas_receber
union all select 'contas_pagar', count(*) from public.contas_pagar
union all select 'estoque_movimentacoes', count(*) from public.estoque_movimentacoes
union all select 'produtos_com_saldo', count(*) from public.produtos where coalesce(estoque_atual, 0) <> 0;

commit;
