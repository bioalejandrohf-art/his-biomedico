import { useEffect, useState } from 'react';

const API = 'https://his-biomedico-production.up.railway.app';

const G = {
  bg:'#0f1623', card:'#19253a', cardBorder:'#1e2f47',
  accent:'#00e5a0', accentDim:'#00b87a', danger:'#ff4d6d', warning:'#ffb347',
  text:'#e2eaf4', textMuted:'#6b8099', input:'#0f1e30', inputBorder:'#1e3a56',
};

const TIPOS_PROVEEDOR = [
  'Mantenimiento general',
  'Calibración (laboratorio acreditado)',
  'Repuestos / Insumos',
  'Servicio técnico especializado',
  'Distribuidor / Representante',
  'Capacitación',
  'Asesoría / Consultoría',
  'Otro'
];

export default function Proveedores({ token, rol, esSuperAdmin }) {
  const [proveedores, setProveedores] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [modalProv, setModalProv] = useState(null);
  const [detalleProv, setDetalleProv] = useState(null);
  const headers = { Authorization: token };

  const cargar = async () => {
    try {
      const [r, k] = await Promise.all([
        fetch(`${API}/proveedores`, { headers }).then(r => r.json()),
        fetch(`${API}/proveedores/kpis/general`, { headers }).then(r => r.json())
      ]);
      if (Array.isArray(r)) setProveedores(r);
      setKpis(k);
    } catch(e) { console.error(e); }
  };

  useEffect(() => { cargar(); }, []);

  const eliminar = async (p) => {
    if (!window.confirm(`¿Eliminar el proveedor "${p.razon_social}"?`)) return;
    const res = await fetch(`${API}/proveedores/${p.id}`, { method:'DELETE', headers });
    const data = await res.json();
    if (data.error) return alert(data.error);
    cargar();
  };

  const filtrados = proveedores.filter(p => {
    if (filtroEstado !== 'TODOS' && p.estado !== filtroEstado) return false;
    if (filtroTipo !== 'TODOS' && p.tipo !== filtroTipo) return false;
    if (filtro) {
      const q = filtro.toLowerCase();
      return (p.razon_social||'').toLowerCase().includes(q) ||
             (p.nit||'').toLowerCase().includes(q) ||
             (p.contacto_nombre||'').toLowerCase().includes(q) ||
             (p.especialidades||'').toLowerCase().includes(q);
    }
    return true;
  });

  const tiposUsados = [...new Set(proveedores.map(p=>p.tipo).filter(Boolean))];

  return (
    <>
      {modalProv !== null && (
        <ModalProveedor
          proveedor={modalProv || null}
          token={token}
          onClose={() => setModalProv(null)}
          onSaved={() => { cargar(); setModalProv(null); }}
        />
      )}
      {detalleProv && (
        <ModalDetalleProveedor
          proveedor={detalleProv}
          token={token}
          onClose={() => setDetalleProv(null)}
        />
      )}

      {/* KPIs */}
      {kpis && (
        <div className="kpi-grid" style={{gridTemplateColumns:'repeat(3,1fr)',marginBottom:18}}>
          <div className="kpi-card blue"><div className="kpi-label">Total proveedores</div><div className="kpi-value">{kpis.total}</div></div>
          <div className="kpi-card green"><div className="kpi-label">Activos</div><div className="kpi-value">{kpis.activos}</div></div>
          <div className="kpi-card gray"><div className="kpi-label">Inactivos</div><div className="kpi-value">{kpis.inactivos}</div></div>
        </div>
      )}

      {/* Filtros */}
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
        {['TODOS','ACTIVO','INACTIVO'].map(f=>(
          <button key={f} className={`btn ${filtroEstado===f?'btn-primary':'btn-ghost'}`} style={{fontSize:11}} onClick={()=>setFiltroEstado(f)}>
            {f}
          </button>
        ))}
        {tiposUsados.length > 0 && (
          <select 
            value={filtroTipo} 
            onChange={e=>setFiltroTipo(e.target.value)}
            style={{background:G.input,border:`1px solid ${G.inputBorder}`,borderRadius:4,padding:'6px 10px',color:G.text,fontSize:11,outline:'none'}}
          >
            <option value="TODOS">Todos los tipos</option>
            {tiposUsados.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      <div className="search-bar">
        <span>⌕</span>
        <input placeholder="Buscar por nombre, NIT, contacto, especialidad..." value={filtro} onChange={e=>setFiltro(e.target.value)} />
      </div>

      {/* Lista */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Proveedores</div>
          <span className="badge badge-gray">{filtrados.length}</span>
        </div>
        {filtrados.length === 0 ? (
          <div className="empty-state">
            {proveedores.length === 0 ? 'Aún no has registrado proveedores. Toca "+ Nuevo proveedor" para empezar.' : 'Sin proveedores con esos filtros'}
          </div>
        ) : (
          <table className="data-table">
            <thead><tr>
              <th>Razón social</th>
              <th>NIT</th>
              <th>Tipo</th>
              <th>Contacto</th>
              <th>Teléfono</th>
              <th>Ciudad</th>
              <th>Contratos</th>
              <th>OTs</th>
              <th>Estado</th>
              {esSuperAdmin && <th>Institución</th>}
              <th></th>
            </tr></thead>
            <tbody>
              {filtrados.map(p => (
                <tr key={p.id}>
                  <td style={{fontWeight:500}}>🏢 {p.razon_social}</td>
                  <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{p.nit||'—'}</td>
                  <td>{p.tipo ? <span className="badge badge-purple">{p.tipo}</span> : <span style={{color:G.textMuted,fontSize:11}}>—</span>}</td>
                  <td style={{fontSize:12}}>
                    {p.contacto_nombre || '—'}
                    {p.contacto_cargo && <div style={{fontSize:10,color:G.textMuted}}>{p.contacto_cargo}</div>}
                  </td>
                  <td style={{fontFamily:'IBM Plex Mono',fontSize:11,color:G.textMuted}}>
                    {p.telefono || p.celular || '—'}
                  </td>
                  <td style={{color:G.textMuted,fontSize:12}}>{p.ciudad || '—'}</td>
                  <td><span className={`badge ${parseInt(p.contratos_vigentes)>0?'badge-green':'badge-gray'}`}>{p.contratos_vigentes || 0}</span></td>
                  <td style={{fontFamily:'IBM Plex Mono',fontSize:11,color:G.accent}}>{p.ots_realizadas || 0}</td>
                  <td><span className={`badge ${p.estado==='ACTIVO'?'badge-green':'badge-gray'}`}>{p.estado}</span></td>
                  {esSuperAdmin && <td style={{fontSize:11,color:G.textMuted}}>{p.institucion_nombre||'—'}</td>}
                  <td>
                    <div style={{display:'flex',gap:4}}>
                      <button className="btn btn-ghost btn-icon" onClick={()=>setDetalleProv(p)} title="Ver detalle">◷</button>
                      {rol !== 'Auditor' && (
                        <>
                          <button className="btn btn-ghost btn-icon" onClick={()=>setModalProv(p)} title="Editar">✎</button>
                          {['Admin','SuperAdmin'].includes(rol) && (
                            <button className="btn btn-danger btn-icon" onClick={()=>eliminar(p)} title="Eliminar">✕</button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Botón flotante para crear (visible siempre) */}
      <div style={{position:'fixed',bottom:24,right:24,zIndex:50}}>
        {rol !== 'Auditor' && (
          <button 
            className="btn btn-primary" 
            style={{boxShadow:'0 4px 16px rgba(0,229,160,0.3)',fontSize:13,padding:'12px 20px'}}
            onClick={()=>setModalProv(false)}
          >
            + Nuevo proveedor
          </button>
        )}
      </div>
    </>
  );
}

// ─── MODAL CREAR/EDITAR PROVEEDOR ─────────────────────────
function ModalProveedor({ proveedor, token, onClose, onSaved }) {
  const esNuevo = !proveedor;
  const [form, setForm] = useState({
    razon_social: proveedor?.razon_social||'',
    nit: proveedor?.nit||'',
    tipo: proveedor?.tipo||'',
    contacto_nombre: proveedor?.contacto_nombre||'',
    contacto_cargo: proveedor?.contacto_cargo||'',
    telefono: proveedor?.telefono||'',
    celular: proveedor?.celular||'',
    email: proveedor?.email||'',
    direccion: proveedor?.direccion||'',
    ciudad: proveedor?.ciudad||'',
    pais: proveedor?.pais||'Colombia',
    sitio_web: proveedor?.sitio_web||'',
    especialidades: proveedor?.especialidades||'',
    certificaciones: proveedor?.certificaciones||'',
    observaciones: proveedor?.observaciones||'',
    estado: proveedor?.estado||'ACTIVO',
  });
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    if (!form.razon_social) return alert('Razón social obligatoria');
    setSaving(true);
    const url = esNuevo ? `${API}/proveedores` : `${API}/proveedores/${proveedor.id}`;
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
          <div className="modal-title">{esNuevo ? '🏢 Nuevo proveedor' : '✎ Editar proveedor'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Datos generales */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:8}}>Datos generales</div>
            <div className="form-grid">
              <div className="field" style={{gridColumn:'1/3'}}>
                <label>Razón social *</label>
                <input value={form.razon_social} onChange={e=>setForm({...form,razon_social:e.target.value})} placeholder="Ej: Calibraciones Médicas SAS" />
              </div>
              <div className="field">
                <label>NIT</label>
                <input value={form.nit} onChange={e=>setForm({...form,nit:e.target.value})} placeholder="900123456-1" />
              </div>
              <div className="field">
                <label>Tipo de proveedor</label>
                <select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}>
                  <option value="">Seleccionar</option>
                  {TIPOS_PROVEEDOR.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Estado</label>
                <select value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                </select>
              </div>
              <div className="field">
                <label>Sitio web</label>
                <input value={form.sitio_web} onChange={e=>setForm({...form,sitio_web:e.target.value})} placeholder="https://..." />
              </div>
            </div>
          </div>

          {/* Contacto */}
          <div style={{marginBottom:14,padding:14,background:G.input,borderRadius:6,border:`1px solid ${G.inputBorder}`}}>
            <div style={{fontSize:11,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:8}}>👤 Contacto principal</div>
            <div className="form-grid">
              <div className="field">
                <label>Nombre</label>
                <input value={form.contacto_nombre} onChange={e=>setForm({...form,contacto_nombre:e.target.value})} />
              </div>
              <div className="field">
                <label>Cargo</label>
                <input value={form.contacto_cargo} onChange={e=>setForm({...form,contacto_cargo:e.target.value})} placeholder="Ej: Gerente comercial" />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
              </div>
              <div className="field">
                <label>Teléfono fijo</label>
                <input value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})} />
              </div>
              <div className="field">
                <label>Celular</label>
                <input value={form.celular} onChange={e=>setForm({...form,celular:e.target.value})} />
              </div>
            </div>
          </div>

          {/* Ubicación */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:8}}>📍 Ubicación</div>
            <div className="form-grid">
              <div className="field" style={{gridColumn:'1/3'}}>
                <label>Dirección</label>
                <input value={form.direccion} onChange={e=>setForm({...form,direccion:e.target.value})} />
              </div>
              <div className="field">
                <label>Ciudad</label>
                <input value={form.ciudad} onChange={e=>setForm({...form,ciudad:e.target.value})} />
              </div>
              <div className="field">
                <label>País</label>
                <input value={form.pais} onChange={e=>setForm({...form,pais:e.target.value})} />
              </div>
            </div>
          </div>

          {/* Información profesional */}
          <div style={{marginBottom:14,padding:14,background:'rgba(167,139,250,0.06)',borderRadius:6,border:'1px solid rgba(167,139,250,0.2)'}}>
            <div style={{fontSize:11,color:'#a78bfa',letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:8}}>🎓 Información profesional</div>
            <div className="field">
              <label>Especialidades / Servicios que ofrece</label>
              <textarea 
                value={form.especialidades} 
                onChange={e=>setForm({...form,especialidades:e.target.value})}
                placeholder="Ej: Calibración de bombas de infusión, ventiladores, monitores. Cuenta con personal certificado en metrología..."
                style={{minHeight:60}}
              />
            </div>
            <div className="field" style={{marginTop:10}}>
              <label>Certificaciones (ISO, ONAC, etc.)</label>
              <textarea 
                value={form.certificaciones} 
                onChange={e=>setForm({...form,certificaciones:e.target.value})}
                placeholder="Ej: ISO 9001:2015, ONAC LAB-145, ICONTEC..."
                style={{minHeight:50}}
              />
            </div>
            <div className="field" style={{marginTop:10}}>
              <label>Observaciones</label>
              <textarea 
                value={form.observaciones} 
                onChange={e=>setForm({...form,observaciones:e.target.value})}
                placeholder="Notas internas, calidad del servicio, recomendaciones..."
                style={{minHeight:50}}
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={saving}>
            {saving ? 'Guardando...' : (esNuevo ? '+ Crear proveedor' : '✓ Guardar')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL DETALLE PROVEEDOR ──────────────────────────────
function ModalDetalleProveedor({ proveedor, token, onClose }) {
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:680}}>
        <div className="modal-header">
          <div className="modal-title">🏢 {proveedor.razon_social}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
            <span className={`badge ${proveedor.estado==='ACTIVO'?'badge-green':'badge-gray'}`}>{proveedor.estado}</span>
            {proveedor.tipo && <span className="badge badge-purple">{proveedor.tipo}</span>}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,fontSize:13,marginBottom:14}}>
            {proveedor.nit && <div><b style={{color:G.textMuted}}>NIT:</b> <span style={{fontFamily:'IBM Plex Mono'}}>{proveedor.nit}</span></div>}
            {proveedor.ciudad && <div><b style={{color:G.textMuted}}>Ciudad:</b> {proveedor.ciudad}{proveedor.pais && `, ${proveedor.pais}`}</div>}
            {proveedor.sitio_web && <div style={{gridColumn:'1/3'}}><b style={{color:G.textMuted}}>Web:</b> <a href={proveedor.sitio_web} target="_blank" rel="noopener noreferrer" style={{color:G.accent}}>{proveedor.sitio_web}</a></div>}
          </div>

          {(proveedor.contacto_nombre || proveedor.email || proveedor.telefono) && (
            <div style={{padding:14,background:G.input,borderRadius:6,marginBottom:14}}>
              <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:8}}>Contacto</div>
              {proveedor.contacto_nombre && <div style={{marginBottom:4}}>👤 <b>{proveedor.contacto_nombre}</b>{proveedor.contacto_cargo && <span style={{color:G.textMuted,marginLeft:8}}>· {proveedor.contacto_cargo}</span>}</div>}
              {proveedor.email && <div style={{marginBottom:4}}>📧 <a href={`mailto:${proveedor.email}`} style={{color:G.accent}}>{proveedor.email}</a></div>}
              {proveedor.telefono && <div style={{marginBottom:4}}>☎ {proveedor.telefono}</div>}
              {proveedor.celular && <div>📱 <a href={`tel:${proveedor.celular}`} style={{color:G.accent}}>{proveedor.celular}</a></div>}
            </div>
          )}

          {proveedor.direccion && (
            <div style={{marginBottom:14,padding:'10px 14px',background:G.input,borderRadius:6,fontSize:12}}>
              📍 {proveedor.direccion}
            </div>
          )}

          {proveedor.especialidades && (
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:6}}>Especialidades</div>
              <div style={{fontSize:12,whiteSpace:'pre-wrap'}}>{proveedor.especialidades}</div>
            </div>
          )}

          {proveedor.certificaciones && (
            <div style={{marginBottom:14,padding:'10px 14px',background:'rgba(0,229,160,0.06)',borderRadius:6,border:'1px solid rgba(0,229,160,0.2)'}}>
              <div style={{fontSize:10,color:G.accent,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:6}}>🎓 Certificaciones</div>
              <div style={{fontSize:12,whiteSpace:'pre-wrap'}}>{proveedor.certificaciones}</div>
            </div>
          )}

          {proveedor.observaciones && (
            <div style={{padding:'10px 14px',background:'rgba(255,179,71,0.06)',borderRadius:6,border:'1px solid rgba(255,179,71,0.2)'}}>
              <div style={{fontSize:10,color:G.warning,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:6}}>📝 Observaciones</div>
              <div style={{fontSize:12,whiteSpace:'pre-wrap'}}>{proveedor.observaciones}</div>
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