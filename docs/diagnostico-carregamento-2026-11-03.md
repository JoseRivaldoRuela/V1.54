# Diagnóstico do carregamento de Vendas e Finanças

Verificação realizada em 03/11/2026. Nenhuma configuração ou dado do banco foi alterado.

## Código publicado

- Vendas: `https://v1-54.vercel.app/index.html`.
- Finanças: `https://financas-jr-sistemas.vercel.app/index.html`.
- Os arquivos publicados `index.html`, `js/api.js` e `js/ui.js` de Vendas coincidem com os locais, normalizando CRLF.
- O `js/vendas.js` publicado não contém a melhoria local de tratamento de erro criada nesta investigação.
- Os arquivos publicados `index.html`, `js/state.js`, `js/navigation.js` e `js/dashboard.js` de Finanças coincidem com os locais.
- Os scripts baixados passaram pela análise de sintaxe do Node.
- O GitHub de Vendas aponta para `6b0cc5d`, cujo status Vercel registra publicação em 15/10/2026, horário de São Paulo. Isso não identifica possíveis publicações diretas posteriores.

## Testes em navegador isolado

Sessões fictícias e respostas simuladas; nenhum token real ou dado financeiro foi usado.

| Aplicação | Resposta simulada | Resultado |
| --- | --- | --- |
| Finanças publicado | HTTP 200, listas vazias | Carrega mês e painel; nenhum erro JavaScript |
| Finanças publicado | HTTP 406, Invalid schema: financas | Mês vazio e distribuição parada; erro aparece na área de análises recolhida |
| Vendas publicado, viewport 390×844 | HTTP 200, listas vazias | Painel carrega; nenhum erro JavaScript |
| Vendas publicado, viewport 390×844 | HTTP 400 na consulta do painel | Exibe Erro ao carregar dados, como na imagem |
| Vendas com ui.js e vendas.js do commit 6b0cc5d | HTTP 200, listas vazias | Painel carrega; nenhum erro JavaScript |
| Vendas com ui.js e vendas.js do commit 6b0cc5d | HTTP 400 na consulta do painel | Também exibe Erro ao carregar dados |

Esses testes identificam o caminho que produz os sintomas, mas não reproduzem uma sessão real nem provam qual alteração provocou o incidente.

## API real, sem sessão de usuário

- As duas consultas do painel de Vendas retornaram HTTP 200 e listas vazias. Testadas também com `Prefer: count=exact`.
- `contas?select=id_conta&limit=1`, com `Accept-Profile: financas`, retornou HTTP 406, código `PGRST106`, mensagem `Invalid schema: financas`, indicação de que somente `public` está exposto.
- O resultado SQL fornecido pelo usuário confirma privilégios em tabelas de Finanças. Privilégios de tabela e configuração de schemas expostos são verificações diferentes.

## Pendências para corrigir a causa

1. Obter a resposta de erro da consulta de Vendas em uma sessão autenticada. A consulta pública vazia não permite reproduzir esse caso.
2. Conferir a configuração efetiva `pgrst.db_schemas` e a lista de schemas expostos do projeto. O diagnóstico SQL existente é somente de leitura.
3. Identificar a publicação direta anterior que funcionava antes de propor rollback. O status do commit no GitHub não basta.

Não há evidência suficiente para prometer que um rollback das mudanças de navegação resolverá as duas aplicações. Também não foi identificada a autoria da configuração atual da API.
