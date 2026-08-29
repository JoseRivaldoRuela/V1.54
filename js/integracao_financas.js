const FINANCAS_API_URL='https://jlfltollgwtrqpapqnnp.supabase.co/rest/v1';
let integracaoFinancasAtivaCache=null;

function confirmarBaixaComOpcaoFinancas(mensagem){
  return new Promise(resolve=>{
    document.getElementById('confirmar-baixa-financas')?.remove();
    const modal=document.createElement('div');
    modal.className='modal-overlay';modal.id='confirmar-baixa-financas';modal.style.display='flex';
    modal.innerHTML=`<div class="modal" style="max-width:440px;"><div class="modal-header"><span class="modal-title">Confirmar baixa</span></div><div class="modal-body"><div data-mensagem style="font-size:13px;color:var(--text);line-height:1.5;"></div><label style="display:flex;align-items:center;gap:9px;margin-top:16px;padding:11px;border:1px solid var(--border);border-radius:8px;cursor:pointer;"><input type="checkbox" data-atualizar-financas checked style="width:17px;height:17px;"><span><b>Atualizar também o Finanças</b><small style="display:block;color:var(--text3);margin-top:3px;">Desmarque quando esta baixa não deve alterar o movimento financeiro.</small></span></label></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-acao="cancelar">Cancelar</button><button type="button" class="btn btn-primary" data-acao="confirmar">Confirmar baixa</button></div></div>`;
    modal.querySelector('[data-mensagem]').textContent=mensagem;
    const concluir=valor=>{modal.remove();resolve(valor)};
    modal.querySelector('[data-acao="cancelar"]').onclick=()=>concluir(null);
    modal.querySelector('[data-acao="confirmar"]').onclick=()=>concluir({atualizarFinancas:modal.querySelector('[data-atualizar-financas]').checked});
    modal.addEventListener('click',event=>{if(event.target===modal)concluir(null)});
    document.body.appendChild(modal);
  });
}

function baixaAtualizaFinancas(id='f-baixa-atualizar-financas'){
  const campo=document.getElementById(id);
  return campo?campo.checked:true;
}

async function financasRequest(path,options={}){
  const sessao=sessaoAtual();
  const resposta=await fetch(`${FINANCAS_API_URL}/${path}`,{...options,headers:{apikey:ANON_KEY,Authorization:`Bearer ${ANON_KEY}`,'X-App-Session':sessao?.token||'','Content-Type':'application/json','Accept-Profile':'financas','Content-Profile':'financas',Accept:'application/json',...(options.headers||{})}});
  const texto=await resposta.text();let dados=null;
  if(texto){try{dados=JSON.parse(texto);}catch(e){dados=texto;}}
  if(!resposta.ok)throw new Error(dados?.message||dados?.hint||`Erro ${resposta.status} no Finanças`);
  return dados;
}

async function empresaIntegraFinancas(){
  if(integracaoFinancasAtivaCache!==null)return integracaoFinancasAtivaCache;
  const empresas=await apiGet('empresas?select=integra_vendas_financas&limit=1');
  integracaoFinancasAtivaCache=Array.isArray(empresas)&&empresas[0]?.integra_vendas_financas===true;
  return integracaoFinancasAtivaCache;
}

async function carregarIntegracaoFinancas(uso){
  if(!await empresaIntegraFinancas())return {ativa:false,contas:[],categoria:null};
  const filtroTipo=uso==='saida'?'':'&tipo=neq.cartao';
  const [contas,categorias]=await Promise.all([
    financasRequest(`contas?select=id_conta,nome,tipo,ativo&ativo=eq.true${filtroTipo}&order=nome`),
    financasRequest(`categorias?select=id_categoria,nome,uso,ativo&ativo=eq.true&uso=eq.${uso}&order=nome`)
  ]);
  const nomeCategoria=uso==='entrada'?'vendas':'compras';
  let categoria=(Array.isArray(categorias)?categorias:[]).find(c=>String(c.nome||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()===nomeCategoria);
  if(!categoria){
    const criada=await financasRequest('categorias',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({nome:uso==='entrada'?'Vendas':'Compras',uso,tipo:null,cor:uso==='entrada'?'#19d89f':'#ff6174',descricao:'Categoria criada pela integração com o sistema Vendas',ativo:true})});
    categoria=Array.isArray(criada)?criada[0]:criada;
  }
  return {ativa:true,contas:Array.isArray(contas)?contas:[],categoria};
}

function opcoesContasFinancas(contas,selecionada=''){
  return `<option value="">Selecione...</option>${contas.map(c=>`<option value="${c.id_conta}" ${String(c.id_conta)===String(selecionada)?'selected':''}>${compraEsc?compraEsc(c.nome):c.nome}${String(c.tipo||'').toLowerCase()==='cartao'?' (cartao)':''}</option>`).join('')}`;
}

async function criarMovimentoFinancas({tipo,contaId,categoriaId,valor,descricao,dataVencimento,documento,observacoes}){
  const resultado=await financasRequest('rpc/lancar_movimento',{method:'POST',body:JSON.stringify({p_tipo:tipo,p_id_conta:Number(contaId),p_id_conta_destino:null,p_valor:Number(valor),p_descricao:descricao,p_data_movimento:new Date().toISOString().slice(0,10),p_data_vencimento:dataVencimento,p_data_efetivacao:dataVencimento,p_id_categoria:Number(categoriaId),p_status:'pendente',p_documento:documento||null,p_observacoes:observacoes||null})});
  const retorno=Array.isArray(resultado)?resultado[0]:resultado;
  return Number(retorno?.id_movimento??retorno?.p_id_movimento??retorno)||null;
}

async function alterarStatusMovimentoFinancas(idMovimento,status,dataEfetivacao){
  if(!idMovimento||!await empresaIntegraFinancas())return;
  const lista=await financasRequest(`movimentos?select=*&id_movimento=eq.${Number(idMovimento)}&limit=1`),m=Array.isArray(lista)?lista[0]:null;
  if(!m)return;
  await financasRequest('rpc/alterar_movimento',{method:'POST',body:JSON.stringify({p_id_movimento:m.id_movimento,p_id_conta:m.id_conta,p_id_conta_destino:m.id_conta_destino||null,p_tipo:m.tipo,p_valor:Number(m.valor),p_descricao:m.descricao,p_data_movimento:m.data_movimento,p_data_vencimento:m.data_vencimento||m.data_movimento,p_data_efetivacao:dataEfetivacao||m.data_vencimento||m.data_movimento,p_id_categoria:m.id_categoria||null,p_status:status,p_documento:m.documento||null,p_observacoes:m.observacoes||null})});
}

async function sincronizarTituloFinanceiroAposAlteracao(tabela,titulo){
  if(!titulo?.id_movimento_financas||!await empresaIntegraFinancas())return;
  const lista=await financasRequest(`movimentos?select=*&id_movimento=eq.${Number(titulo.id_movimento_financas)}&limit=1`),m=Array.isArray(lista)?lista[0]:null;
  if(!m)return;
  const receber=tabela==='contas_receber';
  const statusLocal=receber?titulo.status_recebimento:titulo.status_pagamento;
  const valorOriginal=Number(titulo.valor_original??m.valor);
  const valorBaixado=Math.max(0,Number(receber?titulo.valor_recebido:titulo.valor_pago)||0);
  const cancelado=statusLocal==='CANCELADO';
  const status=cancelado?'cancelado':valorBaixado>0.005?'efetivado':'pendente';
  const valorMovimento=!cancelado&&valorBaixado>0.005?Math.min(valorOriginal,valorBaixado):valorOriginal;
  const dataBaixa=receber?titulo.data_recebimento:titulo.data_pagamento;
  await financasRequest('rpc/alterar_movimento',{method:'POST',body:JSON.stringify({p_id_movimento:m.id_movimento,p_id_conta:Number(titulo.id_conta_financas||m.id_conta),p_id_conta_destino:null,p_tipo:receber?'entrada':'saida',p_valor:valorMovimento,p_descricao:m.descricao,p_data_movimento:m.data_movimento,p_data_vencimento:String(titulo.data_vencimento||m.data_vencimento||m.data_movimento).slice(0,10),p_data_efetivacao:String(dataBaixa||titulo.data_vencimento||m.data_efetivacao||m.data_movimento).slice(0,10),p_id_categoria:m.id_categoria||null,p_status:status,p_documento:m.documento||null,p_observacoes:titulo.observacoes||m.observacoes||null})});
}

async function cancelarMovimentosFinancas(titulos){
  for(const titulo of Array.isArray(titulos)?titulos:[]){
    if(titulo.id_movimento_financas)await alterarStatusMovimentoFinancas(titulo.id_movimento_financas,'cancelado',titulo.data_vencimento);
  }
}

async function vincularMovimentosFinancas(tabela,idCampo,titulos,config){
  if(!config?.ativa)return {ok:true};
  if(!config.contaId)return {ok:false,message:'Selecione a conta do Finanças.'};
  if(!config.categoria?.id_categoria)return {ok:false,message:`Cadastre a categoria ${config.tipo==='entrada'?'Vendas':'Compras'} no Finanças.`};
  try{
    for(const titulo of titulos){
      if(titulo.id_movimento_financas)continue;
      // Reaproveita um movimento orfao de tentativa anterior. Isso fecha a
      // janela em que o Financas era gravado, mas o vinculo local falhava.
      const vencimento=String(titulo.data_vencimento).slice(0,10);
      const documento=String(config.documento||'').trim();
      let id=null;
      if(documento){
        const candidatos=await financasRequest(`movimentos?select=id_movimento,id_conta,valor,status,documento,data_vencimento&tipo=eq.${encodeURIComponent(config.tipo)}&documento=eq.${encodeURIComponent(documento)}&status=neq.cancelado&order=id_movimento.desc`);
        const usados=await apiGet(`${tabela}?select=id_movimento_financas&id_movimento_financas=not.is.null`);
        const idsUsados=new Set((Array.isArray(usados)?usados:[]).map(x=>Number(x.id_movimento_financas)).filter(Boolean));
        const orfao=(Array.isArray(candidatos)?candidatos:[]).find(m=>
          !idsUsados.has(Number(m.id_movimento)) &&
          Math.abs(Number(m.valor||0)-Number(titulo.valor_original||0))<=0.005 &&
          String(m.data_vencimento||'').slice(0,10)===vencimento
        );
        if(orfao)id=Number(orfao.id_movimento)||null;
      }
      if(!id)id=await criarMovimentoFinancas({tipo:config.tipo,contaId:config.contaId,categoriaId:config.categoria.id_categoria,valor:titulo.valor_original,descricao:config.descricao,dataVencimento:vencimento,documento:config.documento,observacoes:titulo.observacoes});
      if(!id)throw new Error('O Finanças não retornou o identificador do movimento.');
      const salvo=await apiPatch(`${tabela}?${idCampo}=eq.${titulo[idCampo]}`,{id_conta_financas:Number(config.contaId),id_movimento_financas:id});
      if(!salvo.ok)throw new Error('Não foi possível vincular o movimento ao título local.');
    }
    return {ok:true};
  }catch(e){return {ok:false,message:e.message||String(e)};}
}
