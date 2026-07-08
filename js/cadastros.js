async function renderFormCadastro(c) {
  await loadCacheCobrancas();
  const v=f=>c?(c[f]??''):'';
  const cobrancas = Array.isArray(cacheCobrancas) ? cacheCobrancas : [];
  const pagOpts = cobrancas.map(t=>`<option value="${t.descricao}" ${v('meio_pagamento_padrao')===t.descricao?'selected':''}>${t.descricao}</option>`).join('');
  document.getElementById('content-body').innerHTML=`
    <div class="section-label"><span>Identificação</span><button class="btn-search-cnpj" onclick="openCNPJModal('update')">🔍 Buscar CNPJ</button></div>
    <div class="form-grid">
      <div class="form-group full"><label class="form-label">Razão Social *</label><input class="form-input" id="f-razao_social" value="${v('razao_social')}" placeholder="Nome jurídico"/></div>
      <div class="form-group"><label class="form-label">Nome Fantasia</label><input class="form-input" id="f-nome_fantasia" value="${v('nome_fantasia')}" placeholder="Nome comercial"/></div>
      <div class="form-group"><label class="form-label">CPF / CNPJ</label><input class="form-input" id="f-cpf_cnpj" value="${v('cpf_cnpj')}" placeholder="00.000.000/0001-00"/></div>
    </div>
    <div class="section-label"><span>Contato</span></div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Telefone</label><input class="form-input" id="f-telefone" value="${v('telefone')}" placeholder="(41) 99999-9999"/></div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="f-email" value="${v('email')}" placeholder="contato@empresa.com"/></div>
    </div>
    <div class="section-label"><span>Endereço</span></div>
    <div class="form-grid">
      <div class="form-group full"><label class="form-label">Logradouro</label><input class="form-input" id="f-endereco" value="${v('endereco')}" placeholder="Rua, Avenida..."/></div>
      <div class="form-group" style="max-width:110px"><label class="form-label">Número</label><input class="form-input" id="f-numero" value="${v('numero')}" placeholder="123"/></div>
      <div class="form-group"><label class="form-label">Bairro</label><input class="form-input" id="f-bairro" value="${v('bairro')}" placeholder="Bairro"/></div>
      <div class="form-group"><label class="form-label">Cidade</label><input class="form-input" id="f-cidade" value="${v('cidade')}" placeholder="Cidade"/></div>
      <div class="form-group" style="max-width:80px"><label class="form-label">UF</label><input class="form-input" id="f-estado" value="${v('estado')}" placeholder="PR" maxlength="2"/></div>
      <div class="form-group"><label class="form-label">CEP</label><input class="form-input" id="f-cep" value="${v('cep')}" placeholder="00000-000"/></div>
    </div>
    <div class="section-label"><span>Condição Padrão de Venda</span></div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Pagamento Padrão</label><select class="form-input form-select" id="f-meio_pagamento_padrao"><option value="">Sem padrão</option>${pagOpts}</select></div>
      <div class="form-group"><label class="form-label">Parcelas Padrão</label><input class="form-input" type="number" min="1" step="1" id="f-parcelas_padrao" value="${v('parcelas_padrao')||''}" placeholder="Ex: 1"/></div>
    </div>
    <div class="section-label"><span>Observações</span></div>
    <div class="form-group"><textarea class="form-textarea" id="f-observacoes" placeholder="Informações adicionais...">${v('observacoes')}</textarea></div>
    <div class="section-label"><span>Status</span></div>
    <div class="toggle-row">
      <div class="toggle-info"><strong>Ativo</strong><span>Registros inativos ficam ocultos</span></div>
      <label class="toggle"><input type="checkbox" id="f-ativo" ${(!c||c.ativo)?'checked':''}/><span class="toggle-slider"></span></label>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save" onclick="saveCadastro()">${isNew?'+ Cadastrar':'✓ Salvar'}</button>
      ${!isNew?`<button class="btn btn-danger" onclick="toggleAtivo()">${c&&c.ativo?'✕ Desativar':'✓ Reativar'}</button>`:''}
      <button class="btn btn-secondary" onclick="cancelForm()">Cancelar</button>
    </div>`;
}

async function saveCadastro() {
  const cfg=tabConfig[currentTab];
  const razao=document.getElementById('f-razao_social').value.trim();
  if(!razao){ toast('Razão Social é obrigatória','error'); return; }
  const btn=document.getElementById('btn-save');
  btn.disabled=true; btn.textContent='Salvando...';
  const g=id=>document.getElementById(id)?.value.trim()||null;
  const parcelasPadrao = parseInt(g('f-parcelas_padrao')||'',10);
  const data={razao_social:razao,nome_fantasia:g('f-nome_fantasia'),cpf_cnpj:g('f-cpf_cnpj'),telefone:g('f-telefone'),email:g('f-email'),endereco:g('f-endereco'),numero:g('f-numero'),bairro:g('f-bairro'),cidade:g('f-cidade'),estado:(g('f-estado')||'').toUpperCase()||null,cep:g('f-cep'),observacoes:g('f-observacoes'),ativo:document.getElementById('f-ativo').checked};
  if(currentTab==='clientes') {
    data.meio_pagamento_padrao = g('f-meio_pagamento_padrao');
    data.parcelas_padrao = Number.isFinite(parcelasPadrao)&&parcelasPadrao>0?parcelasPadrao:null;
  }
  if(isNew){
    const{ok,data:res}=await apiPost(cfg.table,data);
    if(ok){toast(cfg.label+' cadastrado!','success');await loadItems();const n=Array.isArray(res)?res[0]:res;if(n)openItem(n[cfg.id]);}
    else{toast('Erro: '+(res?.message||'erro'),'error');btn.disabled=false;btn.textContent='+ Cadastrar';}
  } else {
    const{ok,data:res}=await apiPatch(`${cfg.table}?${cfg.id}=eq.${currentId}`,data);
    if(ok){toast('Salvo!','success');await loadItems();openItem(currentId);}
    else{toast('Erro: '+(res?.message||'erro'),'error');btn.disabled=false;btn.textContent='✓ Salvar';}
  }
}

function fillForm(data) {
  ['razao_social','nome_fantasia','cpf_cnpj','telefone','email','endereco','numero','bairro','cidade','estado','cep','observacoes'].forEach(f=>{
    const el=document.getElementById('f-'+f); if(el&&data[f]) el.value=data[f];
  });
  toast('Dados preenchidos! Revise e salve.','info');
}

async function toggleAtivo() {
  const cfg=tabConfig[currentTab];
  const c=items.find(x=>x[cfg.id]===currentId);
  if(!c) return;
  const{ok}=await apiPatch(`${cfg.table}?${cfg.id}=eq.${currentId}`,{ativo:!c.ativo});
  if(ok){toast(c.ativo?'Desativado!':'Reativado!','success');await loadItems();openItem(currentId);}
  else toast('Erro','error');
}


function openCNPJModal(mode) {
  cnpjMode=mode; cnpjSelectedData=null;
  const pre=mode==='update'?(document.getElementById('f-cpf_cnpj')?.value||''):'';
  document.getElementById('cnpj-query').value=pre.trim();
  document.getElementById('cnpj-results').innerHTML='';
  document.getElementById('cnpj-footer').style.display='none';
  document.getElementById('cnpj-modal').style.display='flex';
  setTimeout(()=>document.getElementById('cnpj-query').focus(),100);
}
function closeCNPJModal(){ document.getElementById('cnpj-modal').style.display='none'; }

async function doCNPJSearch() {
  const q=document.getElementById('cnpj-query').value.trim();
  if(!q) return;
  const div=document.getElementById('cnpj-results');
  div.innerHTML='<div class="loading"><div class="spinner"></div> Buscando na Receita Federal...</div>';
  document.getElementById('cnpj-footer').style.display='none';
  try {
    const res=await fetch('/.netlify/functions/buscar-cliente',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})});
    const parsed=await res.json();
    if(!parsed?.resultados?.length){
      div.innerHTML='<div style="padding:20px;text-align:center;color:var(--text2);">Nenhum resultado. Verifique o CNPJ.</div>';
      return;
    }
    cnpjSelectedData=parsed.resultados[0];
    div.innerHTML=parsed.resultados.map((r,i)=>`
      <div class="result-card ${parsed.resultados.length===1?'selected':''}" id="rc-${i}" onclick="selectCNPJ(${i})">
        <div class="result-card-name">${r.nome_fantasia||r.razao_social||'—'}</div>
        <div class="result-card-detail">
          ${r.razao_social&&r.nome_fantasia?`📋 <span>${r.razao_social}</span><br/>`:''}
          ${r.cpf_cnpj?`🪪 <span>${r.cpf_cnpj}</span><br/>`:''}
          ${r.telefone?`📞 <span>${r.telefone}</span><br/>`:''}
          ${r.cidade?`📍 <span>${[r.endereco,r.numero,r.bairro,r.cidade,r.estado].filter(Boolean).join(', ')}</span>`:''}
        </div>
      </div>`).join('');
    div.dataset.res=JSON.stringify(parsed.resultados);
    document.getElementById('cnpj-footer').style.display='flex';
  } catch(e){
    div.innerHTML=`<div style="padding:16px;color:var(--danger);font-size:13px;">Erro: ${e.message}</div>`;
  }
}

function selectCNPJ(i){
  const res=JSON.parse(document.getElementById('cnpj-results').dataset.res||'[]');
  document.querySelectorAll('.result-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById('rc-'+i)?.classList.add('selected');
  cnpjSelectedData=res[i];
}

function useCNPJResult(){
  if(!cnpjSelectedData) return;
  closeCNPJModal();
  if(cnpjMode==='new'){openNew();setTimeout(()=>fillForm(cnpjSelectedData),50);}
  else fillForm(cnpjSelectedData);
}

let clienteDashPeriodo = '7';
let clienteDashInicio = '';
let clienteDashFim = '';
let fornecedorDashPeriodo = '7';
let fornecedorDashInicio = '';
let fornecedorDashFim = '';

function clienteDashDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function clienteDashRange() {
  const hoje = new Date();
  const fim = clienteDashPeriodo === 'custom' && clienteDashFim ? clienteDashFim : clienteDashDateStr(hoje);
  if(clienteDashPeriodo === 'custom') {
    const inicio = clienteDashInicio || clienteDashDateStr(new Date(hoje.getTime()-6*864e5));
    return { inicio, fim, label: `${new Date(inicio+'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(fim+'T00:00:00').toLocaleDateString('pt-BR')}` };
  }
  const dias = parseInt(clienteDashPeriodo,10) || 7;
  const inicio = clienteDashDateStr(new Date(hoje.getTime()-(dias-1)*864e5));
  return { inicio, fim, label: `Ultimos ${dias} dias` };
}

function fornecedorDashRange() {
  const hoje = new Date();
  const fim = fornecedorDashPeriodo === 'custom' && fornecedorDashFim ? fornecedorDashFim : clienteDashDateStr(hoje);
  if(fornecedorDashPeriodo === 'custom') {
    const inicio = fornecedorDashInicio || clienteDashDateStr(new Date(hoje.getTime()-6*864e5));
    return { inicio, fim, label: `${new Date(inicio+'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(fim+'T00:00:00').toLocaleDateString('pt-BR')}` };
  }
  const dias = parseInt(fornecedorDashPeriodo,10) || 7;
  const inicio = clienteDashDateStr(new Date(hoje.getTime()-(dias-1)*864e5));
  return { inicio, fim, label: `Ultimos ${dias} dias` };
}

async function renderDashboardFornecedores() {
  const body = document.getElementById('content-body');
  const fmt = n => 'R$ '+Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const range = fornecedorDashRange();

  body.innerHTML = '<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando dashboard...</div>';

  let compras = await apiGet(`compras?select=id_compra,codigo_compra,data_compra,valor_total,status_compra,id_fornecedor&data_compra=gte.${range.inicio}&data_compra=lte.${range.fim}T23:59:59&order=data_compra.desc`);
  if(!Array.isArray(compras)) compras = [];
  const nomeFornecedor = id => {
    const f = items.find(x=>Number(x.id_fornecedor)===Number(id));
    return f?.nome_fantasia || f?.razao_social || `Fornecedor #${id}`;
  };

  const fornecedorMap = {};
  compras.forEach(c => {
    const id = c.id_fornecedor || 0;
    const nome = nomeFornecedor(id);
    if(!fornecedorMap[id]) fornecedorMap[id] = { id, nome, total:0, qtd:0, maior:0, ultima:null, liberadas:0, pendentes:0 };
    fornecedorMap[id].total += Number(c.valor_total||0);
    fornecedorMap[id].qtd++;
    if(c.status_compra === 'LIBERADA') fornecedorMap[id].liberadas++;
    if(c.status_compra === 'PENDENTE') fornecedorMap[id].pendentes++;
    if(Number(c.valor_total||0) > fornecedorMap[id].maior) fornecedorMap[id].maior = Number(c.valor_total||0);
    if(!fornecedorMap[id].ultima || String(c.data_compra||'') > String(fornecedorMap[id].ultima||'')) fornecedorMap[id].ultima = c.data_compra;
  });

  const fornecedores = Object.values(fornecedorMap).sort((a,b)=>b.total-a.total);
  const maioresCompras = [...compras].sort((a,b)=>Number(b.valor_total||0)-Number(a.valor_total||0)).slice(0,12);
  const totalPeriodo = compras.reduce((s,c)=>s+Number(c.valor_total||0),0);
  const ticketMedio = compras.length ? totalPeriodo / compras.length : 0;
  const maiorCompra = maioresCompras[0] ? Number(maioresCompras[0].valor_total||0) : 0;
  const melhorFornecedor = fornecedores[0];
  const liberadas = compras.filter(c=>c.status_compra==='LIBERADA').length;
  const pendentes = compras.filter(c=>c.status_compra==='PENDENTE').length;

  const periodoBtns = ['7','15','30'].map(p=>`<button class="dash-period-btn ${fornecedorDashPeriodo===p?'active':''}" onclick="mudarPeriodoFornecedores('${p}')">${p}d</button>`).join('');
  const customAtivo = fornecedorDashPeriodo === 'custom';

  body.innerHTML = `
    <div class="dash-chart-box" style="margin-bottom:14px;">
      <div class="dash-chart-title">
        <span>Dashboard de Fornecedores</span>
        <div class="dash-chart-period">
          ${periodoBtns}
          <button class="dash-period-btn ${customAtivo?'active':''}" onclick="mudarPeriodoFornecedores('custom')">Periodo</button>
        </div>
      </div>
      <div class="form-grid compact" style="${customAtivo?'':'display:none;'}margin-top:8px;">
        <div class="form-group">
          <label class="form-label">Inicio</label>
          <input class="form-input" type="date" id="fornecedor-dash-inicio" value="${range.inicio}" onchange="atualizarPeriodoFornecedores()"/>
        </div>
        <div class="form-group">
          <label class="form-label">Fim</label>
          <input class="form-input" type="date" id="fornecedor-dash-fim" value="${range.fim}" onchange="atualizarPeriodoFornecedores()"/>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-top:8px;">Periodo analisado: ${range.label}</div>
    </div>

    <div class="dash-grid">
      <div class="dash-card green">
        <div class="dash-card-label">Compras no Periodo</div>
        <div class="dash-card-value">${fmt(totalPeriodo)}</div>
        <div class="dash-card-sub">${compras.length} compra${compras.length!==1?'s':''}</div>
      </div>
      <div class="dash-card blue">
        <div class="dash-card-label">Fornecedores Ativos</div>
        <div class="dash-card-value">${fornecedores.length}</div>
        <div class="dash-card-sub">${items.length} fornecedor${items.length!==1?'es':''} no cadastro</div>
      </div>
      <div class="dash-card orange">
        <div class="dash-card-label">Ticket Medio</div>
        <div class="dash-card-value">${fmt(ticketMedio)}</div>
        <div class="dash-card-sub">por compra</div>
      </div>
      <div class="dash-card red">
        <div class="dash-card-label">Maior Compra</div>
        <div class="dash-card-value">${fmt(maiorCompra)}</div>
        <div class="dash-card-sub">${maioresCompras[0]?.codigo_compra||'-'}</div>
      </div>
    </div>

    <div class="dash-grid" style="grid-template-columns:repeat(auto-fit,minmax(145px,1fr));">
      <div class="dash-card green" style="cursor:default;"><div class="dash-card-label">Liberadas</div><div class="dash-card-value">${liberadas}</div><div class="dash-card-sub">compras finalizadas</div></div>
      <div class="dash-card orange" style="cursor:default;"><div class="dash-card-label">Pendentes</div><div class="dash-card-value">${pendentes}</div><div class="dash-card-sub">aguardando liberacao</div></div>
    </div>

    <div class="dash-charts">
      <div class="dash-chart-box">
        <div class="dash-chart-title"><span>Maiores Fornecedores por Compra</span></div>
        <div class="dash-list">
          ${fornecedores.length ? fornecedores.slice(0,10).map((f,i)=>{
            const pct = fornecedores[0].total > 0 ? (f.total/fornecedores[0].total*100).toFixed(0) : 0;
            return `<div class="dash-list-item" onclick="openItem(${f.id})">
              <span class="dash-list-rank">${i+1}</span>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
                  <span class="dash-list-name">${f.nome}</span>
                  <span class="dash-list-value">${fmt(f.total)}</span>
                </div>
                <div style="font-size:11px;color:var(--text2);">${f.qtd} compra${f.qtd!==1?'s':''} - maior ${fmt(f.maior)}</div>
                <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${pct}%"></div></div>
              </div>
            </div>`;
          }).join('') : '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;">Nenhuma compra no periodo</div>'}
        </div>
      </div>

      <div class="dash-chart-box">
        <div class="dash-chart-title"><span>Maiores Compras</span></div>
        <div class="dash-list">
          ${maioresCompras.length ? maioresCompras.map((c,i)=>{
            const nome = nomeFornecedor(c.id_fornecedor);
            const data = c.data_compra ? new Date(c.data_compra).toLocaleDateString('pt-BR') : '-';
            return `<div class="dash-list-item" onclick="abrirCompraDoDashboardFornecedores(${c.id_compra})">
              <span class="dash-list-rank">${i+1}</span>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
                  <span class="dash-list-name">${nome}</span>
                  <span class="dash-list-value">${fmt(c.valor_total)}</span>
                </div>
                <div style="font-size:11px;color:var(--text2);">${c.codigo_compra||'#'+c.id_compra} - ${data} - ${c.status_compra||'-'}</div>
              </div>
            </div>`;
          }).join('') : '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;">Nenhuma compra no periodo</div>'}
        </div>
      </div>
    </div>

    <div class="dash-chart-box">
      <div class="dash-chart-title"><span>Resumo do Melhor Fornecedor</span></div>
      ${melhorFornecedor ? `<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:12px;align-items:center;">
        <div>
          <div style="font-size:16px;font-weight:600;color:var(--text);">${melhorFornecedor.nome}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:4px;">Ultima compra: ${melhorFornecedor.ultima?new Date(melhorFornecedor.ultima).toLocaleDateString('pt-BR'):'-'}</div>
        </div>
        <div><div class="dash-card-label">Total</div><div class="dash-list-value">${fmt(melhorFornecedor.total)}</div></div>
        <div><div class="dash-card-label">Compras</div><div class="dash-list-value">${melhorFornecedor.qtd}</div></div>
        <div><div class="dash-card-label">Maior</div><div class="dash-list-value">${fmt(melhorFornecedor.maior)}</div></div>
      </div>` : '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;">Sem compras no periodo selecionado</div>'}
    </div>`;
}

async function mudarPeriodoFornecedores(periodo) {
  fornecedorDashPeriodo = periodo;
  if(periodo === 'custom' && (!fornecedorDashInicio || !fornecedorDashFim)) {
    const range = fornecedorDashRange();
    fornecedorDashInicio = range.inicio;
    fornecedorDashFim = range.fim;
  }
  await renderDashboardFornecedores();
}

async function atualizarPeriodoFornecedores() {
  fornecedorDashPeriodo = 'custom';
  fornecedorDashInicio = document.getElementById('fornecedor-dash-inicio')?.value || fornecedorDashInicio;
  fornecedorDashFim = document.getElementById('fornecedor-dash-fim')?.value || fornecedorDashFim;
  await renderDashboardFornecedores();
}

async function abrirCompraDoDashboardFornecedores(idCompra) {
  await switchTab('compras');
  openItem(idCompra);
}

async function renderDashboardClientes() {
  const body = document.getElementById('content-body');
  const fmt = n => 'R$ '+Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const range = clienteDashRange();

  body.innerHTML = '<div class="loading" style="padding:40px 0;justify-content:center;"><div class="spinner"></div> Carregando dashboard...</div>';

  const vendas = await apiGet(`vendas?select=id_venda,codigo_venda,data_venda,valor_final,status_entrega,id_cliente,clientes(nome_fantasia,razao_social)&data_venda=gte.${range.inicio}&data_venda=lte.${range.fim}T23:59:59&order=data_venda.desc`);
  if(!Array.isArray(vendas)) {
    body.innerHTML = '<div class="empty-state"><div class="empty-icon">!</div><p>Erro ao carregar vendas dos clientes</p></div>';
    return;
  }

  const clienteMap = {};
  vendas.forEach(v => {
    const id = v.id_cliente || 0;
    const nome = v.clientes?.nome_fantasia || v.clientes?.razao_social || `Cliente #${id}`;
    if(!clienteMap[id]) clienteMap[id] = { id, nome, total:0, qtd:0, maior:0, ultima:null };
    clienteMap[id].total += Number(v.valor_final||0);
    clienteMap[id].qtd++;
    if(Number(v.valor_final||0) > clienteMap[id].maior) clienteMap[id].maior = Number(v.valor_final||0);
    if(!clienteMap[id].ultima || String(v.data_venda||'') > String(clienteMap[id].ultima||'')) clienteMap[id].ultima = v.data_venda;
  });

  const clientes = Object.values(clienteMap).sort((a,b)=>b.total-a.total);
  const maioresVendas = [...vendas].sort((a,b)=>Number(b.valor_final||0)-Number(a.valor_final||0)).slice(0,12);
  const totalPeriodo = vendas.reduce((s,v)=>s+Number(v.valor_final||0),0);
  const ticketMedio = vendas.length ? totalPeriodo / vendas.length : 0;
  const maiorVenda = maioresVendas[0] ? Number(maioresVendas[0].valor_final||0) : 0;
  const melhorCliente = clientes[0];

  const periodoBtns = ['7','15','30'].map(p=>`<button class="dash-period-btn ${clienteDashPeriodo===p?'active':''}" onclick="mudarPeriodoClientes('${p}')">${p}d</button>`).join('');
  const customAtivo = clienteDashPeriodo === 'custom';

  body.innerHTML = `
    <div class="dash-chart-box" style="margin-bottom:14px;">
      <div class="dash-chart-title">
        <span>Dashboard de Clientes</span>
        <div class="dash-chart-period">
          ${periodoBtns}
          <button class="dash-period-btn ${customAtivo?'active':''}" onclick="mudarPeriodoClientes('custom')">Periodo</button>
        </div>
      </div>
      <div class="form-grid compact" style="${customAtivo?'':'display:none;'}margin-top:8px;">
        <div class="form-group">
          <label class="form-label">Inicio</label>
          <input class="form-input" type="date" id="cliente-dash-inicio" value="${range.inicio}" onchange="atualizarPeriodoClientes()"/>
        </div>
        <div class="form-group">
          <label class="form-label">Fim</label>
          <input class="form-input" type="date" id="cliente-dash-fim" value="${range.fim}" onchange="atualizarPeriodoClientes()"/>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-top:8px;">Periodo analisado: ${range.label}</div>
    </div>

    <div class="dash-grid">
      <div class="dash-card green">
        <div class="dash-card-label">Vendas no Periodo</div>
        <div class="dash-card-value">${fmt(totalPeriodo)}</div>
        <div class="dash-card-sub">${vendas.length} pedido${vendas.length!==1?'s':''}</div>
      </div>
      <div class="dash-card blue">
        <div class="dash-card-label">Clientes com Compra</div>
        <div class="dash-card-value">${clientes.length}</div>
        <div class="dash-card-sub">${items.length} cliente${items.length!==1?'s':''} no cadastro</div>
      </div>
      <div class="dash-card orange">
        <div class="dash-card-label">Ticket Medio</div>
        <div class="dash-card-value">${fmt(ticketMedio)}</div>
        <div class="dash-card-sub">por venda</div>
      </div>
      <div class="dash-card red">
        <div class="dash-card-label">Maior Venda</div>
        <div class="dash-card-value">${fmt(maiorVenda)}</div>
        <div class="dash-card-sub">${maioresVendas[0]?.codigo_venda||'-'}</div>
      </div>
    </div>

    <div class="dash-charts">
      <div class="dash-chart-box">
        <div class="dash-chart-title"><span>Maiores Clientes por Venda</span></div>
        <div class="dash-list">
          ${clientes.length ? clientes.slice(0,10).map((c,i)=>{
            const pct = clientes[0].total > 0 ? (c.total/clientes[0].total*100).toFixed(0) : 0;
            return `<div class="dash-list-item" onclick="openItem(${c.id})">
              <span class="dash-list-rank">${i+1}</span>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
                  <span class="dash-list-name">${c.nome}</span>
                  <span class="dash-list-value">${fmt(c.total)}</span>
                </div>
                <div style="font-size:11px;color:var(--text2);">${c.qtd} venda${c.qtd!==1?'s':''} - maior ${fmt(c.maior)}</div>
                <div class="dash-list-bar"><div class="dash-list-bar-fill" style="width:${pct}%"></div></div>
              </div>
            </div>`;
          }).join('') : '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;">Nenhuma venda no periodo</div>'}
        </div>
      </div>

      <div class="dash-chart-box">
        <div class="dash-chart-title"><span>Ultimas Maiores Vendas</span></div>
        <div class="dash-list">
          ${maioresVendas.length ? maioresVendas.map((v,i)=>{
            const nome = v.clientes?.nome_fantasia || v.clientes?.razao_social || `Cliente #${v.id_cliente}`;
            const data = v.data_venda ? new Date(v.data_venda).toLocaleDateString('pt-BR') : '-';
            return `<div class="dash-list-item" onclick="abrirVendaDoDashboardClientes(${v.id_venda})">
              <span class="dash-list-rank">${i+1}</span>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
                  <span class="dash-list-name">${nome}</span>
                  <span class="dash-list-value">${fmt(v.valor_final)}</span>
                </div>
                <div style="font-size:11px;color:var(--text2);">${v.codigo_venda||'#'+v.id_venda} - ${data}</div>
              </div>
            </div>`;
          }).join('') : '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;">Nenhuma venda no periodo</div>'}
        </div>
      </div>
    </div>

    <div class="dash-chart-box">
      <div class="dash-chart-title"><span>Resumo do Melhor Cliente</span></div>
      ${melhorCliente ? `<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:12px;align-items:center;">
        <div>
          <div style="font-size:16px;font-weight:600;color:var(--text);">${melhorCliente.nome}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:4px;">Ultima compra: ${melhorCliente.ultima?new Date(melhorCliente.ultima).toLocaleDateString('pt-BR'):'-'}</div>
        </div>
        <div><div class="dash-card-label">Total</div><div class="dash-list-value">${fmt(melhorCliente.total)}</div></div>
        <div><div class="dash-card-label">Vendas</div><div class="dash-list-value">${melhorCliente.qtd}</div></div>
        <div><div class="dash-card-label">Maior</div><div class="dash-list-value">${fmt(melhorCliente.maior)}</div></div>
      </div>` : '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;">Sem vendas no periodo selecionado</div>'}
    </div>`;
}

async function mudarPeriodoClientes(periodo) {
  clienteDashPeriodo = periodo;
  if(periodo === 'custom' && (!clienteDashInicio || !clienteDashFim)) {
    const range = clienteDashRange();
    clienteDashInicio = range.inicio;
    clienteDashFim = range.fim;
  }
  await renderDashboardClientes();
}

async function atualizarPeriodoClientes() {
  clienteDashPeriodo = 'custom';
  clienteDashInicio = document.getElementById('cliente-dash-inicio')?.value || clienteDashInicio;
  clienteDashFim = document.getElementById('cliente-dash-fim')?.value || clienteDashFim;
  await renderDashboardClientes();
}

async function abrirVendaDoDashboardClientes(idVenda) {
  await switchTab('vendas');
  openItem(idVenda);
}

// Versao final do formulario de cadastro, com historico de produtos comprados no cliente.
async function renderFormCadastro(c) {
  await loadCacheCobrancas();
  const v=f=>c?(c[f]??''):'';
  const cobrancas = Array.isArray(cacheCobrancas) ? cacheCobrancas : [];
  const pagOpts = cobrancas.map(t=>`<option value="${t.descricao}" ${v('meio_pagamento_padrao')===t.descricao?'selected':''}>${t.descricao}</option>`).join('');
  document.getElementById('content-body').innerHTML=`
    <div class="section-label"><span>Identificacao</span><button class="btn-search-cnpj" onclick="openCNPJModal('update')">Buscar CNPJ</button></div>
    <div class="form-grid">
      <div class="form-group full"><label class="form-label">Razao Social *</label><input class="form-input" id="f-razao_social" value="${v('razao_social')}" placeholder="Nome juridico"/></div>
      <div class="form-group"><label class="form-label">Nome Fantasia</label><input class="form-input" id="f-nome_fantasia" value="${v('nome_fantasia')}" placeholder="Nome comercial"/></div>
      <div class="form-group"><label class="form-label">CPF / CNPJ</label><input class="form-input" id="f-cpf_cnpj" value="${v('cpf_cnpj')}" placeholder="00.000.000/0001-00"/></div>
    </div>
    <div class="section-label"><span>Contato</span></div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Telefone</label><input class="form-input" id="f-telefone" value="${v('telefone')}" placeholder="(41) 99999-9999"/></div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="f-email" value="${v('email')}" placeholder="contato@empresa.com"/></div>
    </div>
    <div class="section-label"><span>Endereco</span></div>
    <div class="form-grid">
      <div class="form-group full"><label class="form-label">Logradouro</label><input class="form-input" id="f-endereco" value="${v('endereco')}" placeholder="Rua, Avenida..."/></div>
      <div class="form-group" style="max-width:110px"><label class="form-label">Numero</label><input class="form-input" id="f-numero" value="${v('numero')}" placeholder="123"/></div>
      <div class="form-group"><label class="form-label">Bairro</label><input class="form-input" id="f-bairro" value="${v('bairro')}" placeholder="Bairro"/></div>
      <div class="form-group"><label class="form-label">Cidade</label><input class="form-input" id="f-cidade" value="${v('cidade')}" placeholder="Cidade"/></div>
      <div class="form-group" style="max-width:80px"><label class="form-label">UF</label><input class="form-input" id="f-estado" value="${v('estado')}" placeholder="PR" maxlength="2"/></div>
      <div class="form-group"><label class="form-label">CEP</label><input class="form-input" id="f-cep" value="${v('cep')}" placeholder="00000-000"/></div>
    </div>
    ${currentTab==='clientes'?`<div class="section-label"><span>Condicao Padrao de Venda</span></div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Pagamento Padrao</label><select class="form-input form-select" id="f-meio_pagamento_padrao"><option value="">Sem padrao</option>${pagOpts}</select></div>
      <div class="form-group"><label class="form-label">Parcelas Padrao</label><input class="form-input" type="number" min="1" step="1" id="f-parcelas_padrao" value="${v('parcelas_padrao')||''}" placeholder="Ex: 1"/></div>
    </div>`:''}
    <div class="section-label"><span>Observacoes</span></div>
    <div class="form-group"><textarea class="form-textarea" id="f-observacoes" placeholder="Informacoes adicionais...">${v('observacoes')}</textarea></div>
    ${currentTab==='clientes'&&!isNew?`
      <div class="section-label"><span>Produtos Comprados</span></div>
      <div id="cliente-produtos-comprados" class="dash-chart-box" style="padding:12px;margin-bottom:14px;">
        <div class="loading" style="padding:18px 0;justify-content:center;"><div class="spinner"></div> Carregando produtos comprados...</div>
      </div>`:''}
    ${currentTab==='fornecedores'&&!isNew?`
      <div class="section-label"><span>Produtos Comprados do Fornecedor</span></div>
      <div id="fornecedor-produtos-comprados" class="dash-chart-box" style="padding:12px;margin-bottom:14px;">
        <div class="loading" style="padding:18px 0;justify-content:center;"><div class="spinner"></div> Carregando compras do fornecedor...</div>
      </div>`:''}
    <div class="section-label"><span>Status</span></div>
    <div class="toggle-row">
      <div class="toggle-info"><strong>Ativo</strong><span>Registros inativos ficam ocultos</span></div>
      <label class="toggle"><input type="checkbox" id="f-ativo" ${(!c||c.ativo)?'checked':''}/><span class="toggle-slider"></span></label>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save" onclick="saveCadastro()">${isNew?'+ Cadastrar':'Salvar'}</button>
      ${!isNew?`<button class="btn btn-danger" onclick="toggleAtivo()">${c&&c.ativo?'Desativar':'Reativar'}</button>`:''}
      <button class="btn btn-secondary" onclick="cancelForm()">Cancelar</button>
    </div>`;

  if(currentTab==='clientes'&&!isNew&&c?.id_cliente) carregarProdutosCompradosCliente(c.id_cliente);
  if(currentTab==='fornecedores'&&!isNew&&c?.id_fornecedor) carregarProdutosCompradosFornecedor(c.id_fornecedor);
}

async function carregarProdutosCompradosCliente(idCliente) {
  const alvo = document.getElementById('cliente-produtos-comprados');
  if(!alvo) return;
  const fmt = n => 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtQtd = n => Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  const vendas = await apiGet(`vendas?select=id_venda,codigo_venda,data_venda,valor_final,status_entrega&id_cliente=eq.${idCliente}&order=data_venda.desc`);
  if(!Array.isArray(vendas) || !vendas.length) {
    alvo.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:12px;">Cliente ainda nao possui compras registradas.</div>';
    return;
  }

  const ids = vendas.map(v=>Number(v.id_venda)).filter(Boolean);
  const itens = ids.length
    ? await apiGet(`venda_itens?select=id_venda,id_produto,quantidade,preco_unitario,subtotal,produtos!fk_item_produto(nome_mercadoria)&id_venda=in.(${ids.join(',')})`)
    : [];

  if(!Array.isArray(itens) || !itens.length) {
    alvo.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:12px;">Compras encontradas, mas sem itens vinculados.</div>';
    return;
  }

  const porProduto = {};
  itens.forEach(item => {
    const id = Number(item.id_produto||0);
    const nome = item.produtos?.nome_mercadoria || `Produto #${id}`;
    if(!porProduto[id]) porProduto[id] = { id, nome, qtd:0, total:0, pedidos:new Set(), ultimo:'' };
    porProduto[id].qtd += Number(item.quantidade||0);
    porProduto[id].total += Number(item.subtotal || (Number(item.quantidade||0) * Number(item.preco_unitario||0)));
    porProduto[id].pedidos.add(Number(item.id_venda));
    const venda = vendas.find(v=>Number(v.id_venda)===Number(item.id_venda));
    if(venda?.data_venda && String(venda.data_venda) > String(porProduto[id].ultimo||'')) porProduto[id].ultimo = venda.data_venda;
  });

  const produtos = Object.values(porProduto).sort((a,b)=>b.total-a.total);
  const totalComprado = produtos.reduce((s,p)=>s+p.total,0);

  alvo.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:12px;">
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px;">
        <div style="font-size:10px;color:var(--text2);font-family:var(--mono);text-transform:uppercase;">Total comprado</div>
        <div style="font-size:18px;font-weight:700;color:var(--accent);margin-top:3px;">${fmt(totalComprado)}</div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px;">
        <div style="font-size:10px;color:var(--text2);font-family:var(--mono);text-transform:uppercase;">Pedidos</div>
        <div style="font-size:18px;font-weight:700;color:var(--accent2);margin-top:3px;">${vendas.length}</div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px;">
        <div style="font-size:10px;color:var(--text2);font-family:var(--mono);text-transform:uppercase;">Produtos</div>
        <div style="font-size:18px;font-weight:700;color:var(--warn);margin-top:3px;">${produtos.length}</div>
      </div>
    </div>
    <div style="overflow:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:560px;">
        <thead><tr style="background:var(--surface2);">
          <th style="padding:9px 10px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">Produto</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Qtd</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Total</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Pedidos</th>
          <th style="padding:9px 10px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Ultima compra</th>
        </tr></thead>
        <tbody>
          ${produtos.map(p=>`
            <tr style="border-top:1px solid var(--border);">
              <td style="padding:9px 10px;">${p.nome}</td>
              <td style="padding:9px 10px;text-align:right;font-family:var(--mono);color:var(--text2);">${fmtQtd(p.qtd)}</td>
              <td style="padding:9px 10px;text-align:right;font-family:var(--mono);font-weight:700;color:var(--accent);">${fmt(p.total)}</td>
              <td style="padding:9px 10px;text-align:right;color:var(--text2);">${p.pedidos.size}</td>
              <td style="padding:9px 10px;text-align:center;color:var(--text2);">${p.ultimo?new Date(p.ultimo).toLocaleDateString('pt-BR'):'-'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function carregarProdutosCompradosFornecedor(idFornecedor) {
  const alvo = document.getElementById('fornecedor-produtos-comprados');
  if(!alvo) return;
  const fmt = n => 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtQtd = n => Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  const compras = await apiGet(`compras?select=id_compra,codigo_compra,data_compra,valor_total,status_compra&id_fornecedor=eq.${idFornecedor}&order=data_compra.desc`);
  if(!Array.isArray(compras) || !compras.length) {
    alvo.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:12px;">Fornecedor ainda nao possui compras registradas.</div>';
    return;
  }

  const ids = compras.map(c=>Number(c.id_compra)).filter(Boolean);
  const itens = ids.length
    ? await apiGet(`compra_itens?select=id_compra,id_produto,quantidade,preco_entrada,subtotal&id_compra=in.(${ids.join(',')})`)
    : [];

  if(!Array.isArray(itens) || !itens.length) {
    alvo.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:12px;">Compras encontradas, mas sem itens vinculados.</div>';
    return;
  }

  const produtoIds = [...new Set(itens.map(i=>Number(i.id_produto||0)).filter(Boolean))];
  const produtosRef = produtoIds.length
    ? await apiGet(`produtos?select=id_produto,nome_mercadoria&id_produto=in.(${produtoIds.join(',')})`)
    : [];
  const nomesProdutos = {};
  if(Array.isArray(produtosRef)) produtosRef.forEach(p=>{ nomesProdutos[Number(p.id_produto)] = p.nome_mercadoria; });

  const porProduto = {};
  itens.forEach(item => {
    const id = Number(item.id_produto||0);
    const nome = nomesProdutos[id] || `Produto #${id}`;
    if(!porProduto[id]) porProduto[id] = { id, nome, qtd:0, total:0, compras:new Set(), ultimo:'' };
    porProduto[id].qtd += Number(item.quantidade||0);
    porProduto[id].total += Number(item.subtotal || (Number(item.quantidade||0) * Number(item.preco_entrada||0)));
    porProduto[id].compras.add(Number(item.id_compra));
    const compra = compras.find(c=>Number(c.id_compra)===Number(item.id_compra));
    if(compra?.data_compra && String(compra.data_compra) > String(porProduto[id].ultimo||'')) porProduto[id].ultimo = compra.data_compra;
  });

  const produtos = Object.values(porProduto).sort((a,b)=>b.total-a.total);
  const totalComprado = produtos.reduce((s,p)=>s+p.total,0);
  const liberadas = compras.filter(c=>c.status_compra==='LIBERADA').length;
  const pendentes = compras.filter(c=>c.status_compra==='PENDENTE').length;

  alvo.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:12px;">
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px;">
        <div style="font-size:10px;color:var(--text2);font-family:var(--mono);text-transform:uppercase;">Total comprado</div>
        <div style="font-size:18px;font-weight:700;color:var(--accent);margin-top:3px;">${fmt(totalComprado)}</div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px;">
        <div style="font-size:10px;color:var(--text2);font-family:var(--mono);text-transform:uppercase;">Compras</div>
        <div style="font-size:18px;font-weight:700;color:var(--accent2);margin-top:3px;">${compras.length}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px;">${liberadas} liberada${liberadas!==1?'s':''} · ${pendentes} pendente${pendentes!==1?'s':''}</div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px;">
        <div style="font-size:10px;color:var(--text2);font-family:var(--mono);text-transform:uppercase;">Produtos</div>
        <div style="font-size:18px;font-weight:700;color:var(--warn);margin-top:3px;">${produtos.length}</div>
      </div>
    </div>
    <div style="overflow:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:560px;">
        <thead><tr style="background:var(--surface2);">
          <th style="padding:9px 10px;text-align:left;font-size:11px;color:var(--text2);font-weight:500;">Produto</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Qtd</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Total</th>
          <th style="padding:9px 10px;text-align:right;font-size:11px;color:var(--text2);font-weight:500;">Compras</th>
          <th style="padding:9px 10px;text-align:center;font-size:11px;color:var(--text2);font-weight:500;">Ultima compra</th>
        </tr></thead>
        <tbody>
          ${produtos.map(p=>`
            <tr style="border-top:1px solid var(--border);">
              <td style="padding:9px 10px;">${p.nome}</td>
              <td style="padding:9px 10px;text-align:right;font-family:var(--mono);color:var(--text2);">${fmtQtd(p.qtd)}</td>
              <td style="padding:9px 10px;text-align:right;font-family:var(--mono);font-weight:700;color:var(--accent);">${fmt(p.total)}</td>
              <td style="padding:9px 10px;text-align:right;color:var(--text2);">${p.compras.size}</td>
              <td style="padding:9px 10px;text-align:center;color:var(--text2);">${p.ultimo?new Date(p.ultimo).toLocaleDateString('pt-BR'):'-'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
