import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const API = 'https://his-biomedico-production.up.railway.app';

const parseJwt = (t) => {
  try { return JSON.parse(atob(t.split('.')[1])); }
  catch { return null; }
};
const tokenValido = (t) => {
  try { const p=parseJwt(t); if(!p)return false; if(p.exp)return p.exp*1000>Date.now(); return true; }
  catch { return false; }
};
const getEstadoInvima = (fecha) => {
  if(!fecha)return null;
  const diff=(new Date(fecha)-new Date())/(1000*60*60*24);
  if(diff<0)  return{label:'VENCIDO',    cls:'badge-red'};
  if(diff<=30)return{label:'POR VENCER', cls:'badge-orange'};
  return           {label:'VIGENTE',     cls:'badge-green'};
};
const formatFecha = (f) => {
  if(!f)return'—';
  return new Date(f).toLocaleDateString('es-CO',{year:'numeric',month:'short',day:'2-digit'});
};
const prioridadBadge = (p) => p==='CRITICA'?'badge-red':p==='ALTA'?'badge-orange':'badge-gray';

const G = {
  bg:'#0f1623', sidebar:'#131d2e', card:'#19253a', cardBorder:'#1e2f47',
  accent:'#00e5a0', accentDim:'#00b87a', danger:'#ff4d6d', warning:'#ffb347',
  text:'#e2eaf4', textMuted:'#6b8099', input:'#0f1e30', inputBorder:'#1e3a56',
  rowHover:'#1c2d42',
};
const CHART_COLORS = ['#00e5a0','#4da6ff','#ffb347','#ff4d6d','#a78bfa','#34d399','#f472b6'];

const css = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${G.bg};color:${G.text};font-family:'IBM Plex Sans',sans-serif;font-size:14px}
  ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:${G.bg}}::-webkit-scrollbar-thumb{background:${G.cardBorder};border-radius:3px}
  .layout{display:flex;min-height:100vh}
  .sidebar{width:220px;background:${G.sidebar};border-right:1px solid ${G.cardBorder};display:flex;flex-direction:column;flex-shrink:0;position:fixed;top:0;left:0;bottom:0;overflow-y:auto}
  .sidebar-logo{padding:24px 20px 20px;border-bottom:1px solid ${G.cardBorder}}
  .logo-mark{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:${G.accent};letter-spacing:2px;text-transform:uppercase}
  .logo-sub{font-size:10px;color:${G.textMuted};margin-top:3px;letter-spacing:1px}
  .inst-badge{margin-top:8px;padding:4px 8px;background:rgba(0,229,160,0.08);border:1px solid rgba(0,229,160,0.2);border-radius:4px;font-size:10px;color:${G.accent};font-family:'IBM Plex Mono',monospace;word-break:break-word}
  .nav-section{padding:16px 0;flex:1}
  .nav-label{font-size:10px;color:${G.textMuted};letter-spacing:2px;text-transform:uppercase;padding:0 20px 8px}
  .nav-item{display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;color:${G.textMuted};font-size:13px;font-weight:500;transition:all 0.15s;border-left:3px solid transparent}
  .nav-item:hover{background:${G.card};color:${G.text}}
  .nav-item.active{color:${G.accent};background:rgba(0,229,160,0.06);border-left-color:${G.accent}}
  .nav-icon{font-size:16px;width:20px;text-align:center}
  .sidebar-footer{padding:16px 20px;border-top:1px solid ${G.cardBorder};font-size:12px;color:${G.textMuted}}
  .rol-badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-family:'IBM Plex Mono',monospace;font-weight:600;letter-spacing:1px;text-transform:uppercase;background:rgba(0,229,160,0.12);color:${G.accent};margin-top:4px}
  .superadmin-badge{background:rgba(167,139,250,0.12);color:#a78bfa}
  .main{margin-left:220px;flex:1;display:flex;flex-direction:column}
  .session-banner{background:rgba(0,229,160,0.06);border-bottom:1px solid rgba(0,229,160,0.15);padding:6px 28px;font-size:11px;color:${G.textMuted};display:flex;align-items:center;gap:6px}
  .session-dot{width:6px;height:6px;border-radius:50%;background:${G.accent};display:inline-block}
  .topbar{background:${G.sidebar};border-bottom:1px solid ${G.cardBorder};padding:14px 28px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
  .topbar-title{font-size:16px;font-weight:600;color:${G.text}}
  .topbar-right{display:flex;align-items:center;gap:12px}
  .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:4px;border:none;cursor:pointer;font-family:'IBM Plex Sans',sans-serif;font-size:12px;font-weight:600;letter-spacing:.5px;transition:all 0.15s}
  .btn-primary{background:${G.accent};color:#0a1520}.btn-primary:hover{background:${G.accentDim}}
  .btn-ghost{background:transparent;border:1px solid ${G.cardBorder};color:${G.textMuted}}.btn-ghost:hover{border-color:${G.accent};color:${G.accent}}
  .btn-danger{background:transparent;border:1px solid transparent;color:${G.danger}}.btn-danger:hover{background:rgba(255,77,109,0.1)}
  .btn-purple{background:rgba(167,139,250,0.15);color:#a78bfa;border:1px solid rgba(167,139,250,0.3)}.btn-purple:hover{background:rgba(167,139,250,0.25)}
  .btn-logout{background:transparent;border:1px solid rgba(255,77,109,0.3);color:${G.danger};font-size:11px;padding:6px 12px}.btn-logout:hover{background:rgba(255,77,109,0.1);border-color:${G.danger}}
  .btn-icon{padding:6px 10px;font-size:13px}
  .content{padding:24px 28px;flex:1}
  .kpi-grid{display:grid;gap:16px;margin-bottom:24px}
  .kpi-card{background:${G.card};border:1px solid ${G.cardBorder};border-radius:6px;padding:18px 20px;position:relative;overflow:hidden}
  .kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
  .kpi-card.green::before{background:${G.accent}}.kpi-card.red::before{background:${G.danger}}
  .kpi-card.orange::before{background:${G.warning}}.kpi-card.blue::before{background:#4da6ff}
  .kpi-card.purple::before{background:#a78bfa}.kpi-card.yellow::before{background:#fbbf24}
  .kpi-card.teal::before{background:#2dd4bf}
  .kpi-label{font-size:10px;color:${G.textMuted};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px}
  .kpi-value{font-family:'IBM Plex Mono',monospace;font-size:28px;font-weight:600;color:${G.text};line-height:1}
  .kpi-sub{font-size:10px;color:${G.textMuted};margin-top:4px;font-family:'IBM Plex Mono'}
  .kpi-card.red .kpi-value{color:${G.danger}}.kpi-card.orange .kpi-value{color:${G.warning}}
  .alert-bar{background:rgba(255,77,109,0.08);border:1px solid rgba(255,77,109,0.3);border-radius:6px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:flex-start;gap:12px}
  .alert-icon{font-size:18px;flex-shrink:0}
  .alert-title{font-size:11px;font-weight:600;color:${G.danger};letter-spacing:1px;text-transform:uppercase;margin-bottom:4px}
  .alert-item{font-size:12px;color:#ffaab8;margin:2px 0}
  .panel{background:${G.card};border:1px solid ${G.cardBorder};border-radius:6px;margin-bottom:24px;overflow:hidden}
  .panel-header{padding:14px 20px;border-bottom:1px solid ${G.cardBorder};display:flex;align-items:center;justify-content:space-between}
  .panel-title{font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${G.textMuted}}
  .panel-body{padding:20px}
  .chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
  .form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
  .form-grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px}
  .field{display:flex;flex-direction:column;gap:5px}
  .field label{font-size:10px;color:${G.textMuted};letter-spacing:1px;text-transform:uppercase;font-weight:600}
  .field input,.field select,.field textarea{background:${G.input};border:1px solid ${G.inputBorder};border-radius:4px;padding:8px 10px;color:${G.text};font-family:'IBM Plex Sans',sans-serif;font-size:13px;transition:border-color 0.15s;outline:none}
  .field input:focus,.field select:focus,.field textarea:focus{border-color:${G.accent}}
  .field select option{background:${G.input}}
  .field textarea{resize:vertical;min-height:72px}
  .search-bar{display:flex;align-items:center;gap:8px;background:${G.input};border:1px solid ${G.inputBorder};border-radius:4px;padding:8px 12px;margin-bottom:16px;max-width:360px}
  .search-bar input{background:transparent;border:none;outline:none;color:${G.text};font-family:'IBM Plex Sans',sans-serif;font-size:13px;flex:1}
  .data-table{width:100%;border-collapse:collapse}
  .data-table th{text-align:left;padding:10px 14px;font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${G.textMuted};border-bottom:1px solid ${G.cardBorder};white-space:nowrap}
  .data-table td{padding:11px 14px;border-bottom:1px solid rgba(30,47,71,0.5);font-size:12px;color:${G.text};vertical-align:middle}
  .data-table tr:last-child td{border-bottom:none}
  .data-table tbody tr:hover td{background:${G.rowHover}}
  .badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-family:'IBM Plex Mono',monospace;font-weight:600;letter-spacing:.5px;text-transform:uppercase}
  .badge-green{background:rgba(0,229,160,0.12);color:${G.accent}}
  .badge-red{background:rgba(255,77,109,0.12);color:${G.danger}}
  .badge-orange{background:rgba(255,179,71,0.12);color:${G.warning}}
  .badge-gray{background:rgba(107,128,153,0.15);color:${G.textMuted}}
  .badge-purple{background:rgba(167,139,250,0.12);color:#a78bfa}
  .timeline{padding:4px 0}
  .tl-item{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(30,47,71,0.5);align-items:flex-start}
  .tl-item:last-child{border-bottom:none}
  .tl-dot{width:8px;height:8px;border-radius:50%;background:${G.accent};margin-top:5px;flex-shrink:0}
  .tl-content{flex:1}
  .tl-action{font-size:11px;font-weight:600;color:${G.accent};text-transform:uppercase;letter-spacing:.5px}
  .tl-desc{font-size:12px;color:${G.text};margin-top:1px}
  .tl-date{font-size:10px;color:${G.textMuted};font-family:'IBM Plex Mono',monospace;margin-top:3px}
  .empty-state{text-align:center;padding:40px;color:${G.textMuted};font-size:13px}
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100;display:flex;align-items:center;justify-content:center}
  .modal{background:${G.card};border:1px solid ${G.cardBorder};border-radius:8px;width:580px;max-width:95vw;overflow:hidden;max-height:90vh;overflow-y:auto}
  .modal-header{padding:16px 20px;border-bottom:1px solid ${G.cardBorder};display:flex;align-items:center;justify-content:space-between}
  .modal-title{font-size:13px;font-weight:600;color:${G.text}}
  .modal-body{padding:20px}
  .modal-footer{padding:14px 20px;border-top:1px solid ${G.cardBorder};display:flex;justify-content:flex-end;gap:8px}
  .inst-selector{min-height:100vh;background:${G.bg};display:flex;align-items:center;justify-content:center;background-image:radial-gradient(ellipse at 20% 50%,rgba(167,139,250,0.05) 0%,transparent 60%)}
  .inst-card{background:${G.card};border:1px solid ${G.cardBorder};border-radius:8px;padding:40px;width:520px;max-width:95vw}
  .inst-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px}
  .inst-item{background:${G.input};border:1px solid ${G.inputBorder};border-radius:6px;padding:16px;cursor:pointer;transition:all 0.15s}
  .inst-item:hover{border-color:${G.accent};background:rgba(0,229,160,0.04)}
  .inst-item-name{font-size:13px;font-weight:600;color:${G.text};margin-bottom:4px}
  .inst-item-nit{font-size:11px;color:${G.textMuted};font-family:'IBM Plex Mono',monospace}
  .inst-item-ciudad{font-size:11px;color:${G.textMuted};margin-top:2px}
  .login-wrap{min-height:100vh;background:${G.bg};display:flex;align-items:center;justify-content:center;background-image:radial-gradient(ellipse at 20% 50%,rgba(0,229,160,0.04) 0%,transparent 60%)}
  .login-card{background:${G.card};border:1px solid ${G.cardBorder};border-radius:8px;padding:40px;width:380px}
  .login-logo{font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:600;color:${G.accent};letter-spacing:3px;text-transform:uppercase;margin-bottom:4px}
  .login-sub{font-size:12px;color:${G.textMuted};margin-bottom:32px;letter-spacing:.5px}
`;

// ─── LOGIN ────────────────────────────────────────────────────────────
function LoginPro({ setToken }) {
  const [email, setEmail]     = useState('');
  const [pass, setPass]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API}/login`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email, password: pass })
      });
      const data = await res.json();
      if (data.token) { localStorage.setItem('biomed_token', data.token); setToken(data.token); }
      else setError(data.error || 'Credenciales inválidas');
    } catch { setError('No se pudo conectar al servidor'); }
    setLoading(false);
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">BioMed·HIS</div>
        <div className="login-sub">Sistema de Información Hospitalaria — Colombia</div>
        <div className="field" style={{marginBottom:14}}>
          <label>Correo electrónico</label>
          <input type="email" placeholder="usuario@hospital.com" value={email}
            onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} />
        </div>
        <div className="field" style={{marginBottom:20}}>
          <label>Contraseña</label>
          <input type="password" placeholder="••••••••" value={pass}
            onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} />
        </div>
        {error && <div style={{color:G.danger,fontSize:12,marginBottom:14}}>⚠ {error}</div>}
        <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:'10px'}}
          onClick={handleLogin} disabled={loading}>
          {loading ? 'Autenticando...' : 'Ingresar al sistema'}
        </button>
        <div style={{marginTop:20,fontSize:10,color:G.textMuted,textAlign:'center'}}>
          Resolución 3100 · Decreto 4725 · Ley 1581
        </div>
      </div>
    </div>
  );
}

// ─── SELECTOR DE INSTITUCIÓN (SuperAdmin) ────────────────────────────
function SelectorInstitucion({ token, user, onSeleccionar }) {
  const [instituciones, setInstituciones] = useState([]);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    fetch(`${API}/instituciones`, { headers:{ Authorization: token } })
      .then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setInstituciones(d); setLoading(false); })
      .catch(()=>setLoading(false));
  }, [token]);

  const seleccionar = async (inst) => {
    const res  = await fetch(`${API}/instituciones/seleccionar/${inst.id}`, {
      method:'POST', headers:{ Authorization: token }
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('biomed_token', data.token);
      onSeleccionar(data.token);
    }
  };

  const verTodo = () => onSeleccionar(token); // SuperAdmin ve todo sin filtro

  return (
    <div className="inst-selector">
      <div className="inst-card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <div>
            <div style={{fontFamily:'IBM Plex Mono',fontSize:14,fontWeight:600,color:G.accent,letterSpacing:2}}>BioMed·HIS</div>
            <div style={{fontSize:12,color:G.textMuted,marginTop:2}}>Super Admin — Selecciona una institución</div>
          </div>
          <span className={`badge badge-purple`}>SuperAdmin</span>
        </div>
        <div style={{height:1,background:G.cardBorder,margin:'16px 0'}} />
        {loading ? (
          <div className="empty-state">Cargando instituciones...</div>
        ) : (
          <>
            <div className="inst-grid">
              {instituciones.filter(i=>i.activa).map(inst=>(
                <div key={inst.id} className="inst-item" onClick={()=>seleccionar(inst)}>
                  <div className="inst-item-name">🏥 {inst.nombre}</div>
                  <div className="inst-item-nit">NIT: {inst.nit||'—'}</div>
                  <div className="inst-item-ciudad">{inst.ciudad||'—'}</div>
                </div>
              ))}
            </div>
            <div style={{marginTop:16,display:'flex',gap:8}}>
              <button className="btn btn-purple" style={{flex:1,justifyContent:'center'}} onClick={verTodo}>
                ◈ Ver todas las instituciones
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── MODALES ─────────────────────────────────────────────────────────
function ModalInstitucion({ institucion, token, onClose, onSaved }) {
  const esNueva = !institucion;
  const [form, setForm] = useState({
    nombre: institucion?.nombre||'', nit: institucion?.nit||'',
    direccion: institucion?.direccion||'', ciudad: institucion?.ciudad||'',
    telefono: institucion?.telefono||'', email: institucion?.email||'',
    logo_url: institucion?.logo_url||'', codigo_reps: institucion?.codigo_reps||'',
    activa: institucion?.activa!==false,
  });
  const [saving, setSaving] = useState(false);
  const guardar = async () => {
    if (!form.nombre) { alert('El nombre es obligatorio'); return; }
    setSaving(true);
    const url    = esNueva ? `${API}/instituciones` : `${API}/instituciones/${institucion.id}`;
    const method = esNueva ? 'POST' : 'PUT';
    const res    = await fetch(url,{method,headers:{'Content-Type':'application/json',Authorization:token},body:JSON.stringify(form)});
    const data   = await res.json();
    setSaving(false);
    if (data.error) { alert(data.error); return; }
    onSaved(); onClose();
  };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{esNueva?'Nueva institución':'Editar institución'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field" style={{gridColumn:'1/3'}}><label>Nombre *</label><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} /></div>
            <div className="field"><label>NIT</label><input value={form.nit} onChange={e=>setForm({...form,nit:e.target.value})} placeholder="900123456-1" /></div>
            <div className="field"><label>Código REPS</label><input value={form.codigo_reps} onChange={e=>setForm({...form,codigo_reps:e.target.value})} /></div>
            <div className="field"><label>Ciudad</label><input value={form.ciudad} onChange={e=>setForm({...form,ciudad:e.target.value})} /></div>
            <div className="field" style={{gridColumn:'1/3'}}><label>Dirección</label><input value={form.direccion} onChange={e=>setForm({...form,direccion:e.target.value})} /></div>
            <div className="field"><label>Teléfono</label><input value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})} /></div>
            <div className="field"><label>Email institucional</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
            <div className="field"><label>Logo URL</label><input value={form.logo_url} onChange={e=>setForm({...form,logo_url:e.target.value})} placeholder="https://..." /></div>
            {!esNueva && (
              <div className="field"><label>Estado</label>
                <select value={form.activa?'true':'false'} onChange={e=>setForm({...form,activa:e.target.value==='true'})}>
                  <option value="true">Activa</option>
                  <option value="false">Inactiva</option>
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving?'Guardando...':(esNueva?'+ Crear':'✓ Guardar')}</button>
        </div>
      </div>
    </div>
  );
}

function ModalOT({ equipos, token, onClose, onSaved }) {
  const [form, setForm] = useState({ equipo_id:'', tipo:'Preventivo', descripcion:'', fecha_programada:'', prioridad:'NORMAL' });
  const [saving, setSaving] = useState(false);
  const guardar = async () => {
    if (!form.equipo_id||!form.fecha_programada) { alert('Equipo y fecha son obligatorios'); return; }
    setSaving(true);
    await fetch(`${API}/mantenimientos`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:token},body:JSON.stringify(form)});
    setSaving(false); onSaved(); onClose();
  };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header"><div className="modal-title">Nueva Orden de Trabajo</div><button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="form-grid-2">
            <div className="field"><label>Equipo *</label>
              <select value={form.equipo_id} onChange={e=>setForm({...form,equipo_id:e.target.value})}>
                <option value="">Seleccionar</option>
                {equipos.map(eq=><option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
              </select></div>
            <div className="field"><label>Tipo</label>
              <select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}>
                {['Preventivo','Correctivo','Calibración','Inspección'].map(t=><option key={t}>{t}</option>)}
              </select></div>
            <div className="field"><label>Fecha *</label><input type="date" value={form.fecha_programada} onChange={e=>setForm({...form,fecha_programada:e.target.value})} /></div>
            <div className="field"><label>Prioridad</label>
              <select value={form.prioridad} onChange={e=>setForm({...form,prioridad:e.target.value})}>
                {['NORMAL','ALTA','CRITICA'].map(p=><option key={p}>{p}</option>)}
              </select></div>
          </div>
          <div className="field"><label>Descripción</label><textarea value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving?'Guardando...':'+ Crear OT'}</button>
        </div>
      </div>
    </div>
  );
}

function ModalFinalizar({ ot, token, onClose, onSaved }) {
  const [obs, setObs]         = useState('');
  const [saving, setSaving]   = useState(false);
  const finalizar = async () => {
    setSaving(true);
    await fetch(`${API}/mantenimientos/${ot.id}`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:token},body:JSON.stringify({observaciones:obs})});
    setSaving(false); onSaved(); onClose();
  };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header"><div className="modal-title">Finalizar OT — {ot.equipo_nombre}</div><button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div style={{marginBottom:14,padding:'10px 14px',background:G.input,borderRadius:4,fontSize:12}}>
            <div style={{color:G.textMuted,fontSize:10,letterSpacing:1,textTransform:'uppercase',marginBottom:4}}>Detalle</div>
            <div><b>Tipo:</b> {ot.tipo} · <b>Programado:</b> {formatFecha(ot.fecha_programada)}</div>
          </div>
          <div className="field"><label>Observaciones</label><textarea value={obs} onChange={e=>setObs(e.target.value)} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={finalizar} disabled={saving}>{saving?'Guardando...':'✓ Finalizar'}</button>
        </div>
      </div>
    </div>
  );
}

function ModalTecno({ equipos, token, onClose, onSaved }) {
  const [form, setForm] = useState({ equipo_id:'', tipo:'Incidente', descripcion:'', fecha_evento:'', gravedad:'LEVE' });
  const [saving, setSaving] = useState(false);
  const guardar = async () => {
    if (!form.descripcion||!form.fecha_evento) { alert('Descripción y fecha son obligatorios'); return; }
    setSaving(true);
    await fetch(`${API}/tecnovigilancia`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:token},body:JSON.stringify(form)});
    setSaving(false); onSaved(); onClose();
  };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header"><div className="modal-title">Nuevo Reporte de Tecnovigilancia</div><button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="form-grid-2">
            <div className="field"><label>Equipo (opcional)</label>
              <select value={form.equipo_id} onChange={e=>setForm({...form,equipo_id:e.target.value})}>
                <option value="">Sin equipo específico</option>
                {equipos.map(eq=><option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
              </select></div>
            <div className="field"><label>Tipo</label>
              <select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}>
                {['Incidente','Evento Adverso','Alerta de Seguridad','Falla Técnica'].map(t=><option key={t}>{t}</option>)}
              </select></div>
            <div className="field"><label>Fecha *</label><input type="date" value={form.fecha_evento} onChange={e=>setForm({...form,fecha_evento:e.target.value})} /></div>
            <div className="field"><label>Gravedad</label>
              <select value={form.gravedad} onChange={e=>setForm({...form,gravedad:e.target.value})}>
                {['LEVE','MODERADO','GRAVE'].map(g=><option key={g}>{g}</option>)}
              </select></div>
          </div>
          <div className="field"><label>Descripción *</label><textarea value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} style={{minHeight:100}} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving?'Guardando...':'+ Crear reporte'}</button>
        </div>
      </div>
    </div>
  );
}

function ModalUsuario({ usuario, token, instituciones, rol, onClose, onSaved }) {
  const esNuevo = !usuario;
  const [form, setForm] = useState({
    nombre: usuario?.nombre||'', email: usuario?.email||'',
    rol: usuario?.rol||'Biomedico', password:'',
    institucion_id: usuario?.institucion_id||''
  });
  const [saving, setSaving] = useState(false);
  const guardar = async () => {
    if (!form.nombre||!form.email) { alert('Nombre y email son obligatorios'); return; }
    if (esNuevo&&!form.password) { alert('La contraseña es obligatoria'); return; }
    setSaving(true);
    const url    = esNuevo ? `${API}/register` : `${API}/usuarios/${usuario.id}`;
    const method = esNuevo ? 'POST' : 'PUT';
    const body   = esNuevo
      ? form
      : { nombre:form.nombre, email:form.email, rol:form.rol, institucion_id:form.institucion_id||null, ...(form.password&&{password:form.password}) };
    const res    = await fetch(url,{method,headers:{'Content-Type':'application/json',Authorization:token},body:JSON.stringify(body)});
    const data   = await res.json();
    setSaving(false);
    if (data.error) { alert(data.error); return; }
    onSaved(); onClose();
  };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header"><div className="modal-title">{esNuevo?'Nuevo usuario':'Editar usuario'}</div><button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="form-grid-2">
            <div className="field"><label>Nombre *</label><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} /></div>
            <div className="field"><label>Email *</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
            <div className="field"><label>Rol</label>
              <select value={form.rol} onChange={e=>setForm({...form,rol:e.target.value})}>
                {(rol==='SuperAdmin'
                  ? ['SuperAdmin','Admin','Biomedico','Ingeniero','Auditor']
                  : ['Admin','Biomedico','Ingeniero','Auditor']
                ).map(r=><option key={r}>{r}</option>)}
              </select></div>
            {rol==='SuperAdmin' && (
              <div className="field"><label>Institución</label>
                <select value={form.institucion_id} onChange={e=>setForm({...form,institucion_id:e.target.value})}>
                  <option value="">Sin institución (global)</option>
                  {instituciones.map(i=><option key={i.id} value={i.id}>{i.nombre}</option>)}
                </select></div>
            )}
            <div className="field" style={{gridColumn:'1/3'}}>
              <label>{esNuevo?'Contraseña *':'Nueva contraseña (opcional)'}</label>
              <input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder={esNuevo?'Mínimo 6 caracteres':'Dejar vacío para no cambiar'} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving?'Guardando...':(esNuevo?'+ Crear':'✓ Guardar')}</button>
        </div>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────
export default function App() {
  const [token, setTokenState] = useState(() => {
    const saved = localStorage.getItem('biomed_token');
    if (saved && tokenValido(saved)) return saved;
    if (saved) localStorage.removeItem('biomed_token');
    return null;
  });
  const [instSeleccionada, setInstSeleccionada] = useState(false);

  const setToken = (t) => {
    if (t) localStorage.setItem('biomed_token', t);
    else   localStorage.removeItem('biomed_token');
    setTokenState(t);
  };

  const logout = () => { localStorage.removeItem('biomed_token'); setTokenState(null); setInstSeleccionada(false); };

  const [seccion, setSeccion]               = useState('dashboard');
  const [equipos, setEquipos]               = useState([]);
  const [mantenimientos, setMantenimientos] = useState([]);
  const [tecno, setTecno]                   = useState([]);
  const [usuarios, setUsuarios]             = useState([]);
  const [instituciones, setInstituciones]   = useState([]);
  const [kpis, setKpis]                     = useState(null);
  const [dashKpis, setDashKpis]             = useState(null);
  const [historial, setHistorial]           = useState([]);
  const [equipoSel, setEquipoSel]           = useState(null);
  const [editando, setEditando]             = useState(null);
  const [filtro, setFiltro]                 = useState('');
  const [filtroMant, setFiltroMant]         = useState('TODOS');
  const [modalOT, setModalOT]               = useState(false);
  const [modalFin, setModalFin]             = useState(null);
  const [modalTecno, setModalTecno]         = useState(false);
  const [modalUsuario, setModalUsuario]     = useState(null);
  const [modalInst, setModalInst]           = useState(null);

  const user = token ? parseJwt(token) : null;
  const rol  = user?.rol;
  const esSuperAdmin = rol === 'SuperAdmin';

  const formVacio = { nombre:'',marca:'',modelo:'',serie:'',registro_invima:'',
    fecha_vencimiento_invima:'',clasificacion_riesgo:'',ubicacion:'',servicio:'',estado:'' };
  const [form, setForm] = useState(formVacio);
  const headers = { Authorization: token };

  const cargarTodo = () => {
    fetch(`${API}/equipos`,{headers}).then(r=>r.json()).then(d=>Array.isArray(d)&&setEquipos(d)).catch(()=>{});
    fetch(`${API}/mantenimientos`,{headers}).then(r=>r.json()).then(d=>Array.isArray(d)&&setMantenimientos(d)).catch(()=>{});
    fetch(`${API}/mantenimientos/kpis`,{headers}).then(r=>r.json()).then(setKpis).catch(()=>{});
    fetch(`${API}/tecnovigilancia`,{headers}).then(r=>r.json()).then(d=>Array.isArray(d)&&setTecno(d)).catch(()=>{});
    fetch(`${API}/dashboard/kpis`,{headers}).then(r=>r.json()).then(setDashKpis).catch(()=>{});
    if (['Admin','SuperAdmin'].includes(rol)) {
      fetch(`${API}/usuarios`,{headers}).then(r=>r.json()).then(d=>Array.isArray(d)&&setUsuarios(d)).catch(()=>{});
    }
    if (esSuperAdmin) {
      fetch(`${API}/instituciones`,{headers}).then(r=>r.json()).then(d=>Array.isArray(d)&&setInstituciones(d)).catch(()=>{});
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (token && (instSeleccionada || !esSuperAdmin)) cargarTodo(); }, [token, instSeleccionada]);

  const verHistorial = (eq) => {
    setEquipoSel(eq); setSeccion('historial');
    fetch(`${API}/historial/${eq.id}`,{headers}).then(r=>r.json()).then(setHistorial).catch(()=>{});
  };

  const guardar = () => {
    const url = editando ? `${API}/equipos/${editando}` : `${API}/equipos`;
    fetch(url,{method:editando?'PUT':'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(form)})
      .then(r=>r.json()).then(()=>{setEditando(null);setForm(formVacio);cargarTodo();});
  };

  const editar = (eq) => {
    setEditando(eq.id);
    setForm({ nombre:eq.nombre||'',marca:eq.marca||'',modelo:eq.modelo||'',serie:eq.serie||'',
      registro_invima:eq.registro_invima||'',fecha_vencimiento_invima:eq.fecha_vencimiento_invima?.slice(0,10)||'',
      clasificacion_riesgo:eq.clasificacion_riesgo||'',ubicacion:eq.ubicacion||'',servicio:eq.servicio||'',estado:eq.estado||'' });
    setSeccion('inventario');
  };

  const eliminar = (id) => {
    if (!window.confirm('¿Confirmar eliminación?')) return;
    fetch(`${API}/equipos/${id}`,{method:'DELETE',headers}).then(()=>cargarTodo());
  };

  const eliminarUsuario = (id) => {
    if (!window.confirm('¿Eliminar usuario?')) return;
    fetch(`${API}/usuarios/${id}`,{method:'DELETE',headers}).then(()=>cargarTodo());
  };

  const cambiarEstadoTecno = (id, estado) => {
    fetch(`${API}/tecnovigilancia/${id}`,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({estado})})
      .then(()=>cargarTodo());
  };

  const descargarPDF = async () => {
    try {
      const res  = await fetch(`${API}/reporte/equipos`,{headers});
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href=url; a.download='reporte_biomed.pdf'; a.click();
      window.URL.revokeObjectURL(url);
    } catch(e) { console.error(e); }
  };

  // KPIs locales
  const total     = equipos.length;
  const vencidos  = equipos.filter(e=>getEstadoInvima(e.fecha_vencimiento_invima)?.label==='VENCIDO').length;
  const porVencer = equipos.filter(e=>getEstadoInvima(e.fecha_vencimiento_invima)?.label==='POR VENCER').length;
  const activos   = equipos.filter(e=>e.estado==='Activo').length;
  const alertas   = mantenimientos.filter(m=>{ const diff=(new Date(m.fecha_programada)-new Date())/(1000*60*60*24); return m.estado==='PENDIENTE'&&diff<=7; });
  const filtrados = equipos.filter(e=>e.nombre?.toLowerCase().includes(filtro.toLowerCase())||e.marca?.toLowerCase().includes(filtro.toLowerCase())||e.serie?.toLowerCase().includes(filtro.toLowerCase()));
  const mantFiltrados = filtroMant==='TODOS' ? mantenimientos : mantenimientos.filter(m=>m.estado===filtroMant);

  if (!token) return <><style>{css}</style><LoginPro setToken={setToken} /></>;

  // SuperAdmin debe seleccionar institución primero
  if (esSuperAdmin && !instSeleccionada) {
    return (
      <>
        <style>{css}</style>
        <SelectorInstitucion
          token={token} user={user}
          onSeleccionar={(t) => {
            setToken(t);
            setInstSeleccionada(true);
          }}
        />
      </>
    );
  }

  const navItems = [
    { id:'dashboard',       icon:'◈', label:'Dashboard'        },
    { id:'inventario',      icon:'⬡', label:'Inventario'       },
    { id:'mantenimiento',   icon:'⚙', label:'Mantenimiento'    },
    { id:'tecnovigilancia', icon:'⚠', label:'Tecnovigilancia'  },
    { id:'historial',       icon:'◷', label:'Historial'        },
    ...(['Admin','SuperAdmin'].includes(rol) ? [{ id:'usuarios', icon:'◉', label:'Usuarios' }] : []),
    ...(esSuperAdmin ? [{ id:'instituciones', icon:'🏥', label:'Instituciones' }] : []),
  ];

  const titulos = {
    dashboard:'Dashboard Ejecutivo', inventario:'Inventario de Equipos',
    mantenimiento:'Módulo de Mantenimiento', tecnovigilancia:'Tecnovigilancia',
    historial:'Historial / Trazabilidad', usuarios:'Gestión de Usuarios',
    instituciones:'Gestión de Instituciones',
  };

  const gravBadge = (g) => g==='GRAVE'?'badge-red':g==='MODERADO'?'badge-orange':'badge-gray';
  const estadoTecnoBadge = (e) => e==='ABIERTO'?'badge-red':e==='EN_REVISION'?'badge-orange':'badge-green';

  return (
    <>
      <style>{css}</style>
      {modalOT      && <ModalOT equipos={equipos} token={token} onClose={()=>setModalOT(false)} onSaved={cargarTodo} />}
      {modalFin     && <ModalFinalizar ot={modalFin} token={token} onClose={()=>setModalFin(null)} onSaved={cargarTodo} />}
      {modalTecno   && <ModalTecno equipos={equipos} token={token} onClose={()=>setModalTecno(false)} onSaved={cargarTodo} />}
      {modalUsuario !== null && <ModalUsuario usuario={modalUsuario||null} token={token} instituciones={instituciones} rol={rol} onClose={()=>setModalUsuario(null)} onSaved={()=>{cargarTodo();setModalUsuario(null);}} />}
      {modalInst    !== null && <ModalInstitucion institucion={modalInst||null} token={token} onClose={()=>setModalInst(null)} onSaved={()=>{cargarTodo();setModalInst(null);}} />}

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-mark">BioMed·HIS</div>
            <div className="logo-sub">Ingeniería Clínica</div>
            {user?.institucion_nombre && (
              <div className="inst-badge">🏥 {user.institucion_nombre}</div>
            )}
            {esSuperAdmin && !user?.institucion_nombre && (
              <div className="inst-badge" style={{color:'#a78bfa',borderColor:'rgba(167,139,250,0.3)'}}>◈ Todas las instituciones</div>
            )}
          </div>
          <nav className="nav-section">
            <div className="nav-label">Módulos</div>
            {navItems.map(n=>(
              <div key={n.id} className={`nav-item ${seccion===n.id?'active':''}`} onClick={()=>setSeccion(n.id)}>
                <span className="nav-icon">{n.icon}</span>
                {n.label}
                {n.id==='mantenimiento' && alertas.length>0 && (
                  <span style={{marginLeft:'auto',background:G.danger,color:'#fff',borderRadius:'10px',padding:'1px 6px',fontSize:10,fontWeight:700}}>{alertas.length}</span>
                )}
                {n.id==='tecnovigilancia' && tecno.filter(t=>t.estado==='ABIERTO').length>0 && (
                  <span style={{marginLeft:'auto',background:'#f4a261',color:'#fff',borderRadius:'10px',padding:'1px 6px',fontSize:10,fontWeight:700}}>{tecno.filter(t=>t.estado==='ABIERTO').length}</span>
                )}
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div style={{fontSize:11,marginBottom:2,color:G.text}}>{user?.nombre||'Usuario'}</div>
            <div className={`rol-badge ${esSuperAdmin?'superadmin-badge':''}`}>{rol}</div>
            {esSuperAdmin && (
              <button className="btn btn-purple" style={{marginTop:10,width:'100%',justifyContent:'center',fontSize:11}} onClick={()=>setInstSeleccionada(false)}>
                ⇄ Cambiar institución
              </button>
            )}
            <button className="btn btn-logout" style={{marginTop:8,width:'100%',justifyContent:'center'}} onClick={logout}>↩ Cerrar sesión</button>
          </div>
        </aside>

        <main className="main">
          <div className="session-banner">
            <span className="session-dot" />
            Sesión activa · {user?.nombre} · {rol}
            {user?.institucion_nombre && <> · <b>{user.institucion_nombre}</b></>}
          </div>

          <div className="topbar">
            <div className="topbar-title">{titulos[seccion]}</div>
            <div className="topbar-right">
              <button className="btn btn-ghost" onClick={descargarPDF}>↓ PDF</button>
              {rol!=='Auditor' && seccion==='mantenimiento'   && <button className="btn btn-primary" onClick={()=>setModalOT(true)}>+ Nueva OT</button>}
              {rol!=='Auditor' && seccion==='inventario'      && <button className="btn btn-primary" onClick={()=>{setEditando(null);setForm(formVacio);}}>+ Nuevo equipo</button>}
              {rol!=='Auditor' && seccion==='tecnovigilancia' && <button className="btn btn-primary" onClick={()=>setModalTecno(true)}>+ Nuevo reporte</button>}
              {['Admin','SuperAdmin'].includes(rol) && seccion==='usuarios' && <button className="btn btn-primary" onClick={()=>setModalUsuario(false)}>+ Nuevo usuario</button>}
              {esSuperAdmin && seccion==='instituciones' && <button className="btn btn-primary" onClick={()=>setModalInst(false)}>+ Nueva institución</button>}
            </div>
          </div>

          <div className="content">

            {/* ═══ DASHBOARD ═══ */}
            {seccion==='dashboard' && (
              <>
                <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
                  {[
                    {label:'Total Equipos',   valor:dashKpis?.totalEquipos??total,  cls:'blue'},
                    {label:'Activos',         valor:dashKpis?.activos??activos,      cls:'green'},
                    {label:'OTs Pendientes',  valor:dashKpis?.otPendientes??'—',     cls:'orange'},
                    {label:'INVIMA Vencidos', valor:dashKpis?.invVencidos??vencidos, cls:'red'},
                  ].map(k=>(
                    <div key={k.label} className={`kpi-card ${k.cls}`}>
                      <div className="kpi-label">{k.label}</div>
                      <div className="kpi-value">{k.valor}</div>
                    </div>
                  ))}
                </div>
                <div className="kpi-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
                  {[
                    {label:'En Mantenimiento', valor:dashKpis?.enMant??'—',        cls:'yellow'},
                    {label:'OTs Realizadas',   valor:dashKpis?.otRealizados??'—',  cls:'green'},
                    {label:'Tecnovigilancia',  valor:dashKpis?.tecnoAbiertos??'—', cls:'purple'},
                  ].map(k=>(
                    <div key={k.label} className={`kpi-card ${k.cls}`}>
                      <div className="kpi-label">{k.label}</div>
                      <div className="kpi-value">{k.valor}</div>
                    </div>
                  ))}
                </div>
                <div className="chart-grid">
                  <div className="panel">
                    <div className="panel-header"><div className="panel-title">Equipos por Servicio</div></div>
                    <div className="panel-body" style={{height:260}}>
                      {dashKpis?.porServicio?.length>0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dashKpis.porServicio} margin={{top:4,right:10,left:-20,bottom:40}}>
                            <XAxis dataKey="servicio" tick={{fill:G.textMuted,fontSize:10}} angle={-30} textAnchor="end" />
                            <YAxis tick={{fill:G.textMuted,fontSize:10}} />
                            <Tooltip contentStyle={{background:G.card,border:`1px solid ${G.cardBorder}`,borderRadius:4,fontSize:12}} />
                            <Bar dataKey="total" fill={G.accent} radius={[3,3,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <div className="empty-state">Sin datos</div>}
                    </div>
                  </div>
                  <div className="panel">
                    <div className="panel-header"><div className="panel-title">Mantenimientos Últimos 6 Meses</div></div>
                    <div className="panel-body" style={{height:260}}>
                      {dashKpis?.porMes?.length>0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dashKpis.porMes} margin={{top:4,right:10,left:-20,bottom:10}}>
                            <XAxis dataKey="mes" tick={{fill:G.textMuted,fontSize:10}} />
                            <YAxis tick={{fill:G.textMuted,fontSize:10}} />
                            <Tooltip contentStyle={{background:G.card,border:`1px solid ${G.cardBorder}`,borderRadius:4,fontSize:12}} />
                            <Bar dataKey="total" name="Total" fill="#4da6ff" radius={[3,3,0,0]} />
                            <Bar dataKey="realizados" name="Realizados" fill={G.accent} radius={[3,3,0,0]} />
                            <Legend wrapperStyle={{fontSize:11,color:G.textMuted}} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <div className="empty-state">Sin datos</div>}
                    </div>
                  </div>
                </div>
                <div className="chart-grid">
                  <div className="panel">
                    <div className="panel-header"><div className="panel-title">Clasificación de Riesgo</div></div>
                    <div className="panel-body" style={{height:240}}>
                      {dashKpis?.porRiesgo?.length>0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={dashKpis.porRiesgo} dataKey="total" nameKey="riesgo" cx="50%" cy="50%" outerRadius={80} label={({riesgo,total})=>`${riesgo}: ${total}`}>
                              {dashKpis.porRiesgo.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{background:G.card,border:`1px solid ${G.cardBorder}`,borderRadius:4,fontSize:12}} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : <div className="empty-state">Sin datos</div>}
                    </div>
                  </div>
                  <div className="panel">
                    <div className="panel-header"><div className="panel-title">Tecnovigilancia por Gravedad</div></div>
                    <div className="panel-body" style={{height:240}}>
                      {dashKpis?.porGravedad?.length>0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={dashKpis.porGravedad} dataKey="total" nameKey="gravedad" cx="50%" cy="50%" outerRadius={80} label={({gravedad,total})=>`${gravedad}: ${total}`}>
                              {dashKpis.porGravedad.map((e,i)=><Cell key={i} fill={e.gravedad==='GRAVE'?G.danger:e.gravedad==='MODERADO'?G.warning:G.textMuted} />)}
                            </Pie>
                            <Tooltip contentStyle={{background:G.card,border:`1px solid ${G.cardBorder}`,borderRadius:4,fontSize:12}} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : <div className="empty-state">Sin datos</div>}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ═══ INVENTARIO ═══ */}
            {seccion==='inventario' && (
              <>
                <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
                  {[{label:'Total',valor:total,cls:'blue'},{label:'Activos',valor:activos,cls:'green'},{label:'Por vencer',valor:porVencer,cls:'orange'},{label:'Vencido',valor:vencidos,cls:'red'}]
                    .map(k=><div key={k.label} className={`kpi-card ${k.cls}`}><div className="kpi-label">{k.label}</div><div className="kpi-value">{k.valor}</div></div>)}
                </div>
                {alertas.length>0 && (
                  <div className="alert-bar"><span className="alert-icon">⚠</span>
                    <div><div className="alert-title">Mantenimientos críticos ({alertas.length})</div>
                    {alertas.map(a=><div key={a.id} className="alert-item">{a.equipo_nombre} — {formatFecha(a.fecha_programada)}</div>)}</div>
                  </div>
                )}
                {rol!=='Auditor' && (
                  <div className="panel">
                    <div className="panel-header">
                      <div className="panel-title">{editando?'Editar equipo':'Registrar equipo'}</div>
                      {editando&&<button className="btn btn-ghost btn-icon" onClick={()=>{setEditando(null);setForm(formVacio);}}>✕ Cancelar</button>}
                    </div>
                    <div className="panel-body">
                      <div className="form-grid">
                        {[['nombre','Nombre'],['marca','Marca'],['modelo','Modelo'],['serie','Serie'],
                          ['registro_invima','Reg. INVIMA'],['fecha_vencimiento_invima','Venc. INVIMA','date'],
                          ['ubicacion','Ubicación'],['servicio','Servicio']].map(([key,label,type='text'])=>(
                          <div className="field" key={key}><label>{label}</label>
                            <input type={type} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} /></div>
                        ))}
                        <div className="field"><label>Riesgo</label>
                          <select value={form.clasificacion_riesgo} onChange={e=>setForm({...form,clasificacion_riesgo:e.target.value})}>
                            <option value="">Seleccionar</option>
                            {['I','IIa','IIb','III'].map(c=><option key={c} value={c}>Clase {c}</option>)}
                          </select></div>
                        <div className="field"><label>Estado</label>
                          <select value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>
                            <option value="">Seleccionar</option>
                            <option value="Activo">Activo</option>
                            <option value="Mantenimiento">En mantenimiento</option>
                            <option value="Baja">Dado de baja</option>
                          </select></div>
                      </div>
                      <button className="btn btn-primary" onClick={guardar}>{editando?'✓ Guardar':'+ Registrar'}</button>
                    </div>
                  </div>
                )}
                <div className="search-bar"><span>⌕</span><input placeholder="Buscar..." value={filtro} onChange={e=>setFiltro(e.target.value)} /></div>
                <div className="panel">
                  <div className="panel-header"><div className="panel-title">Equipos</div><div style={{fontSize:11,color:G.textMuted}}>{filtrados.length} resultados</div></div>
                  {filtrados.length===0 ? <div className="empty-state">Sin equipos</div> : (
                    <table className="data-table">
                      <thead><tr>
                        <th>Nombre</th><th>Marca/Modelo</th><th>Serie</th>
                        <th>INVIMA</th><th>Vencimiento</th><th>Riesgo</th>
                        <th>Servicio</th><th>Estado</th>
                        {esSuperAdmin&&<th>Institución</th>}<th></th>
                      </tr></thead>
                      <tbody>
                        {filtrados.map(eq=>{
                          const inv=getEstadoInvima(eq.fecha_vencimiento_invima);
                          const estBadge=eq.estado==='Activo'?'badge-green':eq.estado==='Mantenimiento'?'badge-orange':'badge-gray';
                          return (
                            <tr key={eq.id}>
                              <td style={{fontWeight:500}}>{eq.nombre}</td>
                              <td style={{color:G.textMuted}}>{eq.marca} {eq.modelo}</td>
                              <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{eq.serie}</td>
                              <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{eq.registro_invima||'—'}</td>
                              <td><div style={{fontSize:11,fontFamily:'IBM Plex Mono',color:G.textMuted}}>{formatFecha(eq.fecha_vencimiento_invima)}</div>
                                {inv&&<span className={`badge ${inv.cls}`} style={{marginTop:4,display:'inline-block'}}>{inv.label}</span>}</td>
                              <td>{eq.clasificacion_riesgo?<span className="badge badge-gray">{eq.clasificacion_riesgo}</span>:'—'}</td>
                              <td style={{color:G.textMuted}}>{eq.servicio||'—'}</td>
                              <td>{eq.estado?<span className={`badge ${estBadge}`}>{eq.estado}</span>:'—'}</td>
                              {esSuperAdmin&&<td style={{fontSize:11,color:G.textMuted}}>{eq.institucion_nombre||'—'}</td>}
                              <td><div style={{display:'flex',gap:4}}>
                                <button className="btn btn-ghost btn-icon" onClick={()=>verHistorial(eq)}>◷</button>
                                {rol!=='Auditor'&&<><button className="btn btn-ghost btn-icon" onClick={()=>editar(eq)}>✎</button>
                                <button className="btn btn-danger btn-icon" onClick={()=>eliminar(eq.id)}>✕</button></>}
                              </div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}

            {/* ═══ MANTENIMIENTO ═══ */}
            {seccion==='mantenimiento' && (
              <>
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:16,marginBottom:24}}>
                  {[{label:'Total OTs',valor:kpis?.total??'—',cls:'blue'},{label:'Pendientes',valor:kpis?.pendientes??'—',cls:'orange'},
                    {label:'Realizados',valor:kpis?.realizados??'—',cls:'green'},{label:'Críticas',valor:kpis?.criticas??'—',cls:'red'},
                    {label:'MTTR días',valor:kpis?.mttr??'—',cls:'purple',sub:'Tiempo medio'}].map(k=>(
                    <div key={k.label} className={`kpi-card ${k.cls}`}><div className="kpi-label">{k.label}</div>
                      <div className="kpi-value">{k.valor}</div>{k.sub&&<div className="kpi-sub">{k.sub}</div>}</div>
                  ))}
                </div>
                {alertas.length>0&&<div className="alert-bar"><span className="alert-icon">⚠</span>
                  <div><div className="alert-title">OTs vencen en ≤7 días</div>
                  {alertas.map(a=><div key={a.id} className="alert-item">{a.equipo_nombre} · {formatFecha(a.fecha_programada)}</div>)}</div></div>}
                <div style={{display:'flex',gap:8,marginBottom:16}}>
                  {['TODOS','PENDIENTE','REALIZADO'].map(f=>(
                    <button key={f} className={`btn ${filtroMant===f?'btn-primary':'btn-ghost'}`} style={{fontSize:11}} onClick={()=>setFiltroMant(f)}>{f}</button>
                  ))}
                </div>
                <div className="panel">
                  <div className="panel-header"><div className="panel-title">Órdenes de trabajo</div><span className="badge badge-gray">{mantFiltrados.length}</span></div>
                  {mantFiltrados.length===0 ? <div className="empty-state">Sin órdenes</div> : (
                    <table className="data-table">
                      <thead><tr>
                        <th>Equipo</th><th>Servicio</th><th>Tipo</th><th>Prioridad</th>
                        <th>Programado</th><th>Realizado</th><th>Estado</th>
                        {esSuperAdmin&&<th>Institución</th>}
                        {rol!=='Auditor'&&<th></th>}
                      </tr></thead>
                      <tbody>
                        {mantFiltrados.map(m=>(
                          <tr key={m.id}>
                            <td style={{fontWeight:500}}>{m.equipo_nombre}</td>
                            <td style={{color:G.textMuted,fontSize:11}}>{m.equipo_servicio||'—'}</td>
                            <td><span className="badge badge-gray">{m.tipo}</span></td>
                            <td><span className={`badge ${prioridadBadge(m.prioridad)}`}>{m.prioridad}</span></td>
                            <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{formatFecha(m.fecha_programada)}</td>
                            <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{m.fecha_realizada?formatFecha(m.fecha_realizada):'—'}</td>
                            <td><span className={`badge ${m.estado==='PENDIENTE'?'badge-orange':'badge-green'}`}>{m.estado}</span></td>
                            {esSuperAdmin&&<td style={{fontSize:11,color:G.textMuted}}>{m.institucion_nombre||'—'}</td>}
                            {rol!=='Auditor'&&<td>{m.estado==='PENDIENTE'&&<button className="btn btn-primary btn-icon" onClick={()=>setModalFin(m)}>✓</button>}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}

            {/* ═══ TECNOVIGILANCIA ═══ */}
            {seccion==='tecnovigilancia' && (
              <>
                <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
                  {[{label:'Total',valor:tecno.length,cls:'blue'},{label:'Abiertos',valor:tecno.filter(t=>t.estado==='ABIERTO').length,cls:'red'},
                    {label:'En revisión',valor:tecno.filter(t=>t.estado==='EN_REVISION').length,cls:'orange'},{label:'Cerrados',valor:tecno.filter(t=>t.estado==='CERRADO').length,cls:'green'}]
                    .map(k=><div key={k.label} className={`kpi-card ${k.cls}`}><div className="kpi-label">{k.label}</div><div className="kpi-value">{k.valor}</div></div>)}
                </div>
                <div className="panel">
                  <div className="panel-header"><div className="panel-title">Reportes</div><span className="badge badge-gray">{tecno.length}</span></div>
                  {tecno.length===0 ? <div className="empty-state">Sin reportes</div> : (
                    <table className="data-table">
                      <thead><tr>
                        <th>Fecha</th><th>Equipo</th><th>Tipo</th><th>Gravedad</th>
                        <th>Estado</th><th>Reportado por</th><th>Descripción</th>
                        {esSuperAdmin&&<th>Institución</th>}
                        {rol!=='Auditor'&&<th>Acción</th>}
                      </tr></thead>
                      <tbody>
                        {tecno.map(t=>(
                          <tr key={t.id}>
                            <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{formatFecha(t.fecha_evento)}</td>
                            <td style={{fontWeight:500}}>{t.equipo_nombre||'General'}</td>
                            <td><span className="badge badge-gray">{t.tipo}</span></td>
                            <td><span className={`badge ${gravBadge(t.gravedad)}`}>{t.gravedad}</span></td>
                            <td><span className={`badge ${estadoTecnoBadge(t.estado)}`}>{t.estado}</span></td>
                            <td style={{color:G.textMuted,fontSize:11}}>{t.reportado_nombre||'—'}</td>
                            <td style={{color:G.textMuted,fontSize:11,maxWidth:200}}>{t.descripcion}</td>
                            {esSuperAdmin&&<td style={{fontSize:11,color:G.textMuted}}>{t.institucion_nombre||'—'}</td>}
                            {rol!=='Auditor'&&<td><div style={{display:'flex',gap:4}}>
                              {t.estado==='ABIERTO'&&<button className="btn btn-ghost btn-icon" style={{fontSize:10}} onClick={()=>cambiarEstadoTecno(t.id,'EN_REVISION')}>En revisión</button>}
                              {t.estado==='EN_REVISION'&&<button className="btn btn-primary btn-icon" style={{fontSize:10}} onClick={()=>cambiarEstadoTecno(t.id,'CERRADO')}>Cerrar</button>}
                            </div></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}

            {/* ═══ HISTORIAL ═══ */}
            {seccion==='historial' && (
              <div className="panel">
                <div className="panel-header"><div className="panel-title">{equipoSel?`Trazabilidad — ${equipoSel.nombre}`:'Selecciona un equipo'}</div></div>
                <div className="panel-body">
                  {!equipoSel ? <div className="empty-state">Ve a Inventario y presiona ◷</div>
                  : historial.length===0 ? <div className="empty-state">Sin eventos</div>
                  : <div className="timeline">{historial.map(h=>(
                    <div className="tl-item" key={h.id}>
                      <div className="tl-dot" />
                      <div className="tl-content">
                        <div className="tl-action">{h.accion}</div>
                        <div className="tl-desc">{h.descripcion}</div>
                        <div className="tl-date">{formatFecha(h.fecha)}</div>
                      </div>
                    </div>
                  ))}</div>}
                </div>
              </div>
            )}

            {/* ═══ USUARIOS ═══ */}
            {seccion==='usuarios' && ['Admin','SuperAdmin'].includes(rol) && (
              <>
                <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
                  {[{label:'Total',valor:usuarios.length,cls:'blue'},{label:'Admins',valor:usuarios.filter(u=>u.rol==='Admin'||u.rol==='SuperAdmin').length,cls:'purple'},
                    {label:'Biomédicos',valor:usuarios.filter(u=>u.rol==='Biomedico').length,cls:'green'},{label:'Auditores',valor:usuarios.filter(u=>u.rol==='Auditor').length,cls:'gray'}]
                    .map(k=><div key={k.label} className={`kpi-card ${k.cls||'blue'}`}><div className="kpi-label">{k.label}</div><div className="kpi-value">{k.valor}</div></div>)}
                </div>
                <div className="panel">
                  <div className="panel-header"><div className="panel-title">Usuarios</div><span className="badge badge-gray">{usuarios.length}</span></div>
                  {usuarios.length===0 ? <div className="empty-state">Sin usuarios</div> : (
                    <table className="data-table">
                      <thead><tr>
                        <th>Nombre</th><th>Correo</th><th>Rol</th><th>Creado</th>
                        {esSuperAdmin&&<th>Institución</th>}<th></th>
                      </tr></thead>
                      <tbody>
                        {usuarios.map(u=>(
                          <tr key={u.id}>
                            <td style={{fontWeight:500}}>{u.nombre}</td>
                            <td style={{fontFamily:'IBM Plex Mono',fontSize:11,color:G.textMuted}}>{u.email}</td>
                            <td><span className={`badge ${u.rol==='Admin'||u.rol==='SuperAdmin'?'badge-purple':u.rol==='Auditor'?'badge-gray':'badge-green'}`}>{u.rol}</span></td>
                            <td style={{fontFamily:'IBM Plex Mono',fontSize:11,color:G.textMuted}}>{formatFecha(u.creado_en)}</td>
                            {esSuperAdmin&&<td style={{fontSize:11,color:G.textMuted}}>{u.institucion_nombre||'Global'}</td>}
                            <td><div style={{display:'flex',gap:4}}>
                              <button className="btn btn-ghost btn-icon" onClick={()=>setModalUsuario(u)}>✎</button>
                              {u.id!==user?.id&&<button className="btn btn-danger btn-icon" onClick={()=>eliminarUsuario(u.id)}>✕</button>}
                            </div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}

            {/* ═══ INSTITUCIONES (solo SuperAdmin) ═══ */}
            {seccion==='instituciones' && esSuperAdmin && (
              <>
                <div className="kpi-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
                  {[{label:'Total',valor:instituciones.length,cls:'blue'},
                    {label:'Activas',valor:instituciones.filter(i=>i.activa).length,cls:'green'},
                    {label:'Inactivas',valor:instituciones.filter(i=>!i.activa).length,cls:'red'}]
                    .map(k=><div key={k.label} className={`kpi-card ${k.cls}`}><div className="kpi-label">{k.label}</div><div className="kpi-value">{k.valor}</div></div>)}
                </div>
                <div className="panel">
                  <div className="panel-header"><div className="panel-title">Instituciones registradas</div><span className="badge badge-gray">{instituciones.length}</span></div>
                  {instituciones.length===0 ? <div className="empty-state">Sin instituciones</div> : (
                    <table className="data-table">
                      <thead><tr>
                        <th>Nombre</th><th>NIT</th><th>Ciudad</th><th>Teléfono</th>
                        <th>Email</th><th>REPS</th><th>Estado</th><th></th>
                      </tr></thead>
                      <tbody>
                        {instituciones.map(inst=>(
                          <tr key={inst.id}>
                            <td style={{fontWeight:500}}>🏥 {inst.nombre}</td>
                            <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{inst.nit||'—'}</td>
                            <td style={{color:G.textMuted}}>{inst.ciudad||'—'}</td>
                            <td style={{color:G.textMuted,fontSize:11}}>{inst.telefono||'—'}</td>
                            <td style={{color:G.textMuted,fontSize:11}}>{inst.email||'—'}</td>
                            <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{inst.codigo_reps||'—'}</td>
                            <td><span className={`badge ${inst.activa?'badge-green':'badge-red'}`}>{inst.activa?'ACTIVA':'INACTIVA'}</span></td>
                            <td><div style={{display:'flex',gap:4}}>
                              <button className="btn btn-ghost btn-icon" onClick={()=>setModalInst(inst)}>✎</button>
                              <button className="btn btn-purple btn-icon" style={{fontSize:10}} onClick={()=>{ fetch(`${API}/instituciones/seleccionar/${inst.id}`,{method:'POST',headers}).then(r=>r.json()).then(d=>{ if(d.token){setToken(d.token);setInstSeleccionada(true);setSeccion('dashboard');} }); }}>→ Ver</button>
                            </div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}

          </div>
        </main>
      </div>
    </>
  );
}