// Cada pagamento pertence a sua propria conta; nunca reescreve uma baixa anterior.
const pagamentosPagarEmAndamento=new Set();
function chaveBaixaPagarPendente(id){const s=sessaoAtual();return `baixa_pagar_pendente_${s?.empresa_id}_${s?.id_usuario||s?.id}_${id}`}
function lerBaixaPagarPendente(id){return JSON.parse(sessionStorage.getItem(chaveBaixaPagarPendente(id))||'null')}
function saldoContaPagar(conta){return Math.max(0,Math.round((Number(conta.valor_original||0)-Number(conta.valor_pago||0))*100)/100)}
function contaPagarTemSaldo(conta){return conta.status_pagamento!=='CANCELADO'&&saldoContaPagar(conta)>0.005}
function contaPagarQuitada(conta){return conta.status_pagamento!=='CANCELADO'&&saldoContaPagar(conta)<=0.005}

async function enviarBaixaPagarAtomica(requisicao){
  const key=chaveBaixaPagarPendente(requisicao.p_id_conta_pagar);
  sessionStorage.setItem(key,JSON.stringify(requisicao));
  try{
    const res=await apiPost('rpc/baixar_conta_pagar_atomico',requisicao);
    if(!res.ok){
      const code=String(res.data?.code||''),definitivo=/^(P\d{4}|[0-9]{2}[A-Z0-9]{3}|PGRST)/.test(code);
      if(definitivo)sessionStorage.removeItem(key);
      if(/PGRST202|42883/.test(code))return {ok:false,message:'Instale o SQL 57_baixas_parciais_contas_pagar no Supabase para habilitar as baixas parciais. Nenhum pagamento foi enviado pelo fluxo antigo.'};
      return {ok:false,message:(res.data?.message||'Não foi possível confirmar a baixa.')+(definitivo?' Nenhuma alteração desta baixa foi confirmada.':' Ao tentar novamente, a mesma baixa será conferida sem duplicar o pagamento.')};
    }
    if(!res.data?.ok||!res.data.conta)throw new Error('Resposta de pagamento incompleta');
    sessionStorage.removeItem(key);
    if(typeof invalidarResumoContasVendas==='function')invalidarResumoContasVendas();
    return res.data;
  }catch(error){return {ok:false,message:`Resultado não confirmado: ${error.message}. Use Baixar valor novamente para conferir a mesma operação sem duplicar.`}}
}

function solicitarBaixaParcialPagar(conta,integracao){
  return new Promise(resolve=>{
    if(document.getElementById('baixa-parcial-pagar'))return resolve(null);
    const saldo=saldoContaPagar(conta),contas=integracao.contas.filter(c=>c.ativo!==false&&c.tipo!=='cartao');
    const modal=document.createElement('div');modal.className='modal-overlay';modal.id='baixa-parcial-pagar';modal.style.display='flex';
    modal.innerHTML=`<div class="modal" style="max-width:520px"><div class="modal-header"><span class="modal-title">Baixar valor — Contas a pagar</span></div><form data-form><div class="modal-body">
      <p>Total: <b>${compraFmt(conta.valor_original)}</b> · Já pago: <b>${compraFmt(conta.valor_pago||0)}</b><br>Saldo restante: <b>${compraFmt(saldo)}</b></p>
      <div class="form-group"><label class="form-label" for="baixa-pagar-valor">Valor deste pagamento *</label><input id="baixa-pagar-valor" class="form-input" type="number" step="0.01" min="0.01" max="${saldo.toFixed(2)}" value="${saldo.toFixed(2)}" required></div>
      ${integracao.ativa?`<label style="display:flex;gap:8px;margin:12px 0"><input type="checkbox" data-integrar ${baixaAtualizaFinancas()?'checked':''}> Atualizar também o Finanças</label><div class="form-group" data-grupo-conta><label class="form-label" for="baixa-pagar-conta">Conta de saída deste pagamento *</label><select id="baixa-pagar-conta" class="form-input form-select">${opcoesContasFinancas(contas,conta.id_conta_financas)}</select></div>`:''}
      <div class="form-group"><label class="form-label" for="baixa-pagar-data">Data deste pagamento *</label><input id="baixa-pagar-data" class="form-input" type="datetime-local" value="${dataHoraLocalFinancas(new Date())}" required></div>
      <div class="form-group"><label class="form-label" for="baixa-pagar-obs">Observações</label><input id="baixa-pagar-obs" class="form-input" maxlength="1000"></div>
      <p style="font-size:12px;color:var(--text2)">Você pode baixar somente parte do saldo e escolher outra conta nos próximos pagamentos.</p>
      </div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-cancelar>Cancelar</button><button type="submit" class="btn btn-primary">Confirmar baixa</button></div></form></div>`;
    const concluir=value=>{modal.remove();resolve(value)};
    const toggle=()=>{const field=modal.querySelector('[data-integrar]'),group=modal.querySelector('[data-grupo-conta]');if(group)group.style.display=field.checked?'block':'none'};
    modal.querySelector('[data-integrar]')?.addEventListener('change',toggle);toggle();
    modal.querySelector('[data-cancelar]').onclick=()=>concluir(null);
    modal.querySelector('[data-form]').onsubmit=event=>{
      event.preventDefault();
      const valor=Number(modal.querySelector('#baixa-pagar-valor').value),integrar=modal.querySelector('[data-integrar]')?.checked===true;
      const contaId=Number(modal.querySelector('#baixa-pagar-conta')?.value||0),date=modal.querySelector('#baixa-pagar-data').value;
      if(!Number.isFinite(valor)||valor<=0||Math.round(valor*100)>Math.round(saldo*100))return toast('Informe um valor maior que zero e até o saldo restante.','error');
      if(integrar&&!contas.some(c=>Number(c.id_conta)===contaId))return toast('Escolha a conta de saída deste pagamento.','error');
      const data=new Date(date);if(!date||Number.isNaN(data.getTime()))return toast('Informe uma data de pagamento válida.','error');
      concluir({valor:Math.round(valor*100)/100,integrar,contaId:integrar?contaId:null,data:data.toISOString(),observacoes:modal.querySelector('#baixa-pagar-obs').value.trim()||null});
    };
    modal.addEventListener('click',event=>{if(event.target===modal)concluir(null)});
    modal.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();concluir(null)}});
    document.body.appendChild(modal);modal.querySelector('#baixa-pagar-valor').focus();
  });
}

async function abrirBaixaContaPagar(id,event){
  event?.stopPropagation();id=Number(id);
  if(pagamentosPagarEmAndamento.has(id))return;
  pagamentosPagarEmAndamento.add(id);
  const detalhe=Number(currentId)===id;
  try{
    let requisicao=lerBaixaPagarPendente(id);
    if(!requisicao){
      const conta=items.find(c=>Number(c.id_conta_pagar)===id);
      if(!conta||!contaPagarTemSaldo(conta))return toast('Esta conta não tem saldo em aberto.','info');
      const integracao=await carregarIntegracaoFinancas('saida',{criarCategoria:false});
      const dados=await solicitarBaixaParcialPagar(conta,integracao);if(!dados)return;
      requisicao={p_id_operacao:crypto.randomUUID(),p_id_conta_pagar:id,p_valor:dados.valor,
        p_valor_original_esperado:Number(conta.valor_original),p_valor_pago_esperado:Number(conta.valor_pago||0),
        p_data_baixa:dados.data,p_atualizar_financas:dados.integrar,p_id_conta_financas:dados.contaId,
        p_id_categoria:integracao.categoria?.id_categoria||null,p_meio_pagamento:document.getElementById('f-meio_pagamento')?.value||conta.meio_pagamento||null,p_observacoes:dados.observacoes};
    }
    const result=await enviarBaixaPagarAtomica(requisicao);
    if(!result.ok)return toast(result.message,'error');
    toast(`Baixa de ${compraFmt(result.aplicado)} registrada. Saldo: ${compraFmt(result.saldo)}.`,'success');
    if(detalhe){await loadItems();await openItem(id)}else{await renderDashboardContasPagar()}
  }catch(error){toast(error.message||String(error),'error')}
  finally{pagamentosPagarEmAndamento.delete(id)}
}

async function consultarHistoricoPagar(id){
  const rows=[];
  for(;;){const page=await apiGet(`contas_pagar_baixas?select=*&id_conta_pagar=eq.${Number(id)}&order=data_baixa,id_baixa&limit=1000&offset=${rows.length}`);if(!Array.isArray(page))throw new Error(page?.message||'Histórico de pagamentos indisponível.');if(!page.length)return rows;rows.push(...page)}
}
async function renderHistoricoPagar(conta){
  const actions=document.querySelector('#content-body .form-actions');if(!actions||!conta)return;
  const id=Number(conta.id_conta_pagar),saldo=saldoContaPagar(conta);
  actions.querySelector('[onclick="marcarContaPagarPaga()"]')?.remove();
  if(contaPagarTemSaldo(conta)){
    actions.querySelector('.pill')?.remove();
    actions.insertAdjacentHTML('afterbegin',`<button type="button" class="btn btn-primary" onclick="abrirBaixaContaPagar(${id})">Baixar valor</button>`);
  }
  const pago=document.getElementById('f-valor_pago');if(pago)pago.readOnly=true;
  const original=document.getElementById('f-valor_original');if(original&&Number(conta.valor_pago||0)>0)original.readOnly=true;
  const status=document.getElementById('f-status_pagamento');
  if(status&&Number(conta.valor_pago||0)>0){status.disabled=true;if(saldo>0.005&&conta.status_pagamento!=='CANCELADO')status.value='PENDENTE'}
  actions.insertAdjacentHTML('beforebegin',`<section id="historico-baixas-pagar" data-titulo="${id}" style="margin:14px 0;padding:12px;border:1px solid var(--border);border-radius:8px"><b>${saldo>0.005?'Saldo a pagar':'Conta quitada'}: ${compraFmt(saldo)}</b><div data-historico>Carregando histórico de pagamentos…</div></section>`);
  const panel=document.getElementById('historico-baixas-pagar');
  try{
    const historico=await consultarHistoricoPagar(id);if(!panel.isConnected)return;
    const nomes=nomesContasFinancasSalvos();
    panel.querySelector('[data-historico]').innerHTML=historico.length?historico.map(b=>`<div style="padding:8px 0;border-top:1px solid var(--border)"><b>${compraFmt(b.valor_baixa)}</b> · ${textoSeguroFinancas(new Date(b.data_baixa).toLocaleString('pt-BR'))}<br>Conta: ${textoSeguroFinancas(b.id_conta_financas?(nomes[String(b.id_conta_financas)]||'#'+b.id_conta_financas):'Sem atualização no Finanças')}${b.legado?' · pagamento anterior preservado':''}${b.observacoes?'<br>'+textoSeguroFinancas(b.observacoes):''}</div>`).join(''):'Nenhuma baixa individual registrada. Pagamentos anteriores serão preservados ao baixar o saldo.';
    if(historico.length)actions.querySelector('[onclick="reativarContaPagar()"]')?.remove();
  }catch(error){if(panel.isConnected)panel.querySelector('[data-historico]').textContent='Histórico indisponível: '+error.message}
}

// O titulo continua apontando para a previsao de saldo ou a ultima baixa.
// Sincronizar seus metadados nunca move todos os pagamentos para a ultima conta.
async function preservarBaixasContaPagar(titulo){
  const historico=await apiGet(`contas_pagar_baixas?select=valor_baixa&id_conta_pagar=eq.${Number(titulo.id_conta_pagar)}`);
  if(!Array.isArray(historico)){
    if(['42P01','PGRST205'].includes(historico?.code))return false;
    throw new Error(historico?.message||'Não foi possível conferir as baixas do título.');
  }
  if(!historico.length)return false;
  const total=historico.reduce((sum,b)=>sum+Math.round(Number(b.valor_baixa)*100),0);
  if(total!==Math.round(Number(titulo.valor_pago||0)*100)||titulo.status_pagamento==='CANCELADO')throw new Error('Este título possui pagamentos individuais. Seus valores e contas devem ser preservados.');
  return true;
}

const renderFormContaPagarSemHistorico=renderFormContaPagar;
renderFormContaPagar=async function(conta){await renderFormContaPagarSemHistorico(conta);await renderHistoricoPagar(conta)};
