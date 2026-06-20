let itensCompraAtual = [];
let chartCompras = null;

function compraFmt(n) {
  return 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

async function renderDashboardCompras() {
  const body = document.getElementById('content-body');
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

async function renderFormCompra(c) {
  await loadCaches();
  await loadCacheCobrancas();

  itensCompraAtual = c?.id_compra ? await carregarItensCompra(c.id_compra) : [];

  const v = f => c ? (c[f]??'') : '';
  const status = (v('status_compra') || 'PENDENTE').toUpperCase();
  const bloqueado = status === 'LIBERADA' || status === 'CANCELADA';
  const codigo = isNew ? await gerarCodigoCompra() : v('codigo_compra');
  const fornOpts = cacheFornecedores.map(f=>`<option value="${f.id_fornecedor}" ${String(v('id_fornecedor'))===String(f.id_fornecedor)?'selected':''}>${f.nome_fantasia||f.razao_social}</option>`).join('');
  const prodOpts = cacheProdutos.map(p=>`<option value="${p.id_produto}" data-custo="${Number(p.preco_custo||0)}" data-venda="${Number(p.preco_venda||0)}" data-estoque="${Number(p.estoque_atual||0)}">${p.nome_mercadoria}</option>`).join('');
  const pagOpts = cacheCobrancas.map(t=>`<option value="${t.descricao}" ${v('meio_pagamento')===t.descricao?'selected':''}>${t.descricao}</option>`).join('');
  const dataCompra = compraDateTimeInput(v('data_compra'));
  const prazo = v('prazo_dias') || 0;
  const vencimento = v('data_vencimento') || compraAddDays(dataCompra.slice(0,10), prazo);

  document.getElementById('content-body').innerHTML = `
    <div class="section-label"><span>Entrada de Compra</span><span class="pill ${status==='LIBERADA'?'on':status==='CANCELADA'?'off':'warn'}">${status}</span></div>
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
        <label class="form-label">Prazo (dias)</label>
        <input class="form-input" type="number" min="0" step="1" id="f-prazo_dias" value="${prazo}" oninput="calcularVencimentoCompra()" ${bloqueado?'disabled':''}/>
      </div>
      <div class="form-group">
        <label class="form-label">Vencimento</label>
        <input class="form-input" type="date" id="f-data_vencimento" value="${vencimento}" ${bloqueado?'disabled':''}/>
      </div>
      <div class="form-group">
        <label class="form-label">Total da Compra</label>
        <input class="form-input" id="f-total_compra" value="${compraFmt(v('valor_total')||totalCompraAtual())}" readonly style="color:var(--accent);font-weight:700;"/>
      </div>
    </div>

    <div class="section-label"><span>Itens da Compra</span></div>
    ${!bloqueado?`
      <div class="venda-panel">
        <div class="form-grid" style="margin-bottom:10px;">
          <div class="form-group full">
            <label class="form-label">Produto</label>
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
        <button class="btn btn-primary" style="width:100%;" onclick="adicionarItemCompra()">+ Adicionar Produto</button>
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

  const existente = itensCompraAtual.find(i=>Number(i.id_produto)===idProduto);
  if(existente) {
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
  renderItensCompra();
}

function removerItemCompra(idx) {
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
              : `<button class="btn btn-danger" style="padding:4px 8px;font-size:11px;" onclick="removerItemCompra(${idx})">Remover</button>`}</td>
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
  return {
    codigo_compra: document.getElementById('f-codigo_compra').value.trim(),
    id_fornecedor: Number(document.getElementById('f-id_fornecedor').value),
    data_compra: new Date(document.getElementById('f-data_compra').value).toISOString(),
    valor_total: Number(totalCompraAtual().toFixed(2)),
    meio_pagamento: document.getElementById('f-meio_pagamento').value || null,
    prazo_dias: Math.max(0, parseInt(document.getElementById('f-prazo_dias').value||'0',10)||0),
    data_vencimento: document.getElementById('f-data_vencimento').value || null,
    observacoes: document.getElementById('f-observacoes').value.trim() || null,
    id_produto: itensCompraAtual[0]?.id_produto || null,
    quantidade: itensCompraAtual.reduce((s,i)=>s+Number(i.quantidade||0),0) || null,
    preco_entrada: itensCompraAtual[0]?.preco_entrada || null
  };
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
  if(!document.getElementById('f-data_compra')?.value){ toast('Informe a data','error'); return; }
  if(!itensCompraAtual.length){ toast('Adicione pelo menos um produto','error'); return; }

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
    await loadItems();
    openItem(n.id_compra);
  } else {
    const compra = items.find(x=>Number(x.id_compra)===Number(currentId));
    if(compra?.status_compra === 'LIBERADA') { toast('Reabra a compra antes de alterar.','error'); return; }
    const res = await apiPatch(`compras?id_compra=eq.${currentId}`,data);
    if(!res.ok){ toast('Erro ao salvar compra: '+(res.data?.message||'erro'),'error'); if(btn){btn.disabled=false;btn.textContent='✓ Salvar Alterações';} return; }
    const itensRes = await salvarItensCompra(currentId);
    if(!itensRes.ok){ toast('Erro ao salvar itens: '+(itensRes.data?.message||'erro'),'error'); if(btn){btn.disabled=false;btn.textContent='✓ Salvar Alterações';} return; }
    toast('Compra atualizada.','success');
    await loadItems();
    openItem(currentId);
  }
}

async function abrirLiberacaoCompra(idCompra) {
  await loadCaches();
  const compra = items.find(x=>Number(x.id_compra)===Number(idCompra));
  if(!compra){ toast('Compra não encontrada.','error'); return; }
  itensCompraAtual = await carregarItensCompra(idCompra);
  if(!itensCompraAtual.length){ toast('Adicione produtos antes de liberar.','error'); return; }
  const venc = compra.data_vencimento || compraAddDays((compra.data_compra||'').slice(0,10), compra.prazo_dias||0);
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
            <div class="form-group"><label class="form-label">Vencimento</label><input class="form-input" type="date" id="lib-vencimento" value="${venc}"/></div>
            <div class="form-group"><label class="form-label">Meio</label><input class="form-input" id="lib-meio" value="${compra.meio_pagamento||''}" placeholder="Ex: PIX, BOLETO..."/></div>
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
                  <td style="padding:8px;"><input class="form-input" type="number" step="0.01" id="lib-custo-${i.id_produto}" value="${Number(i.preco_entrada||prod.preco_custo||0).toFixed(2)}"/></td>
                  <td style="padding:8px;"><input class="form-input" type="number" step="0.01" id="lib-venda-${i.id_produto}" value="${Number(prod.preco_venda||0).toFixed(2)}"/></td>
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
  const backups = [];

  for(const item of itens) {
    const produto = await getProdutoEstoque(item.id_produto);
    if(!produto){ toast(`Produto ${item.nome_produto} não encontrado.`,'error'); return; }
    const estoqueAnterior = Number(produto.estoque_atual||0);
    const estoqueAtual = estoqueAnterior + Number(item.quantidade||0);
    const precoCusto = Number(document.getElementById(`lib-custo-${item.id_produto}`)?.value||item.preco_entrada||0);
    const precoVenda = Number(document.getElementById(`lib-venda-${item.id_produto}`)?.value||0);
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
    backups.push({id_produto:item.id_produto, estoque_anterior:estoqueAnterior});
    await apiPatch(`compra_itens?id_item_compra=eq.${item.id_item_compra}`,{
      estoque_anterior: estoqueAnterior,
      estoque_atual: estoqueAtual,
      preco_custo_atualizado: precoCusto,
      preco_venda_atualizado: precoVenda
    });
  }

  const vencimento = document.getElementById('lib-vencimento').value || compra.data_vencimento || null;
  const meio = document.getElementById('lib-meio').value || compra.meio_pagamento || null;
  const compraRes = await apiPatch(`compras?id_compra=eq.${idCompra}`,{
    status_compra:'LIBERADA',
    data_vencimento: vencimento,
    meio_pagamento: meio
  });
  if(!compraRes.ok) {
    for(const b of backups) await apiPatch(`produtos?id_produto=eq.${b.id_produto}`,{estoque_atual:b.estoque_anterior});
    toast('Erro ao liberar compra. Estoque restaurado. '+(compraRes.data?.message||''),'error');
    return;
  }

  await apiDelete(`contas_pagar?id_compra=eq.${idCompra}`);
  const contaRes = await apiPost('contas_pagar',{
    id_compra: idCompra,
    id_fornecedor: compra.id_fornecedor,
    data_vencimento: vencimento,
    valor_original: compra.valor_total,
    meio_pagamento: meio,
    status_pagamento: 'PENDENTE',
    observacoes: `Compra ${compra.codigo_compra||'#'+idCompra}`
  });
  if(!contaRes.ok) {
    for(const b of backups) await apiPatch(`produtos?id_produto=eq.${b.id_produto}`,{estoque_atual:b.estoque_anterior});
    await apiPatch(`compras?id_compra=eq.${idCompra}`,{status_compra:'PENDENTE'});
    toast('Erro ao gerar conta a pagar. Entrada desfeita. '+(contaRes.data?.message||''),'error');
    return;
  }

  document.getElementById('compra-liberar-modal')?.remove();
  toast('Entrada liberada, estoques atualizados e conta a pagar gerada.','success');
  await loadCaches();
  await loadItems();
  openItem(idCompra);
}

async function desfazerLiberacaoCompra(compra) {
  await apiDelete(`contas_pagar?id_compra=eq.${compra.id_compra}`);
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
  await loadCaches();
  const v = f => c ? (c[f]??'') : '';
  const forn = cacheFornecedores.find(f=>Number(f.id_fornecedor)===Number(c?.id_fornecedor));
  const statusOpts = ['PENDENTE','PAGO','CANCELADO'].map(s=>`<option value="${s}" ${v('status_pagamento')===s?'selected':''}>${s}</option>`).join('');
  document.getElementById('content-body').innerHTML = `
    <div class="section-label"><span>Conta a Pagar</span></div>
    <div class="form-grid">
      <div class="form-group full"><label class="form-label">Fornecedor</label><input class="form-input" value="${forn?.nome_fantasia||forn?.razao_social||''}" readonly/></div>
      <div class="form-group"><label class="form-label">Status</label><select class="form-input form-select" id="f-status_pagamento">${statusOpts}</select></div>
      <div class="form-group"><label class="form-label">Valor Original</label><input class="form-input" type="number" step="0.01" id="f-valor_original" value="${v('valor_original')}"/></div>
      <div class="form-group"><label class="form-label">Valor Pago</label><input class="form-input" type="number" step="0.01" id="f-valor_pago" value="${v('valor_pago')}"/></div>
      <div class="form-group"><label class="form-label">Meio de Pagamento</label><input class="form-input" id="f-meio_pagamento" value="${v('meio_pagamento')}"/></div>
      <div class="form-group"><label class="form-label">Vencimento</label><input class="form-input" type="date" id="f-data_vencimento" value="${v('data_vencimento')}"/></div>
      <div class="form-group"><label class="form-label">Data de Pagamento</label><input class="form-input" type="datetime-local" id="f-data_pagamento" value="${v('data_pagamento')?String(v('data_pagamento')).slice(0,16):''}"/></div>
    </div>
    <div class="section-label"><span>Observações</span></div>
    <div class="form-group"><textarea class="form-textarea" id="f-observacoes">${v('observacoes')}</textarea></div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save" onclick="saveContaPagar()">✓ Salvar</button>
      ${c?.status_pagamento !== 'PAGO' ? `<button class="btn btn-primary" style="background:var(--accent2);" onclick="marcarContaPagarPaga()">Marcar Pago</button>` : '<span class="pill on" style="padding:8px 14px;font-size:12px;">Pago</span>'}
      <button class="btn btn-secondary" onclick="cancelForm()">Voltar</button>
    </div>`;
}

async function saveContaPagar() {
  const status = document.getElementById('f-status_pagamento').value;
  const dataPagamento = document.getElementById('f-data_pagamento').value;
  const data = {
    status_pagamento: status,
    valor_original: Number(document.getElementById('f-valor_original').value||0),
    valor_pago: Number(document.getElementById('f-valor_pago').value||0)||null,
    meio_pagamento: document.getElementById('f-meio_pagamento').value||null,
    data_vencimento: document.getElementById('f-data_vencimento').value||null,
    data_pagamento: dataPagamento ? new Date(dataPagamento).toISOString() : (status==='PAGO'?new Date().toISOString():null),
    observacoes: document.getElementById('f-observacoes').value.trim()||null
  };
  const res = await apiPatch(`contas_pagar?id_conta_pagar=eq.${currentId}`,data);
  if(!res.ok){ toast('Erro ao salvar conta: '+(res.data?.message||'erro'),'error'); return; }
  toast('Conta atualizada.','success');
  await loadItems();
  openItem(currentId);
}

async function marcarContaPagarPaga() {
  const valor = Number(document.getElementById('f-valor_pago')?.value||0) || Number(document.getElementById('f-valor_original')?.value||0);
  const res = await apiPatch(`contas_pagar?id_conta_pagar=eq.${currentId}`,{
    status_pagamento:'PAGO',
    valor_pago: valor,
    data_pagamento: new Date().toISOString(),
    meio_pagamento: document.getElementById('f-meio_pagamento')?.value||null
  });
  if(!res.ok){ toast('Erro ao marcar como pago.','error'); return; }
  toast('Pagamento confirmado.','success');
  await loadItems();
  openItem(currentId);
}
