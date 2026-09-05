-- Define por produto se uma venda pode deixar o estoque negativo.
-- A regra solicitada e permissiva para todos os produtos atuais e novos.
begin;

alter table public.produtos
  add column if not exists aceita_faturar_sem_saldo boolean default true;

update public.produtos
   set aceita_faturar_sem_saldo=true
 where aceita_faturar_sem_saldo is null;

alter table public.produtos
  alter column aceita_faturar_sem_saldo set default true,
  alter column aceita_faturar_sem_saldo set not null;

commit;

select id_produto,nome_mercadoria,ativo,estoque_atual,aceita_faturar_sem_saldo
  from public.produtos
 order by nome_mercadoria;
