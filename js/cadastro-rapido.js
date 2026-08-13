// Cadastro rapido para selects alimentados por tabelas de cadastro.
// O modal preserva o formulario atual e devolve o registro criado ja selecionado.
(function(){
  const tiposPorId = {
    'f-id_cliente':'cliente',
    'f-id_fornecedor':'fornecedor',
    'f-id_tipo':'tipo',
    'f-id_produto':'produto',
    'item-produto':'produto',
    'compra-item-produto':'produto',
    'kardex-produto':'produto',
    'unif-origem':'produto',
    'unif-destino':'produto',
    'quebra-origem':'produto',
    'quebra-destino':'produto',
    'f-meio_pagamento':'cobranca',
    'f-meio_pagamento_padrao':'cobranca',
    'entrega-pagamento':'cobranca'
  };

  const meta = {
    cliente:{titulo:'Novo cliente',tabela:'clientes',id:'id_cliente'},
    fornecedor:{titulo:'Novo fornecedor',tabela:'fornecedores',id:'id_fornecedor'},
    tipo:{titulo:'Novo tipo de mercadoria',tabela:'tipo_mercadoria',id:'id_tipo'},
    produto:{titulo:'Novo produto',tabela:'produtos',id:'id_produto'},
    cobranca:{titulo:'Novo meio de pagamento',tabela:'tipo_cobranca',id:'id_cobranca'}
  };

  function esc(v){
    return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function campo(label,id,extra=''){
    return `<div class="form-group ${extra.includes('full')?'full':''}"><label class="form-label">${label}</label>${extra.replace('full','')}</div>`;
  }

  function pessoaForm(){
    return `<div class="form-grid">
      ${campo('Razao Social *','qr-razao',`<input class="form-input" id="qr-razao" autocomplete="organization" placeholder="Nome ou razao social"/> full`)}
      ${campo('Nome Fantasia','qr-fantasia','<input class="form-input" id="qr-fantasia" placeholder="Nome comercial"/>')}
      ${campo('CPF / CNPJ','qr-documento','<input class="form-input" id="qr-documento" placeholder="CPF ou CNPJ"/>')}
      ${campo('Telefone','qr-telefone','<input class="form-input" id="qr-telefone" placeholder="(00) 00000-0000"/>')}
      ${campo('E-mail','qr-email','<input class="form-input" type="email" id="qr-email" placeholder="contato@empresa.com"/>')}
    </div>`;
  }

  function options(lista,id,nome){
    return (lista||[]).map(x=>`<option value="${esc(x[id])}">${esc(x[nome]||x.nome_fantasia||x.razao_social||x.descricao)}</option>`).join('');
  }

  async function produtoForm(){
    if(typeof loadCaches==='function') await loadCaches();
    return `<div class="form-grid">
      ${campo('Nome do Produto *','qr-produto',`<input class="form-input" id="qr-produto" placeholder="Nome do produto"/> full`)}
      ${campo('Tipo de Mercadoria *','qr-tipo',`<select class="form-input form-select" id="qr-tipo" data-quick-type="tipo"><option value="">Selecione...</option>${options(cacheTipos,'id_tipo','descricao')}</select>`)}
      ${campo('Fornecedor','qr-fornecedor',`<select class="form-input form-select" id="qr-fornecedor" data-quick-type="fornecedor"><option value="">Nenhum</option>${options(cacheFornecedores,'id_fornecedor','nome_fantasia')}</select>`)}
      ${campo('Unidade','qr-unidade','<select class="form-input form-select" id="qr-unidade"><option value="">Selecione...</option><option>UN</option><option>KG</option><option>LT</option><option>CX</option><option>PC</option><option>DZ</option><option>MT</option><option>M2</option><option>GL</option></select>')}
      ${campo('Estoque Atual','qr-estoque','<input class="form-input" type="number" step="0.01" id="qr-estoque" value="0"/>')}
      ${campo('Preco de Custo (R$) *','qr-custo','<input class="form-input" type="number" min="0" step="0.01" id="qr-custo" placeholder="0,00"/>')}
      ${campo('Preco de Venda (R$) *','qr-venda','<input class="form-input" type="number" min="0" step="0.01" id="qr-venda" placeholder="0,00"/>')}
    </div><div class="quick-modal-note">O cadastro completo continua disponivel no menu Cadastros &gt; Produtos.</div>`;
  }

  async function corpo(tipo){
    if(tipo==='cliente'||tipo==='fornecedor') return pessoaForm();
    if(tipo==='tipo') return campo('Descricao *','qr-descricao','<input class="form-input" id="qr-descricao" placeholder="Ex: Bebidas"/>');
    if(tipo==='cobranca') return campo('Descricao *','qr-descricao','<input class="form-input" id="qr-descricao" placeholder="Ex: PIX"/>');
    return produtoForm();
  }

  window.abrirCadastroRapido = async function(tipo,select){
    const cfg=meta[tipo];
    if(!cfg||!select||select.disabled) return;
    const overlay=document.createElement('div');
    overlay.className='modal-overlay quick-cadastro-modal';
    overlay.style.zIndex=String(600+document.querySelectorAll('.quick-cadastro-modal').length);
    overlay.innerHTML=`<div class="modal"><div class="modal-header"><span class="modal-title">+ ${cfg.titulo}</span><button type="button" class="modal-close">x</button></div><div class="modal-body"><div class="loading"><div class="spinner"></div> Carregando...</div></div><div class="modal-footer"><button type="button" class="btn btn-secondary qr-cancelar">Cancelar</button><button type="button" class="btn btn-primary qr-salvar">Cadastrar e selecionar</button></div></div>`;
    document.body.appendChild(overlay);
    const fechar=()=>overlay.remove();
    overlay.querySelector('.modal-close').onclick=fechar;
    overlay.querySelector('.qr-cancelar').onclick=fechar;
    overlay.addEventListener('click',e=>{if(e.target===overlay)fechar();});
    overlay.querySelector('.modal-body').innerHTML=await corpo(tipo);
    decorar(overlay);
    overlay.querySelector('input,select')?.focus();
    overlay.querySelector('.qr-salvar').onclick=()=>salvar(tipo,select,overlay);
  };

  function val(root,id){return root.querySelector('#'+id)?.value?.trim()||'';}

  async function salvar(tipo,select,overlay){
    const cfg=meta[tipo];
    let data,label;
    if(tipo==='cliente'||tipo==='fornecedor'){
      const razao=val(overlay,'qr-razao');
      if(!razao){toast('Informe a razao social.','error');return;}
      data={razao_social:razao,nome_fantasia:val(overlay,'qr-fantasia')||null,cpf_cnpj:val(overlay,'qr-documento')||null,telefone:val(overlay,'qr-telefone')||null,email:val(overlay,'qr-email')||null,ativo:true};
      label=data.nome_fantasia||data.razao_social;
    }else if(tipo==='tipo'||tipo==='cobranca'){
      const descricao=val(overlay,'qr-descricao');
      if(!descricao){toast('Informe a descricao.','error');return;}
      data={descricao}; label=descricao;
    }else{
      const nome=val(overlay,'qr-produto'), idTipo=val(overlay,'qr-tipo'), custo=val(overlay,'qr-custo'), venda=val(overlay,'qr-venda');
      if(!nome){toast('Informe o nome do produto.','error');return;}
      if(!idTipo){toast('Selecione o tipo de mercadoria.','error');return;}
      if(custo===''||venda===''){toast('Informe os precos de custo e venda.','error');return;}
      data={nome_mercadoria:nome,id_tipo:Number(idTipo),id_fornecedor:Number(val(overlay,'qr-fornecedor'))||null,unidade:val(overlay,'qr-unidade')||null,estoque_atual:Number(val(overlay,'qr-estoque'))||0,preco_custo:Number(custo),preco_venda:Number(venda),ativo:true};
      label=nome;
    }
    const btn=overlay.querySelector('.qr-salvar'); btn.disabled=true; btn.textContent='Salvando...';
    const res=await apiPost(cfg.tabela,data);
    if(!res.ok){toast('Erro: '+(res.data?.message||'nao foi possivel cadastrar'),'error');btn.disabled=false;btn.textContent='Cadastrar e selecionar';return;}
    const novo=Array.isArray(res.data)?res.data[0]:res.data;
    const id=novo?.[cfg.id];
    if(id===undefined||id===null){toast('Cadastro salvo, mas o identificador nao retornou.','error');btn.disabled=false;return;}
    if(typeof loadCaches==='function') await loadCaches();
    if(tipo==='cobranca'&&typeof loadCacheCobrancas==='function') await loadCacheCobrancas();
    let opt=Array.from(select.options).find(o=>String(o.value)===String(id));
    // Meios de pagamento sao gravados pelo texto, apesar de possuirem ID proprio.
    const optionValue=tipo==='cobranca'?label:id;
    if(tipo==='cobranca') opt=Array.from(select.options).find(o=>o.value===label);
    if(!opt){
      opt=new Option(label,optionValue);
      if(tipo==='produto'){
        opt.dataset.preco=String(data.preco_venda); opt.dataset.venda=String(data.preco_venda);
        opt.dataset.custo=String(data.preco_custo); opt.dataset.estoque=String(data.estoque_atual);
      }
      select.add(opt);
    }
    select.value=String(optionValue);
    select.dispatchEvent(new Event('change',{bubbles:true}));
    overlay.remove();
    toast(`${cfg.titulo.replace(/^Novo /,'')} cadastrado e selecionado!`,'success');
  }

  function decorar(root=document){
    root.querySelectorAll('select').forEach(select=>{
      const tipo=select.dataset.quickType||tiposPorId[select.id];
      if(!tipo||select.dataset.quickReady==='1') return;
      select.dataset.quickReady='1';
      const wrap=document.createElement('div'); wrap.className='quick-select-wrap';
      select.parentNode.insertBefore(wrap,select); wrap.appendChild(select);
      const btn=document.createElement('button'); btn.type='button'; btn.className='quick-add-btn'; btn.textContent='+';
      btn.title='Cadastrar rapidamente e selecionar'; btn.setAttribute('aria-label','Cadastrar rapidamente e selecionar');
      btn.disabled=select.disabled; btn.onclick=()=>abrirCadastroRapido(tipo,select); wrap.appendChild(btn);
    });
  }

  const observer=new MutationObserver(()=>decorar());
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{decorar();observer.observe(document.body,{childList:true,subtree:true});});
  else {decorar();observer.observe(document.body,{childList:true,subtree:true});}
})();
