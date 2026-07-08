do $$
declare
  v_ticket jsonb;
  v_item jsonb;
  v_id_cliente bigint;
  v_id_tipo bigint;
  v_id_venda bigint;
  v_id_produto bigint;
  v_codigo text;
  v_prefixo text;
  v_seq integer;
  v_data timestamptz;
  v_vencimento date;
  v_data_recebimento timestamptz;
  v_import_ref text;
  v_cliente text;
  v_obs text;
  v_total numeric(12,2);
  v_total_custo numeric(12,2);
  v_item_has_subtotal boolean;
  v_item_subtotal_generated boolean;
  v_recebido boolean;
  v_meio_pagamento text;
  v_tickets jsonb := $json$
[
  {
    "arquivo": "3819_Tuba_Pizza_Agua_Verde_.pdf",
    "offline": "394bfd",
    "cliente": "Tuba Pizza Agua Verde",
    "data_venda": "2026-05-06 12:38:44-03",
    "vencimento": "2026-05-06",
    "pagamento": "BOLETO",
    "data_recebimento": "2026-05-15 17:59:45-03",
    "recebido": true,
    "total": 2136.00,
    "observacoes": "Pix 049.161.108-03",
    "itens": [
      { "produto": "Batata palha Extra fina taico", "quantidade": 120, "preco_unitario": 17.80, "subtotal": 2136.00 }
    ]
  },
  {
    "arquivo": "3821_Consumidor__.pdf",
    "offline": "3baebf",
    "cliente": "Consumidor",
    "data_venda": "2026-05-07 12:00:24-03",
    "vencimento": "2026-05-07",
    "pagamento": "BOLETO",
    "data_recebimento": "2026-05-15 17:55:01-03",
    "recebido": true,
    "total": 96.00,
    "observacoes": "Pix 049.161.108-03",
    "itens": [
      { "produto": "Palmito coração unidade", "quantidade": 2, "preco_unitario": 48.00, "subtotal": 96.00 }
    ]
  },
  {
    "arquivo": "3822_Ademar_Hot_Dog_.pdf",
    "offline": "b622b0",
    "cliente": "Ademar Hot Dog",
    "data_venda": "2026-05-07 12:01:16-03",
    "vencimento": "2026-05-07",
    "pagamento": "BOLETO",
    "data_recebimento": "2026-05-29 21:22:41-03",
    "recebido": true,
    "total": 218.40,
    "observacoes": "Pix 049.161.108-03",
    "itens": [
      { "produto": "Batata palha Extra fina taico", "quantidade": 12, "preco_unitario": 18.20, "subtotal": 218.40 }
    ]
  },
  {
    "arquivo": "3823_Ravena_.pdf",
    "offline": "7e44f7",
    "cliente": "Ravena",
    "data_venda": "2026-05-07 22:08:25-03",
    "vencimento": "2026-05-07",
    "pagamento": "BOLETO",
    "data_recebimento": "2026-05-29 21:22:53-03",
    "recebido": true,
    "total": 299.50,
    "observacoes": "Pix 049.161.108-03",
    "itens": [
      { "produto": "Batata palha estrelinha extra fina", "quantidade": 15, "preco_unitario": 17.50, "subtotal": 262.50 },
      { "produto": "Tomate seco bayleaf 1.4kg", "quantidade": 1, "preco_unitario": 37.00, "subtotal": 37.00 }
    ]
  }
]
$json$::jsonb;
begin
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

  for v_ticket in select * from jsonb_array_elements(v_tickets)
  loop
    v_cliente := trim(v_ticket->>'cliente');
    v_data := (v_ticket->>'data_venda')::timestamptz;
    v_vencimento := (v_ticket->>'vencimento')::date;
    v_recebido := coalesce((v_ticket->>'recebido')::boolean, false);
    v_meio_pagamento := upper(coalesce(v_ticket->>'pagamento', 'BOLETO'));
    v_total := (v_ticket->>'total')::numeric;
    v_data_recebimento := nullif(v_ticket->>'data_recebimento', '')::timestamptz;
    v_import_ref := 'IMPORT-TICKET-' || regexp_replace(v_ticket->>'offline', '[^A-Za-z0-9]+', '', 'g');
    v_obs := 'Ticket importado [' || v_import_ref || ']. Arquivo: ' || (v_ticket->>'arquivo') ||
             '. Vendedor: Rivaldo. Observacoes originais: ' || coalesce(v_ticket->>'observacoes', '') ||
             '. Saldo devedor do ticket ignorado na importacao.';

    select id_cliente
      into v_id_cliente
    from public.clientes
    where lower(trim(coalesce(nome_fantasia, razao_social))) = lower(v_cliente)
       or lower(trim(razao_social)) = lower(v_cliente)
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
        v_cliente,
        v_cliente,
        'Cliente criado automaticamente na importacao do ticket ' || v_import_ref,
        true
      )
      returning id_cliente into v_id_cliente;
    end if;

    if exists (
      select 1
      from public.vendas
      where coalesce(observacoes, '') like '%' || v_import_ref || '%'
    ) then
      select id_venda, codigo_venda
        into v_id_venda, v_codigo
      from public.vendas
      where coalesce(observacoes, '') like '%' || v_import_ref || '%'
      order by id_venda desc
      limit 1;

      update public.contas_receber
         set observacoes = 'Pedido ' || coalesce(v_codigo, '#' || v_id_venda::text) ||
                           ' - Parcela 1/1 - importado de ' || v_import_ref,
             status_recebimento = case when v_recebido then 'RECEBIDO' else 'PENDENTE' end,
             valor_recebido = case when v_recebido then valor_original else 0 end,
             data_recebimento = case when v_recebido then v_data_recebimento else null end
       where id_venda = v_id_venda;

      raise notice 'Ticket % ja importado como venda %. Conta a receber atualizada sem duplicar.', v_import_ref, v_codigo;
      continue;
    end if;

    v_total_custo := 0;
    for v_item in select * from jsonb_array_elements(v_ticket->'itens')
    loop
      select id_produto
        into v_id_produto
      from public.produtos
      where lower(trim(nome_mercadoria)) = lower(trim(v_item->>'produto'))
      order by id_produto
      limit 1;

      if v_id_produto is null then
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
          trim(v_item->>'produto'),
          v_id_tipo,
          'UN',
          0,
          0,
          (v_item->>'preco_unitario')::numeric,
          'Produto criado automaticamente na importacao do ticket ' || v_import_ref,
          true
        )
        returning id_produto into v_id_produto;
      end if;

      v_total_custo := v_total_custo +
        (coalesce((select preco_custo from public.produtos where id_produto = v_id_produto), 0) *
         (v_item->>'quantidade')::numeric);
    end loop;

    v_total_custo := round(v_total_custo, 2);
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
      v_total,
      v_meio_pagamento,
      1,
      greatest(v_vencimento - v_data::date, 0),
      v_vencimento,
      v_obs
    )
    returning id_venda into v_id_venda;

    for v_item in select * from jsonb_array_elements(v_ticket->'itens')
    loop
      select id_produto
        into v_id_produto
      from public.produtos
      where lower(trim(nome_mercadoria)) = lower(trim(v_item->>'produto'))
      order by id_produto
      limit 1;

      if v_item_has_subtotal and not v_item_subtotal_generated then
        insert into public.venda_itens (
          id_venda,
          id_produto,
          quantidade,
          preco_unitario,
          desconto_item,
          subtotal
        )
        values (
          v_id_venda,
          v_id_produto,
          (v_item->>'quantidade')::numeric,
          (v_item->>'preco_unitario')::numeric,
          0,
          (v_item->>'subtotal')::numeric
        );
      else
        insert into public.venda_itens (
          id_venda,
          id_produto,
          quantidade,
          preco_unitario,
          desconto_item
        )
        values (
          v_id_venda,
          v_id_produto,
          (v_item->>'quantidade')::numeric,
          (v_item->>'preco_unitario')::numeric,
          0
        );
      end if;
    end loop;

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
      v_vencimento,
      v_total,
      case when v_recebido then v_total else 0 end,
      v_meio_pagamento,
      case when v_recebido then 'RECEBIDO' else 'PENDENTE' end,
      case when v_recebido then v_data_recebimento else null end,
      'Pedido ' || v_codigo || ' - Parcela 1/1 - importado de ' || v_import_ref
    );

    raise notice 'Ticket % importado com sucesso como venda %. Cliente: %.', v_import_ref, v_codigo, v_cliente;
  end loop;

  -- Recalcula o estoque pelo movimento real para evitar baixa duplicada.
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
end $$;

select
  v.codigo_venda,
  coalesce(c.nome_fantasia, c.razao_social) as cliente,
  v.data_venda,
  v.valor_final,
  cr.status_recebimento,
  cr.data_vencimento,
  cr.data_recebimento,
  cr.valor_recebido
from public.vendas v
join public.clientes c on c.id_cliente = v.id_cliente
left join public.contas_receber cr on cr.id_venda = v.id_venda
where coalesce(v.observacoes, '') like '%IMPORT-TICKET-%'
  and coalesce(v.observacoes, '') ~ 'IMPORT-TICKET-(394bfd|3baebf|b622b0|7e44f7)'
order by v.data_venda, v.id_venda;
