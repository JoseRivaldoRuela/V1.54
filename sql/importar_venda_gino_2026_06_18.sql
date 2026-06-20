do $$
declare
  v_id_cliente bigint;
  v_id_tipo bigint;
  v_id_venda bigint;
  v_codigo text;
  v_prefixo text;
  v_seq integer;
  v_data timestamptz := '2026-06-18 19:40:04-03';
  v_import_ref text := 'IMPORT-GINO-20260618-194004';
  v_obs text := 'Pedido importado [' || v_import_ref || ']. Vendedor: Rivaldo. Observacoes originais: Pix 049.161.108-03. Saldo devedor informado no pedido: R$ 2.120,60.';
  v_item_has_subtotal boolean;
  v_item_subtotal_generated boolean;
  v_total_custo numeric(12,2);
  v_prod_batata bigint;
  v_prod_palmito bigint;
  v_prod_champ bigint;
begin
  select id_cliente
    into v_id_cliente
  from public.clientes
  where lower(coalesce(nome_fantasia, razao_social)) = lower('Gino')
     or lower(razao_social) = lower('Gino')
  order by id_cliente
  limit 1;

  if v_id_cliente is null then
    insert into public.clientes (
      razao_social,
      nome_fantasia,
      observacoes,
      ativo
    )
    values (
      'Gino',
      'Gino',
      'Cliente criado automaticamente na importacao do pedido ' || v_codigo,
      true
    )
    returning id_cliente into v_id_cliente;
  end if;

  if exists (
    select 1
    from public.vendas
    where id_cliente = v_id_cliente
      and data_venda = v_data
      and valor_final = 276.40
      and coalesce(observacoes, '') like '%' || v_import_ref || '%'
  ) then
    select id_venda, codigo_venda
      into v_id_venda, v_codigo
    from public.vendas
    where id_cliente = v_id_cliente
      and data_venda = v_data
      and valor_final = 276.40
      and coalesce(observacoes, '') like '%' || v_import_ref || '%'
    order by id_venda desc
    limit 1;

    update public.contas_receber
      set observacoes = 'Pedido ' || coalesce(v_codigo, '#' || v_id_venda::text) || ' - Parcela 1/1 - importado de ' || v_import_ref
    where id_venda = v_id_venda;

    raise notice 'Este pedido ja foi importado anteriormente. Conta a receber atualizada com o codigo do pedido %. Nada foi duplicado.', v_codigo;
    return;
  end if;

  v_prefixo := 'V' || to_char(v_data, 'YYMM') || '-';

  select coalesce(max(substring(codigo_venda from length(v_prefixo) + 1)::integer), 0) + 1
    into v_seq
  from public.vendas
  where codigo_venda like v_prefixo || '___'
    and substring(codigo_venda from length(v_prefixo) + 1) ~ '^[0-9]{3}$';

  v_codigo := v_prefixo || lpad(v_seq::text, 3, '0');

  while exists (select 1 from public.vendas where codigo_venda = v_codigo) loop
    v_seq := v_seq + 1;
    v_codigo := v_prefixo || lpad(v_seq::text, 3, '0');
  end loop;

  select id_tipo
    into v_id_tipo
  from public.tipo_mercadoria
  where lower(descricao) = lower('Importado de pedido')
  order by id_tipo
  limit 1;

  if v_id_tipo is null then
    insert into public.tipo_mercadoria (descricao)
    values ('Importado de pedido')
    returning id_tipo into v_id_tipo;
  end if;

  select id_produto
    into v_prod_batata
  from public.produtos
  where lower(nome_mercadoria) = lower('Batata palha extra fina wanflo 900gr')
  order by id_produto
  limit 1;

  if v_prod_batata is null then
    insert into public.produtos (
      nome_mercadoria,
      id_tipo,
      unidade,
      estoque_atual,
      preco_custo,
      preco_venda,
      observacoes,
      ativo
    )
    values (
      'Batata palha extra fina wanflo 900gr',
      v_id_tipo,
      'UN',
      0,
      0,
      23.60,
      'Produto criado automaticamente na importacao do pedido ' || v_codigo,
      true
    )
    returning id_produto into v_prod_batata;
  end if;

  select id_produto
    into v_prod_palmito
  from public.produtos
  where lower(nome_mercadoria) = lower('Palmito Picado vacuo 1.8kg')
  order by id_produto
  limit 1;

  if v_prod_palmito is null then
    insert into public.produtos (
      nome_mercadoria,
      id_tipo,
      unidade,
      estoque_atual,
      preco_custo,
      preco_venda,
      observacoes,
      ativo
    )
    values (
      'Palmito Picado vacuo 1.8kg',
      v_id_tipo,
      'UN',
      0,
      0,
      22.00,
      'Produto criado automaticamente na importacao do pedido ' || v_codigo,
      true
    )
    returning id_produto into v_prod_palmito;
  end if;

  select id_produto
    into v_prod_champ
  from public.produtos
  where lower(nome_mercadoria) = lower('Champ bayleaf 2kg')
  order by id_produto
  limit 1;

  if v_prod_champ is null then
    insert into public.produtos (
      nome_mercadoria,
      id_tipo,
      unidade,
      estoque_atual,
      preco_custo,
      preco_venda,
      observacoes,
      ativo
    )
    values (
      'Champ bayleaf 2kg',
      v_id_tipo,
      'UN',
      0,
      0,
      42.00,
      'Produto criado automaticamente na importacao do pedido ' || v_codigo,
      true
    )
    returning id_produto into v_prod_champ;
  end if;

  select
    round((
      (coalesce((select preco_custo from public.produtos where id_produto = v_prod_batata), 0) * 9) +
      (coalesce((select preco_custo from public.produtos where id_produto = v_prod_palmito), 0) * 1) +
      (coalesce((select preco_custo from public.produtos where id_produto = v_prod_champ), 0) * 1)
    )::numeric, 2)
    into v_total_custo;

  insert into public.vendas (
    codigo_venda,
    id_cliente,
    data_venda,
    status_entrega,
    data_entrega,
    valor_produtos,
    desconto_total,
    valor_final,
    meio_pagamento,
    quantidade_parcelas,
    dias_vencimento,
    data_vencimento,
    observacoes
  )
  values (
    v_codigo,
    v_id_cliente,
    v_data,
    'ENTREGUE',
    v_data,
    v_total_custo,
    0,
    276.40,
    'BOLETO',
    1,
    0,
    '2026-06-18',
    v_obs
  )
  returning id_venda into v_id_venda;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'venda_itens'
      and column_name = 'subtotal'
  ) into v_item_has_subtotal;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'venda_itens'
      and column_name = 'subtotal'
      and is_generated <> 'NEVER'
  ) into v_item_subtotal_generated;

  if v_item_has_subtotal and not v_item_subtotal_generated then
    insert into public.venda_itens (
      id_venda,
      id_produto,
      quantidade,
      preco_unitario,
      desconto_item,
      subtotal
    )
    values
      (v_id_venda, v_prod_batata, 9, 23.60, 0, 212.40),
      (v_id_venda, v_prod_palmito, 1, 22.00, 0, 22.00),
      (v_id_venda, v_prod_champ, 1, 42.00, 0, 42.00);
  else
    insert into public.venda_itens (
      id_venda,
      id_produto,
      quantidade,
      preco_unitario,
      desconto_item
    )
    values
      (v_id_venda, v_prod_batata, 9, 23.60, 0),
      (v_id_venda, v_prod_palmito, 1, 22.00, 0),
      (v_id_venda, v_prod_champ, 1, 42.00, 0);
  end if;

  update public.produtos
    set estoque_atual = coalesce(estoque_atual, 0) - 9
  where id_produto = v_prod_batata;

  update public.produtos
    set estoque_atual = coalesce(estoque_atual, 0) - 1
  where id_produto = v_prod_palmito;

  update public.produtos
    set estoque_atual = coalesce(estoque_atual, 0) - 1
  where id_produto = v_prod_champ;

  insert into public.contas_receber (
    id_venda,
    id_cliente,
    data_vencimento,
    valor_original,
    valor_recebido,
    meio_pagamento,
    status_recebimento,
    data_recebimento,
    observacoes
  )
  values (
    v_id_venda,
    v_id_cliente,
    '2026-06-18',
    276.40,
    0,
    'BOLETO',
    'PENDENTE',
    null,
    'Pedido ' || v_codigo || ' - Parcela 1/1 - importado de ' || v_import_ref
  );

  raise notice 'Venda % importada com sucesso. id_venda=% cliente=%', v_codigo, v_id_venda, v_id_cliente;
end $$;
