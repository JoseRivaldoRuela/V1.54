const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const source = fs.readFileSync(require('path').join(__dirname, '../js/ui.js'), 'utf8');
let popstate, observe, allow = true, modal = null, cancelled = false;
const entries = [];
const context = {
  currentTab: 'vendas', currentId: null, isNew: false,
  history: {
    state: null,
    replaceState(s) { this.state = s; entries[0] = s; },
    pushState(s) { this.state = s; entries.push(s); },
    back() {}
  },
  document: { body: {}, querySelectorAll: () => modal ? [modal] : [] },
  getComputedStyle: () => ({display:'flex'}),
  MutationObserver: class { constructor(fn) { observe = fn; } observe() {} },
  podeSairDoFormulario: () => allow,
  closeMenus() {}, closeSidebar() {},
  async switchTab(tab) {
    context.currentTab = tab; context.currentId = null; context.isNew = false;
    vm.runInContext('navegacaoVista=null;registrarNavegacao()', context);
  },
  openItem(id) { context.currentId = id; }, openNew() { context.isNew = true; },
  renderComparativoVendas() {}, renderRankingMesesVendas() {},
  renderBaixaClienteContas() {}, abrirEntradaBasicaCompra() {},
  renderConciliacaoNota() {}, abrirEmpresaAdmin() {}, abrirAreaChamados() {},
  addEventListener(type, fn) { popstate = fn; }
};
context.window = context;
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('let restaurandoNavegacao'), source.indexOf('// TAB SWITCH')), context);
vm.runInContext(source.slice(source.indexOf('function inicializarNavegacaoCompleta()'), source.indexOf('inicializarNavegacaoCompleta();')), context);
context.inicializarNavegacaoCompleta();
(async () => {
  context.registrarNavegacao();
  context.renderComparativoVendas();
  const comparativo = entries.at(-1);
  context.renderRankingMesesVendas();
  await popstate({state:comparativo});
  assert.equal(vm.runInContext('navegacaoAtual.vista.nome', context), 'renderComparativoVendas');
  for (const [tab, nome] of [['contas_receber','renderBaixaClienteContas'], ['compras','abrirEntradaBasicaCompra'], ['compras','renderConciliacaoNota'], ['empresas','abrirEmpresaAdmin'], ['ajuda','abrirAreaChamados']]) {
    await context.switchTab(tab);
    context[nome](7);
    const tela = entries.at(-1);
    await context.switchTab('vendas');
    await popstate({state:tela});
    assert.equal(context.currentTab, tab);
    assert.equal(vm.runInContext('navegacaoAtual.vista.nome', context), nome);
  }
  allow = false;
  await popstate({state:comparativo});
  assert.equal(context.currentTab, 'ajuda');
  modal = {querySelectorAll: () => [{textContent:'Cancelar',click() {cancelled=true;modal=null;}}]};
  observe();
  await popstate({state:entries.at(-2)});
  assert.equal(cancelled, true);
  assert.equal(context.currentTab, 'ajuda');
  console.log('OK: secondary screens across modules, unsaved changes, modal cancellation.');
})().catch(error => {console.error(error);process.exitCode=1;});
