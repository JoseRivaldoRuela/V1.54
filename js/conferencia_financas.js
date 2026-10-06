function compararTituloComFinancas(titulo, movimento) {
  const saldo = contasValorAberto(titulo);
  if(!titulo.id_movimento_financas) return 'Sem vinculo: conferir movimentos pelo pedido';
  if(!movimento) return 'Movimento vinculado nao encontrado';
  if(movimento.tipo !== 'entrada') return 'Movimento vinculado nao e uma entrada';
  if(movimento.status === 'cancelado') return 'Movimento cancelado no Financas';
  if(movimento.status !== 'pendente') return 'Titulo aberto / movimento ' + movimento.status;
  if(Math.abs(Number(movimento.valor)-saldo)>0.005) return 'Valor pendente diferente do saldo aberto';
  if(String(movimento.data_vencimento||'').slice(0,10)!==String(titulo.data_vencimento||'').slice(0,10)) return 'Vencimento diferente';
  return 'Conferido';
}

async function consultarMovimentosConferencia(campo, valores) {
  const resultado = [];
  const unicos = [...new Set(valores.filter(Boolean))];
  for(let inicio=0; inicio<unicos.length; inicio+=50) {
    const lote = unicos.slice(inicio,inicio+50);
    const filtro = lote.map(valor=>campo==='documento'?JSON.stringify(String(valor)):Number(valor)).join(',');
    // A single order and explicit pages prevent the API row limit hiding duplicates.
    for(let offset=0; ; offset+=1000) {
      const dados = await financasRequest(`movimentos?select=id_movimento,id_conta,tipo,valor,status,documento,data_vencimento,descricao&${campo}=in.(${encodeURIComponent(filtro)})&order=id_movimento.asc&limit=1000&offset=${offset}`);
      if(!Array.isArray(dados)) throw new Error('Resposta invalida do Financas');
      resultado.push(...dados);
      if(dados.length<1000) break;
    }
  }
  return resultado;
}

async function renderConferenciaFinancas(contas) {
  const painel = document.getElementById('conferencia-financas-real');
  if(!painel) return;
  try {
    if(!await empresaIntegraFinancas()) {
      painel.textContent = 'Integracao com o Financas desativada nesta empresa.';
      return;
    }
    const abertos = contas.filter(c=>c.status_recebimento!=='CANCELADO'&&contasValorAberto(c)>0.005);
    const [vinculados,porPedido] = await Promise.all([
      consultarMovimentosConferencia('id_movimento',abertos.map(c=>c.id_movimento_financas)),
      consultarMovimentosConferencia('documento',abertos.filter(c=>!c.id_movimento_financas).map(c=>c.codigo_venda))
    ]);
    if(!painel.isConnected) return;
    const porId = new Map(vinculados.map(m=>[Number(m.id_movimento),m]));
    const usos = new Map();
    abertos.forEach(c=>{
      if(c.id_movimento_financas) usos.set(Number(c.id_movimento_financas),(usos.get(Number(c.id_movimento_financas))||0)+1);
    });
    const grupos = new Map();
    abertos.forEach(titulo=>{
      const id = String(titulo.id_cliente);
      if(!grupos.has(id)) grupos.set(id,{nome:titulo.clientes?.nome_fantasia||titulo.clientes?.razao_social||'Cliente #'+id,total:0,linhas:[]});
      const grupo = grupos.get(id);
      grupo.total += contasValorAberto(titulo);
      const movimento = porId.get(Number(titulo.id_movimento_financas));
      let diagnostico = compararTituloComFinancas(titulo,movimento);
      if(usos.get(Number(titulo.id_movimento_financas))>1) diagnostico = 'Mesmo movimento vinculado a mais de um titulo';
      const candidatos = !titulo.id_movimento_financas&&titulo.codigo_venda
        ? porPedido.filter(m=>m.documento===titulo.codigo_venda&&m.tipo==='entrada') : [];
      const encontrados = movimento?[movimento]:candidatos;
      const detalhe = encontrados.map(m=>`#${m.id_movimento}: ${contasFmtMoeda(m.valor)} / ${m.status} / conta #${m.id_conta}`).join('; ');
      grupo.linhas.push({titulo,diagnostico,detalhe});
    });
    const esc = textoSeguroFinancas;
    const lista = [...grupos.values()].sort((a,b)=>{
      const empade = nome=>String(nome).toUpperCase().includes('EMPADE');
      return Number(empade(b.nome))-Number(empade(a.nome))||a.nome.localeCompare(b.nome);
    });
    painel.innerHTML = lista.map(grupo=>`<details ${grupo.nome.toUpperCase().includes('EMPADE')?'open':''} style="margin-bottom:12px;">
      <summary style="padding:8px 0;cursor:pointer;font-weight:600;">${esc(grupo.nome)} - aberto no Vendas: ${contasFmtMoeda(grupo.total)}</summary>
      <div style="overflow:auto;"><table style="width:100%;min-width:650px;border-collapse:collapse;font-size:12px;">
      <thead><tr><th style="text-align:left;">Pedido / titulo</th><th style="text-align:right;">Saldo aberto</th><th style="text-align:left;">Financas</th><th style="text-align:left;">Conferencia</th></tr></thead>
      <tbody>${grupo.linhas.map(({titulo,diagnostico,detalhe})=>`<tr style="border-top:1px solid var(--border);"><td style="padding:8px 4px;">${esc(titulo.codigo_venda||'-')} / #${titulo.id_conta}</td><td style="padding:8px 4px;text-align:right;white-space:nowrap;">${contasFmtMoeda(contasValorAberto(titulo))}</td><td style="padding:8px 4px;">${esc(detalhe||'Sem movimento identificado')}</td><td style="padding:8px 4px;color:${diagnostico==='Conferido'?'var(--accent)':'var(--warn)'};">${esc(diagnostico)}</td></tr>`).join('')}</tbody>
      </table></div></details>`).join('')||'Nenhum titulo em aberto.';
  } catch(error) {
    if(painel.isConnected) painel.textContent = 'Conferencia nao concluida: '+(error.message||error);
  }
}
