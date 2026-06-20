exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { query } = JSON.parse(event.body || '{}');
  if (!query) return { statusCode: 400, body: JSON.stringify({ error: 'query obrigatória' }) };

  try {
    // Detectar se é CNPJ
    const cnpjLimpo = query.replace(/\D/g, '');
    
    if (cnpjLimpo.length === 14) {
      // Busca direta por CNPJ
      const resultado = await buscarPorCNPJ(cnpjLimpo);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ resultados: resultado ? [resultado] : [] })
      };
    }

    // Busca por nome via BrasilAPI
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/search?query=${encodeURIComponent(query)}&limit=5`);
    
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const resultados = await Promise.all(data.slice(0, 5).map(item => buscarPorCNPJ(item.cnpj)));
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ resultados: resultados.filter(Boolean) })
        };
      }
    }

    // Fallback: ReceitaWS
    const res2 = await fetch(`https://receitaws.com.br/v1/cnpj/search?query=${encodeURIComponent(query)}`);
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2.companies && data2.companies.length > 0) {
        const resultados = await Promise.all(data2.companies.slice(0, 5).map(item => buscarPorCNPJ(item.cnpj.replace(/\D/g,''))));
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ resultados: resultados.filter(Boolean) })
        };
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ resultados: [] })
    };

  } catch(e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: e.message, resultados: [] })
    };
  }
};

async function buscarPorCNPJ(cnpj) {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!res.ok) {
      // Fallback ReceitaWS
      const res2 = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`);
      if (!res2.ok) return null;
      const d = await res2.json();
      if (d.status === 'ERROR') return null;
      return {
        razao_social: d.nome || null,
        nome_fantasia: d.fantasia || d.nome || null,
        cpf_cnpj: formatarCNPJ(cnpj),
        telefone: d.telefone || null,
        email: d.email || null,
        endereco: d.logradouro || null,
        numero: d.numero || null,
        bairro: d.bairro || null,
        cidade: d.municipio || null,
        estado: d.uf || null,
        cep: d.cep ? d.cep.replace(/\D/g,'').replace(/(\d{5})(\d{3})/,'$1-$2') : null,
        observacoes: d.atividade_principal?.[0]?.text || null
      };
    }
    const d = await res.json();
    return {
      razao_social: d.razao_social || null,
      nome_fantasia: d.nome_fantasia || d.razao_social || null,
      cpf_cnpj: formatarCNPJ(cnpj),
      telefone: d.ddd_telefone_1 ? formatarTelefone(d.ddd_telefone_1) : null,
      email: d.email || null,
      endereco: d.logradouro || null,
      numero: d.numero || null,
      bairro: d.bairro || null,
      cidade: d.municipio || null,
      estado: d.uf || null,
      cep: d.cep ? d.cep.replace(/\D/g,'').replace(/(\d{5})(\d{3})/,'$1-$2') : null,
      observacoes: d.cnae_fiscal_descricao || null
    };
  } catch(e) {
    return null;
  }
}

function formatarCNPJ(cnpj) {
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function formatarTelefone(tel) {
  const t = tel.replace(/\D/g,'');
  if (t.length === 10) return t.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  if (t.length === 11) return t.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  return tel;
}
