import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import ModalImportar from './ModalImportar';
import ModalReporte from './ModalReporte';
import Indicadores from './Indicadores';
import Calendario from './Calendario';
import Rondas from './Rondas';
import Proveedores from './Proveedores';
import Contratos from './Contratos';

const API = 'https://his-biomedico-production.up.railway.app';

const parseJwt = (t) => { try { return JSON.parse(atob(t.split('.')[1])); } catch { return null; } };
const tokenValido = (t) => { try { const p=parseJwt(t); if(!p)return false; if(p.exp)return p.exp*1000>Date.now(); return true; } catch { return false; } };
const getEstadoInvima = (fecha) => {
  if(!fecha)return null;
  const diff=(new Date(fecha)-new Date())/(1000*60*60*24);
  if(diff<0)  return{label:'VENCIDO',cls:'badge-red'};
  if(diff<=30)return{label:'POR VENCER',cls:'badge-orange'};
  return           {label:'VIGENTE',cls:'badge-green'};
};
const formatFecha = (f) => { if(!f)return'—'; return new Date(f).toLocaleDateString('es-CO',{year:'numeric',month:'short',day:'2-digit'}); };
const fmtMoney = (n) => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n||0);
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
  @keyframes slideUp {
    from { transform: translateY(100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(0,229,160,0.6); }
    50% { box-shadow: 0 0 0 8px rgba(0,229,160,0); }
  }
  /* ─── PWA & MOBILE RESPONSIVE ─── */
  @media (max-width: 768px) {
    .sidebar { width: 70px !important; }
    .sidebar-logo { padding: 16px 8px !important; text-align: center; }
    .logo-mark { font-size: 9px !important; letter-spacing: 1px !important; }
    .logo-sub, .inst-badge { display: none !important; }
    .nav-item { padding: 10px 8px !important; justify-content: center; font-size: 0 !important; }
    .nav-item .nav-icon { font-size: 20px !important; width: auto !important; }
    .nav-label { display: none !important; }
    /* En móvil ocultar headers de grupos para ahorrar espacio */
    .nav-section > div > div:first-child:not(.nav-item) { 
      padding: 4px 0 !important; 
      font-size: 0 !important;
      border-left: none !important;
    }
    .nav-section > div > div:first-child:not(.nav-item) > span:nth-child(1) { font-size: 14px !important; }
    .nav-section > div > div:first-child:not(.nav-item) > span:not(:first-child) { display: none !important; }
    .sidebar-footer { padding: 10px 6px !important; text-align: center; font-size: 9px !important; }
    .sidebar-footer button { padding: 4px !important; font-size: 9px !important; }
    .main { margin-left: 70px !important; }
    .topbar { padding: 10px 14px !important; flex-wrap: wrap !important; gap: 8px !important; }
    .topbar-title { font-size: 13px !important; }
    .topbar-right { gap: 4px !important; }
    .topbar-right .btn { padding: 6px 8px !important; font-size: 10px !important; }
    .content { padding: 14px !important; }
    .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
    .kpi-card { padding: 12px 14px !important; }
    .kpi-value { font-size: 22px !important; }
    .chart-grid { grid-template-columns: 1fr !important; }
    .form-grid, .form-grid-2 { grid-template-columns: 1fr !important; }
    .panel-body { padding: 14px !important; }
    .data-table { font-size: 11px !important; }
    .data-table th, .data-table td { padding: 8px 6px !important; }
    .modal { width: 96vw !important; max-height: 95vh !important; }
    .modal-body { padding: 14px !important; }
    .session-banner { padding: 4px 14px !important; font-size: 10px !important; }
    .search-bar { max-width: 100% !important; }
  }
  @media (max-width: 480px) {
    .kpi-grid { grid-template-columns: 1fr !important; }
    .topbar-title { font-size: 12px !important; }
  }

  
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
  .topbar-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:4px;border:none;cursor:pointer;font-family:'IBM Plex Sans',sans-serif;font-size:12px;font-weight:600;letter-spacing:.5px;transition:all 0.15s}
  .btn-primary{background:${G.accent};color:#0a1520}.btn-primary:hover{background:${G.accentDim}}
  .btn-ghost{background:transparent;border:1px solid ${G.cardBorder};color:${G.textMuted}}.btn-ghost:hover{border-color:${G.accent};color:${G.accent}}
  .btn-danger{background:transparent;border:1px solid transparent;color:${G.danger}}.btn-danger:hover{background:rgba(255,77,109,0.1)}
  .btn-purple{background:rgba(167,139,250,0.15);color:#a78bfa;border:1px solid rgba(167,139,250,0.3)}.btn-purple:hover{background:rgba(167,139,250,0.25)}
  .btn-orange{background:rgba(255,179,71,0.15);color:${G.warning};border:1px solid rgba(255,179,71,0.3)}.btn-orange:hover{background:rgba(255,179,71,0.25)}
  .btn-logout{background:transparent;border:1px solid rgba(255,77,109,0.3);color:${G.danger};font-size:11px;padding:6px 12px}.btn-logout:hover{background:rgba(255,77,109,0.1);border-color:${G.danger}}
  .btn-icon{padding:6px 10px;font-size:13px}
  .content{padding:24px 28px;flex:1}
  .kpi-grid{display:grid;gap:16px;margin-bottom:24px}
  .kpi-card{background:${G.card};border:1px solid ${G.cardBorder};border-radius:6px;padding:18px 20px;position:relative;overflow:hidden}
  .kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
  .kpi-card.green::before{background:${G.accent}}.kpi-card.red::before{background:${G.danger}}
  .kpi-card.orange::before{background:${G.warning}}.kpi-card.blue::before{background:#4da6ff}
  .kpi-card.purple::before{background:#a78bfa}.kpi-card.yellow::before{background:#fbbf24}
  .kpi-card.teal::before{background:#2dd4bf}.kpi-card.gray::before{background:${G.textMuted}}
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
  .badge-blue{background:rgba(77,166,255,0.12);color:#4da6ff}
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
  .modal{background:${G.card};border:1px solid ${G.cardBorder};border-radius:8px;width:640px;max-width:95vw;overflow:hidden;max-height:92vh;overflow-y:auto}
  .modal-header{padding:16px 20px;border-bottom:1px solid ${G.cardBorder};display:flex;align-items:center;justify-content:space-between}
  .modal-title{font-size:13px;font-weight:600;color:${G.text}}
  .modal-body{padding:20px}
  .modal-footer{padding:14px 20px;border-top:1px solid ${G.cardBorder};display:flex;justify-content:flex-end;gap:8px}
  .checkbox-list{max-height:160px;overflow-y:auto;border:1px solid ${G.inputBorder};border-radius:4px;padding:8px;background:${G.input}}
  .checkbox-item{display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:12px}
  .checkbox-item input{width:14px;height:14px;cursor:pointer}
  .repuesto-row{display:grid;grid-template-columns:1fr 80px 30px;gap:8px;align-items:center;margin-bottom:8px}
  .stock-bar{display:flex;align-items:center;gap:6px;font-family:'IBM Plex Mono',monospace;font-size:11px}
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
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleLogin = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})});
      const data = await res.json();
      if (data.token) { localStorage.setItem('biomed_token',data.token); setToken(data.token); }
      else setError(data.error||'Credenciales inválidas');
    } catch { setError('No se pudo conectar al servidor'); }
    setLoading(false);
  };
  return (
    <div className="login-wrap"><div className="login-card">
      <div className="login-logo">BioMed·HIS</div>
      <div className="login-sub">Sistema de Información Hospitalaria — Colombia</div>
      <div className="field" style={{marginBottom:14}}><label>Correo</label>
        <input type="email" placeholder="usuario@hospital.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} /></div>
      <div className="field" style={{marginBottom:20}}><label>Contraseña</label>
        <input type="password" placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} /></div>
      {error && <div style={{color:G.danger,fontSize:12,marginBottom:14}}>⚠ {error}</div>}
      <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:'10px'}} onClick={handleLogin} disabled={loading}>
        {loading?'Autenticando...':'Ingresar al sistema'}</button>
      <div style={{marginTop:20,fontSize:10,color:G.textMuted,textAlign:'center'}}>Resolución 3100 · Decreto 4725 · Ley 1581</div>
    </div></div>
  );
}

// ─── SELECTOR DE INSTITUCIÓN ────────────────────────────────────────
function SelectorInstitucion({ token, onSeleccionar }) {
  const [instituciones, setInstituciones] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/instituciones`,{headers:{Authorization:token}})
      .then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setInstituciones(d); setLoading(false); });
  },[token]);
  const seleccionar = async (inst) => {
    const res = await fetch(`${API}/instituciones/seleccionar/${inst.id}`,{method:'POST',headers:{Authorization:token}});
    const data = await res.json();
    if (data.token) { localStorage.setItem('biomed_token',data.token); onSeleccionar(data.token); }
  };
  return (
    <div className="inst-selector"><div className="inst-card">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
        <div><div style={{fontFamily:'IBM Plex Mono',fontSize:14,fontWeight:600,color:G.accent,letterSpacing:2}}>BioMed·HIS</div>
          <div style={{fontSize:12,color:G.textMuted,marginTop:2}}>Super Admin — Selecciona una institución</div></div>
        <span className="badge badge-purple">SuperAdmin</span>
      </div>
      <div style={{height:1,background:G.cardBorder,margin:'16px 0'}} />
      {loading ? <div className="empty-state">Cargando...</div> : (<>
        <div className="inst-grid">
          {instituciones.filter(i=>i.activa).map(inst=>(
            <div key={inst.id} className="inst-item" onClick={()=>seleccionar(inst)}>
              <div className="inst-item-name">🏥 {inst.nombre}</div>
              <div className="inst-item-nit">NIT: {inst.nit||'—'}</div>
              <div className="inst-item-ciudad">{inst.ciudad||'—'}</div>
            </div>
          ))}
        </div>
        <button className="btn btn-purple" style={{marginTop:16,width:'100%',justifyContent:'center'}} onClick={()=>onSeleccionar(token)}>
          ◈ Ver todas las instituciones</button>
      </>)}
    </div></div>
  );
}

// ─── MODALES ─────────────────────────────────────────────────────────
function ModalInstitucion({ institucion, token, onClose, onSaved }) {
  const esNueva = !institucion;
  const [form, setForm] = useState({
    nombre:institucion?.nombre||'', nit:institucion?.nit||'', direccion:institucion?.direccion||'',
    ciudad:institucion?.ciudad||'', telefono:institucion?.telefono||'', email:institucion?.email||'',
    logo_url:institucion?.logo_url||'', codigo_reps:institucion?.codigo_reps||'', activa:institucion?.activa!==false,
    doc_inventario_codigo:institucion?.doc_inventario_codigo||'GTE-FR-001',
    doc_inventario_version:institucion?.doc_inventario_version||'2',
    doc_inventario_vigencia:institucion?.doc_inventario_vigencia?.slice(0,10)||'2026-12-31',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const subirImagen = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5*1024*1024) return alert('Imagen muy grande (máx 5MB)');
    if (!file.type.startsWith('image/')) return alert('Solo se permiten imágenes');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', 'biomed_logos');
      const res = await fetch('https://api.cloudinary.com/v1_1/dn4ubmehe/image/upload', { method:'POST', body:fd });
      const data = await res.json();
      if (data.secure_url) setForm(f=>({...f, logo_url: data.secure_url}));
      else alert('Error al subir: ' + (data.error?.message || 'desconocido'));
    } catch(err) { alert('Error de conexión: ' + err.message); }
    setUploading(false);
  };

  const guardar = async () => {
    if (!form.nombre) return alert('Nombre obligatorio');
    setSaving(true);
    const url = esNueva?`${API}/instituciones`:`${API}/instituciones/${institucion.id}`;
    const res = await fetch(url,{method:esNueva?'POST':'PUT',headers:{'Content-Type':'application/json',Authorization:token},body:JSON.stringify(form)});
    const data = await res.json();
    setSaving(false);
    if (data.error) return alert(data.error);
    onSaved(); onClose();
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="modal">
      <div className="modal-header"><div className="modal-title">{esNueva?'Nueva institución':'Editar institución'}</div><button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button></div>
      <div className="modal-body">
        <div style={{display:'flex',gap:16,alignItems:'center',marginBottom:20,padding:14,background:G.input,borderRadius:6,border:`1px solid ${G.inputBorder}`}}>
          <div style={{width:80,height:80,borderRadius:8,background:G.bg,border:`1px solid ${G.cardBorder}`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
            {form.logo_url ? <img src={form.logo_url} alt="logo" style={{width:'100%',height:'100%',objectFit:'contain'}} /> : <span style={{fontSize:32}}>🏥</span>}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:6}}>Logo institucional</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <input id="logo-upload" type="file" accept="image/*" onChange={subirImagen} style={{display:'none'}} />
              <label htmlFor="logo-upload" className="btn btn-primary" style={{cursor:'pointer',fontSize:11,padding:'6px 12px'}}>
                {uploading?'⏳ Subiendo...':form.logo_url?'↑ Cambiar imagen':'↑ Subir imagen'}
              </label>
              {form.logo_url && <button className="btn btn-danger" style={{fontSize:11,padding:'6px 12px'}} onClick={()=>setForm({...form,logo_url:''})}>✕ Quitar</button>}
            </div>
            <div style={{fontSize:10,color:G.textMuted,marginTop:6}}>PNG, JPG, SVG · Máx 5MB</div>
          </div>
        </div>
        <div className="form-grid">
          <div className="field" style={{gridColumn:'1/3'}}><label>Nombre *</label><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} /></div>
          <div className="field"><label>NIT</label><input value={form.nit} onChange={e=>setForm({...form,nit:e.target.value})} /></div>
          <div className="field"><label>REPS</label><input value={form.codigo_reps} onChange={e=>setForm({...form,codigo_reps:e.target.value})} /></div>
          <div className="field"><label>Ciudad</label><input value={form.ciudad} onChange={e=>setForm({...form,ciudad:e.target.value})} /></div>
          <div className="field" style={{gridColumn:'1/3'}}><label>Dirección</label><input value={form.direccion} onChange={e=>setForm({...form,direccion:e.target.value})} /></div>
          <div className="field"><label>Teléfono</label><input value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})} /></div>
          <div className="field"><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
          {!esNueva&&<div className="field"><label>Estado</label><select value={form.activa?'true':'false'} onChange={e=>setForm({...form,activa:e.target.value==='true'})}><option value="true">Activa</option><option value="false">Inactiva</option></select></div>}
        </div>

        <div style={{marginTop:18,padding:14,background:G.input,borderRadius:6,border:`1px solid ${G.inputBorder}`}}>
          <div style={{fontSize:11,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:10}}>📋 Configuración del documento de inventario</div>
          <div className="form-grid">
            <div className="field"><label>Código documento</label><input value={form.doc_inventario_codigo} onChange={e=>setForm({...form,doc_inventario_codigo:e.target.value})} placeholder="GTE-FR-001" /></div>
            <div className="field"><label>Versión</label><input value={form.doc_inventario_version} onChange={e=>setForm({...form,doc_inventario_version:e.target.value})} placeholder="2" /></div>
            <div className="field"><label>Vigencia</label><input type="date" value={form.doc_inventario_vigencia} onChange={e=>setForm({...form,doc_inventario_vigencia:e.target.value})} /></div>
          </div>
          <div style={{fontSize:10,color:G.textMuted,fontStyle:'italic'}}>Estos valores aparecerán en el encabezado de la plantilla de inventario al exportar a PDF/Excel</div>
        </div>
      </div>
      <div className="modal-footer"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={guardar} disabled={saving||uploading}>{saving?'Guardando...':(esNueva?'+ Crear':'✓ Guardar')}</button></div>
    </div></div>
  );
}

function ModalOT({ equipos, token, onClose, onSaved }) {
  const [form, setForm] = useState({ equipo_id:'', tipo:'Preventivo', descripcion:'', fecha_programada:'', prioridad:'NORMAL' });
  const [saving, setSaving] = useState(false);
  const guardar = async () => {
    if (!form.equipo_id||!form.fecha_programada) return alert('Equipo y fecha son obligatorios');
    setSaving(true);
    await fetch(`${API}/mantenimientos`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:token},body:JSON.stringify(form)});
    setSaving(false); onSaved(); onClose();
  };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="modal">
      <div className="modal-header"><div className="modal-title">Nueva Orden de Trabajo</div><button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button></div>
      <div className="modal-body"><div className="form-grid-2">
        <div className="field"><label>Equipo *</label><select value={form.equipo_id} onChange={e=>setForm({...form,equipo_id:e.target.value})}><option value="">Seleccionar</option>{equipos.map(eq=><option key={eq.id} value={eq.id}>{eq.nombre}</option>)}</select></div>
        <div className="field"><label>Tipo</label><select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}>{['Preventivo','Correctivo','Calibración','Inspección'].map(t=><option key={t}>{t}</option>)}</select></div>
        <div className="field"><label>Fecha *</label><input type="date" value={form.fecha_programada} onChange={e=>setForm({...form,fecha_programada:e.target.value})} /></div>
        <div className="field"><label>Prioridad</label><select value={form.prioridad} onChange={e=>setForm({...form,prioridad:e.target.value})}>{['NORMAL','ALTA','CRITICA'].map(p=><option key={p}>{p}</option>)}</select></div>
      </div>
      <div className="field"><label>Descripción</label><textarea value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} /></div></div>
      <div className="modal-footer"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving?'Guardando...':'+ Crear OT'}</button></div>
    </div></div>
  );
}

function ModalFinalizar({ ot, token, repuestos, onClose, onSaved }) {
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);
  const [usados, setUsados] = useState([]);
  const repuestosDisp = repuestos.filter(r => r.stock_actual > 0);
  const agregarRep = () => setUsados([...usados,{repuesto_id:'',cantidad:1}]);
  const cambiarRep = (i,campo,val) => { const n=[...usados]; n[i][campo]=val; setUsados(n); };
  const quitarRep = (i) => setUsados(usados.filter((_,j)=>j!==i));
  const finalizar = async () => {
    for (const u of usados) {
      if (!u.repuesto_id || !u.cantidad || u.cantidad<=0) return alert('Verifica los repuestos');
      const r = repuestos.find(x=>x.id===parseInt(u.repuesto_id));
      if (r && r.stock_actual < u.cantidad) return alert(`Stock insuficiente de ${r.nombre} (disponible: ${r.stock_actual})`);
    }
    setSaving(true);
    const res = await fetch(`${API}/mantenimientos/${ot.id}`,{
      method:'PUT',headers:{'Content-Type':'application/json',Authorization:token},
      body:JSON.stringify({observaciones:obs, repuestos_usados: usados.map(u=>({repuesto_id:parseInt(u.repuesto_id),cantidad:parseInt(u.cantidad)}))})
    });
    const data = await res.json();
    setSaving(false);
    if (data.error) return alert(data.error);
    onSaved(); onClose();
  };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="modal">
      <div className="modal-header"><div className="modal-title">Finalizar OT — {ot.equipo_nombre}</div><button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button></div>
      <div className="modal-body">
        <div style={{marginBottom:14,padding:'10px 14px',background:G.input,borderRadius:4,fontSize:12}}>
          <div style={{color:G.textMuted,fontSize:10,letterSpacing:1,textTransform:'uppercase',marginBottom:4}}>Detalle</div>
          <div><b>Tipo:</b> {ot.tipo} · <b>Programado:</b> {formatFecha(ot.fecha_programada)}</div>
        </div>
        <div className="field" style={{marginBottom:16}}><label>Observaciones</label><textarea value={obs} onChange={e=>setObs(e.target.value)} placeholder="Trabajo realizado..." /></div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <label style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600}}>Repuestos utilizados</label>
          <button className="btn btn-ghost" style={{fontSize:11,padding:'4px 10px'}} onClick={agregarRep}>+ Agregar repuesto</button>
        </div>
        {usados.length===0 ? <div style={{fontSize:11,color:G.textMuted,padding:8,fontStyle:'italic'}}>Sin repuestos</div>
          : usados.map((u,i)=>{
            const r = repuestos.find(x=>x.id===parseInt(u.repuesto_id));
            return (
              <div key={i} className="repuesto-row">
                <select value={u.repuesto_id} onChange={e=>cambiarRep(i,'repuesto_id',e.target.value)} style={{background:G.input,border:`1px solid ${G.inputBorder}`,borderRadius:4,padding:'6px 8px',color:G.text,fontSize:12}}>
                  <option value="">Seleccionar repuesto</option>
                  {repuestosDisp.map(rp=><option key={rp.id} value={rp.id}>{rp.nombre} (stock: {rp.stock_actual})</option>)}
                </select>
                <input type="number" min="1" max={r?.stock_actual||999} value={u.cantidad} onChange={e=>cambiarRep(i,'cantidad',e.target.value)} style={{background:G.input,border:`1px solid ${G.inputBorder}`,borderRadius:4,padding:'6px 8px',color:G.text,fontSize:12}} />
                <button className="btn btn-danger btn-icon" onClick={()=>quitarRep(i)}>✕</button>
              </div>
            );
          })}
      </div>
      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={finalizar} disabled={saving}>{saving?'Guardando...':'✓ Finalizar OT'}</button>
      </div>
    </div></div>
  );
}

function ModalTecno({ equipos, token, onClose, onSaved }) {
  const [form, setForm] = useState({ equipo_id:'', tipo:'Incidente', descripcion:'', fecha_evento:'', gravedad:'LEVE' });
  const [saving, setSaving] = useState(false);
  const guardar = async () => {
    if (!form.descripcion||!form.fecha_evento) return alert('Descripción y fecha obligatorios');
    setSaving(true);
    await fetch(`${API}/tecnovigilancia`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:token},body:JSON.stringify(form)});
    setSaving(false); onSaved(); onClose();
  };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="modal">
      <div className="modal-header"><div className="modal-title">Nuevo Reporte de Tecnovigilancia</div><button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button></div>
      <div className="modal-body"><div className="form-grid-2">
        <div className="field"><label>Equipo</label><select value={form.equipo_id} onChange={e=>setForm({...form,equipo_id:e.target.value})}><option value="">Sin equipo</option>{equipos.map(eq=><option key={eq.id} value={eq.id}>{eq.nombre}</option>)}</select></div>
        <div className="field"><label>Tipo</label><select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}>{['Incidente','Evento Adverso','Alerta de Seguridad','Falla Técnica'].map(t=><option key={t}>{t}</option>)}</select></div>
        <div className="field"><label>Fecha *</label><input type="date" value={form.fecha_evento} onChange={e=>setForm({...form,fecha_evento:e.target.value})} /></div>
        <div className="field"><label>Gravedad</label><select value={form.gravedad} onChange={e=>setForm({...form,gravedad:e.target.value})}>{['LEVE','MODERADO','GRAVE'].map(g=><option key={g}>{g}</option>)}</select></div>
      </div>
      <div className="field"><label>Descripción *</label><textarea value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} style={{minHeight:100}} /></div></div>
      <div className="modal-footer"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving?'Guardando...':'+ Crear reporte'}</button></div>
    </div></div>
  );
}

function ModalUsuario({ usuario, token, instituciones, rol, onClose, onSaved }) {
  const esNuevo = !usuario;
  const [form, setForm] = useState({
    nombre:usuario?.nombre||'', email:usuario?.email||'', rol:usuario?.rol||'Biomedico',
    password:'', institucion_id:usuario?.institucion_id||''
  });
  const [saving, setSaving] = useState(false);
  const guardar = async () => {
    if (!form.nombre||!form.email) return alert('Nombre y email obligatorios');
    if (esNuevo && !form.password) return alert('Contraseña obligatoria');
    setSaving(true);
    const url = esNuevo?`${API}/register`:`${API}/usuarios/${usuario.id}`;
    const body = esNuevo ? form : { nombre:form.nombre,email:form.email,rol:form.rol,institucion_id:form.institucion_id||null,...(form.password&&{password:form.password}) };
    const res = await fetch(url,{method:esNuevo?'POST':'PUT',headers:{'Content-Type':'application/json',Authorization:token},body:JSON.stringify(body)});
    const data = await res.json();
    setSaving(false);
    if (data.error) return alert(data.error);
    onSaved(); onClose();
  };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="modal">
      <div className="modal-header"><div className="modal-title">{esNuevo?'Nuevo usuario':'Editar usuario'}</div><button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button></div>
      <div className="modal-body"><div className="form-grid-2">
        <div className="field"><label>Nombre *</label><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} /></div>
        <div className="field"><label>Email *</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
        <div className="field"><label>Rol</label><select value={form.rol} onChange={e=>setForm({...form,rol:e.target.value})}>{(rol==='SuperAdmin'?['SuperAdmin','Admin','Biomedico','Ingeniero','Auditor']:['Admin','Biomedico','Ingeniero','Auditor']).map(r=><option key={r}>{r}</option>)}</select></div>
        {rol==='SuperAdmin'&&<div className="field"><label>Institución</label><select value={form.institucion_id} onChange={e=>setForm({...form,institucion_id:e.target.value})}><option value="">Sin institución</option>{instituciones.map(i=><option key={i.id} value={i.id}>{i.nombre}</option>)}</select></div>}
        <div className="field" style={{gridColumn:'1/3'}}><label>{esNuevo?'Contraseña *':'Nueva contraseña (opcional)'}</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></div>
      </div></div>
      <div className="modal-footer"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving?'Guardando...':(esNuevo?'+ Crear':'✓ Guardar')}</button></div>
    </div></div>
  );
}

function ModalRepuesto({ repuesto, equipos, token, onClose, onSaved }) {
  const esNuevo = !repuesto;
  const [form, setForm] = useState({
    codigo:repuesto?.codigo||'', nombre:repuesto?.nombre||'', descripcion:repuesto?.descripcion||'',
    categoria:repuesto?.categoria||'', marca:repuesto?.marca||'', modelo:repuesto?.modelo||'',
    unidad_medida:repuesto?.unidad_medida||'UND', stock_actual:repuesto?.stock_actual??0,
    stock_minimo:repuesto?.stock_minimo??0, costo_unitario:repuesto?.costo_unitario||0,
    proveedor:repuesto?.proveedor||'', ubicacion:repuesto?.ubicacion||'',
    lote:repuesto?.lote||'', fecha_vencimiento:repuesto?.fecha_vencimiento?.slice(0,10)||'',
    equipos_compatibles: repuesto?.equipos_compatibles?.map(e=>e.id)||[]
  });
  const [saving, setSaving] = useState(false);
  const toggleEquipo = (id) => {
    setForm(f=>({...f, equipos_compatibles: f.equipos_compatibles.includes(id) ? f.equipos_compatibles.filter(x=>x!==id) : [...f.equipos_compatibles,id]}));
  };
  const guardar = async () => {
    if (!form.nombre) return alert('Nombre obligatorio');
    setSaving(true);
    const url = esNuevo?`${API}/repuestos`:`${API}/repuestos/${repuesto.id}`;
    const body = esNuevo ? form : (({stock_actual,...rest})=>rest)(form);
    const res = await fetch(url,{method:esNuevo?'POST':'PUT',headers:{'Content-Type':'application/json',Authorization:token},body:JSON.stringify(body)});
    const data = await res.json();
    setSaving(false);
    if (data.error) return alert(data.error);
    onSaved(); onClose();
  };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="modal" style={{width:720}}>
      <div className="modal-header"><div className="modal-title">{esNuevo?'Nuevo repuesto':'Editar repuesto'}</div><button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button></div>
      <div className="modal-body">
        <div className="form-grid">
          <div className="field"><label>Código</label><input value={form.codigo} onChange={e=>setForm({...form,codigo:e.target.value})} placeholder="REP-001" /></div>
          <div className="field" style={{gridColumn:'2/4'}}><label>Nombre *</label><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} /></div>
          <div className="field"><label>Categoría</label>
            <select value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})}>
              <option value="">Seleccionar</option>
              {['Mecánico','Eléctrico','Electrónico','Filtros','Sensores','Baterías','Cables','Tubos','Insumo médico','Otros'].map(c=><option key={c}>{c}</option>)}
            </select></div>
          <div className="field"><label>Marca</label><input value={form.marca} onChange={e=>setForm({...form,marca:e.target.value})} /></div>
          <div className="field"><label>Modelo</label><input value={form.modelo} onChange={e=>setForm({...form,modelo:e.target.value})} /></div>
          <div className="field"><label>Unidad</label>
            <select value={form.unidad_medida} onChange={e=>setForm({...form,unidad_medida:e.target.value})}>
              {['UND','CAJA','METRO','LITRO','KG','PAR','SET','PACK'].map(u=><option key={u}>{u}</option>)}
            </select></div>
          {esNuevo&&<div className="field"><label>Stock inicial</label><input type="number" min="0" value={form.stock_actual} onChange={e=>setForm({...form,stock_actual:parseInt(e.target.value)||0})} /></div>}
          <div className="field"><label>Stock mínimo</label><input type="number" min="0" value={form.stock_minimo} onChange={e=>setForm({...form,stock_minimo:parseInt(e.target.value)||0})} /></div>
          <div className="field"><label>Costo unitario</label><input type="number" min="0" step="0.01" value={form.costo_unitario} onChange={e=>setForm({...form,costo_unitario:parseFloat(e.target.value)||0})} /></div>
          <div className="field"><label>Proveedor</label><input value={form.proveedor} onChange={e=>setForm({...form,proveedor:e.target.value})} /></div>
          <div className="field"><label>Ubicación bodega</label><input value={form.ubicacion} onChange={e=>setForm({...form,ubicacion:e.target.value})} placeholder="Estante A-3" /></div>
          <div className="field"><label>Lote</label><input value={form.lote} onChange={e=>setForm({...form,lote:e.target.value})} /></div>
          <div className="field"><label>Vencimiento</label><input type="date" value={form.fecha_vencimiento} onChange={e=>setForm({...form,fecha_vencimiento:e.target.value})} /></div>
          <div className="field" style={{gridColumn:'1/4'}}><label>Descripción</label><textarea value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} /></div>
        </div>
        <div className="field" style={{marginTop:8}}>
          <label>Equipos compatibles ({form.equipos_compatibles.length} seleccionados)</label>
          <div className="checkbox-list">
            {equipos.length===0 ? <div style={{fontSize:11,color:G.textMuted,fontStyle:'italic'}}>Sin equipos disponibles</div> :
              equipos.map(eq=>(
                <label key={eq.id} className="checkbox-item">
                  <input type="checkbox" checked={form.equipos_compatibles.includes(eq.id)} onChange={()=>toggleEquipo(eq.id)} />
                  {eq.nombre} <span style={{color:G.textMuted}}>({eq.marca} {eq.modelo})</span>
                </label>
              ))
            }
          </div>
        </div>
      </div>
      <div className="modal-footer"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving?'Guardando...':(esNuevo?'+ Crear':'✓ Guardar')}</button></div>
    </div></div>
  );
}

function ModalMovimiento({ repuesto, token, onClose, onSaved }) {
  const [form, setForm] = useState({ tipo:'ENTRADA', cantidad:1, motivo:'COMPRA', descripcion:'' });
  const [saving, setSaving] = useState(false);
  const motivosPorTipo = {
    ENTRADA:['COMPRA','DEVOLUCION','AJUSTE'],
    SALIDA:['USO_OT','VENCIMIENTO','DAÑO','AJUSTE'],
    AJUSTE:['INVENTARIO','CORRECCION']
  };
  const guardar = async () => {
    if (!form.cantidad || form.cantidad<=0) return alert('Cantidad debe ser mayor a 0');
    setSaving(true);
    const res = await fetch(`${API}/repuestos/${repuesto.id}/movimiento`,{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:token},body:JSON.stringify(form)
    });
    const data = await res.json();
    setSaving(false);
    if (data.error) return alert(data.error);
    onSaved(); onClose();
  };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="modal">
      <div className="modal-header"><div className="modal-title">Movimiento — {repuesto.nombre}</div><button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button></div>
      <div className="modal-body">
        <div style={{marginBottom:14,padding:'10px 14px',background:G.input,borderRadius:4,fontSize:12}}>
          <div style={{color:G.textMuted,fontSize:10,letterSpacing:1,textTransform:'uppercase',marginBottom:4}}>Stock actual</div>
          <div style={{fontFamily:'IBM Plex Mono',fontSize:18,color:G.accent}}>{repuesto.stock_actual} {repuesto.unidad_medida}</div>
        </div>
        <div className="form-grid-2">
          <div className="field"><label>Tipo</label>
            <select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value,motivo:motivosPorTipo[e.target.value][0]})}>
              <option value="ENTRADA">Entrada (+)</option>
              <option value="SALIDA">Salida (-)</option>
              <option value="AJUSTE">Ajuste (=)</option>
            </select></div>
          <div className="field"><label>Cantidad</label>
            <input type="number" min="1" value={form.cantidad} onChange={e=>setForm({...form,cantidad:parseInt(e.target.value)||0})} /></div>
          <div className="field"><label>Motivo</label>
            <select value={form.motivo} onChange={e=>setForm({...form,motivo:e.target.value})}>
              {motivosPorTipo[form.tipo].map(m=><option key={m} value={m}>{m.replace('_',' ')}</option>)}
            </select></div>
          <div className="field"><label>Resultado</label>
            <input value={form.tipo==='ENTRADA'?(repuesto.stock_actual+(form.cantidad||0)):form.tipo==='SALIDA'?(repuesto.stock_actual-(form.cantidad||0)):(form.cantidad||0)} readOnly style={{background:G.bg,color:G.accent,fontFamily:'IBM Plex Mono'}} /></div>
        </div>
        <div className="field"><label>Descripción</label><textarea value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} placeholder="Detalle del movimiento..." /></div>
      </div>
      <div className="modal-footer"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving?'Guardando...':'✓ Registrar'}</button></div>
    </div></div>
  );
}

function ModalDetalleRepuesto({ repuesto, token, onClose }) {
  const [movimientos, setMovimientos] = useState([]);
  useEffect(() => {
    fetch(`${API}/repuestos/${repuesto.id}/movimientos`,{headers:{Authorization:token}}).then(r=>r.json()).then(setMovimientos);
  },[repuesto.id, token]);
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="modal" style={{width:760}}>
      <div className="modal-header"><div className="modal-title">📦 {repuesto.nombre}</div><button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button></div>
      <div className="modal-body">
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:18}}>
          <div className={`kpi-card ${repuesto.stock_actual===0?'red':repuesto.stock_actual<=repuesto.stock_minimo?'orange':'green'}`} style={{padding:12}}>
            <div className="kpi-label">Stock actual</div>
            <div className="kpi-value" style={{fontSize:22}}>{repuesto.stock_actual}</div>
            <div className="kpi-sub">{repuesto.unidad_medida}</div>
          </div>
          <div className="kpi-card gray" style={{padding:12}}><div className="kpi-label">Mínimo</div><div className="kpi-value" style={{fontSize:22}}>{repuesto.stock_minimo}</div></div>
          <div className="kpi-card blue" style={{padding:12}}><div className="kpi-label">Costo unit.</div><div className="kpi-value" style={{fontSize:16}}>{fmtMoney(repuesto.costo_unitario)}</div></div>
          <div className="kpi-card purple" style={{padding:12}}><div className="kpi-label">Valor total</div><div className="kpi-value" style={{fontSize:16}}>{fmtMoney(repuesto.stock_actual*repuesto.costo_unitario)}</div></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:18,fontSize:12}}>
          <div><b>Código:</b> {repuesto.codigo||'—'}</div>
          <div><b>Categoría:</b> {repuesto.categoria||'—'}</div>
          <div><b>Marca:</b> {repuesto.marca||'—'} {repuesto.modelo||''}</div>
          <div><b>Proveedor:</b> {repuesto.proveedor||'—'}</div>
          <div><b>Ubicación:</b> {repuesto.ubicacion||'—'}</div>
          <div><b>Lote:</b> {repuesto.lote||'—'}</div>
          <div><b>Vencimiento:</b> {formatFecha(repuesto.fecha_vencimiento)}</div>
        </div>
        <div className="panel-title" style={{marginBottom:8}}>Historial de movimientos</div>
        {movimientos.length===0 ? <div className="empty-state">Sin movimientos</div> : (
          <table className="data-table">
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Cant.</th><th>Motivo</th><th>Usuario</th><th>Descripción</th></tr></thead>
            <tbody>{movimientos.map(m=>(
              <tr key={m.id}>
                <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{formatFecha(m.fecha)}</td>
                <td><span className={`badge ${m.tipo==='ENTRADA'?'badge-green':m.tipo==='SALIDA'?'badge-red':'badge-blue'}`}>{m.tipo}</span></td>
                <td style={{fontFamily:'IBM Plex Mono',fontWeight:600}}>{m.tipo==='ENTRADA'?'+':m.tipo==='SALIDA'?'-':'='}{m.cantidad}</td>
                <td><span className="badge badge-gray">{m.motivo}</span></td>
                <td style={{color:G.textMuted,fontSize:11}}>{m.usuario_nombre||'—'}</td>
                <td style={{color:G.textMuted,fontSize:11}}>{m.descripcion||'—'}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <div className="modal-footer"><button className="btn btn-primary" onClick={onClose}>Cerrar</button></div>
    </div></div>
  );
}

function ModalProtocolo({ protocolo, tiposEquipo, token, onClose, onSaved }) {
  const esNuevo = !protocolo;
  const [form, setForm] = useState({
    nombre: protocolo?.nombre||'',
    tipo_equipo: protocolo?.tipo_equipo||'',
    descripcion: protocolo?.descripcion||'',
    activo: protocolo?.activo!==false,
  });
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(esNuevo);

  useEffect(() => {
    if (!esNuevo && protocolo?.id) {
      fetch(`${API}/protocolos/${protocolo.id}`,{headers:{Authorization:token}})
        .then(r=>r.json())
        .then(d=>{ if(d.items) setItems(d.items.map(it=>({actividad:it.actividad}))); setLoaded(true); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agregarItem = () => setItems([...items,{actividad:''}]);
  const cambiarItem = (i,val) => { const n=[...items]; n[i].actividad=val; setItems(n); };
  const moverItem = (i,dir) => {
    const n=[...items];
    const j = i+dir;
    if (j<0 || j>=n.length) return;
    [n[i],n[j]] = [n[j],n[i]];
    setItems(n);
  };
  const quitarItem = (i) => setItems(items.filter((_,j)=>j!==i));

  const guardar = async () => {
    if (!form.nombre) return alert('Nombre obligatorio');
    if (!form.tipo_equipo) return alert('Tipo de equipo obligatorio');
    const itemsLimpios = items.filter(it => (it.actividad||'').trim());
    if (itemsLimpios.length === 0) return alert('Agrega al menos una actividad');
    setSaving(true);
    const url = esNuevo?`${API}/protocolos`:`${API}/protocolos/${protocolo.id}`;
    const res = await fetch(url,{
      method:esNuevo?'POST':'PUT',
      headers:{'Content-Type':'application/json',Authorization:token},
      body:JSON.stringify({...form, items: itemsLimpios})
    });
    const data = await res.json();
    setSaving(false);
    if (data.error) return alert(data.error);
    onSaved(); onClose();
  };

  if (!loaded) return null;

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:760, maxWidth:'95vw'}}>
        <div className="modal-header">
          <div className="modal-title">{esNuevo?'Nuevo protocolo':'Editar protocolo'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid-2">
            <div className="field">
              <label>Nombre del protocolo *</label>
              <input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} placeholder="Ej: Mantenimiento preventivo bomba" />
            </div>
            <div className="field">
              <label>Tipo de equipo *</label>
              <select value={form.tipo_equipo} onChange={e=>setForm({...form,tipo_equipo:e.target.value})}>
                <option value="">Seleccionar tipo</option>
                {tiposEquipo.map(t=><option key={t.id} value={t.nombre}>{t.nombre}</option>)}
              </select>
            </div>
            <div className="field" style={{gridColumn:'1/3'}}>
              <label>Descripción</label>
              <textarea value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} placeholder="Notas o descripción del protocolo..." />
            </div>
            {!esNuevo && (
              <div className="field">
                <label>Estado</label>
                <select value={form.activo?'true':'false'} onChange={e=>setForm({...form,activo:e.target.value==='true'})}>
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
            )}
          </div>

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:18,marginBottom:8}}>
            <label style={{fontSize:11,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600}}>
              Lista de actividades ({items.length})
            </label>
            <button className="btn btn-ghost" style={{fontSize:11,padding:'4px 10px'}} onClick={agregarItem}>+ Agregar actividad</button>
          </div>

          {items.length===0 ? (
            <div style={{padding:14,textAlign:'center',background:G.input,borderRadius:6,fontSize:12,color:G.textMuted,fontStyle:'italic'}}>
              Sin actividades. Agrega las tareas que se deben realizar en este protocolo.
            </div>
          ) : (
            <div style={{maxHeight:340,overflowY:'auto',border:`1px solid ${G.cardBorder}`,borderRadius:6,padding:8}}>
              {items.map((it,i)=>(
                <div key={i} style={{display:'grid',gridTemplateColumns:'24px 1fr 30px 30px 30px',gap:6,alignItems:'center',marginBottom:6}}>
                  <div style={{fontFamily:'IBM Plex Mono',fontSize:11,color:G.textMuted,textAlign:'center'}}>{i+1}</div>
                  <input
                    value={it.actividad}
                    onChange={e=>cambiarItem(i,e.target.value)}
                    placeholder="Descripción de la actividad..."
                    style={{background:G.input,border:`1px solid ${G.inputBorder}`,borderRadius:4,padding:'6px 10px',color:G.text,fontSize:12,outline:'none'}}
                  />
                  <button className="btn btn-ghost btn-icon" onClick={()=>moverItem(i,-1)} disabled={i===0} style={{fontSize:11,opacity:i===0?0.3:1}} title="Subir">▲</button>
                  <button className="btn btn-ghost btn-icon" onClick={()=>moverItem(i,1)} disabled={i===items.length-1} style={{fontSize:11,opacity:i===items.length-1?0.3:1}} title="Bajar">▼</button>
                  <button className="btn btn-danger btn-icon" onClick={()=>quitarItem(i)} title="Eliminar">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={saving}>
            {saving?'Guardando...':(esNuevo?'+ Crear protocolo':'✓ Guardar')}
          </button>
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

  // ─── PWA INSTALL PROMPT ───
  const [installPrompt, setInstallPrompt] = useState(null);
  const [appInstalada, setAppInstalada] = useState(false);

  useEffect(() => {
    // Detectar si la app ya está instalada (en modo standalone)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setAppInstalada(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const onInstalled = () => {
      setAppInstalada(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const instalarApp = async () => {
    if (!installPrompt) {
      alert('La instalación no está disponible en este navegador. Para instalar:\n\n• Android: Menú ⋮ → "Instalar app" o "Agregar a pantalla principal"\n• iPhone: Botón Compartir → "Agregar a pantalla de inicio"\n• PC: Ícono ⊕ en la barra de direcciones');
      return;
    }
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setAppInstalada(true);
    }
    setInstallPrompt(null);
  };

  const setToken = (t) => { if (t) localStorage.setItem('biomed_token',t); else localStorage.removeItem('biomed_token'); setTokenState(t); };
  const logout = () => { localStorage.removeItem('biomed_token'); setTokenState(null); setInstSeleccionada(false); };

  const [seccion, setSeccion] = useState('dashboard');
  // Estado de grupos del sidebar (qué grupos están expandidos)
  const [gruposAbiertos, setGruposAbiertos] = useState(() => {
    const saved = localStorage.getItem('biomed_grupos');
    if (saved) try { return JSON.parse(saved); } catch {}
    return { operacion: true, activos: true, servicio: true, proveedores: false, admin: false };
  });

  const toggleGrupo = (id) => {
    setGruposAbiertos(g => {
      const nuevo = { ...g, [id]: !g[id] };
      localStorage.setItem('biomed_grupos', JSON.stringify(nuevo));
      return nuevo;
    });
  };
  const [equipos, setEquipos] = useState([]);
  const [mantenimientos, setMantenimientos] = useState([]);
  const [tecno, setTecno] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [instituciones, setInstituciones] = useState([]);
  const [repuestos, setRepuestos] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [dashKpis, setDashKpis] = useState(null);
  const [repKpis, setRepKpis] = useState(null);
  const [protocolos, setProtocolos] = useState([]);
  const [tiposEquipo, setTiposEquipo] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [equipoSel, setEquipoSel] = useState(null);
  const [editando, setEditando] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [filtroMant, setFiltroMant] = useState('TODOS');
  const [filtroRep, setFiltroRep] = useState('');
  const [filtroProto, setFiltroProto] = useState('TODOS');
  const [modalOT, setModalOT] = useState(false);
  const [modalFin, setModalFin] = useState(null);
  const [modalTecno, setModalTecno] = useState(false);
  const [modalUsuario, setModalUsuario] = useState(null);
  const [modalInst, setModalInst] = useState(null);
  const [modalRep, setModalRep] = useState(null);
  const [modalMov, setModalMov] = useState(null);
  const [modalDetRep, setModalDetRep] = useState(null);
  const [modalImportar, setModalImportar] = useState(false);
  const [modalProtocolo, setModalProtocolo] = useState(null);
  const [modalReporte, setModalReporte] = useState(null);

  const user = token ? parseJwt(token) : null;
  const rol = user?.rol;
  const esSuperAdmin = rol === 'SuperAdmin';

  const formVacio = { nombre:'',marca:'',modelo:'',serie:'',registro_invima:'',fecha_vencimiento_invima:'',clasificacion_riesgo:'',ubicacion:'',servicio:'',estado:'',tipo_equipo:'',activo_fijo:'',garantia:false,garantia_vencimiento:'' };
  const [form, setForm] = useState(formVacio);
  const headers = { Authorization: token };

  const cargarTodo = () => {
    fetch(`${API}/equipos`,{headers}).then(r=>r.json()).then(d=>Array.isArray(d)&&setEquipos(d)).catch(()=>{});
    fetch(`${API}/mantenimientos`,{headers}).then(r=>r.json()).then(d=>Array.isArray(d)&&setMantenimientos(d)).catch(()=>{});
    fetch(`${API}/mantenimientos/kpis`,{headers}).then(r=>r.json()).then(setKpis).catch(()=>{});
    fetch(`${API}/tecnovigilancia`,{headers}).then(r=>r.json()).then(d=>Array.isArray(d)&&setTecno(d)).catch(()=>{});
    fetch(`${API}/dashboard/kpis`,{headers}).then(r=>r.json()).then(setDashKpis).catch(()=>{});
    fetch(`${API}/repuestos`,{headers}).then(r=>r.json()).then(d=>Array.isArray(d)&&setRepuestos(d)).catch(()=>{});
    fetch(`${API}/repuestos/kpis/general`,{headers}).then(r=>r.json()).then(setRepKpis).catch(()=>{});
    fetch(`${API}/tipos-equipo`,{headers}).then(r=>r.json()).then(d=>Array.isArray(d)&&setTiposEquipo(d)).catch(()=>{});
    if (esSuperAdmin) fetch(`${API}/protocolos`,{headers}).then(r=>r.json()).then(d=>Array.isArray(d)&&setProtocolos(d)).catch(()=>{});
    if (['Admin','SuperAdmin'].includes(rol)) fetch(`${API}/usuarios`,{headers}).then(r=>r.json()).then(d=>Array.isArray(d)&&setUsuarios(d)).catch(()=>{});
    if (esSuperAdmin) fetch(`${API}/instituciones`,{headers}).then(r=>r.json()).then(d=>Array.isArray(d)&&setInstituciones(d)).catch(()=>{});
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (token && (instSeleccionada || !esSuperAdmin)) cargarTodo(); }, [token, instSeleccionada]);

  const verHistorial = (eq) => {
    setEquipoSel(eq); setSeccion('historial');
    fetch(`${API}/historial/${eq.id}`,{headers}).then(r=>r.json()).then(setHistorial);
  };
  const guardar = () => {
    const url = editando?`${API}/equipos/${editando}`:`${API}/equipos`;
    fetch(url,{method:editando?'PUT':'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(form)})
      .then(r=>r.json()).then(()=>{setEditando(null);setForm(formVacio);cargarTodo();});
  };
  const editar = (eq) => {
    setEditando(eq.id);
    setForm({ nombre:eq.nombre||'',marca:eq.marca||'',modelo:eq.modelo||'',serie:eq.serie||'',registro_invima:eq.registro_invima||'',fecha_vencimiento_invima:eq.fecha_vencimiento_invima?.slice(0,10)||'',clasificacion_riesgo:eq.clasificacion_riesgo||'',ubicacion:eq.ubicacion||'',servicio:eq.servicio||'',estado:eq.estado||'',tipo_equipo:eq.tipo_equipo||'',activo_fijo:eq.activo_fijo||'',garantia:!!eq.garantia,garantia_vencimiento:eq.garantia_vencimiento?.slice(0,10)||'' });
    setSeccion('inventario');
  };
  const eliminar = (id) => { if(!window.confirm('¿Confirmar?'))return; fetch(`${API}/equipos/${id}`,{method:'DELETE',headers}).then(()=>cargarTodo()); };
  const eliminarUsuario = (id) => { if(!window.confirm('¿Eliminar?'))return; fetch(`${API}/usuarios/${id}`,{method:'DELETE',headers}).then(()=>cargarTodo()); };
  const eliminarRepuesto = (id) => { if(!window.confirm('¿Eliminar repuesto?'))return; fetch(`${API}/repuestos/${id}`,{method:'DELETE',headers}).then(()=>cargarTodo()); };
  const eliminarProtocolo = (id) => { if(!window.confirm('¿Eliminar protocolo?'))return; fetch(`${API}/protocolos/${id}`,{method:'DELETE',headers}).then(()=>cargarTodo()); };
  const cambiarEstadoTecno = (id,estado) => fetch(`${API}/tecnovigilancia/${id}`,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({estado})}).then(()=>cargarTodo());

  const editarRepuesto = async (rep) => {
    const res = await fetch(`${API}/repuestos/${rep.id}`,{headers});
    const data = await res.json();
    setModalRep(data);
  };

  const descargarPDF = async () => {
    try {
      const res = await fetch(`${API}/reporte/equipos`,{headers});
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download='reporte_biomed.pdf'; a.click();
      window.URL.revokeObjectURL(url);
    } catch(e) { console.error(e); }
  };

  // EXPORTAR INVENTARIO EN FORMATO PLANTILLA GTE-FR-001
  const exportarPlantillaInventario = async (formato) => {
    let inst = null;
    if (user?.institucion_id) {
      try {
        const r = await fetch(`${API}/instituciones/mia`,{headers});
        inst = await r.json();
      } catch(e) {}
    }
    const instNombre = inst?.nombre || user?.institucion_nombre || 'TODAS LAS INSTITUCIONES';
    const codigo = inst?.doc_inventario_codigo || 'GTE-FR-001';
    const version = inst?.doc_inventario_version || '2';
    const vigencia = inst?.doc_inventario_vigencia ? new Date(inst.doc_inventario_vigencia).toLocaleDateString('es-CO') : '2026-12-31';
    const logo = inst?.logo_url || '';
    const anio = new Date().getFullYear();

    const equiposExport = filtrados.length > 0 ? filtrados : equipos;

    if (formato === 'excel') {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const headerData = [
        ['', '', '', instNombre, '', '', '', '', '', 'VERSION:', version],
        ['', '', '', '', '', '', '', '', '', 'VIGENCIA:', vigencia],
        ['', '', '', `INVENTARIO DE EQUIPOS BIOMEDICOS ${anio}`, '', '', '', '', '', 'CÓDIGO:', codigo],
        ['', '', '', '', '', '', '', '', '', 'PÁGINA:', '1 de 1'],
        [],
        [],
        ['ITEM','ACTIVO FIJO','EQUIPO','MARCA','MODELO','SERIE','SERVICIO','UBICACIÓN','REGISTRO SANITARIO','RIESGO','GARANTÍA (SI/NO)','ESTADO']
      ];

      const filas = equiposExport.map((eq, i) => [
        i + 1,
        eq.activo_fijo || '',
        eq.nombre || '',
        eq.marca || '',
        eq.modelo || '',
        eq.serie || '',
        eq.servicio || '',
        eq.ubicacion || '',
        eq.registro_invima || '',
        eq.clasificacion_riesgo || '',
        eq.garantia ? 'SI' : 'NO',
        eq.estado || ''
      ]);

      const data = [...headerData, ...filas];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [
        {wch:6},{wch:11},{wch:32},{wch:18},{wch:22},{wch:21},{wch:20},{wch:23},{wch:24},{wch:8},{wch:14},{wch:12}
      ];
      ws['!merges'] = [
        {s:{r:0,c:3},e:{r:1,c:8}},
        {s:{r:2,c:3},e:{r:3,c:8}},
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'INVENTARIO');
      XLSX.writeFile(wb, `Inventario_${codigo}_${instNombre.replace(/\s+/g,'_')}.xlsx`);
      return;
    }

    // PDF
    const w = window.open('', '_blank');
    if (!w) return alert('Permite ventanas emergentes para generar el PDF');
    const fechaHoy = new Date().toLocaleDateString('es-CO');
    const logoHtml = logo ? `<img src="${logo}" style="width:90px;height:90px;object-fit:contain"/>` : '<div style="font-size:50px">🏥</div>';

    const filas = equiposExport.map((eq, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${eq.activo_fijo || ''}</td>
        <td>${eq.nombre || ''}</td>
        <td>${eq.marca || ''}</td>
        <td>${eq.modelo || ''}</td>
        <td>${eq.serie || ''}</td>
        <td>${eq.servicio || ''}</td>
        <td>${eq.ubicacion || ''}</td>
        <td>${eq.registro_invima || ''}</td>
        <td style="text-align:center">${eq.clasificacion_riesgo || ''}</td>
        <td style="text-align:center">${eq.garantia ? 'SI' : 'NO'}</td>
        <td style="text-align:center">${eq.estado || ''}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Inventario ${codigo}</title>
    <style>
      @page { size: A4 landscape; margin: 8mm; }
      body { font-family: Arial,sans-serif; font-size:9px; color:#000; margin:0; padding:0; }
      table.encabezado { border-collapse: collapse; width:100%; margin-bottom:8px; }
      table.encabezado td { border: 2px solid #000; padding: 6px; vertical-align:middle; }
      table.encabezado .logo-cell { width:100px; text-align:center; background:#fff; }
      table.encabezado .titulo-inst { font-weight:bold; text-align:center; font-size:13px; background:#e6f0fa; }
      table.encabezado .titulo-doc { font-weight:bold; text-align:center; font-size:14px; background:#0a2342; color:#fff; }
      table.encabezado .meta { font-size:9px; width:160px; }
      table.encabezado .meta b { color:#0a2342; }
      table.inventario { border-collapse: collapse; width:100%; }
      table.inventario th, table.inventario td { border: 1px solid #555; padding: 4px 5px; vertical-align:middle; font-size:8.5px; }
      table.inventario th { background:#0a2342; color:#fff; font-weight:bold; text-align:center; font-size:9px; padding:6px 4px; }
      table.inventario tbody tr:nth-child(even) { background:#f7fafc; }
      .footer { font-size:8px; color:#666; text-align:center; margin-top:6px; }
    </style></head><body>

    <table class="encabezado">
      <tr>
        <td class="logo-cell" rowspan="2">${logoHtml}</td>
        <td class="titulo-inst" colspan="2">${instNombre}</td>
        <td class="meta"><b>VERSION:</b> ${version}</td>
        <td class="meta"><b>VIGENCIA:</b> ${vigencia}</td>
      </tr>
      <tr>
        <td class="titulo-doc" colspan="2">INVENTARIO DE EQUIPOS BIOMEDICOS ${anio}</td>
        <td class="meta"><b>CÓDIGO:</b> ${codigo}</td>
        <td class="meta"><b>PÁGINA:</b> 1 de 1</td>
      </tr>
    </table>

    <table class="inventario">
      <thead>
        <tr>
          <th style="width:30px">ITEM</th>
          <th style="width:70px">ACTIVO FIJO</th>
          <th style="width:160px">EQUIPO</th>
          <th style="width:90px">MARCA</th>
          <th style="width:110px">MODELO</th>
          <th style="width:100px">SERIE</th>
          <th style="width:100px">SERVICIO</th>
          <th style="width:115px">UBICACIÓN</th>
          <th style="width:120px">REGISTRO SANITARIO</th>
          <th style="width:50px">RIESGO</th>
          <th style="width:60px">GARANTÍA (SI/NO)</th>
          <th style="width:65px">ESTADO</th>
        </tr>
      </thead>
      <tbody>
        ${filas || '<tr><td colspan="12" style="text-align:center;font-style:italic;padding:20px">Sin equipos registrados</td></tr>'}
      </tbody>
    </table>

    <div class="footer">Generado: ${fechaHoy} · Total equipos: ${equiposExport.length} · ${instNombre}</div>

    <script>window.onload = () => setTimeout(() => window.print(), 600);</script>
    </body></html>`;

    w.document.write(html);
    w.document.close();
  };

  const total = equipos.length;
  const vencidos = equipos.filter(e=>getEstadoInvima(e.fecha_vencimiento_invima)?.label==='VENCIDO').length;
  const porVencer = equipos.filter(e=>getEstadoInvima(e.fecha_vencimiento_invima)?.label==='POR VENCER').length;
  const activos = equipos.filter(e=>e.estado==='Activo').length;
  const alertas = mantenimientos.filter(m=>{ const diff=(new Date(m.fecha_programada)-new Date())/(1000*60*60*24); return m.estado==='PENDIENTE'&&diff<=7; });
  const filtrados = equipos.filter(e=>e.nombre?.toLowerCase().includes(filtro.toLowerCase())||e.marca?.toLowerCase().includes(filtro.toLowerCase())||e.serie?.toLowerCase().includes(filtro.toLowerCase()));
  const mantFiltrados = filtroMant==='TODOS'?mantenimientos:mantenimientos.filter(m=>m.estado===filtroMant);
  const repFiltrados = repuestos.filter(r=>r.nombre?.toLowerCase().includes(filtroRep.toLowerCase())||r.codigo?.toLowerCase().includes(filtroRep.toLowerCase())||r.categoria?.toLowerCase().includes(filtroRep.toLowerCase()));
  const repStockBajo = repuestos.filter(r=>r.stock_actual<=r.stock_minimo && r.stock_minimo>0);
  const protoFiltrados = filtroProto==='TODOS'?protocolos:protocolos.filter(p=>p.tipo_equipo===filtroProto);

  if (!token) return <><style>{css}</style><LoginPro setToken={setToken} /></>;
  if (esSuperAdmin && !instSeleccionada) {
    return <><style>{css}</style><SelectorInstitucion token={token} onSeleccionar={(t)=>{setToken(t);setInstSeleccionada(true);}} /></>;
  }

  const navGroups = [
    {
      id:'operacion',
      label:'Operación',
      icon:'📊',
      items:[
        { id:'dashboard', icon:'◈', label:'Dashboard' },
        { id:'indicadores', icon:'📊', label:'Indicadores' },
        { id:'calendario', icon:'📅', label:'Calendario' },
      ]
    },
    {
      id:'activos',
      label:'Activos biomédicos',
      icon:'📦',
      items:[
        { id:'inventario', icon:'⬡', label:'Inventario' },
        { id:'historial', icon:'◷', label:'Historial' },
        { id:'rondas', icon:'📋', label:'Rondas' },
      ]
    },
    {
      id:'servicio',
      label:'Servicio técnico',
      icon:'🔧',
      items:[
        { id:'mantenimiento', icon:'⚙', label:'Mantenimiento' },
        { id:'tecnovigilancia', icon:'⚠', label:'Tecnovigilancia' },
        { id:'repuestos', icon:'📦', label:'Repuestos' },
        // Protocolos: SuperAdmin, Admin y Auditor
        ...(['SuperAdmin','Admin','Auditor'].includes(rol) ? [{ id:'protocolos', icon:'📋', label:'Protocolos' }] : []),
      ]
    },
    // Proveedores y Contratos: SOLO SuperAdmin
    ...(esSuperAdmin ? [{
      id:'proveedores_grp',
      label:'Proveedores',
      icon:'🏢',
      items:[
        { id:'proveedores', icon:'🏢', label:'Proveedores' },
        { id:'contratos', icon:'📄', label:'Contratos' },
      ]
    }] : []),
    {
      id:'admin',
      label:'Administración',
      icon:'⚙',
      items:[
        // Usuarios: SOLO SuperAdmin
        ...(esSuperAdmin ? [{ id:'usuarios', icon:'◉', label:'Usuarios' }] : []),
        // Instituciones: SuperAdmin (editar) + Admin/Auditor (solo ver)
        ...(['SuperAdmin','Admin','Auditor'].includes(rol) ? [{ id:'instituciones', icon:'🏥', label:'Instituciones' }] : []),
      ]
    },
  ].filter(g => g.items.length > 0);
  const titulos = {
    dashboard:'Dashboard Ejecutivo', inventario:'Inventario de Equipos',
    mantenimiento:'Módulo de Mantenimiento', tecnovigilancia:'Tecnovigilancia',
    repuestos:'Inventario de Repuestos', historial:'Historial / Trazabilidad',
    usuarios:'Gestión de Usuarios', instituciones:'Gestión de Instituciones',
    protocolos:'Protocolos de Mantenimiento',
    indicadores:'Indicadores de Gestión',
    calendario:'Calendario de Mantenimientos',
    rondas:'Rondas de Inventario',
    proveedores:'Proveedores Externos',
    contratos:'Contratos con Proveedores',
  };
  const gravBadge = (g) => g==='GRAVE'?'badge-red':g==='MODERADO'?'badge-orange':'badge-gray';
  const estadoTecnoBadge = (e) => e==='ABIERTO'?'badge-red':e==='EN_REVISION'?'badge-orange':'badge-green';
  const tiposUnicos = [...new Set(protocolos.map(p=>p.tipo_equipo).filter(Boolean))];

  return (
    <>
      <style>{css}</style>
      {modalOT && <ModalOT equipos={equipos} token={token} onClose={()=>setModalOT(false)} onSaved={cargarTodo} />}
      {modalFin && <ModalFinalizar ot={modalFin} token={token} repuestos={repuestos} onClose={()=>setModalFin(null)} onSaved={cargarTodo} />}
      {modalTecno && <ModalTecno equipos={equipos} token={token} onClose={()=>setModalTecno(false)} onSaved={cargarTodo} />}
      {modalUsuario!==null && <ModalUsuario usuario={modalUsuario||null} token={token} instituciones={instituciones} rol={rol} onClose={()=>setModalUsuario(null)} onSaved={()=>{cargarTodo();setModalUsuario(null);}} />}
      {modalInst!==null && <ModalInstitucion institucion={modalInst||null} token={token} onClose={()=>setModalInst(null)} onSaved={()=>{cargarTodo();setModalInst(null);}} />}
      {modalRep!==null && <ModalRepuesto repuesto={modalRep||null} equipos={equipos} token={token} onClose={()=>setModalRep(null)} onSaved={()=>{cargarTodo();setModalRep(null);}} />}
      {modalMov && <ModalMovimiento repuesto={modalMov} token={token} onClose={()=>setModalMov(null)} onSaved={cargarTodo} />}
      {modalDetRep && <ModalDetalleRepuesto repuesto={modalDetRep} token={token} onClose={()=>setModalDetRep(null)} />}
      {modalImportar && <ModalImportar token={token} equiposActuales={equipos} onClose={()=>setModalImportar(false)} onSaved={cargarTodo} />}
      {modalProtocolo!==null && <ModalProtocolo protocolo={modalProtocolo||null} tiposEquipo={tiposEquipo} token={token} onClose={()=>setModalProtocolo(null)} onSaved={()=>{cargarTodo();setModalProtocolo(null);}} />}
      {modalReporte && <ModalReporte ot={modalReporte} token={token} onClose={()=>setModalReporte(null)} onSaved={cargarTodo} />}
      
      {/* BANNER FLOTANTE PWA */}
      {!appInstalada && installPrompt && (
        <div style={{
          position:'fixed', bottom:14, left:14, right:14,
          background:G.accent, color:'#0a1520', padding:'12px 16px',
          borderRadius:8, zIndex:99,
          boxShadow:'0 8px 24px rgba(0,229,160,0.3)',
          display:'flex', alignItems:'center', gap:12,
          animation:'slideUp 0.4s ease-out',
          maxWidth:480, margin:'0 auto'
        }}>
          <div style={{fontSize:24}}>📱</div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:12, fontWeight:700, letterSpacing:0.5}}>Instala BioMed·HIS</div>
            <div style={{fontSize:10, opacity:0.85, marginTop:2}}>Acceso rápido como app desde tu pantalla de inicio</div>
          </div>
          <button
            onClick={instalarApp}
            style={{
              background:'#0a1520', color:G.accent, border:'none',
              padding:'8px 14px', borderRadius:6, fontSize:11,
              fontWeight:700, cursor:'pointer', whiteSpace:'nowrap'
            }}
          >Instalar</button>
          <button
            onClick={()=>setInstallPrompt(null)}
            style={{
              background:'transparent', color:'#0a1520', border:'none',
              fontSize:18, cursor:'pointer', padding:'0 4px',
              opacity:0.6
            }}
            title="Cerrar"
          >✕</button>
        </div>
      )}

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-mark">BioMed·HIS</div>
            <div className="logo-sub">Ingeniería Clínica</div>
            {user?.institucion_nombre && <div className="inst-badge">🏥 {user.institucion_nombre}</div>}
            {esSuperAdmin && !user?.institucion_nombre && <div className="inst-badge" style={{color:'#a78bfa',borderColor:'rgba(167,139,250,0.3)'}}>◈ Todas las instituciones</div>}
          </div>
          <nav className="nav-section">
            {navGroups.map(grupo => {
              const abierto = gruposAbiertos[grupo.id];
              // Calcular badges de alerta del grupo
              const alertasGrupo = (() => {
                let total = 0;
                if (grupo.items.some(i=>i.id==='mantenimiento')) total += alertas.length;
                if (grupo.items.some(i=>i.id==='tecnovigilancia')) total += tecno.filter(t=>t.estado==='ABIERTO').length;
                if (grupo.items.some(i=>i.id==='repuestos')) total += repStockBajo.length;
                return total;
              })();
              return (
                <div key={grupo.id} style={{marginBottom:2}}>
                  <div
                    onClick={() => toggleGrupo(grupo.id)}
                    style={{
                      display:'flex', alignItems:'center', gap:8,
                      padding:'10px 16px',
                      cursor:'pointer',
                      fontSize:10, fontWeight:700, letterSpacing:1.5,
                      textTransform:'uppercase',
                      color: abierto ? G.accent : G.textMuted,
                      borderLeft: abierto ? `3px solid ${G.accent}` : '3px solid transparent',
                      background: abierto ? 'rgba(0,229,160,0.04)' : 'transparent',
                      transition: 'all 0.15s',
                      userSelect: 'none'
                    }}
                  >
                    <span style={{fontSize:14}}>{grupo.icon}</span>
                    <span style={{flex:1}}>{grupo.label}</span>
                    {!abierto && alertasGrupo > 0 && (
                      <span style={{background:G.danger,color:'#fff',borderRadius:10,padding:'1px 6px',fontSize:9,fontWeight:700}}>
                        {alertasGrupo}
                      </span>
                    )}
                    <span style={{fontSize:10,opacity:0.6,transform:`rotate(${abierto?90:0}deg)`,transition:'transform 0.2s'}}>▶</span>
                  </div>
                  {abierto && grupo.items.map(n => (
                    <div
                      key={n.id}
                      className={`nav-item ${seccion===n.id?'active':''}`}
                      onClick={()=>setSeccion(n.id)}
                      style={{paddingLeft:34}}
                    >
                      <span className="nav-icon">{n.icon}</span>{n.label}
                      {n.id==='mantenimiento'&&alertas.length>0&&<span style={{marginLeft:'auto',background:G.danger,color:'#fff',borderRadius:10,padding:'1px 6px',fontSize:10,fontWeight:700}}>{alertas.length}</span>}
                      {n.id==='tecnovigilancia'&&tecno.filter(t=>t.estado==='ABIERTO').length>0&&<span style={{marginLeft:'auto',background:'#f4a261',color:'#fff',borderRadius:10,padding:'1px 6px',fontSize:10,fontWeight:700}}>{tecno.filter(t=>t.estado==='ABIERTO').length}</span>}
                      {n.id==='repuestos'&&repStockBajo.length>0&&<span style={{marginLeft:'auto',background:G.warning,color:'#fff',borderRadius:10,padding:'1px 6px',fontSize:10,fontWeight:700}}>{repStockBajo.length}</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </nav>
          <div className="sidebar-footer">
            <div style={{fontSize:11,marginBottom:2,color:G.text}}>{user?.nombre||'Usuario'}</div>
            <div className={`rol-badge ${esSuperAdmin?'superadmin-badge':''}`}>{rol}</div>
            {!appInstalada && installPrompt && (
              <button
                className="btn"
                style={{marginTop:10,width:'100%',justifyContent:'center',fontSize:11,background:G.accent,color:'#0a1520',fontWeight:600,animation:'pulse 2s infinite'}}
                onClick={instalarApp}
              >📱 Instalar App
              </button>
            )}
            {esSuperAdmin && <button className="btn btn-purple" style={{marginTop:10,width:'100%',justifyContent:'center',fontSize:11}} onClick={()=>setInstSeleccionada(false)}>⇄ Cambiar institución</button>}
            <button className="btn btn-logout" style={{marginTop:8,width:'100%',justifyContent:'center'}} onClick={logout}>↩ Cerrar sesión</button>
          </div>
        </aside>

        <main className="main">
          <div className="session-banner"><span className="session-dot" />Sesión activa · {user?.nombre} · {rol}{user?.institucion_nombre&&<> · <b>{user.institucion_nombre}</b></>}</div>

          <div className="topbar">
            <div className="topbar-title">{titulos[seccion]}</div>
            <div className="topbar-right">
              {seccion==='inventario' && <button className="btn btn-orange" onClick={()=>exportarPlantillaInventario('pdf')} title="Plantilla GTE-FR-001 PDF">📋 Plantilla PDF</button>}
              {seccion==='inventario' && <button className="btn btn-orange" onClick={()=>exportarPlantillaInventario('excel')} title="Plantilla GTE-FR-001 Excel">📊 Plantilla Excel</button>}
              {seccion!=='inventario' && <button className="btn btn-ghost" onClick={descargarPDF}>↓ PDF</button>}
              {rol!=='Auditor'&&seccion==='mantenimiento'&&<button className="btn btn-primary" onClick={()=>setModalOT(true)}>+ Nueva OT</button>}
              {rol!=='Auditor'&&seccion==='inventario'&&<button className="btn btn-purple" onClick={()=>setModalImportar(true)}>📊 Importar Excel</button>}
              {rol!=='Auditor'&&seccion==='inventario'&&<button className="btn btn-primary" onClick={()=>{setEditando(null);setForm(formVacio);}}>+ Nuevo equipo</button>}
              {rol!=='Auditor'&&seccion==='tecnovigilancia'&&<button className="btn btn-primary" onClick={()=>setModalTecno(true)}>+ Nuevo reporte</button>}
              {rol!=='Auditor'&&seccion==='repuestos'&&<button className="btn btn-primary" onClick={()=>setModalRep(false)}>+ Nuevo repuesto</button>}
              {esSuperAdmin&&seccion==='usuarios'&&<button className="btn btn-primary" onClick={()=>setModalUsuario(false)}>+ Nuevo usuario</button>}
              {esSuperAdmin&&seccion==='instituciones'&&<button className="btn btn-primary" onClick={()=>setModalInst(false)}>+ Nueva institución</button>}
              {['SuperAdmin','Admin'].includes(rol)&&seccion==='protocolos'&&<button className="btn btn-primary" onClick={()=>setModalProtocolo(false)}>+ Nuevo protocolo</button>}
            </div>
          </div>

          <div className="content">

            {seccion==='dashboard' && (<>
              <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
                {[{label:'Total Equipos',valor:dashKpis?.totalEquipos??total,cls:'blue'},{label:'Activos',valor:dashKpis?.activos??activos,cls:'green'},{label:'OTs Pendientes',valor:dashKpis?.otPendientes??'—',cls:'orange'},{label:'INVIMA Vencidos',valor:dashKpis?.invVencidos??vencidos,cls:'red'}].map(k=>(<div key={k.label} className={`kpi-card ${k.cls}`}><div className="kpi-label">{k.label}</div><div className="kpi-value">{k.valor}</div></div>))}
              </div>
              <div className="kpi-grid" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
                {[{label:'En Mantenimiento',valor:dashKpis?.enMant??'—',cls:'yellow'},{label:'OTs Realizadas',valor:dashKpis?.otRealizados??'—',cls:'green'},{label:'Tecnovigilancia',valor:dashKpis?.tecnoAbiertos??'—',cls:'purple'},{label:'Repuestos',valor:dashKpis?.repuestosTotal??'—',cls:'blue'},{label:'Stock Bajo',valor:dashKpis?.repuestosBajo??'—',cls:'orange'}].map(k=>(<div key={k.label} className={`kpi-card ${k.cls}`}><div className="kpi-label">{k.label}</div><div className="kpi-value">{k.valor}</div></div>))}
              </div>
              <div className="chart-grid">
                <div className="panel"><div className="panel-header"><div className="panel-title">Equipos por Servicio</div></div><div className="panel-body" style={{height:260}}>{dashKpis?.porServicio?.length>0?<ResponsiveContainer width="100%" height="100%"><BarChart data={dashKpis.porServicio} margin={{top:4,right:10,left:-20,bottom:40}}><XAxis dataKey="servicio" tick={{fill:G.textMuted,fontSize:10}} angle={-30} textAnchor="end" /><YAxis tick={{fill:G.textMuted,fontSize:10}} /><Tooltip contentStyle={{background:G.card,border:`1px solid ${G.cardBorder}`,borderRadius:4,fontSize:12}} /><Bar dataKey="total" fill={G.accent} radius={[3,3,0,0]} /></BarChart></ResponsiveContainer>:<div className="empty-state">Sin datos</div>}</div></div>
                <div className="panel"><div className="panel-header"><div className="panel-title">Mantenimientos Últimos 6 Meses</div></div><div className="panel-body" style={{height:260}}>{dashKpis?.porMes?.length>0?<ResponsiveContainer width="100%" height="100%"><BarChart data={dashKpis.porMes} margin={{top:4,right:10,left:-20,bottom:10}}><XAxis dataKey="mes" tick={{fill:G.textMuted,fontSize:10}} /><YAxis tick={{fill:G.textMuted,fontSize:10}} /><Tooltip contentStyle={{background:G.card,border:`1px solid ${G.cardBorder}`,borderRadius:4,fontSize:12}} /><Bar dataKey="total" name="Total" fill="#4da6ff" radius={[3,3,0,0]} /><Bar dataKey="realizados" name="Realizados" fill={G.accent} radius={[3,3,0,0]} /><Legend wrapperStyle={{fontSize:11,color:G.textMuted}} /></BarChart></ResponsiveContainer>:<div className="empty-state">Sin datos</div>}</div></div>
              </div>
              <div className="chart-grid">
                <div className="panel"><div className="panel-header"><div className="panel-title">Clasificación de Riesgo</div></div><div className="panel-body" style={{height:240}}>{dashKpis?.porRiesgo?.length>0?<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={dashKpis.porRiesgo} dataKey="total" nameKey="riesgo" cx="50%" cy="50%" outerRadius={80} label={({riesgo,total})=>`${riesgo}: ${total}`}>{dashKpis.porRiesgo.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]} />)}</Pie><Tooltip contentStyle={{background:G.card,border:`1px solid ${G.cardBorder}`,borderRadius:4,fontSize:12}} /></PieChart></ResponsiveContainer>:<div className="empty-state">Sin datos</div>}</div></div>
                <div className="panel"><div className="panel-header"><div className="panel-title">Tecnovigilancia por Gravedad</div></div><div className="panel-body" style={{height:240}}>{dashKpis?.porGravedad?.length>0?<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={dashKpis.porGravedad} dataKey="total" nameKey="gravedad" cx="50%" cy="50%" outerRadius={80} label={({gravedad,total})=>`${gravedad}: ${total}`}>{dashKpis.porGravedad.map((e,i)=><Cell key={i} fill={e.gravedad==='GRAVE'?G.danger:e.gravedad==='MODERADO'?G.warning:G.textMuted} />)}</Pie><Tooltip contentStyle={{background:G.card,border:`1px solid ${G.cardBorder}`,borderRadius:4,fontSize:12}} /></PieChart></ResponsiveContainer>:<div className="empty-state">Sin datos</div>}</div></div>
              </div>
            </>)}

            {seccion==='inventario' && (<>
              <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
                {[{label:'Total',valor:total,cls:'blue'},{label:'Activos',valor:activos,cls:'green'},{label:'Por vencer',valor:porVencer,cls:'orange'},{label:'Vencido',valor:vencidos,cls:'red'}].map(k=><div key={k.label} className={`kpi-card ${k.cls}`}><div className="kpi-label">{k.label}</div><div className="kpi-value">{k.valor}</div></div>)}
              </div>
              {alertas.length>0&&<div className="alert-bar"><span className="alert-icon">⚠</span><div><div className="alert-title">Mantenimientos críticos ({alertas.length})</div>{alertas.map(a=><div key={a.id} className="alert-item">{a.equipo_nombre} — {formatFecha(a.fecha_programada)}</div>)}</div></div>}
              {rol!=='Auditor' && (
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">{editando?'Editar equipo':'Registrar equipo'}</div>
                    {editando&&<button className="btn btn-ghost btn-icon" onClick={()=>{setEditando(null);setForm(formVacio);}}>✕</button>}
                  </div>
                  <div className="panel-body">
                    <div className="form-grid">
                      {[['nombre','Nombre'],['marca','Marca'],['modelo','Modelo'],['serie','Serie'],['registro_invima','Reg. INVIMA'],['fecha_vencimiento_invima','Venc. INVIMA','date'],['ubicacion','Ubicación'],['servicio','Servicio']].map(([key,label,type='text'])=>(
                        <div className="field" key={key}>
                          <label>{label}</label>
                          <input type={type} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} />
                        </div>
                      ))}
                      <div className="field">
                        <label>Tipo de equipo</label>
                        <select value={form.tipo_equipo||''} onChange={e=>setForm({...form,tipo_equipo:e.target.value})}>
                          <option value="">Seleccionar tipo</option>
                          {tiposEquipo.map(t=><option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                        </select>
                      </div>
                      <div className="field"><label>Riesgo</label><select value={form.clasificacion_riesgo} onChange={e=>setForm({...form,clasificacion_riesgo:e.target.value})}><option value="">Seleccionar</option>{['I','IIa','IIb','III'].map(c=><option key={c} value={c}>Clase {c}</option>)}</select></div>
                      <div className="field"><label>Estado</label><select value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}><option value="">Seleccionar</option><option value="Activo">Activo</option><option value="Mantenimiento">En mantenimiento</option><option value="Baja">Dado de baja</option></select></div>
                      <div className="field"><label>Activo Fijo</label><input value={form.activo_fijo} onChange={e=>setForm({...form,activo_fijo:e.target.value})} placeholder="Código contable" /></div>
                      <div className="field"><label>Garantía</label><select value={form.garantia?'SI':'NO'} onChange={e=>setForm({...form,garantia:e.target.value==='SI'})}><option value="NO">NO</option><option value="SI">SÍ</option></select></div>
                      {form.garantia && <div className="field"><label>Vencimiento garantía</label><input type="date" value={form.garantia_vencimiento} onChange={e=>setForm({...form,garantia_vencimiento:e.target.value})} /></div>}
                    </div>
                    <button className="btn btn-primary" onClick={guardar}>{editando?'✓ Guardar':'+ Registrar'}</button>
                  </div>
                </div>
              )}
              <div className="search-bar"><span>⌕</span><input placeholder="Buscar..." value={filtro} onChange={e=>setFiltro(e.target.value)} /></div>
              <div className="panel">
                <div className="panel-header"><div className="panel-title">Equipos</div><div style={{fontSize:11,color:G.textMuted}}>{filtrados.length}</div></div>
                {filtrados.length===0 ? <div className="empty-state">Sin equipos</div> : (
                  <table className="data-table">
                    <thead><tr>
                      <th>A. Fijo</th>
                      <th>Nombre</th>
                      <th>Tipo</th>
                      <th>Marca/Modelo</th>
                      <th>Serie</th>
                      <th>INVIMA</th>
                      <th>Vencimiento</th>
                      <th>Riesgo</th>
                      <th>Servicio</th>
                      <th>Garantía</th>
                      <th>Estado</th>
                      {esSuperAdmin&&<th>Institución</th>}
                      <th></th>
                    </tr></thead>
                    <tbody>
                      {filtrados.map(eq=>{
                        const inv=getEstadoInvima(eq.fecha_vencimiento_invima);
                        const estBadge=eq.estado==='Activo'?'badge-green':eq.estado==='Mantenimiento'?'badge-orange':'badge-gray';
                        const garVencida = eq.garantia && eq.garantia_vencimiento && new Date(eq.garantia_vencimiento) < new Date();
                        return (
                          <tr key={eq.id}>
                            <td style={{fontFamily:'IBM Plex Mono',fontSize:11,color:G.textMuted}}>{eq.activo_fijo||'—'}</td>
                            <td style={{fontWeight:500}}>{eq.nombre}</td>
                            <td>{eq.tipo_equipo?<span className="badge badge-purple">{eq.tipo_equipo}</span>:<span style={{color:G.textMuted,fontSize:11}}>—</span>}</td>
                            <td style={{color:G.textMuted}}>{eq.marca} {eq.modelo}</td>
                            <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{eq.serie}</td>
                            <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{eq.registro_invima||'—'}</td>
                            <td><div style={{fontSize:11,fontFamily:'IBM Plex Mono',color:G.textMuted}}>{formatFecha(eq.fecha_vencimiento_invima)}</div>{inv&&<span className={`badge ${inv.cls}`} style={{marginTop:4,display:'inline-block'}}>{inv.label}</span>}</td>
                            <td>{eq.clasificacion_riesgo?<span className="badge badge-gray">{eq.clasificacion_riesgo}</span>:'—'}</td>
                            <td style={{color:G.textMuted}}>{eq.servicio||'—'}</td>
                            <td>
                              {eq.garantia ? (
                                <div>
                                  <span className={`badge ${garVencida?'badge-red':'badge-green'}`}>{garVencida?'VENCIDA':'SÍ'}</span>
                                  {eq.garantia_vencimiento && <div style={{fontSize:10,color:G.textMuted,marginTop:2,fontFamily:'IBM Plex Mono'}}>{formatFecha(eq.garantia_vencimiento)}</div>}
                                </div>
                              ) : <span className="badge badge-gray">NO</span>}
                            </td>
                            <td>{eq.estado?<span className={`badge ${estBadge}`}>{eq.estado}</span>:'—'}</td>
                            {esSuperAdmin&&<td style={{fontSize:11,color:G.textMuted}}>{eq.institucion_nombre||'—'}</td>}
                            <td>
                              <div style={{display:'flex',gap:4}}>
                                <button className="btn btn-ghost btn-icon" onClick={()=>verHistorial(eq)}>◷</button>
                                {rol!=='Auditor'&&<>
                                  <button className="btn btn-ghost btn-icon" onClick={()=>editar(eq)}>✎</button>
                                  <button className="btn btn-danger btn-icon" onClick={()=>eliminar(eq.id)}>✕</button>
                                </>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>)}

            {seccion==='mantenimiento' && (<>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:16,marginBottom:24}}>{[{label:'Total',valor:kpis?.total??'—',cls:'blue'},{label:'Pendientes',valor:kpis?.pendientes??'—',cls:'orange'},{label:'Realizados',valor:kpis?.realizados??'—',cls:'green'},{label:'Críticas',valor:kpis?.criticas??'—',cls:'red'},{label:'MTTR días',valor:kpis?.mttr??'—',cls:'purple'}].map(k=><div key={k.label} className={`kpi-card ${k.cls}`}><div className="kpi-label">{k.label}</div><div className="kpi-value">{k.valor}</div></div>)}</div>
              {alertas.length>0&&<div className="alert-bar"><span className="alert-icon">⚠</span><div><div className="alert-title">OTs ≤7 días</div>{alertas.map(a=><div key={a.id} className="alert-item">{a.equipo_nombre} · {formatFecha(a.fecha_programada)}</div>)}</div></div>}
              <div style={{display:'flex',gap:8,marginBottom:16}}>{['TODOS','PENDIENTE','REALIZADO'].map(f=><button key={f} className={`btn ${filtroMant===f?'btn-primary':'btn-ghost'}`} style={{fontSize:11}} onClick={()=>setFiltroMant(f)}>{f}</button>)}</div>
              <div className="panel"><div className="panel-header"><div className="panel-title">Órdenes</div><span className="badge badge-gray">{mantFiltrados.length}</span></div>{mantFiltrados.length===0?<div className="empty-state">Sin órdenes</div>:<table className="data-table"><thead><tr><th>Equipo</th><th>Tipo Equipo</th><th>Servicio</th><th>Tipo</th><th>Prioridad</th><th>Programado</th><th>Realizado</th><th>Estado</th>{esSuperAdmin&&<th>Institución</th>}{rol!=='Auditor'&&<th></th>}</tr></thead><tbody>{mantFiltrados.map(m=>(<tr key={m.id}><td style={{fontWeight:500}}>{m.equipo_nombre}</td><td>{m.tipo_equipo?<span className="badge badge-purple">{m.tipo_equipo}</span>:<span style={{color:G.textMuted,fontSize:11}}>—</span>}</td><td style={{color:G.textMuted,fontSize:11}}>{m.equipo_servicio||'—'}</td><td><span className="badge badge-gray">{m.tipo}</span></td><td><span className={`badge ${prioridadBadge(m.prioridad)}`}>{m.prioridad}</span></td><td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{formatFecha(m.fecha_programada)}</td><td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{m.fecha_realizada?formatFecha(m.fecha_realizada):'—'}</td><td><span className={`badge ${m.estado==='PENDIENTE'?'badge-orange':'badge-green'}`}>{m.estado}</span></td>{esSuperAdmin&&<td style={{fontSize:11,color:G.textMuted}}>{m.institucion_nombre||'—'}</td>}{rol!=='Auditor'&&<td><div style={{display:'flex',gap:4}}>
                <button className="btn btn-purple btn-icon" onClick={()=>setModalReporte(m)} title="Reporte completo de mantenimiento">📋</button>
                {m.estado==='PENDIENTE'&&<button className="btn btn-primary btn-icon" onClick={()=>setModalFin(m)} title="Finalizar OT">✓</button>}
                {m.reporte_id&&<span className="badge badge-green" style={{marginLeft:4}} title="Tiene reporte">✓R</span>}
              </div></td>}</tr>))}</tbody></table>}</div>
            </>)}

            {seccion==='tecnovigilancia' && (<>
              <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>{[{label:'Total',valor:tecno.length,cls:'blue'},{label:'Abiertos',valor:tecno.filter(t=>t.estado==='ABIERTO').length,cls:'red'},{label:'En revisión',valor:tecno.filter(t=>t.estado==='EN_REVISION').length,cls:'orange'},{label:'Cerrados',valor:tecno.filter(t=>t.estado==='CERRADO').length,cls:'green'}].map(k=><div key={k.label} className={`kpi-card ${k.cls}`}><div className="kpi-label">{k.label}</div><div className="kpi-value">{k.valor}</div></div>)}</div>
              <div className="panel"><div className="panel-header"><div className="panel-title">Reportes</div><span className="badge badge-gray">{tecno.length}</span></div>{tecno.length===0?<div className="empty-state">Sin reportes</div>:<table className="data-table"><thead><tr><th>Fecha</th><th>Equipo</th><th>Tipo</th><th>Gravedad</th><th>Estado</th><th>Reportado</th><th>Descripción</th>{esSuperAdmin&&<th>Institución</th>}{rol!=='Auditor'&&<th></th>}</tr></thead><tbody>{tecno.map(t=>(<tr key={t.id}><td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{formatFecha(t.fecha_evento)}</td><td style={{fontWeight:500}}>{t.equipo_nombre||'General'}</td><td><span className="badge badge-gray">{t.tipo}</span></td><td><span className={`badge ${gravBadge(t.gravedad)}`}>{t.gravedad}</span></td><td><span className={`badge ${estadoTecnoBadge(t.estado)}`}>{t.estado}</span></td><td style={{color:G.textMuted,fontSize:11}}>{t.reportado_nombre||'—'}</td><td style={{color:G.textMuted,fontSize:11,maxWidth:200}}>{t.descripcion}</td>{esSuperAdmin&&<td style={{fontSize:11,color:G.textMuted}}>{t.institucion_nombre||'—'}</td>}{rol!=='Auditor'&&<td><div style={{display:'flex',gap:4}}>{t.estado==='ABIERTO'&&<button className="btn btn-ghost btn-icon" style={{fontSize:10}} onClick={()=>cambiarEstadoTecno(t.id,'EN_REVISION')}>Revisar</button>}{t.estado==='EN_REVISION'&&<button className="btn btn-primary btn-icon" style={{fontSize:10}} onClick={()=>cambiarEstadoTecno(t.id,'CERRADO')}>Cerrar</button>}</div></td>}</tr>))}</tbody></table>}</div>
            </>)}

            {seccion==='repuestos' && (<>
              <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
                {[
                  {label:'Total Repuestos',valor:repKpis?.total??repuestos.length,cls:'blue'},
                  {label:'Stock Bajo',valor:repKpis?.stockBajo??repStockBajo.length,cls:'orange'},
                  {label:'Sin Stock',valor:repKpis?.sinStock??repuestos.filter(r=>r.stock_actual===0).length,cls:'red'},
                  {label:'Valor Total',valor:fmtMoney(repKpis?.valorTotal||0),cls:'green'},
                ].map(k=><div key={k.label} className={`kpi-card ${k.cls}`}><div className="kpi-label">{k.label}</div><div className="kpi-value" style={{fontSize:k.label==='Valor Total'?16:28}}>{k.valor}</div></div>)}
              </div>
              {repStockBajo.length>0 && (
                <div className="alert-bar"><span className="alert-icon">⚠</span>
                  <div><div className="alert-title">Stock Bajo ({repStockBajo.length} repuestos)</div>
                  {repStockBajo.slice(0,5).map(r=><div key={r.id} className="alert-item">{r.nombre} — {r.stock_actual}/{r.stock_minimo} {r.unidad_medida}</div>)}
                  {repStockBajo.length>5&&<div className="alert-item">... y {repStockBajo.length-5} más</div>}</div>
                </div>
              )}
              <div className="search-bar"><span>⌕</span><input placeholder="Buscar repuesto..." value={filtroRep} onChange={e=>setFiltroRep(e.target.value)} /></div>
              <div className="panel">
                <div className="panel-header"><div className="panel-title">Repuestos</div><span className="badge badge-gray">{repFiltrados.length}</span></div>
                {repFiltrados.length===0 ? <div className="empty-state">Sin repuestos</div> : (
                  <table className="data-table">
                    <thead><tr>
                      <th>Código</th><th>Nombre</th><th>Categoría</th><th>Stock</th>
                      <th>Costo unit.</th><th>Valor</th><th>Vence</th><th>Ubicación</th>
                      {esSuperAdmin&&<th>Institución</th>}<th></th>
                    </tr></thead>
                    <tbody>
                      {repFiltrados.map(r=>{
                        const stockStatus = r.stock_actual===0?'badge-red':(r.stock_actual<=r.stock_minimo&&r.stock_minimo>0)?'badge-orange':'badge-green';
                        return (
                          <tr key={r.id}>
                            <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{r.codigo||'—'}</td>
                            <td style={{fontWeight:500}}>{r.nombre}<div style={{fontSize:10,color:G.textMuted}}>{r.marca} {r.modelo}</div></td>
                            <td>{r.categoria?<span className="badge badge-gray">{r.categoria}</span>:'—'}</td>
                            <td><span className={`badge ${stockStatus}`}>{r.stock_actual} {r.unidad_medida}</span><div style={{fontSize:10,color:G.textMuted,marginTop:2}}>min: {r.stock_minimo}</div></td>
                            <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{fmtMoney(r.costo_unitario)}</td>
                            <td style={{fontFamily:'IBM Plex Mono',fontSize:11,color:G.accent}}>{fmtMoney(r.stock_actual*r.costo_unitario)}</td>
                            <td style={{fontFamily:'IBM Plex Mono',fontSize:11,color:G.textMuted}}>{formatFecha(r.fecha_vencimiento)}</td>
                            <td style={{color:G.textMuted,fontSize:11}}>{r.ubicacion||'—'}</td>
                            {esSuperAdmin&&<td style={{fontSize:11,color:G.textMuted}}>{r.institucion_nombre||'—'}</td>}
                            <td><div style={{display:'flex',gap:4}}>
                              <button className="btn btn-ghost btn-icon" onClick={()=>setModalDetRep(r)} title="Ver detalle">◷</button>
                              {rol!=='Auditor'&&<>
                                <button className="btn btn-orange btn-icon" onClick={()=>setModalMov(r)} title="Movimiento">⇄</button>
                                <button className="btn btn-ghost btn-icon" onClick={()=>editarRepuesto(r)} title="Editar">✎</button>
                                <button className="btn btn-danger btn-icon" onClick={()=>eliminarRepuesto(r.id)} title="Eliminar">✕</button>
                              </>}
                            </div></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>)}

            {seccion==='historial' && (
              <div className="panel"><div className="panel-header"><div className="panel-title">{equipoSel?`Trazabilidad — ${equipoSel.nombre}`:'Selecciona un equipo'}</div></div><div className="panel-body">{!equipoSel?<div className="empty-state">Ve a Inventario y presiona ◷</div>:historial.length===0?<div className="empty-state">Sin eventos</div>:<div className="timeline">{historial.map(h=>(<div className="tl-item" key={h.id}><div className="tl-dot" /><div className="tl-content"><div className="tl-action">{h.accion}</div><div className="tl-desc">{h.descripcion}</div><div className="tl-date">{formatFecha(h.fecha)}</div></div></div>))}</div>}</div></div>
            )}

            {seccion==='usuarios'&&esSuperAdmin&&(<>
              <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>{[{label:'Total',valor:usuarios.length,cls:'blue'},{label:'Admins',valor:usuarios.filter(u=>u.rol==='Admin'||u.rol==='SuperAdmin').length,cls:'purple'},{label:'Biomédicos',valor:usuarios.filter(u=>u.rol==='Biomedico').length,cls:'green'},{label:'Auditores',valor:usuarios.filter(u=>u.rol==='Auditor').length,cls:'gray'}].map(k=><div key={k.label} className={`kpi-card ${k.cls||'blue'}`}><div className="kpi-label">{k.label}</div><div className="kpi-value">{k.valor}</div></div>)}</div>
              <div className="panel"><div className="panel-header"><div className="panel-title">Usuarios</div><span className="badge badge-gray">{usuarios.length}</span></div>{usuarios.length===0?<div className="empty-state">Sin usuarios</div>:<table className="data-table"><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Creado</th>{esSuperAdmin&&<th>Institución</th>}<th></th></tr></thead><tbody>{usuarios.map(u=>(<tr key={u.id}><td style={{fontWeight:500}}>{u.nombre}</td><td style={{fontFamily:'IBM Plex Mono',fontSize:11,color:G.textMuted}}>{u.email}</td><td><span className={`badge ${u.rol==='Admin'||u.rol==='SuperAdmin'?'badge-purple':u.rol==='Auditor'?'badge-gray':'badge-green'}`}>{u.rol}</span></td><td style={{fontFamily:'IBM Plex Mono',fontSize:11,color:G.textMuted}}>{formatFecha(u.creado_en)}</td>{esSuperAdmin&&<td style={{fontSize:11,color:G.textMuted}}>{u.institucion_nombre||'Global'}</td>}<td><div style={{display:'flex',gap:4}}><button className="btn btn-ghost btn-icon" onClick={()=>setModalUsuario(u)}>✎</button>{u.id!==user?.id&&<button className="btn btn-danger btn-icon" onClick={()=>eliminarUsuario(u.id)}>✕</button>}</div></td></tr>))}</tbody></table>}</div>
            </>)}

            {seccion==='indicadores' && (
              <Indicadores token={token} esSuperAdmin={esSuperAdmin} institucion={user?.institucion_nombre ? {nombre: user.institucion_nombre} : null} />
            )}
            {seccion==='rondas' && (
              <Rondas token={token} equipos={equipos} rol={rol} />
            )}
            {seccion==='proveedores' && (
              <Proveedores token={token} rol={rol} esSuperAdmin={esSuperAdmin} />
            )}
            {seccion==='contratos' && (
              <Contratos token={token} rol={rol} esSuperAdmin={esSuperAdmin} />
            )}
            {seccion==='calendario' && (
              <Calendario
                token={token}
                mantenimientos={mantenimientos}
                equipos={equipos}
                usuarios={usuarios}
                rol={rol}
                onRecargar={cargarTodo}
                onAbrirReporte={(ot)=>setModalReporte(ot)}
                onFinalizarOT={(ot)=>setModalFin(ot)}
              />
            )}

            {seccion==='protocolos'&&['SuperAdmin','Admin','Auditor'].includes(rol)&&(<>
              <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
                {[
                  {label:'Total Protocolos',valor:protocolos.length,cls:'blue'},
                  {label:'Activos',valor:protocolos.filter(p=>p.activo).length,cls:'green'},
                  {label:'Inactivos',valor:protocolos.filter(p=>!p.activo).length,cls:'gray'},
                  {label:'Tipos cubiertos',valor:tiposUnicos.length,cls:'purple'},
                ].map(k=><div key={k.label} className={`kpi-card ${k.cls}`}><div className="kpi-label">{k.label}</div><div className="kpi-value">{k.valor}</div></div>)}
              </div>

              <div style={{padding:'14px 16px',background:'rgba(167,139,250,0.06)',border:'1px solid rgba(167,139,250,0.2)',borderRadius:6,marginBottom:16,fontSize:12,color:G.textMuted}}>
                💡 Los protocolos definen la lista de actividades a realizar durante el mantenimiento de cada tipo de equipo. Se asocian automáticamente al crear un reporte de mantenimiento según el tipo del equipo.
              </div>

              <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
                <button className={`btn ${filtroProto==='TODOS'?'btn-primary':'btn-ghost'}`} style={{fontSize:11}} onClick={()=>setFiltroProto('TODOS')}>TODOS</button>
                {tiposUnicos.map(t=>(
                  <button key={t} className={`btn ${filtroProto===t?'btn-primary':'btn-ghost'}`} style={{fontSize:11}} onClick={()=>setFiltroProto(t)}>{t}</button>
                ))}
              </div>

              <div className="panel">
                <div className="panel-header"><div className="panel-title">Protocolos</div><span className="badge badge-gray">{protoFiltrados.length}</span></div>
                {protoFiltrados.length===0 ? (
                  <div className="empty-state">
                    {protocolos.length===0 ? 'Aún no hay protocolos. Crea el primero con el botón "+ Nuevo protocolo"' : 'Sin protocolos para este tipo'}
                  </div>
                ) : (
                  <table className="data-table">
                    <thead><tr>
                      <th>Nombre</th><th>Tipo de equipo</th><th>Descripción</th><th>Estado</th><th>Creado</th><th></th>
                    </tr></thead>
                    <tbody>
                      {protoFiltrados.map(p=>(
                        <tr key={p.id}>
                          <td style={{fontWeight:500}}>📋 {p.nombre}</td>
                          <td><span className="badge badge-purple">{p.tipo_equipo||'Sin tipo'}</span></td>
                          <td style={{color:G.textMuted,fontSize:11,maxWidth:280}}>{p.descripcion||'—'}</td>
                          <td><span className={`badge ${p.activo?'badge-green':'badge-gray'}`}>{p.activo?'ACTIVO':'INACTIVO'}</span></td>
                          <td style={{fontFamily:'IBM Plex Mono',fontSize:11,color:G.textMuted}}>{formatFecha(p.created_at)}</td>
                          <td><div style={{display:'flex',gap:4}}>
                            {['SuperAdmin','Admin'].includes(rol) ? (<>
                              <button className="btn btn-ghost btn-icon" onClick={()=>setModalProtocolo(p)} title="Editar">✎</button>
                              <button className="btn btn-danger btn-icon" onClick={()=>eliminarProtocolo(p.id)} title="Eliminar">✕</button>
                            </>) : (
                              <button className="btn btn-ghost btn-icon" onClick={()=>setModalProtocolo(p)} title="Ver detalle">◷</button>
                            )}
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>)}

            {seccion==='instituciones'&&['SuperAdmin','Admin','Auditor'].includes(rol)&&(<>
              <div className="kpi-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>{[{label:'Total',valor:instituciones.length,cls:'blue'},{label:'Activas',valor:instituciones.filter(i=>i.activa).length,cls:'green'},{label:'Inactivas',valor:instituciones.filter(i=>!i.activa).length,cls:'red'}].map(k=><div key={k.label} className={`kpi-card ${k.cls}`}><div className="kpi-label">{k.label}</div><div className="kpi-value">{k.valor}</div></div>)}</div>
              <div className="panel"><div className="panel-header"><div className="panel-title">Instituciones</div><span className="badge badge-gray">{instituciones.length}</span></div>{instituciones.length===0?<div className="empty-state">Sin instituciones</div>:<table className="data-table"><thead><tr><th>Nombre</th><th>NIT</th><th>Ciudad</th><th>Tel</th><th>Email</th><th>REPS</th><th>Estado</th><th></th></tr></thead><tbody>{instituciones.map(inst=>(<tr key={inst.id}>
                <td style={{fontWeight:500}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    {inst.logo_url ? <img src={inst.logo_url} alt="" style={{width:24,height:24,objectFit:'contain',borderRadius:4,background:G.bg}} /> : <span>🏥</span>}
                    {inst.nombre}
                  </div>
                </td>
                <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{inst.nit||'—'}</td><td style={{color:G.textMuted}}>{inst.ciudad||'—'}</td><td style={{color:G.textMuted,fontSize:11}}>{inst.telefono||'—'}</td><td style={{color:G.textMuted,fontSize:11}}>{inst.email||'—'}</td><td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{inst.codigo_reps||'—'}</td><td><span className={`badge ${inst.activa?'badge-green':'badge-red'}`}>{inst.activa?'ACTIVA':'INACTIVA'}</span></td><td><div style={{display:'flex',gap:4}}>{esSuperAdmin && <button className="btn btn-ghost btn-icon" onClick={()=>setModalInst(inst)}>✎</button>}{esSuperAdmin && <button className="btn btn-purple btn-icon" style={{fontSize:10}} onClick={()=>{fetch(`${API}/instituciones/seleccionar/${inst.id}`,{method:'POST',headers}).then(r=>r.json()).then(d=>{if(d.token){setToken(d.token);setInstSeleccionada(true);setSeccion('dashboard');}});}}>→ Ver</button>}{!esSuperAdmin && <span className="badge badge-gray" style={{fontSize:9}}>Solo lectura</span>}</div></td></tr>))}</tbody></table>}</div>
            </>)}

          </div>
        </main>
      </div>
    </>
  );
}