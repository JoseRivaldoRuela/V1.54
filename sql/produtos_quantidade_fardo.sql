alter table public.produtos
  add column if not exists quantidade_fardo numeric(12,2);

comment on column public.produtos.quantidade_fardo is
  'Quantidade de unidades contidas em uma caixa, fardo ou embalagem fechada para quebra de estoque.';
