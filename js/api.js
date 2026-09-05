const SUPA_URL='https://jlfltollgwtrqpapqnnp.supabase.co';
const ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsZmx0b2xsZ3d0cnFwYXBxbm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDcwNDQsImV4cCI6MjA5NDI4MzA0NH0.A9uEdtRQrI0zjFn6W9euH7B3cmMVuRyuTud7_oFSF7g';

// API
const TABELAS_COM_ESCOPO_EMPRESA=new Set([
  'clientes','fornecedores','tipo_mercadoria','produtos','produtos_precos_especiais','tipo_cobranca',
  'vendas','venda_itens','contas_receber','contas_receber_baixas','compras','compra_itens','contas_pagar','estoque_movimentacoes'
]);
function caminhoComEscopoEmpresa(p){
  const tabela=String(p||'').split('?')[0];
  const empresaId=sessaoAtual()?.empresa_id;
  if(!empresaId||!TABELAS_COM_ESCOPO_EMPRESA.has(tabela)||/[?&]empresa_id=/.test(p)) return p;
  return `${p}${p.includes('?')?'&':'?'}empresa_id=eq.${encodeURIComponent(empresaId)}`;
}
function url(p){ return `${SUPA_URL}/rest/v1/${p}${p.includes('?')?'&':'?'}apikey=${ANON_KEY}`; }
const sessaoAtual=()=>JSON.parse(sessionStorage.getItem('usuario_logado')||'null');
const hdrs=(e={})=>{
  const token=sessaoAtual()?.token;
  return {'Authorization':`Bearer ${ANON_KEY}`,'Accept':'application/json',...(token?{'X-App-Session':token}:{}),...e};
};
async function apiGet(p){ const r=await fetch(url(caminhoComEscopoEmpresa(p)),{headers:hdrs({'Prefer':'count=exact'})}); return r.json(); }
const apiNormalizarDuplicidade=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const apiDocumentoDuplicidade=v=>String(v||'').replace(/\D/g,'');
async function validarCadastroDuplicado(p,b){
  const tabela=String(p||'').split('?')[0];
  if(!['fornecedores','produtos'].includes(tabela))return null;
  const novos=Array.isArray(b)?b:[b], existentes=await apiGet(`${tabela}?select=*`);
  if(!Array.isArray(existentes))return null;
  const vistos=[];
  for(const novo of novos){
    if(tabela==='fornecedores'){
      const documento=apiDocumentoDuplicidade(novo.cpf_cnpj), nomes=[novo.razao_social,novo.nome_fantasia].map(apiNormalizarDuplicidade).filter(Boolean);
      const repetido=existentes.concat(vistos).find(x=>(documento&&apiDocumentoDuplicidade(x.cpf_cnpj)===documento)||nomes.some(n=>[x.razao_social,x.nome_fantasia].map(apiNormalizarDuplicidade).includes(n)));
      if(repetido)return `Fornecedor já cadastrado: ${repetido.nome_fantasia||repetido.razao_social}.`;
    }else{
      if(novo.ativo===false)continue;
      const nome=apiNormalizarDuplicidade(novo.nome_mercadoria);
      const repetido=existentes.concat(vistos).find(x=>x.ativo!==false&&nome&&apiNormalizarDuplicidade(x.nome_mercadoria)===nome);
      if(repetido)return `Produto já cadastrado: ${repetido.nome_mercadoria}.`;
    }
    vistos.push(novo);
  }
  return null;
}
async function apiPost(p,b){
  const duplicidade=await validarCadastroDuplicado(p,b);
  if(duplicidade)return {ok:false,data:{message:duplicidade,code:'DUPLICATE_CADASTRO'}};
  const r=await fetch(url(p),{method:'POST',headers:hdrs({'Content-Type':'application/json','Prefer':'return=representation'}),body:JSON.stringify(b)});
  return{ok:r.ok,data:await r.json()};
}
async function apiPatch(p,b,opcoes={}){
  const r=await fetch(url(caminhoComEscopoEmpresa(p)),{method:'PATCH',headers:hdrs({'Content-Type':'application/json','Prefer':'return=representation'}),body:JSON.stringify(b)}),data=await r.json();
  const tabela=String(p||'').split('?')[0];
  let erroSincronizacao=null;
  if(r.ok&&opcoes.sincronizarFinancas!==false&&['contas_receber','contas_pagar'].includes(tabela)&&typeof sincronizarTituloFinanceiroAposAlteracao==='function'){
    try{for(const titulo of Array.isArray(data)?data:[])await sincronizarTituloFinanceiroAposAlteracao(tabela,titulo);}catch(e){erroSincronizacao=e;}
  }
  return erroSincronizacao?{ok:false,data:{message:'Alteração salva localmente, mas o Finanças não foi atualizado: '+(erroSincronizacao.message||erroSincronizacao)}}:{ok:r.ok,data};
}
async function apiDelete(p){
  const tabela=String(p||'').split('?')[0];
  if(['contas_receber','contas_pagar'].includes(tabela)&&typeof cancelarMovimentosFinancas==='function'){
    const filtro=String(p||'').includes('?')?String(p).split('?').slice(1).join('?'):'';
    const titulos=await apiGet(`${tabela}?select=id_movimento_financas,data_vencimento${filtro?'&'+filtro:''}`);
    try{await cancelarMovimentosFinancas(titulos);}catch(e){console.error('Cancelamento no Finanças falhou:',e);return false;}
  }
  const r=await fetch(url(caminhoComEscopoEmpresa(p)),{method:'DELETE',headers:hdrs({'Authorization':`Bearer ${ANON_KEY}`})}); return r.ok;
}
