const FINANCAS_API_URL='https://jlfltollgwtrqpapqnnp.supabase.co/rest/v1';
let integracaoFinancasAtivaCache=null;

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
  const [contas,categorias]=await Promise.all([
    financasRequest('contas?select=id_conta,nome,tipo,ativo&ativo=eq.true&tipo=neq.cartao&order=nome'),
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
  return `<option value="">Selecione...</option>${contas.map(c=>`<option value="${c.id_conta}" ${String(c.id_conta)===String(selecionada)?'selected':''}>${compraEsc?compraEsc(c.nome):c.nome}</option>`).join('')}`;
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
  const status=statusLocal===(receber?'RECEBIDO':'PAGO')?'efetivado':statusLocal==='CANCELADO'?'cancelado':'pendente';
  const dataBaixa=receber?titulo.data_recebimento:titulo.data_pagamento;
  await financasRequest('rpc/alterar_movimento',{method:'POST',body:JSON.stringify({p_id_movimento:m.id_movimento,p_id_conta:Number(titulo.id_conta_financas||m.id_conta),p_id_conta_destino:null,p_tipo:receber?'entrada':'saida',p_valor:Number(titulo.valor_original??m.valor),p_descricao:m.descricao,p_data_movimento:m.data_movimento,p_data_vencimento:String(titulo.data_vencimento||m.data_vencimento||m.data_movimento).slice(0,10),p_data_efetivacao:String(dataBaixa||titulo.data_vencimento||m.data_efetivacao||m.data_movimento).slice(0,10),p_id_categoria:m.id_categoria||null,p_status:status,p_documento:m.documento||null,p_observacoes:titulo.observacoes||m.observacoes||null})});
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
      const id=await criarMovimentoFinancas({tipo:config.tipo,contaId:config.contaId,categoriaId:config.categoria.id_categoria,valor:titulo.valor_original,descricao:config.descricao,dataVencimento:String(titulo.data_vencimento).slice(0,10),documento:config.documento,observacoes:titulo.observacoes});
      if(!id)throw new Error('O Finanças não retornou o identificador do movimento.');
      const salvo=await apiPatch(`${tabela}?${idCampo}=eq.${titulo[idCampo]}`,{id_conta_financas:Number(config.contaId),id_movimento_financas:id});
      if(!salvo.ok)throw new Error('Não foi possível vincular o movimento ao título local.');
    }
    return {ok:true};
  }catch(e){return {ok:false,message:e.message||String(e)};}
}
