// =====================
// CONTAS A RECEBER
// =====================
async function anexarCodigoVendaContas(contas) {
  if(!Array.isArray(contas) || !contas.length) return contas;
  const ids = [...new Set(contas.map(c=>Number(c.id_venda||0)).filter(Boolean))];
  if(!ids.length) return contas;
  const vendas = await apiGet(`vendas?select=id_venda,codigo_venda,data_venda&id_venda=in.(${ids.join(',')})`);
  const mapa = {};
  if(Array.isArray(vendas)) vendas.forEach(v => { mapa[Number(v.id_venda)] = v; });
  contas.forEach(c => {
    const venda = mapa[Number(c.id_venda)];
    c.codigo_venda = venda?.codigo_venda || null;
    c.data_venda = venda?.data_venda || null;
  });
  return contas;
}

function contasDateLocal(value) {
  const raw = contasDateOnly(value);
  if(!raw) return new Date(NaN);
  const [ano, mes, dia] = raw.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

function contasFmtDataBR(value) {
  const d = contasDateLocal(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
}

async function renderFormConta(c) {
  await loadCacheCobrancas();
  // Buscar cÃ³digo da venda separadamente
  let codigoVenda = c?.codigo_venda || '';
  if(c?.id_venda) {
    const vRef = await apiGet('vendas?select=codigo_venda&id_venda=eq.'+c.id_venda);
    if(Array.isArray(vRef) && vRef[0]) codigoVenda = vRef[0].codigo_venda;
  }
  const v = f => c ? (c[f]??'') : '';
  const pagOpts = cacheCobrancas.map(t =>
    `<option value="${t.descricao}" ${v('meio_pagamento')===t.descricao?'selected':''}>${t.descricao}</option>`).join('');
  const statusOpts = ['PENDENTE','RECEBIDO'].map(s =>
    `<option value="${s}" ${(v('status_recebimento')||'Pendente')===s?'selected':''}>${s}</option>`).join('');

  const vencDate = c?.data_vencimento ? contasDateLocal(c.data_vencimento) : new Date();
  const hoje = new Date();
  const atrasado = c && c.status_recebimento !== 'RECEBIDO' && vencDate < hoje;
  const valorOriginal = contasValorOriginal(c);
  const valorRecebidoAtual = contasValorRecebido(c);
  const saldoAberto = contasValorAberto(c);
  const agora = new Date();
  const baixaDataPadrao = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')}T${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}`;

  document.getElementById('content-body').innerHTML = `
    <div class="section-label"><span>Dados da Conta</span></div>
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Cliente</label>
        <input class="form-input" value="${c?.clientes?.nome_fantasia||c?.clientes?.razao_social||''}" readonly style="color:var(--text2);"/>
      </div>
      <div class="form-group">
        <label class="form-label">Venda ReferÃªncia</label>
        <input class="form-input" value="${codigoVenda||(c?.id_venda?`Venda #${c.id_venda}`:'')}" readonly style="color:var(--text2);"/>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-input form-select" id="f-status_recebimento">${statusOpts}</select>
      </div>
    </div>

    <div class="section-label"><span>Valores</span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:12px;">
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;">
        <div style="font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;">Original</div>
        <div style="font-size:16px;font-weight:700;">${contasFmtMoeda(valorOriginal)}</div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;">
        <div style="font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;">Recebido</div>
        <div style="font-size:16px;font-weight:700;color:var(--accent);">${contasFmtMoeda(valorRecebidoAtual)}</div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;">
        <div style="font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;">Saldo aberto</div>
        <div style="font-size:16px;font-weight:700;color:${saldoAberto>0.005?'var(--warn)':'var(--accent)'};">${contasFmtMoeda(saldoAberto)}</div>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Valor Original (R$)</label>
        <input class="form-input" type="number" step="0.01" id="f-valor_original" value="${v('valor_original')}" placeholder="0,00"/>
      </div>
      <div class="form-group">
        <label class="form-label">Valor Recebido (R$)</label>
        <input class="form-input" type="number" step="0.01" id="f-valor_recebido" value="${v('valor_recebido')}" placeholder="0,00"/>
      </div>
    </div>

    <div class="section-label"><span>Pagamento</span></div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Meio de Pagamento</label>
        <select class="form-input form-select" id="f-meio_pagamento">
          <option value="">Selecione...</option>
          ${pagOpts}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Data de Vencimento ${atrasado?'<span style="color:var(--danger)">âš ï¸ VENCIDA</span>':''}</label>
        <input class="form-input" type="date" id="f-data_vencimento" value="${v('data_vencimento')}" style="${atrasado?'border-color:var(--danger);':''}"/>
      </div>
      <div class="form-group">
        <label class="form-label">Data de Recebimento</label>
        <input class="form-input" type="datetime-local" id="f-data_recebimento" value="${v('data_recebimento')?v('data_recebimento').slice(0,16):''}"/>
      </div>
    </div>

    <div class="section-label"><span>ObservaÃ§Ãµes</span></div>
    <div class="form-group">
      <textarea class="form-textarea" id="f-observacoes" placeholder="ObservaÃ§Ãµes...">${v('observacoes')}</textarea>
    </div>

    ${c && saldoAberto > 0.005 ? `
    <div class="section-label"><span>Nova Baixa</span></div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Valor da baixa</label><input class="form-input" type="number" step="0.01" id="f-baixa_valor" value="${saldoAberto.toFixed(2)}" placeholder="0,00"/></div>
      <div class="form-group"><label class="form-label">Data da baixa</label><input class="form-input" type="datetime-local" id="f-baixa_data" value="${baixaDataPadrao}"/></div>
      <div class="form-group full"><label class="form-label">Observacao da baixa</label><input class="form-input" id="f-baixa_obs" placeholder="Ex: pagamento parcial, comprovante..."/></div>
    </div>` : ''}
    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save" onclick="saveConta()">âœ“ Salvar</button>
      ${c && saldoAberto > 0.005 ? `<button class="btn btn-primary" style="background:var(--accent2);" onclick="baixarContaParcial()">Baixar Valor</button>` : ''}
      ${c?.status_recebimento !== 'RECEBIDO' ? `<button class="btn btn-primary" style="background:var(--accent2);" onclick="marcarRecebido()">ðŸ’° Marcar Recebido</button>` : '<span class="pill on" style="padding:8px 14px;font-size:12px;">ðŸ’° Recebido</span>'}
      <button class="btn btn-secondary" onclick="cancelForm()">Cancelar</button>
    </div>`;
}

async function saveConta() {
  const btn = document.getElementById('btn-save');
  btn.disabled=true; btn.textContent='Salvando...';
  const statusSalvo = document.getElementById('f-status_recebimento').value.toUpperCase();
  const dataRecebimentoInformada = document.getElementById('f-data_recebimento').value;
  const valorOriginalForm = parseFloat(document.getElementById('f-valor_original').value||0);
  const valorRecebidoDigitado = parseFloat(document.getElementById('f-valor_recebido').value||0)||0;
  const valorRecebidoForm = statusSalvo === 'RECEBIDO' ? valorOriginalForm : valorRecebidoDigitado;
  const data = {
    status_recebimento: statusSalvo === 'RECEBIDO' ? 'RECEBIDO' : contasStatusBancoPorValores(valorOriginalForm, valorRecebidoForm),
    valor_original: valorOriginalForm,
    valor_recebido: valorRecebidoForm,
    meio_pagamento: document.getElementById('f-meio_pagamento').value||null,
    data_vencimento: document.getElementById('f-data_vencimento').value||null,
    data_recebimento: dataRecebimentoInformada
      ? new Date(dataRecebimentoInformada).toISOString()
      : (statusSalvo === 'RECEBIDO' ? new Date().toISOString() : null),
    observacoes: document.getElementById('f-observacoes').value.trim()||null
  };
  const{ok,data:res}=await apiPatch(`contas_receber?id_conta=eq.${currentId}`,data);
  if(ok){ toast('Conta atualizada!','success'); await loadItems(); openItem(currentId); }
  else{ toast('Erro: '+(res?.message||'erro'),'error'); btn.disabled=false; btn.textContent='âœ“ Salvar'; }
}

async function marcarRecebido() {
  const dataRecebimentoInformada = document.getElementById('f-data_recebimento')?.value;
  const valorRecebido = parseFloat(document.getElementById('f-valor_original').value||0);
  const data = {
    status_recebimento: 'RECEBIDO',
    valor_recebido: valorRecebido,
    data_recebimento: dataRecebimentoInformada ? new Date(dataRecebimentoInformada).toISOString() : new Date().toISOString(),
    meio_pagamento: document.getElementById('f-meio_pagamento').value||null
  };
  const{ok}=await apiPatch(`contas_receber?id_conta=eq.${currentId}`,data);
  if(ok){ toast('Pagamento confirmado!','success'); await loadItems(); openItem(currentId); }
  else toast('Erro ao confirmar','error');
}

async function registrarBaixaContaReceber(payload) {
  try {
    const res = await apiPost('contas_receber_baixas', payload);
    return res.ok;
  } catch(err) {
    return false;
  }
}

async function aplicarBaixaContaReceber(conta, valorBaixa, opcoes={}) {
  const valor = Number(valorBaixa || 0);
  if(!conta || valor <= 0) return { ok:false, message:'Informe um valor de baixa maior que zero.' };
  const recebidoAtual = contasValorRecebido(conta);
  const saldoAtual = contasValorAberto(conta);
  if(saldoAtual <= 0.005) return { ok:false, message:'Esta conta ja esta quitada.' };

  const aplicado = Math.min(valor, saldoAtual);
  const novoRecebido = Number((recebidoAtual + aplicado).toFixed(2));
  const status = contasStatusBancoPorValores(conta.valor_original, novoRecebido);
  const dataBaixa = opcoes.data_baixa || new Date().toISOString();
  const meio = opcoes.meio_pagamento || conta.meio_pagamento || null;
  const obsExtra = opcoes.observacoes ? ` | Baixa: ${opcoes.observacoes}` : '';
  const observacoes = `${conta.observacoes || ''}${obsExtra}`.trim() || null;

  const res = await apiPatch(`contas_receber?id_conta=eq.${conta.id_conta}`, {
    valor_recebido: novoRecebido,
    status_recebimento: status,
    data_recebimento: dataBaixa,
    meio_pagamento: meio,
    observacoes
  });
  if(!res.ok) return { ok:false, message:res.data?.message || `Erro ao baixar conta ${conta.id_conta}` };

  await registrarBaixaContaReceber({
    id_conta: conta.id_conta,
    id_cliente: conta.id_cliente,
    valor_baixa: aplicado,
    data_baixa: dataBaixa,
    meio_pagamento: meio,
    observacoes: opcoes.observacoes || null
  });

  return { ok:true, aplicado, sobra: Number((valor - aplicado).toFixed(2)), conta: res.data?.[0] };
}

async function baixarContaParcial() {
  const conta = items.find(c=>Number(c.id_conta)===Number(currentId));
  const valor = Number(document.getElementById('f-baixa_valor')?.value || 0);
  const dataInput = document.getElementById('f-baixa_data')?.value;
  const meio = document.getElementById('f-meio_pagamento')?.value || conta?.meio_pagamento || null;
  const observacoes = document.getElementById('f-baixa_obs')?.value?.trim() || null;
  const data_baixa = dataInput ? new Date(dataInput).toISOString() : new Date().toISOString();
  const baixa = await aplicarBaixaContaReceber(conta, valor, { data_baixa, meio_pagamento: meio, observacoes });
  if(!baixa.ok) { toast(baixa.message,'error'); return; }
  toast(`Baixa de ${contasFmtMoeda(baixa.aplicado)} registrada.`,'success');
  await loadItems();
  openItem(currentId);
}

function contasAbertasOrdenadas(lista) {
  return [...(Array.isArray(lista) ? lista : [])]
    .filter(c=>contasValorAberto(c) > 0.005)
    .sort((a,b)=>{
      const da = contasDateOnly(a.data_vencimento);
      const db = contasDateOnly(b.data_vencimento);
      if(da !== db) return da < db ? -1 : 1;
      return Number(a.id_conta||0) - Number(b.id_conta||0);
    });
}

function renderBaixaClienteContas() {
  const abertas = contasAbertasOrdenadas(items);
  const clientes = {};
  abertas.forEach(c => {
    const id = Number(c.id_cliente || 0);
    if(!id) return;
    if(!clientes[id]) clientes[id] = {
      id,
      nome: c.clientes?.nome_fantasia || c.clientes?.razao_social || `Cliente #${id}`,
      total: 0,
      qtd: 0
    };
    clientes[id].total += contasValorAberto(c);
    clientes[id].qtd += 1;
  });
  const listaClientes = Object.values(clientes).sort((a,b)=>a.nome.localeCompare(b.nome));
  const agora = new Date();
  const baixaDataPadrao = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')}T${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}`;

  document.getElementById('content-header').style.display = 'none';
  document.getElementById('content-body').innerHTML = `
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <button onclick="renderDashboardContas()" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--text2);font-size:12px;padding:5px 12px;cursor:pointer;">Voltar</button>
      <span style="font-size:15px;font-weight:600;">Baixar pagamento do cliente</span>
    </div>
    <div class="dash-chart-box" style="max-width:860px;">
      <div class="section-label"><span>Pagamento Recebido</span></div>
      <div class="form-grid">
        <div class="form-group full">
          <label class="form-label">Cliente</label>
          <select class="form-input form-select" id="baixa-cliente">
            <option value="">Selecione o cliente...</option>
            ${listaClientes.map(c=>`<option value="${c.id}">${c.nome} - ${c.qtd} conta${c.qtd!==1?'s':''} - ${contasFmtMoeda(c.total)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Valor recebido</label><input class="form-input" type="number" step="0.01" id="baixa-valor" placeholder="0,00"/></div>
        <div class="form-group"><label class="form-label">Data do recebimento</label><input class="form-input" type="datetime-local" id="baixa-data" value="${baixaDataPadrao}"/></div>
        <div class="form-group"><label class="form-label">Meio de pagamento</label><input class="form-input" id="baixa-meio" placeholder="PIX, BOLETO, DINHEIRO..."/></div>
        <div class="form-group full"><label class="form-label">Observacao</label><input class="form-input" id="baixa-obs" placeholder="Ex: pagamento agrupado"/></div>
      </div>
      <div style="font-size:12px;color:var(--text2);line-height:1.5;margin:10px 0 14px;">
        O sistema vai baixar primeiro os pedidos mais antigos em aberto. Se o pagamento nao quitar tudo, o ultimo pedido fica parcial.
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="aplicarBaixaClienteContas()">Baixar pagamento</button>
        <button class="btn btn-secondary" onclick="renderDashboardContas()">Cancelar</button>
      </div>
    </div>`;
}

async function aplicarBaixaClienteContas() {
  const idCliente = Number(document.getElementById('baixa-cliente')?.value || 0);
  let restante = Number(document.getElementById('baixa-valor')?.value || 0);
  const dataInput = document.getElementById('baixa-data')?.value;
  const meio = document.getElementById('baixa-meio')?.value?.trim() || null;
  const observacoes = document.getElementById('baixa-obs')?.value?.trim() || null;
  if(!idCliente) { toast('Selecione o cliente.','error'); return; }
  if(restante <= 0) { toast('Informe o valor recebido.','error'); return; }

  const data_baixa = dataInput ? new Date(dataInput).toISOString() : new Date().toISOString();
  const abertas = contasAbertasOrdenadas(items).filter(c=>Number(c.id_cliente)===idCliente);
  if(!abertas.length) { toast('Cliente sem contas em aberto.','error'); return; }

  let totalAplicado = 0, qtd = 0;
  for(const conta of abertas) {
    if(restante <= 0.005) break;
    const baixa = await aplicarBaixaContaReceber(conta, restante, { data_baixa, meio_pagamento: meio || conta.meio_pagamento, observacoes });
    if(!baixa.ok) { toast(baixa.message,'error'); return; }
    totalAplicado += baixa.aplicado;
    restante = baixa.sobra;
    qtd += 1;
  }

  const sobraMsg = restante > 0.005 ? ` Sobra nao aplicada: ${contasFmtMoeda(restante)}.` : '';
  toast(`Baixado ${contasFmtMoeda(totalAplicado)} em ${qtd} conta(s).${sobraMsg}`,'success');
  await loadItems();
  await renderDashboardContas();
}


// =====================
// DASHBOARD CONTAS A RECEBER
// =====================
async function renderDashboardContas() {
  const body = document.getElementById('content-body');
  body.innerHTML = '<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando anÃ¡lises...</div>';

  const contas = await apiGet('contas_receber?select=*,clientes!fk_conta_cliente(nome_fantasia,razao_social)&order=data_vencimento.asc');
  await anexarCodigoVendaContas(contas);
  if(!Array.isArray(contas)) { body.innerHTML='<div class="empty-state"><div class="empty-icon">âš ï¸</div><p>Erro ao carregar dados</p></div>'; return; }

  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const amanha = new Date(hoje.getTime()+864e5);
  const inicioSemana = new Date(hoje.getTime()-6*864e5);
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fmt = n => 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  // Classificar contas
  const recebidas   = contas.filter(c => c.status_recebimento === 'RECEBIDO');
  const pendentes   = contas.filter(c => c.status_recebimento !== 'RECEBIDO');
  const dataRecebimento = c => c.data_recebimento ? new Date(c.data_recebimento) : null;
  const recebidasHoje = recebidas.filter(c => { const d=dataRecebimento(c); return d&&d>=hoje&&d<amanha; });
  const recebidasSemana = recebidas.filter(c => { const d=dataRecebimento(c); return d&&d>=inicioSemana&&d<amanha; });
  const recebidasMes = recebidas.filter(c => { const d=dataRecebimento(c); return d&&d>=inicioMes&&d<amanha; });
  const vencidas    = pendentes.filter(c => contasDateLocal(c.data_vencimento) < hoje);
  const d7          = pendentes.filter(c => { const d=contasDateLocal(c.data_vencimento); return d>=hoje && d<=new Date(hoje.getTime()+7*864e5); });
  const d15         = pendentes.filter(c => { const d=contasDateLocal(c.data_vencimento); return d>new Date(hoje.getTime()+7*864e5) && d<=new Date(hoje.getTime()+15*864e5); });
  const d30         = pendentes.filter(c => { const d=contasDateLocal(c.data_vencimento); return d>new Date(hoje.getTime()+15*864e5) && d<=new Date(hoje.getTime()+30*864e5); });
  const mais30      = pendentes.filter(c => contasDateLocal(c.data_vencimento) > new Date(hoje.getTime()+30*864e5));

  const soma = arr => arr.reduce((s,c)=>s+Number(c.valor_original||0),0);
  const somaRecebido = arr => arr.reduce((s,c)=>s+Number(c.valor_recebido||c.valor_original||0),0);
  const totalGeral = soma(pendentes) + somaRecebido(recebidasMes);

  body.innerHTML = `
    <!-- Resumo compacto -->
    <div class="dash-chart-box" style="margin-bottom:16px;padding:12px;">
      <div class="dash-chart-title" style="margin-bottom:10px;"><span>Resumo Financeiro</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px;">
        <button onclick="listarContas('recebido_hoje','Recebido Hoje')" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px;text-align:left;cursor:pointer;">
          <div style="font-size:10px;color:var(--text2);font-family:var(--mono);text-transform:uppercase;">Hoje</div>
          <div style="font-size:16px;font-weight:700;color:var(--accent);line-height:1.2;margin-top:3px;">${fmt(somaRecebido(recebidasHoje))}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">${recebidasHoje.length} recebida${recebidasHoje.length!==1?'s':''}</div>
        </button>
        <button onclick="listarContas('recebido_semana','Recebido na Semana')" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px;text-align:left;cursor:pointer;">
          <div style="font-size:10px;color:var(--text2);font-family:var(--mono);text-transform:uppercase;">Semana</div>
          <div style="font-size:16px;font-weight:700;color:var(--accent2);line-height:1.2;margin-top:3px;">${fmt(somaRecebido(recebidasSemana))}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">${recebidasSemana.length} recebida${recebidasSemana.length!==1?'s':''}</div>
        </button>
        <button onclick="listarContas('recebido_mes','Recebido no Mes')" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px;text-align:left;cursor:pointer;">
          <div style="font-size:10px;color:var(--text2);font-family:var(--mono);text-transform:uppercase;">Mes</div>
          <div style="font-size:16px;font-weight:700;color:var(--accent);line-height:1.2;margin-top:3px;">${fmt(somaRecebido(recebidasMes))}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">${recebidasMes.length} recebida${recebidasMes.length!==1?'s':''}</div>
        </button>
        <button onclick="listarContas('vencido','Vencidas')" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px;text-align:left;cursor:pointer;">
          <div style="font-size:10px;color:var(--text2);font-family:var(--mono);text-transform:uppercase;">Vencidas</div>
          <div style="font-size:16px;font-weight:700;color:var(--danger);line-height:1.2;margin-top:3px;">${fmt(soma(vencidas))}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">${vencidas.length} conta${vencidas.length!==1?'s':''}</div>
        </button>
        <button onclick="listarContas('pendente','Em Aberto')" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px;text-align:left;cursor:pointer;">
          <div style="font-size:10px;color:var(--text2);font-family:var(--mono);text-transform:uppercase;">Aberto</div>
          <div style="font-size:16px;font-weight:700;color:var(--warn);line-height:1.2;margin-top:3px;">${fmt(soma(pendentes))}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">${pendentes.length} conta${pendentes.length!==1?'s':''}</div>
        </button>
      </div>
    </div>

    <!-- GrÃ¡fico + Vencimentos -->
    <div class="dash-charts" style="margin-bottom:16px;">
      <div class="dash-chart-box">
        <div class="dash-chart-title"><span>ðŸ“Š DistribuiÃ§Ã£o por Status</span></div>
        <div class="dash-canvas-wrap sm"><canvas id="chart-contas"></canvas></div>
      </div>

      <div class="dash-chart-box">
        <div class="dash-chart-title"><span>ðŸ“… Vencimentos em Aberto</span></div>
        <div class="dash-list">
          <div class="dash-list-item" onclick="listarContas('vencido','Vencidas')">
            <span class="dash-list-rank" style="color:var(--danger);">!</span>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;">
                <span class="dash-list-name" style="color:var(--danger);">Vencidas</span>
                <span class="dash-list-value" style="color:var(--danger);">${fmt(soma(vencidas))}</span>
              </div>
              <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${totalGeral>0?(soma(vencidas)/totalGeral*100).toFixed(0):0}%;background:var(--danger)"></div></div>
            </div>
          </div>
          <div class="dash-list-item" onclick="listarContas('7dias','Vencem em 7 dias')">
            <span class="dash-list-rank" style="color:var(--warn);">7d</span>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;">
                <span class="dash-list-name">PrÃ³ximos 7 dias</span>
                <span class="dash-list-value">${fmt(soma(d7))}</span>
              </div>
              <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${totalGeral>0?(soma(d7)/totalGeral*100).toFixed(0):0}%;background:var(--warn)"></div></div>
            </div>
          </div>
          <div class="dash-list-item" onclick="listarContas('15dias','Vencem em 8-15 dias')">
            <span class="dash-list-rank">15d</span>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;">
                <span class="dash-list-name">8 a 15 dias</span>
                <span class="dash-list-value">${fmt(soma(d15))}</span>
              </div>
              <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${totalGeral>0?(soma(d15)/totalGeral*100).toFixed(0):0}%;background:var(--accent2)"></div></div>
            </div>
          </div>
          <div class="dash-list-item" onclick="listarContas('30dias','Vencem em 16-30 dias')">
            <span class="dash-list-rank">30d</span>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;">
                <span class="dash-list-name">16 a 30 dias</span>
                <span class="dash-list-value">${fmt(soma(d30))}</span>
              </div>
              <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${totalGeral>0?(soma(d30)/totalGeral*100).toFixed(0):0}%;background:var(--accent)"></div></div>
            </div>
          </div>
          <div class="dash-list-item" onclick="listarContas('mais30','Mais de 30 dias')">
            <span class="dash-list-rank">+30</span>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;">
                <span class="dash-list-name">Mais de 30 dias</span>
                <span class="dash-list-value">${fmt(soma(mais30))}</span>
              </div>
              <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${totalGeral>0?(soma(mais30)/totalGeral*100).toFixed(0):0}%;background:var(--text3)"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Top clientes inadimplentes -->
    <div class="dash-chart-box">
      <div class="dash-chart-title"><span>ðŸ‘¥ Maiores Valores em Aberto por Cliente</span></div>
      <div class="dash-two-col" id="dash-inadim">
        ${(() => {
          const clienteMap = {};
          pendentes.forEach(c => {
            const nome = c.clientes?.nome_fantasia||c.clientes?.razao_social||`Cliente #${c.id_cliente}`;
            if(!clienteMap[nome]) clienteMap[nome]={nome,total:0,qtd:0};
            clienteMap[nome].total+=Number(c.valor_original||0);
            clienteMap[nome].qtd++;
          });
          const top = Object.values(clienteMap).sort((a,b)=>b.total-a.total).slice(0,6);
          if(!top.length) return '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;grid-column:1/-1;">Nenhum valor em aberto</div>';
          return top.map((c,i)=>`
            <div class="dash-list-item">
              <span class="dash-list-rank">${i+1}</span>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span class="dash-list-name">${c.nome}</span>
                  <span class="dash-list-value">${fmt(c.total)}</span>
                </div>
                <div style="font-size:11px;color:var(--text2);">${c.qtd} conta${c.qtd!==1?'s':''}</div>
                <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${top[0].total>0?(c.total/top[0].total*100).toFixed(0):0}%;background:var(--warn)"></div></div>
              </div>
            </div>`).join('');
        })()}
      </div>
    </div>`;

  // GrÃ¡fico de pizza
  setTimeout(() => {
    const ctx = document.getElementById('chart-contas');
    if(!ctx) return;
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Recebido mes','Vencido','7 dias','8-15 dias','16-30 dias','+30 dias'],
        datasets: [{
          data: [somaRecebido(recebidasMes), soma(vencidas), soma(d7), soma(d15), soma(d30), soma(mais30)],
          backgroundColor: ['rgba(0,229,160,.7)','rgba(255,71,87,.7)','rgba(255,165,0,.7)','rgba(0,122,255,.7)','rgba(0,229,160,.4)','rgba(136,136,160,.4)'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position:'bottom', labels:{ color:'#8888a0', font:{size:11}, padding:12 } },
          tooltip: { callbacks: { label: ctx => ctx.label+': '+fmt(ctx.raw) } }
        }
      }
    });
  }, 100);
}

function listarContas(filtro, titulo) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const amanha = new Date(hoje.getTime()+864e5);
  const inicioSemana = new Date(hoje.getTime()-6*864e5);
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const dataRecebimento = c => c.data_recebimento ? new Date(c.data_recebimento) : null;
  const fmt = n => 'R$ '+Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  let lista = [...items];

  if(filtro==='vencido') lista=lista.filter(c=>c.status_recebimento!=='RECEBIDO'&&contasDateLocal(c.data_vencimento)<hoje);
  else if(filtro==='pendente') lista=lista.filter(c=>c.status_recebimento!=='RECEBIDO');
  else if(filtro==='recebido_hoje') lista=lista.filter(c=>{const d=dataRecebimento(c);return c.status_recebimento==='RECEBIDO'&&d&&d>=hoje&&d<amanha;});
  else if(filtro==='recebido_semana') lista=lista.filter(c=>{const d=dataRecebimento(c);return c.status_recebimento==='RECEBIDO'&&d&&d>=inicioSemana&&d<amanha;});
  else if(filtro==='recebido_mes') lista=lista.filter(c=>{const d=dataRecebimento(c);return c.status_recebimento==='RECEBIDO'&&d&&d>=inicioMes&&d<amanha;});
  else if(filtro==='7dias') lista=lista.filter(c=>{const d=contasDateLocal(c.data_vencimento);return c.status_recebimento!=='RECEBIDO'&&d>=hoje&&d<=new Date(hoje.getTime()+7*864e5);});
  else if(filtro==='15dias') lista=lista.filter(c=>{const d=contasDateLocal(c.data_vencimento);return c.status_recebimento!=='RECEBIDO'&&d>new Date(hoje.getTime()+7*864e5)&&d<=new Date(hoje.getTime()+15*864e5);});
  else if(filtro==='30dias') lista=lista.filter(c=>{const d=contasDateLocal(c.data_vencimento);return c.status_recebimento!=='RECEBIDO'&&d>new Date(hoje.getTime()+15*864e5)&&d<=new Date(hoje.getTime()+30*864e5);});
  else if(filtro==='mais30') lista=lista.filter(c=>c.status_recebimento!=='RECEBIDO'&&contasDateLocal(c.data_vencimento)>new Date(hoje.getTime()+30*864e5));
  else if(filtro===null) lista=lista.filter(c=>c.status_recebimento==='RECEBIDO');

  const total = lista.reduce((s,c)=>s+Number(c.status_recebimento==='RECEBIDO' ? (c.valor_recebido||c.valor_original||0) : (c.valor_original||0)),0);

  document.getElementById('content-body').innerHTML = `
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <button onclick="renderDashboardContas()" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--text2);font-size:12px;padding:5px 12px;cursor:pointer;">â† Voltar</button>
      <span style="font-size:15px;font-weight:600;">${titulo}</span>
      <span style="font-size:12px;color:var(--text2);margin-left:auto;">${lista.length} conta${lista.length!==1?'s':''} Â· ${fmt(total)}</span>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:var(--surface2);">
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">Cliente</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Pedido</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Vencimento</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Recebimento</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Pagamento</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Status</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Valor</th>
        </tr></thead>
        <tbody>
          ${lista.length===0?'<tr><td colspan="7" style="padding:20px;text-align:center;color:var(--text3);">Nenhuma conta encontrada</td></tr>':
          lista.map(c=>{
            const venc=contasDateLocal(c.data_vencimento);
            const receb=new Date(c.data_recebimento || '');
            const atras=contasValorAberto(c)>0.005&&venc<hoje;
            const st=contasStatusVisual(c, hoje);
            const valorLinha = contasValorAberto(c);
            const recebidoLinha = contasValorRecebido(c);
            return `<tr style="border-top:1px solid var(--border);cursor:pointer;" onclick="openItem(${c.id_conta})" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
              <td style="padding:10px 14px;">${c.clientes?.nome_fantasia||c.clientes?.razao_social||'-'}</td>
              <td style="padding:10px 14px;text-align:center;color:var(--accent);font-family:var(--mono);font-weight:600;">${c.codigo_venda || (c.id_venda ? '#'+c.id_venda : '-')}</td>
              <td style="padding:10px 14px;text-align:center;color:${atras?'var(--danger)':'var(--text2)'};">${venc.toLocaleDateString('pt-BR')}</td>
              <td style="padding:10px 14px;text-align:center;color:${c.status_recebimento==='RECEBIDO'?'var(--accent)':'var(--text3)'};">${c.data_recebimento?receb.toLocaleDateString('pt-BR'):'-'}</td>
              <td style="padding:10px 14px;text-align:center;color:var(--text2);">${c.meio_pagamento||'-'}</td>
              <td style="padding:10px 14px;text-align:center;"><span class="pill ${sc}">${sl}</span></td>
              <td style="padding:10px 14px;text-align:right;font-weight:600;color:var(--accent);font-family:var(--mono);">${fmt(valorLinha)}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr style="border-top:2px solid var(--border);background:var(--surface2);">
          <td colspan="6" style="padding:10px 14px;font-weight:600;">Total</td>
          <td style="padding:10px 14px;text-align:right;font-weight:700;color:var(--accent);font-family:var(--mono);">${fmt(total)}</td>
        </tr></tfoot>
      </table>
    </div>`;
}

// FORM CLIENTES / FORNECEDORES

function contasFmtMoeda(n) {
  return 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function contasDateOnly(value) {
  return value ? String(value).slice(0,10) : '';
}

function contasFmtDataLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function contasValorOriginal(c) {
  return Number(c?.valor_original || 0);
}

function contasValorRecebido(c) {
  const original = contasValorOriginal(c);
  const recebido = Number(c?.valor_recebido || 0);
  if(c?.status_recebimento === 'RECEBIDO' && recebido <= 0) return original;
  return Math.min(original, Math.max(0, recebido));
}

function contasValorAberto(c) {
  return Math.max(0, contasValorOriginal(c) - contasValorRecebido(c));
}

function contasStatusVisual(c, hoje=new Date()) {
  const recebido = contasValorRecebido(c);
  const aberto = contasValorAberto(c);
  if(c?.status_recebimento === 'RECEBIDO' || aberto <= 0.005) return { label:'RECEBIDO', cls:'on' };
  if(recebido > 0.005) return { label:'PARCIAL', cls:'warn' };
  return contasDateLocal(c?.data_vencimento) < hoje ? { label:'VENCIDO', cls:'vencido' } : { label:'PENDENTE', cls:'warn' };
}

function contasStatusBancoPorValores(valorOriginal, valorRecebido) {
  return Number(valorRecebido||0) >= Number(valorOriginal||0) - 0.005 ? 'RECEBIDO' : 'PENDENTE';
}

function contasSoma(arr, recebido=false) {
  return arr.reduce((s,c)=>s+(recebido ? contasValorRecebido(c) : contasValorAberto(c)),0);
}

function contasMesSelecionadoRange() {
  const hoje = new Date();
  const mesRef = new Date(hoje.getFullYear(), hoje.getMonth() + contasDashMesOffset, 1);
  return {
    mesRef,
    inicio: contasFmtDataLocal(mesRef),
    fim: contasFmtDataLocal(new Date(mesRef.getFullYear(), mesRef.getMonth()+1, 1)),
    anteriorInicio: contasFmtDataLocal(new Date(mesRef.getFullYear(), mesRef.getMonth()-1, 1)),
    anteriorFim: contasFmtDataLocal(mesRef),
    label: mesRef.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})
  };
}

// Versao atualizada do dashboard de Contas a Receber.
async function renderDashboardContas() {
  const body = document.getElementById('content-body');
  body.innerHTML = '<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando financeiro...</div>';

  const contas = await apiGet('contas_receber?select=*,clientes!fk_conta_cliente(nome_fantasia,razao_social)&order=data_vencimento.asc');
  await anexarCodigoVendaContas(contas);
  if(!Array.isArray(contas)) {
    body.innerHTML='<div class="empty-state"><div class="empty-icon">!</div><p>Erro ao carregar dados</p></div>';
    return;
  }
  items = contas;
  filtered = filtrarLateralContasReceber(items);
  renderList();

  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const amanha = new Date(hoje.getTime()+864e5);
  const inicioSemana = new Date(hoje.getTime()-6*864e5);
  const range = contasMesSelecionadoRange();
  const pendentes = contas.filter(c=>contasValorAberto(c) > 0.005);
  const recebidas = contas.filter(c=>contasValorRecebido(c) > 0.005);
  const recebidasHoje = recebidas.filter(c=>{const d=c.data_recebimento?new Date(c.data_recebimento):null; return d&&d>=hoje&&d<amanha;});
  const recebidasSemana = recebidas.filter(c=>{const d=c.data_recebimento?new Date(c.data_recebimento):null; return d&&d>=inicioSemana&&d<amanha;});
  const recebidasMes = recebidas.filter(c=>{const d=contasDateOnly(c.data_recebimento); return d>=range.inicio && d<range.fim;});
  const recebidasMesAnterior = recebidas.filter(c=>{const d=contasDateOnly(c.data_recebimento); return d>=range.anteriorInicio && d<range.anteriorFim;});
  const receberMes = pendentes.filter(c=>{const d=contasDateOnly(c.data_vencimento); return d>=range.inicio && d<range.fim;});
  const receberMesAnterior = pendentes.filter(c=>{const d=contasDateOnly(c.data_vencimento); return d>=range.anteriorInicio && d<range.anteriorFim;});
  const vencidas = pendentes.filter(c=>contasDateLocal(c.data_vencimento) < hoje);
  const proximos7 = pendentes.filter(c=>{const d=contasDateLocal(c.data_vencimento); return d>=hoje && d<=new Date(hoje.getTime()+7*864e5);});
  const d15 = pendentes.filter(c=>{const d=contasDateLocal(c.data_vencimento); return d>new Date(hoje.getTime()+7*864e5) && d<=new Date(hoje.getTime()+15*864e5);});
  const d30 = pendentes.filter(c=>{const d=contasDateLocal(c.data_vencimento); return d>new Date(hoje.getTime()+15*864e5) && d<=new Date(hoje.getTime()+30*864e5);});
  const mais30 = pendentes.filter(c=>contasDateLocal(c.data_vencimento) > new Date(hoje.getTime()+30*864e5));
  const pct = (atual, ant) => ant > 0 ? ((atual-ant)/ant*100) : null;
  const variacaoRecebido = pct(contasSoma(recebidasMes,true), contasSoma(recebidasMesAnterior,true));
  const variacaoReceber = pct(contasSoma(receberMes), contasSoma(receberMesAnterior));

  const dias = parseInt(contasDashPeriodo);
  const labels = [], valoresRecebidos = [], valoresReceber = [];
  for(let i=dias-1; i>=0; i--) {
    const d = new Date(hoje.getTime()-i*864e5);
    const ds = contasFmtDataLocal(d);
    labels.push(d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}));
    valoresRecebidos.push(contasSoma(recebidas.filter(c=>contasDateOnly(c.data_recebimento)===ds), true));
    valoresReceber.push(contasSoma(pendentes.filter(c=>contasDateOnly(c.data_vencimento)===ds)));
  }

  const totalBase = Math.max(1, contasSoma(pendentes) + contasSoma(recebidasMes,true));
  const cardStyle = 'background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px;text-align:left;cursor:pointer;';
  const variacaoText = v => v===null ? 'sem base' : `${v>=0?'+':''}${v.toFixed(1)}% vs anterior`;
  const variacaoColor = (v, positivoBom=true) => v===null ? 'var(--text3)' : (v>=0 ? (positivoBom?'var(--accent)':'var(--warn)') : (positivoBom?'var(--danger)':'var(--accent)'));

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
      <button class="dash-period-btn" onclick="mudarMesContasDashboard(-1)">â€¹ MÃªs anterior</button>
      <button class="dash-period-btn ${contasDashMesOffset===0?'active':''}" onclick="irMesAtualContasDashboard()">MÃªs atual</button>
      <button class="dash-period-btn" onclick="mudarMesContasDashboard(1)" ${contasDashMesOffset>=0?'disabled style="opacity:.45;cursor:not-allowed;"':''}>PrÃ³ximo mÃªs â€º</button>
      <button class="dash-period-btn" onclick="renderComparativoContas()">Comparar meses</button>
      <span style="font-size:12px;color:var(--text2);font-family:var(--mono);margin-left:auto;text-transform:uppercase;">${range.label}</span>
    </div>

    <div class="dash-chart-box" style="margin-bottom:16px;padding:12px;">
      <div class="dash-chart-title" style="margin-bottom:10px;"><span>Resumo do Contas a Receber</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px;">
        <button onclick="listarContas('recebido_hoje','Recebido Hoje')" style="${cardStyle}">
          <div style="font-size:10px;color:var(--text2);font-family:var(--mono);text-transform:uppercase;">Recebido hoje</div>
          <div style="font-size:16px;font-weight:700;color:var(--accent);line-height:1.2;margin-top:3px;">${contasFmtMoeda(contasSoma(recebidasHoje,true))}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">${recebidasHoje.length} conta${recebidasHoje.length!==1?'s':''}</div>
        </button>
        <button onclick="listarContas('recebido_semana','Recebido na Semana')" style="${cardStyle}">
          <div style="font-size:10px;color:var(--text2);font-family:var(--mono);text-transform:uppercase;">Recebido semana</div>
          <div style="font-size:16px;font-weight:700;color:var(--accent2);line-height:1.2;margin-top:3px;">${contasFmtMoeda(contasSoma(recebidasSemana,true))}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">${recebidasSemana.length} conta${recebidasSemana.length!==1?'s':''}</div>
        </button>
        <button onclick="listarContas('recebido_mes','Recebido no MÃªs')" style="${cardStyle}">
          <div style="font-size:10px;color:var(--text2);font-family:var(--mono);text-transform:uppercase;">Recebido mÃªs</div>
          <div style="font-size:16px;font-weight:700;color:var(--accent);line-height:1.2;margin-top:3px;">${contasFmtMoeda(contasSoma(recebidasMes,true))}</div>
          <div style="font-size:10px;color:${variacaoColor(variacaoRecebido)};margin-top:2px;">${variacaoText(variacaoRecebido)}</div>
        </button>
        <button onclick="listarContas('receber_mes','A Receber no MÃªs')" style="${cardStyle}">
          <div style="font-size:10px;color:var(--text2);font-family:var(--mono);text-transform:uppercase;">A receber mÃªs</div>
          <div style="font-size:16px;font-weight:700;color:var(--warn);line-height:1.2;margin-top:3px;">${contasFmtMoeda(contasSoma(receberMes))}</div>
          <div style="font-size:10px;color:${variacaoColor(variacaoReceber,false)};margin-top:2px;">${variacaoText(variacaoReceber)}</div>
        </button>
        <button onclick="listarContas('vencido','Vencidas')" style="${cardStyle}">
          <div style="font-size:10px;color:var(--text2);font-family:var(--mono);text-transform:uppercase;">Vencidas</div>
          <div style="font-size:16px;font-weight:700;color:var(--danger);line-height:1.2;margin-top:3px;">${contasFmtMoeda(contasSoma(vencidas))}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">${vencidas.length} conta${vencidas.length!==1?'s':''}</div>
        </button>
        <button onclick="listarContas('pendente','Em Aberto')" style="${cardStyle}">
          <div style="font-size:10px;color:var(--text2);font-family:var(--mono);text-transform:uppercase;">Aberto total</div>
          <div style="font-size:16px;font-weight:700;color:var(--warn);line-height:1.2;margin-top:3px;">${contasFmtMoeda(contasSoma(pendentes))}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">${pendentes.length} conta${pendentes.length!==1?'s':''}</div>
        </button>
      </div>
    </div>

    <div class="dash-charts" style="margin-bottom:16px;">
      <div class="dash-chart-box">
        <div class="dash-chart-title">
          <span>Recebidos x A Receber</span>
          <div class="dash-chart-period">
            <button class="dash-period-btn ${contasDashPeriodo==='7'?'active':''}" onclick="mudarPeriodoContas('7')">7d</button>
            <button class="dash-period-btn ${contasDashPeriodo==='15'?'active':''}" onclick="mudarPeriodoContas('15')">15d</button>
            <button class="dash-period-btn ${contasDashPeriodo==='30'?'active':''}" onclick="mudarPeriodoContas('30')">30d</button>
          </div>
        </div>
        <div class="dash-canvas-wrap sm"><canvas id="chart-contas"></canvas></div>
      </div>

      <div class="dash-chart-box">
        <div class="dash-chart-title"><span>Vencimentos em Aberto</span></div>
        <div class="dash-list">
          ${[
            ['vencido','Vencidas',vencidas,'var(--danger)','!'],
            ['7dias','PrÃ³ximos 7 dias',proximos7,'var(--warn)','7d'],
            ['15dias','8 a 15 dias',d15,'var(--accent2)','15d'],
            ['30dias','16 a 30 dias',d30,'var(--accent)','30d'],
            ['mais30','Mais de 30 dias',mais30,'var(--text3)','+30']
          ].map(([filtro,label,lista,cor,rank])=>`
            <div class="dash-list-item" onclick="listarContas('${filtro}','${label}')">
              <span class="dash-list-rank" style="color:${cor};">${rank}</span>
              <div style="flex:1;">
                <div style="display:flex;justify-content:space-between;">
                  <span class="dash-list-name">${label}</span>
                  <span class="dash-list-value" style="color:${cor};">${contasFmtMoeda(contasSoma(lista))}</span>
                </div>
                <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${(contasSoma(lista)/totalBase*100).toFixed(0)}%;background:${cor}"></div></div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="dash-chart-box">
      <div class="dash-chart-title"><span>Maiores Valores em Aberto por Cliente</span></div>
      <div class="dash-two-col">
        ${(() => {
          const clienteMap = {};
          pendentes.forEach(c => {
            const nome = c.clientes?.nome_fantasia||c.clientes?.razao_social||`Cliente #${c.id_cliente}`;
            if(!clienteMap[nome]) clienteMap[nome]={nome,total:0,qtd:0};
            clienteMap[nome].total += contasValorAberto(c);
            clienteMap[nome].qtd++;
          });
          const top = Object.values(clienteMap).sort((a,b)=>b.total-a.total).slice(0,6);
          if(!top.length) return '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;grid-column:1/-1;">Nenhum valor em aberto</div>';
          return top.map((c,i)=>`
            <div class="dash-list-item">
              <span class="dash-list-rank">${i+1}</span>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span class="dash-list-name">${c.nome}</span>
                  <span class="dash-list-value">${contasFmtMoeda(c.total)}</span>
                </div>
                <div style="font-size:11px;color:var(--text2);">${c.qtd} conta${c.qtd!==1?'s':''}</div>
                <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${top[0].total>0?(c.total/top[0].total*100).toFixed(0):0}%;background:var(--warn)"></div></div>
              </div>
            </div>`).join('');
        })()}
      </div>
    </div>`;

  setTimeout(() => {
    const ctx = document.getElementById('chart-contas');
    if(!ctx) return;
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label:'Recebido', data:valoresRecebidos, borderColor:'#00e5a0', backgroundColor:'rgba(0,229,160,0.08)', borderWidth:2, pointRadius:3, fill:true, tension:.35 },
          { label:'A receber', data:valoresReceber, borderColor:'#ffa500', backgroundColor:'rgba(255,165,0,0.08)', borderWidth:2, pointRadius:3, fill:true, tension:.35 }
        ]
      },
      options: {
        responsive:true,
        maintainAspectRatio:false,
        plugins:{
          legend:{ position:'bottom', labels:{ color:'#8888a0', font:{size:11}, padding:12 } },
          tooltip:{ callbacks:{ label: ctx => `${ctx.dataset.label}: ${contasFmtMoeda(ctx.raw)}` } }
        },
        scales:{
          x:{ grid:{ color:'rgba(255,255,255,0.05)' }, ticks:{ color:'#8888a0', font:{size:11} } },
          y:{ grid:{ color:'rgba(255,255,255,0.05)' }, ticks:{ color:'#8888a0', font:{size:11}, callback:v=>'R$ '+Number(v).toLocaleString('pt-BR') } }
        }
      }
    });
  }, 100);
}

async function mudarPeriodoContas(p) {
  contasDashPeriodo = p;
  await renderDashboardContas();
}

async function mudarMesContasDashboard(delta) {
  contasDashMesOffset += delta;
  if(contasDashMesOffset > 0) contasDashMesOffset = 0;
  await renderDashboardContas();
}

async function irMesAtualContasDashboard() {
  contasDashMesOffset = 0;
  await renderDashboardContas();
}

function listarContas(filtro, titulo) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const amanha = new Date(hoje.getTime()+864e5);
  const inicioSemana = new Date(hoje.getTime()-6*864e5);
  const range = contasMesSelecionadoRange();
  let lista = [...items];

  if(filtro==='vencido') lista=lista.filter(c=>c.status_recebimento!=='RECEBIDO'&&contasDateLocal(c.data_vencimento)<hoje);
  else if(filtro==='pendente') lista=lista.filter(c=>c.status_recebimento!=='RECEBIDO');
  else if(filtro==='recebido_hoje') lista=lista.filter(c=>{const d=c.data_recebimento?new Date(c.data_recebimento):null;return contasValorRecebido(c)>0.005&&d&&d>=hoje&&d<amanha;});
  else if(filtro==='recebido_semana') lista=lista.filter(c=>{const d=c.data_recebimento?new Date(c.data_recebimento):null;return contasValorRecebido(c)>0.005&&d&&d>=inicioSemana&&d<amanha;});
  else if(filtro==='recebido_mes') lista=lista.filter(c=>{const d=contasDateOnly(c.data_recebimento);return contasValorRecebido(c)>0.005&&d>=range.inicio&&d<range.fim;});
  else if(filtro==='receber_mes') lista=lista.filter(c=>{const d=contasDateOnly(c.data_vencimento);return c.status_recebimento!=='RECEBIDO'&&d>=range.inicio&&d<range.fim;});
  else if(filtro==='7dias') lista=lista.filter(c=>{const d=contasDateLocal(c.data_vencimento);return c.status_recebimento!=='RECEBIDO'&&d>=hoje&&d<=new Date(hoje.getTime()+7*864e5);});
  else if(filtro==='15dias') lista=lista.filter(c=>{const d=contasDateLocal(c.data_vencimento);return c.status_recebimento!=='RECEBIDO'&&d>new Date(hoje.getTime()+7*864e5)&&d<=new Date(hoje.getTime()+15*864e5);});
  else if(filtro==='30dias') lista=lista.filter(c=>{const d=contasDateLocal(c.data_vencimento);return c.status_recebimento!=='RECEBIDO'&&d>new Date(hoje.getTime()+15*864e5)&&d<=new Date(hoje.getTime()+30*864e5);});
  else if(filtro==='mais30') lista=lista.filter(c=>c.status_recebimento!=='RECEBIDO'&&contasDateLocal(c.data_vencimento)>new Date(hoje.getTime()+30*864e5));
  else if(filtro===null) lista=lista.filter(c=>contasValorRecebido(c)>0.005);

  const total = lista.reduce((s,c)=>s+(filtro && String(filtro).startsWith('recebido') ? contasValorRecebido(c) : contasValorAberto(c)),0);

  document.getElementById('content-body').innerHTML = `
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <button onclick="renderDashboardContas()" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--text2);font-size:12px;padding:5px 12px;cursor:pointer;">â† Voltar</button>
      <span style="font-size:15px;font-weight:600;">${titulo}</span>
      <span style="font-size:12px;color:var(--text2);margin-left:auto;">${lista.length} conta${lista.length!==1?'s':''} Â· ${contasFmtMoeda(total)}</span>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:760px;">
        <thead><tr style="background:var(--surface2);">
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">Cliente</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Pedido</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Vencimento</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Recebimento</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Pagamento</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Status</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Valor</th>
        </tr></thead>
        <tbody>
          ${lista.length===0?'<tr><td colspan="7" style="padding:20px;text-align:center;color:var(--text3);">Nenhuma conta encontrada</td></tr>':
          lista.map(c=>{
            const venc=contasDateLocal(c.data_vencimento);
            const receb=new Date(c.data_recebimento || '');
            const atras=c.status_recebimento!=='RECEBIDO'&&venc<hoje;
            const sc=c.status_recebimento==='RECEBIDO'?'on':atras?'vencido':'warn';
            const sl=c.status_recebimento==='RECEBIDO'?'RECEBIDO':atras?'VENCIDO':'PENDENTE';
            const valorLinha = c.status_recebimento==='RECEBIDO' ? (c.valor_recebido||c.valor_original) : c.valor_original;
            return `<tr style="border-top:1px solid var(--border);cursor:pointer;" onclick="openItem(${c.id_conta})" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
              <td style="padding:10px 14px;">${c.clientes?.nome_fantasia||c.clientes?.razao_social||'-'}</td>
              <td style="padding:10px 14px;text-align:center;color:var(--accent);font-family:var(--mono);font-weight:600;">${c.codigo_venda || (c.id_venda ? '#'+c.id_venda : '-')}</td>
              <td style="padding:10px 14px;text-align:center;color:${atras?'var(--danger)':'var(--text2)'};">${venc.toLocaleDateString('pt-BR')}</td>
              <td style="padding:10px 14px;text-align:center;color:${recebidoLinha>0.005?'var(--accent)':'var(--text3)'};">${c.data_recebimento?receb.toLocaleDateString('pt-BR'):'-'}</td>
              <td style="padding:10px 14px;text-align:center;color:var(--text2);">${c.meio_pagamento||'-'}</td>
              <td style="padding:10px 14px;text-align:center;"><span class="pill ${st.cls}">${st.label}</span></td>
              <td style="padding:10px 14px;text-align:right;font-weight:600;color:${valorLinha>0.005?'var(--warn)':'var(--accent)'};font-family:var(--mono);">${contasFmtMoeda(valorLinha)}<div style="font-size:10px;color:var(--text3);font-weight:400;">Rec. ${contasFmtMoeda(recebidoLinha)}</div></td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr style="border-top:2px solid var(--border);background:var(--surface2);">
          <td colspan="6" style="padding:10px 14px;font-weight:600;">Total</td>
          <td style="padding:10px 14px;text-align:right;font-weight:700;color:var(--accent);font-family:var(--mono);">${contasFmtMoeda(total)}</td>
        </tr></tfoot>
      </table>
    </div>`;
}

function buildMesesComparativoContas(contas, modo, ano, mesesQtd) {
  const fmtKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const meses = [];
  if(modo === 'ano') {
    for(let m=0; m<12; m++) meses.push(new Date(ano, m, 1));
  } else {
    const fim = new Date();
    fim.setDate(1);
    for(let i=Math.max(1, mesesQtd)-1; i>=0; i--) meses.push(new Date(fim.getFullYear(), fim.getMonth()-i, 1));
  }

  return meses.map((mes, idx) => {
    const key = fmtKey(mes);
    const recebidas = contas.filter(c=>contasValorRecebido(c)>0.005 && contasDateOnly(c.data_recebimento).slice(0,7) === key);
    const aReceber = contas.filter(c=>contasValorAberto(c)>0.005 && contasDateOnly(c.data_vencimento).slice(0,7) === key);
    const recebido = contasSoma(recebidas,true);
    const aberto = contasSoma(aReceber);
    const anterior = idx > 0 ? meses[idx-1] : new Date(mes.getFullYear(), mes.getMonth()-1, 1);
    const keyAnterior = fmtKey(anterior);
    const recebidoAnterior = contasSoma(contas.filter(c=>contasValorRecebido(c)>0.005 && contasDateOnly(c.data_recebimento).slice(0,7) === keyAnterior), true);
    const variacao = recebidoAnterior > 0 ? ((recebido-recebidoAnterior)/recebidoAnterior*100) : null;
    return {
      key,
      label: mes.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}),
      labelLongo: mes.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}),
      recebido,
      aberto,
      qtdRecebidas: recebidas.length,
      qtdAbertas: aReceber.length,
      variacao
    };
  });
}

async function renderComparativoContas() {
  const body = document.getElementById('content-body');
  body.innerHTML = '<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando comparativo...</div>';

  const contas = await apiGet('contas_receber?select=*,clientes!fk_conta_cliente(nome_fantasia,razao_social)&order=data_vencimento.asc');
  await anexarCodigoVendaContas(contas);
  if(!Array.isArray(contas)) {
    body.innerHTML = '<div class="empty-state"><div class="empty-icon">!</div><p>Erro ao carregar contas</p></div>';
    return;
  }

  const anosBase = contas.flatMap(c=>[contasDateOnly(c.data_recebimento), contasDateOnly(c.data_vencimento)])
    .map(d=>d ? Number(d.slice(0,4)) : null).filter(Boolean);
  const anos = [...new Set(anosBase)].sort((a,b)=>b-a);
  if(!anos.includes(contasComparativoAno)) anos.unshift(contasComparativoAno);
  const mesesQtd = Math.max(1, Math.min(60, Number(contasComparativoMeses||12)));
  contasComparativoMeses = mesesQtd;
  const dados = buildMesesComparativoContas(contas, contasComparativoModo, contasComparativoAno, mesesQtd);
  const totalRecebido = dados.reduce((s,m)=>s+m.recebido,0);
  const totalAberto = dados.reduce((s,m)=>s+m.aberto,0);
  const qtdRecebidas = dados.reduce((s,m)=>s+m.qtdRecebidas,0);
  const qtdAbertas = dados.reduce((s,m)=>s+m.qtdAbertas,0);
  const melhorMes = [...dados].sort((a,b)=>b.recebido-a.recebido)[0];
  const fmtPct = n => n === null ? '-' : `${n>=0?'+':''}${n.toFixed(1)}%`;

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
      <button onclick="renderDashboardContas()" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--text2);font-size:12px;padding:6px 12px;cursor:pointer;">â† Voltar</button>
      <span style="font-size:15px;font-weight:600;">Comparativo do Contas a Receber</span>
      <span style="font-size:12px;color:var(--text2);margin-left:auto;">${contasComparativoModo==='ano' ? 'Ano '+contasComparativoAno : 'Ãšltimos '+mesesQtd+' meses'}</span>
    </div>

    <div class="dash-chart-box" style="margin-bottom:14px;padding:12px;">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;align-items:end;">
        <div class="form-group">
          <label class="form-label">Ãšltimos meses</label>
          <input class="form-input" type="number" min="1" max="60" step="1" id="contas-comp-meses" value="${mesesQtd}"/>
        </div>
        <div class="form-group">
          <label class="form-label">Ano</label>
          <select class="form-input form-select" id="contas-comp-ano">
            ${anos.map(a=>`<option value="${a}" ${Number(a)===Number(contasComparativoAno)?'selected':''}>${a}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary" onclick="aplicarComparativoContas('ultimos')">Ver Ãºltimos meses</button>
        <button class="btn btn-secondary" onclick="aplicarComparativoContas('ano')">Ver ano todo</button>
      </div>
    </div>

    <div class="dash-grid" style="grid-template-columns:repeat(auto-fit,minmax(145px,1fr));margin-bottom:14px;">
      <div class="dash-card green" style="cursor:default;"><div class="dash-card-label">Recebido</div><div class="dash-card-value" style="font-size:20px;">${contasFmtMoeda(totalRecebido)}</div><div class="dash-card-sub">${qtdRecebidas} conta${qtdRecebidas!==1?'s':''}</div></div>
      <div class="dash-card orange" style="cursor:default;"><div class="dash-card-label">Em aberto</div><div class="dash-card-value" style="font-size:20px;color:var(--warn);">${contasFmtMoeda(totalAberto)}</div><div class="dash-card-sub">${qtdAbertas} conta${qtdAbertas!==1?'s':''}</div></div>
      <div class="dash-card blue" style="cursor:default;"><div class="dash-card-label">Total do perÃ­odo</div><div class="dash-card-value" style="font-size:20px;">${contasFmtMoeda(totalRecebido+totalAberto)}</div><div class="dash-card-sub">recebido + aberto</div></div>
      <div class="dash-card green" style="cursor:default;"><div class="dash-card-label">Melhor mÃªs</div><div class="dash-card-value" style="font-size:17px;">${melhorMes?.labelLongo||'-'}</div><div class="dash-card-sub">${contasFmtMoeda(melhorMes?.recebido||0)}</div></div>
    </div>

    <div class="dash-chart-box" style="margin-bottom:14px;">
      <div class="dash-chart-title"><span>Recebido e Aberto por MÃªs</span></div>
      <div class="dash-canvas-wrap"><canvas id="chart-comparativo-contas"></canvas></div>
    </div>

    <div class="dash-chart-box" style="margin-bottom:20px;overflow:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:620px;">
        <thead><tr style="background:var(--surface2);">
          <th style="padding:9px 10px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">MÃªs</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Recebidas</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Recebido</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Abertas</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Em aberto</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">VariaÃ§Ã£o</th>
        </tr></thead>
        <tbody>
          ${dados.map(m=>`<tr style="border-top:1px solid var(--border);">
            <td style="padding:9px 10px;text-transform:capitalize;">${m.labelLongo}</td>
            <td style="padding:9px 10px;text-align:right;color:var(--text2);">${m.qtdRecebidas}</td>
            <td style="padding:9px 10px;text-align:right;font-family:var(--mono);color:var(--accent);">${contasFmtMoeda(m.recebido)}</td>
            <td style="padding:9px 10px;text-align:right;color:var(--text2);">${m.qtdAbertas}</td>
            <td style="padding:9px 10px;text-align:right;font-family:var(--mono);color:var(--warn);">${contasFmtMoeda(m.aberto)}</td>
            <td style="padding:9px 10px;text-align:right;font-family:var(--mono);color:${m.variacao===null?'var(--text3)':m.variacao>=0?'var(--accent)':'var(--danger)'};">${fmtPct(m.variacao)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  setTimeout(() => {
    const ctx = document.getElementById('chart-comparativo-contas');
    if(!ctx) return;
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dados.map(m=>m.label),
        datasets: [
          { label:'Recebido', data:dados.map(m=>m.recebido), backgroundColor:'rgba(0,229,160,.55)', borderWidth:0 },
          { label:'Em aberto', data:dados.map(m=>m.aberto), backgroundColor:'rgba(255,165,0,.55)', borderWidth:0 }
        ]
      },
      options: {
        responsive:true,
        maintainAspectRatio:false,
        plugins:{
          legend:{ position:'bottom', labels:{ color:'#8888a0', font:{size:11}, padding:12 } },
          tooltip:{ callbacks:{ label: ctx => `${ctx.dataset.label}: ${contasFmtMoeda(ctx.raw)}` } }
        },
        scales:{
          x:{ grid:{ color:'rgba(255,255,255,0.05)' }, ticks:{ color:'#8888a0', font:{size:11} } },
          y:{ grid:{ color:'rgba(255,255,255,0.05)' }, ticks:{ color:'#8888a0', font:{size:11}, callback:v=>'R$ '+Number(v).toLocaleString('pt-BR') } }
        }
      }
    });
  }, 100);
}

async function aplicarComparativoContas(modo) {
  contasComparativoModo = modo;
  contasComparativoMeses = Math.max(1, Math.min(60, Number(document.getElementById('contas-comp-meses')?.value||12)));
  contasComparativoAno = Number(document.getElementById('contas-comp-ano')?.value||new Date().getFullYear());
  await renderComparativoContas();
}

// Dashboard final: mostra A RECEBER e RECEBIDOS com a mesma importancia.
async function renderDashboardContas() {
  const body = document.getElementById('content-body');
  body.innerHTML = '<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando financeiro...</div>';

  const contas = await apiGet('contas_receber?select=*,clientes!fk_conta_cliente(nome_fantasia,razao_social)&order=data_vencimento.asc');
  await anexarCodigoVendaContas(contas);
  if(!Array.isArray(contas)) {
    body.innerHTML = '<div class="empty-state"><div class="empty-icon">!</div><p>Erro ao carregar dados</p></div>';
    return;
  }
  items = contas;
  filtered = filtrarLateralContasReceber(items);
  renderList();

  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const amanha = new Date(hoje.getTime()+864e5);
  const inicioSemana = new Date(hoje.getTime()-6*864e5);
  const range = contasMesSelecionadoRange();
  const pendentes = contas.filter(c=>contasValorAberto(c) > 0.005);
  const recebidas = contas.filter(c=>contasValorRecebido(c) > 0.005);
  const receberHoje = pendentes.filter(c=>{const d=contasDateLocal(c.data_vencimento); return d>=hoje && d<amanha;});
  const receberSemana = pendentes.filter(c=>{const d=contasDateLocal(c.data_vencimento); return d>=inicioSemana && d<amanha;});
  const receberMes = pendentes.filter(c=>{const d=contasDateOnly(c.data_vencimento); return d>=range.inicio && d<range.fim;});
  const receberMesAnterior = pendentes.filter(c=>{const d=contasDateOnly(c.data_vencimento); return d>=range.anteriorInicio && d<range.anteriorFim;});
  const recebidasHoje = recebidas.filter(c=>{const d=c.data_recebimento?new Date(c.data_recebimento):null; return d&&d>=hoje&&d<amanha;});
  const recebidasSemana = recebidas.filter(c=>{const d=c.data_recebimento?new Date(c.data_recebimento):null; return d&&d>=inicioSemana&&d<amanha;});
  const recebidasMes = recebidas.filter(c=>{const d=contasDateOnly(c.data_recebimento); return d>=range.inicio && d<range.fim;});
  const recebidasMesAnterior = recebidas.filter(c=>{const d=contasDateOnly(c.data_recebimento); return d>=range.anteriorInicio && d<range.anteriorFim;});
  const vencidas = pendentes.filter(c=>contasDateLocal(c.data_vencimento) < hoje);
  const proximos7 = pendentes.filter(c=>{const d=contasDateLocal(c.data_vencimento); return d>=hoje && d<=new Date(hoje.getTime()+7*864e5);});
  const d15 = pendentes.filter(c=>{const d=contasDateLocal(c.data_vencimento); return d>new Date(hoje.getTime()+7*864e5) && d<=new Date(hoje.getTime()+15*864e5);});
  const d30 = pendentes.filter(c=>{const d=contasDateLocal(c.data_vencimento); return d>new Date(hoje.getTime()+15*864e5) && d<=new Date(hoje.getTime()+30*864e5);});
  const mais30 = pendentes.filter(c=>contasDateLocal(c.data_vencimento) > new Date(hoje.getTime()+30*864e5));
  const pct = (atual, ant) => ant > 0 ? ((atual-ant)/ant*100) : null;
  const variacaoReceber = pct(contasSoma(receberMes), contasSoma(receberMesAnterior));
  const variacaoRecebido = pct(contasSoma(recebidasMes,true), contasSoma(recebidasMesAnterior,true));
  const variacaoText = v => v===null ? 'sem base' : `${v>=0?'+':''}${v.toFixed(1)}% vs anterior`;
  const variacaoColor = (v, positivoBom=true) => v===null ? 'var(--text3)' : (v>=0 ? (positivoBom?'var(--accent)':'var(--warn)') : (positivoBom?'var(--danger)':'var(--accent)'));
  const cardStyle = 'background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px;text-align:left;cursor:pointer;';

  const dias = parseInt(contasDashPeriodo);
  const labels = [], valoresRecebidos = [], valoresReceber = [];
  for(let i=dias-1; i>=0; i--) {
    const d = new Date(hoje.getTime()-i*864e5);
    const ds = contasFmtDataLocal(d);
    labels.push(d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}));
    valoresRecebidos.push(contasSoma(recebidas.filter(c=>contasDateOnly(c.data_recebimento)===ds), true));
    valoresReceber.push(contasSoma(pendentes.filter(c=>contasDateOnly(c.data_vencimento)===ds)));
  }

  const resumoCard = (filtro, titulo, label, valor, qtd, cor, extra='') => `
    <button onclick="listarContas('${filtro}','${titulo}')" style="${cardStyle}">
      <div style="font-size:10px;color:var(--text2);font-family:var(--mono);text-transform:uppercase;">${label}</div>
      <div style="font-size:16px;font-weight:700;color:${cor};line-height:1.2;margin-top:3px;">${contasFmtMoeda(valor)}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px;">${qtd} conta${qtd!==1?'s':''}</div>
      ${extra}
    </button>`;

  const totalBase = Math.max(1, contasSoma(pendentes) + contasSoma(recebidasMes,true));
  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
      <button class="dash-period-btn" onclick="mudarMesContasDashboard(-1)">â€¹ Mes anterior</button>
      <button class="dash-period-btn ${contasDashMesOffset===0?'active':''}" onclick="irMesAtualContasDashboard()">Mes atual</button>
      <button class="dash-period-btn" onclick="mudarMesContasDashboard(1)" ${contasDashMesOffset>=0?'disabled style="opacity:.45;cursor:not-allowed;"':''}>Proximo mes â€º</button>
      <button class="dash-period-btn" onclick="renderComparativoContas()">Comparar meses</button>
      <button class="dash-period-btn" onclick="renderBaixaClienteContas()">Baixar cliente</button>
      <span style="font-size:12px;color:var(--text2);font-family:var(--mono);margin-left:auto;text-transform:uppercase;">${range.label}</span>
    </div>

    <div class="dash-chart-box" style="margin-bottom:16px;padding:12px;">
      <div class="dash-chart-title" style="margin-bottom:10px;"><span>A receber</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px;margin-bottom:14px;">
        ${resumoCard('receber_hoje','A Receber Hoje','Hoje',contasSoma(receberHoje),receberHoje.length,'var(--warn)')}
        ${resumoCard('receber_semana','A Receber na Semana','Semana',contasSoma(receberSemana),receberSemana.length,'var(--warn)')}
        ${resumoCard('receber_mes','A Receber no Mes','Mes selecionado',contasSoma(receberMes),receberMes.length,'var(--warn)',`<div style="font-size:10px;color:${variacaoColor(variacaoReceber,false)};margin-top:2px;">${variacaoText(variacaoReceber)}</div>`)}
        ${resumoCard('pendente','Aberto Total','Aberto total',contasSoma(pendentes),pendentes.length,'var(--warn)')}
      </div>

      <div class="dash-chart-title" style="margin-bottom:10px;"><span>Recebidos</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px;">
        ${resumoCard('recebido_hoje','Recebido Hoje','Hoje',contasSoma(recebidasHoje,true),recebidasHoje.length,'var(--accent)')}
        ${resumoCard('recebido_semana','Recebido na Semana','Semana',contasSoma(recebidasSemana,true),recebidasSemana.length,'var(--accent2)')}
        ${resumoCard('recebido_mes','Recebido no Mes','Mes selecionado',contasSoma(recebidasMes,true),recebidasMes.length,'var(--accent)',`<div style="font-size:10px;color:${variacaoColor(variacaoRecebido)};margin-top:2px;">${variacaoText(variacaoRecebido)}</div>`)}
        ${resumoCard('vencido','Vencidas','Vencidas',contasSoma(vencidas),vencidas.length,'var(--danger)')}
      </div>
    </div>

    <div class="dash-charts" style="margin-bottom:16px;">
      <div class="dash-chart-box">
        <div class="dash-chart-title">
          <span>A receber x Recebidos</span>
          <div class="dash-chart-period">
            <button class="dash-period-btn ${contasDashPeriodo==='7'?'active':''}" onclick="mudarPeriodoContas('7')">7d</button>
            <button class="dash-period-btn ${contasDashPeriodo==='15'?'active':''}" onclick="mudarPeriodoContas('15')">15d</button>
            <button class="dash-period-btn ${contasDashPeriodo==='30'?'active':''}" onclick="mudarPeriodoContas('30')">30d</button>
          </div>
        </div>
        <div class="dash-canvas-wrap sm"><canvas id="chart-contas"></canvas></div>
      </div>

      <div class="dash-chart-box">
        <div class="dash-chart-title"><span>Vencimentos em Aberto</span></div>
        <div class="dash-list">
          ${[
            ['vencido','Vencidas',vencidas,'var(--danger)','!'],
            ['7dias','Proximos 7 dias',proximos7,'var(--warn)','7d'],
            ['15dias','8 a 15 dias',d15,'var(--accent2)','15d'],
            ['30dias','16 a 30 dias',d30,'var(--accent)','30d'],
            ['mais30','Mais de 30 dias',mais30,'var(--text3)','+30']
          ].map(([filtro,label,lista,cor,rank])=>`
            <div class="dash-list-item" onclick="listarContas('${filtro}','${label}')">
              <span class="dash-list-rank" style="color:${cor};">${rank}</span>
              <div style="flex:1;">
                <div style="display:flex;justify-content:space-between;">
                  <span class="dash-list-name">${label}</span>
                  <span class="dash-list-value" style="color:${cor};">${contasFmtMoeda(contasSoma(lista))}</span>
                </div>
                <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${(contasSoma(lista)/totalBase*100).toFixed(0)}%;background:${cor}"></div></div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;

  setTimeout(() => {
    const ctx = document.getElementById('chart-contas');
    if(!ctx) return;
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label:'A receber', data:valoresReceber, borderColor:'#ffa500', backgroundColor:'rgba(255,165,0,0.08)', borderWidth:2, pointRadius:3, fill:true, tension:.35 },
          { label:'Recebido', data:valoresRecebidos, borderColor:'#00e5a0', backgroundColor:'rgba(0,229,160,0.08)', borderWidth:2, pointRadius:3, fill:true, tension:.35 }
        ]
      },
      options: {
        responsive:true,
        maintainAspectRatio:false,
        plugins:{
          legend:{ position:'bottom', labels:{ color:'#8888a0', font:{size:11}, padding:12 } },
          tooltip:{ callbacks:{ label: ctx => `${ctx.dataset.label}: ${contasFmtMoeda(ctx.raw)}` } }
        },
        scales:{
          x:{ grid:{ color:'rgba(255,255,255,0.05)' }, ticks:{ color:'#8888a0', font:{size:11} } },
          y:{ grid:{ color:'rgba(255,255,255,0.05)' }, ticks:{ color:'#8888a0', font:{size:11}, callback:v=>'R$ '+Number(v).toLocaleString('pt-BR') } }
        }
      }
    });
  }, 100);
}

function listarContas(filtro, titulo) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const amanha = new Date(hoje.getTime()+864e5);
  const inicioSemana = new Date(hoje.getTime()-6*864e5);
  const range = contasMesSelecionadoRange();
  let lista = [...items];

  if(filtro==='vencido') lista=lista.filter(c=>contasValorAberto(c)>0.005&&contasDateLocal(c.data_vencimento)<hoje);
  else if(filtro==='pendente') lista=lista.filter(c=>contasValorAberto(c)>0.005);
  else if(filtro==='receber_hoje') lista=lista.filter(c=>{const d=contasDateLocal(c.data_vencimento);return contasValorAberto(c)>0.005&&d>=hoje&&d<amanha;});
  else if(filtro==='receber_semana') lista=lista.filter(c=>{const d=contasDateLocal(c.data_vencimento);return contasValorAberto(c)>0.005&&d>=inicioSemana&&d<amanha;});
  else if(filtro==='receber_mes') lista=lista.filter(c=>{const d=contasDateOnly(c.data_vencimento);return contasValorAberto(c)>0.005&&d>=range.inicio&&d<range.fim;});
  else if(filtro==='recebido_hoje') lista=lista.filter(c=>{const d=c.data_recebimento?new Date(c.data_recebimento):null;return contasValorRecebido(c)>0.005&&d&&d>=hoje&&d<amanha;});
  else if(filtro==='recebido_semana') lista=lista.filter(c=>{const d=c.data_recebimento?new Date(c.data_recebimento):null;return contasValorRecebido(c)>0.005&&d&&d>=inicioSemana&&d<amanha;});
  else if(filtro==='recebido_mes') lista=lista.filter(c=>{const d=contasDateOnly(c.data_recebimento);return contasValorRecebido(c)>0.005&&d>=range.inicio&&d<range.fim;});
  else if(filtro==='7dias') lista=lista.filter(c=>{const d=contasDateLocal(c.data_vencimento);return contasValorAberto(c)>0.005&&d>=hoje&&d<=new Date(hoje.getTime()+7*864e5);});
  else if(filtro==='15dias') lista=lista.filter(c=>{const d=contasDateLocal(c.data_vencimento);return contasValorAberto(c)>0.005&&d>new Date(hoje.getTime()+7*864e5)&&d<=new Date(hoje.getTime()+15*864e5);});
  else if(filtro==='30dias') lista=lista.filter(c=>{const d=contasDateLocal(c.data_vencimento);return contasValorAberto(c)>0.005&&d>new Date(hoje.getTime()+15*864e5)&&d<=new Date(hoje.getTime()+30*864e5);});
  else if(filtro==='mais30') lista=lista.filter(c=>contasValorAberto(c)>0.005&&contasDateLocal(c.data_vencimento)>new Date(hoje.getTime()+30*864e5));
  else if(filtro===null) lista=lista.filter(c=>contasValorRecebido(c)>0.005);

  const total = lista.reduce((s,c)=>s+(filtro && String(filtro).startsWith('recebido') ? contasValorRecebido(c) : contasValorAberto(c)),0);
  document.getElementById('content-body').innerHTML = `
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <button onclick="renderDashboardContas()" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--text2);font-size:12px;padding:5px 12px;cursor:pointer;">â† Voltar</button>
      <span style="font-size:15px;font-weight:600;">${titulo}</span>
      <span style="font-size:12px;color:var(--text2);margin-left:auto;">${lista.length} conta${lista.length!==1?'s':''} Â· ${contasFmtMoeda(total)}</span>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:760px;">
        <thead><tr style="background:var(--surface2);">
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">Cliente</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Pedido / Venda</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Vencimento</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Recebimento</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Pagamento</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Status</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Valor</th>
        </tr></thead>
        <tbody>
          ${lista.length===0?'<tr><td colspan="7" style="padding:20px;text-align:center;color:var(--text3);">Nenhuma conta encontrada</td></tr>':
          lista.map(c=>{
            const venc=contasDateLocal(c.data_vencimento);
            const receb=new Date(c.data_recebimento || '');
            const atras=c.status_recebimento!=='RECEBIDO'&&venc<hoje;
            const sc=c.status_recebimento==='RECEBIDO'?'on':atras?'vencido':'warn';
            const sl=c.status_recebimento==='RECEBIDO'?'RECEBIDO':atras?'VENCIDO':'PENDENTE';
            const valorLinha = c.status_recebimento==='RECEBIDO' ? (c.valor_recebido||c.valor_original) : c.valor_original;
            return `<tr style="border-top:1px solid var(--border);cursor:pointer;" onclick="openItem(${c.id_conta})" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
              <td style="padding:10px 14px;">${c.clientes?.nome_fantasia||c.clientes?.razao_social||'-'}</td>
              <td style="padding:10px 14px;text-align:center;color:var(--accent);font-family:var(--mono);font-weight:600;">${c.codigo_venda || (c.id_venda ? '#'+c.id_venda : '-')}<div style="font-size:10px;color:var(--text3);font-weight:400;margin-top:2px;">${contasFmtDataBR(c.data_venda)}</div></td>
              <td style="padding:10px 14px;text-align:center;color:${atras?'var(--danger)':'var(--text2)'};">${venc.toLocaleDateString('pt-BR')}</td>
              <td style="padding:10px 14px;text-align:center;color:${c.status_recebimento==='RECEBIDO'?'var(--accent)':'var(--text3)'};">${c.data_recebimento?receb.toLocaleDateString('pt-BR'):'-'}</td>
              <td style="padding:10px 14px;text-align:center;color:var(--text2);">${c.meio_pagamento||'-'}</td>
              <td style="padding:10px 14px;text-align:center;"><span class="pill ${sc}">${sl}</span></td>
              <td style="padding:10px 14px;text-align:right;font-weight:600;color:var(--accent);font-family:var(--mono);">${contasFmtMoeda(valorLinha)}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr style="border-top:2px solid var(--border);background:var(--surface2);">
          <td colspan="6" style="padding:10px 14px;font-weight:600;">Total</td>
          <td style="padding:10px 14px;text-align:right;font-weight:700;color:var(--accent);font-family:var(--mono);">${contasFmtMoeda(total)}</td>
        </tr></tfoot>
      </table>
    </div>`;
}


