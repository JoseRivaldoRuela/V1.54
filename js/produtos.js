function renderFormTipo(c) {
  const v=f=>c?(c[f]??''):'';
  document.getElementById('content-body').innerHTML=`
    <div class="section-label"><span>Tipo de Mercadoria</span></div>
    <div class="form-grid">
      <div class="form-group full"><label class="form-label">Descrição *</label><input class="form-input" id="f-descricao" value="${v('descricao')}" placeholder="Ex: Massas, Frios, Bebidas..."/></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save" onclick="saveTipo()">${isNew?'+ Cadastrar':'✓ Salvar'}</button>
      <button class="btn btn-secondary" onclick="cancelForm()">Cancelar</button>
    </div>`;
}

async function saveTipo() {
  const desc=document.getElementById('f-descricao').value.trim();
  if(!desc){toast('Descrição obrigatória','error');return;}
  const btn=document.getElementById('btn-save'); btn.disabled=true; btn.textContent='Salvando...';
  if(isNew){
    const{ok,data:res}=await apiPost('tipo_mercadoria',{descricao:desc});
    if(ok){toast('Tipo cadastrado!','success');await loadItems();await loadCaches();const n=Array.isArray(res)?res[0]:res;if(n)openItem(n.id_tipo);}
    else{toast('Erro: '+(res?.message||'erro'),'error');btn.disabled=false;btn.textContent='+ Cadastrar';}
  } else {
    const{ok}=await apiPatch(`tipo_mercadoria?id_tipo=eq.${currentId}`,{descricao:desc});
    if(ok){toast('Salvo!','success');await loadItems();await loadCaches();openItem(currentId);}
    else{toast('Erro','error');btn.disabled=false;btn.textContent='✓ Salvar';}
  }
}

// CACHES
async function loadCaches() {
  const[t,f,p,c]=await Promise.all([
    apiGet('tipo_mercadoria?select=id_tipo,descricao&order=descricao.asc'),
    apiGet('fornecedores?select=id_fornecedor,nome_fantasia,razao_social,ativo&order=razao_social.asc'),
    apiGet('produtos?select=id_produto,nome_mercadoria,preco_venda,preco_custo,estoque_atual,unidade,quantidade_fardo,id_tipo,tipo_mercadoria(descricao)&ativo=eq.true&order=nome_mercadoria.asc'),
    apiGet('clientes?select=*&order=razao_social.asc')
  ]);
  if(Array.isArray(t)) cacheTipos=t;
  if(Array.isArray(f)) cacheFornecedores=f;
  else { cacheFornecedores=[]; console.error('Erro ao carregar fornecedores:',f); }
  if(Array.isArray(p)) cacheProdutos=p;
  if(Array.isArray(c)) cacheClientes=c;
}

function categoriaProdutoPedido(produto) {
  const id = produto?.id_tipo ?? '';
  const tipoCache = cacheTipos.find(t => String(t.id_tipo) === String(id));
  return {
    id: id === null || id === undefined ? '' : String(id),
    nome: produto?.tipo_mercadoria?.descricao || tipoCache?.descricao || 'Sem categoria'
  };
}

function abasCategoriasProdutosPedido(contexto) {
  const categorias = [];
  const vistos = new Set();
  cacheProdutos.forEach(produto => {
    const categoria = categoriaProdutoPedido(produto);
    if(vistos.has(categoria.id)) return;
    vistos.add(categoria.id);
    categorias.push(categoria);
  });
  categorias.sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return `<div class="produto-categoria-tabs" id="${contexto}-produto-categorias">
    <button type="button" class="produto-categoria-tab active" data-categoria="todos" onclick="filtrarProdutosPedido('${contexto}','todos')">Todos</button>
    ${categorias.map(c=>`<button type="button" class="produto-categoria-tab" data-categoria="${c.id}" onclick="filtrarProdutosPedido('${contexto}','${c.id}')">${c.nome}</button>`).join('')}
  </div>`;
}

function filtrarProdutosPedido(contexto, categoria='todos', produtoSelecionado='') {
  const venda = contexto === 'venda';
  const select = document.getElementById(venda ? 'item-produto' : 'compra-item-produto');
  if(!select) return;
  const selecionado = String(produtoSelecionado || select.value || '');
  const produtos = categoria === 'todos'
    ? cacheProdutos
    : cacheProdutos.filter(p => categoriaProdutoPedido(p).id === String(categoria));
  select.innerHTML = `<option value="">Selecione o produto...</option>${produtos.map(p => venda
    ? `<option value="${p.id_produto}" data-preco="${Number(p.preco_venda||0)}">${produtoVendaOptionLabel(p)}</option>`
    : `<option value="${p.id_produto}" data-custo="${Number(p.preco_custo||0)}" data-venda="${Number(p.preco_venda||0)}" data-estoque="${Number(p.estoque_atual||0)}">${p.nome_mercadoria}</option>`
  ).join('')}`;
  if(produtos.some(p => String(p.id_produto) === selecionado)) select.value = selecionado;
  document.querySelectorAll(`#${contexto}-produto-categorias .produto-categoria-tab`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.categoria === String(categoria));
  });
  if(venda) atualizarInfoProdutoVenda();
}

function selecionarProdutoPedido(contexto, idProduto) {
  const produto = cacheProdutos.find(p => String(p.id_produto) === String(idProduto));
  const categoria = produto ? categoriaProdutoPedido(produto).id : 'todos';
  filtrarProdutosPedido(contexto, categoria, idProduto);
}

function buildSelect(id,opts,vf,lf,sel,ph='Selecione...'){
  const o=opts.map(x=>`<option value="${x[vf]}" ${String(x[vf])===String(sel)?'selected':''}>${x[lf]||x.razao_social||x.nome_fantasia||x.descricao}</option>`).join('');
  return `<select class="form-input form-select" id="${id}"><option value="">${ph}</option>${o}</select>`;
}

let chartProdutos = null;

function produtoFmt(n) {
  return 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function produtoFmtDataLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function produtoMesRange() {
  const hoje = new Date();
  const mesRef = new Date(hoje.getFullYear(), hoje.getMonth() + produtosDashMesOffset, 1);
  const anterior = new Date(mesRef.getFullYear(), mesRef.getMonth() - 1, 1);
  return {
    mesRef,
    inicio: produtoFmtDataLocal(mesRef),
    fim: produtoFmtDataLocal(new Date(mesRef.getFullYear(), mesRef.getMonth()+1, 1)),
    anteriorInicio: produtoFmtDataLocal(anterior),
    anteriorFim: produtoFmtDataLocal(mesRef),
    label: mesRef.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})
  };
}

function produtoVendaIds(vendas) {
  return new Set((Array.isArray(vendas) ? vendas : [])
    .filter(v => v.status_entrega !== 'CANCELADO')
    .map(v => Number(v.id_venda)));
}

function produtoAgruparVendidos(itens, produtos, vendaIds) {
  const produtoMap = {};
  (Array.isArray(produtos) ? produtos : []).forEach(p => { produtoMap[Number(p.id_produto)] = p; });
  const mapa = {};
  (Array.isArray(itens) ? itens : []).forEach(i => {
    const id = Number(i.id_produto);
    if(!vendaIds.has(Number(i.id_venda))) return;
    const p = produtoMap[id] || i.produtos || {};
    const nome = p.nome_mercadoria || `Produto #${id}`;
    if(!mapa[id]) mapa[id] = { id, nome, qtd:0, total:0, estoque:Number(p.estoque_atual||0), custo:Number(p.preco_custo||0), venda:Number(p.preco_venda||0) };
    mapa[id].qtd += Number(i.quantidade||0);
    mapa[id].total += Number(i.subtotal||0);
  });
  return Object.values(mapa).sort((a,b)=>b.qtd-a.qtd || b.total-a.total);
}

async function renderDashboardProdutos() {
  const body = document.getElementById('content-body');
  setActiveMenu('produtos_tab');
  body.innerHTML = '<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando dashboard de produtos...</div>';

  const hoje = new Date();
  const hojeStr = produtoFmtDataLocal(hoje);
  const range = produtoMesRange();
  const dias = Math.max(1, Number(produtosDashPeriodo||7));
  const inicioPeriodo = produtoFmtDataLocal(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - dias + 1));

  const [produtos, vendas, itens] = await Promise.all([
    apiGet('produtos?select=*,tipo_mercadoria(descricao),fornecedores(nome_fantasia,razao_social)&order=nome_mercadoria.asc&limit=10000'),
    apiGet('vendas?select=id_venda,data_venda,status_entrega&order=data_venda.asc&limit=10000'),
    apiGet('venda_itens?select=id_venda,id_produto,quantidade,subtotal,produtos!fk_item_produto(nome_mercadoria,estoque_atual,preco_custo,preco_venda)&limit=10000')
  ]);
  if(!Array.isArray(produtos) || !Array.isArray(vendas)) {
    body.innerHTML = '<div class="empty-state"><div class="empty-icon">!</div><p>Erro ao carregar produtos</p></div>';
    return;
  }

  items = produtos;
  filtered = [...items];
  renderList();
  const badge = document.getElementById('badge-produtos_tab');
  if(badge) badge.textContent = items.length;
  const footer = document.getElementById('sidebar-footer');
  if(footer) footer.textContent = `${items.length} produtos`;

  const itensTodos = Array.isArray(itens) ? itens : [];
  const vendasMes = vendas.filter(v => {
    const d = (v.data_venda||'').slice(0,10);
    return d >= range.inicio && d < range.fim && v.status_entrega !== 'CANCELADO';
  });
  const vendasMesAnterior = vendas.filter(v => {
    const d = (v.data_venda||'').slice(0,10);
    return d >= range.anteriorInicio && d < range.anteriorFim && v.status_entrega !== 'CANCELADO';
  });
  const vendasPeriodo = vendas.filter(v => {
    const d = (v.data_venda||'').slice(0,10);
    return d >= inicioPeriodo && d <= hojeStr && v.status_entrega !== 'CANCELADO';
  });
  const vendasHoje = vendas.filter(v => (v.data_venda||'').slice(0,10) === hojeStr && v.status_entrega !== 'CANCELADO');
  const vendidosHoje = produtoAgruparVendidos(itensTodos, produtos, produtoVendaIds(vendasHoje));
  const vendidosMes = produtoAgruparVendidos(itensTodos, produtos, produtoVendaIds(vendasMes));
  const vendidosMesAnterior = produtoAgruparVendidos(itensTodos, produtos, produtoVendaIds(vendasMesAnterior));
  const vendidosPeriodo = produtoAgruparVendidos(itensTodos, produtos, produtoVendaIds(vendasPeriodo));
  const qtdHoje = vendidosHoje.reduce((s,p)=>s+p.qtd,0);
  const totalHoje = vendidosHoje.reduce((s,p)=>s+p.total,0);
  const qtdMes = vendidosMes.reduce((s,p)=>s+p.qtd,0);
  const totalMes = vendidosMes.reduce((s,p)=>s+p.total,0);
  const qtdAnterior = vendidosMesAnterior.reduce((s,p)=>s+p.qtd,0);
  const totalAnterior = vendidosMesAnterior.reduce((s,p)=>s+p.total,0);
  const variacaoQtd = qtdAnterior > 0 ? ((qtdMes - qtdAnterior) / qtdAnterior * 100) : null;
  const estoqueTotal = produtos.reduce((s,p)=>s+Number(p.estoque_atual||0),0);
  const valorEstoque = produtos.reduce((s,p)=>s+(Number(p.estoque_atual||0)*Number(p.preco_custo||0)),0);
  const zerados = produtos.filter(p=>Number(p.estoque_atual||0) <= 0);
  const baixoEstoque = produtos.filter(p=>Number(p.estoque_atual||0) > 0 && Number(p.estoque_atual||0) <= 5);
  const semCusto = produtos.filter(p=>Number(p.preco_custo||0) <= 0);

  const labels = [], valoresQtd = [], valoresTotal = [];
  for(let i=dias-1; i>=0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i);
    const ds = produtoFmtDataLocal(d);
    const idsDia = produtoVendaIds(vendas.filter(v => (v.data_venda||'').slice(0,10) === ds));
    const agregadosDia = produtoAgruparVendidos(itensTodos, produtos, idsDia);
    labels.push(d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}));
    valoresQtd.push(Number(agregadosDia.reduce((s,p)=>s+p.qtd,0).toFixed(2)));
    valoresTotal.push(Number(agregadosDia.reduce((s,p)=>s+p.total,0).toFixed(2)));
  }

  const variacaoTxt = v => v === null ? 'sem base' : `${v>=0?'+':''}${v.toFixed(1)}%`;
  const visaoBtn = (id,label) => `<button class="dash-period-btn ${produtosDashVisao===id?'active':''}" onclick="mudarVisaoProdutos('${id}')">${label}</button>`;
  const listaVendidos = vendidosMes.slice(0,12);
  const listaEstoque = [...produtos].sort((a,b)=>Number(b.estoque_atual||0)-Number(a.estoque_atual||0)).slice(0,18);
  const listaAlertas = [...zerados, ...baixoEstoque].slice(0,14);

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
      <button class="dash-period-btn" onclick="mudarMesProdutosDashboard(-1)">Mes anterior</button>
      <button class="dash-period-btn ${produtosDashMesOffset===0?'active':''}" onclick="irMesAtualProdutosDashboard()">Mes atual</button>
      <button class="dash-period-btn" onclick="mudarMesProdutosDashboard(1)" ${produtosDashMesOffset>=0?'disabled style="opacity:.45;cursor:not-allowed;"':''}>Proximo mes</button>
      <button class="dash-period-btn" onclick="renderComparativoProdutos()">Comparar meses</button>
      <button class="dash-period-btn" onclick="renderUnificarMercadorias()">Unificar mercadorias</button>
      <span style="font-size:12px;color:var(--text2);font-family:var(--mono);margin-left:auto;text-transform:uppercase;">${range.label}</span>
    </div>

    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:12px;">
      ${visaoBtn('vendidos','Mais vendidos')}
      ${visaoBtn('estoque','Estoque atual')}
    </div>

    <div class="dash-grid">
      <div class="dash-card green" style="cursor:default;"><div class="dash-card-label">Vendidos hoje</div><div class="dash-card-value" style="font-size:20px;">${qtdHoje.toLocaleString('pt-BR',{maximumFractionDigits:2})}</div><div class="dash-card-sub">${produtoFmt(totalHoje)}</div></div>
      <div class="dash-card blue" style="cursor:default;"><div class="dash-card-label">Unidades no mes</div><div class="dash-card-value" style="font-size:20px;">${qtdMes.toLocaleString('pt-BR',{maximumFractionDigits:2})}</div><div class="dash-card-sub">mes selecionado</div></div>
      <div class="dash-card orange" style="cursor:default;"><div class="dash-card-label">Valor do mes</div><div class="dash-card-value" style="font-size:20px;">${produtoFmt(totalMes)}</div><div class="dash-card-sub">${variacaoTxt(variacaoQtd)} vs anterior</div></div>
      <div class="dash-card orange" style="cursor:default;"><div class="dash-card-label">Estoque total</div><div class="dash-card-value" style="font-size:20px;">${estoqueTotal.toLocaleString('pt-BR',{maximumFractionDigits:2})}</div><div class="dash-card-sub">${produtoFmt(valorEstoque)} em custo</div></div>
      <div class="dash-card red" style="cursor:default;"><div class="dash-card-label">Alertas</div><div class="dash-card-value">${zerados.length + baixoEstoque.length}</div><div class="dash-card-sub">${zerados.length} zerado(s), ${baixoEstoque.length} baixo(s)</div></div>
    </div>

    ${produtosDashVisao === 'vendidos' ? `
      <div class="dash-charts">
        <div class="dash-chart-box">
          <div class="dash-chart-title">
            <span>Produtos vendidos por periodo</span>
            <div class="dash-chart-period">
              <button class="dash-period-btn ${produtosDashPeriodo==='7'?'active':''}" onclick="mudarPeriodoProdutos('7')">7d</button>
              <button class="dash-period-btn ${produtosDashPeriodo==='15'?'active':''}" onclick="mudarPeriodoProdutos('15')">15d</button>
              <button class="dash-period-btn ${produtosDashPeriodo==='30'?'active':''}" onclick="mudarPeriodoProdutos('30')">30d</button>
            </div>
          </div>
          <div class="dash-canvas-wrap"><canvas id="chart-produtos"></canvas></div>
        </div>
        <div class="dash-chart-box">
          <div class="dash-chart-title"><span>Top do mes selecionado</span></div>
          <div class="dash-list">
            ${listaVendidos.length ? listaVendidos.map((p,i)=>{
              const pct = listaVendidos[0].qtd ? (p.qtd/listaVendidos[0].qtd*100).toFixed(0) : 0;
              return `<div class="dash-list-item" onclick="openItem(${p.id})">
                <span class="dash-list-rank">${i+1}</span>
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;justify-content:space-between;gap:8px;"><span class="dash-list-name">${p.nome}</span><span class="dash-list-value">${p.qtd.toLocaleString('pt-BR',{maximumFractionDigits:2})} un</span></div>
                  <div style="font-size:11px;color:var(--text2);">${produtoFmt(p.total)} vendido - estoque ${p.estoque.toLocaleString('pt-BR',{maximumFractionDigits:2})}</div>
                  <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${pct}%;background:var(--accent2)"></div></div>
                </div>
              </div>`;
            }).join('') : '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;">Nenhum produto vendido no periodo</div>'}
          </div>
        </div>
      </div>
      <div class="dash-chart-box" style="margin-bottom:20px;">
        <div class="dash-chart-title"><span>Mais vendidos nos ultimos ${dias} dias</span></div>
        <div class="dash-two-col">
          ${vendidosPeriodo.slice(0,12).map((p,i)=>`<div class="dash-list-item" onclick="openItem(${p.id})">
            <span class="dash-list-rank">${i+1}</span>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;justify-content:space-between;gap:8px;"><span class="dash-list-name">${p.nome}</span><span class="dash-list-value">${p.qtd.toLocaleString('pt-BR',{maximumFractionDigits:2})} un</span></div>
              <div style="font-size:11px;color:var(--text2);">${produtoFmt(p.total)}</div>
            </div>
          </div>`).join('') || '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;grid-column:1/-1;">Nenhum dado</div>'}
        </div>
      </div>` : `
      <div class="dash-charts">
        <div class="dash-chart-box">
          <div class="dash-chart-title"><span>Produtos com mais estoque</span></div>
          <div class="dash-canvas-wrap"><canvas id="chart-produtos"></canvas></div>
        </div>
        <div class="dash-chart-box">
          <div class="dash-chart-title"><span>Maiores estoques</span></div>
          <div class="dash-list">
            ${listaEstoque.slice(0,14).map((p,i)=>{
              const est = Number(p.estoque_atual||0);
              return `<div class="dash-list-item" onclick="openItem(${p.id_produto})">
                <span class="dash-list-rank">${i+1}</span>
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;justify-content:space-between;gap:8px;"><span class="dash-list-name">${p.nome_mercadoria}</span><span class="dash-list-value">${est.toLocaleString('pt-BR',{maximumFractionDigits:2})} ${p.unidade||''}</span></div>
                  <div style="font-size:11px;color:var(--text2);">${p.tipo_mercadoria?.descricao||'-'} - valor ${produtoFmt(est*Number(p.preco_custo||0))}</div>
                </div>
              </div>`;
            }).join('') || '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;">Nenhum produto com estoque</div>'}
          </div>
        </div>
      </div>
      <div class="dash-chart-box" style="margin-bottom:20px;overflow:auto;">
        <div class="dash-chart-title"><span>Ranking de estoque atual</span><span style="font-size:11px;color:var(--text3);">${listaAlertas.length} alerta(s), ${semCusto.length} sem custo</span></div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:720px;">
          <thead><tr style="background:var(--surface2);">
            <th style="padding:9px 10px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">Produto</th>
            <th style="padding:9px 10px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">Tipo</th>
            <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Estoque</th>
            <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Custo</th>
            <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Valor estoque</th>
          </tr></thead>
          <tbody>${listaEstoque.map(p=>{
            const est=Number(p.estoque_atual||0);
            return `<tr style="border-top:1px solid var(--border);cursor:pointer;" onclick="openItem(${p.id_produto})">
              <td style="padding:9px 10px;">${p.nome_mercadoria}</td>
              <td style="padding:9px 10px;color:var(--text2);">${p.tipo_mercadoria?.descricao||'-'}</td>
              <td style="padding:9px 10px;text-align:right;font-family:var(--mono);color:${est<=0?'var(--danger)':est<=5?'var(--warn)':'var(--accent)'};">${est.toLocaleString('pt-BR',{maximumFractionDigits:2})} ${p.unidade||''}</td>
              <td style="padding:9px 10px;text-align:right;font-family:var(--mono);">${produtoFmt(p.preco_custo)}</td>
              <td style="padding:9px 10px;text-align:right;font-family:var(--mono);">${produtoFmt(est*Number(p.preco_custo||0))}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`}`;

  setTimeout(() => renderChartProdutos(labels, valoresQtd, valoresTotal, produtos, listaEstoque), 100);
}

function produtoUnificacaoLabel(p) {
  if(!p) return '-';
  const est = Number(p.estoque_atual || 0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  return `${p.nome_mercadoria} (#${p.id_produto}) - estoque ${est}`;
}

async function renderUnificarMercadorias() {
  const body = document.getElementById('content-body');
  body.innerHTML = '<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando mercadorias...</div>';

  const produtos = await apiGet('produtos?select=id_produto,nome_mercadoria,estoque_atual,preco_custo,preco_venda,ativo&order=nome_mercadoria.asc&limit=10000');
  if(!Array.isArray(produtos)) {
    body.innerHTML = '<div class="empty-state"><div class="empty-icon">!</div><p>Erro ao carregar mercadorias</p></div>';
    return;
  }
  cacheProdutos = produtos;
  const opts = produtos.map(p=>`<option value="${p.id_produto}">${produtoUnificacaoLabel(p)}</option>`).join('');

  document.getElementById('content-header').style.display = 'none';
  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
      <button class="dash-period-btn" onclick="renderDashboardProdutos()">Voltar</button>
      <span style="font-size:15px;font-weight:600;">Unificar mercadorias duplicadas</span>
    </div>
    <div class="dash-chart-box" style="max-width:900px;">
      <div class="section-label"><span>Mercadorias</span></div>
      <div class="form-grid">
        <div class="form-group full">
          <label class="form-label">Origem: mercadoria duplicada que sera excluida</label>
          <select class="form-input form-select" id="unif-origem" onchange="previewUnificacaoMercadorias()">
            <option value="">Selecione a origem...</option>${opts}
          </select>
        </div>
        <div class="form-group full">
          <label class="form-label">Destino: mercadoria correta que vai receber tudo</label>
          <select class="form-input form-select" id="unif-destino" onchange="previewUnificacaoMercadorias()">
            <option value="">Selecione o destino...</option>${opts}
          </select>
        </div>
      </div>
      <div id="unif-preview" style="margin:12px 0;color:var(--text2);font-size:13px;">Selecione a origem e o destino.</div>
      <div class="section-label"><span>Confirmacao</span></div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Digite UNIFICAR</label>
          <input class="form-input" id="unif-confirmacao" placeholder="UNIFICAR"/>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text2);line-height:1.5;margin:8px 0 14px;">
        A operacao move vendas, compras, movimentacoes de estoque e precos especiais da origem para o destino. Depois disso, a mercadoria de origem e excluida.
      </div>
      <div class="form-actions">
        <button class="btn btn-danger" id="btn-unificar-mercadorias" onclick="executarUnificacaoMercadorias()">Unificar e excluir origem</button>
        <button class="btn btn-secondary" onclick="renderDashboardProdutos()">Cancelar</button>
      </div>
    </div>`;
}

async function contarReferenciasMercadoria(idProduto) {
  const [movs, vendaItens, compraItens, compras, precos] = await Promise.all([
    apiGet(`estoque_movimentacoes?select=id_movimentacao&id_produto=eq.${idProduto}&limit=10000`),
    apiGet(`venda_itens?select=id_item&id_produto=eq.${idProduto}&limit=10000`),
    apiGet(`compra_itens?select=id_item_compra&id_produto=eq.${idProduto}&limit=10000`),
    apiGet(`compras?select=id_compra&id_produto=eq.${idProduto}&limit=10000`),
    apiGet(`produtos_precos_especiais?select=id_preco_especial&id_produto=eq.${idProduto}&limit=10000`)
  ]);
  return {
    movs: Array.isArray(movs) ? movs.length : 0,
    vendaItens: Array.isArray(vendaItens) ? vendaItens.length : 0,
    compraItens: Array.isArray(compraItens) ? compraItens.length : 0,
    compras: Array.isArray(compras) ? compras.length : 0,
    precos: Array.isArray(precos) ? precos.length : 0
  };
}

async function previewUnificacaoMercadorias() {
  const origemId = Number(document.getElementById('unif-origem')?.value || 0);
  const destinoId = Number(document.getElementById('unif-destino')?.value || 0);
  const alvo = document.getElementById('unif-preview');
  if(!alvo) return;
  if(!origemId || !destinoId) {
    alvo.innerHTML = 'Selecione a origem e o destino.';
    return;
  }
  if(origemId === destinoId) {
    alvo.innerHTML = '<span style="color:var(--danger);">Origem e destino precisam ser mercadorias diferentes.</span>';
    return;
  }
  alvo.innerHTML = '<div class="loading" style="padding:8px 0;"><div class="spinner"></div> Conferindo referencias...</div>';
  const origem = cacheProdutos.find(p=>Number(p.id_produto)===origemId);
  const destino = cacheProdutos.find(p=>Number(p.id_produto)===destinoId);
  const refs = await contarReferenciasMercadoria(origemId);
  const estoqueFinal = Number(origem?.estoque_atual || 0) + Number(destino?.estoque_atual || 0);
  alvo.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;">
      <div style="font-weight:600;margin-bottom:6px;">${produtoUnificacaoLabel(origem)} -> ${produtoUnificacaoLabel(destino)}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;font-size:12px;">
        <div>Movimentacoes: <strong>${refs.movs}</strong></div>
        <div>Itens de venda: <strong>${refs.vendaItens}</strong></div>
        <div>Itens de compra: <strong>${refs.compraItens}</strong></div>
        <div>Compras diretas: <strong>${refs.compras}</strong></div>
        <div>Precos especiais: <strong>${refs.precos}</strong></div>
      </div>
      <div style="margin-top:8px;font-size:12px;color:var(--text2);">Estoque final previsto no destino: <strong style="color:var(--accent);">${estoqueFinal.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>
    </div>`;
}

async function moverPrecosEspeciaisMercadoria(origemId, destinoId) {
  const [origemPrecos, destinoPrecos] = await Promise.all([
    apiGet(`produtos_precos_especiais?select=id_preco_especial,id_cliente&id_produto=eq.${origemId}&limit=10000`),
    apiGet(`produtos_precos_especiais?select=id_preco_especial,id_cliente&id_produto=eq.${destinoId}&limit=10000`)
  ]);
  if(!Array.isArray(origemPrecos)) throw new Error('Nao foi possivel carregar precos especiais da origem.');
  const clientesDestino = new Set((Array.isArray(destinoPrecos) ? destinoPrecos : []).map(p=>String(p.id_cliente)));
  for(const preco of origemPrecos) {
    if(clientesDestino.has(String(preco.id_cliente))) {
      const ok = await apiDelete(`produtos_precos_especiais?id_preco_especial=eq.${preco.id_preco_especial}`);
      if(!ok) throw new Error('Erro ao remover preco especial duplicado.');
    } else {
      const res = await apiPatch(`produtos_precos_especiais?id_preco_especial=eq.${preco.id_preco_especial}`, { id_produto: destinoId });
      if(!res.ok) throw new Error(res.data?.message || 'Erro ao mover preco especial.');
    }
  }
}

async function executarUnificacaoMercadorias() {
  const origemId = Number(document.getElementById('unif-origem')?.value || 0);
  const destinoId = Number(document.getElementById('unif-destino')?.value || 0);
  const confirmacao = (document.getElementById('unif-confirmacao')?.value || '').trim().toUpperCase();
  if(!origemId || !destinoId) { toast('Selecione origem e destino.','error'); return; }
  if(origemId === destinoId) { toast('Origem e destino precisam ser diferentes.','error'); return; }
  if(confirmacao !== 'UNIFICAR') { toast('Digite UNIFICAR para confirmar.','error'); return; }

  const origem = cacheProdutos.find(p=>Number(p.id_produto)===origemId) || (await getProdutoEstoque(origemId));
  const destino = cacheProdutos.find(p=>Number(p.id_produto)===destinoId) || (await getProdutoEstoque(destinoId));
  if(!origem || !destino) { toast('Mercadoria de origem ou destino nao encontrada.','error'); return; }
  if(!confirm(`Unificar "${origem.nome_mercadoria}" em "${destino.nome_mercadoria}"?\n\nA origem sera excluida ao final.`)) return;

  const btn = document.getElementById('btn-unificar-mercadorias');
  btn.disabled = true;
  btn.textContent = 'Unificando...';

  try {
    const estoqueFinal = Number(origem.estoque_atual || 0) + Number(destino.estoque_atual || 0);
    const passos = [
      ['estoque_movimentacoes', `estoque_movimentacoes?id_produto=eq.${origemId}`],
      ['venda_itens', `venda_itens?id_produto=eq.${origemId}`],
      ['compra_itens', `compra_itens?id_produto=eq.${origemId}`],
      ['compras', `compras?id_produto=eq.${origemId}`]
    ];

    for(const [nome, endpoint] of passos) {
      const res = await apiPatch(endpoint, { id_produto: destinoId });
      if(!res.ok) throw new Error(`Erro ao mover ${nome}: ${res.data?.message || 'erro'}`);
    }

    await moverPrecosEspeciaisMercadoria(origemId, destinoId);

    const estoqueRes = await apiPatch(`produtos?id_produto=eq.${destinoId}`, { estoque_atual: estoqueFinal });
    if(!estoqueRes.ok) throw new Error('Erro ao atualizar estoque do destino: '+(estoqueRes.data?.message||'erro'));

    const deleteOk = await apiDelete(`produtos?id_produto=eq.${origemId}`);
    if(!deleteOk) throw new Error('As referencias foram movidas, mas nao foi possivel excluir a mercadoria de origem.');

    toast('Mercadorias unificadas com sucesso!','success');
    await loadItems();
    await loadCaches();
    await renderDashboardProdutos();
  } catch(err) {
    toast(err.message || 'Erro ao unificar mercadorias.','error');
    btn.disabled = false;
    btn.textContent = 'Unificar e excluir origem';
  }
}

function produtoQuebraLabel(p) {
  if(!p) return '-';
  const est = Number(p.estoque_atual || 0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const custo = produtoFmt(p.preco_custo);
  return `${p.nome_mercadoria} (#${p.id_produto}) - ${est} ${p.unidade||''} - custo ${custo}`;
}

async function abrirQuebraEstoqueMenu() {
  if(currentTab!=='produtos_tab') await switchTab('produtos_tab');
  setActiveMenu('produtos_tab');
  document.getElementById('di-produtos_tab')?.classList.remove('active');
  document.getElementById('di-produtos-menu')?.classList.add('active');
  document.getElementById('di-quebra-estoque')?.classList.add('active');
  await renderQuebraEstoque();
  closeSidebar();
}

async function renderQuebraEstoque() {
  const body = document.getElementById('content-body');
  body.innerHTML = '<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando mercadorias...</div>';
  const produtos = await apiGet('produtos?select=id_produto,nome_mercadoria,estoque_atual,preco_custo,preco_venda,unidade,quantidade_fardo,ativo&order=nome_mercadoria.asc&limit=10000');
  if(!Array.isArray(produtos)) {
    body.innerHTML = '<div class="empty-state"><div class="empty-icon">!</div><p>Erro ao carregar mercadorias</p></div>';
    return;
  }
  cacheProdutos = produtos;
  const opts = produtos.map(p=>`<option value="${p.id_produto}">${produtoQuebraLabel(p)}</option>`).join('');
  document.getElementById('content-header').style.display = 'none';
  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
      <button class="dash-period-btn" onclick="renderDashboardProdutos()">Voltar</button>
      <span style="font-size:15px;font-weight:600;">Quebra e montagem de estoque</span>
    </div>
    <div class="dash-chart-box" style="max-width:900px;">
      <div class="section-label"><span>Origem e destino</span></div>
      <div class="form-grid">
        <div class="form-group full">
          <label class="form-label">Sentido da quebra/montagem</label>
          <select class="form-input form-select" id="quebra-modo" onchange="aplicarFatorCadastroQuebra();previewQuebraEstoque()">
            <option value="desmontar">Caixa/fardo para unidade</option>
            <option value="montar">Unidade para caixa/fardo</option>
          </select>
        </div>
        <div class="form-group full">
          <label class="form-label">Origem</label>
          <select class="form-input form-select" id="quebra-origem" onchange="aplicarFatorCadastroQuebra();previewQuebraEstoque()">
            <option value="">Selecione a origem...</option>${opts}
          </select>
        </div>
        <div class="form-group full">
          <label class="form-label">Destino</label>
          <select class="form-input form-select" id="quebra-destino" onchange="aplicarFatorCadastroQuebra();previewQuebraEstoque()">
            <option value="">Selecione o destino...</option>${opts}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Quantidade de caixas/fardos</label>
          <input class="form-input" type="number" min="0.01" step="0.01" id="quebra-qtd-origem" value="1" oninput="previewQuebraEstoque()"/>
        </div>
        <div class="form-group">
          <label class="form-label">Unidades por caixa/fardo</label>
          <input class="form-input" type="number" min="0.01" step="0.01" id="quebra-fator" value="1" oninput="previewQuebraEstoque()"/>
        </div>
      </div>
      <div id="quebra-preview" style="margin:12px 0;color:var(--text2);font-size:13px;">Selecione a origem e o destino.</div>
      <div class="section-label"><span>Observacao</span></div>
      <div class="form-group"><textarea class="form-textarea" id="quebra-obs" placeholder="Ex: abertura de caixa para venda por unidade"></textarea></div>
      <div class="form-actions">
        <button class="btn btn-primary" id="btn-quebrar-estoque" onclick="executarQuebraEstoque()">Confirmar movimentacao</button>
        <button class="btn btn-secondary" onclick="renderDashboardProdutos()">Cancelar</button>
      </div>
    </div>`;
}

function aplicarFatorCadastroQuebra() {
  const modo = document.getElementById('quebra-modo')?.value || 'desmontar';
  const produtoId = Number(document.getElementById(modo === 'montar' ? 'quebra-destino' : 'quebra-origem')?.value || 0);
  const produto = cacheProdutos.find(p=>Number(p.id_produto)===produtoId);
  const fator = Number(produto?.quantidade_fardo || 0);
  const el = document.getElementById('quebra-fator');
  if(el && fator > 0) el.value = fator;
}

function previewQuebraEstoque() {
  const modo = document.getElementById('quebra-modo')?.value || 'desmontar';
  const origemId = Number(document.getElementById('quebra-origem')?.value || 0);
  const destinoId = Number(document.getElementById('quebra-destino')?.value || 0);
  const qtdCaixas = Number(document.getElementById('quebra-qtd-origem')?.value || 0);
  const fator = Number(document.getElementById('quebra-fator')?.value || 0);
  const alvo = document.getElementById('quebra-preview');
  if(!alvo) return;
  if(!origemId || !destinoId) { alvo.innerHTML = 'Selecione a origem e o destino.'; return; }
  if(origemId === destinoId) { alvo.innerHTML = '<span style="color:var(--danger);">Origem e destino precisam ser mercadorias diferentes.</span>'; return; }
  if(qtdCaixas <= 0 || fator <= 0) { alvo.innerHTML = '<span style="color:var(--danger);">Informe quantidades maiores que zero.</span>'; return; }
  const origem = cacheProdutos.find(p=>Number(p.id_produto)===origemId);
  const destino = cacheProdutos.find(p=>Number(p.id_produto)===destinoId);
  const estoqueOrigem = Number(origem?.estoque_atual || 0);
  const estoqueDestino = Number(destino?.estoque_atual || 0);
  const qtdSaida = modo === 'montar' ? qtdCaixas * fator : qtdCaixas;
  const qtdEntrada = modo === 'montar' ? qtdCaixas : qtdCaixas * fator;
  const custoDestino = modo === 'montar'
    ? Number(origem?.preco_custo || 0) * fator
    : Number(origem?.preco_custo || 0) / fator;
  const novoEstoqueOrigem = estoqueOrigem - qtdSaida;
  const novoEstoqueDestino = estoqueDestino + qtdEntrada;
  const entradaLabel = modo === 'montar' ? 'Caixas/fardos criados' : 'Unidades geradas';
  const custoLabel = modo === 'montar' ? 'Custo da caixa/fardo montado' : 'Custo unitario rateado';
  alvo.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;">
      <div style="font-weight:600;margin-bottom:6px;">${produtoQuebraLabel(origem)} -> ${produtoQuebraLabel(destino)}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;font-size:12px;">
        <div>Saida da origem: <strong style="color:${novoEstoqueOrigem<0?'var(--danger)':'var(--warn)'};">${qtdSaida.toLocaleString('pt-BR',{maximumFractionDigits:2})}</strong></div>
        <div>${entradaLabel}: <strong style="color:var(--accent);">${qtdEntrada.toLocaleString('pt-BR',{maximumFractionDigits:2})}</strong></div>
        <div>${custoLabel}: <strong>${produtoFmt(custoDestino)}</strong></div>
        <div>Origem apos quebra: <strong>${novoEstoqueOrigem.toLocaleString('pt-BR',{maximumFractionDigits:2})}</strong></div>
        <div>Destino apos quebra: <strong>${novoEstoqueDestino.toLocaleString('pt-BR',{maximumFractionDigits:2})}</strong></div>
      </div>
      ${novoEstoqueOrigem < -0.005 ? '<div style="color:var(--danger);font-size:12px;margin-top:8px;">A origem ficara com estoque negativo. Ajuste a quantidade.</div>' : ''}
    </div>`;
}

async function executarQuebraEstoque() {
  const modo = document.getElementById('quebra-modo')?.value || 'desmontar';
  const origemId = Number(document.getElementById('quebra-origem')?.value || 0);
  const destinoId = Number(document.getElementById('quebra-destino')?.value || 0);
  const qtdCaixas = Number(document.getElementById('quebra-qtd-origem')?.value || 0);
  const fator = Number(document.getElementById('quebra-fator')?.value || 0);
  const observacoes = document.getElementById('quebra-obs')?.value?.trim() || null;
  if(!origemId || !destinoId) { toast('Selecione origem e destino.','error'); return; }
  if(origemId === destinoId) { toast('Origem e destino precisam ser diferentes.','error'); return; }
  if(qtdCaixas <= 0 || fator <= 0) { toast('Informe quantidades maiores que zero.','error'); return; }

  const origem = await getProdutoEstoque(origemId);
  const destino = await getProdutoEstoque(destinoId);
  if(!origem || !destino) { toast('Mercadoria de origem ou destino nao encontrada.','error'); return; }

  const estoqueOrigemAnterior = Number(origem.estoque_atual || 0);
  const estoqueDestinoAnterior = Number(destino.estoque_atual || 0);
  const qtdSaida = Number((modo === 'montar' ? qtdCaixas * fator : qtdCaixas).toFixed(2));
  const qtdEntrada = Number((modo === 'montar' ? qtdCaixas : qtdCaixas * fator).toFixed(2));
  const estoqueOrigemAtual = Number((estoqueOrigemAnterior - qtdSaida).toFixed(2));
  if(estoqueOrigemAtual < -0.005) { toast('Estoque insuficiente na origem.','error'); return; }

  const estoqueDestinoAtual = Number((estoqueDestinoAnterior + qtdEntrada).toFixed(2));
  const custoDestino = Number((modo === 'montar'
    ? Number(origem.preco_custo || 0) * fator
    : Number(origem.preco_custo || 0) / fator).toFixed(4));
  const obsBase = observacoes || (
    modo === 'montar'
      ? `Montagem de estoque: ${qtdSaida} x ${origem.nome_mercadoria} em ${qtdEntrada} x ${destino.nome_mercadoria}`
      : `Quebra de estoque: ${qtdSaida} x ${origem.nome_mercadoria} em ${qtdEntrada} x ${destino.nome_mercadoria}`
  );
  const btn = document.getElementById('btn-quebrar-estoque');
  btn.disabled = true;
  btn.textContent = 'Movimentando...';
  let origemAtualizada = false;
  let destinoAtualizado = false;
  let movSaidaId = null;

  try {
    const origemRes = await apiPatch(`produtos?id_produto=eq.${origemId}`, { estoque_atual: estoqueOrigemAtual });
    if(!origemRes.ok) throw new Error('Erro ao baixar estoque da origem: '+(origemRes.data?.message||'erro'));
    origemAtualizada = true;

    const destinoRes = await apiPatch(`produtos?id_produto=eq.${destinoId}`, { estoque_atual: estoqueDestinoAtual, preco_custo: custoDestino });
    if(!destinoRes.ok) throw new Error('Erro ao atualizar destino: '+(destinoRes.data?.message||'erro'));
    destinoAtualizado = true;

    const movSaida = await apiPost('estoque_movimentacoes', {
      id_produto: origemId,
      tipo_movimentacao: 'SAIDA_AJUSTE',
      origem: 'QUEBRA_ESTOQUE',
      quantidade: qtdSaida,
      estoque_anterior: estoqueOrigemAnterior,
      estoque_atual: estoqueOrigemAtual,
      observacoes: obsBase,
      id_usuario: usuario?.id || usuario?.id_usuario || null
    });
    if(!movSaida.ok) throw new Error('Estoque atualizado, mas erro ao registrar saida: '+(movSaida.data?.message||'erro'));
    const movSaidaData = Array.isArray(movSaida.data) ? movSaida.data[0] : movSaida.data;
    movSaidaId = movSaidaData?.id_movimentacao || null;

    const movEntrada = await apiPost('estoque_movimentacoes', {
      id_produto: destinoId,
      tipo_movimentacao: 'ENTRADA_AJUSTE',
      origem: 'QUEBRA_ESTOQUE',
      quantidade: qtdEntrada,
      estoque_anterior: estoqueDestinoAnterior,
      estoque_atual: estoqueDestinoAtual,
      observacoes: `${obsBase} | Custo recalculado ${produtoFmt(custoDestino)}`,
      id_usuario: usuario?.id || usuario?.id_usuario || null
    });
    if(!movEntrada.ok) throw new Error('Estoque atualizado, mas erro ao registrar entrada: '+(movEntrada.data?.message||'erro'));

    toast('Movimentacao de estoque registrada!','success');
    await loadItems();
    await loadCaches();
    await renderDashboardProdutos();
  } catch(err) {
    if(movSaidaId) await apiDelete(`estoque_movimentacoes?id_movimentacao=eq.${movSaidaId}`);
    if(destinoAtualizado) await apiPatch(`produtos?id_produto=eq.${destinoId}`, { estoque_atual: estoqueDestinoAnterior, preco_custo: Number(destino.preco_custo || 0) });
    if(origemAtualizada) await apiPatch(`produtos?id_produto=eq.${origemId}`, { estoque_atual: estoqueOrigemAnterior });
    toast(err.message || 'Erro ao quebrar estoque.','error');
    btn.disabled = false;
    btn.textContent = 'Confirmar movimentacao';
  }
}

function renderChartProdutos(labels, valoresQtd, valoresTotal, produtos, listaEstoque) {
  const ctx = document.getElementById('chart-produtos');
  if(!ctx) return;
  if(chartProdutos) chartProdutos.destroy();
  const estoqueChart = produtosDashVisao === 'estoque';
  const dadosEstoque = [...produtos].sort((a,b)=>Number(b.estoque_atual||0)-Number(a.estoque_atual||0)).slice(0,15);
  chartProdutos = new Chart(ctx, {
    type: estoqueChart ? 'bar' : 'line',
    data: estoqueChart ? {
      labels: dadosEstoque.map(p=>p.nome_mercadoria),
      datasets: [{ label:'Estoque atual', data:dadosEstoque.map(p=>Number(p.estoque_atual||0)), backgroundColor:'rgba(0,229,160,.55)', borderWidth:0 }]
    } : {
      labels,
      datasets: [
        { label:'Unidades', data:valoresQtd, borderColor:'#00e5a0', backgroundColor:'rgba(0,229,160,.08)', borderWidth:2, pointRadius:3, fill:true, tension:.35 },
        { label:'Valor vendido', data:valoresTotal, borderColor:'#007aff', backgroundColor:'rgba(0,122,255,.08)', borderWidth:2, pointRadius:3, fill:true, tension:.35, yAxisID:'y1' }
      ]
    },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      indexAxis: estoqueChart ? 'y' : 'x',
      plugins:{
        legend:{ position:'bottom', labels:{ color:'#8888a0', font:{size:11}, padding:12 } },
        tooltip:{ callbacks:{ label: ctx => estoqueChart ? `Estoque: ${Number(ctx.raw).toLocaleString('pt-BR',{maximumFractionDigits:2})}` : `${ctx.dataset.label}: ${ctx.dataset.yAxisID==='y1' ? produtoFmt(ctx.raw) : Number(ctx.raw).toLocaleString('pt-BR',{maximumFractionDigits:2})}` } }
      },
      scales: estoqueChart ? {
        x:{ grid:{ color:'rgba(255,255,255,.05)' }, ticks:{ color:'#8888a0', font:{size:11} } },
        y:{ grid:{ color:'rgba(255,255,255,.05)' }, ticks:{ color:'#8888a0', font:{size:10} } }
      } : {
        x:{ grid:{ color:'rgba(255,255,255,.05)' }, ticks:{ color:'#8888a0', font:{size:11} } },
        y:{ position:'left', grid:{ color:'rgba(255,255,255,.05)' }, ticks:{ color:'#8888a0', font:{size:11} } },
        y1:{ position:'right', grid:{ drawOnChartArea:false }, ticks:{ color:'#8888a0', font:{size:11}, callback:v=>'R$ '+Number(v).toLocaleString('pt-BR') } }
      }
    }
  });
}

async function mudarVisaoProdutos(visao) {
  produtosDashVisao = visao;
  await renderDashboardProdutos();
}

async function mudarPeriodoProdutos(periodo) {
  produtosDashPeriodo = periodo;
  await renderDashboardProdutos();
}

async function mudarMesProdutosDashboard(delta) {
  produtosDashMesOffset += delta;
  if(produtosDashMesOffset > 0) produtosDashMesOffset = 0;
  await renderDashboardProdutos();
}

async function irMesAtualProdutosDashboard() {
  produtosDashMesOffset = 0;
  await renderDashboardProdutos();
}

function buildMesesComparativoProdutos(vendas, itens, produtos, modo, ano, mesesQtd) {
  const meses = [];
  if(modo === 'ano') {
    for(let m=0; m<12; m++) meses.push(new Date(ano, m, 1));
  } else {
    const fim = new Date();
    fim.setDate(1);
    for(let i=Math.max(1, mesesQtd)-1; i>=0; i--) meses.push(new Date(fim.getFullYear(), fim.getMonth()-i, 1));
  }
  return meses.map((mes, idx) => {
    const key = `${mes.getFullYear()}-${String(mes.getMonth()+1).padStart(2,'0')}`;
    const vendasMes = vendas.filter(v => (v.data_venda||'').slice(0,7) === key && v.status_entrega !== 'CANCELADO');
    const agregados = produtoAgruparVendidos(itens, produtos, produtoVendaIds(vendasMes));
    const qtd = agregados.reduce((s,p)=>s+p.qtd,0);
    const total = agregados.reduce((s,p)=>s+p.total,0);
    const anterior = idx > 0 ? meses[idx-1] : new Date(mes.getFullYear(), mes.getMonth()-1, 1);
    const keyAnt = `${anterior.getFullYear()}-${String(anterior.getMonth()+1).padStart(2,'0')}`;
    const vendasAnt = vendas.filter(v => (v.data_venda||'').slice(0,7) === keyAnt && v.status_entrega !== 'CANCELADO');
    const qtdAnt = produtoAgruparVendidos(itens, produtos, produtoVendaIds(vendasAnt)).reduce((s,p)=>s+p.qtd,0);
    return {
      key,
      label: mes.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}),
      labelLongo: mes.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}),
      qtd,
      total,
      produtos: agregados.length,
      top: agregados[0],
      variacao: qtdAnt > 0 ? ((qtd-qtdAnt)/qtdAnt*100) : null
    };
  });
}

async function renderComparativoProdutos() {
  const body = document.getElementById('content-body');
  body.innerHTML = '<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando comparativo de produtos...</div>';
  const [produtos, vendas, itens] = await Promise.all([
    apiGet('produtos?select=id_produto,nome_mercadoria,estoque_atual,preco_custo,preco_venda&order=nome_mercadoria.asc&limit=10000'),
    apiGet('vendas?select=id_venda,data_venda,status_entrega&order=data_venda.asc&limit=10000'),
    apiGet('venda_itens?select=id_venda,id_produto,quantidade,subtotal,produtos!fk_item_produto(nome_mercadoria,estoque_atual,preco_custo,preco_venda)&limit=10000')
  ]);
  if(!Array.isArray(produtos) || !Array.isArray(vendas)) {
    body.innerHTML = '<div class="empty-state"><div class="empty-icon">!</div><p>Erro ao carregar comparativo</p></div>';
    return;
  }
  const anos = [...new Set(vendas.map(v => v.data_venda ? new Date(v.data_venda).getFullYear() : null).filter(Boolean))].sort((a,b)=>b-a);
  if(!anos.includes(produtosComparativoAno)) anos.unshift(produtosComparativoAno);
  const mesesQtd = Math.max(1, Math.min(60, Number(produtosComparativoMeses||12)));
  produtosComparativoMeses = mesesQtd;
  const dados = buildMesesComparativoProdutos(vendas, Array.isArray(itens)?itens:[], produtos, produtosComparativoModo, produtosComparativoAno, mesesQtd);
  const totalQtd = dados.reduce((s,m)=>s+m.qtd,0);
  const totalValor = dados.reduce((s,m)=>s+m.total,0);
  const melhorMes = [...dados].sort((a,b)=>b.qtd-a.qtd)[0];
  const fmtPct = n => n === null ? '-' : `${n>=0?'+':''}${n.toFixed(1)}%`;

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
      <button onclick="renderDashboardProdutos()" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--text2);font-size:12px;padding:6px 12px;cursor:pointer;">Voltar</button>
      <span style="font-size:15px;font-weight:600;">Comparativo de Produtos</span>
      <span style="font-size:12px;color:var(--text2);margin-left:auto;">${produtosComparativoModo==='ano' ? 'Ano '+produtosComparativoAno : 'Ultimos '+mesesQtd+' meses'}</span>
    </div>
    <div class="dash-chart-box" style="margin-bottom:14px;padding:12px;">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;align-items:end;">
        <div class="form-group"><label class="form-label">Ultimos meses</label><input class="form-input" type="number" min="1" max="60" step="1" id="prod-comp-meses" value="${mesesQtd}"/></div>
        <div class="form-group"><label class="form-label">Ano</label><select class="form-input form-select" id="prod-comp-ano">${anos.map(a=>`<option value="${a}" ${Number(a)===Number(produtosComparativoAno)?'selected':''}>${a}</option>`).join('')}</select></div>
        <button class="btn btn-primary" onclick="aplicarComparativoProdutos('ultimos')">Ver ultimos meses</button>
        <button class="btn btn-secondary" onclick="aplicarComparativoProdutos('ano')">Ver ano todo</button>
      </div>
    </div>
    <div class="dash-grid" style="grid-template-columns:repeat(auto-fit,minmax(145px,1fr));margin-bottom:14px;">
      <div class="dash-card green" style="cursor:default;"><div class="dash-card-label">Unidades</div><div class="dash-card-value" style="font-size:20px;">${totalQtd.toLocaleString('pt-BR',{maximumFractionDigits:2})}</div><div class="dash-card-sub">vendidas</div></div>
      <div class="dash-card blue" style="cursor:default;"><div class="dash-card-label">Valor vendido</div><div class="dash-card-value" style="font-size:20px;">${produtoFmt(totalValor)}</div><div class="dash-card-sub">periodo selecionado</div></div>
      <div class="dash-card orange" style="cursor:default;"><div class="dash-card-label">Melhor mes</div><div class="dash-card-value" style="font-size:17px;">${melhorMes?.labelLongo||'-'}</div><div class="dash-card-sub">${(melhorMes?.qtd||0).toLocaleString('pt-BR',{maximumFractionDigits:2})} un</div></div>
    </div>
    <div class="dash-chart-box" style="margin-bottom:14px;">
      <div class="dash-chart-title"><span>Unidades e valor vendido por mes</span></div>
      <div class="dash-canvas-wrap"><canvas id="chart-produtos"></canvas></div>
    </div>
    <div class="dash-chart-box" style="margin-bottom:20px;overflow:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:680px;">
        <thead><tr style="background:var(--surface2);">
          <th style="padding:9px 10px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">Mes</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Unidades</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Valor</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Produtos</th>
          <th style="padding:9px 10px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">Mais vendido</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Variacao</th>
        </tr></thead>
        <tbody>${dados.map(m=>`<tr style="border-top:1px solid var(--border);">
          <td style="padding:9px 10px;text-transform:capitalize;">${m.labelLongo}</td>
          <td style="padding:9px 10px;text-align:right;font-family:var(--mono);">${m.qtd.toLocaleString('pt-BR',{maximumFractionDigits:2})}</td>
          <td style="padding:9px 10px;text-align:right;font-family:var(--mono);color:var(--accent);">${produtoFmt(m.total)}</td>
          <td style="padding:9px 10px;text-align:right;color:var(--text2);">${m.produtos}</td>
          <td style="padding:9px 10px;color:var(--text2);">${m.top ? `${m.top.nome} (${m.top.qtd.toLocaleString('pt-BR',{maximumFractionDigits:2})} un)` : '-'}</td>
          <td style="padding:9px 10px;text-align:right;font-family:var(--mono);color:${m.variacao===null?'var(--text3)':m.variacao>=0?'var(--accent)':'var(--danger)'};">${fmtPct(m.variacao)}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;

  setTimeout(() => {
    const ctx = document.getElementById('chart-produtos');
    if(!ctx) return;
    if(chartProdutos) chartProdutos.destroy();
    chartProdutos = new Chart(ctx, {
      type:'bar',
      data:{ labels:dados.map(m=>m.label), datasets:[
        { label:'Unidades', data:dados.map(m=>Number(m.qtd.toFixed(2))), backgroundColor:'rgba(0,229,160,.55)', borderWidth:0 },
        { label:'Valor', data:dados.map(m=>Number(m.total.toFixed(2))), backgroundColor:'rgba(0,122,255,.45)', borderWidth:0, yAxisID:'y1' }
      ] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ color:'#8888a0', font:{size:11}, padding:12 } } }, scales:{
        x:{ grid:{ color:'rgba(255,255,255,.05)' }, ticks:{ color:'#8888a0', font:{size:11} } },
        y:{ position:'left', grid:{ color:'rgba(255,255,255,.05)' }, ticks:{ color:'#8888a0', font:{size:11} } },
        y1:{ position:'right', grid:{ drawOnChartArea:false }, ticks:{ color:'#8888a0', font:{size:11}, callback:v=>'R$ '+Number(v).toLocaleString('pt-BR') } }
      } }
    });
  }, 100);
}

async function aplicarComparativoProdutos(modo) {
  produtosComparativoModo = modo;
  produtosComparativoMeses = Math.max(1, Math.min(60, Number(document.getElementById('prod-comp-meses')?.value||12)));
  produtosComparativoAno = Number(document.getElementById('prod-comp-ano')?.value||new Date().getFullYear());
  await renderComparativoProdutos();
}

// FORM PRODUTO
async function renderFormProduto(c) {
  await loadCaches();
  const v=f=>c?(c[f]??''):'';
  const unids=['UN','KG','LT','CX','PC','DZ','MT','M2','GL'];
  document.getElementById('content-body').innerHTML=`
    <div class="section-label"><span>Dados do Produto</span></div>
    <div class="form-grid">
      <div class="form-group full"><label class="form-label">Nome do Produto *</label><input class="form-input" id="f-nome_mercadoria" value="${v('nome_mercadoria')}" placeholder="Nome do produto"/></div>
      <div class="form-group"><label class="form-label">Tipo de Mercadoria *</label>${buildSelect('f-id_tipo',cacheTipos,'id_tipo','descricao',v('id_tipo'),'Selecione o tipo...')}</div>
      <div class="form-group"><label class="form-label">Fornecedor</label>${buildSelect('f-id_fornecedor',cacheFornecedores,'id_fornecedor','nome_fantasia',v('id_fornecedor'),'Nenhum')}</div>
      <div class="form-group"><label class="form-label">Unidade</label><select class="form-input form-select" id="f-unidade"><option value="">Selecione...</option>${unids.map(u=>`<option value="${u}" ${v('unidade')===u?'selected':''}>${u}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Estoque Atual</label><input class="form-input" type="number" step="0.01" id="f-estoque_atual" value="${v('estoque_atual')}" placeholder="0"/></div>
      <div class="form-group"><label class="form-label">Qtd por caixa/fardo</label><input class="form-input" type="number" min="0" step="0.01" id="f-quantidade_fardo" value="${v('quantidade_fardo')||''}" placeholder="Ex: 12"/></div>
    </div>
    <div class="section-label"><span>Preços</span></div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Preço de Custo (R$) *</label><input class="form-input" type="number" step="0.01" id="f-preco_custo" value="${v('preco_custo')}" placeholder="0,00" oninput="calcMargem()"/></div>
      <div class="form-group"><label class="form-label">Preço de Venda (R$) *</label><input class="form-input" type="number" step="0.01" id="f-preco_venda" value="${v('preco_venda')}" placeholder="0,00" oninput="calcMargem()"/></div>
      <div class="form-group full"><div class="margem-info" id="margem-info"></div></div>
    </div>
    <div class="section-label"><span>Observações</span></div>
    <div class="form-group"><textarea class="form-textarea" id="f-observacoes" placeholder="Informações adicionais...">${v('observacoes')}</textarea></div>
    <div class="section-label"><span>Status</span></div>
    <div class="toggle-row">
      <div class="toggle-info"><strong>Produto Ativo</strong><span>Produtos inativos não aparecem nas listagens</span></div>
      <label class="toggle"><input type="checkbox" id="f-ativo" ${(!c||c.ativo)?'checked':''}/><span class="toggle-slider"></span></label>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save" onclick="saveProduto()">${isNew?'+ Cadastrar':'✓ Salvar'}</button>
      ${!isNew?`<button class="btn btn-danger" onclick="toggleAtivo()">${c&&c.ativo?'✕ Desativar':'✓ Reativar'}</button>`:''}
      <button class="btn btn-secondary" onclick="cancelForm()">Cancelar</button>
    </div>`;
  calcMargem();
}

function calcMargem() {
  const custo=parseFloat(document.getElementById('f-preco_custo')?.value||0);
  const venda=parseFloat(document.getElementById('f-preco_venda')?.value||0);
  const el=document.getElementById('margem-info'); if(!el) return;
  if(custo>0&&venda>0){
    const m=((venda-custo)/custo*100).toFixed(1);
    const l=(venda-custo).toFixed(2);
    const cor=m>0?'var(--accent)':'var(--danger)';
    el.innerHTML=`Margem: <strong style="color:${cor}">${m}%</strong> &nbsp;·&nbsp; Lucro unitário: <strong style="color:${cor}">R$ ${l}</strong>`;
  } else el.innerHTML='';
}

async function saveProduto() {
  const nome=document.getElementById('f-nome_mercadoria').value.trim();
  const id_tipo=document.getElementById('f-id_tipo').value;
  const custo=document.getElementById('f-preco_custo').value;
  const venda=document.getElementById('f-preco_venda').value;
  if(!nome){toast('Nome obrigatorio','error');return;}
  if(!id_tipo){toast('Selecione o tipo','error');return;}
  if(!custo||!venda){toast('Precos obrigatorios','error');return;}
  const btn=document.getElementById('btn-save'); btn.disabled=true; btn.textContent='Salvando...';
  const qtdFardo = parseFloat(document.getElementById('f-quantidade_fardo')?.value || '');
  const data={nome_mercadoria:nome,id_tipo:parseInt(id_tipo),id_fornecedor:document.getElementById('f-id_fornecedor').value?parseInt(document.getElementById('f-id_fornecedor').value):null,unidade:document.getElementById('f-unidade').value||null,estoque_atual:parseFloat(document.getElementById('f-estoque_atual').value)||0,quantidade_fardo:Number.isFinite(qtdFardo)&&qtdFardo>0?qtdFardo:null,preco_custo:parseFloat(custo),preco_venda:parseFloat(venda),observacoes:document.getElementById('f-observacoes').value.trim()||null,ativo:document.getElementById('f-ativo').checked};
  if(isNew){
    const{ok,data:res}=await apiPost('produtos',data);
    if(ok){toast('Produto cadastrado!','success');await loadItems();await loadCaches();const n=Array.isArray(res)?res[0]:res;if(n)openItem(n.id_produto);}
    else{toast('Erro: '+(res?.message||'erro'),'error');btn.disabled=false;btn.textContent='+ Cadastrar';}
  } else {
    const produtoAnterior = items.find(p=>Number(p.id_produto)===Number(currentId)) || {};
    const custoAnterior = Number(produtoAnterior.preco_custo || 0);
    const custoNovo = Number(data.preco_custo || 0);
    const custoMudou = Math.abs(custoNovo - custoAnterior) >= 0.005;
    let dataBaseCusto = '';
    if(custoMudou) {
      dataBaseCusto = prompt(
        'O custo deste produto mudou de R$ ' + custoAnterior.toFixed(2) + ' para R$ ' + custoNovo.toFixed(2) + '.\n\n' +
        'A partir de qual data-base esse custo deve ser aplicado aos pedidos ja lancados?\n' +
        'Use AAAA-MM-DD. Vendas futuras nao serao alteradas.\n\n' +
        'Deixe em branco para salvar apenas o cadastro do produto.'
      );
      if(dataBaseCusto === null) {
        btn.disabled=false; btn.textContent='Salvar';
        return;
      }
      dataBaseCusto = dataBaseCusto.trim();
      if(dataBaseCusto && !/^\d{4}-\d{2}-\d{2}$/.test(dataBaseCusto)) {
        toast('Data-base invalida. Use o formato AAAA-MM-DD.','error');
        btn.disabled=false; btn.textContent='Salvar';
        return;
      }
    }

    const{ok}=await apiPatch(`produtos?id_produto=eq.${currentId}`,data);
    if(ok){
      if(custoMudou && dataBaseCusto) {
        try {
          const ajuste = await aplicarCustoProdutoEmVendas(currentId, custoAnterior, custoNovo, dataBaseCusto);
          toast(`Salvo! Custo atualizado em ${ajuste.atualizadas} venda(s).`,'success');
        } catch(err) {
          toast('Produto salvo, mas erro ao ajustar custos antigos: '+(err.message||err),'error');
        }
      } else {
        toast('Salvo!','success');
      }
      await loadItems();await loadCaches();openItem(currentId);
    }
    else{toast('Erro','error');btn.disabled=false;btn.textContent='Salvar';}
  }
}

async function aplicarCustoProdutoEmVendas(idProduto, custoAnterior, custoNovo, dataBase) {
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
  if(dataBase > hojeStr) return { atualizadas: 0 };

  const itens = await apiGet(`venda_itens?select=id_venda,id_produto,quantidade&id_produto=eq.${idProduto}&limit=10000`);
  if(!Array.isArray(itens) || !itens.length) return { atualizadas: 0 };

  const idsVenda = [...new Set(itens.map(i=>Number(i.id_venda)).filter(Boolean))];
  if(!idsVenda.length) return { atualizadas: 0 };

  let atualizadas = 0;
  for(let i=0;i<idsVenda.length;i+=80) {
    const lote = idsVenda.slice(i, i + 80);
    const vendas = await apiGet(`vendas?select=id_venda,data_venda,valor_produtos&id_venda=in.(${lote.join(',')})&data_venda=gte.${dataBase}T00:00:00&data_venda=lte.${hojeStr}T23:59:59&limit=10000`);
    if(!Array.isArray(vendas) || !vendas.length) continue;

    for(const venda of vendas) {
      const qtd = itens
        .filter(item=>Number(item.id_venda)===Number(venda.id_venda))
        .reduce((s,item)=>s+Number(item.quantidade||0),0);
      if(qtd <= 0) continue;

      const diferenca = (Number(custoNovo||0) - Number(custoAnterior||0)) * qtd;
      const novoTotal = Math.max(0, Number(venda.valor_produtos||0) + diferenca);
      const res = await apiPatch(`vendas?id_venda=eq.${venda.id_venda}`, { valor_produtos: Number(novoTotal.toFixed(2)) });
      if(!res.ok) throw new Error(res.data?.message || `Erro ao atualizar custo da venda ${venda.id_venda}`);
      atualizadas += 1;
    }
  }

  return { atualizadas };
}
// FORM PREÇO ESPECIAL
async function renderFormPreco(c) {
  await loadCaches();
  const v=f=>c?(c[f]??''):'';
  const prodSel=buildSelect('f-id_produto',cacheProdutos,'id_produto','nome_mercadoria',v('id_produto'),'Selecione o produto...');
  const cliSel=buildSelect('f-id_cliente',cacheClientes,'id_cliente','nome_fantasia',v('id_cliente'),'Selecione o cliente...');
  let precoRef='';
  if(c?.id_produto){const p=cacheProdutos.find(x=>x.id_produto===c.id_produto);if(p)precoRef=`Preço padrão: R$ ${Number(p.preco_venda||0).toFixed(2)}`;}
  document.getElementById('content-body').innerHTML=`
    <div class="section-label"><span>Preço Especial por Cliente</span></div>
    <div class="form-grid">
      <div class="form-group full"><label class="form-label">Cliente *</label>${cliSel}</div>
      <div class="form-group full"><label class="form-label">Produto *</label>${prodSel}</div>
      <div class="form-group"><label class="form-label">Preço Especial (R$) *</label><input class="form-input" type="number" step="0.01" id="f-preco_especial" value="${v('preco_especial')}" placeholder="0,00"/></div>
      <div class="form-group" style="justify-content:flex-end"><div style="font-size:12px;color:var(--text2);padding-top:28px" id="preco-ref">${precoRef}</div></div>
    </div>
    <div class="section-label"><span>Observações</span></div>
    <div class="form-group"><textarea class="form-textarea" id="f-observacoes" placeholder="Motivo do preço especial...">${v('observacoes')}</textarea></div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save" onclick="savePreco()">${isNew?'+ Cadastrar':'✓ Salvar'}</button>
      ${!isNew?`<button class="btn btn-danger" onclick="deletePreco()">🗑 Excluir</button>`:''}
      <button class="btn btn-secondary" onclick="cancelForm()">Cancelar</button>
    </div>`;
  document.getElementById('f-id_produto')?.addEventListener('change',async function(){
    const p=cacheProdutos.find(x=>String(x.id_produto)===this.value);
    document.getElementById('preco-ref').textContent=p?`Preço padrão: R$ ${Number(p.preco_venda||0).toFixed(2)}`:'';
  });
}

async function savePreco() {
  const id_cli=document.getElementById('f-id_cliente').value;
  const id_prod=document.getElementById('f-id_produto').value;
  const preco=document.getElementById('f-preco_especial').value;
  if(!id_cli){toast('Selecione o cliente','error');return;}
  if(!id_prod){toast('Selecione o produto','error');return;}
  if(!preco){toast('Informe o preço','error');return;}
  const btn=document.getElementById('btn-save'); btn.disabled=true; btn.textContent='Salvando...';
  const data={id_cliente:parseInt(id_cli),id_produto:parseInt(id_prod),preco_especial:parseFloat(preco),observacoes:document.getElementById('f-observacoes').value.trim()||null};
  if(isNew){
    const{ok,data:res}=await apiPost('produtos_precos_especiais',data);
    if(ok){toast('Preço especial cadastrado!','success');await loadItems();const n=Array.isArray(res)?res[0]:res;if(n)openItem(n.id_preco_especial);}
    else{toast('Erro: '+(res?.message||'erro'),'error');btn.disabled=false;btn.textContent='+ Cadastrar';}
  } else {
    const{ok}=await apiPatch(`produtos_precos_especiais?id_preco_especial=eq.${currentId}`,data);
    if(ok){toast('Salvo!','success');await loadItems();openItem(currentId);}
    else{toast('Erro','error');btn.disabled=false;btn.textContent='✓ Salvar';}
  }
}

async function deletePreco() {
  if(!confirm('Confirma exclusão?')) return;
  const ok=await apiDelete(`produtos_precos_especiais?id_preco_especial=eq.${currentId}`);
  if(ok){toast('Excluído!','success');await loadItems();cancelForm();}
  else toast('Erro ao excluir','error');
}
