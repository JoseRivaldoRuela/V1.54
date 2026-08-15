// Sessão
const usuario = JSON.parse(sessionStorage.getItem('usuario_logado')||'null');
if (!usuario?.token) {
  sessionStorage.removeItem('usuario_logado');
  location.href='/login.html';
}
const isAdmin = usuario?.admin === true || usuario?.admin === 'true' || usuario?.admin === 1;
let isSuperAdminJr = false;

// Estado
let currentTab='clientes', items=[], filtered=[], currentId=null, isNew=false;
let formularioAlterado=false;
let cnpjMode='new', cnpjSelected=null;
let cacheTipos=[], cacheFornecedores=[], cacheProdutos=[], cacheClientes=[];

// Config das abas
const tabConfig = {
  contas_receber:   { table:'contas_receber',          id:'id_conta',          label:'Conta a Receber',    plural:'Contas a Receber',    order:'id_conta', searchFields:['status_recebimento','meio_pagamento','observacoes','codigo_venda','data_venda','valor_original','valor_recebido','data_vencimento','clientes.nome_fantasia','clientes.razao_social'], hasCNPJ:false, hasAtivo:false },
  contas_pagar:     { table:'contas_pagar',            id:'id_conta_pagar',    label:'Conta a Pagar',      plural:'Contas a Pagar',      order:'data_vencimento', searchFields:['status_pagamento','meio_pagamento','observacoes','valor_original','valor_pago','data_vencimento','fornecedor_nome','compras.codigo_compra','compras.data_compra'], hasCNPJ:false, hasAtivo:false },
  vendas:           { table:'vendas',                  id:'id_venda',          label:'Venda',              plural:'Vendas',              order:'status_entrega', searchFields:['codigo_venda','status_entrega','meio_pagamento','valor_final','data_venda','data_entrega','observacoes','clientes.nome_fantasia','clientes.razao_social'], hasCNPJ:false, hasAtivo:false },
  compras:          { table:'compras',                 id:'id_compra',         label:'Compra',             plural:'Compras',             order:'data_compra', searchFields:['codigo_compra','numero_nota','chave_nfe','status_compra','valor_total','data_compra','fornecedor_nome','observacoes'], hasCNPJ:false, hasAtivo:false },
  clientes:         { table:'clientes',                   id:'id_cliente',        label:'Cliente',            plural:'Clientes',            order:'razao_social', searchFields:['razao_social','nome_fantasia','cidade','telefone'], hasCNPJ:true, hasAtivo:true },
  fornecedores:     { table:'fornecedores',               id:'id_fornecedor',     label:'Fornecedor',         plural:'Fornecedores',         order:'razao_social', searchFields:['razao_social','nome_fantasia','cidade','telefone'], hasCNPJ:true, hasAtivo:true },
  tipo_mercadoria:  { table:'tipo_mercadoria',            id:'id_tipo',           label:'Tipo de Mercadoria', plural:'Tipos de Mercadoria',  order:'descricao',    searchFields:['descricao'], hasCNPJ:false, hasAtivo:false },
  produtos_tab:     { table:'produtos',                   id:'id_produto',        label:'Produto',            plural:'Produtos',             order:'nome_mercadoria', searchFields:['nome_mercadoria','tipo_mercadoria.descricao','fornecedores.nome_fantasia','fornecedores.razao_social'], hasCNPJ:false, hasAtivo:true },
  precos_especiais: { table:'produtos_precos_especiais',  id:'id_preco_especial', label:'Preço Especial',     plural:'Preços Especiais',     order:'id_preco_especial', searchFields:['observacoes','preco_especial','clientes.nome_fantasia','clientes.razao_social','produtos.nome_mercadoria'], hasCNPJ:false, hasAtivo:false },
  estoque_movimentacoes: { table:'estoque_movimentacoes', id:'id_movimentacao',   label:'Movimentação',       plural:'Movimentações de Estoque', order:'data_movimentacao', searchFields:['tipo_movimentacao','origem','observacoes','quantidade','produtos.nome_mercadoria'], hasCNPJ:false, hasAtivo:false },
  kardex:           { table:'produtos',                   id:'id_produto',        label:'Kardex',             plural:'Kardex de Estoque',    order:'nome_mercadoria', searchFields:['nome_mercadoria','tipo_mercadoria.descricao','fornecedores.nome_fantasia','fornecedores.razao_social'], hasCNPJ:false, hasAtivo:false },
  usuarios:         { table:'usuarios',                   id:'id_usuario',        label:'Usuário',            plural:'Usuários',             order:'nome',         searchFields:['nome','username'], hasCNPJ:false, hasAtivo:true }
};

tabConfig.empresas = { table:'empresas', id:'id_empresa', label:'Empresa', plural:'Empresas', order:'nome', searchFields:['nome','codigo'], hasCNPJ:false, hasAtivo:true };

tabConfig.importador_tickets = { table:'vendas', id:'id_venda', label:'Importar Tickets', plural:'Importador de Tickets', order:'id_venda', searchFields:['codigo_venda'], hasCNPJ:false, hasAtivo:false };
tabConfig.ajuda = { table:'chamados_suporte', id:'id_chamado', label:'Chamado', plural:'Central de Ajuda', order:'criado_em', searchFields:['assunto','descricao','modulo','status'], hasCNPJ:false, hasAtivo:false };

let dashPeriodo = '7'; // dias
let dashMesOffset = 0; // 0 = mes atual, -1 = mes anterior
let dashRankingModo = 'mes'; // mes ou ano
let dashRankingMes = new Date().getMonth();
let dashRankingAno = new Date().getFullYear();
let dashComparativoMeses = 12;
let dashComparativoAno = new Date().getFullYear();
let dashComparativoModo = 'ultimos'; // ultimos | ano
let contasDashPeriodo = '7'; // dias
let contasDashMesOffset = 0; // 0 = mes atual, -1 = mes anterior
let contasPagarDashPeriodo = '7'; // dias
let contasPagarDashMesOffset = 0; // 0 = mes atual, -1 = mes anterior
let contasPagarFiltroAtivo = null; // filtro aplicado pelos cards do dashboard
let contasPagarDataPagasModo = 'pagamento'; // pagamento | vencimento
let contasReceberMostrarTodos = false; // lista lateral: abertos por padrao
let contasReceberClienteFiltro = null; // lista lateral: visão por cliente
let contasComparativoMeses = 12;
let contasComparativoAno = new Date().getFullYear();
let contasComparativoModo = 'ultimos'; // ultimos | ano
let produtosDashPeriodo = '7'; // dias
let produtosDashMesOffset = 0; // 0 = mes atual, -1 = mes anterior
let produtosDashVisao = 'vendidos'; // vendidos | estoque
let produtosComparativoMeses = 12;
let produtosComparativoAno = new Date().getFullYear();
let produtosComparativoModo = 'ultimos'; // ultimos | ano
let itensVenda = []; // itens do pedido atual
let itensCompra = []; // itens da compra atual
let cacheCobrancas = [];
let kardexPeriodo = 'mes';
let kardexProdutoId = '';
let kardexInicio = '';
let kardexFim = '';
