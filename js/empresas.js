let empresasAdmin = [];

function filtrarEmpresasAdmin(termo='') {
  const lista=!termo?empresasAdmin:empresasAdmin.filter(e=>normalizarBusca(`${e.nome} ${e.codigo}`).includes(termo));
  document.getElementById('item-list').innerHTML=lista.map(e=>`
    <div class="item-card" onclick="abrirEmpresaAdmin('${e.id_empresa}')">
      <div class="item-name">${e.nome}</div>
      <div class="item-sub"><span class="pill ${e.ativo?'on':'off'}">${e.ativo?'ATIVA':'INATIVA'}</span><span class="pill ${e.integra_vendas_financas?'on':'off'}">${e.integra_vendas_financas?'VENDAS + FINANÇAS':'SEM INTEGRAÇÃO'}</span><span>${e.codigo} · ${e.total_usuarios} usuário${Number(e.total_usuarios)!==1?'s':''}</span></div>
    </div>`).join('') || '<div style="padding:20px;text-align:center;color:var(--text3);">Nenhuma empresa encontrada</div>';
}

async function renderEmpresasAdmin() {
  document.getElementById('content-header').style.display='none';
  document.getElementById('content-body').innerHTML='<div class="loading"><div class="spinner"></div> Carregando empresas...</div>';
  const res = await apiPost('rpc/listar_empresas_admin',{});
  if(!res.ok || !Array.isArray(res.data)) {
    document.getElementById('content-body').innerHTML='<div class="empty-state"><p>Não foi possível carregar as empresas.</p></div>';
    return;
  }
  empresasAdmin=res.data;
  items=empresasAdmin; filtered=[...empresasAdmin];
  filtrarEmpresasAdmin();
  document.getElementById('sidebar-footer').textContent=`${empresasAdmin.length} empresas`;
  document.getElementById('content-body').innerHTML=`
    <div class="dash-chart-box">
      <div class="dash-chart-title"><span>Administração de empresas</span></div>
      <p style="color:var(--text2);line-height:1.7;">Cadastre uma nova empresa junto com seu primeiro usuário administrador. Os dados e usuários de cada empresa permanecerão isolados.</p>
      <button class="btn btn-primary" style="margin-top:16px;" onclick="abrirNovaEmpresa()">+ Nova empresa</button>
    </div>
    <div class="dash-chart-box" style="margin-top:14px;">
      <div class="dash-chart-title"><span>Empresas cadastradas (${empresasAdmin.length})</span></div>
      <div class="dash-list">
        ${empresasAdmin.map(e=>`<div class="dash-list-item" onclick="abrirEmpresaAdmin('${e.id_empresa}')">
          <span class="pill ${e.ativo?'on':'off'}">${e.ativo?'ATIVA':'INATIVA'}</span>
          <div style="flex:1;min-width:0;"><div class="dash-list-name">${e.nome}</div><div style="font-size:11px;color:var(--text2);">Código: ${e.codigo} · ${e.total_usuarios} usuário${Number(e.total_usuarios)!==1?'s':''}</div></div>
          <span style="color:var(--text3);">Editar ›</span>
        </div>`).join('') || '<div style="padding:20px;text-align:center;color:var(--text3);">Nenhuma empresa cadastrada</div>'}
      </div>
    </div>`;
}

function abrirNovaEmpresa() {
  currentId=null; isNew=true;
  showHeader('Nova empresa','novo','Primeiro administrador');
  renderFormEmpresa(null);
  closeSidebar();
}

function abrirEmpresaAdmin(id) {
  const e=empresasAdmin.find(x=>String(x.id_empresa)===String(id));
  if(!e) return;
  currentId=id; isNew=false;
  showHeader(e.nome,e.codigo,`${e.total_usuarios} usuário${Number(e.total_usuarios)!==1?'s':''}`);
  document.getElementById('content-body').innerHTML=`
    <div class="section-label"><span>Empresa</span></div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="f-editar-empresa-nome" value="${e.nome}"/></div>
      <div class="form-group"><label class="form-label">Código de acesso</label><input class="form-input" value="${e.codigo}" readonly/></div>
      <div class="form-group"><label class="form-label">Usuários</label><input class="form-input" value="${e.total_usuarios}" readonly/></div>
    </div>
    <div class="section-label"><span>Acesso ao sistema</span></div>
    <div class="toggle-row">
      <div class="toggle-info"><strong>Empresa ativa</strong><span>Empresa inativa não pode fazer login nem acessar dados.</span></div>
      <label class="toggle"><input type="checkbox" id="f-editar-empresa-ativa" ${e.ativo?'checked':''} ${e.codigo==='jr'?'disabled':''}/><span class="toggle-slider"></span></label>
    </div>
    <div class="toggle-row">
      <div class="toggle-info"><strong>Integrar Vendas com Finanças</strong><span>Habilita esta empresa para a futura sincronização entre os dois sistemas.</span></div>
      <label class="toggle"><input type="checkbox" id="f-editar-integra-vendas-financas" ${e.integra_vendas_financas?'checked':''}/><span class="toggle-slider"></span></label>
    </div>
    ${e.codigo==='jr'?'<div style="font-size:11px;color:var(--warn);margin-top:6px;">A empresa principal JR não pode ser desativada.</div>':''}
    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save" onclick="salvarEmpresaExistente('${e.id_empresa}')">Salvar alterações</button>
      <button class="btn btn-secondary" onclick="renderEmpresasAdmin()">Voltar</button>
    </div>`;
  closeSidebar();
}

async function salvarEmpresaExistente(id) {
  const nome=document.getElementById('f-editar-empresa-nome').value.trim();
  const ativo=document.getElementById('f-editar-empresa-ativa').checked;
  const integrar=document.getElementById('f-editar-integra-vendas-financas').checked;
  if(!nome){ toast('Informe o nome da empresa.','error'); return; }
  const btn=document.getElementById('btn-save'); btn.disabled=true; btn.textContent='Salvando...';
  const res=await apiPost('rpc/atualizar_empresa_admin',{p_id_empresa:id,p_nome:nome,p_ativo:ativo,p_integra_vendas_financas:integrar});
  if(!res.ok || res.data?.ok===false){ toast(res.data?.message||'Erro ao atualizar empresa.','error'); btn.disabled=false; btn.textContent='Salvar alterações'; return; }
  if(typeof integracaoFinancasAtivaCache!=='undefined')integracaoFinancasAtivaCache=null;
  formularioAlterado=false;
  toast('Empresa atualizada!','success');
  await renderEmpresasAdmin();
}

function renderFormEmpresa() {
  document.getElementById('content-body').innerHTML=`
    <div class="section-label"><span>Dados da empresa</span></div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Nome da empresa *</label><input class="form-input" id="f-empresa-nome" placeholder="Nome da empresa"/></div>
      <div class="form-group"><label class="form-label">Código para login *</label><input class="form-input" id="f-empresa-codigo" placeholder="ex.: empresa01"/></div>
    </div>
    <div class="toggle-row" style="margin-top:14px;">
      <div class="toggle-info"><strong>Integrar Vendas com Finanças</strong><span>Habilita esta empresa para a futura sincronização entre os dois sistemas.</span></div>
      <label class="toggle"><input type="checkbox" id="f-empresa-integra-vendas-financas"/><span class="toggle-slider"></span></label>
    </div>
    <div class="section-label"><span>Primeiro usuário administrador</span></div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Nome *</label><input class="form-input" id="f-primeiro-nome" placeholder="Nome completo"/></div>
      <div class="form-group"><label class="form-label">Usuário *</label><input class="form-input" id="f-primeiro-username" placeholder="Usuário de acesso"/></div>
      <div class="form-group"><label class="form-label">Senha *</label><input type="password" class="form-input" id="f-primeiro-senha"/></div>
      <div class="form-group"><label class="form-label">Confirmar senha *</label><input type="password" class="form-input" id="f-primeiro-senha2"/></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save" onclick="salvarNovaEmpresa()">Criar empresa e administrador</button>
      <button class="btn btn-secondary" onclick="cancelForm()">Cancelar</button>
    </div>`;
}

async function salvarNovaEmpresa() {
  const nome=document.getElementById('f-empresa-nome').value.trim();
  const codigo=document.getElementById('f-empresa-codigo').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'');
  const usuarioNome=document.getElementById('f-primeiro-nome').value.trim();
  const username=document.getElementById('f-primeiro-username').value.trim();
  const senha=document.getElementById('f-primeiro-senha').value;
  const senha2=document.getElementById('f-primeiro-senha2').value;
  const integrar=document.getElementById('f-empresa-integra-vendas-financas').checked;
  if(!nome||!codigo||!usuarioNome||!username||!senha){ toast('Preencha todos os campos obrigatórios.','error'); return; }
  if(senha!==senha2){ toast('As senhas não coincidem.','error'); return; }
  if(senha.length<6){ toast('A senha deve ter pelo menos 6 caracteres.','error'); return; }
  const btn=document.getElementById('btn-save'); btn.disabled=true; btn.textContent='Criando...';
  const res=await apiPost('rpc/criar_empresa_com_admin',{p_codigo:codigo,p_nome:nome,p_usuario_nome:usuarioNome,p_username:username,p_senha:senha,p_integra_vendas_financas:integrar});
  if(!res.ok || res.data?.ok===false){ toast(res.data?.message||'Erro ao criar empresa.','error'); btn.disabled=false; btn.textContent='Criar empresa e administrador'; return; }
  if(typeof integracaoFinancasAtivaCache!=='undefined')integracaoFinancasAtivaCache=null;
  formularioAlterado=false;
  toast('Empresa e primeiro administrador criados!','success');
  await renderEmpresasAdmin();
}
