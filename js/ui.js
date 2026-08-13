// MENU
function toggleMenu(name) {
  document.querySelectorAll('.dropdown').forEach(d => { if(d.id!=='dd-'+name) d.classList.remove('open'); });
  document.querySelectorAll('.menu-btn').forEach(b => { if(b.id!=='mbtn-'+name) b.classList.remove('open'); });
  document.getElementById('dd-'+name)?.classList.toggle('open');
  document.getElementById('mbtn-'+name)?.classList.toggle('open');
}
function closeMenus() {
  document.querySelectorAll('.dropdown').forEach(d=>d.classList.remove('open'));
  document.querySelectorAll('.menu-btn').forEach(b=>b.classList.remove('open'));
  document.querySelectorAll('.dropdown-submenu').forEach(s=>s.classList.remove('open'));
}
function toggleSubmenu(e, id) {
  e.stopPropagation();
  document.querySelectorAll('.dropdown-submenu').forEach(s => { if(s.id!==id) s.classList.remove('open'); });
  document.getElementById(id)?.classList.toggle('open');
}
document.addEventListener('click', e => { 
  if(!e.target.closest('.menu-group')) closeMenus(); 
});

function setActiveMenu(tab) {
  document.querySelectorAll('.menu-btn,.dropdown-item').forEach(el=>el.classList.remove('active'));
  const menuMap = { vendas:'vendas', compras:'compras', contas_receber:'contas', contas_pagar:'contas', clientes:'cadastros', fornecedores:'cadastros', tipo_mercadoria:'cadastros', produtos_tab:'cadastros', precos_especiais:'cadastros', estoque_movimentacoes:'cadastros', kardex:'cadastros', usuarios:'config', empresas:'config', importador_tickets:'config', ajuda:'ajuda' };
  const produtosTabs = ['tipo_mercadoria','produtos_tab','precos_especiais','estoque_movimentacoes','kardex'];
  const main = menuMap[tab];
  if(main) document.getElementById('mbtn-'+main)?.classList.add('active');
  document.getElementById('di-'+tab)?.classList.add('active');
  if(produtosTabs.includes(tab)) document.getElementById('di-produtos-menu')?.classList.add('active');
  if(tab==='usuarios') document.getElementById('mbtn-usuarios')?.classList.add('active');
}

// TAB SWITCH
async function switchTab(tab) {
  if((tab==='usuarios' || tab==='importador_tickets') && !isAdmin){ toast('Acesso restrito ao administrador.','error'); return; }
  if(tab==='empresas' && !isSuperAdminJr){ toast('Acesso exclusivo ao administrador da empresa JR.','error'); return; }
  currentTab=tab; currentId=null; isNew=false;
  const cfg=tabConfig[tab];
  document.getElementById('search-input').oninput = tab==='ajuda' ? filtrarAjuda : filterItems;
  document.getElementById('search-input').placeholder = tab==='ajuda' ? 'Buscar no help...' : 'Buscar...';
  document.getElementById('topbar-title').textContent=cfg.plural;
  document.getElementById('btn-novo').textContent='+ '+cfg.label;
  document.getElementById('btn-novo').style.display=(tab==='importador_tickets'||tab==='ajuda')?'none':'block';
  document.getElementById('btn-cnpj').style.display=cfg.hasCNPJ?'block':'none';
  document.getElementById('search-input').value='';
  document.getElementById('content-header').style.display='none';
  if(tab==='contas_receber') {
    contasReceberClienteFiltro = null;
  }
  if(tab==='ajuda') {
    setActiveMenu(tab);
    await renderCentralAjuda();
  } else if(tab==='empresas') {
    setActiveMenu(tab);
    await renderEmpresasAdmin();
  } else if(tab==='vendas') {
    document.getElementById('content-body').innerHTML='<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando dashboard...</div>';
    setActiveMenu(tab);
    await loadItems();
    await renderDashboard();
  } else if(tab==='contas_receber') {
    document.getElementById('content-body').innerHTML='<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando análises...</div>';
    setActiveMenu(tab);
    await loadItems();
    await renderDashboardContas();
  } else if(tab==='compras') {
    document.getElementById('content-body').innerHTML='<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando dashboard...</div>';
    setActiveMenu(tab);
    await loadItems();
    await renderDashboardCompras();
  } else if(tab==='contas_pagar') {
    document.getElementById('content-body').innerHTML='<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando financeiro...</div>';
    setActiveMenu(tab);
    await loadItems();
    await renderDashboardContasPagar();
  } else if(tab==='clientes') {
    document.getElementById('content-body').innerHTML='<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando dashboard...</div>';
    setActiveMenu(tab);
    await loadItems();
    await renderDashboardClientes();
  } else if(tab==='fornecedores') {
    document.getElementById('content-body').innerHTML='<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando dashboard...</div>';
    setActiveMenu(tab);
    await loadItems();
    await renderDashboardFornecedores();
  } else if(tab==='produtos_tab') {
    document.getElementById('content-body').innerHTML='<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando dashboard...</div>';
    setActiveMenu(tab);
    await loadItems();
    await renderDashboardProdutos();
  } else if(tab==='kardex') {
    document.getElementById('content-body').innerHTML='<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando Kardex...</div>';
    setActiveMenu(tab);
    await loadItems();
    await renderKardex();
  } else if(tab==='importador_tickets') {
    setActiveMenu(tab);
    items=[]; filtered=[];
    document.getElementById('item-list').innerHTML='<div class="empty-state" style="padding:18px 10px;"><div class="empty-icon">PDF</div><p>Selecione os tickets na tela principal</p></div>';
    document.getElementById('sidebar-footer').textContent='Importador';
    renderImportadorTickets();
  } else {
    document.getElementById('content-body').innerHTML=`<div class="empty-state"><div class="empty-icon">${cfg.hasCNPJ?'👥':'📦'}</div><p>Selecione um ${cfg.label.toLowerCase()} ou crie um novo</p></div>`;
    setActiveMenu(tab);
    await loadItems();
  }
}

// LOAD
async function loadItems() {
  const cfg=tabConfig[currentTab];
  document.getElementById('item-list').innerHTML='<div class="loading"><div class="spinner"></div> Carregando...</div>';
  let sel='*';
  if(currentTab==='contas_receber') sel='*,clientes!fk_conta_cliente(nome_fantasia,razao_social)';
  if(currentTab==='contas_pagar') sel='*';
  if(currentTab==='vendas') sel='*,clientes(nome_fantasia,razao_social)';
  if(currentTab==='compras') sel='*';
  if(currentTab==='produtos_tab') sel='*,tipo_mercadoria(descricao),fornecedores(nome_fantasia,razao_social)';
  if(currentTab==='precos_especiais') sel='*,clientes(nome_fantasia,razao_social),produtos(nome_mercadoria)';
  if(currentTab==='estoque_movimentacoes') sel='*,produtos(nome_mercadoria,estoque_atual)';
  let orderParam = `${cfg.order}.asc`;
  if(currentTab==='vendas') orderParam = 'status_entrega.asc,data_entrega.asc,id_venda.asc';
  if(currentTab==='compras') orderParam = 'status_compra.asc,data_compra.desc,id_compra.desc';
  if(currentTab==='contas_pagar') orderParam = 'data_vencimento.asc,id_conta_pagar.asc';
  if(currentTab==='estoque_movimentacoes') orderParam = 'data_movimentacao.desc,id_movimentacao.desc';
  const data=await apiGet(`${cfg.table}?select=${sel}&order=${orderParam}`);
  if(!Array.isArray(data)){ toast('Erro ao carregar: '+(data?.message||''),'error'); return; }
  if(currentTab==='contas_receber') await anexarCodigoVendaContas(data);
  if(currentTab==='contas_pagar') await anexarDadosCompraContasPagar(data);
  // Ordenar: pendentes primeiro por data_entrega asc (mais antigos primeiro), entregues depois por data_entrega desc (mais atuais primeiro)
  if(currentTab==='vendas') {
    invalidarResumoContasVendas();
    data.sort((a,b) => {
      const aStatus = (a.status_entrega || '').toUpperCase();
      const bStatus = (b.status_entrega || '').toUpperCase();
      const aPend = aStatus !== 'ENTREGUE' && aStatus !== 'CANCELADO';
      const bPend = bStatus !== 'ENTREGUE' && bStatus !== 'CANCELADO';
      if(aPend && !bPend) return -1;
      if(!aPend && bPend) return 1;
      const dA = a.data_entrega || a.data_venda || '';
      const dB = b.data_entrega || b.data_venda || '';
      if(aPend) return dA < dB ? -1 : dA > dB ? 1 : 0;
      return dA > dB ? -1 : dA < dB ? 1 : 0;
    });
  }
  items=data;
  filtered=currentTab==='contas_receber' ? filtrarLateralContasReceber(items) : (currentTab==='contas_pagar' ? ordenarLateralContasPagar(items) : [...items]);
  renderList();
  document.getElementById('sidebar-footer').textContent=`${items.length} ${cfg.plural.toLowerCase()}`;
  const badge=document.getElementById('badge-'+currentTab);
  if(badge) badge.textContent=items.length;
}

async function anexarDadosCompraContasPagar(contas) {
  if(!Array.isArray(contas) || !contas.length) return contas;
  const ids = [...new Set(contas.map(c=>Number(c.id_compra||0)).filter(Boolean))];
  if(!ids.length) return contas;
  const compras = await apiGet(`compras?select=id_compra,codigo_compra,data_compra&id_compra=in.(${ids.join(',')})`);
  const mapa = {};
  if(Array.isArray(compras)) compras.forEach(c => { mapa[Number(c.id_compra)] = c; });
  contas.forEach(c => { c.compras = mapa[Number(c.id_compra)] || null; });
  return contas;
}

let cacheResumoContasVendas = null;
let cacheResumoContasVendasIds = [];

function invalidarResumoContasVendas() {
  cacheResumoContasVendas = null;
  cacheResumoContasVendasIds = [];
}

async function carregarResumoContasVendas(ids) {
  const idsNorm = [...new Set((ids||[]).map(Number).filter(Boolean))];
  if(!idsNorm.length) return {};
  const mesmosIds = cacheResumoContasVendasIds.length === idsNorm.length && idsNorm.every((id,i)=>cacheResumoContasVendasIds[i]===id);
  if(mesmosIds && cacheResumoContasVendas) return cacheResumoContasVendas;
  const data = await apiGet(`contas_receber?select=id_conta,id_cliente,valor_original,valor_recebido,status_recebimento,data_vencimento&id_cliente=in.(${idsNorm.join(',')})`);
  const resumo = {};
  if(Array.isArray(data)) {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    data.forEach(conta => {
      const idCliente = Number(conta.id_cliente);
      const original = Number(conta.valor_original || 0);
      const recebido = Math.min(original, Math.max(0, Number(conta.valor_recebido || 0)));
      const saldo = Math.max(0, original - recebido);
      const aberto = saldo > 0.005 && (conta.status_recebimento || '').toUpperCase() !== 'RECEBIDO';
      const vencido = aberto && conta.data_vencimento && contasDateLocal(conta.data_vencimento) < hoje;
      if(!resumo[idCliente]) resumo[idCliente] = { temVencido:false, totalAberto:0 };
      if(aberto) resumo[idCliente].totalAberto += saldo;
      if(vencido) resumo[idCliente].temVencido = true;
    });
  }
  cacheResumoContasVendas = resumo;
  cacheResumoContasVendasIds = idsNorm;
  return resumo;
}

function cardVenda(c, resumoContas={}) {
  const se = (c.status_entrega||'').toUpperCase();
  const statusColor = se==='ENTREGUE'?'on':se==='CANCELADO'?'off':'warn';
  const slabel = se==='ENTREGUE'?'Entregue':se==='CANCELADO'?'Cancelado':'Pendente';
  const nomeCliente = c.clientes?.nome_fantasia||c.clientes?.razao_social||'';
  const resumoCliente = resumoContas[Number(c.id_cliente)] || {};
  const temTitulosVencidos = !!resumoCliente.temVencido;
  const valorAberto = Number(resumoCliente.totalAberto || 0);
  const nomeColor = temTitulosVencidos ? 'var(--danger)' : 'var(--text)';
  const dtV = c.data_venda ? new Date(c.data_venda).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '';
  const dtE = c.data_entrega ? new Date(c.data_entrega).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '';
  const valorFinal = Number(c.valor_final||0);
  const valorCusto = Number(c.valor_produtos||0);
  const lucro = valorFinal - valorCusto;
  const temLucro = valorCusto > 0;
  const lucroColor = lucro >= 0 ? '#22c55e' : '#ef4444';
  const valorVenda = valorFinal > 0 ? 'R$ '+valorFinal.toFixed(2) : '';
  const valorPrefix = valorAberto > 0.005 ? `<span style="color:${temTitulosVencidos?'var(--danger)':'var(--accent)'};font-family:var(--mono);font-size:10px;margin-right:6px;">${fmtResumoFinanceiro(valorAberto)}</span>` : '';
  return `<div class="item-card ${currentId===c.id_venda?'active':''}" onclick="openItem(${c.id_venda})">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">
      <span style="font-size:13px;font-weight:500;font-family:var(--mono);color:var(--accent);">${c.codigo_venda||'#'+c.id_venda}</span>
      <span class="pill ${statusColor}" style="font-size:9px;padding:1px 6px;">${slabel}</span>
    </div>
    <div style="font-size:12px;color:${nomeColor};margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px;">
      ${valorPrefix}
      <span>${nomeCliente}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
      <span style="font-size:10px;color:var(--text3);">🛒${dtV}${dtE?' 📦'+dtE:''}</span>
      <span style="font-size:11px;font-weight:600;color:var(--accent);font-family:var(--mono);">${valorVenda}</span>
    </div>
    ${temLucro ? `<div style="display:flex;justify-content:flex-end;margin-top:2px;">
      <span style="font-size:10px;font-weight:600;color:${lucroColor};font-family:var(--mono);">📈 ${lucro>=0?'':'- '}R$ ${Math.abs(lucro).toFixed(2)}</span>
    </div>` : ''}
  </div>`;
}

async function renderListVendas(el) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const hojeStr = hoje.toISOString().slice(0,10);
  const semana = new Date(hoje.getTime()-7*864e5).toISOString().slice(0,10);
  const mes = new Date(hoje.getFullYear(),hoje.getMonth(),1).toISOString().slice(0,10);
  const ano = new Date(hoje.getFullYear(),0,1).toISOString().slice(0,10);

  const pendentes = filtered.filter(v=>v.status_entrega!=='ENTREGUE'&&v.status_entrega!=='CANCELADO');
  const entregues = filtered.filter(v=>v.status_entrega==='ENTREGUE'||v.status_entrega==='CANCELADO');

  const buscando = buscaLateralAtiva();

  // Filtrar entregues conforme filtro selecionado. Durante busca, mostrar todos os resultados encontrados.
  let entreguesFiltrados = [];
  let btnLabel = '';
  if(buscando) {
    entreguesFiltrados = entregues;
  } else if(vendaFiltro==='padrao') {
    entreguesFiltrados = entregues.filter(v=>(v.data_entrega||v.data_venda||'').slice(0,10)===hojeStr);
    btnLabel = null; // mostrar botões
  } else if(vendaFiltro==='semana') {
    entreguesFiltrados = entregues.filter(v=>(v.data_entrega||v.data_venda||'').slice(0,10)>=semana);
  } else if(vendaFiltro==='mes') {
    entreguesFiltrados = entregues.filter(v=>(v.data_entrega||v.data_venda||'').slice(0,10)>=mes);
  } else if(vendaFiltro==='ano') {
    entreguesFiltrados = entregues.filter(v=>(v.data_entrega||v.data_venda||'').slice(0,10)>=ano);
  } else {
    entreguesFiltrados = entregues;
  }

  let html = '';
  const idsClientes = [...new Set(filtered.map(v=>Number(v.id_cliente||0)).filter(Boolean))];
  const resumoContas = idsClientes.length ? await carregarResumoContasVendas(idsClientes) : {};

  // Pendentes
  if(pendentes.length) {
    html += `<div style="font-size:10px;color:var(--warn);font-family:var(--mono);padding:8px 12px 4px;letter-spacing:.05em;font-weight:600;">⏳ PENDENTES (${pendentes.length})</div>`;
    html += pendentes.map(c=>cardVenda(c, resumoContas)).join('');
  }

  // Entregues
  const labelEntregues = buscando ? 'RESULTADOS' : vendaFiltro==='padrao'?'HOJE':vendaFiltro==='semana'?'ULTIMOS 7 DIAS':vendaFiltro==='mes'?'ESTE MES':vendaFiltro==='ano'?'ESTE ANO':'TODOS';
  if(entreguesFiltrados.length) {
    html += `<div style="font-size:10px;color:var(--text3);font-family:var(--mono);padding:8px 12px 4px;letter-spacing:.05em;border-top:1px solid var(--border);margin-top:6px;">✅ ENTREGUES — ${labelEntregues} (${entreguesFiltrados.length})</div>`;
    html += entreguesFiltrados.map(c=>cardVenda(c, resumoContas)).join('');
  } else if(vendaFiltro==='padrao' && entregues.length > 0) {
    html += `<div style="font-size:11px;color:var(--text3);padding:8px 12px;border-top:1px solid var(--border);margin-top:6px;">Nenhuma entrega hoje</div>`;
  }

  // Botões de filtro
  if(!buscando) html += `<div style="padding:10px 8px;border-top:1px solid var(--border);margin-top:6px;">
    <div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-bottom:6px;">MOSTRAR ENTREGUES:</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
      ${['padrao','semana','mes','ano','todos'].map((f,i)=>{
        const labels=['Hoje','7 dias','Mês','Ano','Todos'];
        return `<button onclick="vendaFiltro='${f}';renderList()" style="background:${vendaFiltro===f?'var(--accent)':'var(--surface2)'};color:${vendaFiltro===f?'#000':'var(--text2)'};border:1px solid var(--border);border-radius:6px;padding:5px 4px;font-size:11px;cursor:pointer;font-family:var(--mono);">${labels[i]}</button>`;
      }).join('')}
    </div>
  </div>`;

  el.innerHTML = html || '<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px;">Nenhuma venda</div>';
}

function buscaLateralAtiva() {
  return !!normalizarBusca(document.getElementById('search-input')?.value || '');
}

function normalizarBusca(valor) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function valorCampoBusca(obj, campo) {
  if(campo === 'fornecedor_nome') {
    const forn = cacheFornecedores.find(f=>Number(f.id_fornecedor)===Number(obj.id_fornecedor));
    return [forn?.nome_fantasia, forn?.razao_social].filter(Boolean).join(' ');
  }
  return String(campo).split('.').reduce((valor, parte) => valor == null ? '' : valor[parte], obj);
}

function itemContemBusca(item, termo, fields) {
  return fields.some(f => normalizarBusca(valorCampoBusca(item, f)).includes(termo));
}

function contaReceberAberta(c) {
  if(typeof contasValorAberto === 'function') return contasValorAberto(c) > 0.005;
  const original = Number(c?.valor_original || 0);
  const recebido = Math.min(original, Math.max(0, Number(c?.valor_recebido || 0)));
  return c?.status_recebimento !== 'RECEBIDO' && Math.max(0, original - recebido) > 0.005;
}

function mostrarContasCliente(idCliente) {
  if(!idCliente) return;
  contasReceberClienteFiltro = Number(idCliente);
  filterItems();
}

function limparFiltroClienteContasReceber() {
  contasReceberClienteFiltro = null;
  filterItems();
}

function somaContasAbertasCliente(lista, idCliente) {
  return (lista || []).filter(c => Number(c.id_cliente) === Number(idCliente) && contaReceberAberta(c)).reduce((s, c) => s + contasValorAberto(c), 0);
}

function filtrarLateralContasReceber(lista, termo='') {
  const fields = tabConfig.contas_receber.searchFields;
  const base = contasReceberClienteFiltro
    ? lista.filter(c => contaReceberAberta(c) && Number(c.id_cliente) === Number(contasReceberClienteFiltro))
    : (contasReceberMostrarTodos ? [...lista] : lista.filter(contaReceberAberta));
  return termo ? base.filter(c=>itemContemBusca(c, termo, fields)) : base;
}

function contaPagarEmAberto(c) {
  const status = String(c?.status_pagamento || '').toUpperCase();
  return status !== 'PAGO' && status !== 'CANCELADO' && Math.max(0, Number(c?.valor_original || 0) - Number(c?.valor_pago || 0)) > 0.005;
}

function ordenarLateralContasPagar(lista) {
  return [...(lista || [])].sort((a,b) => {
    const abertoA = contaPagarEmAberto(a);
    const abertoB = contaPagarEmAberto(b);
    if(abertoA !== abertoB) return abertoA ? -1 : 1;
    const vencA = String(a.data_vencimento || '');
    const vencB = String(b.data_vencimento || '');
    if(vencA !== vencB) return vencB.localeCompare(vencA);
    return Number(b.id_conta_pagar || 0) - Number(a.id_conta_pagar || 0);
  });
}

function toggleLateralContasReceber() {
  contasReceberMostrarTodos = !contasReceberMostrarTodos;
  filterItems();
}

function filterItems() {
  const q=normalizarBusca(document.getElementById('search-input').value);
  if(currentTab==='empresas') { filtrarEmpresasAdmin(q); return; }
  const fields=tabConfig[currentTab].searchFields;
  if(currentTab === 'contas_receber') filtered = filtrarLateralContasReceber(items, q);
  else {
    const resultado = !q ? [...items] : items.filter(c=>itemContemBusca(c, q, fields));
    filtered = currentTab === 'contas_pagar' ? ordenarLateralContasPagar(resultado) : resultado;
  }
  renderList();
}

function fmtResumoFinanceiro(valor) {
  return 'R$ ' + Number(valor || 0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
}

function dataPuraLocal(value) {
  const raw = String(value || '').slice(0,10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
}

function dataPuraBR(value) {
  const d = dataPuraLocal(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
}

function resumoListaFinanceira() {
  if(currentTab === 'contas_receber') {
    const recebido = items.reduce((s,c)=>s + Number(c.status_recebimento === 'RECEBIDO' ? (c.valor_recebido || c.valor_original || 0) : (c.valor_recebido || 0)), 0);
    const aReceber = items.reduce((s,c)=>{
      if(c.status_recebimento === 'RECEBIDO' || c.status_recebimento === 'CANCELADO') return s;
      return s + Math.max(0, Number(c.valor_original || 0) - Number(c.valor_recebido || 0));
    }, 0);
    const abertas = items.filter(contaReceberAberta).length;
    const total = items.length;
    const clienteResumo = contasReceberClienteFiltro ? (() => {
      const contasCliente = items.filter(c => contaReceberAberta(c) && Number(c.id_cliente) === Number(contasReceberClienteFiltro));
      const nomeCliente = contasCliente[0]?.clientes?.nome_fantasia || contasCliente[0]?.clientes?.razao_social || `Cliente #${contasReceberClienteFiltro}`;
      const totalCliente = contasCliente.reduce((s,c) => s + contasValorAberto(c), 0);
      return { nomeCliente, totalCliente };
    })() : null;
    return `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin:0 0 8px;padding:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
          <div style="font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;">${contasReceberClienteFiltro ? 'Visão do cliente' : 'Resumo geral'}</div>
          <button onclick="${contasReceberClienteFiltro ? 'limparFiltroClienteContasReceber()' : 'toggleLateralContasReceber()'}" style="background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--text2);font-size:10px;padding:4px 8px;cursor:pointer;">${contasReceberClienteFiltro ? '↺ Mostrar todos' : (contasReceberMostrarTodos?'Ver abertos':'Ver todos')}</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr;gap:6px;">
          <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;"><span style="color:var(--text2);">Recebido</span><strong style="color:var(--accent2);font-family:var(--mono);">${fmtResumoFinanceiro(recebido)}</strong></div>
          <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;"><span style="color:var(--text2);">A receber</span><strong style="color:var(--warn);font-family:var(--mono);">${fmtResumoFinanceiro(aReceber)}</strong></div>
          <div style="font-size:10px;color:var(--text3);">${contasReceberClienteFiltro ? `${clienteResumo.nomeCliente} • ${fmtResumoFinanceiro(clienteResumo.totalCliente)} em aberto` : (contasReceberMostrarTodos ? `${total} conta${total!==1?'s':''} na lateral` : `${abertas} em aberto na lateral`)}</div>
        </div>
      </div>`;
  }
  if(currentTab === 'contas_pagar') {
    const pago = filtered.reduce((s,c)=>s + Number(c.status_pagamento === 'PAGO' ? (c.valor_pago || c.valor_original || 0) : (c.valor_pago || 0)), 0);
    const aPagar = filtered.reduce((s,c)=>{
      if(c.status_pagamento === 'PAGO' || c.status_pagamento === 'CANCELADO') return s;
      return s + Math.max(0, Number(c.valor_original || 0) - Number(c.valor_pago || 0));
    }, 0);
    return `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin:0 0 8px;padding:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
          <div style="font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;">${contasPagarFiltroAtivo?.label || 'Resumo geral'}</div>
          ${contasPagarFiltroAtivo ? '<button onclick="limparFiltroContasPagar()" style="background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--text2);font-size:10px;padding:4px 8px;cursor:pointer;">↺ Mostrar todos</button>' : ''}
        </div>
        <div style="display:grid;grid-template-columns:1fr;gap:6px;">
          <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;"><span style="color:var(--text2);">Pago</span><strong style="color:var(--accent2);font-family:var(--mono);">${fmtResumoFinanceiro(pago)}</strong></div>
          <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;"><span style="color:var(--text2);">A pagar</span><strong style="color:var(--warn);font-family:var(--mono);">${fmtResumoFinanceiro(aPagar)}</strong></div>
        </div>
      </div>`;
  }
  return '';
}

let vendaFiltro = 'padrao'; // padrao | semana | mes | ano | todos

async function renderList() {
  const el=document.getElementById('item-list');
  const cfg=tabConfig[currentTab];

  // VENDAS: lógica especial
  if(currentTab==='vendas') {
    await renderListVendas(el);
    return;
  }
  const resumoFinanceiro = resumoListaFinanceira();
  if(!filtered.length){
    let emptyHtml = resumoFinanceiro + '<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px;">Nenhum encontrado</div>';
    if(currentTab==='contas_receber' && contasReceberClienteFiltro) {
      emptyHtml += `<div style="padding:8px 0 0;"><button type="button" onclick="limparFiltroClienteContasReceber()" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text2);padding:8px 10px;font-size:11px;cursor:pointer;">↺ Mostrar todos</button></div>`;
    }
    if(currentTab==='contas_pagar' && contasPagarFiltroAtivo) {
      emptyHtml += `<div style="padding:8px 0 0;"><button type="button" onclick="limparFiltroContasPagar()" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text2);padding:8px 10px;font-size:11px;cursor:pointer;">↺ Voltar e mostrar todos</button></div>`;
    }
    el.innerHTML = emptyHtml;
    return;
  }
  let listaHtml = filtered.map(c=>{
    let nome='',sub='',pills='',valorDestaque='';
    if(currentTab==='contas_receber'){
      const venc = dataPuraLocal(c.data_vencimento);
      const hoje = new Date();
      const original = Number(c.valor_original || 0);
      const recebido = Math.min(original, Math.max(0, Number(c.valor_recebido || 0)));
      const saldo = Math.max(0, original - recebido);
      const parcelaInfo=rotuloParcela(c);
      const totalGeralTitulo=valorTotalParcelas(c,'receber');
      const atrasado = saldo > 0.005 && venc < hoje;
      nome = c.clientes?.nome_fantasia||c.clientes?.razao_social||`Cliente #${c.id_cliente}`;
      const dataVenda = c.data_venda ? dataPuraBR(c.data_venda) : '-';
      sub = `Pedido: ${c.codigo_venda || (c.id_venda ? '#'+c.id_venda : '-')} (${dataVenda}) - Venc: ${dataPuraBR(c.data_vencimento)} - Título: ${fmtResumoFinanceiro(original)} - Recebido: ${fmtResumoFinanceiro(recebido)} - Em aberto: ${fmtResumoFinanceiro(saldo)}`;
      valorDestaque = `<div style="margin-top:3px;font-family:var(--mono);font-size:11px;font-weight:600;color:${saldo > 0.005 ? 'var(--warn)' : 'var(--accent)'};">Parcela ${parcelaInfo}: ${fmtResumoFinanceiro(original)} <span style="font-weight:400;color:var(--text3);">• Total: ${fmtResumoFinanceiro(totalGeralTitulo)} • Aberto: ${fmtResumoFinanceiro(saldo)}</span></div>`;
      const sc = saldo <= 0.005 || c.status_recebimento==='RECEBIDO' ? 'on' : atrasado ? 'vencido' : 'warn';
      const slabel = saldo <= 0.005 || c.status_recebimento==='RECEBIDO' ? 'RECEBIDO' : recebido > 0.005 ? 'PARCIAL' : atrasado ? 'VENCIDO' : 'PENDENTE';
      pills = `<span class="pill ${sc}">${slabel}</span>`;
      const totalCliente = somaContasAbertasCliente(items, c.id_cliente);
      const btnCliente = saldo > 0.005 ? `<button type="button" onclick="event.stopPropagation(); mostrarContasCliente(${c.id_cliente});" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text2);padding:4px 7px;font-size:10px;cursor:pointer;white-space:nowrap;">👁 ${totalCliente > 0.005 ? fmtResumoFinanceiro(totalCliente) : 'Ver cliente'}</button>` : '';
      return `<div class="item-card ${currentId===c[cfg.id]?'active':''}" onclick="openItem(${c[cfg.id]})">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <div style="min-width:0;flex:1;">
            <div class="item-name">${nome}</div>
            ${valorDestaque}
            <div class="item-sub">${pills}<span>${sub}</span></div>
          </div>
          ${btnCliente}
        </div>
      </div>`;
    } else if(currentTab==='contas_pagar'){
      const venc = dataPuraLocal(c.data_vencimento);
      const hoje = new Date();
      const atrasado = c.status_pagamento!=='PAGO' && venc < hoje;
      const forn = cacheFornecedores.find(f=>Number(f.id_fornecedor)===Number(c.id_fornecedor));
      nome = forn?.nome_fantasia||forn?.razao_social||`Fornecedor #${c.id_fornecedor}`;
      const docCompra = c.compras?.codigo_compra || (c.id_compra ? '#'+c.id_compra : '#'+c.id_conta_pagar);
      const dataCompra = c.compras?.data_compra ? dataPuraBR(c.compras.data_compra) : '-';
      const valorTitulo = Number(c.valor_original || 0);
      const valorPago = Math.min(valorTitulo, Math.max(0, Number(c.valor_pago || 0)));
      const saldoPagar = Math.max(0, valorTitulo - valorPago);
      const parcelaInfo=rotuloParcela(c);
      const totalGeralTitulo=valorTotalParcelas(c,'pagar');
      const dataPagamento = c.data_pagamento ? dataPuraBR(c.data_pagamento) : '-';
      const pagamentoInfo = c.status_pagamento === 'PAGO' ? ` - Pago em: ${dataPagamento}` : '';
      sub = `Doc: ${docCompra} (${dataCompra}) - Venc: ${dataPuraBR(c.data_vencimento)}${pagamentoInfo} - Título: ${fmtResumoFinanceiro(valorTitulo)} - Pago: ${fmtResumoFinanceiro(valorPago)} - Em aberto: ${fmtResumoFinanceiro(saldoPagar)}`;
      valorDestaque = `<div style="margin-top:3px;font-family:var(--mono);font-size:11px;font-weight:600;color:${saldoPagar > 0.005 ? 'var(--warn)' : 'var(--accent)'};">Parcela ${parcelaInfo}: ${fmtResumoFinanceiro(valorTitulo)} <span style="font-weight:400;color:var(--text3);">• Total: ${fmtResumoFinanceiro(totalGeralTitulo)} • Em aberto: ${fmtResumoFinanceiro(saldoPagar)}</span></div>`;
      const sc = c.status_pagamento==='PAGO'?'on':atrasado?'vencido':'warn';
      const slabel = c.status_pagamento==='PAGO'?'PAGO':atrasado?'VENCIDO':'PENDENTE';
      pills = `<span class="pill ${sc}">${slabel}</span>`;
    } else if(currentTab==='vendas'){
      // Tratado abaixo no bloco especial
    } else if(currentTab==='compras'){
      const forn = cacheFornecedores.find(f=>Number(f.id_fornecedor)===Number(c.id_fornecedor));
      nome=forn?.nome_fantasia||forn?.razao_social||`Fornecedor #${c.id_fornecedor}`;
      sub=`${c.codigo_compra||'#'+c.id_compra} · ${c.data_compra?new Date(c.data_compra).toLocaleDateString('pt-BR'):'-'} · R$ ${Number(c.valor_total||0).toFixed(2)}`;
      const st=(c.status_compra||'PENDENTE').toUpperCase();
      pills=`<span class="pill ${st==='LIBERADA'?'on':st==='CANCELADA'?'off':'warn'}">${st}</span>`;
    } else if(currentTab==='clientes'||currentTab==='fornecedores'){
      nome=c.nome_fantasia||c.razao_social;
      sub=`${c.cidade||'—'}, ${c.estado||'—'}`;
      pills=`<span class="pill ${c.ativo?'on':'off'}">${c.ativo?'ativo':'inativo'}</span>`;
    } else if(currentTab==='tipo_mercadoria'){
      nome=c.descricao; sub=`ID: ${c.id_tipo}`;
    } else if(currentTab==='produtos_tab'){
      nome=c.nome_mercadoria;
      sub=`${c.tipo_mercadoria?.descricao||''} · R$ ${Number(c.preco_venda||0).toFixed(2)}`;
      pills=`<span class="pill ${c.ativo?'on':'off'}">${c.ativo?'ativo':'inativo'}</span>`;
    } else if(currentTab==='precos_especiais'){
      nome=c.produtos?.nome_mercadoria||`Produto #${c.id_produto}`;
      sub=`${c.clientes?.nome_fantasia||c.clientes?.razao_social||''} · R$ ${Number(c.preco_especial||0).toFixed(2)}`;
    } else if(currentTab==='estoque_movimentacoes'){
      const tipo = c.tipo_movimentacao === 'ENTRADA_AJUSTE' ? 'Entrada por ajuste' : 'Saida por ajuste';
      const sinal = c.tipo_movimentacao === 'ENTRADA_AJUSTE' ? '+' : '-';
      nome=c.produtos?.nome_mercadoria||`Produto #${c.id_produto}`;
      sub=`${tipo} - ${sinal}${Number(c.quantidade||0).toFixed(2)} - Estoque: ${Number(c.estoque_anterior||0).toFixed(2)} -> ${Number(c.estoque_atual||0).toFixed(2)}`;
      pills=`<span class="pill ${c.tipo_movimentacao === 'ENTRADA_AJUSTE'?'on':'warn'}">${tipo}</span>`;
    } else if(currentTab==='usuarios'){
      nome=c.nome; sub=`@${c.username}`;
      pills=`<span class="pill ${c.ativo?'on':'off'}">${c.ativo?'ativo':'inativo'}</span>${c.admin?'<span class="pill adm">admin</span>':''}`;
    }
    return `<div class="item-card ${currentId===c[cfg.id]?'active':''}" onclick="openItem(${c[cfg.id]})">
      <div class="item-name">${nome}</div>
      ${valorDestaque}
      <div class="item-sub">${pills}<span>${sub}</span></div>
    </div>`;
  }).join('');
  if(currentTab==='contas_receber' && contasReceberClienteFiltro) {
    listaHtml += `<div style="padding:8px 0 0;">
      <button type="button" onclick="limparFiltroClienteContasReceber()" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text2);padding:8px 10px;font-size:11px;cursor:pointer;">↺ Mostrar todos</button>
    </div>`;
  }
  el.innerHTML = resumoFinanceiro + listaHtml;
}

function openItem(id) {
  id = typeof id === 'string' ? parseInt(id) : id;
  isNew=false; currentId=id;
  const cfg=tabConfig[currentTab];
  const c=items.find(x=>Number(x[cfg.id])===Number(id));
  if(!c) return;
  renderList();
  let titulo='';
  if(currentTab==='contas_receber') titulo=c.clientes?.nome_fantasia||c.clientes?.razao_social||`Conta #${c.id_conta}`;
  else if(currentTab==='contas_pagar') {
    const forn = cacheFornecedores.find(f=>Number(f.id_fornecedor)===Number(c.id_fornecedor));
    titulo=forn?.nome_fantasia||forn?.razao_social||`Conta #${c.id_conta_pagar}`;
  }
  else if(currentTab==='vendas') titulo=c.codigo_venda||`Venda #${c.id_venda}`;
  else if(currentTab==='compras') titulo=c.codigo_compra||`Compra #${c.id_compra}`;
  else if(currentTab==='clientes'||currentTab==='fornecedores') titulo=c.nome_fantasia||c.razao_social;
  else if(currentTab==='tipo_mercadoria') titulo=c.descricao;
  else if(currentTab==='produtos_tab') titulo=c.nome_mercadoria;
  else if(currentTab==='precos_especiais') titulo=c.produtos?.nome_mercadoria||`Produto #${c.id_produto}`;
  else if(currentTab==='estoque_movimentacoes') titulo=c.produtos?.nome_mercadoria||`Movimentacao #${c.id_movimentacao}`;
  else if(currentTab==='usuarios') titulo=c.nome;
  const sub=c.data_cadastro?`cadastrado em ${new Date(c.data_cadastro).toLocaleDateString('pt-BR')}`:'';
  showHeader(titulo,`#${id}`,sub);
  renderForm(c);
  closeSidebar();
}

function openNew() {
  if(currentTab==='empresas') { abrirNovaEmpresa(); return; }
  isNew=true; currentId=null;
  renderList();
  showHeader('Novo '+tabConfig[currentTab].label,'novo','');
  renderForm(null);
  closeSidebar();
}

function showHeader(t,id,sub) {
  document.getElementById('content-header').style.display='flex';
  document.getElementById('content-title').textContent=t;
  document.getElementById('content-id').textContent=id;
  document.getElementById('content-sub').textContent=sub;
}

async function cancelForm() {
  currentId=null; isNew=false; renderList();
  document.getElementById('content-header').style.display='none';
  if(currentTab==='empresas') {
    await renderEmpresasAdmin();
  } else if(currentTab==='vendas') {
    await renderDashboard();
  } else if(currentTab==='contas_receber') {
    await renderDashboardContas();
  } else if(currentTab==='compras') {
    await renderDashboardCompras();
  } else if(currentTab==='contas_pagar') {
    await renderDashboardContasPagar();
  } else if(currentTab==='kardex') {
    await renderKardex();
  } else if(currentTab==='clientes') {
    await renderDashboardClientes();
  } else if(currentTab==='fornecedores') {
    await renderDashboardFornecedores();
  } else if(currentTab==='produtos_tab') {
    await renderDashboardProdutos();
  } else {
    const cfg=tabConfig[currentTab];
    document.getElementById('content-body').innerHTML=`<div class="empty-state"><div class="empty-icon">📋</div><p>Selecione um ${cfg.label.toLowerCase()} ou crie um novo</p></div>`;
  }
}

// =====================
// FORMULÁRIOS
// =====================
function renderForm(c) {
  if(currentTab==='contas_receber') { renderFormConta(c); return; }
  if(currentTab==='contas_pagar') { renderFormContaPagar(c); return; }
  if(currentTab==='vendas') { renderFormVenda(c); return; }
  if(currentTab==='compras') { renderFormCompra(c); return; }
  if(currentTab==='kardex') { renderKardex(Number(c?.id_produto||0)); return; }
  if(currentTab==='clientes'||currentTab==='fornecedores') renderFormCadastro(c);
  else if(currentTab==='tipo_mercadoria') renderFormTipo(c);
  else if(currentTab==='produtos_tab') renderFormProduto(c);
  else if(currentTab==='precos_especiais') renderFormPreco(c);
  else if(currentTab==='estoque_movimentacoes') renderFormEstoque(c);
  else if(currentTab==='usuarios') renderFormUsuario(c);
  else if(currentTab==='empresas') renderFormEmpresa(c);
}



// =====================
// DASHBOARD DE VENDAS
// =====================
let chartVendas = null;

function toggleSidebar(){ document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('open'); }
function closeSidebar(){ document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('open'); }

function toast(msg,type='success'){
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.textContent=(type==='success'?'✓ ':type==='error'?'✕ ':'ℹ ')+msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(()=>el.remove(),3500);
}

async function logout(){
  try { await fetch(url('rpc/encerrar_sessao_empresa'),{method:'POST',headers:hdrs({'Content-Type':'application/json'}),body:'{}'}); } catch(e) {}
  sessionStorage.removeItem('usuario_logado');
  location.href='/login.html';
}

// INIT
async function init(){
  document.getElementById('user-info').textContent=[usuario?.empresa,usuario?.nome].filter(Boolean).join(' · ');
  // Verificar admin direto no banco - campo id na sessão
  const uid = usuario?.id || usuario?.id_usuario;
  try {
    const superRes = await apiPost('rpc/verificar_superadmin_jr',{});
    isSuperAdminJr = superRes.ok && superRes.data === true;
    if(isSuperAdminJr) document.getElementById('di-empresas-admin').style.display='flex';
  } catch(e) { isSuperAdminJr=false; }
  if(uid) {
    try {
      const uData = await apiGet('usuarios?select=admin&id_usuario=eq.'+uid);
      const adminNoBanco = Array.isArray(uData) && uData.length > 0 && uData[0].admin === true;
      if(adminNoBanco) {
        document.getElementById('menu-usuarios-wrap').style.display='block';
        document.getElementById('menu-config-wrap').style.display='block';
      }
    } catch(e) {
      // fallback para sessão
      if(isAdmin) {
        document.getElementById('menu-usuarios-wrap').style.display='block';
        document.getElementById('menu-config-wrap').style.display='block';
      }
    }
  } else if(isAdmin) {
    document.getElementById('menu-usuarios-wrap').style.display='block';
    document.getElementById('menu-config-wrap').style.display='block';
  }
  await loadCaches();
  await switchTab('vendas');
  // Carregar badges de todas as abas
  const[fv,fcr,fcp,fcpg,fc,ff,ft,fp,fe,fem,fu]=await Promise.all([
    apiGet('vendas?select=id_venda'),
    apiGet('contas_receber?select=id_conta'),
    apiGet('compras?select=id_compra'),
    apiGet('contas_pagar?select=id_conta_pagar'),
    apiGet('clientes?select=id_cliente'),
    apiGet('fornecedores?select=id_fornecedor'),
    apiGet('tipo_mercadoria?select=id_tipo'),
    apiGet('produtos?select=id_produto'),
    apiGet('produtos_precos_especiais?select=id_preco_especial'),
    apiGet('estoque_movimentacoes?select=id_movimentacao'),
    isAdmin?apiGet('usuarios?select=id_usuario'):Promise.resolve([])
  ]);
  const setBadge=(id,data)=>{ const el=document.getElementById(id); if(el&&Array.isArray(data)) el.textContent=data.length; };
  setBadge('badge-vendas',fv);
  setBadge('badge-contas_receber',fcr);
  setBadge('badge-compras',fcp);
  setBadge('badge-contas_pagar',fcpg);
  setBadge('badge-clientes',fc);
  setBadge('badge-fornecedores',ff);
  setBadge('badge-tipo_mercadoria',ft);
  setBadge('badge-produtos_tab',fp);
  setBadge('badge-precos_especiais',fe);
  setBadge('badge-estoque_movimentacoes',fem);
  setBadge('badge-kardex',fp);
  if(isAdmin && Array.isArray(fu)) {
    setBadge('badge-usuarios',fu);
    const b2=document.getElementById('badge-usuarios2'); if(b2) b2.textContent=fu.length;
  }
}


init();
