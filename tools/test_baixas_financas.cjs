const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = vm.createContext({console, Date, localStorage:{getItem:()=>null}});
vm.runInContext(fs.readFileSync('js/integracao_financas.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('js/financeiro.js','utf8'),ctx);
let movimentos=[], baixas=[], titulos=[];
ctx.empresaIntegraFinancas=async()=>true;
ctx.invalidarResumoContasVendas=()=>{};
ctx.prepararIntegracaoBaixaContaReceber=async(c,id)=>({ok:true,ativa:true,contaId:id,integracao:{categoria:{id_categoria:1}}});
ctx.apiGet=async path=>baixas.filter(b=>b.id_conta===Number(path.match(/id_conta=eq\.(\d+)/)[1]));
ctx.apiPost=async(path,b)=>{const row={...b,id_baixa:baixas.length+1};baixas.push(row);return {ok:true,data:[row]};};
ctx.apiPatch=async(path,b,opts)=>{
  assert.equal(opts.sincronizarFinancas,false);
  const t=titulos.find(t=>t.id_conta===Number(path.match(/id_conta=eq\.(\d+)/)[1]));
  Object.assign(t,b);return {ok:true,data:[t]};
};
ctx.financasRequest=async(path,opts)=>{
  if(opts){
    const p=JSON.parse(opts.body), row=Object.fromEntries(Object.entries(p).map(([k,v])=>[k.replace(/^p_/,''),v]));
    if(path==='rpc/lancar_movimento'){row.id_movimento=movimentos.length+1;movimentos.push(row);return row.id_movimento;}
    Object.assign(movimentos.find(m=>m.id_movimento===row.id_movimento),row);return null;
  }
  if(path.includes('id_movimento=eq.'))return movimentos.filter(m=>m.id_movimento===Number(path.match(/id_movimento=eq\.(\d+)/)[1]));
  if(path.includes('documento=eq.'))return movimentos.filter(m=>m.documento===decodeURIComponent(path.match(/documento=eq\.([^&]+)/)[1])&&m.status!=='cancelado');
  const docs=path.match(/documento=in\.\(([^)]+)\)/)[1].split(',');
  return movimentos.filter(m=>docs.includes(m.documento)&&m.status!=='cancelado');
};
const totals=()=>[1,2].map(id=>Math.round(movimentos.filter(m=>m.id_conta===id&&m.status==='efetivado').reduce((s,m)=>s+m.valor,0)*100)/100);
(async()=>{
  titulos=[239,164.5,146.5,239,100].map((valor,i)=>({id_conta:i+1,id_cliente:1,valor_original:valor,valor_recebido:0,status_recebimento:'PENDENTE',id_movimento_financas:i+1,id_conta_financas:1}));
  movimentos=titulos.map(t=>({id_movimento:t.id_conta,id_conta:1,valor:t.valor_original,status:'pendente',data_movimento:'2026-09-05'}));
  for(const id of [1,2]){
    let saldo=400;
    for(const t of titulos){
      if(t.valor_recebido>=t.valor_original||saldo<=0)continue;
      const result=await ctx.aplicarBaixaContaReceber({...t},saldo,{id_conta_financas:id});
      assert.equal(result.ok,true);assert.equal(result.aviso,null);saldo=result.sobra;
    }
    assert.equal(saldo,0);
  }
  assert.deepEqual(totals(),[400,400]);
  for(const t of titulos)await ctx.sincronizarTituloFinanceiroAposAlteracao('contas_receber',t);
  assert.deepEqual(totals(),[400,400],'Editar um titulo nao pode redistribuir recebimentos');
  // Titulo antigo parcialmente recebido: os R$161 existentes ficam no Itau.
  baixas=[];titulos=[{id_conta:1,id_cliente:1,valor_original:164.5,valor_recebido:161,status_recebimento:'PARCIAL',id_movimento_financas:1,id_conta_financas:1}];
  movimentos=[{id_movimento:1,id_conta:1,valor:161,status:'efetivado',data_movimento:'2026-09-05'}];
  const result=await ctx.aplicarBaixaContaReceber({...titulos[0]},3.5,{id_conta_financas:2});
  assert.equal(result.aviso,null);assert.deepEqual(totals(),[161,3.5]);
  await ctx.sincronizarTituloFinanceiroAposAlteracao('contas_receber',{...titulos[0],valor_recebido:0,status_recebimento:'PENDENTE'});
  assert.deepEqual(totals(),[0,0]);
  assert.equal(movimentos[0].status,'pendente');
  console.log('OK: lotes 400/400, edicao posterior, baixa parcial legada e reativacao.');
})().catch(e=>{console.error(e);process.exitCode=1;});
