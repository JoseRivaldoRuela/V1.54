const SUPA_URL='https://jlfltollgwtrqpapqnnp.supabase.co';
const ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsZmx0b2xsZ3d0cnFwYXBxbm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDcwNDQsImV4cCI6MjA5NDI4MzA0NH0.A9uEdtRQrI0zjFn6W9euH7B3cmMVuRyuTud7_oFSF7g';

// API
const TABELAS_COM_ESCOPO_EMPRESA=new Set([
  'clientes','fornecedores','tipo_mercadoria','produtos','produtos_precos_especiais','tipo_cobranca',
  'vendas','venda_itens','contas_receber','contas_receber_baixas','compras','compra_itens','contas_pagar','estoque_movimentacoes','chamados_suporte'
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
async function apiPost(p,b){ const r=await fetch(url(p),{method:'POST',headers:hdrs({'Content-Type':'application/json','Prefer':'return=representation'}),body:JSON.stringify(b)}); return{ok:r.ok,data:await r.json()}; }
async function apiPatch(p,b){ const r=await fetch(url(caminhoComEscopoEmpresa(p)),{method:'PATCH',headers:hdrs({'Content-Type':'application/json','Prefer':'return=representation'}),body:JSON.stringify(b)}); return{ok:r.ok,data:await r.json()}; }
async function apiDelete(p){ const r=await fetch(url(caminhoComEscopoEmpresa(p)),{method:'DELETE',headers:hdrs({'Authorization':`Bearer ${ANON_KEY}`})}); return r.ok; }
