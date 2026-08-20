
let itemVendaEmEdicao = null;
let itensVendaEditaveis = true;

async function renderDashboard() {
  const body = document.getElementById('content-body');
  body.innerHTML = '<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando dashboard...</div>';

  // Buscar dados
  const hoje = new Date();
  const fmtDataLocal = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const dataVendaLocal = venda => venda?.data_venda ? fmtDataLocal(new Date(venda.data_venda)) : '';
  const inicioHoje = fmtDataLocal(hoje);
  const inicioSemana = fmtDataLocal(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()-6));
  const mesRef = new Date(hoje.getFullYear(), hoje.getMonth() + dashMesOffset, 1);
  const inicioMesRef = fmtDataLocal(mesRef);
  const fimMesRef = fmtDataLocal(new Date(mesRef.getFullYear(), mesRef.getMonth()+1, 1));
  const mesAnteriorRef = new Date(mesRef.getFullYear(), mesRef.getMonth()-1, 1);
  const inicioMesAnterior = fmtDataLocal(mesAnteriorRef);
  const fimMesAnterior = inicioMesRef;
  const labelMesRef = mesRef.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});

  const [todasVendas, itensTodos] = await Promise.all([
    apiGet('vendas?select=id_venda,codigo_venda,data_venda,valor_final,valor_produtos,status_entrega,id_cliente,clientes(nome_fantasia,razao_social)&order=data_venda.desc'),
    apiGet('venda_itens?select=id_venda,id_produto,quantidade,subtotal,produtos!fk_item_produto(nome_mercadoria)')
  ]);

  if(!Array.isArray(todasVendas)) { body.innerHTML='<div class="empty-state"><div class="empty-icon">⚠️</div><p>Erro ao carregar dados</p></div>'; return; }

  const itens = Array.isArray(itensTodos) ? itensTodos : [];

  // Calcular totais
  const vendasHoje = todasVendas.filter(v => dataVendaLocal(v) === inicioHoje);
  const vendasSemana = todasVendas.filter(v => dataVendaLocal(v) >= inicioSemana);
  const vendasMes = todasVendas.filter(v => {
    const d = dataVendaLocal(v);
    return d >= inicioMesRef && d < fimMesRef;
  });
  const vendasMesAnterior = todasVendas.filter(v => {
    const d = dataVendaLocal(v);
    return d >= inicioMesAnterior && d < fimMesAnterior;
  });
  const pendentes = todasVendas.filter(v => v.status_entrega !== 'ENTREGUE' && v.status_entrega !== 'CANCELADO');

  const soma = arr => arr.reduce((s,v) => s + Number(v.valor_final||0), 0);
  const resumoStatus = vendas => {
    const entregues = vendas.filter(v => v.status_entrega === 'ENTREGUE');
    const pendentes = vendas.filter(v => v.status_entrega !== 'ENTREGUE' && v.status_entrega !== 'CANCELADO');
    return { entregues, pendentes, ativas: [...entregues, ...pendentes] };
  };
  const resumoHoje = resumoStatus(vendasHoje);
  const resumoSemana = resumoStatus(vendasSemana);
  const resumoMes = resumoStatus(vendasMes);
  const resumoMesAnterior = resumoStatus(vendasMesAnterior);
  const variacaoMes = soma(resumoMesAnterior.ativas) > 0 ? ((soma(resumoMes.ativas)-soma(resumoMesAnterior.ativas))/soma(resumoMesAnterior.ativas)*100) : null;
  const fmt = n => 'R$ ' + Number(n).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const linhasStatus = resumo => `
    <div style="display:grid;gap:5px;margin-top:8px;padding-top:7px;border-top:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:11px;">
        <span style="color:var(--accent);font-weight:700;">Entregues (${resumo.entregues.length})</span>
        <span style="font-weight:700;font-family:var(--mono);">${fmt(soma(resumo.entregues))}</span>
      </div>
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:11px;">
        <span style="color:var(--warn);font-weight:700;">Aguardando entrega (${resumo.pendentes.length})</span>
        <span style="font-weight:700;font-family:var(--mono);">${fmt(soma(resumo.pendentes))}</span>
      </div>
    </div>`;

  // Rankings de clientes e produtos por mes ou ano selecionado
  const anosRanking = [...new Set(todasVendas.map(v => {
    const data=dataVendaLocal(v);
    return data ? Number(data.slice(0,4)) : null;
  }).filter(Boolean))].sort((a,b)=>b-a);
  if(!anosRanking.includes(dashRankingAno)) anosRanking.push(dashRankingAno);
  anosRanking.sort((a,b)=>b-a);
  const vendasRanking = todasVendas.filter(v => {
    if(v.status_entrega==='CANCELADO') return false;
    const data=dataVendaLocal(v);
    if(!data || Number(data.slice(0,4))!==Number(dashRankingAno)) return false;
    return dashRankingModo==='ano' || Number(data.slice(5,7))-1===Number(dashRankingMes);
  });
  const vendasRankingIds = new Set(vendasRanking.map(v=>Number(v.id_venda)));
  const itensRanking = itens.filter(i=>vendasRankingIds.has(Number(i.id_venda)));
  const dataRanking = new Date(dashRankingAno, dashRankingMes, 1);
  const labelRanking = dashRankingModo==='ano'
    ? `Ano ${dashRankingAno}`
    : dataRanking.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});

  // Top clientes
  const clienteMap = {};
  vendasRanking.forEach(v => {
    const nome = v.clientes?.nome_fantasia || v.clientes?.razao_social || `Cliente #${v.id_cliente}`;
    if(!clienteMap[nome]) clienteMap[nome] = {nome, total:0, qtd:0, id:v.id_cliente};
    clienteMap[nome].total += Number(v.valor_final||0);
    clienteMap[nome].qtd++;
  });
  const topClientes = Object.values(clienteMap).sort((a,b)=>b.total-a.total).slice(0,5);

  // Top produtos
  const prodMap = {};
  itensRanking.forEach(i => {
    const nome = i.produtos?.nome_mercadoria || `Produto #${i.id_produto}`;
    if(!prodMap[nome]) prodMap[nome] = {nome, total:0, qtd:0, id:i.id_produto};
    prodMap[nome].total += Number(i.subtotal||0);
    prodMap[nome].qtd += Number(i.quantidade||0);
  });
  const topProdutos = Object.values(prodMap).sort((a,b)=>b.total-a.total).slice(0,5);

  // Dados para gráfico de linha (últimos N dias)
  const dias = parseInt(dashPeriodo);
  const labels = [], valores = [];
  for(let i=dias-1; i>=0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()-i);
    const ds = fmtDataLocal(d);
    const diaSemana=d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','');
    labels.push(`${diaSemana} ${d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}`);
    const total = todasVendas.filter(v=>dataVendaLocal(v)===ds).reduce((s,v)=>s+Number(v.valor_final||0),0);
    valores.push(total);
  }

  // Renderizar HTML
  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
      <button class="dash-period-btn" onclick="mudarMesDashboard(-1)">‹ Mês anterior</button>
      <button class="dash-period-btn ${dashMesOffset===0?'active':''}" onclick="irMesAtualDashboard()">Mês atual</button>
      <button class="dash-period-btn" onclick="mudarMesDashboard(1)" ${dashMesOffset>=0?'disabled style="opacity:.45;cursor:not-allowed;"':''}>Próximo mês ›</button>
      <button class="dash-period-btn" onclick="renderComparativoVendas()">Comparar meses</button>
      <span style="font-size:12px;color:var(--text2);font-family:var(--mono);margin-left:auto;text-transform:uppercase;">${labelMesRef}</span>
    </div>
    <!-- Cards de totais -->
    <div class="dash-grid">
      <div class="dash-card green" onclick="filtrarVendasDash('hoje')">
        <div class="dash-card-label">Vendas Hoje</div>
        <div class="dash-card-value" style="font-size:20px;line-height:1.15;">${fmt(soma(resumoHoje.ativas))}</div>
        ${linhasStatus(resumoHoje)}
      </div>
      <div class="dash-card blue" onclick="filtrarVendasDash('semana')">
        <div class="dash-card-label">Últimos 7 Dias</div>
        <div class="dash-card-value" style="font-size:20px;line-height:1.15;">${fmt(soma(resumoSemana.ativas))}</div>
        ${linhasStatus(resumoSemana)}
      </div>
      <div class="dash-card orange" onclick="filtrarVendasDash('mes')">
        <div class="dash-card-label">Mês Selecionado</div>
        <div class="dash-card-value" style="font-size:20px;line-height:1.15;">${fmt(soma(resumoMes.ativas))}</div>
        ${linhasStatus(resumoMes)}
        <div style="margin-top:6px;font-size:10px;color:var(--text2);display:flex;justify-content:space-between;gap:8px;">
          <span>Anterior ${fmt(soma(resumoMesAnterior.ativas))}</span>
          <span style="color:${variacaoMes===null?'var(--text3)':variacaoMes>=0?'var(--accent)':'var(--danger)'};">${variacaoMes===null?'sem base':(variacaoMes>=0?'+':'')+variacaoMes.toFixed(1)+'%'}</span>
        </div>
      </div>
      <div class="dash-card red" onclick="filtrarVendasDash('pendente')">
        <div class="dash-card-label">Vendas aguardando entrega</div>
        <div class="dash-card-value">${pendentes.length}</div>
        <div class="dash-card-sub">${fmt(soma(pendentes))}</div>
      </div>
    </div>

    <!-- Gráfico de vendas + Top Clientes -->
    <div class="dash-charts">
      <div class="dash-chart-box">
        <div class="dash-chart-title">
          <span>📈 Vendas por Período</span>
          <div class="dash-chart-period">
            <button class="dash-period-btn ${dashPeriodo==='7'?'active':''}" onclick="mudarPeriodo('7')">7d</button>
            <button class="dash-period-btn ${dashPeriodo==='15'?'active':''}" onclick="mudarPeriodo('15')">15d</button>
            <button class="dash-period-btn ${dashPeriodo==='30'?'active':''}" onclick="mudarPeriodo('30')">30d</button>
          </div>
        </div>
        <div class="dash-canvas-wrap"><canvas id="chart-vendas"></canvas></div>
      </div>

      <div class="dash-chart-box">
        <div class="dash-chart-title">
          <span>🏆 Melhores Clientes</span>
          <div class="dash-chart-period" style="flex-wrap:wrap;">
            <select class="dash-period-btn" aria-label="Período dos rankings" onchange="mudarPeriodoRanking(this.value, dashRankingAno, dashRankingMes)">
              <option value="mes" ${dashRankingModo==='mes'?'selected':''}>Mensal</option>
              <option value="ano" ${dashRankingModo==='ano'?'selected':''}>Anual</option>
            </select>
            ${dashRankingModo==='mes'?`<select class="dash-period-btn" aria-label="Mês dos rankings" onchange="mudarPeriodoRanking(dashRankingModo, dashRankingAno, this.value)">${Array.from({length:12},(_,mes)=>`<option value="${mes}" ${mes===Number(dashRankingMes)?'selected':''}>${new Date(2020,mes,1).toLocaleDateString('pt-BR',{month:'short'}).replace('.','')}</option>`).join('')}</select>`:''}
            <select class="dash-period-btn" aria-label="Ano dos rankings" onchange="mudarPeriodoRanking(dashRankingModo, this.value, dashRankingMes)">${anosRanking.map(ano=>`<option value="${ano}" ${ano===Number(dashRankingAno)?'selected':''}>${ano}</option>`).join('')}</select>
          </div>
        </div>
        <div class="dash-list" id="dash-clientes">
          ${topClientes.length === 0 ? '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;">Nenhum dado</div>' :
          topClientes.map((c,i) => {
            const pct = topClientes[0].total > 0 ? (c.total/topClientes[0].total*100).toFixed(0) : 0;
            return `<div class="dash-list-item" onclick="filtrarClienteDash(${c.id},'${c.nome.replace(/'/g,"\'")}')">
              <span class="dash-list-rank">${i+1}</span>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span class="dash-list-name">${c.nome}</span>
                  <span class="dash-list-value">${fmt(c.total)}</span>
                </div>
                <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${pct}%"></div></div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Top Produtos -->
    <div class="dash-chart-box" style="margin-bottom:20px;">
      <div class="dash-chart-title"><span>📦 Melhores Produtos</span><span style="font-size:11px;color:var(--text2);font-family:var(--mono);text-transform:capitalize;">${labelRanking}</span></div>
      <div class="dash-two-col" id="dash-produtos">
        ${topProdutos.length === 0 ? '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;grid-column:1/-1;">Nenhum dado</div>' :
        topProdutos.map((p,i) => {
          const pct = topProdutos[0].total > 0 ? (p.total/topProdutos[0].total*100).toFixed(0) : 0;
          return `<div class="dash-list-item" onclick="filtrarProdutoDash(${p.id},'${p.nome.replace(/'/g,"\'")}')">
            <span class="dash-list-rank">${i+1}</span>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span class="dash-list-name">${p.nome}</span>
                <span class="dash-list-value">${fmt(p.total)}</span>
              </div>
              <div style="font-size:11px;color:var(--text2);">${p.qtd.toFixed(1)} un vendidas</div>
              <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${pct}%;background:var(--accent2)"></div></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  // Renderizar gráfico
  setTimeout(() => {
    const ctx = document.getElementById('chart-vendas');
    if(!ctx) return;
    if(chartVendas) chartVendas.destroy();
    chartVendas = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Vendas (R$)',
          data: valores,
          borderColor: '#00e5a0',
          backgroundColor: 'rgba(0,229,160,0.08)',
          borderWidth: 2,
          pointBackgroundColor: '#00e5a0',
          pointRadius: 4,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => 'R$ ' + Number(ctx.raw).toLocaleString('pt-BR',{minimumFractionDigits:2})
            }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8888a0', font: { size: 11 } } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8888a0', font: { size: 11 }, callback: v => 'R$ '+Number(v).toLocaleString('pt-BR') } }
        }
      }
    });
  }, 100);
}

async function mudarPeriodo(p) {
  dashPeriodo = p;
  await renderDashboard();
}

async function mudarPeriodoRanking(modo, ano, mes) {
  dashRankingModo=modo==='ano'?'ano':'mes';
  dashRankingAno=Number(ano)||new Date().getFullYear();
  dashRankingMes=Math.max(0,Math.min(11,Number(mes)));
  await renderDashboard();
}

async function mudarMesDashboard(delta) {
  dashMesOffset += delta;
  if(dashMesOffset > 0) dashMesOffset = 0;
  await renderDashboard();
}

async function irMesAtualDashboard() {
  dashMesOffset = 0;
  await renderDashboard();
}

function buildMesesComparativo(vendas, modo, ano, mesesQtd) {
  const fmtKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const meses = [];

  if(modo === 'ano') {
    for(let m=0; m<12; m++) meses.push(new Date(ano, m, 1));
  } else {
    const fim = new Date();
    fim.setDate(1);
    for(let i=Math.max(1, mesesQtd)-1; i>=0; i--) {
      meses.push(new Date(fim.getFullYear(), fim.getMonth()-i, 1));
    }
  }

  return meses.map((mes, idx) => {
    const key = fmtKey(mes);
    const lista = vendas.filter(v => (v.data_venda||'').slice(0,7) === key);
    const total = lista.reduce((s,v)=>s+Number(v.valor_final||0),0);
    const custo = lista.reduce((s,v)=>s+Number(v.valor_produtos||0),0);
    const lucroMes = total - custo;
    const anterior = idx > 0 ? meses[idx-1] : new Date(mes.getFullYear(), mes.getMonth()-1, 1);
    const keyAnterior = fmtKey(anterior);
    const listaAnterior = vendas.filter(v => (v.data_venda||'').slice(0,7) === keyAnterior);
    const totalAnterior = listaAnterior.reduce((s,v)=>s+Number(v.valor_final||0),0);
    const variacao = totalAnterior > 0 ? ((total-totalAnterior)/totalAnterior*100) : null;
    return {
      key,
      label: mes.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}),
      labelLongo: mes.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}),
      total,
      custo,
      lucro: lucroMes,
      qtd: lista.length,
      variacao
    };
  });
}

async function renderComparativoVendas() {
  const body = document.getElementById('content-body');
  body.innerHTML = '<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando comparativo...</div>';

  const vendas = await apiGet('vendas?select=id_venda,codigo_venda,data_venda,valor_final,valor_produtos,status_entrega,id_cliente&order=data_venda.asc');
  if(!Array.isArray(vendas)) {
    body.innerHTML = '<div class="empty-state"><div class="empty-icon">!</div><p>Erro ao carregar vendas</p></div>';
    return;
  }

  const anos = [...new Set(vendas.map(v => v.data_venda ? new Date(v.data_venda).getFullYear() : null).filter(Boolean))].sort((a,b)=>b-a);
  if(!anos.includes(dashComparativoAno)) anos.unshift(dashComparativoAno);
  const mesesQtd = Math.max(1, Math.min(60, Number(dashComparativoMeses||12)));
  dashComparativoMeses = mesesQtd;
  const dados = buildMesesComparativo(vendas, dashComparativoModo, dashComparativoAno, mesesQtd);
  const total = dados.reduce((s,m)=>s+m.total,0);
  const lucroTotal = dados.reduce((s,m)=>s+m.lucro,0);
  const qtdTotal = dados.reduce((s,m)=>s+m.qtd,0);
  const ticketMedio = qtdTotal ? total / qtdTotal : 0;
  const melhorMes = [...dados].sort((a,b)=>b.total-a.total)[0];
  const fmt = n => 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtPct = n => n === null ? '-' : `${n>=0?'+':''}${n.toFixed(1)}%`;

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
      <button onclick="renderDashboard()" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--text2);font-size:12px;padding:6px 12px;cursor:pointer;">← Voltar</button>
      <span style="font-size:15px;font-weight:600;">Comparativo de Vendas</span>
      <span style="font-size:12px;color:var(--text2);margin-left:auto;">${dashComparativoModo==='ano' ? 'Ano '+dashComparativoAno : 'Últimos '+mesesQtd+' meses'}</span>
    </div>

    <div class="dash-chart-box" style="margin-bottom:14px;padding:12px;">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;align-items:end;">
        <div class="form-group">
          <label class="form-label">Últimos meses</label>
          <input class="form-input" type="number" min="1" max="60" step="1" id="dash-comp-meses" value="${mesesQtd}"/>
        </div>
        <div class="form-group">
          <label class="form-label">Ano</label>
          <select class="form-input form-select" id="dash-comp-ano">
            ${anos.map(a=>`<option value="${a}" ${Number(a)===Number(dashComparativoAno)?'selected':''}>${a}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary" onclick="aplicarComparativoVendas('ultimos')">Ver últimos meses</button>
        <button class="btn btn-secondary" onclick="aplicarComparativoVendas('ano')">Ver ano todo</button>
      </div>
    </div>

    <div class="dash-grid" style="grid-template-columns:repeat(auto-fit,minmax(145px,1fr));margin-bottom:14px;">
      <div class="dash-card green" style="cursor:default;"><div class="dash-card-label">Vendido</div><div class="dash-card-value" style="font-size:20px;">${fmt(total)}</div><div class="dash-card-sub">${qtdTotal} pedido${qtdTotal!==1?'s':''}</div></div>
      <div class="dash-card blue" style="cursor:default;"><div class="dash-card-label">Lucro</div><div class="dash-card-value" style="font-size:20px;color:${lucroTotal>=0?'var(--accent)':'var(--danger)'};">${fmt(lucroTotal)}</div><div class="dash-card-sub">Margem ${total>0?(lucroTotal/total*100).toFixed(1):'0.0'}%</div></div>
      <div class="dash-card orange" style="cursor:default;"><div class="dash-card-label">Ticket Médio</div><div class="dash-card-value" style="font-size:20px;">${fmt(ticketMedio)}</div><div class="dash-card-sub">por pedido</div></div>
      <div class="dash-card green" style="cursor:default;"><div class="dash-card-label">Melhor mês</div><div class="dash-card-value" style="font-size:17px;">${melhorMes?.labelLongo||'-'}</div><div class="dash-card-sub">${fmt(melhorMes?.total||0)}</div></div>
    </div>

    <div class="dash-chart-box" style="margin-bottom:14px;">
      <div class="dash-chart-title"><span>Vendas e Lucro por Mês</span></div>
      <div class="dash-canvas-wrap"><canvas id="chart-comparativo-vendas"></canvas></div>
    </div>

    <div class="dash-chart-box" style="margin-bottom:20px;overflow:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:620px;">
        <thead><tr style="background:var(--surface2);">
          <th style="padding:9px 10px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">Mês</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Pedidos</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Vendido</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Custo</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Lucro</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Variação</th>
        </tr></thead>
        <tbody>
          ${dados.map(m=>`<tr style="border-top:1px solid var(--border);">
            <td style="padding:9px 10px;text-transform:capitalize;">${m.labelLongo}</td>
            <td style="padding:9px 10px;text-align:right;color:var(--text2);">${m.qtd}</td>
            <td style="padding:9px 10px;text-align:right;font-family:var(--mono);color:var(--accent);">${fmt(m.total)}</td>
            <td style="padding:9px 10px;text-align:right;font-family:var(--mono);color:var(--text2);">${fmt(m.custo)}</td>
            <td style="padding:9px 10px;text-align:right;font-family:var(--mono);color:${m.lucro>=0?'var(--accent)':'var(--danger)'};">${fmt(m.lucro)}</td>
            <td style="padding:9px 10px;text-align:right;font-family:var(--mono);color:${m.variacao===null?'var(--text3)':m.variacao>=0?'var(--accent)':'var(--danger)'};">${fmtPct(m.variacao)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr style="border-top:2px solid var(--border);background:var(--surface2);">
          <td style="padding:9px 10px;font-weight:700;">Total</td>
          <td style="padding:9px 10px;text-align:right;font-weight:700;">${qtdTotal}</td>
          <td style="padding:9px 10px;text-align:right;font-family:var(--mono);font-weight:700;color:var(--accent);">${fmt(total)}</td>
          <td style="padding:9px 10px;text-align:right;font-family:var(--mono);font-weight:700;color:var(--text2);">${fmt(total-lucroTotal)}</td>
          <td style="padding:9px 10px;text-align:right;font-family:var(--mono);font-weight:700;color:${lucroTotal>=0?'var(--accent)':'var(--danger)'};">${fmt(lucroTotal)}</td>
          <td></td>
        </tr></tfoot>
      </table>
    </div>`;

  setTimeout(() => {
    const ctx = document.getElementById('chart-comparativo-vendas');
    if(!ctx) return;
    if(chartVendas) chartVendas.destroy();
    chartVendas = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dados.map(m=>m.label),
        datasets: [
          { label:'Vendido', data:dados.map(m=>m.total), backgroundColor:'rgba(0,229,160,.55)', borderWidth:0 },
          { label:'Lucro', data:dados.map(m=>m.lucro), backgroundColor:'rgba(0,122,255,.55)', borderWidth:0 }
        ]
      },
      options: {
        responsive:true,
        maintainAspectRatio:false,
        plugins:{
          legend:{ position:'bottom', labels:{ color:'#8888a0', font:{size:11}, padding:12 } },
          tooltip:{ callbacks:{ label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)}` } }
        },
        scales:{
          x:{ grid:{ color:'rgba(255,255,255,0.05)' }, ticks:{ color:'#8888a0', font:{size:11} } },
          y:{ grid:{ color:'rgba(255,255,255,0.05)' }, ticks:{ color:'#8888a0', font:{size:11}, callback:v=>'R$ '+Number(v).toLocaleString('pt-BR') } }
        }
      }
    });
  }, 100);
}

async function aplicarComparativoVendas(modo) {
  dashComparativoModo = modo;
  dashComparativoMeses = Math.max(1, Math.min(60, Number(document.getElementById('dash-comp-meses')?.value||12)));
  dashComparativoAno = Number(document.getElementById('dash-comp-ano')?.value||new Date().getFullYear());
  await renderComparativoVendas();
}

function filtrarVendasDash(filtro) {
  const fmtDataLocal = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const base = new Date();
  const dataVendaLocal = venda => venda?.data_venda ? fmtDataLocal(new Date(venda.data_venda)) : '';
  const hoje = fmtDataLocal(base);
  const semana = fmtDataLocal(new Date(base.getFullYear(), base.getMonth(), base.getDate()-6));
  const mesRef = new Date(base.getFullYear(), base.getMonth() + dashMesOffset, 1);
  const mes = fmtDataLocal(mesRef);
  const proxMes = fmtDataLocal(new Date(mesRef.getFullYear(), mesRef.getMonth()+1, 1));
  let vendFiltradas = [...items];
  let titulo = '';
  if(filtro==='hoje'){ vendFiltradas=items.filter(v=>dataVendaLocal(v)===hoje); titulo='Vendas de Hoje'; }
  else if(filtro==='semana'){ vendFiltradas=items.filter(v=>dataVendaLocal(v)>=semana); titulo='Vendas — Últimos 7 Dias'; }
  else if(filtro==='mes'){
    vendFiltradas=items.filter(v=>{
      const d = dataVendaLocal(v);
      return d>=mes && d<proxMes;
    });
    titulo='Vendas — '+mesRef.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  }
  else if(filtro==='pendente'){ vendFiltradas=items.filter(v=>v.status_entrega!=='ENTREGUE' && v.status_entrega!=='CANCELADO'); titulo='Vendas aguardando entrega'; }
  vendFiltradas = vendFiltradas.filter(v => v.status_entrega !== 'CANCELADO');
  mostrarDetalheVendas(vendFiltradas, titulo);
}

function filtrarClienteDash(idCliente, nome) {
  const filtradas = items.filter(v=>v.id_cliente===idCliente);
  mostrarDetalheVendas(filtradas, 'Vendas — '+nome);
}

function filtrarProdutoDash(idProduto, nome) {
  // Mostrar vendas que contém esse produto
  mostrarDetalheVendas(items, 'Produto: '+nome);
}

function mostrarDetalheVendas(vendas, titulo) {
  const fmt = n => 'R$ '+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const total = vendas.reduce((s,v)=>s+Number(v.valor_final||0),0);
  document.getElementById('content-body').innerHTML = `
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <button onclick="renderDashboard()" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--text2);font-size:12px;padding:5px 12px;cursor:pointer;">← Voltar</button>
      <span style="font-size:15px;font-weight:600;">${titulo}</span>
      <span style="font-size:12px;color:var(--text2);margin-left:auto;">${vendas.length} venda${vendas.length!==1?'s':''} · ${fmt(total)}</span>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:var(--surface2);">
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">Pedido</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">Cliente</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Data</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Status</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Valor</th>
        </tr></thead>
        <tbody>
          ${vendas.length === 0 ? '<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--text3);">Nenhuma venda encontrada</td></tr>' :
          vendas.map(v=>`<tr style="border-top:1px solid var(--border);cursor:pointer;" onclick="openItem(${v.id_venda})" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
            <td style="padding:10px 14px;font-weight:500;color:var(--accent);font-family:var(--mono);">${v.codigo_venda||'#'+v.id_venda}</td>
            <td style="padding:10px 14px;color:var(--text);">${v.clientes?.nome_fantasia||v.clientes?.razao_social||'-'}</td>
            <td style="padding:10px 14px;text-align:center;color:var(--text2);">${v.data_venda?new Date(v.data_venda).toLocaleDateString('pt-BR'):'-'}</td>
            <td style="padding:10px 14px;text-align:center;">
              <span class="pill ${v.status_entrega==='ENTREGUE'?'on':v.status_entrega==='CANCELADO'?'off':'warn'}">${v.status_entrega==='ENTREGUE'?'Entregue':v.status_entrega==='CANCELADO'?'Cancelado':'Pendente'}</span>
            </td>
            <td style="padding:10px 14px;text-align:right;font-weight:600;color:var(--accent);font-family:var(--mono);">${fmt(v.valor_final||0)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr style="border-top:2px solid var(--border);background:var(--surface2);">
          <td colspan="4" style="padding:10px 14px;font-weight:600;font-size:13px;">Total</td>
          <td style="padding:10px 14px;text-align:right;font-weight:700;color:var(--accent);font-family:var(--mono);">${fmt(total)}</td>
        </tr></tfoot>
      </table>
    </div>`;
}

// =====================
// VENDAS
// =====================

async function loadCacheCobrancas() {
  const r = await apiGet('tipo_cobranca?select=id_cobranca,descricao&order=descricao.asc');
  if(Array.isArray(r)) cacheCobrancas = ordenarCadastro(r,x=>x.descricao);
}

function pad2(n) {
  return String(n).padStart(2,'0');
}

function toLocalDateTimeInput(value) {
  const d = value ? new Date(value) : new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toLocalDateInput(value) {
  const d = value ? new Date(value) : new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

function localDateTimeToISO(value) {
  return value ? new Date(value).toISOString() : null;
}

function addDaysToDateInput(baseDate, days) {
  const d = baseDate ? new Date(`${baseDate}T00:00:00`) : new Date();
  d.setDate(d.getDate() + Number(days||0));
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

function syncEntregaComVenda(force=false) {
  const vendaEl = document.getElementById('f-data_venda');
  const entregaEl = document.getElementById('f-data_entrega');
  if(!vendaEl || !entregaEl) return;
  if(force || !entregaEl.value) entregaEl.value = vendaEl.value;
}

function calcularVencimentoVenda() {
  const vendaEl = document.getElementById('f-data_venda');
  const diasEl = document.getElementById('f-dias_vencimento');
  const vencEl = document.getElementById('f-data_vencimento');
  if(!vendaEl || !diasEl || !vencEl) return;
  const base = (vendaEl.value || toLocalDateTimeInput()).slice(0,10);
  vencEl.value = addDaysToDateInput(base, Number(diasEl.value||0));
}

function pagamentoVenceNaDataDaVenda(pagamento) {
  return ['PIX','DINHEIRO','CARTAO'].includes(String(pagamento||'').toUpperCase());
}

function formatarMoedaVenda(valor) {
  return 'R$ ' + Number(valor || 0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
}

function parseDataLocalVenda(value) {
  const raw = String(value || '').slice(0,10);
  if(!raw) return null;
  const [ano, mes, dia] = raw.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function verificarContasClienteVenda() {
  if(!isNew) return;
  const idCliente = document.getElementById('f-id_cliente')?.value;
  const alerta = document.getElementById('contas-cliente-alert');
  if(!idCliente || !alerta) return;

  try {
    const contas = await apiGet(`contas_receber?select=id_conta,valor_original,valor_recebido,status_recebimento,data_vencimento&id_cliente=eq.${idCliente}`);
    if(!Array.isArray(contas) || !contas.length) {
      alerta.style.display = 'none';
      alerta.innerHTML = '';
      return;
    }

    const hoje = new Date(); hoje.setHours(0,0,0,0);
    let vencido = 0;
    let aberto = 0;

    contas.forEach(conta => {
      const original = Number(conta.valor_original || 0);
      const recebido = Math.min(original, Math.max(0, Number(conta.valor_recebido || 0)));
      const saldo = Math.max(0, original - recebido);
      const status = String(conta.status_recebimento || '').toUpperCase();
      const estaAberto = saldo > 0.005 && status !== 'RECEBIDO';
      if(!estaAberto) return;
      aberto += saldo;
      if(conta.data_vencimento && parseDataLocalVenda(conta.data_vencimento) && parseDataLocalVenda(conta.data_vencimento) < hoje) {
        vencido += saldo;
      }
    });

    if(vencido <= 0.005 && aberto <= 0.005) {
      alerta.style.display = 'none';
      alerta.innerHTML = '';
      return;
    }

    alerta.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px;">⚠️ Cliente com contas a receber</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;font-size:12px;">
        ${vencido > 0.005 ? `<span style="color:var(--danger);">Vencidas: ${formatarMoedaVenda(vencido)}</span>` : ''}
        ${aberto > 0.005 ? `<span style="color:var(--warn);">Em aberto: ${formatarMoedaVenda(aberto)}</span>` : ''}
      </div>`;
    alerta.style.display = 'block';
  } catch (err) {
    alerta.style.display = 'none';
    alerta.innerHTML = '';
  }
}

async function renderFormVenda(c) {
  await loadCaches();
  await loadCacheCobrancas();
  itensVenda = [];
  itemVendaEmEdicao = null;
  itensVendaEditaveis = !c || c.status_entrega !== 'ENTREGUE';

  // Carregar itens existentes se for edição
  if(c) {
    const itens = await apiGet(`venda_itens?select=*,produtos!fk_item_produto(nome_mercadoria,id_produto,preco_custo,unidade,quantidade_fardo)&id_venda=eq.${c.id_venda}`);
    if(Array.isArray(itens)) {
      itensVenda = itens.map(i => ({
        id_item: i.id_item,
        id_produto: i.id_produto,
        nome_produto: i.produtos?.nome_mercadoria || '',
        unidade: i.produtos?.unidade || '',
        quantidade_fardo: i.produtos?.quantidade_fardo || null,
        quantidade: Number(i.quantidade),
        preco_unitario: Number(i.preco_unitario),
        desconto_item: Number(i.quantidade||0)>0?Number(i.desconto_item||0)/Number(i.quantidade):0,
        subtotal: Number(i.subtotal),
        preco_custo: Number(i.produtos?.preco_custo||0)
      }));
    }
  }

  const v = f => c ? (c[f]??'') : '';

  // Gerar próximo código automaticamente para nova venda
  let proximoCodigo = '';
  if(isNew) {
    const ref = new Date();
    const prefixo = `V${String(ref.getFullYear()).slice(-2)}${String(ref.getMonth()+1).padStart(2,'0')}-`;
    const vendasMes = await apiGet(`vendas?select=codigo_venda&codigo_venda=like.${prefixo}%25&order=codigo_venda.desc`);
    const nums = Array.isArray(vendasMes)
      ? vendasMes.map(v => {
        const m = String(v.codigo_venda||'').match(new RegExp('^'+prefixo+'(\\d{3})$'));
        return m ? parseInt(m[1],10) : 0;
      })
      : [];
    const num = nums.length ? Math.max(...nums) : 0;
    proximoCodigo = `${prefixo}${String(num+1).padStart(3,'0')}`;
  }

  const statusMap = {'PENDENTE':'Pendente','ENTREGUE':'Entregue'};
  const statusOpts = Object.entries(statusMap).map(([val,label]) =>
    `<option value="${val}" ${v('status_entrega')===val?'selected':''}>${label}</option>`).join('');
  let meioPagamentoPadrao = v('meio_pagamento');
  if(isNew) {
    const ultPag = await apiGet('vendas?select=meio_pagamento&meio_pagamento=not.is.null&order=id_venda.desc&limit=1');
    if(Array.isArray(ultPag) && ultPag.length > 0) meioPagamentoPadrao = ultPag[0].meio_pagamento || '';
  }
  const quantidadeParcelas = v('quantidade_parcelas') || 1;
  const diasVencimento = v('dias_vencimento') || 0;
  const dataVendaDefault = toLocalDateTimeInput(v('data_venda'));
  const dataEntregaDefault = v('data_entrega') ? toLocalDateTimeInput(v('data_entrega')) : dataVendaDefault;
  const dataVencimentoDefault = v('data_vencimento') || addDaysToDateInput(dataVendaDefault.slice(0,10), diasVencimento);
  const pagOpts = cacheCobrancas.map(t =>
    `<option value="${t.descricao}" ${meioPagamentoPadrao===t.descricao?'selected':''}>${t.descricao}</option>`).join('');
  const cliOpts = cacheClientes.map(cl => {
    const selecionado=String(v('id_cliente'))===String(cl.id_cliente);
    const inativo=cl.ativo===false;
    return `<option value="${cl.id_cliente}" ${selecionado?'selected':''} ${inativo&&!selecionado?'disabled':''}>${cl.nome_fantasia||cl.razao_social||'Cliente #'+cl.id_cliente}${inativo?' (inativo)':''}</option>`;
  }).join('');
  const entregaActions = isNew ? '' : c?.status_entrega === 'ENTREGUE'
    ? `<span class="pill on" style="padding:8px 14px;font-size:12px;">✅ Entregue</span><button class="btn btn-danger" onclick="cancelarEntrega(${c.id_venda})">Cancelar Entrega</button>`
    : `<button class="btn btn-primary" style="background:var(--accent2);" onclick="marcarEntregue(${c.id_venda})">✅ Marcar Entregue</button>`;
  const ticketAction = isNew ? '' : `<button class="btn btn-secondary" onclick="imprimirTicketVenda(${c.id_venda})">Imprimir Ticket</button>`;

  document.getElementById('content-body').innerHTML = `<div class="venda-form">
    <input type="hidden" id="f-codigo_venda" value="${isNew ? proximoCodigo : v('codigo_venda')}"/>
    <div class="section-label"><span>Dados da Venda</span></div>
    <div class="form-grid compact">
      <div class="form-group wide">
        <label class="form-label">Cliente *</label>
        <select class="form-input form-select" id="f-id_cliente" onchange="aplicarPadraoClienteVenda(true); verificarContasClienteVenda();">
          <option value="">Selecione o cliente...</option>
          ${cliOpts}
        </select>
        <div id="contas-cliente-alert" style="display:none;margin-top:8px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius);background:rgba(245,158,11,0.12);color:var(--text);"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Venda *</label>
        <input class="form-input" type="datetime-local" id="f-data_venda" value="${dataVendaDefault}" onchange="syncEntregaComVenda();calcularVencimentoVenda()"/>
      </div>
      <div class="form-group">
        <label class="form-label">Entrega</label>
        <input class="form-input" type="datetime-local" id="f-data_entrega" value="${dataEntregaDefault}"/>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-input form-select" id="f-status_entrega">
          ${statusOpts}
        </select>
      </div>
    </div>
    <div class="form-grid compact" style="margin-top:8px;">
      <div class="form-group">
        <label class="form-label">Pagamento</label>
        <select class="form-input form-select" id="f-meio_pagamento">
          <option value="">Selecione...</option>
          ${pagOpts}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Parcelas</label>
        <input class="form-input" type="number" min="1" step="1" id="f-quantidade_parcelas" value="${quantidadeParcelas}" oninput="calcularVencimentoVenda()"/>
      </div>
      <div class="form-group">
        <label class="form-label">Dias venc.</label>
        <input class="form-input" type="number" min="0" step="1" id="f-dias_vencimento" value="${diasVencimento}" oninput="calcularVencimentoVenda()"/>
      </div>
      <div class="form-group">
        <label class="form-label">Vencimento</label>
        <input class="form-input" type="date" id="f-data_vencimento" value="${dataVencimentoDefault}"/>
      </div>
    </div>

    <div class="section-label">
      <span>Itens do Pedido</span>
    </div>

    <!-- Adicionar item -->
    <div class="venda-panel">
      <div class="form-grid" style="margin-bottom:10px;">
        <div class="form-group full">
          <label class="form-label">Produto</label>
          ${abasCategoriasProdutosPedido('venda')}
          <select class="form-input form-select" id="item-produto" onchange="preencherPreco()">
            <option value="">Selecione o produto...</option>
            ${cacheProdutos.map(p=>`<option value="${p.id_produto}" data-preco="${p.preco_venda}">${p.nome_mercadoria} — R$ ${Number(p.preco_venda||0).toFixed(2)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Quantidade</label>
          <input class="form-input" type="text" inputmode="decimal" id="item-qty" value="1" placeholder="Ex.: 0,500" oninput="calcItemSubtotal()"/>
        </div>
        <div class="form-group">
          <label class="form-label">Preço Unitário (R$)</label>
          <input class="form-input" type="number" step="0.01" id="item-preco" value="" placeholder="0,00" oninput="calcItemSubtotal()"/>
        </div>
        <div class="form-group">
          <label class="form-label">Desconto por Unidade (R$)</label>
          <input class="form-input" type="number" step="0.01" id="item-desconto" value="0" oninput="calcItemSubtotal()"/>
        </div>
        <div class="form-group">
          <label class="form-label">Subtotal</label>
          <input class="form-input" id="item-subtotal" value="R$ 0,00" readonly style="color:var(--accent);font-weight:600;"/>
        </div>
      </div>
      <button class="btn btn-primary" id="btn-adicionar-item-venda" style="width:100%;" onclick="adicionarItem()">+ Adicionar Item</button>
    </div>

    <!-- Lista de itens -->
    <div id="lista-itens" style="margin-bottom:16px;"></div>

    <!-- Totais -->
    <div class="venda-totais">
      <div class="form-group" style="margin-bottom:14px;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;">
        <label class="form-label" for="f-desconto_total" style="font-size:12px;font-weight:700;">Desconto adicional no pedido (R$)</label>
        <input class="form-input" type="text" inputmode="decimal" id="f-desconto_total" value="${v('desconto_total')||'0'}" placeholder="Ex.: 20,00" oninput="calcTotais()" style="font-size:18px;font-weight:700;"/>
        <div style="font-size:11px;color:var(--text3);margin-top:5px;">Digite aqui o desconto dado sobre o pedido inteiro. Ele será somado aos descontos por unidade dos itens.</div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;color:var(--text2);">
        <span>Total bruto dos produtos:</span><span id="total-produtos">R$ 0,00</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;color:var(--text2);">
        <span>Descontos nos itens:</span><span id="total-desconto-itens" style="color:var(--danger);">- R$ 0,00</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;color:var(--text2);">
        <span>Desconto no pedido:</span><span id="total-desconto-pedido" style="color:var(--danger);">- R$ 0,00</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;font-weight:600;color:var(--text2);">
        <span>Desconto total:</span><span id="total-desconto" style="color:var(--danger);">- R$ 0,00</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:600;border-top:1px solid var(--border);padding-top:10px;margin-top:4px;">
        <span>Valor Final:</span><span id="total-final" style="color:var(--accent);">R$ 0,00</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px;color:var(--text2);border-top:1px dashed var(--border);padding-top:8px;">
        <span>💰 Custo Total:</span><span id="total-custo" style="color:var(--text2);">R$ 0,00</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:14px;font-weight:700;">
        <span>📈 Lucro Líquido:</span><span id="total-lucro" style="color:var(--success,#22c55e);">R$ 0,00</span>
      </div>
    </div>

    <div class="form-group" style="margin-bottom:10px;">
      <label class="form-label">Observações</label>
      <textarea class="form-textarea compact" id="f-observacoes" placeholder="Observações do pedido...">${v('observacoes')}</textarea>
    </div>

    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save" onclick="saveVenda()">${isNew?'+ Registrar Venda':'✓ Salvar Alterações'}</button>
      ${entregaActions}
      ${ticketAction}
      ${isNew ? '' : `<button class="btn btn-danger" style="margin-left:auto;" onclick="confirmDeleteVenda(${c.id_venda})">✖ Excluir Venda</button>`}
      <button class="btn btn-secondary" onclick="cancelForm()">Cancelar</button>
    </div></div>`;

  renderItens();
  calcTotais();
  decorarProdutosVenda();
  filtrarProdutosPedido('venda');
}

function produtoVendaComposicao(p) {
  const qtd = Number(p?.quantidade_fardo || 0);
  if(qtd <= 0) return '';
  return `${qtd.toLocaleString('pt-BR',{maximumFractionDigits:2})} ${p?.unidade || 'UN'}`;
}

function produtoVendaOptionLabel(p) {
  const comp = produtoVendaComposicao(p);
  const estoque = Number(p?.estoque_atual || 0).toLocaleString('pt-BR',{maximumFractionDigits:2});
  return `${p.nome_mercadoria}${comp ? ` (${comp} por caixa/fardo)` : ''} - Est: ${estoque} - R$ ${Number(p.preco_venda||0).toFixed(2)}`;
}

function produtoVendaDescricao(p) {
  const comp = produtoVendaComposicao(p);
  return comp ? `Composicao: ${comp} por caixa/fardo` : '';
}

function atualizarInfoProdutoVenda() {
  const idProduto = document.getElementById('item-produto')?.value;
  const produto = cacheProdutos.find(p=>String(p.id_produto)===String(idProduto));
  const el = document.getElementById('item-produto-info');
  if(el) el.textContent = produtoVendaDescricao(produto);
}

function decorarProdutosVenda() {
  const sel = document.getElementById('item-produto');
  if(!sel) return;
  [...sel.options].forEach(opt => {
    if(!opt.value) return;
    const produto = cacheProdutos.find(p=>String(p.id_produto)===String(opt.value));
    if(produto) {
      opt.textContent = produtoVendaOptionLabel(produto);
      opt.dataset.nome = produto.nome_mercadoria || '';
    }
  });
  if(!document.getElementById('item-produto-info')) {
    sel.insertAdjacentHTML('afterend','<div id="item-produto-info" style="font-size:11px;color:var(--text2);margin-top:5px;min-height:16px;"></div>');
  }
  atualizarInfoProdutoVenda();
}

function preencherPreco() {
  const sel = document.getElementById('item-produto');
  const opt = sel.options[sel.selectedIndex];
  const preco = opt?.dataset?.preco || '';
  document.getElementById('item-preco').value = preco ? Number(preco).toFixed(2) : '';
  atualizarInfoProdutoVenda();
  calcItemSubtotal();

  // Verificar preço especial para o cliente
  const idCliente = document.getElementById('f-id_cliente')?.value;
  const idProduto = sel.value;
  if(idCliente && idProduto) {
    apiGet(`produtos_precos_especiais?select=preco_especial&id_cliente=eq.${idCliente}&id_produto=eq.${idProduto}`).then(r => {
      if(Array.isArray(r) && r.length > 0) {
        document.getElementById('item-preco').value = Number(r[0].preco_especial).toFixed(2);
        calcItemSubtotal();
        toast('Preço especial aplicado para este cliente!','info');
      }
    });
  }
}

async function aplicarPadraoClienteVenda(forcar=false) {
  if(!isNew && !forcar) return;
  const idCliente = document.getElementById('f-id_cliente')?.value;
  if(!idCliente) return;
  const pagamento = document.getElementById('f-meio_pagamento');
  const parcelas = document.getElementById('f-quantidade_parcelas');
  const dias = document.getElementById('f-dias_vencimento');
  if(isNew && parcelas) parcelas.value = 1;

  const ultimas = await apiGet(`vendas?select=meio_pagamento,quantidade_parcelas,dias_vencimento&id_cliente=eq.${idCliente}&order=id_venda.desc&limit=1`);
  if(Array.isArray(ultimas) && ultimas.length > 0) {
    const ultima = ultimas[0];
    if(pagamento && ultima.meio_pagamento) pagamento.value = ultima.meio_pagamento;
    if(parcelas && !isNew && ultima.quantidade_parcelas) parcelas.value = Math.max(1, Number(ultima.quantidade_parcelas));
    if(dias && ultima.dias_vencimento !== null && ultima.dias_vencimento !== undefined) dias.value = Math.max(0, Number(ultima.dias_vencimento));
    calcularVencimentoVenda();
    await verificarContasClienteVenda();
    return;
  }

  const cliente = cacheClientes.find(c=>String(c.id_cliente)===String(idCliente));
  if(pagamento && cliente?.meio_pagamento_padrao) pagamento.value = cliente.meio_pagamento_padrao;
  if(parcelas && !isNew && cliente?.parcelas_padrao) parcelas.value = cliente.parcelas_padrao;
  calcularVencimentoVenda();
  await verificarContasClienteVenda();
}

function numeroVenda(valor) {
  let texto=String(valor??'').trim().replace(/\s/g,'').replace(/^R\$/i,'');
  if(texto.includes(',')) texto=texto.replace(/\./g,'').replace(',','.');
  const numero=Number(texto);
  return Number.isFinite(numero)?numero:0;
}

function calcItemSubtotal() {
  const qty = numeroVenda(document.getElementById('item-qty')?.value);
  const preco = numeroVenda(document.getElementById('item-preco')?.value);
  const desc = numeroVenda(document.getElementById('item-desconto')?.value);
  const sub = qty * (preco - desc);
  const el = document.getElementById('item-subtotal');
  if(el) el.value = 'R$ ' + Math.max(0,sub).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function adicionarItem() {
  if(!itensVendaEditaveis){toast('Somente vendas em aberto permitem alterar itens.','error');return;}
  const sel = document.getElementById('item-produto');
  const idProd = sel.value;
  const nomeProd = sel.options[sel.selectedIndex]?.text?.split(' — ')[0] || '';
  const qty = numeroVenda(document.getElementById('item-qty').value);
  const preco = numeroVenda(document.getElementById('item-preco').value);
  const desc = numeroVenda(document.getElementById('item-desconto').value);

  if(!idProd){ toast('Selecione um produto','error'); return; }
  if(qty<=0){ toast('Quantidade deve ser maior que zero','error'); return; }
  if(preco<=0){ toast('Preço deve ser maior que zero','error'); return; }
  if(desc<0){toast('O desconto do item não pode ser negativo.','error');return;}
  if(desc>preco+0.005){toast('O desconto por unidade não pode ser maior que o preço unitário.','error');return;}

  const subtotal = Math.max(0,qty*(preco-desc));
  const prodCache = cacheProdutos.find(p=>String(p.id_produto)===String(idProd));
  const precoCusto = prodCache ? Number(prodCache.preco_custo||0) : 0;
  const itemAtualizado = {
    id_produto:parseInt(idProd),
    nome_produto:prodCache?.nome_mercadoria || nomeProd,
    unidade: prodCache?.unidade || '',
    quantidade_fardo: prodCache?.quantidade_fardo || null,
    quantidade:qty,
    preco_unitario:preco,
    desconto_item:desc,
    subtotal,
    preco_custo:precoCusto
  };
  if(itemVendaEmEdicao===null) itensVenda.push(itemAtualizado);
  else itensVenda[itemVendaEmEdicao]=itemAtualizado;
  itemVendaEmEdicao=null;

  // Limpar campos
  document.getElementById('item-produto').value='';
  document.getElementById('item-qty').value='1';
  document.getElementById('item-preco').value='';
  document.getElementById('item-desconto').value='0';
  document.getElementById('item-subtotal').value='R$ 0,00';
  const btnItem=document.getElementById('btn-adicionar-item-venda');
  if(btnItem)btnItem.textContent='+ Adicionar Item';
  atualizarInfoProdutoVenda();

  renderItens();
  calcTotais();
}

function editarItem(idx) {
  if(!itensVendaEditaveis)return;
  const item=itensVenda[idx];
  if(!item)return;
  itemVendaEmEdicao=idx;
  selecionarProdutoPedido('venda', item.id_produto);
  document.getElementById('item-qty').value=String(item.quantidade||1);
  document.getElementById('item-preco').value=Number(item.preco_unitario||0).toFixed(2);
  document.getElementById('item-desconto').value=Number(item.desconto_item||0).toFixed(2);
  const btn=document.getElementById('btn-adicionar-item-venda');
  if(btn)btn.textContent='✓ Salvar alteração do item';
  atualizarInfoProdutoVenda();
  calcItemSubtotal();
  document.getElementById('item-produto')?.scrollIntoView({behavior:'smooth',block:'center'});
}

function removerItem(idx) {
  if(!itensVendaEditaveis)return;
  if(itemVendaEmEdicao===idx)itemVendaEmEdicao=null;
  else if(itemVendaEmEdicao!==null&&itemVendaEmEdicao>idx)itemVendaEmEdicao--;
  itensVenda.splice(idx,1);
  renderItens();
  calcTotais();
}

function renderItens() {
  const div = document.getElementById('lista-itens');
  if(!itensVenda.length){ div.innerHTML='<div style="padding:12px;text-align:center;color:var(--text3);font-size:13px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);">Nenhum item adicionado</div>'; return; }
  div.innerHTML = `<div class="venda-itens-wrap">
    <table class="venda-itens-table">
      <thead><tr style="background:var(--surface2);">
        <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--text2);font-weight:500;">Produto</th>
        <th style="padding:6px 8px;text-align:center;font-size:10px;color:var(--text2);font-weight:500;">Qtd</th>
        <th style="padding:6px 8px;text-align:right;font-size:10px;color:var(--text2);font-weight:500;">Custo</th>
        <th style="padding:6px 8px;text-align:right;font-size:10px;color:var(--text2);font-weight:500;">Preço</th>
        <th style="padding:6px 8px;text-align:right;font-size:10px;color:var(--text2);font-weight:500;">Desc./un.</th>
        <th style="padding:6px 8px;text-align:right;font-size:10px;color:var(--text2);font-weight:500;">Subtotal</th>
        <th style="padding:6px 8px;text-align:right;font-size:10px;color:var(--text2);font-weight:500;">Lucro</th>
        <th style="padding:6px 8px;text-align:center;font-size:10px;color:var(--text2);font-weight:500;"></th>
      </tr></thead>
      <tbody>
        ${itensVenda.map((item,i)=>{
          const custo = Number(item.preco_custo||0);
          const custoTotal = custo * Number(item.quantidade);
          const lucroItem = Number(item.subtotal) - custoTotal;
          const lucroColor = lucroItem >= 0 ? 'var(--success,#22c55e)' : 'var(--danger)';
          const composicao = produtoVendaDescricao(item);
          return `<tr style="border-top:1px solid var(--border);">
          <td style="padding:6px 8px;color:var(--text);">${item.nome_produto||item.produtos?.nome_mercadoria||'Produto'}${composicao?`<div style="font-size:10px;color:var(--text3);margin-top:2px;">${composicao}</div>`:''}</td>
          <td style="padding:6px 8px;text-align:center;color:var(--text);">${item.quantidade}</td>
          <td style="padding:6px 8px;text-align:right;color:var(--text2);font-size:11px;">${custo>0?'R$ '+custo.toFixed(2):'-'}</td>
          <td style="padding:6px 8px;text-align:right;color:var(--text);">R$ ${Number(item.preco_unitario).toFixed(2)}</td>
          <td style="padding:6px 8px;text-align:right;color:var(--danger);">${item.desconto_item>0?'- R$ '+Number(item.desconto_item).toFixed(2):'-'}</td>
          <td style="padding:6px 8px;text-align:right;color:var(--accent);font-weight:600;">R$ ${Number(item.subtotal).toFixed(2)}</td>
          <td style="padding:6px 8px;text-align:right;color:${lucroColor};font-weight:600;">${custo>0?(lucroItem>=0?'R$ ':'- R$ ')+Math.abs(lucroItem).toFixed(2):'-'}</td>
          <td style="padding:6px 8px;text-align:center;white-space:nowrap;">${itensVendaEditaveis?`<button class="btn btn-secondary" onclick="editarItem(${i})" style="padding:4px 7px;font-size:10px;">Alterar</button> <button class="btn btn-danger" onclick="removerItem(${i})" style="padding:4px 7px;font-size:10px;">Excluir</button>`:''}</td>
        </tr>`;}).join('')}
      </tbody>
    </table>
  </div>`;
}

function calcTotais() {
  const totalBruto = itensVenda.reduce((s,i)=>s+(Number(i.quantidade||0)*Number(i.preco_unitario||0)),0);
  const descontoItens = itensVenda.reduce((s,i)=>s+(Number(i.quantidade||0)*Math.max(0,Number(i.desconto_item||0))),0);
  const totalProd = Math.max(0,totalBruto-descontoItens);
  const totalCustoCalculado = itensVenda.reduce((s,i)=>s+(Number(i.preco_custo||0)*Number(i.quantidade)),0);
  const totalCusto = totalCustoCalculado;
  const descontoPedido = Math.max(0,numeroVenda(document.getElementById('f-desconto_total')?.value));
  const descontoTotal = descontoItens+descontoPedido;
  const final = Math.max(0,totalProd-descontoPedido);
  const lucro = final - totalCusto;
  const fmt = n=>'R$ '+n.toFixed(2);
  const elProd=document.getElementById('total-produtos'); if(elProd) elProd.textContent=fmt(totalBruto);
  const elDescItens=document.getElementById('total-desconto-itens'); if(elDescItens) elDescItens.textContent='- '+fmt(descontoItens);
  const elDescPedido=document.getElementById('total-desconto-pedido'); if(elDescPedido) elDescPedido.textContent='- '+fmt(descontoPedido);
  const elDesc=document.getElementById('total-desconto'); if(elDesc) elDesc.textContent='- '+fmt(descontoTotal);
  const elFinal=document.getElementById('total-final'); if(elFinal) elFinal.textContent=fmt(final);
  const elCusto=document.getElementById('total-custo'); if(elCusto) elCusto.textContent=fmt(totalCusto);
  const elLucro=document.getElementById('total-lucro');
  if(elLucro){
    elLucro.textContent=fmt(lucro);
    elLucro.style.color = lucro>=0 ? 'var(--success,#22c55e)' : 'var(--danger)';
  }
}

async function imprimirTicketVenda(idVenda) {
  const venda = items.find(v=>Number(v.id_venda)===Number(idVenda));
  if(!venda){ toast('Venda não encontrada para impressão.','error'); return; }

  const itensBanco=itensVenda.length?null:await apiGet(`venda_itens?select=*,produtos!fk_item_produto(nome_mercadoria)&id_venda=eq.${idVenda}`);
  const itens=itensVenda.length?itensVenda:(Array.isArray(itensBanco)?itensBanco.map(i=>({...i,desconto_item:Number(i.quantidade||0)>0?Number(i.desconto_item||0)/Number(i.quantidade):0})):itensBanco);
  if(!Array.isArray(itens) || !itens.length){ toast('Venda sem itens para impressão.','error'); return; }

  const cliente = venda.clientes?.nome_fantasia || venda.clientes?.razao_social || `Cliente #${venda.id_cliente}`;
  const fmt = n => 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const subtotal = itens.reduce((s,i)=>s+(Number(i.quantidade||0)*Number(i.preco_unitario||0)),0);
  const descontoItens = itens.reduce((s,i)=>s+(Number(i.quantidade||0)*Number(i.desconto_item||0)),0);
  const descontoVenda = Number(venda.desconto_total||0);
  const desconto = descontoItens + descontoVenda;
  const valorFinalBanco = Number(venda.valor_final);
  const total = Number.isFinite(valorFinalBanco) ? valorFinalBanco : Math.max(0,subtotal-desconto);
  const statusFin = venda.status_entrega === 'ENTREGUE' ? 'A RECEBER' : 'Pendente';
  const itensTexto = itens.map(i => {
    const nome = i.nome_produto || i.produtos?.nome_mercadoria || 'Produto';
    const qtd = Number(i.quantidade||0);
    const preco = Number(i.preco_unitario||0);
    const sub = Number(i.subtotal || (qtd*(preco-Number(i.desconto_item||0))));
    return `- ${nome} | Qtd: ${qtd} | Unit: ${fmt(preco)} | Total: ${fmt(sub)}`;
  }).join('\n');
  const ticketTexto = [
    'JR Representações',
    `Pedido: ${venda.codigo_venda||'#'+idVenda}`,
    `Cliente: ${cliente}`,
    `Venda: ${venda.data_venda?new Date(venda.data_venda).toLocaleString('pt-BR'):'-'}`,
    `Entrega: ${venda.data_entrega?new Date(venda.data_entrega).toLocaleString('pt-BR'):'Pendente'}`,
    `Pagamento: ${venda.meio_pagamento||'-'} - ${statusFin}`,
    '',
    'Itens:',
    itensTexto,
    '',
    `Subtotal: ${fmt(subtotal)}`,
    `Descontos nos itens: ${fmt(descontoItens)}`,
    `Desconto no pedido: ${fmt(descontoVenda)}`,
    `Desconto total: ${fmt(desconto)}`,
    `Total: ${fmt(total)}`,
    venda.observacoes ? `Observações: ${venda.observacoes}` : ''
  ].filter(Boolean).join('\n');
  const ticketData = {
    empresa: 'JR Representacoes',
    titulo: 'Ticket de Venda',
    codigo: venda.codigo_venda || '#'+idVenda,
    cliente,
    venda: venda.data_venda ? new Date(venda.data_venda).toLocaleString('pt-BR') : '-',
    entrega: venda.data_entrega ? new Date(venda.data_entrega).toLocaleString('pt-BR') : 'Pendente',
    pagamento: `${venda.meio_pagamento||'-'} - ${statusFin}`,
    subtotal: fmt(subtotal),
    descontoItens: fmt(descontoItens),
    descontoPedido: fmt(descontoVenda),
    desconto: fmt(desconto),
    total: fmt(total),
    observacoes: venda.observacoes || '',
    impressoEm: new Date().toLocaleString('pt-BR'),
    itens: itens.map(i => {
      const nome = i.nome_produto || i.produtos?.nome_mercadoria || 'Produto';
      const qtd = Number(i.quantidade||0);
      const preco = Number(i.preco_unitario||0);
      const sub = Number(i.subtotal || (qtd*(preco-Number(i.desconto_item||0))));
      return { nome, qtd, preco: fmt(preco), total: fmt(sub) };
    })
  };
  const itensHtml = itens.map(i => {
    const nome = i.nome_produto || i.produtos?.nome_mercadoria || 'Produto';
    const qtd = Number(i.quantidade||0);
    const preco = Number(i.preco_unitario||0);
    const sub = Number(i.subtotal || (qtd*(preco-Number(i.desconto_item||0))));
    return `<tr><td>${nome}</td><td>${qtd}</td><td>${fmt(preco)}</td><td>${fmt(sub)}</td></tr>`;
  }).join('');

  const html = `
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
      <title>Ticket ${venda.codigo_venda||idVenda}</title>
      <style>
        *{box-sizing:border-box;}
        html,body{margin:0;min-height:100%;background:#f2f2f2;}
        body{font-family:Arial,sans-serif;padding:14px;color:#111;font-size:14px;-webkit-text-size-adjust:100%;}
        .ticket{width:min(100%,420px);margin:0 auto;background:#fff;padding:18px 16px;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.12);}
        h1{font-size:22px;margin:0 0 4px;text-align:center;}
        .sub{text-align:center;color:#555;margin-bottom:12px;}
        .row{display:flex;justify-content:space-between;gap:12px;margin:6px 0;}
        .row span:last-child{text-align:right;overflow-wrap:anywhere;}
        .sep{border-top:1px dashed #999;margin:12px 0;}
        table{width:100%;border-collapse:collapse;margin-top:6px;}
        th,td{padding:7px 0;border-bottom:1px solid #eee;text-align:left;vertical-align:top;}
        th:first-child,td:first-child{padding-right:8px;}
        th:nth-child(2),td:nth-child(2){text-align:center;}
        th:nth-child(3),td:nth-child(3),th:nth-child(4),td:nth-child(4){text-align:right;}
        .total{font-size:18px;font-weight:700;}
        .obs{white-space:pre-wrap;margin-top:6px;color:#333;}
        .actions{position:sticky;bottom:0;display:grid;grid-template-columns:1fr;gap:10px;margin:16px -16px -18px;padding:12px 16px;background:rgba(255,255,255,.96);border-top:1px solid #ddd;border-radius:0 0 10px 10px;}
        .actions button{width:100%;min-height:48px;padding:12px;border:1px solid #ccc;border-radius:8px;background:#f7f7f7;color:#111;font-size:15px;font-weight:700;cursor:pointer;}
        .actions button.primary{background:#111;color:#fff;border-color:#111;}
        .actions button.whats{background:#25d366;color:#061b0d;border-color:#25d366;}
        .hint{text-align:center;color:#666;font-size:12px;margin-top:10px;line-height:1.35;}
        @media(max-width:480px){
          body{padding:0;background:#fff;font-size:15px;}
          .ticket{width:100%;max-width:none;min-height:100vh;border-radius:0;box-shadow:none;padding:16px 14px 150px;}
          h1{font-size:24px;}
          .actions{position:fixed;left:0;right:0;bottom:0;margin:0;padding:10px 14px calc(10px + env(safe-area-inset-bottom));border-radius:14px 14px 0 0;box-shadow:0 -4px 16px rgba(0,0,0,.14);}
          .actions button{min-height:50px;font-size:16px;}
        }
        @media print{html,body{background:#fff}.ticket{box-shadow:none;border-radius:0;padding:0;max-width:360px}.actions,.hint,.no-print{display:none!important}body{padding:0;font-size:12px}.total{font-size:15px}}
      </style>
      <script>
        const ticketData = ${JSON.stringify(ticketData)};
        function wrapText(ctx, text, maxWidth){
          const words = String(text || '').split(/\\s+/).filter(Boolean);
          const lines = [];
          let line = '';
          words.forEach(word => {
            const test = line ? line + ' ' + word : word;
            if(ctx.measureText(test).width > maxWidth && line){
              lines.push(line);
              line = word;
            } else {
              line = test;
            }
          });
          if(line) lines.push(line);
          return lines.length ? lines : [''];
        }
        function drawLine(ctx, x1, x2, y){
          ctx.strokeStyle = '#999';
          ctx.setLineDash([8, 8]);
          ctx.beginPath();
          ctx.moveTo(x1, y);
          ctx.lineTo(x2, y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        function buildTicketCanvas(){
          const width = 900;
          const pad = 46;
          const temp = document.createElement('canvas').getContext('2d');
          temp.font = '28px Arial';
          let y = pad + 52 + 34 + 22 + 5 * 36 + 26 + 42;
          ticketData.itens.forEach(item => {
            temp.font = '26px Arial';
            const linhas = wrapText(temp, item.nome, 430);
            y += Math.max(40, linhas.length * 30) + 14;
          });
          y += 30 + 6 * 38 + (ticketData.observacoes ? 90 : 0) + 80;
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = Math.max(1180, y);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#111';
          ctx.textBaseline = 'top';
          let cy = pad;
          ctx.font = 'bold 42px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(ticketData.empresa, width/2, cy);
          cy += 52;
          ctx.font = '26px Arial';
          ctx.fillStyle = '#555';
          ctx.fillText(ticketData.titulo, width/2, cy);
          cy += 44;
          ctx.textAlign = 'left';
          ctx.fillStyle = '#111';
          ctx.font = '26px Arial';
          const row = (label, value) => {
            ctx.font = 'bold 26px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(label, pad, cy);
            ctx.font = '26px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(String(value || '-'), width - pad, cy);
            cy += 36;
          };
          row('Pedido', ticketData.codigo);
          row('Cliente', ticketData.cliente);
          row('Venda', ticketData.venda);
          row('Entrega', ticketData.entrega);
          row('Pagamento', ticketData.pagamento);
          cy += 10;
          drawLine(ctx, pad, width-pad, cy);
          cy += 24;
          ctx.fillStyle = '#111';
          ctx.font = 'bold 24px Arial';
          ctx.textAlign = 'left';
          ctx.fillText('Produto', pad, cy);
          ctx.textAlign = 'center';
          ctx.fillText('Qtd', 560, cy);
          ctx.textAlign = 'right';
          ctx.fillText('Unit.', 710, cy);
          ctx.fillText('Total', width-pad, cy);
          cy += 38;
          ticketData.itens.forEach(item => {
            ctx.font = '26px Arial';
            ctx.fillStyle = '#111';
            const linhas = wrapText(ctx, item.nome, 430);
            ctx.textAlign = 'left';
            linhas.forEach((linha, idx) => ctx.fillText(linha, pad, cy + idx * 30));
            ctx.textAlign = 'center';
            ctx.fillText(String(item.qtd), 560, cy);
            ctx.textAlign = 'right';
            ctx.fillText(item.preco, 710, cy);
            ctx.fillText(item.total, width-pad, cy);
            cy += Math.max(40, linhas.length * 30) + 14;
          });
          drawLine(ctx, pad, width-pad, cy);
          cy += 26;
          row('Subtotal', ticketData.subtotal);
          row('Desc. itens', ticketData.descontoItens);
          row('Desc. pedido', ticketData.descontoPedido);
          row('Desc. total', ticketData.desconto);
          ctx.font = 'bold 34px Arial';
          ctx.textAlign = 'left';
          ctx.fillText('Total', pad, cy);
          ctx.textAlign = 'right';
          ctx.fillText(ticketData.total, width-pad, cy);
          cy += 48;
          if(ticketData.observacoes){
            drawLine(ctx, pad, width-pad, cy);
            cy += 24;
            ctx.font = 'bold 25px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('Observacoes', pad, cy);
            cy += 34;
            ctx.font = '24px Arial';
            wrapText(ctx, ticketData.observacoes, width - pad * 2).forEach(linha => {
              ctx.fillText(linha, pad, cy);
              cy += 30;
            });
          }
          cy += 20;
          drawLine(ctx, pad, width-pad, cy);
          cy += 24;
          ctx.font = '22px Arial';
          ctx.fillStyle = '#666';
          ctx.textAlign = 'center';
          ctx.fillText('Impresso em ' + ticketData.impressoEm, width/2, cy);
          return canvas;
        }
        function canvasToBlob(canvas){
          return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
        }
        async function gerarArquivoTicket(){
          const canvas = buildTicketCanvas();
          const blob = await canvasToBlob(canvas);
          return new File([blob], 'pedido-' + String(ticketData.codigo).replace(/[^a-z0-9_-]/gi,'-') + '.png', {type:'image/png'});
        }
        async function compartilharTicket(){
          const file = await gerarArquivoTicket();
          if(navigator.canShare && navigator.canShare({files:[file]})){
            try{
              await navigator.share({title:'Pedido ' + ticketData.codigo, files:[file]});
              return;
            }catch(e){}
          }
          const url = URL.createObjectURL(file);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
          alert('Imagem do pedido baixada. Anexe esse arquivo no WhatsApp ou no app desejado.');
        }
        async function enviarWhatsApp(){
          await compartilharTicket();
        }
        function semAcento(texto){
          return String(texto || '')
            .normalize('NFD')
            .replace(/[\\u0300-\\u036f]/g, '')
            .replace(/[^\\x20-\\x7E\\n]/g, '');
        }
        function quebrarLinha(texto, largura){
          const palavras = semAcento(texto).split(/\\s+/).filter(Boolean);
          const linhas = [];
          let linha = '';
          palavras.forEach(p => {
            const teste = linha ? linha + ' ' + p : p;
            if(teste.length > largura && linha){
              linhas.push(linha);
              linha = p;
            } else {
              linha = teste;
            }
          });
          if(linha) linhas.push(linha);
          return linhas.length ? linhas : [''];
        }
        function montarEscPos(){
          const enc = new TextEncoder();
          const out = [];
          const add = bytes => out.push(...bytes);
          const txt = texto => add([...enc.encode(semAcento(texto))]);
          const linha = () => txt('--------------------------------\\n');
          add([0x1b,0x40]);
          add([0x1b,0x61,0x01]);
          add([0x1b,0x45,0x01]);
          txt(ticketData.empresa + '\\n');
          add([0x1b,0x45,0x00]);
          txt(ticketData.titulo + '\\n');
          add([0x1b,0x61,0x00]);
          linha();
          txt('Pedido: ' + ticketData.codigo + '\\n');
          txt('Cliente: ' + ticketData.cliente + '\\n');
          txt('Venda: ' + ticketData.venda + '\\n');
          txt('Entrega: ' + ticketData.entrega + '\\n');
          txt('Pagamento: ' + ticketData.pagamento + '\\n');
          linha();
          ticketData.itens.forEach(item => {
            quebrarLinha(item.nome, 32).forEach(l => txt(l + '\\n'));
            const qtd = String(item.qtd).padStart(4, ' ');
            const total = String(item.total).padStart(12, ' ');
            txt(qtd + ' x ' + item.preco + total + '\\n');
          });
          linha();
          txt('Subtotal: ' + ticketData.subtotal + '\\n');
          txt('Desc. itens: ' + ticketData.descontoItens + '\\n');
          txt('Desc. pedido: ' + ticketData.descontoPedido + '\\n');
          txt('Desc. total: ' + ticketData.desconto + '\\n');
          add([0x1b,0x45,0x01]);
          txt('Total: ' + ticketData.total + '\\n');
          add([0x1b,0x45,0x00]);
          if(ticketData.observacoes){
            linha();
            quebrarLinha('Obs: ' + ticketData.observacoes, 32).forEach(l => txt(l + '\\n'));
          }
          linha();
          add([0x1b,0x61,0x01]);
          txt('Impresso em\\n' + ticketData.impressoEm + '\\n\\n\\n');
          add([0x1d,0x56,0x42,0x00]);
          return new Uint8Array(out);
        }
        async function escreverEmChunks(characteristic, bytes){
          const tamanho = 120;
          for(let i=0; i<bytes.length; i+=tamanho){
            const chunk = bytes.slice(i, i+tamanho);
            if(characteristic.writeValueWithoutResponse) await characteristic.writeValueWithoutResponse(chunk);
            else await characteristic.writeValue(chunk);
            await new Promise(r => setTimeout(r, 35));
          }
        }
        async function imprimirTermicaBluetooth(){
          if(!navigator.bluetooth){
            alert('Este navegador nao permite impressao Bluetooth direta. Use Chrome no Android ou compartilhe a imagem do pedido.');
            return;
          }
          const perfis = [
            {service:'6e400001-b5a3-f393-e0a9-e50e24dcca9e', chars:['6e400002-b5a3-f393-e0a9-e50e24dcca9e']},
            {service:'000018f0-0000-1000-8000-00805f9b34fb', chars:['00002af1-0000-1000-8000-00805f9b34fb','00002af0-0000-1000-8000-00805f9b34fb']},
            {service:'49535343-fe7d-4ae5-8fa9-9fafd205e455', chars:['49535343-8841-43f4-a8d4-ecbe34729bb3']}
          ];
          try{
            const device = await navigator.bluetooth.requestDevice({
              acceptAllDevices:true,
              optionalServices:perfis.map(p => p.service)
            });
            const server = await device.gatt.connect();
            let characteristic = null;
            for(const perfil of perfis){
              try{
                const service = await server.getPrimaryService(perfil.service);
                for(const ch of perfil.chars){
                  try{
                    const c = await service.getCharacteristic(ch);
                    if(c.properties.write || c.properties.writeWithoutResponse){
                      characteristic = c;
                      break;
                    }
                  }catch(e){}
                }
              }catch(e){}
              if(characteristic) break;
            }
            if(!characteristic){
              alert('A impressora conectou, mas nao encontrei canal de escrita compativel. Ela pode usar Bluetooth classico/SPP.');
              try{ device.gatt.disconnect(); }catch(e){}
              return;
            }
            await escreverEmChunks(characteristic, montarEscPos());
            alert('Pedido enviado para a impressora.');
            try{ device.gatt.disconnect(); }catch(e){}
          }catch(e){
            const abrirApps = confirm('Nao foi possivel imprimir via Bluetooth direto. Essa impressora provavelmente usa Bluetooth classico. Quer abrir o compartilhamento da imagem para escolher RawBT, Bluetooth Print ou o app da impressora?');
            if(abrirApps) await compartilharTicket();
          }
        }
      </script>
    </head>
    <body>
      <div class="ticket">
        <h1>JR Representações</h1>
        <div class="sub">Ticket de Venda</div>
        <div class="row"><strong>Pedido</strong><span>${venda.codigo_venda||'#'+idVenda}</span></div>
        <div class="row"><strong>Cliente</strong><span>${cliente}</span></div>
        <div class="row"><strong>Venda</strong><span>${venda.data_venda?new Date(venda.data_venda).toLocaleString('pt-BR'):'-'}</span></div>
        <div class="row"><strong>Entrega</strong><span>${venda.data_entrega?new Date(venda.data_entrega).toLocaleString('pt-BR'):'Pendente'}</span></div>
        <div class="row"><strong>Pagamento</strong><span>${venda.meio_pagamento||'-'} · ${statusFin}</span></div>
        <div class="sep"></div>
        <table>
          <thead><tr><th>Produto</th><th>Qtd</th><th>Unit.</th><th>Total</th></tr></thead>
          <tbody>${itensHtml}</tbody>
        </table>
        <div class="sep"></div>
        <div class="row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
        <div class="row"><span>Descontos nos itens</span><span>${fmt(descontoItens)}</span></div>
        <div class="row"><span>Desconto no pedido</span><span>${fmt(descontoVenda)}</span></div>
        <div class="row"><strong>Desconto total</strong><strong>${fmt(desconto)}</strong></div>
        <div class="row total"><span>Total</span><span>${fmt(total)}</span></div>
        ${venda.observacoes?`<div class="sep"></div><strong>Observações</strong><div class="obs">${venda.observacoes}</div>`:''}
        <div class="sep"></div>
        <div class="sub">Impresso em ${new Date().toLocaleString('pt-BR')}</div>
        <div class="actions no-print">
          <button class="primary" onclick="window.print()">Imprimir</button>
          <button onclick="compartilharTicket()">Compartilhar imagem</button>
          <button onclick="imprimirTermicaBluetooth()">Térmica direta / App</button>
          <button class="whats" onclick="enviarWhatsApp()">WhatsApp / Apps</button>
        </div>
        <div class="hint no-print">No celular, compartilha o ticket como arquivo PNG. No computador, baixa a imagem para anexar.</div>
      </div>
    </body>
    </html>`;

  const win = window.open('', '_blank', 'width=520,height=820');
  if(!win){ toast('Pop-up bloqueado. Permita pop-ups para imprimir.','error'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
}

function buildVendaItensPayload(vendaId, itens = itensVenda) {
  return itens.map(item => ({
    id_venda: vendaId,
    id_produto: Number(item.id_produto),
    quantidade: Number(item.quantidade),
    preco_unitario: Number(item.preco_unitario),
    desconto_item: Number(item.quantidade||0)*Number(item.desconto_item||0)
  }));
}

async function insertVendaItens(vendaId, itens = itensVenda) {
  const payload = buildVendaItensPayload(vendaId, itens);
  if(!payload.length) return { ok:false, data:{ message:'Venda sem itens.' } };
  return apiPost('venda_itens', payload);
}

async function getItensEstoqueVenda(idVenda) {
  const itens = await apiGet(`venda_itens?select=id_produto,quantidade,produtos!fk_item_produto(id_produto,nome_mercadoria,estoque_atual)&id_venda=eq.${idVenda}`);
  if(!Array.isArray(itens)) return [];

  const porProduto = new Map();
  itens.forEach(item => {
    const idProduto = Number(item.id_produto);
    const atual = porProduto.get(idProduto) || {
      id_produto: idProduto,
      nome: item.produtos?.nome_mercadoria || `Produto #${idProduto}`,
      quantidade: 0,
      estoque_atual: Number(item.produtos?.estoque_atual || 0)
    };
    atual.quantidade += Number(item.quantidade || 0);
    porProduto.set(idProduto, atual);
  });

  return Array.from(porProduto.values());
}

async function ajustarEstoqueVenda(idVenda, operacao) {
  const itens = await getItensEstoqueVenda(idVenda);
  if(!itens.length) return { ok:false, message:'A venda não possui itens acessíveis para ajustar o estoque. Confira se os produtos ainda existem nesta empresa.' };

  for(const item of itens) {
    if(!item.id_produto || !Number.isFinite(item.quantidade) || item.quantidade <= 0) {
      return { ok:false, message:`Item inválido no estoque: ${item.nome || 'produto sem identificação'}.` };
    }
    const novoEstoque = operacao === 'baixar'
      ? item.estoque_atual - item.quantidade
      : item.estoque_atual + item.quantidade;
    const res = await apiPatch(`produtos?id_produto=eq.${item.id_produto}`,{estoque_atual:novoEstoque});
    if(!res.ok) return { ok:false, message:`Produto ${item.nome}: ${res.data?.message || 'a atualização foi recusada pelo banco.'}` };
    if(!Array.isArray(res.data) || !res.data.length) return { ok:false, message:`Produto ${item.nome} não foi encontrado na empresa atual ou não pôde ser atualizado.` };
  }

  return { ok:true };
}

async function gerarContasReceberVenda(idVenda, venda, opcoes={}) {
  const pagamento = opcoes.meio_pagamento || venda?.meio_pagamento;
  if(!pagamento) return { ok:false, data:{ message:'Informe o meio de pagamento para gerar o financeiro.' } };

  const pagamentoRecebido = opcoes.recebido === true;
  const valorConta = Number(opcoes.valor_final ?? venda?.valor_final ?? 0);
  const parcelas = Math.max(1, parseInt(opcoes.quantidade_parcelas ?? venda?.quantidade_parcelas ?? '1',10)||1);
  const dias = Math.max(0, parseInt(opcoes.dias_vencimento ?? venda?.dias_vencimento ?? '0',10)||0);
  const totalParcelas = pagamentoRecebido ? 1 : parcelas;
  const valorBase = Math.floor((valorConta / totalParcelas) * 100) / 100;
  const vencBase = opcoes.data_vencimento
    || venda?.data_vencimento
    || (pagamentoVenceNaDataDaVenda(pagamento)
      ? toLocalDateInput(venda?.data_entrega || venda?.data_venda || new Date())
      : toLocalDateInput());
  const obs = (opcoes.observacoes || '').trim();
  const grupoParcelamento = novoGrupoParcelamento();

  const contasData = Array.from({length:totalParcelas}, (_,idx) => {
    const valorParcela = idx === totalParcelas - 1
      ? Number((valorConta - (valorBase * (totalParcelas - 1))).toFixed(2))
      : valorBase;
    const conta = {
      id_venda: idVenda,
      id_cliente: venda?.id_cliente,
      data_vencimento: addDaysToDateInput(vencBase, idx * dias),
      valor_original: valorParcela,
      valor_recebido: pagamentoRecebido ? valorParcela : 0,
      meio_pagamento: pagamento,
      status_recebimento: pagamentoRecebido ? 'RECEBIDO' : 'PENDENTE',
      data_recebimento: pagamentoRecebido ? new Date().toISOString() : null
      ,grupo_parcelamento: grupoParcelamento
      ,numero_parcela: idx+1
      ,total_parcelas: totalParcelas
      ,valor_total_titulo: valorConta
    };
    const parcelaLabel = totalParcelas > 1 ? `Parcela ${idx+1}/${totalParcelas}` : '';
    conta.observacoes = [parcelaLabel, obs].filter(Boolean).join(' - ') || null;
    return conta;
  });

  // Nunca apague o financeiro antes de ter um substituto valido. O fluxo antigo
  // podia deixar uma venda ENTREGUE sem titulo quando o POST falhava depois do DELETE.
  const existentesRes = await apiGet(`contas_receber?select=*&id_venda=eq.${idVenda}&order=numero_parcela.asc,id_conta.asc`);
  if(!Array.isArray(existentesRes)) {
    return {ok:false,data:{message:'Nao foi possivel conferir o financeiro existente da venda.'}};
  }
  const existentes = existentesRes;
  const temBaixa = existentes.some(c => Number(c.valor_recebido||0)>0 || c.status_recebimento==='RECEBIDO');
  if(temBaixa) {
    // Uma edicao da venda nunca pode apagar recebimentos ja registrados.
    return {ok:true,data:existentes,preservado:true};
  }

  const comuns = Math.min(existentes.length, contasData.length);
  const atualizadas = [];
  for(let idx=0; idx<comuns; idx++) {
    const res = await apiPatch(`contas_receber?id_conta=eq.${existentes[idx].id_conta}`, contasData[idx]);
    if(!res.ok || !Array.isArray(res.data) || !res.data.length) {
      return {ok:false,data:{message:`Falha ao atualizar a parcela ${idx+1}. O titulo anterior foi preservado.`}};
    }
    atualizadas.push(res.data[0]);
  }

  let criadas = [];
  if(existentes.length && contasData.length > existentes.length) {
    const criacao = await apiPost('contas_receber', contasData.slice(existentes.length));
    if(!criacao.ok) return criacao;
    criadas = Array.isArray(criacao.data) ? criacao.data : [];
  }

  // Parcelas excedentes so sao removidas depois que as novas foram gravadas.
  if(existentes.length > contasData.length) {
    const excedentes = existentes.slice(contasData.length).map(c=>Number(c.id_conta)).filter(Boolean);
    if(excedentes.length && !await apiDelete(`contas_receber?id_conta=in.(${excedentes.join(',')})`)) {
      return {ok:false,data:{message:'As novas parcelas foram salvas, mas parcelas antigas excedentes nao puderam ser removidas.'}};
    }
  }

  if(!existentes.length) {
    const criacao = await apiPost('contas_receber', contasData);
    if(!criacao.ok) return criacao;
    criadas = Array.isArray(criacao.data) ? criacao.data : [];
  }

  // O sucesso so e informado depois de reler e validar quantidade e valor total.
  const conferidas = await apiGet(`contas_receber?select=*&id_venda=eq.${idVenda}&order=numero_parcela.asc,id_conta.asc`);
  const totalConferido = Array.isArray(conferidas)
    ? conferidas.reduce((s,c)=>s+Number(c.valor_original||0),0)
    : NaN;
  if(!Array.isArray(conferidas) || conferidas.length!==totalParcelas || Math.abs(totalConferido-valorConta)>0.005) {
    return {ok:false,data:{message:'O financeiro nao passou na conferencia final. A venda foi sinalizada para revisao.'}};
  }
  invalidarResumoContasVendas();
  return {ok:true,data:conferidas.length?conferidas:[...atualizadas,...criadas]};
}

async function saveVenda() {
  const codigo = document.getElementById('f-codigo_venda').value.trim();
  const id_cliente = document.getElementById('f-id_cliente').value;
  const data_venda = document.getElementById('f-data_venda').value;
  if(!codigo){ toast('Código da venda é obrigatório','error'); return; }
  if(!id_cliente){ toast('Selecione o cliente','error'); return; }
  if(!data_venda){ toast('Data da venda é obrigatória','error'); return; }
  if(itensVenda.length===0){ toast('Adicione pelo menos um item','error'); return; }
  const quantidadeParcelasForm=Math.max(1,parseInt(document.getElementById('f-quantidade_parcelas').value||'1',10)||1);
  const diasParcelasForm=Math.max(0,parseInt(document.getElementById('f-dias_vencimento').value||'0',10)||0);
  if(quantidadeParcelasForm>1&&diasParcelasForm===0){toast('Informe um intervalo em dias maior que zero para mais de uma parcela.','error');return;}

  const totalProd = itensVenda.reduce((s,i)=>s+Number(i.subtotal),0);
  const totalCustoCalculado = itensVenda.reduce((s,i)=>s+(Number(i.preco_custo||0)*Number(i.quantidade)),0);
  const totalCusto = totalCustoCalculado;
  const desconto = numeroVenda(document.getElementById('f-desconto_total').value);
  if(desconto<0){toast('O desconto do pedido não pode ser negativo.','error');return;}
  if(desconto>totalProd+0.005){toast('O desconto do pedido não pode ser maior que o total dos itens.','error');return;}
  const final = Math.max(0,totalProd-desconto);
  const status = document.getElementById('f-status_entrega').value || 'PENDENTE';
  const statusAnterior = isNew ? 'PENDENTE' : (items.find(x=>Number(x.id_venda)===Number(currentId))?.status_entrega || 'PENDENTE');
  const meioPagamentoForm = document.getElementById('f-meio_pagamento').value || null;
  const vendaDataBase = (data_venda || toLocalDateTimeInput()).slice(0,10);
  const vencimentoForm = document.getElementById('f-data_vencimento').value || null;
  const vencimentoSeguro = vencimentoForm
    || (status === 'ENTREGUE' && pagamentoVenceNaDataDaVenda(meioPagamentoForm)
      ? vendaDataBase
      : addDaysToDateInput(vendaDataBase, Math.max(0, parseInt(document.getElementById('f-dias_vencimento').value||'0',10)||0)));
  if(status === 'ENTREGUE' && !meioPagamentoForm) {
    toast('Informe o meio de pagamento para venda entregue gerar financeiro.','error');
    return;
  }
  const btn=document.getElementById('btn-save'); btn.disabled=true; btn.textContent='Salvando...';

  const dadosVenda = {
    codigo_venda: codigo,
    id_cliente: parseInt(id_cliente),
    data_venda: localDateTimeToISO(data_venda),
    status_entrega: status,
    data_entrega: localDateTimeToISO(document.getElementById('f-data_entrega').value),
    valor_produtos: totalCusto,
    desconto_total: desconto,
    valor_final: final,
    meio_pagamento: meioPagamentoForm,  // banco aceita: PIX,BOLETO,DINHEIRO,CARTAO
    quantidade_parcelas: quantidadeParcelasForm,
    dias_vencimento: diasParcelasForm,
    data_vencimento: vencimentoSeguro,
    observacoes: document.getElementById('f-observacoes').value.trim()||null
  };

  let vendaId = currentId;

  if(isNew) {
    const{ok,data:res}=await apiPost('vendas',dadosVenda);
    if(!ok){
      const erro=res?.message||'erro';
      const codigoGlobal=/vendas_codigo_venda_key|duplicate key/i.test(erro);
      toast(codigoGlobal?'O código da venda ainda está configurado como único entre todas as empresas. Execute sql/corrigir_codigo_venda_por_empresa.sql.':'Erro ao salvar venda: '+erro,'error');
      btn.disabled=false; btn.textContent='+ Registrar Venda'; return;
    }
    vendaId = (Array.isArray(res)?res[0]:res)?.id_venda;
    const itensRes = await insertVendaItens(vendaId);
    if(!itensRes.ok) {
      await apiDelete(`vendas?id_venda=eq.${vendaId}`);
      toast('Erro ao salvar itens da venda: '+(itensRes.data?.message||'erro'),'error');
      btn.disabled=false; btn.textContent='+ Registrar Venda';
      return;
    }
  } else {
    const itensAnterioresBanco = await apiGet(`venda_itens?select=id_produto,quantidade,preco_unitario,desconto_item&id_venda=eq.${currentId}`);
    const itensAnteriores=Array.isArray(itensAnterioresBanco)?itensAnterioresBanco.map(i=>({...i,desconto_item:Number(i.quantidade||0)>0?Number(i.desconto_item||0)/Number(i.quantidade):0})):itensAnterioresBanco;
    const{ok,data:res}=await apiPatch(`vendas?id_venda=eq.${currentId}`,dadosVenda);
    if(!ok){ toast('Erro: '+(res?.message||'erro'),'error'); btn.disabled=false; btn.textContent='✓ Salvar Alterações'; return; }
    // Só deletar e reinserir itens se houver itens na tela
    if(itensVenda.length === 0) {
      toast('Atenção: nenhum item na venda. Adicione itens antes de salvar.','error');
      btn.disabled=false; btn.textContent='✓ Salvar Alterações';
      return;
    }
    const deleteOk = await apiDelete(`venda_itens?id_venda=eq.${currentId}`);
    if(!deleteOk) {
      toast('Erro ao preparar atualização dos itens. Tente novamente.','error');
      btn.disabled=false; btn.textContent='✓ Salvar Alterações';
      return;
    }
    const itensRes = await insertVendaItens(vendaId);
    if(!itensRes.ok) {
      let restaurado = false;
      if(Array.isArray(itensAnteriores) && itensAnteriores.length) {
        const restoreRes = await insertVendaItens(vendaId, itensAnteriores);
        restaurado = restoreRes.ok;
      }
      toast(restaurado
        ? 'Erro ao salvar itens da venda. Itens anteriores foram restaurados. '+(itensRes.data?.message||'')
        : 'Erro ao salvar itens da venda. Verifique os itens antes de continuar. '+(itensRes.data?.message||''),'error');
      btn.disabled=false; btn.textContent='✓ Salvar Alterações';
      return;
    }
  }

  if(status === 'ENTREGUE') {
    const contasRes = await gerarContasReceberVenda(vendaId, {
      ...dadosVenda,
      id_venda: vendaId
    });
    if(!contasRes.ok) {
      toast('Venda salva, mas erro ao gerar financeiro: '+(contasRes.data?.message||'erro'),'error');
      btn.disabled=false; btn.textContent=isNew?'+ Registrar Venda':'✓ Salvar Alterações';
      return;
    }
    const vendaAnterior=items.find(x=>Number(x.id_venda)===Number(vendaId));
    const financeiro=await prepararIntegracaoBaixaContaReceber({id_conta_financas:vendaAnterior?.id_conta_financas||null});
    if(!financeiro.ok){
      if(!financeiro.cancelada)toast(financeiro.message,'error');
      btn.disabled=false;btn.textContent=isNew?'+ Registrar Venda':'✓ Salvar Alterações';
      return;
    }
    const titulosCriados=Array.isArray(contasRes.data)?contasRes.data:[];
    const sincronizacao=await vincularTitulosReceberFinancas(titulosCriados,financeiro,`Venda ${dadosVenda.codigo_venda||vendaAnterior?.codigo_venda||'#'+vendaId}`);
    if(!sincronizacao.ok){
      toast('Venda salva, mas o Finanças não foi atualizado: '+sincronizacao.message,'error');
      btn.disabled=false;btn.textContent=isNew?'+ Registrar Venda':'✓ Salvar Alterações';
      return;
    }

    if(statusAnterior !== 'ENTREGUE') {
      const estoqueRes = await ajustarEstoqueVenda(vendaId, 'baixar');
      if(!estoqueRes.ok) {
        toast('Financeiro gerado, mas houve erro ao baixar estoque: '+estoqueRes.message,'error');
      }
    }
  }

  toast(isNew?'Venda registrada!':'Venda atualizada!','success');
  
  // Salvar itens atuais antes de recarregar
  const itensAtual = [...itensVenda];
  const isNovoSalvo = isNew;
  if(isNovoSalvo){
    await finalizarCadastroNovo();
    return;
  }
  
  await loadItems();
  
  // Restaurar itens e abrir o pedido sem recarregar do banco
  itensVenda = itensAtual;
  currentId = vendaId;
  isNew = false;
  formularioAlterado = false;
  
  // Atualizar apenas a sidebar e o botão salvar, sem recriar o form
  renderList();
  const btnSave = document.getElementById('btn-save');
  if(btnSave) { btnSave.disabled=false; btnSave.textContent='✓ Salvar Alterações'; }
  
  // Atualizar header
  const venda = items.find(v=>v.id_venda===vendaId);
  if(venda) showHeader(venda.codigo_venda||`Venda #${vendaId}`, `#${vendaId}`, `cadastrado em ${new Date(venda.data_cadastro||Date.now()).toLocaleDateString('pt-BR')}`);
}

async function marcarEntregue(idVenda) {
  await loadCacheCobrancas();
  const venda = items.find(x=>x.id_venda===idVenda) || {};
  let integracao={ativa:false,contas:[],categoria:null};
  try{integracao=await carregarIntegracaoFinancas('entrada');}catch(e){toast('Não foi possível consultar o Finanças: '+e.message,'error');return;}
  if(integracao.ativa&&!integracao.categoria){toast('Cadastre a categoria Vendas no sistema Finanças.','error');return;}
  if(integracao.ativa&&!integracao.contas.length){toast('Cadastre uma conta ativa no sistema Finanças.','error');return;}
  const pagamentoAtual = venda.meio_pagamento || '';
  const vencimentoAtual = venda.data_vencimento || toLocalDateInput();
  const parcelasAtual = Math.max(1, Number(venda.quantidade_parcelas || 1));
  const diasAtual = Math.max(0, Number(venda.dias_vencimento || 0));

  // Modal de confirmação de entrega
  const pagOpts = cacheCobrancas.map(t=>`<option value="${t.descricao}" ${pagamentoAtual===t.descricao?'selected':''}>${t.descricao}</option>`).join('');
  const modalHtml = `
    <div class="modal-overlay" id="entrega-modal" style="display:flex;">
      <div class="modal" style="max-width:440px;">
        <div class="modal-header">
          <span class="modal-title">✅ Confirmar Entrega</span>
          <button class="modal-close" onclick="document.getElementById('entrega-modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Data de Entrega</label>
            <input class="form-input" type="datetime-local" id="entrega-data" value="${toLocalDateTimeInput()}"/>
          </div>
          ${integracao.ativa?`<div class="form-group" style="margin-bottom:14px;"><label class="form-label">Conta no Finanças *</label><select class="form-input form-select" id="entrega-conta-financas">${opcoesContasFinancas(integracao.contas,venda.id_conta_financas)}</select><div style="font-size:11px;color:var(--text3);">Categoria: Vendas · lançamento pendente até o recebimento.</div></div>`:''}
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Meio de Pagamento</label>
            <select class="form-input form-select" id="entrega-pagamento">
              <option value="">Selecione...</option>
              ${pagOpts}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Data de Vencimento</label>
            <input class="form-input" type="date" id="entrega-vencimento" value="${vencimentoAtual}"/>
          </div>
          <div class="form-grid" style="margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label">Parcelas</label>
              <input class="form-input" type="number" min="1" step="1" id="entrega-parcelas" value="${parcelasAtual}"/>
            </div>
            <div class="form-group">
              <label class="form-label">Dias entre vencimentos</label>
              <input class="form-input" type="number" min="0" step="1" id="entrega-dias" value="${diasAtual}"/>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Observações</label>
            <textarea class="form-textarea" id="entrega-obs" placeholder="Observações..." style="min-height:60px;"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('entrega-modal').remove()">Cancelar</button>
          <button class="btn btn-primary" id="btn-confirmar-entrega" onclick="confirmarEntrega(${idVenda})">✅ Confirmar Entrega</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function confirmarEntrega(idVenda) {
  const dataEntrega = document.getElementById('entrega-data').value;
  const pagamento = document.getElementById('entrega-pagamento').value;
  const vencimento = document.getElementById('entrega-vencimento').value;
  const parcelasEntrega = Math.max(1, parseInt(document.getElementById('entrega-parcelas')?.value||'1',10)||1);
  const diasEntrega = Math.max(0, parseInt(document.getElementById('entrega-dias')?.value||'0',10)||0);
  const obs = document.getElementById('entrega-obs').value.trim();
  const contaFinancas=Number(document.getElementById('entrega-conta-financas')?.value||0);

  if(!pagamento){ toast('Selecione o meio de pagamento','error'); return; }
  if(document.getElementById('entrega-conta-financas')&&!contaFinancas){toast('Confirme a conta do Finanças','error');return;}
  const btn = document.getElementById('btn-confirmar-entrega');
  if(btn){ btn.disabled = true; btn.textContent = 'Confirmando...'; }

  // Atualizar venda
  const venda = items.find(x=>x.id_venda===idVenda);
  const dataEntregaISO = localDateTimeToISO(dataEntrega) || new Date().toISOString();
  const dadosEntrega = {
    status_entrega:'ENTREGUE',
    data_entrega: dataEntregaISO,
    meio_pagamento: pagamento,
    quantidade_parcelas: parcelasEntrega,
    dias_vencimento: diasEntrega,
    data_vencimento: vencimento||null
  };
  if(contaFinancas)dadosEntrega.id_conta_financas=contaFinancas;
  const vendaRes = await apiPatch(`vendas?id_venda=eq.${idVenda}`, dadosEntrega);
  if(!vendaRes.ok) {
    toast('Erro ao confirmar entrega: '+(vendaRes.data?.message||'erro'),'error');
    if(btn){ btn.disabled = false; btn.textContent = '✅ Confirmar Entrega'; }
    return;
  }

  const vendaAtualizada = { ...venda, ...dadosEntrega };
  const contaRes = await gerarContasReceberVenda(idVenda, vendaAtualizada, {
    meio_pagamento: pagamento,
    quantidade_parcelas: parcelasEntrega,
    dias_vencimento: diasEntrega,
    data_vencimento: vencimento || null,
    recebido: false,
    observacoes: obs
  });
  if(!contaRes.ok) {
    console.error('Erro ao salvar conta a receber:', contaRes.data);
    toast('Entrega confirmada mas houve erro ao gerar conta a receber: '+(contaRes.data?.message||''),'error');
    if(btn){ btn.disabled = false; btn.textContent = '✅ Confirmar Entrega'; }
    return;
  }
  if(contaFinancas){
    const integracao=await carregarIntegracaoFinancas('entrada');
    const titulos=await apiGet(`contas_receber?select=*&id_venda=eq.${idVenda}&order=numero_parcela.asc`);
    const vinculo=await vincularMovimentosFinancas('contas_receber','id_conta',titulos,{ativa:true,tipo:'entrada',contaId:contaFinancas,categoria:integracao.categoria,descricao:`Venda ${venda.codigo_venda||'#'+idVenda}`,documento:venda.codigo_venda});
    if(!vinculo.ok){toast('Entrega confirmada, mas a integração financeira falhou: '+vinculo.message,'error');return;}
  }

  if(venda?.status_entrega !== 'ENTREGUE') {
    const estoqueRes = await ajustarEstoqueVenda(idVenda, 'baixar');
    if(!estoqueRes.ok) {
      toast('Entrega confirmada, mas houve erro ao baixar estoque: '+estoqueRes.message,'error');
    }
  }

  document.getElementById('entrega-modal')?.remove();
  toast('Entrega confirmada e conta a receber gerada em aberto!','success');
  await finalizarCadastroNovo();
}

async function cancelarEntrega(idVenda) {
  const venda = items.find(x=>x.id_venda===idVenda);
  const codigo = venda?.codigo_venda ? ` ${venda.codigo_venda}` : '';
  if(!confirm(`Cancelar a entrega${codigo}? A venda voltará para PENDENTE e as contas a receber vinculadas serão excluídas.`)) return;

  const res = await apiPatch(`vendas?id_venda=eq.${idVenda}`,{
    status_entrega:'PENDENTE',
    data_entrega:null,
    meio_pagamento:null,
    data_vencimento:null
  });
  if(!res.ok) {
    toast('Erro ao cancelar entrega: '+(res.data?.message||'erro'),'error');
    return;
  }

  if(venda?.status_entrega === 'ENTREGUE') {
    const estoqueRes = await ajustarEstoqueVenda(idVenda, 'devolver');
    if(!estoqueRes.ok) {
      toast('Entrega cancelada, mas houve erro ao devolver estoque: '+estoqueRes.message,'error');
    }
  }

  const contasOk = await apiDelete(`contas_receber?id_venda=eq.${idVenda}`);
  if(!contasOk) {
    toast('Entrega cancelada, mas houve erro ao excluir contas a receber.','error');
  } else {
    invalidarResumoContasVendas();
    toast('Entrega cancelada e contas a receber removidas.','success');
  }

  await loadItems();
  openItem(idVenda);
}

async function confirmDeleteVenda(idVenda) {
  const venda = items.find(x => Number(x.id_venda) === Number(idVenda)) || {};
  const codigo = venda.codigo_venda ? ` ${venda.codigo_venda}` : '';
  const contas = await apiGet(`contas_receber?select=id_conta,valor_original,valor_recebido,status_recebimento&id_venda=eq.${idVenda}`);
  const pago = Array.isArray(contas) && contas.some(c => c.status_recebimento === 'RECEBIDO' || Number(c.valor_recebido || 0) > 0);
  let mensagem = `Excluir permanentemente a venda${codigo}? Isso devolverá estoque (se a entrega já foi confirmada) e excluirá todas as contas a receber vinculadas.`;
  if(pago) {
    mensagem += ' Há registro(s) de recebimento já marcado(s). Deseja continuar?';
  }
  if(!confirm(mensagem)) return;
  await deleteVenda(idVenda, venda);
}

async function deleteVenda(idVenda, venda = {}) {
  let estoqueOk = { ok:true };
  if(venda.status_entrega === 'ENTREGUE') {
    estoqueOk = await ajustarEstoqueVenda(idVenda, 'devolver');
    if(!estoqueOk.ok) {
      toast('Erro ao devolver estoque: '+estoqueOk.message,'error');
      return;
    }
  }

  const contasRes = await apiDelete(`contas_receber?id_venda=eq.${idVenda}`);
  if(!contasRes) {
    toast('Erro ao excluir contas a receber.','error');
    return;
  }
  invalidarResumoContasVendas();

  const itensRes = await apiDelete(`venda_itens?id_venda=eq.${idVenda}`);
  if(!itensRes) {
    toast('Erro ao excluir itens da venda.','error');
    return;
  }

  const vendaRes = await apiDelete(`vendas?id_venda=eq.${idVenda}`);
  if(!vendaRes) {
    toast('Erro ao excluir a venda.','error');
    return;
  }

  toast('Venda excluída com sucesso.','success');
  await loadItems();
  cancelForm();
}
