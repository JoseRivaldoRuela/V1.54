BEGIN;
-- Execute inteiro no SQL Editor do Supabase. Nao altera pagamentos existentes.
-- Cada baixa registra seu proprio valor, conta, data e movimento financeiro.


CREATE TABLE IF NOT EXISTS public.contas_pagar_baixas (
  id_baixa BIGSERIAL PRIMARY KEY,
  empresa_id UUID NOT NULL DEFAULT public.app_empresa_atual() REFERENCES public.empresas(id_empresa),
  id_conta_pagar BIGINT NOT NULL REFERENCES public.contas_pagar(id_conta_pagar),
  id_fornecedor BIGINT,
  valor_baixa NUMERIC(14,2) NOT NULL CHECK(valor_baixa>0),
  data_baixa TIMESTAMPTZ NOT NULL,
  meio_pagamento TEXT,
  observacoes TEXT,
  id_conta_financas BIGINT REFERENCES financas.contas(id_conta),
  id_movimento_financas BIGINT REFERENCES financas.movimentos(id_movimento),
  legado BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_baixas_pagar_titulo
  ON public.contas_pagar_baixas(empresa_id,id_conta_pagar,id_baixa);
CREATE UNIQUE INDEX IF NOT EXISTS idx_baixas_pagar_movimento
  ON public.contas_pagar_baixas(id_movimento_financas) WHERE id_movimento_financas IS NOT NULL;
ALTER TABLE public.contas_pagar_baixas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS escopo_baixas_pagar ON public.contas_pagar_baixas;
CREATE POLICY escopo_baixas_pagar ON public.contas_pagar_baixas FOR ALL TO anon,authenticated
  USING(empresa_id=public.app_empresa_atual())
  WITH CHECK(empresa_id=public.app_empresa_atual() AND EXISTS(
    SELECT 1 FROM public.contas_pagar c
    WHERE c.id_conta_pagar=contas_pagar_baixas.id_conta_pagar AND c.empresa_id=public.app_empresa_atual()
  ));
REVOKE INSERT,UPDATE,DELETE ON public.contas_pagar_baixas FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.contas_pagar_baixas TO anon,authenticated;


CREATE TABLE IF NOT EXISTS public.baixas_pagar_operacoes (
  id_operacao UUID PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id_empresa),
  id_usuario BIGINT NOT NULL,
  requisicao JSONB NOT NULL,
  resultado JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.baixas_pagar_operacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS escopo_operacao_baixa_pagar ON public.baixas_pagar_operacoes;
CREATE POLICY escopo_operacao_baixa_pagar ON public.baixas_pagar_operacoes FOR ALL TO anon,authenticated
  USING(empresa_id=public.app_empresa_atual() AND id_usuario=public.app_usuario_atual())
  WITH CHECK(empresa_id=public.app_empresa_atual() AND id_usuario=public.app_usuario_atual());
REVOKE INSERT,UPDATE,DELETE ON public.baixas_pagar_operacoes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.baixas_pagar_operacoes TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.baixar_conta_pagar_atomico(
  p_id_operacao UUID,p_id_conta_pagar BIGINT,p_valor NUMERIC,
  p_valor_original_esperado NUMERIC,p_valor_pago_esperado NUMERIC,
  p_data_baixa TIMESTAMPTZ,p_atualizar_financas BOOLEAN,
  p_id_conta_financas BIGINT,p_id_categoria BIGINT,
  p_meio_pagamento TEXT DEFAULT NULL,p_observacoes TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,financas,pg_temp AS $baixa$
<<baixa_pagar>>
DECLARE
  empresa UUID:=public.app_empresa_atual(); usuario BIGINT:=public.app_usuario_atual();
  titulo public.contas_pagar%ROWTYPE;
  original financas.movimentos%ROWTYPE;
  operacao public.baixas_pagar_operacoes%ROWTYPE;
  requisicao JSONB; retorno JSONB; argumentos JSONB; chamada TEXT; rotina TEXT;
  integrar BOOLEAN; categoria BIGINT:=p_id_categoria;
  valor NUMERIC:=ROUND(p_valor,2); pago_antes NUMERIC; pago_depois NUMERIC; saldo NUMERIC;
  historico NUMERIC; legado NUMERIC; baixa BIGINT; movimento BIGINT; vinculo BIGINT;
  codigo TEXT; descricao TEXT; data_local DATE:=(p_data_baixa AT TIME ZONE 'America/Sao_Paulo')::DATE;
BEGIN
  IF empresa IS NULL OR usuario IS NULL THEN RAISE EXCEPTION 'Sessao invalida ou expirada'; END IF;
  IF p_id_operacao IS NULL OR p_id_conta_pagar IS NULL OR p_data_baixa IS NULL
    OR valor IS NULL OR valor<=0 OR valor::TEXT IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'Informe um valor de baixa maior que zero e uma data valida';
  END IF;
  requisicao:=jsonb_build_object('titulo',p_id_conta_pagar,'valor',valor,
    'original',p_valor_original_esperado,'pago',p_valor_pago_esperado,'data',p_data_baixa,
    'integrar',p_atualizar_financas,'conta',p_id_conta_financas,'categoria',p_id_categoria,
    'meio',p_meio_pagamento,'observacoes',p_observacoes);
  INSERT INTO public.baixas_pagar_operacoes(id_operacao,empresa_id,id_usuario,requisicao)
    VALUES(p_id_operacao,empresa,usuario,requisicao) ON CONFLICT DO NOTHING;
  SELECT * INTO operacao FROM public.baixas_pagar_operacoes
    WHERE id_operacao=p_id_operacao AND empresa_id=empresa AND id_usuario=usuario FOR UPDATE;
  IF NOT FOUND OR operacao.requisicao IS DISTINCT FROM requisicao THEN
    RAISE EXCEPTION 'Identificador de baixa ja usado com outros dados';
  END IF;
  IF operacao.resultado IS NOT NULL THEN RETURN operacao.resultado; END IF;
  SELECT * INTO titulo FROM public.contas_pagar
    WHERE empresa_id=empresa AND id_conta_pagar=p_id_conta_pagar FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta a pagar nao encontrada ou sem permissao'; END IF;
  IF titulo.valor_original IS DISTINCT FROM p_valor_original_esperado
    OR COALESCE(titulo.valor_pago,0) IS DISTINCT FROM p_valor_pago_esperado THEN
    RAISE EXCEPTION 'O titulo mudou. Atualize a tela antes de baixar';
  END IF;
  pago_antes:=COALESCE(titulo.valor_pago,0);
  saldo:=ROUND(titulo.valor_original-pago_antes,2);
  -- Um PAGO antigo com valor pago menor que o original ainda possui saldo.
  IF titulo.status_pagamento='CANCELADO' OR pago_antes<0 OR saldo<=0 OR valor>saldo THEN
    RAISE EXCEPTION 'Valor invalido: a baixa deve ser maior que zero e nao pode exceder o saldo de %',saldo;
  END IF;
  SELECT COALESCE(p_atualizar_financas,FALSE) AND e.integra_vendas_financas INTO integrar
    FROM public.empresas e WHERE e.id_empresa=empresa;
  IF p_atualizar_financas AND integrar IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'A integracao mudou. Atualize a tela antes de baixar';
  END IF;
  IF integrar THEN
    PERFORM 1 FROM financas.contas WHERE id_empresa=empresa AND id_conta=p_id_conta_financas
      AND ativo AND tipo<>'cartao' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Selecione uma conta de pagamento ativa do Financas'; END IF;
    IF categoria IS NULL THEN
      SELECT id_categoria INTO categoria FROM financas.categorias
        WHERE id_empresa=empresa AND ativo AND uso='saida' AND lower(trim(nome))='compras'
        ORDER BY id_categoria LIMIT 1;
      IF categoria IS NULL THEN
        INSERT INTO financas.categorias(nome,uso,tipo,cor,descricao,ativo)
          VALUES('Compras','saida',NULL,'#ff6174','Categoria da integracao Vendas',TRUE)
          RETURNING id_categoria INTO categoria;
      END IF;
    END IF;
    PERFORM 1 FROM financas.categorias WHERE id_empresa=empresa AND id_categoria=categoria AND uso='saida' AND ativo;
    IF NOT FOUND THEN RAISE EXCEPTION 'Categoria de pagamento invalida'; END IF;
    IF titulo.id_movimento_financas IS NOT NULL THEN
      SELECT * INTO original FROM financas.movimentos
        WHERE id_empresa=empresa AND id_movimento=titulo.id_movimento_financas FOR UPDATE;
      IF NOT FOUND OR original.tipo<>'saida' OR original.status NOT IN ('pendente','efetivado')
        OR original.id_fatura IS NOT NULL OR original.id_fatura_pagamento IS NOT NULL THEN
        RAISE EXCEPTION 'Movimento vinculado ausente ou invalido. Confira antes de baixar';
      END IF;
      IF EXISTS(SELECT 1 FROM public.contas_pagar c WHERE c.empresa_id=empresa
        AND c.id_movimento_financas=original.id_movimento AND c.id_conta_pagar<>titulo.id_conta_pagar) THEN
        RAISE EXCEPTION 'Movimento compartilhado por outros titulos';
      END IF;
      IF original.status='pendente' AND original.valor<>saldo THEN
        RAISE EXCEPTION 'A previsao financeira diverge do saldo. Confira antes de baixar';
      END IF;
      IF original.status='efetivado' AND pago_antes=0 THEN
        RAISE EXCEPTION 'Ja existe pagamento financeiro sem baixa no titulo. Confira antes de baixar';
      END IF;
    END IF;
  END IF;
  SELECT COALESCE(SUM(valor_baixa),0) INTO historico FROM public.contas_pagar_baixas
    WHERE empresa_id=empresa AND id_conta_pagar=titulo.id_conta_pagar;
  legado:=ROUND(pago_antes-historico,2);
  IF legado<0 THEN RAISE EXCEPTION 'O valor pago diverge do historico de baixas'; END IF;
  IF legado>0 THEN
    IF integrar AND (original.id_movimento IS NULL OR original.status<>'efetivado' OR original.valor<>legado) THEN
      RAISE EXCEPTION 'Nao foi possivel confirmar o pagamento anterior. Confira antes de baixar o saldo';
    END IF;
    -- Registra o pagamento legado no historico sem mover, alterar ou relancar seu movimento.
    INSERT INTO public.contas_pagar_baixas(empresa_id,id_conta_pagar,id_fornecedor,valor_baixa,
      data_baixa,meio_pagamento,observacoes,id_conta_financas,id_movimento_financas,legado)
    VALUES(empresa,titulo.id_conta_pagar,titulo.id_fornecedor,legado,
      COALESCE(titulo.data_pagamento,original.data_efetivacao::TIMESTAMPTZ,p_data_baixa),
      titulo.meio_pagamento,'Pagamento anterior preservado',
      CASE WHEN integrar THEN original.id_conta ELSE titulo.id_conta_financas END,
      CASE WHEN integrar THEN original.id_movimento END,TRUE);
  END IF;
  SELECT codigo_compra INTO codigo FROM public.compras
    WHERE empresa_id=empresa AND id_compra=titulo.id_compra;
  descricao:=COALESCE(original.descricao,'Compra '||codigo,'Pagamento conta #'||titulo.id_conta_pagar);
  INSERT INTO public.contas_pagar_baixas(empresa_id,id_conta_pagar,id_fornecedor,valor_baixa,
    data_baixa,meio_pagamento,observacoes,id_conta_financas)
  VALUES(empresa,titulo.id_conta_pagar,titulo.id_fornecedor,valor,p_data_baixa,
    COALESCE(p_meio_pagamento,titulo.meio_pagamento),p_observacoes,
    CASE WHEN integrar THEN p_id_conta_financas END) RETURNING id_baixa INTO baixa;
  vinculo:=titulo.id_movimento_financas;
  IF integrar THEN
    argumentos:=jsonb_build_object('p_tipo','saida','p_id_conta',p_id_conta_financas,'p_id_conta_destino',NULL,
      'p_valor',valor,'p_descricao',descricao,'p_data_movimento',COALESCE(original.data_movimento,data_local),
      'p_data_vencimento',COALESCE(titulo.data_vencimento,original.data_vencimento,data_local),
      'p_data_efetivacao',data_local,'p_id_categoria',categoria,'p_status','efetivado',
      'p_documento','BAIXA-CP-'||baixa,'p_observacoes',COALESCE(p_observacoes,original.observacoes,titulo.observacoes));
    IF original.id_movimento IS NOT NULL AND original.status='pendente' THEN
      rotina:='alterar_movimento';movimento:=original.id_movimento;
      argumentos:=argumentos||jsonb_build_object('p_id_movimento',movimento);
    ELSE rotina:='lancar_movimento';movimento:=NULL; END IF;
    SELECT 'select to_jsonb(financas.'||rotina||'('||string_agg(format('%I => %L',key,value #>> '{}'),', ')||'))'
      INTO chamada FROM jsonb_each(argumentos);
    EXECUTE chamada INTO retorno;
    IF jsonb_typeof(retorno)='array' THEN retorno:=retorno->0; END IF;
    movimento:=COALESCE(movimento,COALESCE(retorno->>'id_movimento',retorno->>'p_id_movimento',retorno #>> '{}')::BIGINT);
    IF movimento IS NULL OR NOT EXISTS(SELECT 1 FROM financas.movimentos m WHERE m.id_empresa=empresa
      AND m.id_movimento=movimento AND m.id_conta=p_id_conta_financas AND m.tipo='saida'
      AND m.status='efetivado' AND m.valor=baixa_pagar.valor AND m.data_efetivacao=data_local AND m.documento='BAIXA-CP-'||baixa) THEN
      RAISE EXCEPTION 'O Financas nao confirmou o pagamento';
    END IF;
    -- O historico e imutavel para o cliente; esta atualizacao e feita pela funcao autorizada.
    UPDATE public.contas_pagar_baixas SET id_movimento_financas=movimento WHERE id_baixa=baixa AND empresa_id=empresa;
    vinculo:=movimento;
    IF saldo>valor THEN
      argumentos:=jsonb_build_object('p_tipo','saida','p_id_conta',COALESCE(original.id_conta,p_id_conta_financas),
        'p_id_conta_destino',NULL,'p_valor',saldo-valor,'p_descricao',descricao,
        'p_data_movimento',COALESCE(original.data_movimento,data_local),
        'p_data_vencimento',COALESCE(titulo.data_vencimento,original.data_vencimento,data_local),
        'p_data_efetivacao',COALESCE(titulo.data_vencimento,original.data_vencimento,data_local),
        'p_id_categoria',COALESCE(original.id_categoria,categoria),'p_status','pendente',
        'p_documento','SALDO-CP-'||titulo.id_conta_pagar,'p_observacoes',titulo.observacoes);
      SELECT 'select to_jsonb(financas.lancar_movimento('||string_agg(format('%I => %L',key,value #>> '{}'),', ')||'))'
        INTO chamada FROM jsonb_each(argumentos);
      EXECUTE chamada INTO retorno;
      IF jsonb_typeof(retorno)='array' THEN retorno:=retorno->0; END IF;
      vinculo:=COALESCE(retorno->>'id_movimento',retorno->>'p_id_movimento',retorno #>> '{}')::BIGINT;
      IF vinculo IS NULL OR NOT EXISTS(SELECT 1 FROM financas.movimentos m WHERE m.id_empresa=empresa
        AND m.id_movimento=vinculo AND m.tipo='saida' AND m.status='pendente' AND m.valor=baixa_pagar.saldo-baixa_pagar.valor
        AND m.documento='SALDO-CP-'||titulo.id_conta_pagar) THEN RAISE EXCEPTION 'Saldo financeiro nao confirmado'; END IF;
    END IF;
  END IF;
  pago_depois:=pago_antes+valor;
  UPDATE public.contas_pagar SET valor_pago=pago_depois,
    status_pagamento=CASE WHEN pago_depois>=valor_original THEN 'PAGO' ELSE 'PENDENTE' END,
    data_pagamento=p_data_baixa,meio_pagamento=COALESCE(p_meio_pagamento,meio_pagamento),
    id_conta_financas=CASE WHEN integrar THEN p_id_conta_financas ELSE id_conta_financas END,
    id_movimento_financas=vinculo
    WHERE id_conta_pagar=titulo.id_conta_pagar AND empresa_id=empresa RETURNING * INTO titulo;
  retorno:=jsonb_build_object('ok',TRUE,'aplicado',valor,'saldo',titulo.valor_original-pago_depois,
    'id_baixa',baixa,'conta',to_jsonb(titulo));
  UPDATE public.baixas_pagar_operacoes SET resultado=retorno WHERE id_operacao=p_id_operacao AND empresa_id=empresa;
  RETURN retorno;
END $baixa$;

-- A funcao valida sessao, empresa, conta, saldo e operacao antes de cada escrita.
ALTER FUNCTION public.baixar_conta_pagar_atomico(UUID,BIGINT,NUMERIC,NUMERIC,NUMERIC,TIMESTAMPTZ,BOOLEAN,BIGINT,BIGINT,TEXT,TEXT) SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.baixar_conta_pagar_atomico(UUID,BIGINT,NUMERIC,NUMERIC,NUMERIC,TIMESTAMPTZ,BOOLEAN,BIGINT,BIGINT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.baixar_conta_pagar_atomico(UUID,BIGINT,NUMERIC,NUMERIC,NUMERIC,TIMESTAMPTZ,BOOLEAN,BIGINT,BIGINT,TEXT,TEXT) TO anon,authenticated;
INSERT INTO financas.schema_migrations(versao,arquivo)
  VALUES(57,'57_baixas_parciais_contas_pagar.sql') ON CONFLICT(versao) DO NOTHING;
NOTIFY pgrst,'reload schema';
COMMIT;
