const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');

async function verificar(respostas, falha, mensagem) {
  const detalhe = {textContent: ''};
  const botao = {};
  const body = {
    innerHTML: '',
    querySelector: seletor => seletor === '[data-erro-vendas]' ? detalhe : botao
  };
  let chamadas = 0;
  const contexto = vm.createContext({
    window: {addEventListener() {}},
    document: {getElementById: () => body, addEventListener() {}}, dashMesOffset: 0,
    apiGet: async () => {
      const indice = chamadas++;
      if (falha) throw falha;
      return respostas[indice];
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/vendas.js'), 'utf8'), contexto);
  await vm.runInContext('renderDashboard()', contexto);
  assert.equal(detalhe.textContent, mensagem);
  assert.match(body.innerHTML, /Tentar novamente/);
  assert.equal(typeof botao.onclick, 'function');
  assert.ok(!body.innerHTML.includes('<img'));
  // A nova tentativa precisa efetivamente refazer as duas consultas.
  await botao.onclick();
  assert.equal(chamadas, 4);
}

(async () => {
  await verificar([{code: '42501', message: 'permission denied'}, []], null,
    '[42501] permission denied');
  await verificar(null, new Error('Failed to fetch'), 'Failed to fetch');
  for(const code of ['57014','42501']) {
    let chamadas=0;
    const contexto=vm.createContext({window:{addEventListener(){}},document:{addEventListener(){}},apiGet:async()=>++chamadas===1?{code,message:'Erro de leitura'}:[]});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/vendas.js'),'utf8'),contexto);
    if(code==='57014') {
      const dados=await vm.runInContext('carregarItensDashboardVendas()',contexto);
      assert.equal(dados.length,0);
      assert.equal(chamadas,2);
    } else {
      await assert.rejects(vm.runInContext('carregarItensDashboardVendas()',contexto),erro=>erro.code==='42501');
      assert.equal(chamadas,1);
    }
  }
  console.log('OK: falhas de vendas e rede; timeout repete uma vez; permissão não é repetida.');
})().catch(erro => { console.error(erro); process.exitCode = 1; });
