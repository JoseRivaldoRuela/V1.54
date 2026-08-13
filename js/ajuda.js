const AJUDA_MODULOS = [
  {id:'inicio',titulo:'Primeiros passos',icone:'1',resumo:'Ordem recomendada para configurar e iniciar a operacao.',passos:[
    'Confira no topo da tela se voce entrou na empresa correta. Cadastros e movimentos nunca devem ser compartilhados entre empresas.',
    'Cadastre fornecedores e clientes. Use o botao + ao lado de uma selecao para cadastrar sem sair da operacao.',
    'Cadastre tipos de mercadoria e produtos, informando custo, preco de venda, unidade e fornecedor quando aplicavel.',
    'Registre compras para entrada de mercadoria e vendas para saida. Use contas a pagar ou receber para titulos sem compra ou venda de origem.',
    'Cadastre os meios de pagamento que sua empresa utiliza e selecione-os nos lancamentos.'
  ],atencao:'Antes de lancar qualquer dado, confirme sempre a empresa exibida na sessao.'},
  {id:'vendas',titulo:'Vendas',icone:'V',resumo:'Pedido, itens, parcelamento, entrega, estoque e contas a receber.',passos:[
    'Clique em Vendas e depois em + Registrar Venda. Selecione o cliente, datas e meio de pagamento.',
    'Informe 1 parcela para venda a vista. Para mais parcelas, informe obrigatoriamente um intervalo maior que zero.',
    'Adicione os produtos. Use Alterar para corrigir produto, quantidade, preco ou desconto; use Excluir para retirar o item.',
    'Salve a venda enquanto ela estiver em aberto. O codigo e gerado dentro da empresa atual.',
    'Ao entregar, revise pagamento e vencimentos. A entrega baixa o estoque e gera as contas a receber.',
    'Para corrigir valor de titulo originado da venda, reabra ou altere a venda. O financeiro protege esses valores contra alteracao direta.'
  ],atencao:'Nao entregue antes de revisar quantidades, precos, descontos, parcelas e vencimentos.'},
  {id:'compras',titulo:'Compras',icone:'C',resumo:'Entrada, custos, estoque, parcelamento e contas a pagar.',passos:[
    'Clique em Compras e registre fornecedor, data, pagamento e vencimento.',
    'Adicione cada produto com quantidade e preco de entrada. Alterar edita o item; Excluir o remove.',
    'Para mais de uma parcela, informe intervalo em dias maior que zero.',
    'Salve ou clique em Liberar Entrada. A liberacao salva primeiro as alteracoes atuais e mostra uma conferencia final.',
    'Revise principalmente a quantidade exibida na janela de liberacao. Confirme custo e preco de venda de cada produto.',
    'Ao liberar, o estoque e somado e as contas a pagar sao geradas. Uma compra liberada deve ser reaberta antes de alteracoes permitidas.'
  ],atencao:'A quantidade mostrada na janela Liberar Entrada e exatamente a que sera somada ao estoque.'},
  {id:'receber',titulo:'Contas a receber',icone:'R',resumo:'Titulos de vendas, lancamentos manuais, baixas e parcelas.',passos:[
    'Titulos de vendas sao criados na entrega. Titulos avulsos podem ser cadastrados diretamente em Contas > A Receber.',
    'No lancamento manual, selecione cliente, valor, primeiro vencimento e meio de pagamento.',
    'Para parcelar, informe quantidade e intervalo maior que zero. O total e dividido, com ajuste de centavos na ultima parcela.',
    'Use Baixar Valor para recebimento parcial ou Marcar Recebido para quitar. Em titulo quitado, use Reativar baixa para desfazer.',
    'Lancamentos manuais podem ser excluidos em grupo, desde que nenhuma parcela esteja baixada.',
    'Titulos originados de venda nao permitem exclusao ou alteracao de valor pelo financeiro; corrija a venda de origem.'
  ],atencao:'Confira parcela (ex.: 3/10), valor da parcela e valor total do titulo antes da baixa.'},
  {id:'pagar',titulo:'Contas a pagar',icone:'P',resumo:'Titulos de compras, despesas manuais, pagamentos e parcelas.',passos:[
    'Titulos de compra sao gerados ao liberar a entrada. Despesas avulsas sao cadastradas diretamente em Contas > A Pagar.',
    'Selecione fornecedor, valor, vencimento e meio de pagamento. Use o + se precisar cadastrar o fornecedor.',
    'Para parcelar, informe quantidade e intervalo maior que zero. Uma parcela com zero dias representa pagamento a vista.',
    'Registre a baixa somente depois de conferir valor, vencimento e parcela.',
    'Lancamentos manuais podem ser excluidos com todas as parcelas, desde que nenhuma esteja paga.',
    'Titulos originados de compra devem ser corrigidos pela compra de origem.'
  ],atencao:'Nunca exclua ou altere manualmente no banco um titulo ligado a uma compra.'},
  {id:'cadastros',titulo:'Clientes e fornecedores',icone:'CF',resumo:'Cadastro, pesquisa e uso do atalho rapido.',passos:[
    'Use Cadastros > Clientes ou Fornecedores para manter os dados completos.',
    'O botao CNPJ consulta dados para agilizar o preenchimento; revise antes de salvar.',
    'Durante venda, compra ou titulo, clique no + ao lado da lista para cadastrar e trazer o novo registro selecionado.',
    'Registros inativos continuam preservados no historico, mas nao devem ser usados em novos lancamentos.',
    'Cada cadastro pertence somente a empresa na qual foi criado.'
  ],atencao:'Se uma lista vier vazia, confirme a empresa atual e se o cadastro esta ativo.'},
  {id:'estoque',titulo:'Produtos e estoque',icone:'E',resumo:'Produtos, tipos, precos especiais, movimentacoes e Kardex.',passos:[
    'Cadastre primeiro o tipo de mercadoria e depois o produto.',
    'Informe custo e preco de venda corretamente; eles afetam margem, lucro e conferencia da compra.',
    'Use Precos Especiais para definir um valor especifico por cliente e produto.',
    'Entradas normais devem vir da liberacao de compras e saidas da entrega de vendas.',
    'Use Movimentacoes de Estoque apenas para ajustes justificados. Registre uma observacao clara.',
    'Consulte Kardex para conferir entradas, saidas, saldo e origem de cada movimento.'
  ],atencao:'Evite ajustar estoque para compensar um erro de compra ou venda; corrija primeiro o documento de origem.'},
  {id:'acessos',titulo:'Usuarios e empresas',icone:'U',resumo:'Acesso, administracao e isolamento dos dados.',passos:[
    'Administradores cadastram e ativam usuarios da propria empresa.',
    'Cada usuario acessa apenas os dados permitidos da empresa informada no login.',
    'A administracao de empresas e primeiro usuario fica restrita ao administrador autorizado da JR.',
    'Nunca compartilhe senha. Desative usuarios que nao devem mais acessar.',
    'Ao testar outra empresa, saia e entre usando o codigo correto dessa empresa.'
  ],atencao:'Se aparecer qualquer dado de outra empresa, nao altere o registro e abra chamado urgente com uma evidencia.'}
];

let ajudaModuloAtual='inicio';
const ajudaEsc = v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function renderCentralAjuda(modulo=ajudaModuloAtual) {
  ajudaModuloAtual=AJUDA_MODULOS.some(m=>m.id===modulo)?modulo:'inicio';
  document.getElementById('content-header').style.display='none';
  document.getElementById('search-input').placeholder='Buscar no help...';
  document.getElementById('sidebar-footer').textContent='Ajuda por modulo';
  renderMenuAjuda();
  renderConteudoAjuda();
}

function renderMenuAjuda(filtro='') {
  const q=String(filtro).toLowerCase().trim();
  const mods=AJUDA_MODULOS.filter(m=>!q||`${m.titulo} ${m.resumo} ${m.passos.join(' ')}`.toLowerCase().includes(q));
  document.getElementById('item-list').innerHTML=`${mods.map(m=>`<div class="item-card ${m.id===ajudaModuloAtual?'active':''}" onclick="selecionarModuloAjuda('${m.id}')"><div class="item-name">${m.icone} - ${m.titulo}</div><div class="item-sub">${m.resumo}</div></div>`).join('')||'<div class="empty-state" style="height:auto;padding:24px 8px;">Nenhum assunto encontrado.</div>'}<div class="item-card" onclick="abrirAreaChamados()"><div class="item-name">Atendimento</div><div class="item-sub">Abrir e acompanhar chamados</div></div>`;
}

function selecionarModuloAjuda(id){ajudaModuloAtual=id;renderMenuAjuda(document.getElementById('search-input').value);renderConteudoAjuda();closeSidebar();}
function filtrarAjuda(){renderMenuAjuda(document.getElementById('search-input').value);}

function renderConteudoAjuda(){
  const m=AJUDA_MODULOS.find(x=>x.id===ajudaModuloAtual)||AJUDA_MODULOS[0];
  document.getElementById('content-body').innerHTML=`<div style="max-width:900px;margin:auto;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px;flex-wrap:wrap;"><div><div style="font-size:11px;color:var(--accent);font-family:var(--mono);text-transform:uppercase;">Central de ajuda / ${m.titulo}</div><h2 style="margin:6px 0;font-size:24px;">${m.titulo}</h2><p style="color:var(--text2);margin:0;">${m.resumo}</p></div><button class="btn btn-primary" onclick="abrirAreaChamados('${m.id}')">Abrir chamado</button></div>
    <div style="display:grid;gap:10px;">${m.passos.map((p,i)=>`<div style="display:grid;grid-template-columns:34px 1fr;gap:12px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;"><span style="width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:rgba(0,229,160,.12);color:var(--accent);font-family:var(--mono);">${i+1}</span><div style="line-height:1.55;font-size:13px;">${p}</div></div>`).join('')}</div>
    <div style="margin-top:16px;padding:14px;border:1px solid rgba(255,165,0,.35);background:rgba(255,165,0,.08);border-radius:10px;"><strong style="color:var(--warn);">Atencao</strong><div style="margin-top:5px;line-height:1.5;font-size:13px;">${m.atencao}</div></div>
  </div>`;
}

async function abrirAreaChamados(modulo=ajudaModuloAtual){
  ajudaModuloAtual=modulo||'inicio';
  document.getElementById('content-body').innerHTML='<div class="loading" style="justify-content:center;padding:40px;"><div class="spinner"></div> Carregando chamados...</div>';
  const chamados=await apiGet('chamados_suporte?select=*&order=criado_em.desc');
  const lista=Array.isArray(chamados)?chamados:[];
  document.getElementById('content-body').innerHTML=`<div style="max-width:960px;margin:auto;"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;"><div><h2 style="margin:0 0 5px;">Atendimento</h2><div style="color:var(--text2);font-size:13px;">Registre o problema com detalhes para facilitar a analise.</div></div><button class="btn btn-secondary" onclick="renderConteudoAjuda()">Voltar ao help</button></div>
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:20px;"><div class="form-grid">
    <div class="form-group"><label class="form-label">Modulo *</label><select class="form-input form-select" id="ch-modulo">${AJUDA_MODULOS.map(m=>`<option value="${m.id}" ${m.id===ajudaModuloAtual?'selected':''}>${m.titulo}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Prioridade *</label><select class="form-input form-select" id="ch-prioridade"><option>BAIXA</option><option selected>NORMAL</option><option>ALTA</option><option>URGENTE</option></select></div>
    <div class="form-group full"><label class="form-label">Assunto *</label><input class="form-input" id="ch-assunto" maxlength="120" placeholder="Ex.: quantidade incorreta ao liberar compra"/></div>
    <div class="form-group full"><label class="form-label">Descricao detalhada *</label><textarea class="form-textarea" id="ch-descricao" maxlength="3000" placeholder="Informe o que tentou fazer, resultado esperado, resultado apresentado, numero do documento e mensagem de erro."></textarea></div>
  </div><div class="form-actions"><button class="btn btn-primary" id="btn-chamado" onclick="salvarChamado()">Registrar chamado</button></div></div>
  <div class="section-label"><span>${isSuperAdminJr?'Todos os chamados':'Meus chamados'}</span></div>${lista.length?lista.map(c=>`<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:9px;"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;"><strong>#${c.id_chamado} - ${ajudaEsc(c.assunto)}</strong><span class="pill ${c.status==='RESOLVIDO'?'on':c.status==='CANCELADO'?'off':'warn'}">${ajudaEsc(c.status)}</span></div><div style="color:var(--accent2);font-size:12px;margin:7px 0;"><strong>Empresa:</strong> ${ajudaEsc(c.empresa_nome||'-')} &nbsp; <strong>Usuario:</strong> ${ajudaEsc(c.usuario_nome||'-')} ${c.usuario_email?`&lt;${ajudaEsc(c.usuario_email)}&gt;`:''}</div><div style="color:var(--text2);font-size:11px;margin:6px 0;">${ajudaEsc(c.modulo)} | ${ajudaEsc(c.prioridade)} | ${new Date(c.criado_em).toLocaleString('pt-BR')}</div><div style="font-size:13px;line-height:1.5;white-space:pre-wrap;">${ajudaEsc(c.descricao)}</div>${c.resposta?`<div style="margin-top:10px;padding:10px;background:var(--surface2);border-radius:8px;"><strong>Resposta do atendimento</strong><div style="margin-top:5px;white-space:pre-wrap;">${ajudaEsc(c.resposta)}</div></div>`:''}${isSuperAdminJr?`<div style="margin-top:10px;text-align:right;"><button class="btn btn-secondary" style="padding:6px 10px;font-size:11px;" onclick="atenderChamado(${c.id_chamado},'${ajudaEsc(c.status)}')">Atualizar atendimento</button></div>`:''}</div>`).join(''):'<div style="color:var(--text3);padding:18px;text-align:center;">Nenhum chamado registrado.</div>'}</div>`;
}

async function salvarChamado(){
  const assunto=document.getElementById('ch-assunto').value.trim();
  const descricao=document.getElementById('ch-descricao').value.trim();
  if(assunto.length<5){toast('Informe um assunto objetivo.','error');return;}
  if(descricao.length<20){toast('Descreva o problema com pelo menos 20 caracteres.','error');return;}
  const btn=document.getElementById('btn-chamado');btn.disabled=true;btn.textContent='Registrando...';
  const res=await apiPost('chamados_suporte',{modulo:document.getElementById('ch-modulo').value,prioridade:document.getElementById('ch-prioridade').value,assunto,descricao,status:'ABERTO'});
  if(!res.ok){toast('Nao foi possivel registrar: '+(res.data?.message||'execute sql/chamados_suporte.sql no Supabase'),'error');btn.disabled=false;btn.textContent='Registrar chamado';return;}
  const chamado=Array.isArray(res.data)?res.data[0]:res.data;
  let emailEnviado=false;
  if(chamado?.id_chamado){try{const aviso=await fetch('/api/notificar-chamado',{method:'POST',headers:{'Content-Type':'application/json','X-App-Session':sessaoAtual()?.token||''},body:JSON.stringify({id_chamado:chamado.id_chamado})});emailEnviado=aviso.ok;}catch(e){}}
  toast(emailEnviado?'Chamado registrado e atendimento JR avisado por e-mail.':'Chamado registrado. O aviso por e-mail nao foi enviado; confira a configuracao da Vercel.',emailEnviado?'success':'info');await abrirAreaChamados(document.getElementById('ch-modulo').value);
}

async function atenderChamado(id,statusAtual){
  if(!isSuperAdminJr){toast('Apenas o administrador da JR pode atualizar o atendimento.','error');return;}
  const status=prompt('Novo status: ABERTO, EM_ATENDIMENTO, AGUARDANDO_USUARIO, RESOLVIDO ou CANCELADO',statusAtual||'EM_ATENDIMENTO');
  if(status===null)return;
  const normalizado=status.trim().toUpperCase();
  if(!['ABERTO','EM_ATENDIMENTO','AGUARDANDO_USUARIO','RESOLVIDO','CANCELADO'].includes(normalizado)){toast('Status invalido.','error');return;}
  const resposta=prompt('Resposta ou orientacao do atendimento:','');
  if(resposta===null)return;
  const res=await apiPatch(`chamados_suporte?id_chamado=eq.${id}`,{status:normalizado,resposta:resposta.trim()||null,atualizado_em:new Date().toISOString()});
  if(!res.ok){toast('Erro ao atualizar chamado: '+(res.data?.message||'erro'),'error');return;}
  toast('Chamado atualizado.','success');await abrirAreaChamados(ajudaModuloAtual);
}
