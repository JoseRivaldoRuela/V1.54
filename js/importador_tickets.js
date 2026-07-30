let importadorTicketsState = {
  tickets: [],
  logs: [],
  importando: false
};

function renderImportadorTickets() {
  const body = document.getElementById('content-body');
  body.innerHTML = `
    <div style="max-width:1180px;margin:0 auto;padding:18px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:16px;">
        <div>
          <h2 style="margin:0 0 6px;color:var(--text);font-size:22px;">Importador de Tickets</h2>
          <p style="margin:0;color:var(--text3);font-size:13px;line-height:1.5;max-width:760px;">
            Selecione a pasta ou os PDFs dos tickets. O sistema le os arquivos, confere a previa e importa vendas,
            itens, cliente, produtos, contas a receber e estoque.
          </p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <label class="btn btn-secondary" style="cursor:pointer;">
            Selecionar arquivos
            <input id="ticket-files" type="file" accept=".pdf,application/pdf" multiple onchange="prepararImportacaoTickets(event)" style="display:none;">
          </label>
          <label class="btn btn-secondary" style="cursor:pointer;">
            Selecionar pasta
            <input id="ticket-folder" type="file" accept=".pdf,application/pdf" multiple webkitdirectory onchange="prepararImportacaoTickets(event)" style="display:none;">
          </label>
          <button class="btn btn-primary" id="btn-importar-tickets" onclick="importarTicketsSelecionados()" disabled>Importar selecionados</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px;">
        ${cardResumoImportador('Arquivos lidos', importadorTicketsState.tickets.length)}
        ${cardResumoImportador('Reconhecidos', importadorTicketsState.tickets.filter(t=>t.ok).length)}
        ${cardResumoImportador('Pendentes', importadorTicketsState.tickets.filter(t=>t.ok && !t.recebido).length)}
        ${cardResumoImportador('Recebidos', importadorTicketsState.tickets.filter(t=>t.ok && t.recebido).length)}
      </div>

      <div id="importador-status" style="margin-bottom:12px;color:var(--text3);font-size:13px;">
        Nenhum arquivo selecionado.
      </div>

      <div style="overflow:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface);">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:var(--surface2);color:var(--text2);">
              <th style="padding:10px;text-align:left;">Arquivo</th>
              <th style="padding:10px;text-align:left;">Cliente</th>
              <th style="padding:10px;text-align:center;">Venda</th>
      <th style="padding:10px;text-align:right;">Desconto</th>
      <th style="padding:10px;text-align:right;">Total</th>
              <th style="padding:10px;text-align:center;">Itens</th>
              <th style="padding:10px;text-align:center;">Financeiro</th>
              <th style="padding:10px;text-align:left;">Status</th>
            </tr>
          </thead>
          <tbody id="importador-preview">
            ${renderPreviewImportador()}
          </tbody>
        </table>
      </div>

      <div id="importador-log" style="margin-top:12px;font-family:var(--mono);font-size:12px;color:var(--text3);white-space:pre-wrap;"></div>
    </div>
  `;
  atualizarBotoesImportador();
}

function cardResumoImportador(label, valor) {
  return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;">
    <div style="color:var(--text3);font-size:11px;text-transform:uppercase;font-family:var(--mono);">${label}</div>
    <div style="color:var(--text);font-size:22px;font-weight:700;margin-top:4px;">${valor}</div>
  </div>`;
}

function renderPreviewImportador() {
  if(!importadorTicketsState.tickets.length) {
    return `<tr><td colspan="8" style="padding:18px;text-align:center;color:var(--text3);">Aguardando selecao de PDFs.</td></tr>`;
  }
  return importadorTicketsState.tickets.map(t => `
    <tr style="border-top:1px solid var(--border);">
      <td style="padding:10px;color:var(--text2);">${escapeHtml(t.arquivo)}</td>
      <td style="padding:10px;color:var(--text);">${escapeHtml(t.cliente || '-')}</td>
      <td style="padding:10px;text-align:center;color:var(--text2);">${t.data_venda ? formatarDataCurta(t.data_venda) : '-'}</td>
      <td style="padding:10px;text-align:right;color:${Number(t.desconto_total||0) > 0 ? 'var(--danger)' : 'var(--text2)'};font-family:var(--mono);">${Number(t.desconto_total||0) > 0 ? '- ' + moeda(t.desconto_total) : '-'}</td>
      <td style="padding:10px;text-align:right;color:var(--text);font-family:var(--mono);">${t.total != null ? moeda(t.total) : '-'}</td>
      <td style="padding:10px;text-align:center;color:var(--text2);">${t.itens?.length || 0}</td>
      <td style="padding:10px;text-align:center;">
        <span class="pill ${t.recebido?'on':'warn'}">${t.recebido?'RECEBIDO':'PENDENTE'}</span>
      </td>
      <td style="padding:10px;color:${t.ok?'var(--accent2)':'var(--danger)'};">${escapeHtml(t.ok ? 'Pronto' : (t.erro || 'Nao reconhecido'))}</td>
    </tr>
  `).join('');
}

async function prepararImportacaoTickets(event) {
  const files = Array.from(event.target.files || []).filter(f => /\.pdf$/i.test(f.name));
  importadorTicketsState = { tickets: [], logs: [], importando: false };
  renderImportadorTickets();
  const status = document.getElementById('importador-status');
  status.textContent = files.length ? `Lendo ${files.length} arquivo(s)...` : 'Nenhum PDF encontrado na selecao.';

  for(const file of files) {
    try {
      const texto = await extrairTextoTicketPdf(file);
      const ticket = parseTicketTexto(texto, file.name);
      importadorTicketsState.tickets.push(ticket);
    } catch(err) {
      importadorTicketsState.tickets.push({ arquivo:file.name, ok:false, erro:err.message || 'Erro ao ler PDF', itens:[] });
    }
    document.getElementById('importador-preview').innerHTML = renderPreviewImportador();
  }

  const ok = importadorTicketsState.tickets.filter(t=>t.ok).length;
  status.textContent = `${ok} de ${files.length} arquivo(s) reconhecido(s). Confira a previa antes de importar.`;
  atualizarBotoesImportador();
}

function atualizarBotoesImportador() {
  const btn = document.getElementById('btn-importar-tickets');
  if(btn) btn.disabled = importadorTicketsState.importando || !importadorTicketsState.tickets.some(t=>t.ok);
}

async function extrairTextoTicketPdf(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let pdf = '';
  for(let i=0;i<bytes.length;i+=32768) {
    pdf += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  }
  const items = pdfExtractTextItems(pdf);
  const linhas = pdfGroupLines(items);
  return linhas.join('\n');
}

function pdfParseObjects(pdf) {
  const objects = {};
  const re = /(\d+)\s+0\s+obj\s*([\s\S]*?)\s*endobj/g;
  let m;
  while((m = re.exec(pdf))) objects[Number(m[1])] = m[2];
  return objects;
}

function pdfExtractStream(body) {
  const m = /stream\r?\n([\s\S]*?)\r?\nendstream/.exec(body || '');
  return m ? m[1] : '';
}

function pdfParseCMap(stream) {
  const map = {};
  const re = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
  let m;
  while((m = re.exec(stream || ''))) {
    const src = m[1].toUpperCase();
    const dst = m[2];
    let out = '';
    for(let i=0;i<dst.length;i+=4) {
      const piece = dst.slice(i, i + 4);
      if(piece.length === 4) out += String.fromCharCode(parseInt(piece, 16));
    }
    map[src] = out;
  }
  return map;
}

function pdfDecodeHexText(hex, cmap) {
  const clean = String(hex || '').replace(/\s+/g, '').toUpperCase();
  let out = '';
  for(let i=0;i<clean.length;) {
    const code4 = clean.slice(i, i + 4);
    const code2 = clean.slice(i, i + 2);
    if(cmap && code4.length === 4 && cmap[code4]) {
      out += cmap[code4];
      i += 4;
    } else if(cmap && code2.length === 2 && cmap[code2]) {
      out += cmap[code2];
      i += 2;
    } else {
      out += '?';
      i += code4.length === 4 ? 4 : 2;
    }
  }
  return out;
}

function pdfExtractTextItems(pdf) {
  const objects = pdfParseObjects(pdf);
  const fontToCMapObject = {};
  Object.values(objects).forEach(body => {
    const re = /\/(F\d+)\s+(\d+)\s+0\s+R/g;
    let m;
    while((m = re.exec(body))) {
      const fontObject = objects[Number(m[2])];
      const uni = fontObject && /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(fontObject);
      if(uni) fontToCMapObject[m[1]] = Number(uni[1]);
    }
  });

  const fontMaps = {};
  Object.keys(fontToCMapObject).forEach(font => {
    const body = objects[fontToCMapObject[font]];
    if(body) fontMaps[font] = pdfParseCMap(pdfExtractStream(body));
  });

  const items = [];
  Object.values(objects).forEach(body => {
    if(!/stream/.test(body) || !/(\bTj\b|\bTf\b|\bBT\b)/.test(body)) return;
    const stream = pdfExtractStream(body);
    let currentFont = null, x = 0, y = 0;
    const re = /\/(F\d+)\s+[\d.]+\s+Tf|([-\d.]+)\s+([-\d.]+)\s+Td|<([0-9A-Fa-f\s]+)>\s*Tj/g;
    let m;
    while((m = re.exec(stream))) {
      if(m[1]) currentFont = m[1];
      else if(m[2]) {
        x = Number(m[2]);
        y = Number(m[3]);
      } else if(m[4]) {
        const text = pdfDecodeHexText(m[4], currentFont ? fontMaps[currentFont] : null).trim();
        if(text) items.push({ x, y, text });
      }
    }
  });
  return items;
}

function pdfGroupLines(items) {
  const lines = [];
  [...items].sort((a,b) => (b.y - a.y) || (a.x - b.x)).forEach(item => {
    let line = lines.find(l => Math.abs(l.y - item.y) <= 2);
    if(!line) {
      line = { y:item.y, parts:[] };
      lines.push(line);
    }
    line.parts.push(item);
  });
  return lines.map(line => line.parts.sort((a,b)=>a.x-b.x).map(p=>p.text).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function parseTicketTexto(texto, arquivo) {
  const linhas = texto.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const bruto = linhas.join('\n');
  const dataLine = linhas.find(l => /\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/.test(l));
  const clienteIdx = linhas.findIndex(l => /^CLIENTE$/i.test(removerAcentos(l)));
  const cliente = clienteIdx >= 0 ? linhas[clienteIdx + 1] : '';
  const offlineMatch = /(?:Codigo|Código)\s+venda\s+offline\s+([A-Za-z0-9]+)/i.exec(bruto);
  const offline = offlineMatch ? offlineMatch[1] : nomeArquivoRef(arquivo);
  const totalMatch = /TOTAL:\s*R\$\s*([\d.,]+)/i.exec(bruto);
  const descontoMatch = /DESCONTO:\s*(?:[\d.,]+\s*%\s*)?R\$\s*([\d.,]+)/i.exec(bruto);
  const abertoMatch = /Parcelas\s+em\s+aberto:\s*R\$\s*([\d.,]+)/i.exec(bruto);
  const obsMatch = /Observa(?:coes|ções):\s*(.*)/i.exec(bruto);

  const itens = [];
  let emItens = false;
  for(const linha of linhas) {
    if(/#\s+ITEM\s+Qtd/i.test(linha)) { emItens = true; continue; }
    if(/SUBTOTAL|Pagamento|Parcelas em aberto/i.test(linha)) emItens = false;
    if(!emItens) continue;
    const m = /^(\d+)\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/.exec(linha);
    if(m) {
      const quantidade = numeroBR(m[3]);
      const precoUnitario = numeroBR(m[4]);
      const subtotal = numeroBR(m[5]);
      itens.push({
        produto: m[2].trim(),
        quantidade,
        preco_unitario: precoUnitario,
        desconto_item: Number(Math.max(0, (quantidade * precoUnitario) - subtotal).toFixed(2)),
        subtotal
      });
    }
  }

  let vencimento = null, pagamento = 'BOLETO', pagamentoOriginal = '', dataRecebimento = null;
  for(const linha of linhas) {
    const m = /^1\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)(?:\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}))?\s+R\$\s*([\d.,]+)/i.exec(linha);
    if(m) {
      vencimento = dataBR(m[1]);
      pagamentoOriginal = m[2].trim();
      pagamento = normalizarMeioPagamentoTicket(pagamentoOriginal);
      dataRecebimento = m[3] ? timestampBR(m[3]) : null;
      break;
    }
  }

  const subtotalItens = itens.reduce((s,i)=>s+i.subtotal,0);
  const total = totalMatch ? numeroBR(totalMatch[1]) : subtotalItens;
  const descontoLinha = descontoMatch ? numeroBR(descontoMatch[1]) : 0;
  const descontoInferido = Math.max(0, subtotalItens - total);
  const descontoTotal = Number(Math.max(descontoLinha, descontoInferido).toFixed(2));
  const valorFinal = totalMatch
    ? Number(Math.max(0, total).toFixed(2))
    : Number(Math.max(0, subtotalItens - descontoTotal).toFixed(2));
  const aberto = abertoMatch ? numeroBR(abertoMatch[1]) : null;
  const recebido = (aberto !== null && Math.abs(aberto) < 0.01) || !!dataRecebimento;
  const dataVenda = dataLine ? timestampBR(dataLine.match(/\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/)[0]) : null;

  const erros = [];
  if(!cliente) erros.push('cliente');
  if(!dataVenda) erros.push('data');
  if(!itens.length) erros.push('itens');
  if(!vencimento) erros.push('vencimento');

  return {
    ok: erros.length === 0,
    erro: erros.length ? `Campos nao encontrados: ${erros.join(', ')}` : '',
    arquivo,
    offline,
    cliente,
    data_venda: dataVenda,
    vencimento,
    pagamento,
    pagamento_original: pagamentoOriginal,
    data_recebimento: dataRecebimento,
    recebido,
    total: Number(total.toFixed(2)),
    desconto_total: descontoTotal,
    valor_final: valorFinal,
    observacoes: obsMatch ? obsMatch[1].trim() : '',
    itens
  };
}

function calcularValorFinalTicket(ticket) {
  const base = Number(ticket?.total || 0);
  const desconto = Number(ticket?.desconto_total || 0);
  return Number(Math.max(0, base - desconto).toFixed(2));
}

async function importarTicketsSelecionados() {
  const tickets = importadorTicketsState.tickets.filter(t=>t.ok);
  if(!tickets.length) return;
  if(!confirm(`Importar ${tickets.length} ticket(s) para vendas, financeiro e estoque?`)) return;

  importadorTicketsState.importando = true;
  atualizarBotoesImportador();
  const logEl = document.getElementById('importador-log');
  const addLog = msg => {
    importadorTicketsState.logs.push(msg);
    if(logEl) logEl.textContent = importadorTicketsState.logs.join('\n');
  };

  try {
    addLog('Carregando cadastros...');
    const ctx = await carregarContextoImportador();
    for(const ticket of tickets) {
      await importarTicketUnico(ticket, ctx, addLog);
    }
    addLog('Recalculando estoque...');
    await recalcularEstoqueImportador();
    addLog('Importacao concluida.');
    toast('Tickets importados com sucesso.','success');
    await switchTab('vendas');
  } catch(err) {
    console.error(err);
    addLog('ERRO: ' + (err.message || err));
    toast('Erro na importacao: ' + (err.message || err),'error');
  } finally {
    importadorTicketsState.importando = false;
    atualizarBotoesImportador();
  }
}

async function carregarContextoImportador() {
  const [clientes, produtos, tipos] = await Promise.all([
    apiGet('clientes?select=id_cliente,razao_social,nome_fantasia&limit=10000'),
    apiGet('produtos?select=id_produto,nome_mercadoria,preco_custo,estoque_atual&limit=10000'),
    apiGet('tipo_mercadoria?select=id_tipo,descricao&limit=10000')
  ]);
  if(!Array.isArray(clientes) || !Array.isArray(produtos) || !Array.isArray(tipos)) throw new Error('Nao foi possivel carregar cadastros.');
  let tipo = tipos.find(t => normalizar(t.descricao) === normalizar('Importado de pedido'));
  if(!tipo) {
    const res = await apiPost('tipo_mercadoria', { descricao:'Importado de pedido' });
    if(!res.ok) throw new Error(res.data?.message || 'Erro ao criar tipo de mercadoria.');
    tipo = res.data[0];
  }
  return { clientes, produtos, tipoImportado: tipo };
}

async function importarTicketUnico(ticket, ctx, addLog) {
  const importRef = 'IMPORT-TICKET-' + String(ticket.offline || ticket.arquivo).replace(/[^A-Za-z0-9]+/g, '');
  const meioPagamento = normalizarMeioPagamentoTicket(ticket.pagamento || ticket.pagamento_original || 'BOLETO');
  const existente = await apiGet(`vendas?select=id_venda,codigo_venda,observacoes&observacoes=ilike.${encodeURIComponent('*' + importRef + '*')}&limit=1`);
  if(Array.isArray(existente) && existente.length) {
    const venda = existente[0];
    await atualizarVendaImportada(venda.id_venda, ticket, meioPagamento);
    await atualizarContaReceberImportada(venda.id_venda, venda.codigo_venda, ticket, importRef, meioPagamento);
    addLog(`${ticket.arquivo}: ja existia como ${venda.codigo_venda}; venda e financeiro atualizados.`);
    return;
  }

  const cliente = await obterOuCriarClienteImportador(ticket.cliente, importRef, ctx);
  let totalCusto = 0;
  const itensPayload = [];
  for(const item of ticket.itens) {
    const produto = await obterOuCriarProdutoImportador(item, importRef, ctx);
    totalCusto += Number(produto.preco_custo || 0) * Number(item.quantidade || 0);
    itensPayload.push({
      id_produto: produto.id_produto,
      quantidade: Number(item.quantidade),
      preco_unitario: Number(item.preco_unitario),
      desconto_item: Number(item.desconto_item || 0)
    });
  }

  const codigo = await proximoCodigoVendaImportador(ticket.data_venda);
  const valorFinal = calcularValorFinalTicket(ticket);
  const obs = `Ticket importado [${importRef}]. Arquivo: ${ticket.arquivo}. Vendedor: Rivaldo. Observacoes originais: ${ticket.observacoes || ''}. Desconto importado: ${moeda(ticket.desconto_total || 0)}. Saldo devedor do ticket ignorado na importacao.`;
  const dias = Math.max(0, diasEntreDatas(ticket.data_venda.slice(0,10), ticket.vencimento));
  const vendaRes = await apiPost('vendas', {
    codigo_venda: codigo,
    id_cliente: cliente.id_cliente,
    data_venda: ticket.data_venda,
    status_entrega: 'ENTREGUE',
    data_entrega: ticket.data_venda,
    valor_produtos: Number(totalCusto.toFixed(2)),
    desconto_total: Number(ticket.desconto_total || 0),
    valor_final: valorFinal,
    meio_pagamento: meioPagamento,
    quantidade_parcelas: 1,
    dias_vencimento: dias,
    data_vencimento: ticket.vencimento,
    observacoes: obs
  });
  if(!vendaRes.ok) throw new Error(vendaRes.data?.message || `Erro ao criar venda ${ticket.arquivo}`);
  const venda = vendaRes.data[0];

  const itensRes = await apiPost('venda_itens', itensPayload.map(i => ({ ...i, id_venda: venda.id_venda })));
  if(!itensRes.ok) throw new Error(itensRes.data?.message || `Erro ao criar itens da venda ${codigo}`);

  const contaRes = await apiPost('contas_receber', {
    id_venda: venda.id_venda,
    id_cliente: cliente.id_cliente,
    data_vencimento: ticket.vencimento,
    valor_original: valorFinal,
    valor_recebido: ticket.recebido ? valorFinal : 0,
    meio_pagamento: meioPagamento,
    status_recebimento: ticket.recebido ? 'RECEBIDO' : 'PENDENTE',
    data_recebimento: ticket.recebido ? (ticket.data_recebimento || ticket.data_venda) : null,
    observacoes: `Pedido ${codigo} - Parcela 1/1 - importado de ${importRef}`
  });
  if(!contaRes.ok) throw new Error(contaRes.data?.message || `Erro ao criar conta a receber ${codigo}`);

  addLog(`${ticket.arquivo}: importado como ${codigo}.`);
}

async function atualizarVendaImportada(idVenda, ticket, meioPagamento) {
  const valorFinal = calcularValorFinalTicket(ticket);
  const res = await apiPatch(`vendas?id_venda=eq.${idVenda}`, {
    desconto_total: Number(ticket.desconto_total || 0),
    valor_final: valorFinal,
    meio_pagamento: meioPagamento
  });
  if(!res.ok) throw new Error(res.data?.message || `Erro ao atualizar desconto da venda ${idVenda}`);
}

async function atualizarContaReceberImportada(idVenda, codigo, ticket, importRef, meioPagamento) {
  const valorFinal = calcularValorFinalTicket(ticket);
  const res = await apiPatch(`contas_receber?id_venda=eq.${idVenda}`, {
    observacoes: `Pedido ${codigo || '#' + idVenda} - Parcela 1/1 - importado de ${importRef}`,
    status_recebimento: ticket.recebido ? 'RECEBIDO' : 'PENDENTE',
    valor_original: valorFinal,
    valor_recebido: ticket.recebido ? valorFinal : 0,
    meio_pagamento: meioPagamento,
    data_recebimento: ticket.recebido ? (ticket.data_recebimento || ticket.data_venda) : null
  });
  if(!res.ok) throw new Error(res.data?.message || `Erro ao atualizar conta da venda ${codigo}`);
}

async function obterOuCriarClienteImportador(nome, importRef, ctx) {
  const key = normalizar(nome);
  let cliente = ctx.clientes.find(c => normalizar(c.nome_fantasia || c.razao_social) === key || normalizar(c.razao_social) === key);
  if(cliente) return cliente;
  const res = await apiPost('clientes', {
    razao_social: nome,
    nome_fantasia: nome,
    observacoes: `Cliente criado automaticamente na importacao do ticket ${importRef}`,
    ativo: true
  });
  if(!res.ok) throw new Error(res.data?.message || `Erro ao criar cliente ${nome}`);
  cliente = res.data[0];
  ctx.clientes.push(cliente);
  return cliente;
}

async function obterOuCriarProdutoImportador(item, importRef, ctx) {
  const key = normalizar(item.produto);
  let produto = ctx.produtos.find(p => normalizar(p.nome_mercadoria) === key);
  if(produto) return produto;
  const res = await apiPost('produtos', {
    nome_mercadoria: item.produto,
    id_tipo: ctx.tipoImportado.id_tipo,
    unidade: 'UN',
    estoque_atual: 0,
    preco_custo: 0,
    preco_venda: Number(item.preco_unitario),
    observacoes: `Produto criado automaticamente na importacao do ticket ${importRef}`,
    ativo: true
  });
  if(!res.ok) throw new Error(res.data?.message || `Erro ao criar produto ${item.produto}`);
  produto = res.data[0];
  ctx.produtos.push(produto);
  return produto;
}

async function proximoCodigoVendaImportador(dataVenda) {
  const d = new Date(dataVenda);
  const prefixo = `V${String(d.getFullYear()).slice(2)}${String(d.getMonth()+1).padStart(2,'0')}-`;
  const vendas = await apiGet(`vendas?select=codigo_venda&codigo_venda=like.${encodeURIComponent(prefixo + '*')}&limit=10000`);
  const usados = new Set(Array.isArray(vendas) ? vendas.map(v=>v.codigo_venda) : []);
  let seq = 1;
  (Array.isArray(vendas) ? vendas : []).forEach(v => {
    const m = new RegExp('^' + prefixo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d{3})$').exec(v.codigo_venda || '');
    if(m) seq = Math.max(seq, Number(m[1]) + 1);
  });
  let codigo = prefixo + String(seq).padStart(3, '0');
  while(usados.has(codigo)) {
    seq += 1;
    codigo = prefixo + String(seq).padStart(3, '0');
  }
  return codigo;
}

async function recalcularEstoqueImportador() {
  const [produtos, vendas, vendaItens, compras, compraItens, movimentos] = await Promise.all([
    apiGet('produtos?select=id_produto,estoque_atual&limit=10000'),
    apiGet('vendas?select=id_venda,status_entrega&limit=10000'),
    apiGet('venda_itens?select=id_venda,id_produto,quantidade&limit=10000'),
    apiGet('compras?select=id_compra,status_compra&limit=10000'),
    apiGet('compra_itens?select=id_compra,id_produto,quantidade&limit=10000'),
    apiGet('estoque_movimentacoes?select=id_produto,tipo_movimentacao,quantidade&limit=10000')
  ]);
  if(!Array.isArray(produtos)) throw new Error('Nao foi possivel recalcular produtos.');
  const vendaStatus = new Map((Array.isArray(vendas)?vendas:[]).map(v=>[Number(v.id_venda), v.status_entrega]));
  const compraStatus = new Map((Array.isArray(compras)?compras:[]).map(c=>[Number(c.id_compra), c.status_compra]));
  const saldos = new Map(produtos.map(p=>[Number(p.id_produto), 0]));

  (Array.isArray(vendaItens)?vendaItens:[]).forEach(i => {
    const st = vendaStatus.get(Number(i.id_venda));
    const sinal = st === 'ENTREGUE' ? -1 : st === 'CANCELADO' ? 1 : 0;
    saldos.set(Number(i.id_produto), (saldos.get(Number(i.id_produto)) || 0) + sinal * Number(i.quantidade || 0));
  });
  (Array.isArray(compraItens)?compraItens:[]).forEach(i => {
    const st = compraStatus.get(Number(i.id_compra));
    const sinal = st === 'LIBERADA' ? 1 : st === 'CANCELADA' ? -1 : 0;
    saldos.set(Number(i.id_produto), (saldos.get(Number(i.id_produto)) || 0) + sinal * Number(i.quantidade || 0));
  });
  (Array.isArray(movimentos)?movimentos:[]).forEach(m => {
    const sinal = m.tipo_movimentacao === 'ENTRADA_AJUSTE' ? 1 : m.tipo_movimentacao === 'SAIDA_AJUSTE' ? -1 : 0;
    saldos.set(Number(m.id_produto), (saldos.get(Number(m.id_produto)) || 0) + sinal * Number(m.quantidade || 0));
  });

  for(const produto of produtos) {
    const saldo = Number((saldos.get(Number(produto.id_produto)) || 0).toFixed(2));
    if(Number(produto.estoque_atual || 0) !== saldo) {
      const res = await apiPatch(`produtos?id_produto=eq.${produto.id_produto}`, { estoque_atual: saldo });
      if(!res.ok) throw new Error(res.data?.message || `Erro ao atualizar estoque do produto ${produto.id_produto}`);
    }
  }
}

function normalizar(txt) {
  return removerAcentos(String(txt || '')).toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizarMeioPagamentoTicket(valor) {
  const txt = removerAcentos(String(valor || '')).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  if(!txt) return 'BOLETO';
  if(txt.includes('PIX')) return 'PIX';
  if(txt.includes('DINHEIRO') || txt.includes('ESPECIE')) return 'DINHEIRO';
  if(txt.includes('CARTAO') || txt.includes('CREDITO') || txt.includes('DEBITO') || txt === 'CARD') return 'CARTAO';
  if(txt.includes('BOLETO') || txt.includes('DUPLICATA') || txt.includes('PRAZO')) return 'BOLETO';
  return 'BOLETO';
}

function removerAcentos(txt) {
  return String(txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function numeroBR(txt) {
  return Number(String(txt || '0').replace(/\./g, '').replace(',', '.')) || 0;
}

function dataBR(txt) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(txt || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function timestampBR(txt) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/.exec(txt || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}-03:00` : null;
}

function diasEntreDatas(inicio, fim) {
  return Math.round((new Date(fim + 'T00:00:00') - new Date(inicio + 'T00:00:00')) / 86400000);
}

function nomeArquivoRef(nome) {
  return String(nome || '').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9]+/g, '').slice(0, 16) || String(Date.now());
}

function escapeHtml(txt) {
  return String(txt ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function moeda(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
}

function formatarDataCurta(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' });
}

