import { useEffect, useState } from 'react';

const API = 'https://his-biomedico-production.up.railway.app';

const G = {
  bg:'#0f1623', card:'#19253a', cardBorder:'#1e2f47',
  accent:'#00e5a0', accentDim:'#00b87a', danger:'#ff4d6d', warning:'#ffb347',
  text:'#e2eaf4', textMuted:'#6b8099', input:'#0f1e30', inputBorder:'#1e3a56',
};

const TIPOS_CONTRATO = [
  'Mantenimiento preventivo',
  'Mantenimiento correctivo',
  'Mantenimiento integral',
  'Calibración periódica',
  'Suministro de repuestos',
  'Servicio técnico',
  'Capacitación',
  'Comodato',
  'Otro'
];

const fmtMoney = (n) => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n||0);
const formatFecha = (f) => f ? new Date(f).toLocaleDateString('es-CO',{year:'numeric',month:'short',day:'2-digit'}) : '—';

const getEstadoBadge = (c) => {
  if (c.estado_calculado === 'VENCIDO') return {cls:'badge-red', label:'VENCIDO'};
  if (c.estado_calculado === 'POR_VENCER') return {cls:'badge-orange', label:'POR VENCER'};
  if (c.estado === 'TERMINADO') return {cls:'badge-gray', label:'TERMINADO'};
  if (c.estado === 'CANCELADO') return {cls:'badge-gray', label:'CANCELADO'};
  return {cls:'badge-green', label:'VIGENTE'};
};

export default function Contratos({ token, rol, esSuperAdmin }) {
  const [contratos, setContratos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [filtroProv, setFiltroProv] = useState('');
  const [modalCont, setModalCont] = useState(null);
  const [detalleCont, setDetalleCont] = useState(null);
  const headers = { Authorization: token };

  const cargar = async () => {
    try {
      const [c, p, k, a] = await Promise.all([
        fetch(`${API}/contratos`, { headers }).then(r => r.json()),
        fetch(`${API}/proveedores`, { headers }).then(r => r.json()),
        fetch(`${API}/contratos/kpis/general`, { headers }).then(r => r.json()),
        fetch(`${API}/contratos/alertas/vencimiento`, { headers }).then(r => r.json()),
      ]);
      if (Array.isArray(c)) setContratos(c);
      if (Array.isArray(p)) setProveedores(p);
      setKpis(k);
      if (Array.isArray(a)) setAlertas(a);
    } catch(e) { console.error(e); }
  };

  useEffect(() => { cargar(); }, []);

  const eliminar = async (c) => {
    if (!window.confirm(`¿Eliminar el contrato "${c.numero_contrato}"?`)) return;
    const res = await fetch(`${API}/contratos/${c.id}`, { method:'DELETE', headers });
    const data = await res.json();
    if (data.error) return alert(data.error);
    cargar();
  };

  const filtrados = contratos.filter(c => {
    if (filtroEstado === 'VIGENTE' && c.estado_calculado !== 'VIGENTE') return false;
    if (filtroEstado === 'POR_VENCER' && c.estado_calculado !== 'POR_VENCER') return false;
    if (filtroEstado === 'VENCIDO' && c.estado_calculado !== 'VENCIDO') return false;
    if (filtroProv && c.proveedor_id !== parseInt(filtroProv)) return false;
    if (filtro) {
      const q = filtro.toLowerCase();
      return (c.numero_contrato||'').toLowerCase().includes(q) ||
             (c.proveedor_nombre||'').toLowerCase().includes(q) ||
             (c.objeto||'').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <>
      {modalCont !== null && (
        <ModalContrato
          contrato={modalCont || null}
          proveedores={proveedores}
          token={token}
          onClose={() => setModalCont(null)}
          onSaved={() => { cargar(); setModalCont(null); }}
        />
      )}
      {detalleCont && (
        <ModalDetalleContrato
          contrato={detalleCont}
          onClose={() => setDetalleCont(null)}
        />
      )}

      {/* KPIs */}
      {kpis && (
        <div className="kpi-grid" style={{gridTemplateColumns:'repeat(5,1fr)',marginBottom:14}}>
          <div className="kpi-card blue"><div className="kpi-label">Total</div><div className="kpi-value">{kpis.total}</div></div>
          <div className="kpi-card green"><div className="kpi-label">Vigentes</div><div className="kpi-value">{kpis.vigentes}</div></div>
          <div className="kpi-card orange"><div className="kpi-label">Por vencer (30d)</div><div className="kpi-value">{kpis.porVencer}</div></div>
          <div className="kpi-card red"><div className="kpi-label">Vencidos</div><div className="kpi-value">{kpis.vencidos}</div></div>
          <div className="kpi-card purple"><div className="kpi-label">Valor vigente</div><div className="kpi-value" style={{fontSize:14}}>{fmtMoney(kpis.valorTotal)}</div></div>
        </div>
      )}

      {/* Alertas de vencimiento */}
      {alertas.length > 0 && (
        <div className="alert-bar">
          <span className="alert-icon">⏰</span>
          <div style={{flex:1}}>
            <div className="alert-title">Contratos próximos a vencer ({alertas.length})</div>
            {alertas.slice(0,5).map(a => {
              const dias = parseInt(a.dias_restantes);
              return (
                <div key={a.id} className="alert-item">
                  <b>{a.numero_contrato}</b> · {a.proveedor_nombre} · {dias < 0 ? `Venció hace ${Math.abs(dias)} días` : `Vence en ${dias} días`}
                </div>
              );
            })}
            {alertas.length > 5 && <div className="alert-item">... y {alertas.length-5} más</div>}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
        {['TODOS','VIGENTE','POR_VENCER','VENCIDO'].map(f=>(
          <button key={f} className={`btn ${filtroEstado===f?'btn-primary':'btn-ghost'}`} style={{fontSize:11}} onClick={()=>setFiltroEstado(f)}>
            {f.replace('_',' ')}
          </button>
        ))}
        {proveedores.length > 0 && (
          <select 
            value={filtroProv} 
            onChange={e=>setFiltroProv(e.target.value)}
            style={{background:G.input,border:`1px solid ${G.inputBorder}`,borderRadius:4,padding:'6px 10px',color:G.text,fontSize:11,outline:'none',maxWidth:240}}
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map(p=><option key={p.id} value={p.id}>{p.razon_social}</option>)}
          </select>
        )}
      </div>

      <div className="search-bar">
        <span>⌕</span>
        <input placeholder="Buscar por número, proveedor u objeto..." value={filtro} onChange={e=>setFiltro(e.target.value)} />
      </div>

      {/* Lista */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Contratos</div>
          <span className="badge badge-gray">{filtrados.length}</span>
        </div>
        {filtrados.length === 0 ? (
          <div className="empty-state">
            {contratos.length === 0 ? (
              proveedores.length === 0 
                ? 'Para crear contratos primero registra al menos un proveedor.'
                : 'Aún no has registrado contratos. Toca "+ Nuevo contrato" para empezar.'
            ) : 'Sin contratos con esos filtros'}
          </div>
        ) : (
          <table className="data-table">
            <thead><tr>
              <th>Número</th>
              <th>Proveedor</th>
              <th>Tipo</th>
              <th>Objeto</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Valor</th>
              <th>Estado</th>
              <th>OTs</th>
              <th></th>
            </tr></thead>
            <tbody>
              {filtrados.map(c => {
                const badge = getEstadoBadge(c);
                return (
                  <tr key={c.id}>
                    <td style={{fontFamily:'IBM Plex Mono',fontWeight:600,color:G.accent,fontSize:11}}>{c.numero_contrato}</td>
                    <td style={{fontWeight:500}}>🏢 {c.proveedor_nombre}<div style={{fontSize:10,color:G.textMuted,fontFamily:'IBM Plex Mono'}}>{c.proveedor_nit}</div></td>
                    <td>{c.tipo ? <span className="badge badge-purple">{c.tipo}</span> : '—'}</td>
                    <td style={{fontSize:11,color:G.textMuted,maxWidth:240,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={c.objeto}>{c.objeto || '—'}</td>
                    <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{formatFecha(c.fecha_inicio)}</td>
                    <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{formatFecha(c.fecha_fin)}</td>
                    <td style={{fontFamily:'IBM Plex Mono',fontSize:11,color:G.accent}}>{fmtMoney(c.valor)}</td>
                    <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                    <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{c.ots_asociadas || 0}</td>
                    <td>
                      <div style={{display:'flex',gap:4}}>
                        <button className="btn btn-ghost btn-icon" onClick={()=>setDetalleCont(c)} title="Ver detalle">◷</button>
                        {rol !== 'Auditor' && (
                          <>
                            <button className="btn btn-ghost btn-icon" onClick={()=>setModalCont(c)} title="Editar">✎</button>
                            {['Admin','SuperAdmin'].includes(rol) && (
                              <button className="btn btn-danger btn-icon" onClick={()=>eliminar(c)} title="Eliminar">✕</button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Botón flotante */}
      <div style={{position:'fixed',bottom:24,right:24,zIndex:50}}>
        {rol !== 'Auditor' && proveedores.length > 0 && (
          <button 
            className="btn btn-primary" 
            style={{boxShadow:'0 4px 16px rgba(0,229,160,0.3)',fontSize:13,padding:'12px 20px'}}
            onClick={()=>setModalCont(false)}
          >
            + Nuevo contrato
          </button>
        )}
      </div>
    </>
  );
}

// ─── MODAL CREAR/EDITAR CONTRATO ─────────────────────────
function ModalContrato({ contrato, proveedores, token, onClose, onSaved }) {
  const esNuevo = !contrato;
  const [form, setForm] = useState({
    numero_contrato: contrato?.numero_contrato||'',
    proveedor_id: contrato?.proveedor_id||'',
    objeto: contrato?.objeto||'',
    tipo: contrato?.tipo||'',
    fecha_inicio: contrato?.fecha_inicio?.slice(0,10)||'',
    fecha_fin: contrato?.fecha_fin?.slice(0,10)||'',
    valor: contrato?.valor||0,
    forma_pago: contrato?.forma_pago||'',
    estado: contrato?.estado||'VIGENTE',
    responsable_cliente: contrato?.responsable_cliente||'',
    responsable_proveedor: contrato?.responsable_proveedor||'',
    documento_url: contrato?.documento_url||'',
    observaciones: contrato?.observaciones||'',
    alerta_vencimiento_dias: contrato?.alerta_vencimiento_dias||30,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const subirDocumento = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10*1024*1024) return alert('Archivo muy grande (máx 10MB)');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', 'biomed_logos');
      const res = await fetch('https://api.cloudinary.com/v1_1/dn4ubmehe/auto/upload', { method:'POST', body:fd });
      const data = await res.json();
      if (data.secure_url) setForm(f=>({...f, documento_url: data.secure_url}));
      else alert('Error al subir: ' + (data.error?.message || 'desconocido'));
    } catch(err) { alert('Error: ' + err.message); }
    setUploading(false);
  };

  const guardar = async () => {
    if (!form.numero_contrato) return alert('Número de contrato obligatorio');
    if (!form.proveedor_id) return alert('Selecciona un proveedor');
    setSaving(true);
    const url = esNuevo ? `${API}/contratos` : `${API}/contratos/${contrato.id}`;
    const res = await fetch(url, {
      method: esNuevo ? 'POST' : 'PUT',
      headers: {'Content-Type':'application/json', Authorization: token},
      body: JSON.stringify(form)
    });
    const data = await res.json();
    setSaving(false);
    if (data.error) return alert(data.error);
    onSaved();
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:780}}>
        <div className="modal-header">
          <div className="modal-title">{esNuevo ? '📄 Nuevo contrato' : '✎ Editar contrato'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Datos básicos */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:8}}>Datos del contrato</div>
            <div className="form-grid">
              <div className="field">
                <label>Número de contrato *</label>
                <input value={form.numero_contrato} onChange={e=>setForm({...form,numero_contrato:e.target.value})} placeholder="CTR-2026-001" />
              </div>
              <div className="field" style={{gridColumn:'2/4'}}>
                <label>Proveedor *</label>
                <select value={form.proveedor_id} onChange={e=>setForm({...form,proveedor_id:e.target.value})}>
                  <option value="">Seleccionar proveedor</option>
                  {proveedores.filter(p=>p.estado==='ACTIVO').map(p=><option key={p.id} value={p.id}>{p.razon_social} ({p.nit||'sin NIT'})</option>)}
                </select>
              </div>
              <div className="field">
                <label>Tipo de contrato</label>
                <select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}>
                  <option value="">Seleccionar</option>
                  {TIPOS_CONTRATO.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Estado</label>
                <select value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>
                  <option value="VIGENTE">Vigente</option>
                  <option value="TERMINADO">Terminado</option>
                  <option value="CANCELADO">Cancelado</option>
                  <option value="SUSPENDIDO">Suspendido</option>
                </select>
              </div>
              <div className="field" style={{gridColumn:'1/4'}}>
                <label>Objeto del contrato</label>
                <textarea value={form.objeto} onChange={e=>setForm({...form,objeto:e.target.value})} placeholder="Ej: Mantenimiento preventivo y correctivo de equipos biomédicos de la UCI Adultos durante el año 2026..." style={{minHeight:60}} />
              </div>
            </div>
          </div>

          {/* Fechas y valor */}
          <div style={{marginBottom:14,padding:14,background:G.input,borderRadius:6,border:`1px solid ${G.inputBorder}`}}>
            <div style={{fontSize:11,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:8}}>📅 Vigencia y valor</div>
            <div className="form-grid">
              <div className="field">
                <label>Fecha de inicio</label>
                <input type="date" value={form.fecha_inicio} onChange={e=>setForm({...form,fecha_inicio:e.target.value})} />
              </div>
              <div className="field">
                <label>Fecha de fin</label>
                <input type="date" value={form.fecha_fin} onChange={e=>setForm({...form,fecha_fin:e.target.value})} />
              </div>
              <div className="field">
                <label>Días alerta antes vencimiento</label>
                <input type="number" min="1" value={form.alerta_vencimiento_dias} onChange={e=>setForm({...form,alerta_vencimiento_dias:parseInt(e.target.value)||30})} />
              </div>
              <div className="field">
                <label>Valor del contrato</label>
                <input type="number" min="0" value={form.valor} onChange={e=>setForm({...form,valor:parseFloat(e.target.value)||0})} />
                {form.valor > 0 && <div style={{fontSize:10,color:G.accent,marginTop:3,fontFamily:'IBM Plex Mono'}}>{fmtMoney(form.valor)}</div>}
              </div>
              <div className="field" style={{gridColumn:'2/4'}}>
                <label>Forma de pago</label>
                <input value={form.forma_pago} onChange={e=>setForm({...form,forma_pago:e.target.value})} placeholder="Ej: 30 días, mensual, contra-entrega" />
              </div>
            </div>
          </div>

          {/* Responsables */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:8}}>👥 Responsables</div>
            <div className="form-grid-2">
              <div className="field">
                <label>Responsable nuestro (interno)</label>
                <input value={form.responsable_cliente} onChange={e=>setForm({...form,responsable_cliente:e.target.value})} placeholder="Quien supervisa el contrato" />
              </div>
              <div className="field">
                <label>Responsable del proveedor</label>
                <input value={form.responsable_proveedor} onChange={e=>setForm({...form,responsable_proveedor:e.target.value})} placeholder="Persona de contacto en el proveedor" />
              </div>
            </div>
          </div>

          {/* Documento adjunto */}
          <div style={{marginBottom:14,padding:14,background:'rgba(167,139,250,0.06)',borderRadius:6,border:'1px solid rgba(167,139,250,0.2)'}}>
            <div style={{fontSize:11,color:'#a78bfa',letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:8}}>📎 Documento del contrato</div>
            {form.documento_url ? (
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <a href={form.documento_url} target="_blank" rel="noopener noreferrer" style={{color:G.accent,fontSize:12,flex:1}}>📄 Ver documento adjunto</a>
                <button className="btn btn-danger" style={{fontSize:11,padding:'6px 10px'}} onClick={()=>setForm({...form,documento_url:''})}>✕ Quitar</button>
              </div>
            ) : (
              <div>
                <input id="doc-upload" type="file" accept=".pdf,.doc,.docx,image/*" onChange={subirDocumento} style={{display:'none'}} />
                <label htmlFor="doc-upload" className="btn btn-purple" style={{cursor:'pointer',fontSize:11,padding:'8px 14px'}}>
                  {uploading ? '⏳ Subiendo...' : '↑ Subir documento (PDF, DOC, imagen)'}
                </label>
                <div style={{fontSize:10,color:G.textMuted,marginTop:6}}>Máx 10MB</div>
              </div>
            )}
          </div>

          {/* Observaciones */}
          <div className="field">
            <label>Observaciones</label>
            <textarea value={form.observaciones} onChange={e=>setForm({...form,observaciones:e.target.value})} placeholder="Notas adicionales, cláusulas especiales..." style={{minHeight:60}} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={saving||uploading}>
            {saving ? 'Guardando...' : (esNuevo ? '+ Crear contrato' : '✓ Guardar')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL DETALLE CONTRATO ──────────────────────────────
function ModalDetalleContrato({ contrato, onClose }) {
  const badge = getEstadoBadge(contrato);
  const dias_restantes = contrato.fecha_fin 
    ? Math.ceil((new Date(contrato.fecha_fin) - new Date()) / (1000*60*60*24))
    : null;

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:680}}>
        <div className="modal-header" style={{borderBottom:`3px solid ${badge.cls==='badge-green'?G.accent:badge.cls==='badge-orange'?G.warning:badge.cls==='badge-red'?G.danger:G.textMuted}`}}>
          <div className="modal-title">📄 {contrato.numero_contrato}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
            <span className={`badge ${badge.cls}`}>{badge.label}</span>
            {contrato.tipo && <span className="badge badge-purple">{contrato.tipo}</span>}
            {dias_restantes !== null && (
              <span className="badge badge-gray">
                {dias_restantes < 0 ? `Venció hace ${Math.abs(dias_restantes)} días` : `${dias_restantes} días restantes`}
              </span>
            )}
          </div>

          <div style={{padding:14,background:G.input,borderRadius:6,marginBottom:14}}>
            <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:6}}>Proveedor</div>
            <div style={{fontSize:14,fontWeight:600}}>🏢 {contrato.proveedor_nombre}</div>
            {contrato.proveedor_nit && <div style={{fontSize:11,color:G.textMuted,fontFamily:'IBM Plex Mono',marginTop:3}}>NIT: {contrato.proveedor_nit}</div>}
            {contrato.proveedor_email && <div style={{fontSize:11,color:G.textMuted,marginTop:3}}>📧 {contrato.proveedor_email}</div>}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,fontSize:13,marginBottom:14}}>
            <div>
              <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:3}}>Inicio</div>
              <div style={{fontFamily:'IBM Plex Mono'}}>{formatFecha(contrato.fecha_inicio)}</div>
            </div>
            <div>
              <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:3}}>Fin</div>
              <div style={{fontFamily:'IBM Plex Mono'}}>{formatFecha(contrato.fecha_fin)}</div>
            </div>
            <div style={{gridColumn:'1/3'}}>
              <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:3}}>Valor</div>
              <div style={{fontSize:18,color:G.accent,fontWeight:600,fontFamily:'IBM Plex Mono'}}>{fmtMoney(contrato.valor)}</div>
              {contrato.forma_pago && <div style={{fontSize:11,color:G.textMuted,marginTop:3}}>Forma de pago: {contrato.forma_pago}</div>}
            </div>
          </div>

          {contrato.objeto && (
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:6}}>Objeto del contrato</div>
              <div style={{fontSize:12,whiteSpace:'pre-wrap',padding:'10px 14px',background:G.input,borderRadius:6}}>{contrato.objeto}</div>
            </div>
          )}

          {(contrato.responsable_cliente || contrato.responsable_proveedor) && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              {contrato.responsable_cliente && (
                <div style={{padding:10,background:G.input,borderRadius:6}}>
                  <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:3}}>Responsable interno</div>
                  <div style={{fontSize:12}}>{contrato.responsable_cliente}</div>
                </div>
              )}
              {contrato.responsable_proveedor && (
                <div style={{padding:10,background:G.input,borderRadius:6}}>
                  <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:3}}>Responsable proveedor</div>
                  <div style={{fontSize:12}}>{contrato.responsable_proveedor}</div>
                </div>
              )}
            </div>
          )}

          {contrato.documento_url && (
            <div style={{padding:'10px 14px',background:'rgba(167,139,250,0.08)',borderRadius:6,marginBottom:14,textAlign:'center'}}>
              <a href={contrato.documento_url} target="_blank" rel="noopener noreferrer" style={{color:'#a78bfa',fontSize:13,fontWeight:600}}>
                📄 Ver documento adjunto del contrato
              </a>
            </div>
          )}

          {contrato.observaciones && (
            <div style={{padding:'10px 14px',background:'rgba(255,179,71,0.08)',borderRadius:6,border:'1px solid rgba(255,179,71,0.2)'}}>
              <div style={{fontSize:10,color:G.warning,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:6}}>📝 Observaciones</div>
              <div style={{fontSize:12,whiteSpace:'pre-wrap'}}>{contrato.observaciones}</div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}