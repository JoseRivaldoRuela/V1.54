const baixasAtomicasEmAndamento = new Set();

async function executarBaixaReceberAtomica(contas, valorInformado, opcoes, financeiro) {
  const valor = Number(valorInformado);
  if(!Number.isFinite(valor)||valor<=0) return {ok:false,message:'Informe um valor de baixa maior que zero.'};
  let restante = Math.round(valor*100)/100;
  const itens = [];
  for(const conta of contas) {
    if(restante<=0.005) break;
    if(conta.status_recebimento==='CANCELADO') continue;
    const aplicado = Math.round(Math.min(restante,contasValorAberto(conta))*100)/100;
    if(aplicado<=0) continue;
    itens.push({id_conta:conta.id_conta,id_cliente:conta.id_cliente,
      valor_original:Number(conta.valor_original),valor_recebido:Number(conta.valor_recebido||0),
      status_recebimento:conta.status_recebimento,id_movimento_financas:conta.id_movimento_financas||null,
      valor:aplicado,meio_pagamento:opcoes.meio_pagamento||conta.meio_pagamento||null});
    restante = Math.round((restante-aplicado)*100)/100;
  }
  if(!itens.length) return {ok:false,message:'Nenhum titulo em aberto para baixar.'};
  const ids = itens.map(i=>Number(i.id_conta));
  if(ids.some(id=>baixasAtomicasEmAndamento.has(id))) return {ok:false,message:'Esta baixa ja esta em processamento.'};
  const requisicao = {p_itens:itens,p_data_baixa:opcoes.data_baixa||new Date().toISOString(),
    p_atualizar_financas:financeiro.ativa===true,p_id_conta_financas:financeiro.contaId||null,
    p_id_categoria:financeiro.integracao?.categoria?.id_categoria||null,p_observacoes:opcoes.observacoes||null};
  const chave = 'baixa_atomica_pendente_'+sessaoAtual()?.empresa_id+'_'+sessaoAtual()?.id_usuario;
  let pendente;
  try { pendente=JSON.parse(sessionStorage.getItem(chave)||'null'); }
  catch(e) { return {ok:false,message:'Nao foi possivel conferir uma baixa anterior. Atualize a tela.'}; }
  if(pendente&&JSON.stringify(pendente.requisicao)!==JSON.stringify(requisicao)) {
    return {ok:false,message:'Existe uma baixa sem resultado confirmado. Confira ou repita a mesma baixa antes de iniciar outra.'};
  }
  const idOperacao = pendente?.id||crypto.randomUUID();
  try { sessionStorage.setItem(chave,JSON.stringify({id:idOperacao,requisicao})); }
  catch(e) { return {ok:false,message:'Nao foi possivel registrar o identificador da baixa. Nada foi enviado.'}; }
  ids.forEach(id=>baixasAtomicasEmAndamento.add(id));
  try {
    const res = await apiPost('rpc/baixar_contas_receber_atomico',{p_id_operacao:idOperacao,...requisicao});
    if(!res.ok) {
      // Database exceptions roll the whole RPC back. Transport/server errors may be ambiguous.
      const codigo = String(res.data?.code||'');
      const banco = /^(P\d{4}|[0-9]{2}[A-Z0-9]{3}|PGRST)/.test(codigo);
      if(banco) sessionStorage.removeItem(chave);
      const instalar = /PGRST202|42883/.test(codigo);
      return {ok:false,message:instalar
        ? 'Baixa bloqueada: instale a SQL baixa_receber_atomica no Supabase. Nenhum recebimento foi enviado pelo fluxo antigo.'
        : (res.data?.message||'Erro ao executar a baixa.')+(banco?' Nenhuma alteracao desta baixa foi confirmada.':' Resultado nao confirmado. Confira antes de repetir.')};
    }
    const resultado = res.data;
    if(!resultado?.ok||!Array.isArray(resultado.titulos)) throw new Error('Resposta da baixa nao confirmada');
    sessionStorage.removeItem(chave);
    invalidarResumoContasVendas();
    return {...resultado,sobra:restante,conta:resultado.titulos[0]?.conta,aviso:null};
  } catch(e) {
    return {ok:false,message:'Nao foi possivel confirmar o resultado da baixa: '+(e.message||e)+'. Confira antes de repetir; a mesma requisicao usa o mesmo identificador para evitar duplicidade.'};
  } finally {
    ids.forEach(id=>baixasAtomicasEmAndamento.delete(id));
  }
}
