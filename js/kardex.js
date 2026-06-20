function kardexFmtQtd(n) {
  return Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function kardexFmtMoeda(n) {
  return 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function kardexDateOnly(value) {
  return value ? String(value).slice(0,10) : '';
}

function kardexRange() {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  if(kardexPeriodo === 'semana') return { inicio: fmt(new Date(hoje.getTime()-6*864e5)), fim: fmt(hoje) };
  if(kardexPeriodo === 'mes') return { inicio: fmt(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), fim: fmt(hoje) };
  if(kardexPeriodo === 'ano') return { inicio: fmt(new Date(hoje.getFullYear(), 0, 1)), fim: fmt(hoje) };
  if(kardexPeriodo === 'custom') return { inicio: kardexInicio || fmt(hoje), fim: kardexFim || fmt(hoje) };
  return { inicio: '', fim: '' };
}

async function carregarMovimentosKardex() {
  await loadCaches();
  const [compras, compraItens, vendas, vendaItens, ajustes] = await Promise.all([
    apiGet('compras?select=*&order=data_compra.asc'),
    apiGet('compra_itens?select=*&order=id_item_compra.asc'),
    apiGet('vendas?select=id_venda,codigo_venda,data_venda,data_entrega,status_entrega,id_cliente,clientes(nome_fantasia,razao_social)&order=data_venda.asc'),
    apiGet('venda_itens?select=id_venda,id_produto,quantidade,preco_unitario,subtotal'),
    apiGet('estoque_movimentacoes?select=*&order=data_movimentacao.asc')
  ]);

  const lista = [];
  const comprasMap = new Map((Array.isArray(compras)?compras:[]).map(c=>[Number(c.id_compra),c]));
  const vendasMap = new Map((Array.isArray(vendas)?vendas:[]).map(v=>[Number(v.id_venda),v]));

  (Array.isArray(compraItens)?compraItens:[]).forEach(item => {
    const compra = comprasMap.get(Number(item.id_compra));
    if(!compra) return;
    const fornecedor = cacheFornecedores.find(f=>Number(f.id_fornecedor)===Number(compra.id_fornecedor));
    const comum = {
      id_produto: Number(item.id_produto),
      data: compra.data_compra,
      documento: compra.codigo_compra || `Compra #${compra.id_compra}`,
      pessoa: fornecedor?.nome_fantasia || fornecedor?.razao_social || `Fornecedor #${compra.id_fornecedor}`,
      valor_unitario: Number(item.preco_entrada||0),
      valor_total: Number(item.subtotal||0),
      origem_id: compra.id_compra
    };
    if(compra.status_compra === 'LIBERADA') {
      lista.push({...comum, tipo:'ENTRADA', sinal:1, quantidade:Number(item.quantidade||0), descricao:'Compra liberada'});
    } else if(compra.status_compra === 'CANCELADA') {
      lista.push({...comum, tipo:'CANCELAMENTO COMPRA', sinal:-1, quantidade:Number(item.quantidade||0), descricao:'Compra cancelada'});
    } else {
      lista.push({...comum, tipo:'COMPRA PENDENTE', sinal:0, quantidade:Number(item.quantidade||0), descricao:'Aguardando liberação'});
    }
  });

  (Array.isArray(vendaItens)?vendaItens:[]).forEach(item => {
    const venda = vendasMap.get(Number(item.id_venda));
    if(!venda) return;
    const cliente = venda.clientes?.nome_fantasia || venda.clientes?.razao_social || `Cliente #${venda.id_cliente}`;
    const comum = {
      id_produto: Number(item.id_produto),
      data: venda.data_entrega || venda.data_venda,
      documento: venda.codigo_venda || `Venda #${venda.id_venda}`,
      pessoa: cliente,
      valor_unitario: Number(item.preco_unitario||0),
      valor_total: Number(item.subtotal||0),
      origem_id: venda.id_venda
    };
    if(venda.status_entrega === 'ENTREGUE') {
      lista.push({...comum, tipo:'VENDA', sinal:-1, quantidade:Number(item.quantidade||0), descricao:'Venda entregue'});
    } else if(venda.status_entrega === 'CANCELADO') {
      lista.push({...comum, tipo:'CANCELAMENTO VENDA', sinal:1, quantidade:Number(item.quantidade||0), descricao:'Venda cancelada'});
    } else {
      lista.push({...comum, tipo:'VENDA PENDENTE', sinal:0, quantidade:Number(item.quantidade||0), descricao:'Sem baixa de estoque'});
    }
  });

  (Array.isArray(ajustes)?ajustes:[]).forEach(a => {
    const entrada = a.tipo_movimentacao === 'ENTRADA_AJUSTE';
    lista.push({
      id_produto: Number(a.id_produto),
      data: a.data_movimentacao,
      tipo: entrada ? 'AJUSTE ENTRADA' : 'AJUSTE SAÍDA',
      sinal: entrada ? 1 : -1,
      quantidade: Number(a.quantidade||0),
      documento: `Ajuste #${a.id_movimentacao}`,
      pessoa: a.origem || 'AJUSTE_MANUAL',
      valor_unitario: 0,
      valor_total: 0,
      descricao: a.observacoes || 'Ajuste manual',
      origem_id: a.id_movimentacao
    });
  });

  return lista.sort((a,b)=>String(a.data||'').localeCompare(String(b.data||'')));
}

async function renderKardex(produtoSelecionado=0) {
  if(produtoSelecionado) kardexProdutoId = String(produtoSelecionado);
  await loadCaches();
  const body = document.getElementById('content-body');
  body.innerHTML = '<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando Kardex...</div>';

  const movimentos = await carregarMovimentosKardex();
  const range = kardexRange();
  const idProduto = String(kardexProdutoId||'');
  const movFiltrados = movimentos.filter(m => {
    const data = kardexDateOnly(m.data);
    if(idProduto && String(m.id_produto)!==idProduto) return false;
    if(range.inicio && data < range.inicio) return false;
    if(range.fim && data > range.fim) return false;
    return true;
  });

  const produto = cacheProdutos.find(p=>String(p.id_produto)===idProduto);
  const entradas = movFiltrados.filter(m=>m.sinal>0).reduce((s,m)=>s+Number(m.quantidade||0),0);
  const saidas = movFiltrados.filter(m=>m.sinal<0).reduce((s,m)=>s+Number(m.quantidade||0),0);
  const pendentes = movFiltrados.filter(m=>m.sinal===0).length;
  let saldo = 0;
  const prodOpts = cacheProdutos.map(p=>`<option value="${p.id_produto}" ${String(p.id_produto)===idProduto?'selected':''}>${p.nome_mercadoria}</option>`).join('');

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
      <span style="font-size:15px;font-weight:600;">Kardex / Conferência de Estoque</span>
      <span style="font-size:12px;color:var(--text2);margin-left:auto;">${produto ? produto.nome_mercadoria : 'Todos os produtos'}</span>
    </div>

    <div class="dash-chart-box" style="margin-bottom:14px;padding:12px;">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;align-items:end;">
        <div class="form-group">
          <label class="form-label">Produto</label>
          <select class="form-input form-select" id="kardex-produto" onchange="kardexProdutoId=this.value;renderKardex()">
            <option value="">Todos</option>${prodOpts}
          </select>
        </div>
        <button class="dash-period-btn ${kardexPeriodo==='semana'?'active':''}" onclick="setKardexPeriodo('semana')">Semana</button>
        <button class="dash-period-btn ${kardexPeriodo==='mes'?'active':''}" onclick="setKardexPeriodo('mes')">Mês</button>
        <button class="dash-period-btn ${kardexPeriodo==='ano'?'active':''}" onclick="setKardexPeriodo('ano')">Ano</button>
        <button class="dash-period-btn ${kardexPeriodo==='todos'?'active':''}" onclick="setKardexPeriodo('todos')">Todos</button>
        <div class="form-group"><label class="form-label">Início</label><input class="form-input" type="date" id="kardex-inicio" value="${range.inicio}"/></div>
        <div class="form-group"><label class="form-label">Fim</label><input class="form-input" type="date" id="kardex-fim" value="${range.fim}"/></div>
        <button class="btn btn-primary" onclick="aplicarKardexPeriodoCustom()">Aplicar período</button>
      </div>
    </div>

    <div class="dash-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:14px;">
      <div class="dash-card green" style="cursor:default;"><div class="dash-card-label">Entradas</div><div class="dash-card-value" style="font-size:22px;">${kardexFmtQtd(entradas)}</div></div>
      <div class="dash-card red" style="cursor:default;"><div class="dash-card-label">Saídas</div><div class="dash-card-value" style="font-size:22px;">${kardexFmtQtd(saidas)}</div></div>
      <div class="dash-card blue" style="cursor:default;"><div class="dash-card-label">Saldo Período</div><div class="dash-card-value" style="font-size:22px;">${kardexFmtQtd(entradas-saidas)}</div></div>
      <div class="dash-card orange" style="cursor:default;"><div class="dash-card-label">Pendências</div><div class="dash-card-value" style="font-size:22px;">${pendentes}</div></div>
    </div>

    <div class="dash-chart-box" style="overflow:auto;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:940px;">
        <thead><tr style="background:var(--surface2);">
          <th style="padding:9px;text-align:left;color:var(--text2);font-weight:500;">Data</th>
          <th style="padding:9px;text-align:left;color:var(--text2);font-weight:500;">Produto</th>
          <th style="padding:9px;text-align:left;color:var(--text2);font-weight:500;">Tipo</th>
          <th style="padding:9px;text-align:left;color:var(--text2);font-weight:500;">Documento</th>
          <th style="padding:9px;text-align:left;color:var(--text2);font-weight:500;">Cliente/Fornecedor</th>
          <th style="padding:9px;text-align:right;color:var(--text2);font-weight:500;">Entrada</th>
          <th style="padding:9px;text-align:right;color:var(--text2);font-weight:500;">Saída</th>
          <th style="padding:9px;text-align:right;color:var(--text2);font-weight:500;">Saldo</th>
          <th style="padding:9px;text-align:right;color:var(--text2);font-weight:500;">Valor</th>
        </tr></thead>
        <tbody>
          ${movFiltrados.length ? movFiltrados.map(m=>{
            const p = cacheProdutos.find(x=>Number(x.id_produto)===Number(m.id_produto));
            saldo += Number(m.quantidade||0) * Number(m.sinal||0);
            const entrada = m.sinal>0 ? kardexFmtQtd(m.quantidade) : '';
            const saida = m.sinal<0 ? kardexFmtQtd(m.quantidade) : '';
            const cor = m.sinal>0 ? 'var(--accent)' : m.sinal<0 ? 'var(--danger)' : 'var(--text3)';
            return `<tr style="border-top:1px solid var(--border);">
              <td style="padding:9px;color:var(--text2);">${m.data?new Date(m.data).toLocaleDateString('pt-BR'):'-'}</td>
              <td style="padding:9px;">${p?.nome_mercadoria||`Produto #${m.id_produto}`}</td>
              <td style="padding:9px;color:${cor};font-weight:700;">${m.tipo}</td>
              <td style="padding:9px;font-family:var(--mono);color:var(--accent2);">${m.documento}</td>
              <td style="padding:9px;color:var(--text2);">${m.pessoa||'-'}</td>
              <td style="padding:9px;text-align:right;font-family:var(--mono);color:var(--accent);">${entrada}</td>
              <td style="padding:9px;text-align:right;font-family:var(--mono);color:var(--danger);">${saida}</td>
              <td style="padding:9px;text-align:right;font-family:var(--mono);font-weight:700;">${idProduto?kardexFmtQtd(saldo):'-'}</td>
              <td style="padding:9px;text-align:right;font-family:var(--mono);">${m.valor_total?kardexFmtMoeda(m.valor_total):'-'}</td>
            </tr>`;
          }).join('') : '<tr><td colspan="9" style="padding:22px;text-align:center;color:var(--text3);">Nenhum movimento encontrado</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function setKardexPeriodo(periodo) {
  kardexPeriodo = periodo;
  renderKardex();
}

function aplicarKardexPeriodoCustom() {
  kardexPeriodo = 'custom';
  kardexInicio = document.getElementById('kardex-inicio')?.value || '';
  kardexFim = document.getElementById('kardex-fim')?.value || '';
  renderKardex();
}
