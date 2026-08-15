let notaConciliacao=null;
const notaEsc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notaNum=v=>{let s=String(v??'').trim().replace(/\s|R\$/gi,'');if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');const n=Number(s);return Number.isFinite(n)?n:0;};
const notaTxt=(el,tag)=>el?.getElementsByTagName(tag)?.[0]?.textContent?.trim()||'';
const notaNorm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const notaData=v=>{const s=String(v||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:new Date().toISOString().slice(0,10);};

async function abrirConciliacaoNotaMenu(){
  if(currentTab!=='compras')await switchTab('compras');
  setActiveMenu('compras');
  document.getElementById('di-compras')?.classList.remove('active');
  document.getElementById('di-conciliacao-notas')?.classList.add('active');
  renderConciliacaoNota();
  closeSidebar();
}

function renderConciliacaoNota(){
  document.getElementById('content-header').style.display='none';
  document.getElementById('content-body').innerHTML=`<div style="max-width:900px;margin:auto;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;"><button class="dash-period-btn" onclick="renderDashboardCompras()">Voltar</button><h2 style="font-size:18px;margin:0;">Conciliação de nota de entrada</h2></div>
    <div class="dash-chart-box"><div class="search-banner">Selecione o arquivo XML da NF-e para importar e conciliar os dados da nota.</div>
    <div class="form-group" style="margin-top:14px;"><label class="form-label">Nota fiscal (XML)</label><input class="form-input" type="file" accept=".xml,text/xml,application/xml" onchange="lerArquivoNota(this.files[0])"/></div>
    <div id="nota-leitura" style="margin-top:14px;color:var(--text2);font-size:13px;">Nenhum arquivo selecionado.</div></div></div>`;
}

async function lerArquivoNota(file){
  if(!file)return;const alvo=document.getElementById('nota-leitura');
  alvo.innerHTML='<div class="loading"><div class="spinner"></div> Lendo e conciliando nota...</div>';
  try{
    await loadCaches();await loadCacheCobrancas();
    const nome=file.name.toLowerCase();
    const nota=nome.endsWith('.xml')?parseNotaXml(await file.text()):null;
    if(!nota)throw new Error('Selecione um arquivo XML.');
    nota.nomeArquivo=file.name;conciliarNotaCadastros(nota);notaConciliacao=nota;renderPreviewNota();
  }catch(e){alvo.innerHTML=`<div style="color:var(--danger);">Não foi possível ler a nota: ${notaEsc(e.message||e)}</div>`;}
}

function parseNotaXml(xml){
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror'))throw new Error('XML inválido.');
  const inf=doc.getElementsByTagName('infNFe')[0]||doc, emit=inf.getElementsByTagName('emit')[0];
  if(!emit)throw new Error('O arquivo não contém uma NF-e reconhecida.');
  const ide=inf.getElementsByTagName('ide')[0], end=emit.getElementsByTagName('enderEmit')[0];
  const itens=[...inf.getElementsByTagName('det')].map(det=>{const p=det.getElementsByTagName('prod')[0];return {codigo:notaTxt(p,'cProd'),nome:notaTxt(p,'xProd'),unidade:notaTxt(p,'uCom')||'UN',quantidade:notaNum(notaTxt(p,'qCom')),preco:notaNum(notaTxt(p,'vUnCom')),subtotal:notaNum(notaTxt(p,'vProd')),produtoId:null};}).filter(i=>i.nome&&i.quantidade>0);
  const duplicatas=[...inf.getElementsByTagName('dup')].map(d=>({vencimento:notaTxt(d,'dVenc'),valor:notaNum(notaTxt(d,'vDup'))})).filter(d=>d.vencimento);
  const tot=inf.getElementsByTagName('ICMSTot')[0];
  const camposImpostos=['vBC','vICMS','vICMSDeson','vFCP','vBCST','vST','vFCPST','vFCPSTRet','vProd','vFrete','vSeg','vDesc','vII','vIPI','vIPIDevol','vPIS','vCOFINS','vOutro','vNF','vTotTrib'];
  const impostos=Object.fromEntries(camposImpostos.map(c=>[c,notaNum(notaTxt(tot,c))]));
  const total=impostos.vNF||itens.reduce((s,i)=>s+i.subtotal,0);
  const chave=String(inf.getAttribute?.('Id')||'').replace(/^NFe/i,'')||notaTxt(doc.getElementsByTagName('protNFe')[0],'chNFe');
  return {origem:'XML',numero:notaTxt(ide,'nNF'),serie:notaTxt(ide,'serie'),modelo:notaTxt(ide,'mod'),chave,data:notaData(notaTxt(ide,'dhEmi')||notaTxt(ide,'dEmi')),fornecedor:{cnpj:notaTxt(emit,'CNPJ')||notaTxt(emit,'CPF'),razao:notaTxt(emit,'xNome'),fantasia:notaTxt(emit,'xFant'),ie:notaTxt(emit,'IE'),endereco:notaTxt(end,'xLgr'),numero:notaTxt(end,'nro'),bairro:notaTxt(end,'xBairro'),cidade:notaTxt(end,'xMun'),estado:notaTxt(end,'UF'),cep:notaTxt(end,'CEP'),id:null},itens,duplicatas,total,impostos,xmlOriginal:xml};
}

function conciliarNotaCadastros(n){
  const cnpj=notaNorm(n.fornecedor.cnpj);
  const f=cacheFornecedores.find(x=>cnpj&&notaNorm(x.cpf_cnpj)===cnpj)||cacheFornecedores.find(x=>notaNorm(x.razao_social)===notaNorm(n.fornecedor.razao));
  n.fornecedor.id=f?.id_fornecedor||null;
  n.itens.forEach(i=>{const p=cacheProdutos.find(x=>notaNorm(x.nome_mercadoria)===notaNorm(i.nome));i.produtoId=p?.id_produto||null;i.precoVenda=p?.preco_venda||0;i.tipoId=p?.id_tipo||cacheTipos[0]?.id_tipo||null;});
}
const notaOpcoesProdutos=id=>`<option value="novo" ${!id?'selected':''}>+ Cadastrar novo produto</option>${cacheProdutos.map(p=>`<option value="${p.id_produto}" ${Number(id)===Number(p.id_produto)?'selected':''}>${notaEsc(p.nome_mercadoria)}</option>`).join('')}`;
const notaOpcoesTipos=id=>cacheTipos.map(t=>`<option value="${t.id_tipo}" ${Number(id)===Number(t.id_tipo)?'selected':''}>${notaEsc(t.descricao)}</option>`).join('');

function renderPreviewNota(){
  const n=notaConciliacao,f=n.fornecedor,parcelas=n.duplicatas.length||1,venc=n.duplicatas[0]?.vencimento||n.data;
  document.getElementById('nota-leitura').innerHTML=`<div class="section-label"><span>Conferência obrigatória</span><span class="pill warn">NADA GRAVADO</span></div>
  <div class="form-grid">
    <div class="form-group"><label class="form-label">Número da nota</label><input class="form-input" id="nota-numero" value="${notaEsc(n.numero)}"/></div>
    <div class="form-group"><label class="form-label">Chave da NF-e</label><input class="form-input" id="nota-chave" value="${notaEsc(n.chave||'')}" placeholder="44 dígitos"/></div>
    <div class="form-group"><label class="form-label">Data</label><input class="form-input" type="date" id="nota-data" value="${n.data}"/></div>
    <div class="form-group"><label class="form-label">CNPJ fornecedor</label><input class="form-input" id="nota-cnpj" value="${notaEsc(f.cnpj)}"/></div>
    <div class="form-group"><label class="form-label">Razão social</label><input class="form-input" id="nota-razao" value="${notaEsc(f.razao)}" placeholder="Obrigatório para fornecedor novo"/></div>
    <div class="form-group"><label class="form-label">Fornecedor conciliado</label><select class="form-input form-select" id="nota-fornecedor"><option value="novo" ${!f.id?'selected':''}>+ Cadastrar fornecedor da nota</option>${cacheFornecedores.map(x=>`<option value="${x.id_fornecedor}" ${Number(f.id)===Number(x.id_fornecedor)?'selected':''}>${notaEsc(x.nome_fantasia||x.razao_social)}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Total da nota</label><input class="form-input" id="nota-total" value="${n.total.toFixed(2)}"/></div>
    <div class="form-group"><label class="form-label">1º vencimento</label><input class="form-input" type="date" id="nota-vencimento" value="${venc}"/></div>
    <div class="form-group"><label class="form-label">Parcelas</label><input class="form-input" type="number" min="1" id="nota-parcelas" value="${parcelas}"/></div>
    <div class="form-group"><label class="form-label">Intervalo em dias</label><input class="form-input" type="number" min="0" id="nota-intervalo" value="${parcelas>1&&n.duplicatas[1]?Math.round((new Date(n.duplicatas[1].vencimento)-new Date(venc))/86400000):0}"/></div>
    <div class="form-group"><label class="form-label">Pagamento</label><select class="form-input form-select" id="nota-pagamento"><option value="">Selecione...</option>${cacheCobrancas.map(x=>`<option>${notaEsc(x.descricao)}</option>`).join('')}</select></div>
  </div>
  ${n.origem==='XML'?`<div class="section-label"><span>Resumo fiscal da NF-e</span></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:14px;">${Object.entries(n.impostos||{}).map(([campo,valor])=>`<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px;"><div style="font-size:10px;color:var(--text3);font-family:var(--mono);">${campo}</div><strong style="font-size:12px;">${compraFmt(valor)}</strong></div>`).join('')}</div>`:''}
  <div class="section-label"><span>Itens (${n.itens.length})</span><button class="btn btn-secondary" onclick="adicionarItemNota()">+ Adicionar item</button></div><div id="nota-itens">${n.itens.map(linhaItemNota).join('')}</div>
  <div class="search-banner">Revise fornecedor, produtos, quantidades, custos, vencimento e total. A liberação terá uma segunda confirmação.</div>
  <div class="form-actions"><button class="btn btn-primary" id="btn-confirmar-nota" onclick="confirmarConciliacaoNota()">Confirmar e preparar entrada</button><button class="btn btn-secondary" onclick="renderDashboardCompras()">Cancelar</button></div>`;
}

function linhaItemNota(i,idx){return `<div class="dash-chart-box" data-nota-item="${idx}" style="padding:10px;margin-bottom:8px;"><div class="form-grid">
  <div class="form-group full"><label class="form-label">Produto da nota</label><input class="form-input" data-campo="nome" value="${notaEsc(i.nome)}"/></div>
  <div class="form-group full"><label class="form-label">Conciliar com</label><select class="form-input form-select" data-campo="produtoId">${notaOpcoesProdutos(i.produtoId)}</select></div>
  <div class="form-group"><label class="form-label">Quantidade</label><input class="form-input" data-campo="quantidade" value="${i.quantidade}"/></div>
  <div class="form-group"><label class="form-label">Unidade</label><input class="form-input" data-campo="unidade" value="${notaEsc(i.unidade||'UN')}"/></div>
  <div class="form-group"><label class="form-label">Custo unitário</label><input class="form-input" data-campo="preco" value="${i.preco}"/></div>
  <div class="form-group"><label class="form-label">Preço de venda (novo)</label><input class="form-input" data-campo="precoVenda" value="${i.precoVenda||0}"/></div>
  <div class="form-group"><label class="form-label">Tipo (novo)</label><select class="form-input form-select" data-campo="tipoId"><option value="">Selecione...</option>${notaOpcoesTipos(i.tipoId)}</select></div>
  <div class="form-group" style="justify-content:flex-end;"><button class="btn btn-danger" onclick="removerItemNota(${idx})">Excluir item</button></div></div></div>`;}

function adicionarItemNota(){notaConciliacao.itens.push({nome:'',unidade:'UN',quantidade:1,preco:0,subtotal:0,produtoId:null,precoVenda:0,tipoId:cacheTipos[0]?.id_tipo||null});renderPreviewNota();}
function removerItemNota(idx){notaConciliacao.itens.splice(idx,1);renderPreviewNota();}
function lerItensPreviewNota(){return [...document.querySelectorAll('[data-nota-item]')].map(box=>{const g=n=>box.querySelector(`[data-campo="${n}"]`)?.value||'';return {nome:g('nome').trim(),produtoId:g('produtoId'),quantidade:notaNum(g('quantidade')),unidade:g('unidade').trim().toUpperCase()||'UN',preco:notaNum(g('preco')),precoVenda:notaNum(g('precoVenda')),tipoId:Number(g('tipoId'))||null};});}

async function confirmarConciliacaoNota(){
  const btn=document.getElementById('btn-confirmar-nota'),itens=lerItensPreviewNota(),fornecedorSel=document.getElementById('nota-fornecedor').value,razao=document.getElementById('nota-razao').value.trim();
  const totalNota=notaNum(document.getElementById('nota-total').value),totalItens=itens.reduce((s,i)=>s+i.quantidade*i.preco,0);
  if(fornecedorSel==='novo'&&!razao){toast('Informe a razão social do fornecedor.','error');return;}
  if(!itens.length||itens.some(i=>!i.nome||i.quantidade<=0||i.preco<0)){toast('Revise todos os itens.','error');return;}
  if(itens.some(i=>i.produtoId==='novo'&&!i.tipoId)){toast('Informe o tipo dos produtos novos.','error');return;}
  if(Math.abs(totalItens-totalNota)>0.02&&!confirm(`A soma dos itens é ${compraFmt(totalItens)}, mas a nota informa ${compraFmt(totalNota)}. Continuar?`))return;
  if(!confirm('Confirma a conciliação? Novos cadastros e uma compra pendente serão criados. Estoque e contas a pagar só mudarão após a confirmação de liberação.'))return;
  btn.disabled=true;btn.textContent='Preparando entrada...';
  try{
    const chaveInformada=document.getElementById('nota-chave').value.trim();
    if(chaveInformada){
      const repetida=await apiGet(`compras?select=id_compra,codigo_compra&chave_nfe=eq.${encodeURIComponent(chaveInformada)}&limit=1`);
      if(Array.isArray(repetida)&&repetida.length)throw new Error(`Esta NF-e já foi importada na compra ${repetida[0].codigo_compra||'#'+repetida[0].id_compra}.`);
    }
    await loadCaches();
    const [fornecedoresAtuais,produtosAtuais]=await Promise.all([
      apiGet('fornecedores?select=id_fornecedor,nome_fantasia,razao_social,cpf_cnpj,ativo'),
      apiGet('produtos?select=id_produto,nome_mercadoria,ativo')
    ]);
    const fornecedoresValidacao=Array.isArray(fornecedoresAtuais)?fornecedoresAtuais:cacheFornecedores;
    const produtosValidacao=Array.isArray(produtosAtuais)?produtosAtuais:cacheProdutos;
    let fornecedorId=Number(fornecedorSel)||null;
    if(fornecedorSel==='novo'){
      const f=notaConciliacao.fornecedor,cnpjDigitado=document.getElementById('nota-cnpj').value.trim();
      const existente=fornecedoresValidacao.find(x=>cnpjDigitado&&notaNorm(x.cpf_cnpj)===notaNorm(cnpjDigitado))||fornecedoresValidacao.find(x=>[x.razao_social,x.nome_fantasia].some(nome=>notaNorm(nome)===notaNorm(razao)));
      if(existente)fornecedorId=Number(existente.id_fornecedor);
      else{
        const res=await apiPost('fornecedores',{razao_social:razao,nome_fantasia:f.fantasia||null,cpf_cnpj:cnpjDigitado||null,endereco:f.endereco||null,numero:f.numero||null,bairro:f.bairro||null,cidade:f.cidade||null,estado:f.estado||null,cep:f.cep||null,ativo:true,observacoes:`Cadastrado pela nota ${document.getElementById('nota-numero').value||notaConciliacao.nomeArquivo}`});
        if(!res.ok)throw new Error('Erro ao cadastrar fornecedor: '+(res.data?.message||'erro'));fornecedorId=Number((Array.isArray(res.data)?res.data[0]:res.data)?.id_fornecedor);
      }
    }
    for(const item of itens){
      if(item.produtoId!=='novo'){item.idProduto=Number(item.produtoId);continue;}
      const existente=produtosValidacao.find(x=>notaNorm(x.nome_mercadoria)===notaNorm(item.nome));
      if(existente){item.idProduto=Number(existente.id_produto);continue;}
      const res=await apiPost('produtos',{nome_mercadoria:item.nome,id_tipo:item.tipoId,id_fornecedor:fornecedorId,unidade:item.unidade,estoque_atual:0,preco_custo:item.preco,preco_venda:item.precoVenda,ativo:true,observacoes:`Cadastrado pela nota ${document.getElementById('nota-numero').value||notaConciliacao.nomeArquivo}`});
      if(!res.ok)throw new Error(`Erro ao cadastrar ${item.nome}: `+(res.data?.message||'erro'));item.idProduto=Number((Array.isArray(res.data)?res.data[0]:res.data)?.id_produto);
    }
    const codigo=await gerarCodigoCompra(),data=document.getElementById('nota-data').value;
    const numeroNota=document.getElementById('nota-numero').value.trim(),chaveNfe=chaveInformada||null;
    const {xmlOriginal,...dadosNfe}=notaConciliacao;
    const compraRes=await apiPost('compras',{codigo_compra:codigo,tipo_entrada:'NOTA_FISCAL',numero_nota:numeroNota||null,chave_nfe:chaveNfe,dados_nfe:dadosNfe,xml_nfe:xmlOriginal||null,impostos_nfe:notaConciliacao.impostos||{},id_fornecedor:fornecedorId,data_compra:new Date(`${data}T12:00:00`).toISOString(),valor_total:Number((totalNota||totalItens).toFixed(2)),meio_pagamento:document.getElementById('nota-pagamento').value||null,prazo_dias:0,quantidade_parcelas:Math.max(1,Number(document.getElementById('nota-parcelas').value)||1),dias_vencimento:Math.max(0,Number(document.getElementById('nota-intervalo').value)||0),data_vencimento:document.getElementById('nota-vencimento').value||data,observacoes:[`Importada de ${notaConciliacao.origem}: ${notaConciliacao.nomeArquivo}`,numeroNota?`Nota fiscal: ${numeroNota}`:''].filter(Boolean).join(' - '),id_produto:itens[0].idProduto,quantidade:itens.reduce((s,i)=>s+i.quantidade,0),preco_entrada:itens[0].preco,status_compra:'PENDENTE'});
    if(!compraRes.ok)throw new Error('Erro ao criar compra: '+(compraRes.data?.message||'erro'));
    const compra=Array.isArray(compraRes.data)?compraRes.data[0]:compraRes.data;
    const itensRes=await apiPost('compra_itens',itens.map(i=>({id_compra:compra.id_compra,id_produto:i.idProduto,quantidade:i.quantidade,preco_entrada:i.preco,subtotal:Number((i.quantidade*i.preco).toFixed(2))})));
    if(!itensRes.ok){await apiDelete(`compras?id_compra=eq.${compra.id_compra}`);throw new Error('Erro ao criar itens: '+(itensRes.data?.message||'erro'));}
    toast('Nota conciliada. Faça a conferência final.','success');await loadItems();await loadCaches();isNew=false;currentId=compra.id_compra;await renderFormCompra(items.find(x=>Number(x.id_compra)===Number(compra.id_compra)));await abrirLiberacaoCompra(compra.id_compra);
  }catch(e){const msg=e.message||String(e);toast(/schema cache|tipo_entrada|chave_nfe|dados_nfe|xml_nfe|impostos_nfe|numero_nota/i.test(msg)?'Atualize o banco executando sql/compras_tipos_entrada_nfe.sql no Supabase. '+msg:msg,'error');btn.disabled=false;btn.textContent='Confirmar e preparar entrada';}
}
