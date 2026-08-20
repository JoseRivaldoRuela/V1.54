let itensCompraAtual = [];
let itemCompraEmEdicao = null;
let chartCompras = null;
let chartContasPagar = null;
let tipoEntradaCompraNova = 'BASICA';

function compraFmt(n) {
  return 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function compraNumeroDecimal(valor) {
  let texto=String(valor??'').trim().replace(/\s|R\$/gi,'');
  if(texto.includes(',')) texto=texto.replace(/\./g,'').replace(',','.');
  const numero=Number(texto);
  return Number.isFinite(numero)?numero:0;
}

function normalizarPrecoLiberacao(el) {
  if(!el)return;
  el.value=compraNumeroDecimal(el.value).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

const compraEsc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function compraObjetoFiscal(valor) {
  if(valor&&typeof valor==='object')return valor;
  try{return JSON.parse(valor||'{}');}catch(e){return {};}
}

function compraImpostosItensXml(xml) {
  if(!xml)return [];
  try{
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    const txt=(el,tag)=>el?.getElementsByTagName(tag)?.[0]?.textContent?.trim()||'';
    return [...doc.getElementsByTagName('det')].map(det=>{
      const prod=det.getElementsByTagName('prod')[0],imp=det.getElementsByTagName('imposto')[0];
      const grupo=tag=>imp?.getElementsByTagName(tag)?.[0];
      const campos=(el,nomes)=>Object.fromEntries(nomes.map(n=>[n,txt(el,n)]).filter(([,v])=>v!==''));
      return {numero:det.getAttribute('nItem'),produto:txt(prod,'xProd'),codigo:txt(prod,'cProd'),
        icms:campos(grupo('ICMS'),['orig','CST','CSOSN','modBC','vBC','pICMS','vICMS','pFCP','vFCP','modBCST','vBCST','pICMSST','vICMSST']),
        ipi:campos(grupo('IPI'),['cEnq','CST','vBC','pIPI','vIPI']),
        pis:campos(grupo('PIS'),['CST','vBC','pPIS','vPIS']),
        cofins:campos(grupo('COFINS'),['CST','vBC','pCOFINS','vCOFINS']),
        ii:campos(grupo('II'),['vBC','vDespAdu','vII','vIOF'])};
    });
  }catch(e){return [];}
}

function renderPainelFiscalCompra(c) {
  if(c?.tipo_entrada!=='NOTA_FISCAL')return '';
  const dados=compraObjetoFiscal(c.dados_nfe), impostos=compraObjetoFiscal(c.impostos_nfe);
  const fornecedor=dados.fornecedor||{}, duplicatas=Array.isArray(dados.duplicatas)?dados.duplicatas:[];
  const itensFiscais=compraImpostosItensXml(c.xml_nfe);
  const nomes={vBC:'Base ICMS',vICMS:'ICMS',vICMSDeson:'ICMS desonerado',vFCP:'FCP',vBCST:'Base ICMS-ST',vST:'ICMS-ST',vFCPST:'FCP-ST',vFCPSTRet:'FCP-ST retido',vProd:'Produtos',vFrete:'Frete',vSeg:'Seguro',vDesc:'Desconto',vII:'II',vIPI:'IPI',vIPIDevol:'IPI devolvido',vPIS:'PIS',vCOFINS:'COFINS',vOutro:'Outras despesas',vNF:'Total NF-e',vTotTrib:'Tributos estimados'};
  const blocoTributo=(titulo,obj)=>Object.keys(obj||{}).length?`<div style="margin-top:6px;"><strong style="font-size:11px;color:var(--accent2);">${titulo}</strong><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">${Object.entries(obj).map(([k,v])=>`<span style="font-size:10px;color:var(--text2);">${k}: <b style="color:var(--text);">${compraEsc(v)}</b></span>`).join('')}</div></div>`:'';
  return `<div class="section-label"><span>Dados completos da NF-e</span><span class="pill adm">Fiscal</span></div>
    <div class="dash-chart-box" style="margin-bottom:14px;">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;">
        <div><div class="form-label">Número / Série</div><strong>${compraEsc(c.numero_nota||dados.numero||'-')} / ${compraEsc(dados.serie||'-')}</strong></div>
        <div><div class="form-label">Modelo</div><strong>${compraEsc(dados.modelo||'-')}</strong></div>
        <div><div class="form-label">Chave de acesso</div><strong style="font-size:11px;word-break:break-all;">${compraEsc(c.chave_nfe||dados.chave||'-')}</strong></div>
        <div><div class="form-label">CNPJ emitente</div><strong>${compraEsc(fornecedor.cnpj||'-')}</strong></div>
        <div><div class="form-label">Razão social</div><strong>${compraEsc(fornecedor.razao||'-')}</strong></div>
        <div><div class="form-label">Inscrição estadual</div><strong>${compraEsc(fornecedor.ie||'-')}</strong></div>
      </div>
      <div class="section-label" style="margin-top:14px;"><span>Totais e impostos</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px;">${Object.entries(impostos).map(([k,v])=>`<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px;"><div style="font-size:10px;color:var(--text3);">${compraEsc(nomes[k]||k)}</div><strong style="font-family:var(--mono);font-size:12px;">${compraFmt(v)}</strong></div>`).join('')||'<span style="color:var(--text3);font-size:12px;">Sem resumo fiscal estruturado.</span>'}</div>
      ${duplicatas.length?`<div class="section-label" style="margin-top:14px;"><span>Duplicatas</span></div><div style="display:flex;gap:8px;flex-wrap:wrap;">${duplicatas.map((d,i)=>`<span class="pill warn">${i+1}: ${compraEsc(d.vencimento)} · ${compraFmt(d.valor)}</span>`).join('')}</div>`:''}
      <div class="section-label" style="margin-top:14px;"><span>Impostos por item</span></div>
      ${itensFiscais.length?itensFiscais.map(i=>`<details style="border-top:1px solid var(--border);padding:9px 0;"><summary style="cursor:pointer;font-size:12px;font-weight:600;">Item ${compraEsc(i.numero)} · ${compraEsc(i.produto)} <span style="color:var(--text3);font-weight:400;">(${compraEsc(i.codigo)})</span></summary>${blocoTributo('ICMS',i.icms)}${blocoTributo('IPI',i.ipi)}${blocoTributo('PIS',i.pis)}${blocoTributo('COFINS',i.cofins)}${blocoTributo('II',i.ii)}</details>`).join(''):'<div style="color:var(--text3);font-size:12px;">Sem impostos estruturados por item.</div>'}
      ${c.xml_nfe?`<details style="margin-top:14px;"><summary style="cursor:pointer;color:var(--accent2);font-size:12px;">Ver XML original completo</summary><pre style="white-space:pre-wrap;word-break:break-all;max-height:360px;overflow:auto;background:var(--surface2);padding:10px;margin-top:8px;font-size:10px;">${compraEsc(c.xml_nfe)}</pre></details>`:''}
    </div>`;
}

function contaPagarDateLocal(value) {
  const raw = String(value||'').slice(0,10);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return value ? new Date(value) : new Date(NaN);
}

function contaPagarAberto(c) {
  return Math.max(0, Number(c.valor_original||0) - Number(c.valor_pago||0));
}

function contasPagarMesSelecionadoRange() {
  const hoje = new Date();
  const mesRef = new Date(hoje.getFullYear(), hoje.getMonth() + contasPagarDashMesOffset, 1);
  const dataLocal = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return {
    inicio: dataLocal(mesRef),
    fim: dataLocal(new Date(mesRef.getFullYear(), mesRef.getMonth()+1, 1)),
    label: mesRef.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})
  };
}

async function renderDashboardContasPagar() {
  const body = document.getElementById('content-body');
  body.innerHTML = '<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando contas a pagar...</div>';

  await loadCaches();
  const contas = await apiGet('contas_pagar?select=*&order=data_vencimento.desc,id_conta_pagar.desc');
  if(!Array.isArray(contas)) {
    body.innerHTML = '<div class="empty-state"><div class="empty-icon">!</div><p>Erro ao carregar contas a pagar</p></div>';
    return;
  }

  await anexarDadosCompraContasPagar(contas);
  contasPagarFiltroAtivo = null;
  items = contas;
  filtered = ordenarLateralContasPagar(items);
  renderList();
  const badge = document.getElementById('badge-contas_pagar');
  if(badge) badge.textContent = items.length;
  const footer = document.getElementById('sidebar-footer');
  if(footer) footer.textContent = `${items.length} contas a pagar`;

  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const amanha = new Date(hoje.getTime()+864e5);
  const seteDias = new Date(hoje.getTime()+7*864e5);
  const pendentes = contas.filter(c=>c.status_pagamento !== 'PAGO' && c.status_pagamento !== 'CANCELADO');
  const pagas = contas.filter(c=>c.status_pagamento === 'PAGO');
  const range = contasPagarMesSelecionadoRange();
  const pendentesMes = pendentes.filter(c=>{ const d=String(c.data_vencimento||'').slice(0,10); return d>=range.inicio && d<range.fim; });
  const dataReferenciaPaga = c => String(contasPagarDataPagasModo === 'vencimento' ? c.data_vencimento : c.data_pagamento || '').slice(0,10);
  const pagasMes = pagas.filter(c=>{ const d=dataReferenciaPaga(c); return d>=range.inicio && d<range.fim; });
  const vencidas = pendentes.filter(c=>contaPagarDateLocal(c.data_vencimento) < hoje);
  const pagarHoje = pendentes.filter(c=>{ const d=contaPagarDateLocal(c.data_vencimento); return d>=hoje && d<amanha; });
  const proximos7 = pendentes.filter(c=>{ const d=contaPagarDateLocal(c.data_vencimento); return d>=hoje && d<=seteDias; });
  const somaAberto = arr => arr.reduce((s,c)=>s+contaPagarAberto(c),0);
  const somaPago = arr => arr.reduce((s,c)=>s+Number(c.valor_pago||c.valor_original||0),0);
  const dias = parseInt(contasPagarDashPeriodo || '7', 10);
  const labels = [], valoresPagos = [], valoresPagar = [], fornecedoresPagos = [], fornecedoresPagar = [];
  const detalharFornecedores = (lista, pago=false) => {
    const agrupado=new Map();
    lista.forEach(c=>{
      const fornecedor=cacheFornecedores.find(f=>Number(f.id_fornecedor)===Number(c.id_fornecedor));
      const nome=fornecedor?.nome_fantasia||fornecedor?.razao_social||`Fornecedor #${c.id_fornecedor||'-'}`;
      const valor=pago?Number(c.valor_pago||c.valor_original||0):contaPagarAberto(c);
      agrupado.set(nome,(agrupado.get(nome)||0)+valor);
    });
    return [...agrupado.entries()].sort((a,b)=>b[1]-a[1]).map(([nome,valor])=>`${nome}: ${compraFmt(valor)}`);
  };
  for(let i=dias-1; i>=0; i--) {
    const d = new Date(hoje.getTime()-i*864e5);
    const data = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const pendentesDia=pendentes.filter(c=>String(c.data_vencimento||'').slice(0,10)===data);
    const pagasDia=pagas.filter(c=>String(c.data_pagamento||'').slice(0,10)===data);
    labels.push(d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}));
    valoresPagar.push(somaAberto(pendentesDia));
    valoresPagos.push(somaPago(pagasDia));
    fornecedoresPagar.push(detalharFornecedores(pendentesDia));
    fornecedoresPagos.push(detalharFornecedores(pagasDia,true));
  }
  const card = (filtro, label, valor, qtd, cor) => `
    <button class="dash-card" onclick="listarContasPagarDash('${filtro}')" style="text-align:left;cursor:pointer;">
      <div class="dash-card-label">${label}</div>
      <div class="dash-card-value" style="font-size:20px;line-height:1.15;color:${cor};">${compraFmt(valor)}</div>
      <div class="dash-card-sub">${qtd} conta${qtd!==1?'s':''}</div>
    </button>`;

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
      <button class="dash-period-btn" onclick="mudarMesContasPagarDashboard(-1)">‹ Mês anterior</button>
      <button class="dash-period-btn ${contasPagarDashMesOffset===0?'active':''}" onclick="irMesAtualContasPagarDashboard()">Mês atual</button>
      <button class="dash-period-btn" onclick="mudarMesContasPagarDashboard(1)" ${contasPagarDashMesOffset>=0?'disabled style="opacity:.45;cursor:not-allowed;"':''}>Próximo mês ›</button>
      <span style="width:1px;height:20px;background:var(--border);margin:0 2px;"></span>
      <button class="dash-period-btn ${contasPagarDataPagasModo==='pagamento'?'active':''}" onclick="mudarDataPagasContasPagar('pagamento')">Por pagamento</button>
      <button class="dash-period-btn ${contasPagarDataPagasModo==='vencimento'?'active':''}" onclick="mudarDataPagasContasPagar('vencimento')">Por vencimento</button>
      <span style="font-size:12px;color:var(--text2);font-family:var(--mono);margin-left:auto;text-transform:uppercase;">${range.label}</span>
    </div>

    <div class="dash-grid">
      ${card('pagar_mes','A Pagar no Mês',somaAberto(pendentesMes),pendentesMes.length,'var(--warn)')}
      ${card('hoje','Vence Hoje',somaAberto(pagarHoje),pagarHoje.length,'var(--accent2)')}
      ${card('7dias','Proximos 7 Dias',somaAberto(proximos7),proximos7.length,'var(--accent)')}
      ${card('vencido','Vencidas',somaAberto(vencidas),vencidas.length,'var(--danger)')}
      ${card('pago_mes',`Pago no Mês (${contasPagarDataPagasModo==='pagamento'?'pagamento':'vencimento'})`,somaPago(pagasMes),pagasMes.length,'var(--accent)')}
    </div>

    <div class="dash-chart-box" style="margin-bottom:20px;">
      <div class="dash-chart-title">
        <span>A pagar x Pago</span>
        <div class="dash-chart-period">
          <button class="dash-period-btn ${contasPagarDashPeriodo==='7'?'active':''}" onclick="mudarPeriodoContasPagar('7')">7d</button>
          <button class="dash-period-btn ${contasPagarDashPeriodo==='15'?'active':''}" onclick="mudarPeriodoContasPagar('15')">15d</button>
          <button class="dash-period-btn ${contasPagarDashPeriodo==='30'?'active':''}" onclick="mudarPeriodoContasPagar('30')">30d</button>
        </div>
      </div>
      <div class="dash-canvas-wrap sm"><canvas id="chart-contas-pagar"></canvas></div>
    </div>`;

  setTimeout(() => {
    const ctx = document.getElementById('chart-contas-pagar');
    if(!ctx) return;
    if(chartContasPagar) chartContasPagar.destroy();
    chartContasPagar = new Chart(ctx, {
      type:'line',
      data:{ labels, datasets:[
        {label:'A pagar',data:valoresPagar,fornecedoresPorPonto:fornecedoresPagar,borderColor:'#ffa500',backgroundColor:'rgba(255,165,0,0.08)',borderWidth:2,pointRadius:3,fill:true,tension:.35},
        {label:'Pago',data:valoresPagos,fornecedoresPorPonto:fornecedoresPagos,borderColor:'#00e5a0',backgroundColor:'rgba(0,229,160,0.08)',borderWidth:2,pointRadius:3,fill:true,tension:.35}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#8888a0',font:{size:11},padding:12}},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${compraFmt(ctx.raw)}`,afterLabel:ctx=>ctx.dataset.fornecedoresPorPonto?.[ctx.dataIndex]||[]}}},scales:{x:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#8888a0',font:{size:11}}},y:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#8888a0',font:{size:11},callback:v=>'R$ '+Number(v).toLocaleString('pt-BR')}}}}
    });
  }, 100);
}

function mudarPeriodoContasPagar(periodo) {
  contasPagarDashPeriodo = periodo;
  renderDashboardContasPagar();
}

async function mudarMesContasPagarDashboard(delta) {
  contasPagarDashMesOffset += delta;
  if(contasPagarDashMesOffset > 0) contasPagarDashMesOffset = 0;
  await renderDashboardContasPagar();
}

async function irMesAtualContasPagarDashboard() {
  contasPagarDashMesOffset = 0;
  await renderDashboardContasPagar();
}

async function mudarDataPagasContasPagar(modo) {
  contasPagarDataPagasModo = modo === 'vencimento' ? 'vencimento' : 'pagamento';
  await renderDashboardContasPagar();
}

function listarContasPagarDash(filtro) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const amanha = new Date(hoje.getTime()+864e5);
  const seteDias = new Date(hoje.getTime()+7*864e5);
  const range = contasPagarMesSelecionadoRange();
  let lista = [...items];
  if(filtro==='pendente') lista = lista.filter(c=>c.status_pagamento !== 'PAGO' && c.status_pagamento !== 'CANCELADO');
  else if(filtro==='pago') lista = lista.filter(c=>c.status_pagamento === 'PAGO');
  else if(filtro==='pagar_mes') lista = lista.filter(c=>{ const d=String(c.data_vencimento||'').slice(0,10); return c.status_pagamento !== 'PAGO' && c.status_pagamento !== 'CANCELADO' && d>=range.inicio && d<range.fim; });
  else if(filtro==='pago_mes') lista = lista.filter(c=>{ const d=String(contasPagarDataPagasModo === 'vencimento' ? c.data_vencimento : c.data_pagamento || '').slice(0,10); return c.status_pagamento === 'PAGO' && d>=range.inicio && d<range.fim; });
  else if(filtro==='vencido') lista = lista.filter(c=>c.status_pagamento !== 'PAGO' && c.status_pagamento !== 'CANCELADO' && contaPagarDateLocal(c.data_vencimento) < hoje);
  else if(filtro==='hoje') lista = lista.filter(c=>{ const d=contaPagarDateLocal(c.data_vencimento); return c.status_pagamento !== 'PAGO' && c.status_pagamento !== 'CANCELADO' && d>=hoje && d<amanha; });
  else if(filtro==='7dias') lista = lista.filter(c=>{ const d=contaPagarDateLocal(c.data_vencimento); return c.status_pagamento !== 'PAGO' && c.status_pagamento !== 'CANCELADO' && d>=hoje && d<=seteDias; });
  const labels = {
    pagar_mes:`A pagar em ${range.label}`,
    pago_mes:`Pagas em ${range.label} por ${contasPagarDataPagasModo}`,
    pendente:'Todas em aberto', pago:'Todas pagas', vencido:'Vencidas', hoje:'Vencem hoje', '7dias':'Próximos 7 dias'
  };
  contasPagarFiltroAtivo = { filtro, label:labels[filtro] || 'Pesquisa' };
  filtered = ordenarLateralContasPagar(lista);
  renderList();
}

function limparFiltroContasPagar() {
  contasPagarFiltroAtivo = null;
  const busca = normalizarBusca(document.getElementById('search-input')?.value || '');
  const fields = tabConfig.contas_pagar.searchFields;
  const lista = busca ? items.filter(c=>itemContemBusca(c, busca, fields)) : items;
  filtered = ordenarLateralContasPagar(lista);
  renderList();
}

async function renderDashboardCompras() {
  const body = document.getElementById('content-body');
  setActiveMenu('compras');
  body.innerHTML = '<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando dashboard...</div>';

  await loadCaches();
  const hoje = new Date();
  const hojeStr = hoje.toISOString().slice(0,10);
  const semana = new Date(hoje.getTime()-7*864e5).toISOString().slice(0,10);
  const mes = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-01`;

  const [compras, itens] = await Promise.all([
    apiGet('compras?select=*&order=data_compra.desc'),
    apiGet('compra_itens?select=*&order=id_item_compra.asc')
  ]);
  if(!Array.isArray(compras)) {
    body.innerHTML = '<div class="empty-state"><div class="empty-icon">!</div><p>Erro ao carregar compras</p></div>';
    return;
  }
  const compraItens = Array.isArray(itens) ? itens : [];

  const soma = arr => arr.reduce((s,c)=>s+Number(c.valor_total||0),0);
  const comprasHoje = compras.filter(c=>(c.data_compra||'').slice(0,10)===hojeStr);
  const comprasSemana = compras.filter(c=>(c.data_compra||'').slice(0,10)>=semana);
  const comprasMes = compras.filter(c=>(c.data_compra||'').slice(0,10)>=mes);
  const pendentes = compras.filter(c=>c.status_compra==='PENDENTE');
  const liberadasMes = comprasMes.filter(c=>c.status_compra==='LIBERADA');

  const fornMap = {};
  comprasMes.forEach(c => {
    const f = cacheFornecedores.find(x=>Number(x.id_fornecedor)===Number(c.id_fornecedor));
    const nome = f?.nome_fantasia || f?.razao_social || `Fornecedor #${c.id_fornecedor}`;
    if(!fornMap[nome]) fornMap[nome] = {nome,total:0,qtd:0};
    fornMap[nome].total += Number(c.valor_total||0);
    fornMap[nome].qtd++;
  });
  const topFornecedores = Object.values(fornMap).sort((a,b)=>b.total-a.total).slice(0,5);

  const comprasMesIds = new Set(comprasMes.map(c=>Number(c.id_compra)));
  const prodMap = {};
  compraItens.filter(i=>comprasMesIds.has(Number(i.id_compra))).forEach(i => {
    const p = cacheProdutos.find(x=>Number(x.id_produto)===Number(i.id_produto));
    const nome = p?.nome_mercadoria || `Produto #${i.id_produto}`;
    if(!prodMap[nome]) prodMap[nome] = {nome,total:0,qtd:0};
    prodMap[nome].total += Number(i.subtotal||0);
    prodMap[nome].qtd += Number(i.quantidade||0);
  });
  const topProdutos = Object.values(prodMap).sort((a,b)=>b.total-a.total).slice(0,6);

  const labels = [], valores = [];
  for(let i=29; i>=0; i--) {
    const d = new Date(hoje.getTime()-i*864e5);
    const ds = d.toISOString().slice(0,10);
    labels.push(d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}));
    valores.push(compras.filter(c=>(c.data_compra||'').slice(0,10)===ds).reduce((s,c)=>s+Number(c.valor_total||0),0));
  }

  body.innerHTML = `
    <div class="dash-grid">
      <div class="dash-card green" onclick="listarComprasDash('hoje')">
        <div class="dash-card-label">Compras Hoje</div>
        <div class="dash-card-value" style="font-size:20px;line-height:1.15;">${compraFmt(soma(comprasHoje))}</div>
        <div class="dash-card-sub">${comprasHoje.length} compra${comprasHoje.length!==1?'s':''}</div>
      </div>
      <div class="dash-card blue" onclick="listarComprasDash('semana')">
        <div class="dash-card-label">Últimos 7 Dias</div>
        <div class="dash-card-value" style="font-size:20px;line-height:1.15;">${compraFmt(soma(comprasSemana))}</div>
        <div class="dash-card-sub">${comprasSemana.length} compra${comprasSemana.length!==1?'s':''}</div>
      </div>
      <div class="dash-card orange" onclick="listarComprasDash('mes')">
        <div class="dash-card-label">Este Mês</div>
        <div class="dash-card-value" style="font-size:20px;line-height:1.15;">${compraFmt(soma(comprasMes))}</div>
        <div class="dash-card-sub">${liberadasMes.length} liberada${liberadasMes.length!==1?'s':''}</div>
      </div>
      <div class="dash-card red" onclick="listarComprasDash('pendente')">
        <div class="dash-card-label">Entradas Pendentes</div>
        <div class="dash-card-value">${pendentes.length}</div>
        <div class="dash-card-sub">${compraFmt(soma(pendentes))}</div>
      </div>
    </div>

    <div class="dash-charts">
      <div class="dash-chart-box">
        <div class="dash-chart-title"><span>Compras por Período</span></div>
        <div class="dash-canvas-wrap"><canvas id="chart-compras"></canvas></div>
      </div>
      <div class="dash-chart-box">
        <div class="dash-chart-title"><span>Top Fornecedores do Mês</span></div>
        <div class="dash-list">
          ${topFornecedores.length ? topFornecedores.map((f,i)=>{
            const pct = topFornecedores[0].total ? (f.total/topFornecedores[0].total*100).toFixed(0) : 0;
            return `<div class="dash-list-item">
              <span class="dash-list-rank">${i+1}</span>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;gap:8px;"><span class="dash-list-name">${f.nome}</span><span class="dash-list-value">${compraFmt(f.total)}</span></div>
                <div style="font-size:11px;color:var(--text2);">${f.qtd} compra${f.qtd!==1?'s':''}</div>
                <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${pct}%;background:var(--warn)"></div></div>
              </div>
            </div>`;
          }).join('') : '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;">Nenhum dado no mês</div>'}
        </div>
      </div>
    </div>

    <div class="dash-chart-box" style="margin-bottom:20px;">
      <div class="dash-chart-title"><span>Produtos Mais Comprados no Mês</span></div>
      <div class="dash-two-col">
        ${topProdutos.length ? topProdutos.map((p,i)=>{
          const pct = topProdutos[0].total ? (p.total/topProdutos[0].total*100).toFixed(0) : 0;
          return `<div class="dash-list-item">
            <span class="dash-list-rank">${i+1}</span>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;justify-content:space-between;gap:8px;"><span class="dash-list-name">${p.nome}</span><span class="dash-list-value">${compraFmt(p.total)}</span></div>
              <div style="font-size:11px;color:var(--text2);">${Number(p.qtd||0).toFixed(2)} un compradas</div>
              <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${pct}%;background:var(--accent2)"></div></div>
            </div>
          </div>`;
        }).join('') : '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;grid-column:1/-1;">Nenhum produto comprado no mês</div>'}
      </div>
    </div>`;

  setTimeout(() => {
    const ctx = document.getElementById('chart-compras');
    if(!ctx) return;
    if(chartCompras) chartCompras.destroy();
    chartCompras = new Chart(ctx, {
      type:'line',
      data:{ labels, datasets:[{ label:'Compras (R$)', data:valores, borderColor:'#ffa502', backgroundColor:'rgba(255,165,2,.08)', borderWidth:2, pointBackgroundColor:'#ffa502', pointRadius:3, fill:true, tension:.35 }] },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:ctx=>compraFmt(ctx.raw) } } },
        scales:{
          x:{ grid:{color:'rgba(255,255,255,.05)'}, ticks:{color:'#8888a0',font:{size:11}} },
          y:{ grid:{color:'rgba(255,255,255,.05)'}, ticks:{color:'#8888a0',font:{size:11},callback:v=>'R$ '+Number(v).toLocaleString('pt-BR')} }
        }
      }
    });
  }, 100);
}

function listarComprasDash(filtro) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const hojeStr = hoje.toISOString().slice(0,10);
  const semana = new Date(hoje.getTime()-7*864e5).toISOString().slice(0,10);
  const mes = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-01`;
  let lista = [...items], titulo = 'Compras';
  if(filtro==='hoje'){ lista=items.filter(c=>(c.data_compra||'').slice(0,10)===hojeStr); titulo='Compras de Hoje'; }
  else if(filtro==='semana'){ lista=items.filter(c=>(c.data_compra||'').slice(0,10)>=semana); titulo='Compras — Últimos 7 Dias'; }
  else if(filtro==='mes'){ lista=items.filter(c=>(c.data_compra||'').slice(0,10)>=mes); titulo='Compras — Este Mês'; }
  else if(filtro==='pendente'){ lista=items.filter(c=>c.status_compra==='PENDENTE'); titulo='Entradas Pendentes'; }
  mostrarDetalheCompras(lista, titulo);
}

function mostrarDetalheCompras(lista, titulo) {
  const total = lista.reduce((s,c)=>s+Number(c.valor_total||0),0);
  document.getElementById('content-body').innerHTML = `
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <button onclick="renderDashboardCompras()" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--text2);font-size:12px;padding:5px 12px;cursor:pointer;">← Voltar</button>
      <span style="font-size:15px;font-weight:600;">${titulo}</span>
      <span style="font-size:12px;color:var(--text2);margin-left:auto;">${lista.length} compra${lista.length!==1?'s':''} · ${compraFmt(total)}</span>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:var(--surface2);">
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">Compra</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">Fornecedor</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Data</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Status</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Valor</th>
        </tr></thead>
        <tbody>${lista.length ? lista.map(c=>{
          const forn = cacheFornecedores.find(f=>Number(f.id_fornecedor)===Number(c.id_fornecedor));
          const st = (c.status_compra||'PENDENTE').toUpperCase();
          const sc = st==='LIBERADA'?'on':st==='CANCELADA'?'off':'warn';
          return `<tr style="border-top:1px solid var(--border);cursor:pointer;" onclick="openItem(${c.id_compra})">
            <td style="padding:10px 14px;font-family:var(--mono);color:var(--accent);">${c.codigo_compra||'#'+c.id_compra}</td>
            <td style="padding:10px 14px;">${forn?.nome_fantasia||forn?.razao_social||'-'}</td>
            <td style="padding:10px 14px;text-align:center;color:var(--text2);">${c.data_compra?new Date(c.data_compra).toLocaleDateString('pt-BR'):'-'}</td>
            <td style="padding:10px 14px;text-align:center;"><span class="pill ${sc}">${st}</span></td>
            <td style="padding:10px 14px;text-align:right;font-family:var(--mono);font-weight:700;color:var(--accent);">${compraFmt(c.valor_total)}</td>
          </tr>`;
        }).join('') : '<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--text3);">Nenhuma compra encontrada</td></tr>'}</tbody>
        <tfoot><tr style="border-top:2px solid var(--border);background:var(--surface2);"><td colspan="4" style="padding:10px 14px;font-weight:700;">Total</td><td style="padding:10px 14px;text-align:right;font-family:var(--mono);font-weight:700;color:var(--accent);">${compraFmt(total)}</td></tr></tfoot>
      </table>
    </div>`;
}

function compraDateInput(value) {
  const d = value ? new Date(value) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function compraDateTimeInput(value) {
  const d = value ? new Date(value) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function compraAddDays(baseDate, days) {
  const d = baseDate ? new Date(`${baseDate}T00:00:00`) : new Date();
  d.setDate(d.getDate() + Number(days||0));
  return compraDateInput(d);
}

async function gerarCodigoCompra() {
  const ultimas = await apiGet('compras?select=codigo_compra&order=id_compra.desc&limit=1');
  if(Array.isArray(ultimas) && ultimas.length) {
    const num = parseInt(String(ultimas[0].codigo_compra||'CMP-0000').replace(/[^0-9]/g,''),10)||0;
    return 'CMP-' + String(num+1).padStart(4,'0');
  }
  return 'CMP-0001';
}

function totalCompraAtual() {
  return itensCompraAtual.reduce((s,i)=>s+Number(i.subtotal||0),0);
}

async function carregarItensCompra(idCompra) {
  const itens = await apiGet(`compra_itens?select=*&id_compra=eq.${idCompra}&order=id_item_compra.asc`);
  if(!Array.isArray(itens)) return [];
  return itens.map(i => {
    const prod = cacheProdutos.find(p=>Number(p.id_produto)===Number(i.id_produto));
    return {
      id_item_compra: i.id_item_compra,
      id_produto: Number(i.id_produto),
      nome_produto: prod?.nome_mercadoria || `Produto #${i.id_produto}`,
      quantidade: Number(i.quantidade||0),
      preco_entrada: Number(i.preco_entrada||0),
      subtotal: Number(i.subtotal||0),
      estoque_anterior: i.estoque_anterior,
      estoque_atual: i.estoque_atual,
      preco_custo_atualizado: i.preco_custo_atualizado,
      preco_venda_atualizado: i.preco_venda_atualizado
    };
  });
}

function abrirEscolhaTipoEntradaCompra() {
  isNew=true;
  currentId=null;
  renderList();
  showHeader('Nova compra','novo','Escolha o tipo de entrada');
  document.getElementById('content-body').innerHTML=`
    <div style="max-width:760px;margin:30px auto;">
      <div class="section-label"><span>Como deseja cadastrar esta entrada?</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;">
        <button class="dash-chart-box" onclick="abrirEntradaBasicaCompra()" style="cursor:pointer;text-align:left;color:var(--text);">
          <div style="font-size:16px;font-weight:700;margin-bottom:7px;">Entrada básica</div>
          <div style="font-size:12px;color:var(--text2);line-height:1.5;">Cadastre fornecedor, produtos, quantidades, custos e pagamento manualmente.</div>
        </button>
        <button class="dash-chart-box" onclick="abrirCadastroNfeCompletaCompra()" style="cursor:pointer;text-align:left;color:var(--text);">
          <div style="font-size:16px;font-weight:700;margin-bottom:7px;">NF-e completa</div>
          <div style="font-size:12px;color:var(--text2);line-height:1.5;">Digite manualmente os dados da nota, impostos, produtos e pagamento.</div>
        </button>
        <button class="dash-chart-box" onclick="abrirConciliacaoNotaMenu()" style="cursor:pointer;text-align:left;color:var(--text);">
          <div style="font-size:16px;font-weight:700;margin-bottom:7px;">Importar XML</div>
          <div style="font-size:12px;color:var(--text2);line-height:1.5;">Leia o XML da NF-e e concilie automaticamente os dados fiscais.</div>
        </button>
      </div>
      <div class="form-actions"><button class="btn btn-secondary" onclick="cancelForm()">Cancelar</button></div>
    </div>`;
  closeSidebar();
}

function abrirEntradaBasicaCompra() {
  tipoEntradaCompraNova='BASICA';
  isNew=true;
  currentId=null;
  showHeader('Nova compra','novo','Entrada básica');
  renderFormCompra(null);
}

async function abrirCadastroEntradaBasicaMenu(){
  if(currentTab!=='compras')await switchTab('compras');
  abrirEntradaBasicaCompra();
  closeSidebar();
}

function abrirCadastroNfeCompletaCompra() {
  tipoEntradaCompraNova='NOTA_FISCAL';
  isNew=true;
  currentId=null;
  showHeader('Nova compra','novo','NF-e completa — digitação manual');
  renderFormCompra(null);
}

async function abrirCadastroNfeCompletaMenu(){
  if(currentTab!=='compras')await switchTab('compras');
  abrirCadastroNfeCompletaCompra();
  closeSidebar();
}

async function renderFormCompra(c) {
  await loadCaches();
  await loadCacheCobrancas();

  itensCompraAtual = c?.id_compra ? await carregarItensCompra(c.id_compra) : [];
  itemCompraEmEdicao = null;

  const v = f => c ? (c[f]??'') : '';
  const status = (v('status_compra') || 'PENDENTE').toUpperCase();
  const bloqueado = status === 'LIBERADA' || status === 'CANCELADA';
  const codigo = isNew ? await gerarCodigoCompra() : v('codigo_compra');
  const fornOpts = cacheFornecedores.map(f=>{
    const selecionado=String(v('id_fornecedor'))===String(f.id_fornecedor);
    const inativo=f.ativo===false;
    return `<option value="${f.id_fornecedor}" ${selecionado?'selected':''} ${inativo&&!selecionado?'disabled':''}>${f.nome_fantasia||f.razao_social||'Fornecedor #'+f.id_fornecedor}${inativo?' (inativo)':''}</option>`;
  }).join('');
  const prodOpts = cacheProdutos.map(p=>`<option value="${p.id_produto}" data-custo="${Number(p.preco_custo||0)}" data-venda="${Number(p.preco_venda||0)}" data-estoque="${Number(p.estoque_atual||0)}">${p.nome_mercadoria}</option>`).join('');
  const pagOpts = cacheCobrancas.map(t=>`<option value="${t.descricao}" ${v('meio_pagamento')===t.descricao?'selected':''}>${t.descricao}</option>`).join('');
  const dataCompra = compraDateTimeInput(v('data_compra'));
  const prazo = v('prazo_dias') || 0;
  const quantidadeParcelas = Math.max(1, Number(v('quantidade_parcelas') || 1));
  const diasParcelas = Math.max(0, Number(v('dias_vencimento') || 0));
  const vencimento = v('data_vencimento') || compraAddDays(dataCompra.slice(0,10), prazo);
  const ehNfe = c ? c.tipo_entrada==='NOTA_FISCAL' : tipoEntradaCompraNova==='NOTA_FISCAL';
  const dadosFiscais=compraObjetoFiscal(c?.dados_nfe), impostosFiscais=compraObjetoFiscal(c?.impostos_nfe);
  const campoImposto=(campo,rotulo)=>`<div class="form-group"><label class="form-label">${rotulo}</label><input class="form-input" type="number" min="0" step="0.01" data-imposto-nfe="${campo}" value="${Number(impostosFiscais[campo]||0)}" ${bloqueado?'disabled':''}/></div>`;
  const cadastroFiscal=ehNfe?`<div class="section-label"><span>Dados da NF-e</span></div><div class="form-grid">
    <div class="form-group"><label class="form-label">Número da nota *</label><input class="form-input" id="f-numero_nota" value="${compraEsc(c?.numero_nota||dadosFiscais.numero||'')}" ${bloqueado?'disabled':''}/></div>
    <div class="form-group"><label class="form-label">Série *</label><input class="form-input" id="f-serie_nfe" value="${compraEsc(dadosFiscais.serie||'')}" ${bloqueado?'disabled':''}/></div>
    <div class="form-group"><label class="form-label">Modelo</label><input class="form-input" id="f-modelo_nfe" value="${compraEsc(dadosFiscais.modelo||'55')}" ${bloqueado?'disabled':''}/></div>
    <div class="form-group full"><label class="form-label">Chave de acesso</label><input class="form-input" id="f-chave_nfe" maxlength="44" value="${compraEsc(c?.chave_nfe||dadosFiscais.chave||'')}" ${bloqueado?'disabled':''}/></div>
    ${campoImposto('vBC','Base de cálculo ICMS')}${campoImposto('vICMS','Valor ICMS')}${campoImposto('vST','ICMS-ST')}${campoImposto('vIPI','IPI')}${campoImposto('vPIS','PIS')}${campoImposto('vCOFINS','COFINS')}${campoImposto('vFrete','Frete')}${campoImposto('vDesc','Desconto')}
  </div>`:'';
  const painelFiscal = c?.tipo_entrada==='NOTA_FISCAL' ? renderPainelFiscalCompra(c) : '';

  document.getElementById('content-body').innerHTML = `
    <div class="section-label"><span>${ehNfe?'NF-e Completa':'Entrada Básica'}</span><span class="pill ${status==='LIBERADA'?'on':status==='CANCELADA'?'off':'warn'}">${status}</span></div>
    <input type="hidden" id="f-codigo_compra" value="${codigo||''}"/>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Fornecedor *</label>
        <select class="form-input form-select" id="f-id_fornecedor" ${bloqueado?'disabled':''}>
          <option value="">Selecione...</option>${fornOpts}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Data *</label>
        <input class="form-input" type="datetime-local" id="f-data_compra" value="${dataCompra}" onchange="calcularVencimentoCompra()" ${bloqueado?'disabled':''}/>
      </div>
      <div class="form-group">
        <label class="form-label">Meio de Pagamento</label>
        <select class="form-input form-select" id="f-meio_pagamento" ${bloqueado?'disabled':''}>
          <option value="">Selecione...</option>${pagOpts}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Dias ate o 1o vencimento</label>
        <input class="form-input" type="number" min="0" step="1" id="f-prazo_dias" value="${prazo}" oninput="calcularVencimentoCompra()" ${bloqueado?'disabled':''}/>
      </div>
      <div class="form-group">
        <label class="form-label">1o vencimento</label>
        <input class="form-input" type="date" id="f-data_vencimento" value="${vencimento}" ${bloqueado?'disabled':''}/>
      </div>
      <div class="form-group">
        <label class="form-label">Parcelas</label>
        <input class="form-input" type="number" min="1" step="1" id="f-quantidade_parcelas" value="${quantidadeParcelas}" ${bloqueado?'disabled':''}/>
      </div>
      <div class="form-group">
        <label class="form-label">Intervalo (se parcelado)</label>
        <input class="form-input" type="number" min="0" step="1" id="f-dias_vencimento" value="${diasParcelas}" ${bloqueado?'disabled':''}/>
      </div>
      <div class="form-group">
        <label class="form-label">Total da Compra</label>
        <input class="form-input" id="f-total_compra" value="${compraFmt(v('valor_total')||totalCompraAtual())}" readonly style="color:var(--accent);font-weight:700;"/>
      </div>
    </div>

    ${cadastroFiscal}
    ${painelFiscal}

    <div class="section-label"><span>Itens da Compra</span></div>
    ${!bloqueado?`
      <div class="venda-panel">
        <div class="form-grid" style="margin-bottom:10px;">
          <div class="form-group full">
            <label class="form-label">Produto</label>
            ${abasCategoriasProdutosPedido('compra')}
            <select class="form-input form-select" id="compra-item-produto" onchange="preencherCompraProduto()">
              <option value="">Selecione...</option>${prodOpts}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Quantidade</label>
            <input class="form-input" type="number" min="0.01" step="0.01" id="compra-item-qtd" value="1" oninput="calcularSubtotalItemCompra()"/>
          </div>
          <div class="form-group">
            <label class="form-label">Preço Entrada</label>
            <input class="form-input" type="number" min="0" step="0.01" id="compra-item-preco" oninput="calcularSubtotalItemCompra()"/>
          </div>
          <div class="form-group">
            <label class="form-label">Subtotal</label>
            <input class="form-input" id="compra-item-subtotal" value="R$ 0,00" readonly style="color:var(--accent);font-weight:700;"/>
          </div>
        </div>
        <button class="btn btn-primary" id="btn-adicionar-item-compra" style="width:100%;" onclick="adicionarItemCompra()">+ Adicionar Produto</button>
      </div>`:''}
    <div id="lista-itens-compra"></div>

    <div class="section-label"><span>Observações</span></div>
    <div class="form-group"><textarea class="form-textarea" id="f-observacoes" ${bloqueado?'readonly':''}>${v('observacoes')}</textarea></div>

    <div class="form-actions">
      ${!bloqueado?`<button class="btn btn-primary" id="btn-save" onclick="saveCompra()">${isNew?'+ Registrar Compra':'✓ Salvar Alterações'}</button>`:''}
      ${!isNew && status==='PENDENTE'?`<button class="btn btn-primary" style="background:var(--accent2);" onclick="abrirLiberacaoCompra(${c.id_compra})">Liberar Entrada</button>`:''}
      ${!isNew && status==='LIBERADA'?`<button class="btn btn-secondary" onclick="reabrirCompra(${c.id_compra})">Reabrir para Alterar</button><button class="btn btn-danger" onclick="cancelarCompra(${c.id_compra})">Cancelar Entrada</button>`:''}
      ${!isNew?`<button class="btn btn-danger" onclick="excluirCompra(${c.id_compra})">Excluir</button>`:''}
      <button class="btn btn-secondary" onclick="cancelForm()">Voltar</button>
    </div>`;

  renderItensCompra(status);
  if(!bloqueado) filtrarProdutosPedido('compra');
}

function preencherCompraProduto() {
  const sel = document.getElementById('compra-item-produto');
  const opt = sel?.options[sel.selectedIndex];
  const preco = Number(opt?.dataset?.custo || 0);
  document.getElementById('compra-item-preco').value = preco > 0 ? preco.toFixed(2) : '';
  calcularSubtotalItemCompra();
}

function calcularSubtotalItemCompra() {
  const qtd = Number(document.getElementById('compra-item-qtd')?.value||0);
  const preco = Number(document.getElementById('compra-item-preco')?.value||0);
  const el = document.getElementById('compra-item-subtotal');
  if(el) el.value = compraFmt(qtd * preco);
}

function adicionarItemCompra() {
  const sel = document.getElementById('compra-item-produto');
  const opt = sel?.options[sel.selectedIndex];
  const idProduto = Number(sel?.value||0);
  const qtd = Number(document.getElementById('compra-item-qtd')?.value||0);
  const preco = Number(document.getElementById('compra-item-preco')?.value||0);
  if(!idProduto){ toast('Selecione o produto','error'); return; }
  if(qtd <= 0){ toast('Quantidade deve ser maior que zero','error'); return; }
  if(preco < 0){ toast('Preço de entrada inválido','error'); return; }

  const existente = itemCompraEmEdicao===null ? itensCompraAtual.find(i=>Number(i.id_produto)===idProduto) : null;
  if(itemCompraEmEdicao!==null) {
    itensCompraAtual[itemCompraEmEdicao]={...itensCompraAtual[itemCompraEmEdicao],id_produto:idProduto,nome_produto:opt?.textContent||`Produto #${idProduto}`,quantidade:qtd,preco_entrada:preco,subtotal:Number((qtd*preco).toFixed(2))};
  } else if(existente) {
    existente.quantidade += qtd;
    existente.preco_entrada = preco;
    existente.subtotal = Number((existente.quantidade * preco).toFixed(2));
  } else {
    itensCompraAtual.push({
      id_produto: idProduto,
      nome_produto: opt?.textContent || `Produto #${idProduto}`,
      quantidade: qtd,
      preco_entrada: preco,
      subtotal: Number((qtd * preco).toFixed(2))
    });
  }

  sel.value = '';
  document.getElementById('compra-item-qtd').value = '1';
  document.getElementById('compra-item-preco').value = '';
  calcularSubtotalItemCompra();
  itemCompraEmEdicao=null;
  const btnItem=document.getElementById('btn-adicionar-item-compra');
  if(btnItem)btnItem.textContent='+ Adicionar Produto';
  renderItensCompra();
}

function editarItemCompra(idx) {
  const item=itensCompraAtual[idx];
  if(!item)return;
  itemCompraEmEdicao=idx;
  selecionarProdutoPedido('compra', item.id_produto);
  document.getElementById('compra-item-qtd').value=String(item.quantidade||1);
  document.getElementById('compra-item-preco').value=Number(item.preco_entrada||0).toFixed(2);
  calcularSubtotalItemCompra();
  const btn=document.getElementById('btn-adicionar-item-compra');
  if(btn)btn.textContent='✓ Salvar alteração do item';
  document.getElementById('compra-item-produto')?.scrollIntoView({behavior:'smooth',block:'center'});
}

function removerItemCompra(idx) {
  if(itemCompraEmEdicao===idx)itemCompraEmEdicao=null;
  else if(itemCompraEmEdicao!==null&&itemCompraEmEdicao>idx)itemCompraEmEdicao--;
  itensCompraAtual.splice(idx,1);
  renderItensCompra();
}

function renderItensCompra(status='PENDENTE') {
  const bloqueado = status === 'LIBERADA' || status === 'CANCELADA';
  const el = document.getElementById('lista-itens-compra');
  if(!el) return;
  const total = totalCompraAtual();
  const totalEl = document.getElementById('f-total_compra');
  if(totalEl) totalEl.value = compraFmt(total);

  if(!itensCompraAtual.length) {
    el.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text3);border:1px dashed var(--border);border-radius:8px;">Nenhum produto adicionado</div>';
    return;
  }

  el.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:14px;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:var(--surface2);">
          <th style="padding:8px;text-align:left;color:var(--text2);font-weight:500;">Produto</th>
          <th style="padding:8px;text-align:right;color:var(--text2);font-weight:500;">Qtd</th>
          <th style="padding:8px;text-align:right;color:var(--text2);font-weight:500;">Entrada</th>
          <th style="padding:8px;text-align:right;color:var(--text2);font-weight:500;">Subtotal</th>
          ${bloqueado?'<th style="padding:8px;text-align:right;color:var(--text2);font-weight:500;">Estoque</th>':'<th style="padding:8px;"></th>'}
        </tr></thead>
        <tbody>${itensCompraAtual.map((i,idx)=>`
          <tr style="border-top:1px solid var(--border);">
            <td style="padding:8px;">${i.nome_produto}</td>
            <td style="padding:8px;text-align:right;">${Number(i.quantidade||0).toFixed(2)}</td>
            <td style="padding:8px;text-align:right;font-family:var(--mono);">${compraFmt(i.preco_entrada)}</td>
            <td style="padding:8px;text-align:right;font-family:var(--mono);color:var(--accent);font-weight:700;">${compraFmt(i.subtotal)}</td>
            <td style="padding:8px;text-align:right;">${bloqueado
              ? `${Number(i.estoque_anterior||0).toFixed(2)} -> ${Number(i.estoque_atual||0).toFixed(2)}`
              : `<button class="btn btn-secondary" style="padding:4px 8px;font-size:11px;" onclick="editarItemCompra(${idx})">Alterar</button> <button class="btn btn-danger" style="padding:4px 8px;font-size:11px;" onclick="removerItemCompra(${idx})">Excluir</button>`}</td>
          </tr>`).join('')}</tbody>
        <tfoot><tr style="border-top:2px solid var(--border);background:var(--surface2);">
          <td colspan="3" style="padding:8px;font-weight:700;">Total</td>
          <td style="padding:8px;text-align:right;font-family:var(--mono);font-weight:700;color:var(--accent);">${compraFmt(total)}</td>
          <td></td>
        </tr></tfoot>
      </table>
    </div>`;
}

function calcularVencimentoCompra() {
  const data = document.getElementById('f-data_compra')?.value?.slice(0,10);
  const prazo = Number(document.getElementById('f-prazo_dias')?.value||0);
  const venc = document.getElementById('f-data_vencimento');
  if(venc) venc.value = compraAddDays(data, prazo);
}

function getCompraPayload() {
  const ehNfe=!!document.getElementById('f-numero_nota');
  const payload={
    codigo_compra: document.getElementById('f-codigo_compra').value.trim(),
    id_fornecedor: Number(document.getElementById('f-id_fornecedor').value),
    data_compra: new Date(document.getElementById('f-data_compra').value).toISOString(),
    valor_total: Number(totalCompraAtual().toFixed(2)),
    meio_pagamento: document.getElementById('f-meio_pagamento').value || null,
    prazo_dias: Math.max(0, parseInt(document.getElementById('f-prazo_dias').value||'0',10)||0),
    quantidade_parcelas: Math.max(1, parseInt(document.getElementById('f-quantidade_parcelas').value||'1',10)||1),
    dias_vencimento: Math.max(0, parseInt(document.getElementById('f-dias_vencimento').value||'0',10)||0),
    data_vencimento: document.getElementById('f-data_vencimento').value || null,
    observacoes: document.getElementById('f-observacoes').value.trim() || null,
    id_produto: itensCompraAtual[0]?.id_produto || null,
    quantidade: itensCompraAtual.reduce((s,i)=>s+Number(i.quantidade||0),0) || null,
    preco_entrada: itensCompraAtual[0]?.preco_entrada || null,
    tipo_entrada: ehNfe?'NOTA_FISCAL':'BASICA'
  };
  if(ehNfe){
    const numero=document.getElementById('f-numero_nota').value.trim();
    const chave=document.getElementById('f-chave_nfe').value.replace(/\D/g,'');
    const impostos=Object.fromEntries([...document.querySelectorAll('[data-imposto-nfe]')].map(el=>[el.dataset.impostoNfe,Number(el.value||0)]));
    const compraExistente=items.find(x=>Number(x.id_compra)===Number(currentId));
    const dadosExistentes=compraObjetoFiscal(compraExistente?.dados_nfe);
    payload.numero_nota=numero||null;
    payload.chave_nfe=chave||null;
    payload.dados_nfe={...dadosExistentes,origem:dadosExistentes.origem||'DIGITACAO',numero,serie:document.getElementById('f-serie_nfe').value.trim(),modelo:document.getElementById('f-modelo_nfe').value.trim(),chave};
    payload.impostos_nfe=impostos;
  }
  return payload;
}

function buildCompraItensPayload(idCompra) {
  return itensCompraAtual.map(i=>({
    id_compra: idCompra,
    id_produto: Number(i.id_produto),
    quantidade: Number(i.quantidade),
    preco_entrada: Number(i.preco_entrada),
    subtotal: Number(i.subtotal)
  }));
}

async function salvarItensCompra(idCompra) {
  await apiDelete(`compra_itens?id_compra=eq.${idCompra}`);
  const payload = buildCompraItensPayload(idCompra);
  if(!payload.length) return { ok:false, data:{ message:'Compra sem produtos.' } };
  return apiPost('compra_itens', payload);
}

async function saveCompra() {
  const data = getCompraPayload();
  if(!data.id_fornecedor){ toast('Selecione o fornecedor','error'); return; }
  if(data.tipo_entrada==='NOTA_FISCAL'&&!data.numero_nota){ toast('Informe o número da NF-e','error'); return; }
  if(data.tipo_entrada==='NOTA_FISCAL'&&!data.dados_nfe?.serie){ toast('Informe a série da NF-e','error'); return; }
  if(data.chave_nfe&&data.chave_nfe.length!==44){ toast('A chave da NF-e deve ter 44 dígitos','error'); return; }
  if(!document.getElementById('f-data_compra')?.value){ toast('Informe a data','error'); return; }
  if(!itensCompraAtual.length){ toast('Adicione pelo menos um produto','error'); return; }
  if(data.quantidade_parcelas>1&&data.dias_vencimento===0){ toast('Informe um intervalo em dias maior que zero para mais de uma parcela.','error'); return; }

  const btn = document.getElementById('btn-save');
  if(btn){ btn.disabled = true; btn.textContent = 'Salvando...'; }

  if(isNew) {
    const res = await apiPost('compras',{...data,status_compra:'PENDENTE'});
    if(!res.ok){ toast('Erro ao salvar compra: '+(res.data?.message||'erro'),'error'); if(btn){btn.disabled=false;btn.textContent='+ Registrar Compra';} return; }
    const n = Array.isArray(res.data) ? res.data[0] : res.data;
    const itensRes = await salvarItensCompra(n.id_compra);
    if(!itensRes.ok) {
      await apiDelete(`compras?id_compra=eq.${n.id_compra}`);
      toast('Erro ao salvar itens: '+(itensRes.data?.message||'erro'),'error');
      if(btn){btn.disabled=false;btn.textContent='+ Registrar Compra';}
      return;
    }
    toast('Compra registrada. Libere a entrada para atualizar estoque e financeiro.','success');
    await finalizarCadastroNovo();
  } else {
    const compra = items.find(x=>Number(x.id_compra)===Number(currentId));
    if(compra?.status_compra === 'LIBERADA') { toast('Reabra a compra antes de alterar.','error'); return; }
    const res = await apiPatch(`compras?id_compra=eq.${currentId}`,data);
    if(!res.ok){ toast('Erro ao salvar compra: '+(res.data?.message||'erro'),'error'); if(btn){btn.disabled=false;btn.textContent='✓ Salvar Alterações';} return; }
    const itensRes = await salvarItensCompra(currentId);
    if(!itensRes.ok){ toast('Erro ao salvar itens: '+(itensRes.data?.message||'erro'),'error'); if(btn){btn.disabled=false;btn.textContent='✓ Salvar Alterações';} return; }
    toast('Compra atualizada.','success');
    formularioAlterado=false;
    await loadItems();
    openItem(currentId);
  }
}

async function abrirLiberacaoCompra(idCompra) {
  // A liberacao precisa usar exatamente o que esta na tela. Antes, os itens eram
  // recarregados do banco e uma alteracao ainda nao salva era silenciosamente perdida.
  if(itemCompraEmEdicao!==null){
    toast('Conclua a alteração do item clicando em "Salvar alteração do item" antes de liberar.','error');
    return;
  }
  const dadosAtuais=getCompraPayload();
  if(!dadosAtuais.id_fornecedor){toast('Selecione o fornecedor.','error');return;}
  if(!itensCompraAtual.length){toast('Adicione produtos antes de liberar.','error');return;}
  if(dadosAtuais.quantidade_parcelas>1&&dadosAtuais.dias_vencimento===0){toast('Informe um intervalo em dias maior que zero para mais de uma parcela.','error');return;}
  const compraSalva=await apiPatch(`compras?id_compra=eq.${idCompra}`,dadosAtuais);
  if(!compraSalva.ok){toast('Erro ao salvar as alterações antes da liberação: '+(compraSalva.data?.message||'erro'),'error');return;}
  const itensSalvos=await salvarItensCompra(idCompra);
  if(!itensSalvos.ok){toast('Erro ao salvar os itens antes da liberação: '+(itensSalvos.data?.message||'erro'),'error');return;}
  await loadItems();
  await loadCaches();
  const compra = items.find(x=>Number(x.id_compra)===Number(idCompra));
  if(!compra){ toast('Compra não encontrada.','error'); return; }
  itensCompraAtual = await carregarItensCompra(idCompra);
  if(!itensCompraAtual.length){ toast('Adicione produtos antes de liberar.','error'); return; }
  const venc = compra.data_vencimento || compraAddDays((compra.data_compra||'').slice(0,10), compra.prazo_dias||0);
  const parcelas = Math.max(1, Number(compra.quantidade_parcelas || 1));
  const intervalo = Math.max(0, Number(compra.dias_vencimento || 0));
  let integracao={ativa:false,contas:[],categoria:null};
  try{integracao=await carregarIntegracaoFinancas('saida');}catch(e){toast('Não foi possível consultar o Finanças: '+e.message,'error');return;}
  if(integracao.ativa&&!integracao.categoria){toast('Cadastre a categoria Compras no sistema Finanças.','error');return;}
  if(integracao.ativa&&!integracao.contas.length){toast('Cadastre uma conta ativa no sistema Finanças.','error');return;}
  document.body.insertAdjacentHTML('beforeend',`
    <div class="modal-overlay" id="compra-liberar-modal" style="display:flex;">
      <div class="modal" style="max-width:760px;">
        <div class="modal-header">
          <span class="modal-title">Liberar Entrada</span>
          <button class="modal-close" onclick="document.getElementById('compra-liberar-modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="search-banner">Revise custo e preço de venda por produto. Ao liberar, todos os estoques serão somados e uma conta a pagar será gerada.</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-bottom:12px;">
            <div class="form-group"><label class="form-label">1o vencimento</label><input class="form-input" type="date" id="lib-vencimento" value="${venc}"/></div>
            <div class="form-group"><label class="form-label">Meio de pagamento *</label><select class="form-input form-select" id="lib-meio"><option value="">Selecione...</option>${cacheCobrancas.map(x=>`<option value="${compraEsc(x.descricao)}" ${x.descricao===compra.meio_pagamento?'selected':''}>${compraEsc(x.descricao)}</option>`).join('')}</select></div>
            ${integracao.ativa?`<div class="form-group"><label class="form-label">Conta no Finanças *</label><select class="form-input form-select" id="lib-conta-financas">${opcoesContasFinancas(integracao.contas,compra.id_conta_financas)}</select><div style="font-size:11px;color:var(--text3);">Categoria: Compras · pendente até o pagamento.</div></div>`:''}
            <div class="form-group"><label class="form-label">Parcelas</label><input class="form-input" type="number" min="1" step="1" id="lib-parcelas" value="${parcelas}"/></div>
            <div class="form-group"><label class="form-label">Intervalo (se parcelado)</label><input class="form-input" type="number" min="0" step="1" id="lib-dias" value="${intervalo}"/></div>
          </div>
          <div style="overflow:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:620px;">
              <thead><tr style="background:var(--surface2);">
                <th style="padding:8px;text-align:left;color:var(--text2);font-weight:500;">Produto</th>
                <th style="padding:8px;text-align:right;color:var(--text2);font-weight:500;">Qtd</th>
                <th style="padding:8px;text-align:right;color:var(--text2);font-weight:500;">Entrada</th>
                <th style="padding:8px;text-align:right;color:var(--text2);font-weight:500;">Novo Custo</th>
                <th style="padding:8px;text-align:right;color:var(--text2);font-weight:500;">Preço Venda</th>
              </tr></thead>
              <tbody>${itensCompraAtual.map(i=>{
                const prod = cacheProdutos.find(p=>Number(p.id_produto)===Number(i.id_produto)) || {};
                return `<tr style="border-top:1px solid var(--border);">
                  <td style="padding:8px;">${i.nome_produto}</td>
                  <td style="padding:8px;text-align:right;">${Number(i.quantidade).toFixed(2)}</td>
                  <td style="padding:8px;text-align:right;font-family:var(--mono);">${compraFmt(i.preco_entrada)}</td>
                  <td style="padding:8px;"><input class="form-input" type="text" inputmode="decimal" id="lib-custo-${i.id_produto}" value="${Number(i.preco_entrada||prod.preco_custo||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}" onfocus="this.select()" onblur="normalizarPrecoLiberacao(this)"/></td>
                  <td style="padding:8px;"><input class="form-input" type="text" inputmode="decimal" id="lib-venda-${i.id_produto}" value="${Number(prod.preco_venda||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}" onfocus="this.select()" onblur="normalizarPrecoLiberacao(this)"/></td>
                </tr>`;
              }).join('')}</tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('compra-liberar-modal').remove()">Cancelar</button>
          <button class="btn btn-primary" id="btn-confirmar-liberacao" onclick="confirmarLiberacaoCompra(${idCompra})">Liberar</button>
        </div>
      </div>
    </div>`);
}

async function confirmarLiberacaoCompra(idCompra) {
  const compra = items.find(x=>Number(x.id_compra)===Number(idCompra));
  if(!compra){ toast('Compra não encontrada.','error'); return; }
  const itens = await carregarItensCompra(idCompra);
  if(!itens.length){ toast('Compra sem produtos.','error'); return; }

  const btn = document.getElementById('btn-confirmar-liberacao');
  if(btn){ btn.disabled = true; btn.textContent = 'Liberando...'; }
  const parcelas = Math.max(1, parseInt(document.getElementById('lib-parcelas')?.value||'1',10)||1);
  const intervalo = Math.max(0, parseInt(document.getElementById('lib-dias')?.value||'0',10)||0);
  const contaFinancas=Number(document.getElementById('lib-conta-financas')?.value||0);
  const meioConfirmado=document.getElementById('lib-meio')?.value.trim();
  if(!meioConfirmado){toast('Confirme o meio de pagamento.','error');if(btn){btn.disabled=false;btn.textContent='Liberar';}return;}
  if(document.getElementById('lib-conta-financas')&&!contaFinancas){toast('Confirme a conta do Finanças.','error');if(btn){btn.disabled=false;btn.textContent='Liberar';}return;}
  if(Number(compra.valor_total||0) < parcelas/100) {
    toast('A quantidade de parcelas gera valores menores que R$ 0,01.','error');
    if(btn){ btn.disabled=false; btn.textContent='Liberar'; }
    return;
  }
  const backups = [];

  for(const item of itens) {
    const produto = await getProdutoEstoque(item.id_produto);
    if(!produto){ toast(`Produto ${item.nome_produto} não encontrado.`,'error'); return; }
    const estoqueAnterior = Number(produto.estoque_atual||0);
    const estoqueAtual = estoqueAnterior + Number(item.quantidade||0);
    const precoCusto = compraNumeroDecimal(document.getElementById(`lib-custo-${item.id_produto}`)?.value||item.preco_entrada||0);
    const precoVenda = compraNumeroDecimal(document.getElementById(`lib-venda-${item.id_produto}`)?.value||0);
    if(precoCusto<0||precoVenda<0){
      toast(`Custo e preço de venda de ${item.nome_produto} não podem ser negativos.`,'error');
      if(btn){btn.disabled=false;btn.textContent='Liberar';}
      return;
    }
    const custoAnterior = Number(produto.preco_custo || 0);
    const custoMudou = Math.abs(precoCusto - custoAnterior) >= 0.005;
    let dataBaseCusto = '';
    if(custoMudou) {
      const sugestao = (compra.data_compra || '').slice(0,10);
      dataBaseCusto = prompt(
        `O custo de ${item.nome_produto} mudou de R$ ${custoAnterior.toFixed(2)} para R$ ${precoCusto.toFixed(2)}.\n\n` +
        'A partir de qual data-base esse custo deve ser aplicado aos pedidos ja lancados?\n' +
        'Use AAAA-MM-DD. Vendas futuras nao serao alteradas.\n\n' +
        'Deixe em branco para apenas atualizar o cadastro do produto.',
        sugestao
      );
      if(dataBaseCusto === null) {
        if(btn){ btn.disabled = false; btn.textContent = 'Liberar'; }
        return;
      }
      dataBaseCusto = dataBaseCusto.trim();
      if(dataBaseCusto && !/^\d{4}-\d{2}-\d{2}$/.test(dataBaseCusto)) {
        toast('Data-base invalida. Use o formato AAAA-MM-DD.','error');
        if(btn){ btn.disabled = false; btn.textContent = 'Liberar'; }
        return;
      }
    }
    const prodRes = await apiPatch(`produtos?id_produto=eq.${item.id_produto}`,{
      estoque_atual: estoqueAtual,
      preco_custo: precoCusto,
      preco_venda: precoVenda
    });
    if(!prodRes.ok) {
      for(const b of backups) await apiPatch(`produtos?id_produto=eq.${b.id_produto}`,{estoque_atual:b.estoque_anterior});
      toast('Erro ao atualizar produto: '+(prodRes.data?.message||'erro'),'error');
      return;
    }
    if(custoMudou && dataBaseCusto && typeof aplicarCustoProdutoEmVendas === 'function') {
      try {
        await aplicarCustoProdutoEmVendas(item.id_produto, custoAnterior, precoCusto, dataBaseCusto);
      } catch(err) {
        toast('Produto atualizado, mas erro ao ajustar custos antigos: '+(err.message||err),'error');
      }
    }
    backups.push({id_produto:item.id_produto, estoque_anterior:estoqueAnterior});
    await apiPatch(`compra_itens?id_item_compra=eq.${item.id_item_compra}`,{
      estoque_anterior: estoqueAnterior,
      estoque_atual: estoqueAtual,
      preco_custo_atualizado: precoCusto,
      preco_venda_atualizado: precoVenda
    });
  }

  const vencimento = document.getElementById('lib-vencimento').value || compra.data_vencimento || null;
  const meio = meioConfirmado || compra.meio_pagamento || null;
  const compraRes = await apiPatch(`compras?id_compra=eq.${idCompra}`,{
    status_compra:'LIBERADA',
    data_vencimento: vencimento,
    meio_pagamento: meio,
    quantidade_parcelas: parcelas,
    dias_vencimento: intervalo
  });
  if(!compraRes.ok) {
    for(const b of backups) await apiPatch(`produtos?id_produto=eq.${b.id_produto}`,{estoque_atual:b.estoque_anterior});
    toast('Erro ao liberar compra. Estoque restaurado. '+(compraRes.data?.message||''),'error');
    return;
  }

  await apiDelete(`contas_pagar?id_compra=eq.${idCompra}`);
  const valorTotal = Number(compra.valor_total || 0);
  const valorBase = Math.floor((valorTotal / parcelas) * 100) / 100;
  const grupoParcelamento = novoGrupoParcelamento();
  const contasData = Array.from({length:parcelas},(_,idx)=>({
    id_compra: idCompra,
    id_fornecedor: compra.id_fornecedor,
    data_vencimento: compraAddDays(vencimento, idx * intervalo),
    valor_original: idx===parcelas-1 ? Number((valorTotal-(valorBase*(parcelas-1))).toFixed(2)) : valorBase,
    meio_pagamento: meio,
    status_pagamento: 'PENDENTE',
    grupo_parcelamento: grupoParcelamento,
    numero_parcela: idx+1,
    total_parcelas: parcelas,
    valor_total_titulo: valorTotal,
    observacoes: [parcelas>1?`Parcela ${idx+1}/${parcelas}`:'',`Compra ${compra.codigo_compra||'#'+idCompra}`].filter(Boolean).join(' - ')
  }));
  const contaRes = await apiPost('contas_pagar',contasData);
  if(!contaRes.ok) {
    for(const b of backups) await apiPatch(`produtos?id_produto=eq.${b.id_produto}`,{estoque_atual:b.estoque_anterior});
    await apiPatch(`compras?id_compra=eq.${idCompra}`,{status_compra:'PENDENTE'});
    toast('Erro ao gerar conta a pagar. Entrada desfeita. '+(contaRes.data?.message||''),'error');
    return;
  }
  if(contaFinancas){
    await apiPatch(`compras?id_compra=eq.${idCompra}`,{id_conta_financas:contaFinancas});
    const integracao=await carregarIntegracaoFinancas('saida');
    const titulos=await apiGet(`contas_pagar?select=*&id_compra=eq.${idCompra}&order=numero_parcela.asc`);
    const vinculo=await vincularMovimentosFinancas('contas_pagar','id_conta_pagar',titulos,{ativa:true,tipo:'saida',contaId:contaFinancas,categoria:integracao.categoria,descricao:`Compra ${compra.codigo_compra||'#'+idCompra}`,documento:compra.codigo_compra});
    if(!vinculo.ok){toast('Compra liberada, mas a integração financeira falhou: '+vinculo.message,'error');return;}
  }

  document.getElementById('compra-liberar-modal')?.remove();
  toast('Entrada liberada, estoques atualizados e conta a pagar gerada.','success');
  await loadCaches();
  await loadItems();
  openItem(idCompra);
}

async function desfazerLiberacaoCompra(compra) {
  const contasRemovidas=await apiDelete(`contas_pagar?id_compra=eq.${compra.id_compra}`);
  if(!contasRemovidas)return {ok:false,message:'Não foi possível cancelar as contas no Vendas e no Finanças.'};
  if(compra?.status_compra !== 'LIBERADA') return { ok:true };

  const itens = await carregarItensCompra(compra.id_compra);
  for(const item of itens) {
    const produto = await getProdutoEstoque(item.id_produto);
    if(!produto) return { ok:false, message:`Produto ${item.nome_produto} não encontrado para devolver estoque.` };
    const novoEstoque = Number(produto.estoque_atual||0) - Number(item.quantidade||0);
    const prodRes = await apiPatch(`produtos?id_produto=eq.${item.id_produto}`,{estoque_atual:novoEstoque});
    if(!prodRes.ok) return { ok:false, message:prodRes.data?.message || `Erro ao devolver estoque de ${item.nome_produto}.` };
    await apiPatch(`compra_itens?id_item_compra=eq.${item.id_item_compra}`,{estoque_anterior:null,estoque_atual:null});
  }
  return { ok:true };
}

async function reabrirCompra(idCompra) {
  const compra = items.find(x=>Number(x.id_compra)===Number(idCompra));
  if(!compra) return;
  if(!confirm('Reabrir esta compra para alteração? O estoque será devolvido e as contas a pagar serão removidas.')) return;
  const desfaz = await desfazerLiberacaoCompra(compra);
  if(!desfaz.ok){ toast(desfaz.message,'error'); return; }
  const res = await apiPatch(`compras?id_compra=eq.${idCompra}`,{status_compra:'PENDENTE'});
  if(!res.ok){ toast('Erro ao reabrir compra: '+(res.data?.message||'erro'),'error'); return; }
  toast('Compra reaberta para alteração.','success');
  await loadCaches();
  await loadItems();
  openItem(idCompra);
}

async function cancelarCompra(idCompra) {
  const compra = items.find(x=>Number(x.id_compra)===Number(idCompra));
  if(!compra) return;
  if(!confirm('Cancelar esta entrada? O estoque será devolvido e as contas a pagar serão removidas.')) return;
  const desfaz = await desfazerLiberacaoCompra(compra);
  if(!desfaz.ok){ toast(desfaz.message,'error'); return; }
  const res = await apiPatch(`compras?id_compra=eq.${idCompra}`,{status_compra:'CANCELADA'});
  if(!res.ok){ toast('Erro ao cancelar compra: '+(res.data?.message||'erro'),'error'); return; }
  toast('Entrada cancelada.','success');
  await loadCaches();
  await loadItems();
  openItem(idCompra);
}

async function excluirCompra(idCompra) {
  const compra = items.find(x=>Number(x.id_compra)===Number(idCompra));
  if(!compra) return;
  if(!confirm('Excluir esta compra? Contas a pagar serão removidas e, se liberada, o estoque será devolvido.')) return;
  const desfaz = await desfazerLiberacaoCompra(compra);
  if(!desfaz.ok){ toast(desfaz.message,'error'); return; }
  await apiDelete(`compra_itens?id_compra=eq.${idCompra}`);
  const ok = await apiDelete(`compras?id_compra=eq.${idCompra}`);
  if(!ok){ toast('Erro ao excluir compra.','error'); return; }
  toast('Compra excluída.','success');
  await loadCaches();
  await loadItems();
  cancelForm();
}

async function renderFormContaPagar(c) {
  await Promise.all([loadCaches(), loadCacheCobrancas()]);
  const v = f => c ? (c[f]??'') : '';
  const fornOpts = cacheFornecedores.map(f=>{
    const selecionado=String(v('id_fornecedor'))===String(f.id_fornecedor);
    const inativo=f.ativo===false;
    return `<option value="${f.id_fornecedor}" ${selecionado?'selected':''} ${inativo&&!selecionado?'disabled':''}>${f.nome_fantasia||f.razao_social||'Fornecedor #'+f.id_fornecedor}${inativo?' (inativo)':''}</option>`;
  }).join('');
  const pagOpts = cacheCobrancas.map(t=>`<option value="${t.descricao}" ${v('meio_pagamento')===t.descricao?'selected':''}>${t.descricao}</option>`).join('');
  const statusOpts = ['PENDENTE','PAGO','CANCELADO'].map(s=>`<option value="${s}" ${v('status_pagamento')===s?'selected':''}>${s}</option>`).join('');
  const vencimentoManual = v('data_vencimento') || compraDateInput(new Date());
  const origemCompra=!!c?.id_compra;
  const valorPagoAtual=Number(c?.valor_pago||0);
  document.getElementById('content-body').innerHTML = `
    <div class="section-label"><span>Conta a Pagar · Parcela ${rotuloParcela(c)} · Total ${contasFmtMoeda(valorTotalParcelas(c,'pagar'))}</span></div>
    <div class="form-grid">
      <div class="form-group full"><label class="form-label">Fornecedor *</label><select class="form-input form-select" id="f-id_fornecedor" ${origemCompra?'disabled':''}><option value="">${cacheFornecedores.length?'Selecione o fornecedor...':'Nenhum fornecedor cadastrado nesta empresa — use o botão +'}</option>${fornOpts}</select></div>
      <div class="form-group"><label class="form-label">Status</label><select class="form-input form-select" id="f-status_pagamento">${statusOpts}</select></div>
      <div class="form-group"><label class="form-label">Valor Original</label><input class="form-input" type="text" inputmode="decimal" id="f-valor_original" value="${v('valor_original')}" placeholder="0,00" ${origemCompra?'readonly':''}/></div>
      <div class="form-group"><label class="form-label">Valor Pago</label><input class="form-input" type="text" inputmode="decimal" id="f-valor_pago" value="${v('valor_pago')}" ${isNew?'readonly':''}/></div>
      <div class="form-group"><label class="form-label">Meio de Pagamento</label><select class="form-input form-select" id="f-meio_pagamento"><option value="">Selecione...</option>${pagOpts}</select></div>
      <div class="form-group"><label class="form-label">1o vencimento</label><input class="form-input" type="date" id="f-data_vencimento" value="${vencimentoManual}"/></div>
      <div class="form-group"><label class="form-label">Data de Pagamento</label><input class="form-input" type="datetime-local" id="f-data_pagamento" value="${v('data_pagamento')?String(v('data_pagamento')).slice(0,16):''}"/></div>
    </div>
    ${isNew ? `<div class="section-label"><span>Condição do lançamento</span></div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Parcelas</label><input class="form-input" type="number" min="1" step="1" id="f-novas-parcelas" value="1"/></div>
      <div class="form-group"><label class="form-label">Intervalo (se parcelado)</label><input class="form-input" type="number" min="0" step="1" id="f-novas-dias" value="0"/></div>
    </div>` : ''}
    ${c && c.status_pagamento!=='PAGO' && Number(c.valor_pago||0)===0 ? `<div class="section-label"><span>Parcelar esta conta</span></div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Quantidade de parcelas</label><input class="form-input" type="number" min="2" step="1" id="f-reparcelar-quantidade" value="2"/></div>
      <div class="form-group"><label class="form-label">Dias entre parcelas</label><input class="form-input" type="number" min="0" step="1" id="f-reparcelar-dias" value="0"/></div>
    </div>` : ''}
    <div class="section-label"><span>Observações</span></div>
    <div class="form-group"><textarea class="form-textarea" id="f-observacoes">${v('observacoes')}</textarea></div>
    <div class="form-actions">
      ${!origemCompra?'<button class="btn btn-primary" id="btn-save" onclick="saveContaPagar()">✓ Salvar</button>':''}
      ${c&&c.status_pagamento!=='PAGO'?'<button class="btn btn-danger" onclick="excluirContaPagar()">Excluir</button>':''}
      ${c && !origemCompra && c.status_pagamento!=='PAGO' && Number(c.valor_pago||0)===0 ? '<button class="btn btn-secondary" onclick="parcelarContaPagar()">Parcelar conta</button>' : ''}
      ${c ? (c.status_pagamento !== 'PAGO' ? `<button class="btn btn-primary" style="background:var(--accent2);" onclick="marcarContaPagarPaga()">Marcar Pago</button>` : '<span class="pill on" style="padding:8px 14px;font-size:12px;">Pago</span>') : ''}
      ${valorPagoAtual > 0.005 || c?.status_pagamento==='PAGO' ? '<button type="button" class="btn btn-secondary" onclick="reativarContaPagar()">↺ Reativar baixa</button>' : ''}
      ${c?.id_compra ? `<button class="btn btn-secondary" onclick="mostrarResumoCompraConta(${c.id_compra},event)">Resumo da compra</button>` : ''}
      <button class="btn btn-secondary" onclick="cancelForm()">Voltar</button>
    </div>`;
}

async function excluirContaPagar() {
  const conta=items.find(x=>Number(x.id_conta_pagar)===Number(currentId));
  if(!conta)return;
  if(conta.id_compra){toast('Este título veio de uma compra. Exclua a compra para remover seus títulos.','error');return;}
  const grupo=grupoParcelasTitulo(conta,'pagar');
  if(!grupo.length){toast('Parcelas não encontradas.','error');return;}
  if(grupo.some(x=>Number(x.valor_pago||0)>0||x.status_pagamento==='PAGO')){toast('Não é possível excluir: uma ou mais parcelas já possuem pagamento.','error');return;}
  if(!confirm(`Excluir todas as ${grupo.length} parcelas deste lançamento?`))return;
  const ids=grupo.map(x=>Number(x.id_conta_pagar)).filter(Boolean);
  const ok=await apiDelete(`contas_pagar?id_conta_pagar=in.(${ids.join(',')})`);
  if(ok){toast('Todas as parcelas foram excluídas.','success');await loadItems();await cancelForm();}
  else toast('Erro ao excluir as parcelas.','error');
}

async function parcelarContaPagar() {
  const conta = items.find(x=>Number(x.id_conta_pagar)===Number(currentId));
  if(!conta || conta.status_pagamento==='PAGO' || Number(conta.valor_pago||0)>0){ toast('Somente contas sem pagamentos podem ser parceladas.','error'); return; }
  const qtd=Math.max(2,parseInt(document.getElementById('f-reparcelar-quantidade')?.value||'2',10)||2);
  const dias=Math.max(0,parseInt(document.getElementById('f-reparcelar-dias')?.value||'0',10)||0);
  if(dias===0){toast('Informe um intervalo em dias maior que zero para parcelar.','error');return;}
  if(!confirm(`Dividir esta conta em ${qtd} parcelas?`)) return;
  const total=Number(document.getElementById('f-valor_original')?.value||conta.valor_original||0);
  if(total < qtd/100){toast('A quantidade de parcelas gera valores menores que R$ 0,01.','error');return;}
  const base=Math.floor((total/qtd)*100)/100;
  const venc=document.getElementById('f-data_vencimento')?.value||conta.data_vencimento;
  const obsBase=(document.getElementById('f-observacoes')?.value||conta.observacoes||'').replace(/^Parcela \d+\/\d+\s*-\s*/,'');
  const grupo=conta.grupo_parcelamento||novoGrupoParcelamento();
  const comum={id_compra:conta.id_compra||null,id_fornecedor:Number(document.getElementById('f-id_fornecedor')?.value||conta.id_fornecedor)||null,meio_pagamento:document.getElementById('f-meio_pagamento')?.value||null,status_pagamento:'PENDENTE',grupo_parcelamento:grupo,total_parcelas:qtd,valor_total_titulo:total};
  const dados=Array.from({length:qtd},(_,idx)=>({...comum,numero_parcela:idx+1,data_vencimento:compraAddDays(venc,idx*dias),valor_original:idx===qtd-1?Number((total-base*(qtd-1)).toFixed(2)):base,valor_pago:null,data_pagamento:null,observacoes:obsBase||null}));
  const original=dados.shift();
  const atualizada=await apiPatch(`contas_pagar?id_conta_pagar=eq.${currentId}`,original);
  if(!atualizada.ok){toast('Erro ao atualizar a primeira parcela.','error');return;}
  const criadas=await apiPost('contas_pagar',dados);
  if(!criadas.ok){toast('Primeira parcela salva, mas houve erro ao criar as demais.','error');return;}
  toast(`${qtd} parcelas geradas!`,'success'); await loadItems(); openItem(currentId);
}

async function saveContaPagar() {
  const status = document.getElementById('f-status_pagamento').value;
  const dataPagamento = document.getElementById('f-data_pagamento').value;
  const data = {
    id_fornecedor: Number(document.getElementById('f-id_fornecedor').value)||null,
    status_pagamento: status,
    valor_original: contasNumeroInput(document.getElementById('f-valor_original').value),
    valor_pago: isNew?null:(contasNumeroInput(document.getElementById('f-valor_pago').value)||null),
    meio_pagamento: document.getElementById('f-meio_pagamento').value||null,
    data_vencimento: document.getElementById('f-data_vencimento').value||null,
    data_pagamento: dataPagamento ? new Date(dataPagamento).toISOString() : (status==='PAGO'?new Date().toISOString():null),
    observacoes: document.getElementById('f-observacoes').value.trim()||null
  };
  if(!data.id_fornecedor){toast('Selecione o fornecedor.','error');return;}
  if(data.valor_original<=0){toast('Informe um valor maior que zero.','error');return;}
  if(!data.data_vencimento){toast('Informe o primeiro vencimento.','error');return;}
  if(isNew) {
    const qtd=Math.max(1,parseInt(document.getElementById('f-novas-parcelas')?.value||'1',10)||1);
    const dias=Math.max(0,parseInt(document.getElementById('f-novas-dias')?.value||'0',10)||0);
    if(qtd>1&&dias===0){toast('Informe um intervalo em dias maior que zero para mais de uma parcela.','error');return;}
    if(data.valor_original<qtd/100){toast('A quantidade de parcelas gera valores menores que R$ 0,01.','error');return;}
    const total=data.valor_original, base=Math.floor((total/qtd)*100)/100;
    const grupo=novoGrupoParcelamento();
    const registros=Array.from({length:qtd},(_,idx)=>{
      const valor=idx===qtd-1?Number((total-base*(qtd-1)).toFixed(2)):base;
      return {...data,id_compra:null,grupo_parcelamento:grupo,numero_parcela:idx+1,total_parcelas:qtd,valor_total_titulo:total,data_vencimento:compraAddDays(data.data_vencimento,idx*dias),valor_original:valor,valor_pago:data.status_pagamento==='PAGO'?valor:null,observacoes:data.observacoes};
    });
    const criado=await apiPost('contas_pagar',registros.map(({data_pagamento,...registro})=>registro));
    if(criado.ok){toast(qtd>1?`${qtd} contas a pagar criadas!`:'Conta a pagar criada!','success');await finalizarCadastroNovo();}
    else toast('Erro ao criar conta: '+([criado.data?.message,criado.data?.details,criado.data?.hint].filter(Boolean).join(' - ')||'erro'),'error');
    return;
  }
  if(items.find(x=>Number(x.id_conta_pagar)===Number(currentId))?.id_compra){toast('O valor deste título vem da compra. Altere a compra de origem.','error');return;}
  const res = await apiPatch(`contas_pagar?id_conta_pagar=eq.${currentId}`,data);
  if(!res.ok){ toast('Erro ao salvar conta: '+(res.data?.message||'erro'),'error'); return; }
  toast('Conta atualizada.','success');
  formularioAlterado=false;
  await loadItems();
  openItem(currentId);
}

async function marcarContaPagarPaga() {
  const valor = Number(document.getElementById('f-valor_pago')?.value||0) || Number(document.getElementById('f-valor_original')?.value||0);
  const dataInformada = document.getElementById('f-data_pagamento')?.value;
  const dataPagamento = dataInformada ? new Date(dataInformada) : new Date();
  if(Number.isNaN(dataPagamento.getTime())) { toast('Informe uma data de pagamento válida.','error'); return; }
  const res = await apiPatch(`contas_pagar?id_conta_pagar=eq.${currentId}`,{
    status_pagamento:'PAGO',
    valor_pago: valor,
    data_pagamento: dataPagamento.toISOString(),
    meio_pagamento: document.getElementById('f-meio_pagamento')?.value||null
  });
  if(!res.ok){ toast('Erro ao marcar como pago.','error'); return; }
  toast('Pagamento confirmado.','success');
  await loadItems();
  openItem(currentId);
}

async function marcarContaPagarPagaRapido(idConta, event) {
  event?.stopPropagation();
  const botao = event?.currentTarget;
  const conta = items.find(c=>Number(c.id_conta_pagar)===Number(idConta));
  const original = Number(conta?.valor_original||0);
  const pagoAtual = Math.min(original, Math.max(0, Number(conta?.valor_pago||0)));
  const saldo = Math.max(0, original-pagoAtual);
  if(!conta || saldo<=0.005 || conta.status_pagamento==='PAGO') { toast('Esta conta já está paga.','info'); return; }
  const fornecedor = cacheFornecedores.find(f=>Number(f.id_fornecedor)===Number(conta.id_fornecedor));
  const nome = fornecedor?.nome_fantasia || fornecedor?.razao_social || `Conta #${idConta}`;
  if(!confirm(`Marcar como pago ${compraFmt(saldo)} de ${nome}?`)) return;
  if(botao) { botao.disabled=true; botao.textContent='Baixando...'; }
  const res = await apiPatch(`contas_pagar?id_conta_pagar=eq.${idConta}`,{
    status_pagamento:'PAGO',
    valor_pago:original,
    data_pagamento:new Date().toISOString(),
    meio_pagamento:conta.meio_pagamento||null
  });
  if(!res.ok) {
    if(botao) { botao.disabled=false; botao.textContent='✓ Pago'; }
    toast('Erro ao marcar como pago: '+(res.data?.message||'erro'),'error');
    return;
  }
  toast(`Pagamento confirmado: ${compraFmt(saldo)}.`,'success');
  currentId=null;
  await renderDashboardContasPagar();
}

async function reativarContaPagar() {
  const conta=items.find(x=>Number(x.id_conta_pagar)===Number(currentId));
  if(!conta)return toast('Conta não encontrada.','error');
  if(!confirm('Reativar esta baixa? O valor pago e a data de pagamento serão removidos.'))return;
  const res=await apiPatch(`contas_pagar?id_conta_pagar=eq.${currentId}`,{status_pagamento:'PENDENTE',valor_pago:null,data_pagamento:null});
  if(!res.ok){toast('Erro ao reativar a baixa: '+(res.data?.message||'erro'),'error');return;}
  toast('Baixa reativada.','success');await loadItems();openItem(currentId);
}
