# Prompt para Importar Tickets em Lote

Use este prompt quando for enviar imagens de tickets para transformar em vendas no sistema.

Pasta padrao dos arquivos:

```text
C:\VendasClaude\painel-clientes-local\tickets
```

```text
Codex, importe os tickets da pasta tickets para o sistema.

Para cada ticket:
- cadastrar cliente se não existir;
- cadastrar produto se não existir;
- criar venda como ENTREGUE;
- gerar código sequencial mensal;
- inserir os itens da venda;
- baixar estoque;
- gerar contas a receber;
- ignorar o campo "saldo devedor" do ticket;
- se o total do ticket estiver com a fonte cortada/tachada ao meio, considerar a conta como RECEBIDA;
- se o total nao estiver cortado/tachado, gerar a conta em aberto;
- evitar duplicidade se o SQL for executado novamente;
- colocar o código do pedido nas contas a receber;
- gerar um SQL único para rodar no Supabase.

Antes de gerar o SQL final, me mostre um resumo dos pedidos encontrados para eu conferir.
```

Fluxo recomendado:

1. Salvar as imagens em `C:\VendasClaude\painel-clientes-local\tickets`.
2. Pedir para ler todos os arquivos da pasta `tickets`.
3. Conferir o resumo extraído.
4. Aprovar a geração do SQL.
5. Rodar o arquivo SQL gerado no Supabase SQL Editor.
