const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {PGlite} = require(process.argv[2]);

async function testDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create schema financas;
    create table public.empresas(id_empresa uuid primary key, integra_vendas_financas boolean);
    create table public.contas_receber(id_conta bigint primary key, empresa_id uuid, id_usuario bigint,
      id_cliente bigint,id_venda bigint,valor_original numeric,valor_recebido numeric,status_recebimento text,
      id_movimento_financas bigint,id_conta_financas bigint,data_vencimento date,data_recebimento timestamptz,
      meio_pagamento text,observacoes text);
    create table public.vendas(id_venda bigint,empresa_id uuid,codigo_venda text);
    create table public.contas_receber_baixas(id_baixa bigserial primary key,id_conta bigint,id_cliente bigint,
      empresa_id uuid,id_usuario bigint,valor_baixa numeric,data_baixa timestamptz,meio_pagamento text,observacoes text);
    create table financas.contas(id_conta bigint primary key,id_empresa uuid,ativo boolean,tipo text,saldo_atual numeric);
    create table financas.categorias(id_categoria bigserial primary key,id_empresa uuid,nome text,uso text,
      tipo text,cor text,descricao text,ativo boolean);
    create table financas.movimentos(id_movimento bigserial primary key,id_empresa uuid,id_conta bigint,
      id_conta_destino bigint,tipo text,valor numeric,descricao text,data_movimento date,data_vencimento date,
      data_efetivacao date,id_categoria bigint,status text,documento text,observacoes text);
    create function public.app_empresa_atual() returns uuid language sql as
      $$select '9bd65462-b979-4618-bb9d-851ef003d234'::uuid$$;
    create function public.app_usuario_atual() returns bigint language sql as $$select 1::bigint$$;
    create function public.test_scope() returns trigger language plpgsql as $$begin
      new.empresa_id:=public.app_empresa_atual();new.id_usuario:=public.app_usuario_atual();return new;end$$;
    create trigger app_definir_escopo before insert on public.contas_receber_baixas
      for each row execute function public.test_scope();
    create function public.test_category_scope() returns trigger language plpgsql as $$begin
      new.id_empresa:=public.app_empresa_atual();return new;end$$;
    create trigger definir_empresa_atual before insert on financas.categorias
      for each row execute function public.test_category_scope();
    create function public.test_title_error() returns trigger language plpgsql as $$begin
      if current_setting('test.failure',true)='title' then raise exception 'simulated title failure';end if;
      return new;end$$;
    create trigger test_title_error before update on public.contas_receber
      for each row execute function public.test_title_error();
    create function financas.lancar_movimento(p_tipo text,p_id_conta bigint,p_id_conta_destino bigint,
      p_valor numeric,p_descricao text,p_data_movimento date,p_data_vencimento date,p_data_efetivacao date,
      p_id_categoria bigint,p_status text,p_documento text,p_observacoes text) returns bigint
      language plpgsql as $$declare resultado bigint;begin
      insert into financas.movimentos(id_empresa,id_conta,tipo,valor,descricao,data_movimento,data_vencimento,
        data_efetivacao,id_categoria,status,documento,observacoes)
        values(public.app_empresa_atual(),p_id_conta,p_tipo,p_valor,p_descricao,p_data_movimento,p_data_vencimento,
          p_data_efetivacao,p_id_categoria,p_status,p_documento,p_observacoes) returning id_movimento into resultado;
      update financas.contas set saldo_atual=saldo_atual+p_valor where id_conta=p_id_conta;
      if current_setting('test.failure',true)='create' or
         (current_setting('test.failure',true)='second' and p_valor=100) then
        raise exception 'simulated finance failure';end if;
      return resultado;end$$;
    create function financas.alterar_movimento(p_id_movimento bigint,p_id_conta bigint,p_id_conta_destino bigint,
      p_tipo text,p_valor numeric,p_descricao text,p_data_movimento date,p_data_vencimento date,p_data_efetivacao date,
      p_id_categoria bigint,p_status text,p_documento text,p_observacoes text) returns void
      language plpgsql as $$declare anterior financas.movimentos;begin
      select * into anterior from financas.movimentos where id_movimento=p_id_movimento;
      if anterior.status='efetivado' then
        update financas.contas set saldo_atual=saldo_atual-anterior.valor where id_conta=anterior.id_conta;end if;
      update financas.movimentos set id_conta=p_id_conta,valor=p_valor,status=p_status,
        data_efetivacao=p_data_efetivacao where id_movimento=p_id_movimento;
      if p_status='efetivado' then update financas.contas set saldo_atual=saldo_atual+p_valor where id_conta=p_id_conta;end if;
      if current_setting('test.failure',true)='sync' then raise exception 'simulated sync failure';end if;
      end$$;
    insert into public.empresas values(public.app_empresa_atual(),true);
    insert into financas.contas values(1,public.app_empresa_atual(),true,'banco',0),
      (2,public.app_empresa_atual(),true,'banco',0);
    insert into financas.categorias(nome,uso,ativo) values('Vendas','entrada',true);
    insert into public.contas_receber(id_conta,empresa_id,id_usuario,id_cliente,valor_original,valor_recebido,
      status_recebimento,id_movimento_financas,id_conta_financas,data_vencimento)
      values(1,public.app_empresa_atual(),1,1,239,0,'PENDENTE',101,1,'2026-10-10'),
      (2,public.app_empresa_atual(),1,1,100,0,'PENDENTE',102,1,'2026-10-10');
    insert into financas.movimentos(id_movimento,id_empresa,id_conta,tipo,valor,status,data_movimento,data_vencimento,
      data_efetivacao,id_categoria,descricao) values
      (101,public.app_empresa_atual(),1,'entrada',239,'pendente','2026-10-01','2026-10-10','2026-10-10',1,'Titulo 1'),
      (102,public.app_empresa_atual(),1,'entrada',100,'pendente','2026-10-01','2026-10-10','2026-10-10',1,'Titulo 2');
  `);
  await db.exec(fs.readFileSync('sql/baixa_receber_atomica.sql','utf8'));
  const item = (id,value)=>({id_conta:id,id_cliente:1,valor_original:id===1?239:100,valor_recebido:0,
    status_recebimento:'PENDENTE',id_movimento_financas:id===1?101:102,valor:value,meio_pagamento:'PIX'});
  let operation = 0;
  const uuid = ()=>`00000000-0000-4000-8000-${String(++operation).padStart(12,'0')}`;
  const call = (items,opts={})=>db.query('select public.baixar_contas_receber_atomico($1,$2,$3,$4,$5,$6,$7) as r',
    [opts.id||uuid(),JSON.stringify(items),'2026-10-06T15:00:00Z',opts.integrar!==false,2,opts.category===undefined?1:opts.category,'Teste']);
  const snapshot = async()=>{
    const tables=['public.contas_receber','public.contas_receber_baixas','financas.movimentos','financas.contas',
      'financas.categorias','public.baixas_receber_operacoes'];
    return JSON.stringify(await Promise.all(tables.map(t=>db.query(`select to_jsonb(t) as row from ${t} t order by to_jsonb(t)::text`))));
  };
  for(const failure of ['create','sync','title','second']) {
    await db.exec(`select set_config('test.failure','${failure}',false)`);
    const before=await snapshot();
    await assert.rejects(call(failure==='second'?[item(1,239),item(2,100)]:[item(1,50)]));
    assert.equal(await snapshot(),before,`${failure}: all persisted state must roll back`);
  }
  await db.exec("select set_config('test.failure','',false)");
  await db.exec("update financas.categorias set nome='Outras'; select set_config('test.failure','create',false)");
  const beforeCategory=await snapshot();
  await assert.rejects(call([item(1,10)],{category:null}));
  assert.equal(await snapshot(),beforeCategory,'category creation must roll back with the payment');
  await db.exec("update financas.categorias set nome='Vendas'; select set_config('test.failure','',false)");
  const before=await snapshot();
  await assert.rejects(call([{...item(1,10),valor_recebido:1}]),/mudou/);
  assert.equal(await snapshot(),before);
  await db.exec("update financas.movimentos set status='efetivado' where id_movimento=101");
  const divergent=await snapshot();
  await assert.rejects(call([item(1,10)]),/ja tem movimento efetivado/);
  assert.equal(await snapshot(),divergent);
  await db.exec("update financas.movimentos set status='pendente' where id_movimento=101");
  const id=uuid();
  const first=await call([item(1,239),item(2,100)],{id});
  assert.equal(first.rows[0].r.aplicado,339);
  const success=await snapshot();
  assert.deepEqual((await call([item(1,239),item(2,100)],{id})).rows[0].r,first.rows[0].r);
  assert.equal(await snapshot(),success,'idempotent repeat must not change any persisted state');
  await assert.rejects(call([item(1,238),item(2,100)],{id}),/outros dados/);
  assert.equal(await snapshot(),success);
  const balance=await db.query('select saldo_atual from financas.contas where id_conta=2');
  assert.equal(Number(balance.rows[0].saldo_atual),339);
  const titles=await db.query("select count(*) as n from public.contas_receber where status_recebimento='RECEBIDO'");
  assert.equal(Number(titles.rows[0].n),2);
  assert.equal((await db.query('select count(*) as n from public.contas_receber_baixas')).rows[0].n,2);
  await db.exec(`
    insert into public.contas_receber(id_conta,empresa_id,id_usuario,id_cliente,valor_original,valor_recebido,
      status_recebimento,id_movimento_financas,id_conta_financas,data_vencimento)
      values(3,public.app_empresa_atual(),1,1,164.5,161,'PENDENTE',103,1,'2026-10-10'),
      (4,public.app_empresa_atual(),1,1,100,0,'PENDENTE',104,1,'2026-10-10');
    insert into financas.movimentos(id_movimento,id_empresa,id_conta,tipo,valor,status,data_movimento,data_vencimento,
      data_efetivacao,id_categoria,descricao) values
      (103,public.app_empresa_atual(),1,'entrada',161,'efetivado','2026-10-01','2026-10-10','2026-10-10',1,'Legado'),
      (104,public.app_empresa_atual(),1,'entrada',100,'pendente','2026-10-01','2026-10-10','2026-10-10',1,'Local');
    update financas.contas set saldo_atual=161 where id_conta=1;
  `);
  await call([{...item(3,3.5),valor_original:164.5,valor_recebido:161,id_movimento_financas:103}]);
  assert.equal(Number((await db.query('select saldo_atual from financas.contas where id_conta=1')).rows[0].saldo_atual),161);
  assert.equal(Number((await db.query('select saldo_atual from financas.contas where id_conta=2')).rows[0].saldo_atual),342.5);
  const financeBeforeLocal=JSON.stringify((await db.query('select to_jsonb(m) from financas.movimentos m order by id_movimento')).rows);
  await call([{...item(4,25),valor_original:100,id_movimento_financas:104}],{integrar:false});
  assert.equal(JSON.stringify((await db.query('select to_jsonb(m) from financas.movimentos m order by id_movimento')).rows),financeBeforeLocal);
  assert.equal(Number((await db.query('select valor_recebido from public.contas_receber where id_conta=4')).rows[0].valor_recebido),25);
  await db.exec(`
    grant usage on schema financas to anon;
    grant select,insert,update on all tables in schema public,financas to anon;
    grant usage,select on all sequences in schema public,financas to anon;
    alter table public.contas_receber enable row level security;
    create policy test_user_scope on public.contas_receber for all to anon
      using(empresa_id=public.app_empresa_atual() and id_usuario=public.app_usuario_atual())
      with check(empresa_id=public.app_empresa_atual() and id_usuario=public.app_usuario_atual());
    insert into public.contas_receber(id_conta,empresa_id,id_usuario,id_cliente,valor_original,valor_recebido,status_recebimento)
      values(5,public.app_empresa_atual(),2,1,100,0,'PENDENTE');
    set role anon;
  `);
  await assert.rejects(call([{...item(5,10),valor_original:100,id_movimento_financas:null}],{integrar:false}),/sem permissao/);
  await db.exec('reset role');
  assert.equal(Number((await db.query('select valor_recebido from public.contas_receber where id_conta=5')).rows[0].valor_recebido),0);
  await db.close();
  console.log('PASS SQL: full rollback including category/later batch, optimistic/EMPADE guards, replay, legacy account preservation and local-only partial payment.');
}

async function testClient() {
  const storage = new Map();
  let calls=0;
  const ctx=vm.createContext({console,Set,JSON,Math,Number,Date,crypto:{randomUUID:()=> 'operation-1'},
    sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    sessaoAtual:()=>({empresa_id:'company',id_usuario:1}),invalidarResumoContasVendas(){},
    contasValorAberto:t=>t.valor_original-t.valor_recebido,
    apiPost:async()=>{calls++;return {ok:false,data:{code:'P0001',message:'Falha simulada'}}}});
  vm.runInContext(fs.readFileSync('js/baixa_atomica.js','utf8'),ctx);
  const title={id_conta:1,id_cliente:1,valor_original:100,valor_recebido:0,status_recebimento:'PENDENTE'};
  const opts={data_baixa:'2026-10-06T15:00:00Z'};
  const result=await ctx.executarBaixaReceberAtomica([title],10,opts,{ativa:true,contaId:2});
  assert.equal(result.ok,false);assert.equal(title.valor_recebido,0);assert.equal(storage.size,0);assert.equal(calls,1);
  ctx.apiPost=async()=>{throw Error('connection lost')};
  assert.equal((await ctx.executarBaixaReceberAtomica([title],10,opts,{ativa:true,contaId:2})).ok,false);
  assert.equal(storage.size,1,'uncertain outcome keeps operation id');
  let id;
  ctx.apiPost=async(path,body)=>{id=body.p_id_operacao;return {ok:true,data:{ok:true,aplicado:10,qtd:1,titulos:[{conta:title}]}}};
  assert.equal((await ctx.executarBaixaReceberAtomica([title],10,opts,{ativa:true,contaId:2})).ok,true);
  assert.equal(id,'operation-1');assert.equal(storage.size,0);
  console.log('PASS client: database error stays failed, no optimistic local writes, network uncertainty retains replay id.');
}

(async()=>{await testDatabase();await testClient();})().catch(e=>{console.error(e);process.exitCode=1;});
