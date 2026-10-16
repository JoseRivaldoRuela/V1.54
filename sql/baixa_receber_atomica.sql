-- Instalar INTEIRO no SQL Editor do Supabase, como postgres.
-- Cada chamada RPC e uma unica transacao: titulo, historico e Financas.
begin;
create table if not exists public.baixas_receber_operacoes (
  id_operacao uuid primary key,
  empresa_id uuid not null references public.empresas(id_empresa),
  id_usuario bigint not null,
  requisicao jsonb not null,
  resultado jsonb,
  criado_em timestamptz not null default now()
);
alter table public.baixas_receber_operacoes enable row level security;
drop policy if exists escopo_operacao_baixa on public.baixas_receber_operacoes;
create policy escopo_operacao_baixa on public.baixas_receber_operacoes
  for all to anon, authenticated
  using (empresa_id=public.app_empresa_atual() and id_usuario=public.app_usuario_atual())
  with check (empresa_id=public.app_empresa_atual() and id_usuario=public.app_usuario_atual());
grant select,insert,update on public.baixas_receber_operacoes to anon,authenticated;

CREATE OR REPLACE FUNCTION public.baixar_contas_receber_atomico(
    p_id_operacao UUID,p_itens JSONB,p_data_baixa TIMESTAMPTZ,
    p_atualizar_financas BOOLEAN,p_id_conta_financas BIGINT,
    p_id_categoria BIGINT,p_observacoes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,financas,pg_temp AS $baixa$
DECLARE
    empresa UUID:=public.app_empresa_atual();
    usuario BIGINT:=public.app_usuario_atual();
    requisicao JSONB;
    operacao public.baixas_receber_operacoes%ROWTYPE;
    item JSONB;
    titulo public.contas_receber%ROWTYPE;
    original financas.movimentos%ROWTYPE;
    baixa_id BIGINT;
    movimento_id BIGINT;
    vinculo_id BIGINT;
    categoria_id BIGINT:=p_id_categoria;
    valor_baixa NUMERIC;
    recebido_antes NUMERIC;
    recebido_depois NUMERIC;
    saldo NUMERIC;
    total NUMERIC:=0;
    integrado BOOLEAN;
    codigo TEXT;
    argumentos JSONB;
    retorno JSONB;
    chamada TEXT;
    rotina TEXT;
    resultados JSONB:='[]'::JSONB;
    baixas_integradas NUMERIC;
    legado NUMERIC;
    data_local DATE:=(p_data_baixa AT TIME ZONE 'America/Sao_Paulo')::DATE;
BEGIN
    IF empresa IS NULL OR usuario IS NULL THEN RAISE EXCEPTION 'Sessao invalida ou expirada'; END IF;
    IF p_id_operacao IS NULL OR p_data_baixa IS NULL
       OR jsonb_typeof(p_itens) IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_itens) NOT BETWEEN 1 AND 500 THEN
        RAISE EXCEPTION 'Dados da baixa invalidos';
    END IF;
    IF (SELECT COUNT(DISTINCT (i->>'id_conta')::BIGINT) FROM jsonb_array_elements(p_itens) i)
       <>jsonb_array_length(p_itens) THEN RAISE EXCEPTION 'Titulos repetidos no lote'; END IF;
    requisicao:=jsonb_build_object('itens',p_itens,'data',p_data_baixa,
        'integrar',p_atualizar_financas,'conta',p_id_conta_financas,
        'categoria',p_id_categoria,'observacoes',p_observacoes);
    INSERT INTO public.baixas_receber_operacoes(id_operacao,empresa_id,id_usuario,requisicao)
        VALUES(p_id_operacao,empresa,usuario,requisicao) ON CONFLICT DO NOTHING;
    SELECT * INTO operacao FROM public.baixas_receber_operacoes
        WHERE id_operacao=p_id_operacao AND empresa_id=empresa AND id_usuario=usuario FOR UPDATE;
    IF NOT FOUND OR operacao.requisicao IS DISTINCT FROM requisicao THEN
        RAISE EXCEPTION 'Identificador de baixa ja usado com outros dados';
    END IF;
    IF operacao.resultado IS NOT NULL THEN RETURN operacao.resultado; END IF;
    SELECT COALESCE(p_atualizar_financas,FALSE) AND e.integra_vendas_financas
        INTO integrado FROM public.empresas e WHERE e.id_empresa=empresa;
    IF p_atualizar_financas AND integrado IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Configuracao da integracao mudou. Atualize a tela antes de baixar.';
    END IF;
    IF integrado THEN
        PERFORM 1 FROM financas.contas WHERE id_empresa=empresa AND id_conta=p_id_conta_financas
            AND ativo AND tipo<>'cartao' FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Conta do Financas invalida ou indisponivel'; END IF;
        IF categoria_id IS NULL THEN
            SELECT id_categoria INTO categoria_id FROM financas.categorias
                WHERE id_empresa=empresa AND ativo AND uso='entrada' AND lower(trim(nome))='vendas'
                ORDER BY id_categoria LIMIT 1;
            IF categoria_id IS NULL THEN
                INSERT INTO financas.categorias(nome,uso,tipo,cor,descricao,ativo)
                    VALUES('Vendas','entrada',NULL,'#19d89f','Categoria da integracao Vendas',TRUE)
                    RETURNING id_categoria INTO categoria_id;
            END IF;
        END IF;
        PERFORM 1 FROM financas.categorias WHERE id_empresa=empresa
            AND id_categoria=categoria_id AND ativo AND uso='entrada';
        IF NOT FOUND THEN RAISE EXCEPTION 'Categoria do Financas invalida ou indisponivel'; END IF;
    END IF;
    PERFORM cr.id_conta FROM public.contas_receber cr
        WHERE cr.empresa_id=empresa AND cr.id_conta IN
            (SELECT (i->>'id_conta')::BIGINT FROM jsonb_array_elements(p_itens) i)
        ORDER BY cr.id_conta FOR UPDATE;
    FOR item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
        SELECT * INTO titulo FROM public.contas_receber
            WHERE empresa_id=empresa AND id_conta=(item->>'id_conta')::BIGINT;
        IF NOT FOUND THEN RAISE EXCEPTION 'Titulo nao encontrado ou sem permissao'; END IF;
        IF titulo.valor_original IS DISTINCT FROM (item->>'valor_original')::NUMERIC
           OR COALESCE(titulo.valor_recebido,0) IS DISTINCT FROM (item->>'valor_recebido')::NUMERIC
           OR titulo.status_recebimento IS DISTINCT FROM item->>'status_recebimento'
           OR titulo.id_movimento_financas IS DISTINCT FROM (item->>'id_movimento_financas')::BIGINT
           OR titulo.id_cliente IS DISTINCT FROM (item->>'id_cliente')::BIGINT THEN
            RAISE EXCEPTION 'Titulo % mudou. Atualize a tela antes de baixar.',titulo.id_conta;
        END IF;
        recebido_antes:=least(titulo.valor_original,greatest(0,COALESCE(titulo.valor_recebido,0)));
        saldo:=titulo.valor_original-recebido_antes;
        valor_baixa:=round((item->>'valor')::NUMERIC,2);
        IF titulo.status_recebimento IN ('CANCELADO','RECEBIDO') OR valor_baixa IS NULL
           OR valor_baixa<=0 OR valor_baixa>saldo OR saldo<=0 THEN
            RAISE EXCEPTION 'Valor ou estado invalido no titulo %',titulo.id_conta;
        END IF;
        original:=NULL;
        vinculo_id:=titulo.id_movimento_financas;
        IF integrado AND titulo.id_movimento_financas IS NOT NULL THEN
            SELECT * INTO original FROM financas.movimentos
                WHERE id_empresa=empresa AND id_movimento=titulo.id_movimento_financas FOR UPDATE;
            IF NOT FOUND OR original.tipo<>'entrada' OR original.status NOT IN ('pendente','efetivado')
               OR original.id_fatura IS NOT NULL OR original.id_fatura_pagamento IS NOT NULL THEN
                RAISE EXCEPTION 'Movimento original do titulo % ausente ou invalido',titulo.id_conta;
            END IF;
            IF EXISTS(SELECT 1 FROM public.contas_receber cr WHERE cr.empresa_id=empresa
                AND cr.id_movimento_financas=original.id_movimento AND cr.id_conta<>titulo.id_conta) THEN
                RAISE EXCEPTION 'Movimento compartilhado por outros titulos. Concilie antes de baixar.';
            END IF;
            SELECT COALESCE(SUM(m.valor),0) INTO baixas_integradas
                FROM public.contas_receber_baixas b JOIN financas.movimentos m
                  ON m.documento='BAIXA-CR-'||b.id_baixa AND m.id_empresa=empresa
                WHERE b.id_conta=titulo.id_conta AND m.tipo='entrada' AND m.status='efetivado';
            legado:=recebido_antes-baixas_integradas;
            IF legado<0 OR (original.status='pendente' AND original.valor<>saldo)
               OR (original.status='efetivado' AND (recebido_antes=0 OR (legado>0 AND original.valor<>legado))) THEN
                RAISE EXCEPTION 'Recebimentos anteriores divergentes no titulo %. Concilie antes de baixar.',titulo.id_conta;
            END IF;
        END IF;
        SELECT codigo_venda INTO codigo FROM public.vendas
            WHERE empresa_id=empresa AND id_venda=titulo.id_venda;
        recebido_depois:=recebido_antes+valor_baixa;
        INSERT INTO public.contas_receber_baixas
            (id_conta,id_cliente,valor_baixa,data_baixa,meio_pagamento,observacoes)
            VALUES(titulo.id_conta,titulo.id_cliente,valor_baixa,p_data_baixa,
                COALESCE(item->>'meio_pagamento',titulo.meio_pagamento),p_observacoes)
            RETURNING id_baixa INTO baixa_id;
        IF integrado THEN
            argumentos:=jsonb_build_object(
                'p_tipo','entrada','p_id_conta',p_id_conta_financas,'p_id_conta_destino',NULL,
                'p_valor',valor_baixa,'p_descricao',COALESCE(original.descricao,'Recebimento '||codigo,'Recebimento conta #'||titulo.id_conta),
                'p_data_movimento',COALESCE(original.data_movimento,data_local),
                'p_data_vencimento',COALESCE(titulo.data_vencimento,original.data_vencimento,data_local),
                'p_data_efetivacao',data_local,'p_id_categoria',categoria_id,'p_status','efetivado',
                'p_documento','BAIXA-CR-'||baixa_id,'p_observacoes',COALESCE(p_observacoes,original.observacoes,titulo.observacoes));
            -- A previsao vira o recebimento; movimentos ja efetivados nunca sao sobrescritos.
            IF original.id_movimento IS NOT NULL AND original.status='pendente' THEN
                rotina:='alterar_movimento';
                movimento_id:=original.id_movimento;
                argumentos:=argumentos||jsonb_build_object('p_id_movimento',movimento_id);
            ELSE
                rotina:='lancar_movimento';
                movimento_id:=NULL;
            END IF;
            SELECT 'select to_jsonb(financas.'||rotina||'('||
                string_agg(format('%I => %L',key,value #>> '{}'),', ')||'))'
                INTO chamada FROM jsonb_each(argumentos);
            EXECUTE chamada INTO retorno;
            IF jsonb_typeof(retorno)='array' THEN retorno:=retorno->0; END IF;
            movimento_id:=COALESCE(movimento_id,COALESCE(retorno->>'id_movimento',retorno->>'p_id_movimento',retorno #>> '{}')::BIGINT);
            IF movimento_id IS NULL OR NOT EXISTS(SELECT 1 FROM financas.movimentos m
                WHERE m.id_empresa=empresa AND m.id_movimento=movimento_id AND m.id_conta=p_id_conta_financas
                  AND m.tipo='entrada' AND m.status='efetivado' AND m.valor=valor_baixa
                  AND m.data_efetivacao=data_local AND m.documento='BAIXA-CR-'||baixa_id) THEN
                RAISE EXCEPTION 'O Financas nao confirmou o recebimento do titulo %',titulo.id_conta;
            END IF;
            vinculo_id:=movimento_id;
            -- Na baixa parcial, somente o saldo restante precisa de uma nova previsao.
            IF saldo>valor_baixa THEN
                argumentos:=jsonb_build_object(
                    'p_tipo','entrada','p_id_conta',COALESCE(original.id_conta,p_id_conta_financas),'p_id_conta_destino',NULL,
                    'p_valor',saldo-valor_baixa,'p_descricao',COALESCE(original.descricao,'Recebimento '||codigo,'Recebimento conta #'||titulo.id_conta),
                    'p_data_movimento',COALESCE(original.data_movimento,data_local),
                    'p_data_vencimento',COALESCE(titulo.data_vencimento,original.data_vencimento,data_local),
                    'p_data_efetivacao',COALESCE(titulo.data_vencimento,original.data_vencimento,data_local),
                    'p_id_categoria',COALESCE(original.id_categoria,categoria_id),'p_status','pendente',
                    'p_documento','SALDO-CR-'||titulo.id_conta,'p_observacoes',COALESCE(original.observacoes,titulo.observacoes));
                SELECT 'select to_jsonb(financas.lancar_movimento('||
                    string_agg(format('%I => %L',key,value #>> '{}'),', ')||'))'
                    INTO chamada FROM jsonb_each(argumentos);
                EXECUTE chamada INTO retorno;
                IF jsonb_typeof(retorno)='array' THEN retorno:=retorno->0; END IF;
                vinculo_id:=COALESCE(retorno->>'id_movimento',retorno->>'p_id_movimento',retorno #>> '{}')::BIGINT;
                IF vinculo_id IS NULL OR NOT EXISTS(SELECT 1 FROM financas.movimentos m
                    WHERE m.id_empresa=empresa AND m.id_movimento=vinculo_id AND m.status='pendente'
                      AND m.tipo='entrada' AND m.valor=saldo-valor_baixa AND m.documento='SALDO-CR-'||titulo.id_conta) THEN
                    RAISE EXCEPTION 'O Financas nao confirmou o saldo restante do titulo %',titulo.id_conta;
                END IF;
            END IF;
        END IF;
        UPDATE public.contas_receber SET valor_recebido=recebido_depois,
            status_recebimento=CASE WHEN recebido_depois>=valor_original THEN 'RECEBIDO' ELSE 'PENDENTE' END,
            data_recebimento=p_data_baixa,
            meio_pagamento=COALESCE(item->>'meio_pagamento',meio_pagamento),
            observacoes=CASE WHEN NULLIF(p_observacoes,'') IS NULL THEN observacoes
                ELSE concat_ws(' | ',NULLIF(observacoes,''),'Baixa: '||p_observacoes) END,
            id_conta_financas=CASE WHEN integrado THEN p_id_conta_financas ELSE id_conta_financas END,
            id_movimento_financas=vinculo_id
            WHERE empresa_id=empresa AND id_conta=titulo.id_conta RETURNING * INTO titulo;
        IF NOT FOUND OR titulo.valor_recebido<>recebido_depois THEN RAISE EXCEPTION 'Atualizacao do titulo nao confirmada'; END IF;
        resultados:=resultados||jsonb_build_array(jsonb_build_object('conta',to_jsonb(titulo),'id_baixa',baixa_id,'aplicado',valor_baixa));
        total:=total+valor_baixa;
    END LOOP;
    retorno:=jsonb_build_object('ok',TRUE,'aplicado',total,'qtd',jsonb_array_length(resultados),'titulos',resultados);
    UPDATE public.baixas_receber_operacoes SET resultado=retorno WHERE id_operacao=p_id_operacao;
    RETURN retorno;
END $baixa$;
revoke all on function public.baixar_contas_receber_atomico(uuid,jsonb,timestamptz,boolean,bigint,bigint,text) from public;
grant execute on function public.baixar_contas_receber_atomico(uuid,jsonb,timestamptz,boolean,bigint,bigint,text) to anon,authenticated;
notify pgrst, 'reload schema';
commit;
