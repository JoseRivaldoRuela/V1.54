const SUPA_URL=process.env.SUPABASE_URL||'https://jlfltollgwtrqpapqnnp.supabase.co';
// A chave anon e publica e ja faz parte da configuracao do aplicativo.
const ANON_KEY=process.env.SUPABASE_ANON_KEY||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsZmx0b2xsZ3d0cnFwYXBxbm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDcwNDQsImV4cCI6MjA5NDI4MzA0NH0.A9uEdtRQrI0zjFn6W9euH7B3cmMVuRyuTud7_oFSF7g';
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
module.exports=async function handler(req,res){
  res.setHeader('Content-Type','application/json');
  if(req.method!=='POST')return res.status(405).json({error:'Metodo nao permitido'});
  if(!SERVICE_KEY||!process.env.RESEND_API_KEY)return res.status(503).json({error:'Envio de e-mail nao configurado'});
  const token=req.headers['x-app-session']; const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}); const id=Number(body.id_chamado||0);
  if(!token||!id)return res.status(400).json({error:'Dados invalidos'});
  try{
    const sessao=await fetch(`${SUPA_URL}/rest/v1/rpc/app_usuario_atual`,{method:'POST',headers:{apikey:ANON_KEY,Authorization:`Bearer ${ANON_KEY}`,'X-App-Session':token,'Content-Type':'application/json'},body:'{}'});
    const idUsuario=Number(await sessao.json()); if(!sessao.ok||!idUsuario)return res.status(401).json({error:'Sessao invalida'});
    const headers={apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`};
    const chamado=(await (await fetch(`${SUPA_URL}/rest/v1/chamados_suporte?select=*&id_chamado=eq.${id}&limit=1`,{headers})).json())?.[0];
    if(!chamado||Number(chamado.id_usuario)!==idUsuario)return res.status(403).json({error:'Acesso negado'});
    const jr=(await (await fetch(`${SUPA_URL}/rest/v1/empresas?select=id_empresa&codigo=ilike.jr&limit=1`,{headers})).json())?.[0];
    if(!jr)return res.status(500).json({error:'Empresa JR nao encontrada'});
    const adms=await (await fetch(`${SUPA_URL}/rest/v1/usuarios?select=email&empresa_id=eq.${jr.id_empresa}&admin=eq.true&ativo=eq.true&email=not.is.null`,{headers})).json();
    const emails=[...new Set(adms.map(x=>String(x.email||'').trim()).filter(Boolean))]; if(!emails.length)return res.status(422).json({error:'Administrador JR sem e-mail cadastrado'});
    const html=`<h2>Novo chamado #${id}</h2><p><b>Empresa:</b> ${esc(chamado.empresa_nome)}</p><p><b>Usuario:</b> ${esc(chamado.usuario_nome)} (${esc(chamado.usuario_email||'sem e-mail')})</p><p><b>Modulo:</b> ${esc(chamado.modulo)}<br><b>Prioridade:</b> ${esc(chamado.prioridade)}</p><p><b>Assunto:</b> ${esc(chamado.assunto)}</p><p style="white-space:pre-wrap">${esc(chamado.descricao)}</p><p>Acesse Ajuda e Suporte no sistema JR para tratar.</p>`;
    const envio=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.EMAIL_REMETENTE||'Sistema JR <onboarding@resend.dev>',to:emails,subject:`[Chamado #${id}] ${chamado.prioridade} - ${chamado.assunto}`,html})});
    const retorno=await envio.json(); if(!envio.ok)return res.status(502).json({error:retorno.message||'Erro no provedor de e-mail'}); return res.status(200).json({ok:true,destinatarios:emails.length});
  }catch(e){return res.status(500).json({error:e.message});}
};
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
