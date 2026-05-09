import { useEffect, useState } from 'react';

const API = 'https://his-biomedico-production.up.railway.app';

const G = {
  bg:'#0f1623', card:'#19253a', cardBorder:'#1e2f47',
  accent:'#00e5a0', accentDim:'#00b87a', danger:'#ff4d6d', warning:'#ffb347',
  text:'#e2eaf4', textMuted:'#6b8099', input:'#0f1e30', inputBorder:'#1e3a56',
};

const formatFecha = (f) => f ? new Date(f).toLocaleDateString('es-CO',{year:'numeric',month:'short',day:'2-digit'}) : '—';
const formatFechaHora = (f) => f ? new Date(f).toLocaleString('es-CO',{year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—';

export default function Rondas({ token, equipos, rol }) {
  const [vista, setVista] = useState('lista'); // 'lista' | 'detalle' | 'nueva'
  const [rondas, setRondas] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [rondaActiva, setRondaActiva] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const headers = { Authorization: token };

  const cargarRondas = async () => {
    try {
      const [r, k] = await Promise.all([
        fetch(`${API}/rondas`, { headers }).then(r => r.json()),
        fetch(`${API}/rondas/kpis/general`, { headers }).then(r => r.json())
      ]);
      if (Array.isArray(r)) setRondas(r);
      setKpis(k);
    } catch(e) { console.error(e); }
  };

  useEffect(() => { cargarRondas(); }, []);

  const verDetalle = async (id) => {
    try {
      const res = await fetch(`${API}/rondas/${id}`, { headers });
      const data = await res.json();
      setRondaActiva(data);
      setVista('detalle');
    } catch(e) { console.error(e); }
  };

  const eliminarRonda = async (id) => {
    if (!window.confirm('¿Eliminar esta ronda? Esta acción no se puede deshacer.')) return;
    await fetch(`${API}/rondas/${id}`, { method:'DELETE', headers });
    cargarRondas();
  };

  const rondasFiltradas = filtroEstado==='TODOS' ? rondas : rondas.filter(r=>r.estado===filtroEstado);

  return (
    <>
      {vista === 'lista' && (
        <>
          {/* KPIs */}
          {kpis && (
            <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:18}}>
              <div className="kpi-card blue"><div className="kpi-label">Total rondas</div><div className="kpi-value">{kpis.total}</div></div>
              <div className="kpi-card orange"><div className="kpi-label">En progreso</div><div className="kpi-value">{kpis.enProgreso}</div></div>
              <div className="kpi-card green"><div className="kpi-label">Finalizadas</div><div className="kpi-value">{kpis.finalizadas}</div></div>
              <div className={`kpi-card ${kpis.promedioCumplimiento>=80?'green':kpis.promedioCumplimiento>=60?'orange':'red'}`}><div className="kpi-label">Cumplimiento prom.</div><div className="kpi-value">{Math.round(kpis.promedioCumplimiento)}%</div></div>
            </div>
          )}

          {/* Header con botón nueva */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:10}}>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {['TODOS','EN_PROGRESO','FINALIZADA'].map(f=>(
                <button key={f} className={`btn ${filtroEstado===f?'btn-primary':'btn-ghost'}`} style={{fontSize:11}} onClick={()=>setFiltroEstado(f)}>{f.replace('_',' ')}</button>
              ))}
            </div>
            {rol !== 'Auditor' && (
              <button className="btn btn-primary" onClick={()=>setVista('nueva')}>+ Iniciar ronda</button>
            )}
          </div>

          {/* Lista de rondas */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Historial de rondas</div>
              <span className="badge badge-gray">{rondasFiltradas.length}</span>
            </div>
            {rondasFiltradas.length === 0 ? (
              <div className="empty-state">
                {rondas.length === 0 ? 'Aún no has realizado rondas. Toca "Iniciar ronda" para empezar.' : 'Sin rondas con ese estado'}
              </div>
            ) : (
              <table className="data-table">
                <thead><tr>
                  <th>Número</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Servicio</th>
                  <th>Responsable</th>
                  <th>Equipos</th>
                  <th>Cumplimiento</th>
                  <th>Estado</th>
                  <th></th>
                </tr></thead>
                <tbody>
                  {rondasFiltradas.map(r => (
                    <tr key={r.id}>
                      <td style={{fontFamily:'IBM Plex Mono',fontSize:11,fontWeight:600,color:G.accent}}>{r.numero_ronda}</td>
                      <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{formatFechaHora(r.fecha_inicio)}</td>
                      <td style={{fontFamily:'IBM Plex Mono',fontSize:11,color:G.textMuted}}>{r.fecha_fin?formatFechaHora(r.fecha_fin):'—'}</td>
                      <td>{r.servicio_filtro?<span className="badge badge-gray">{r.servicio_filtro}</span>:<span style={{color:G.textMuted,fontSize:11}}>Todos</span>}</td>
                      <td style={{fontSize:12}}>{r.responsable_nombre||'—'}</td>
                      <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{r.total_equipos}</td>
                      <td><span className={`badge ${r.porcentaje_cumplimiento>=80?'badge-green':r.porcentaje_cumplimiento>=50?'badge-orange':'badge-red'}`}>{Math.round(r.porcentaje_cumplimiento||0)}%</span></td>
                      <td><span className={`badge ${r.estado==='FINALIZADA'?'badge-green':'badge-orange'}`}>{r.estado.replace('_',' ')}</span></td>
                      <td>
                        <div style={{display:'flex',gap:4}}>
                          <button className="btn btn-ghost btn-icon" onClick={()=>verDetalle(r.id)} title="Ver detalle">◷</button>
                          {rol!=='Auditor' && r.estado==='EN_PROGRESO' && (
                            <button className="btn btn-primary btn-icon" onClick={()=>verDetalle(r.id)} title="Continuar ronda">▶</button>
                          )}
                          {['Admin','SuperAdmin'].includes(rol) && (
                            <button className="btn btn-danger btn-icon" onClick={()=>eliminarRonda(r.id)}>✕</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {vista === 'nueva' && (
        <NuevaRonda 
          token={token}
          equipos={equipos}
          onCancel={()=>setVista('lista')}
          onCreated={(ronda)=>{
            verDetalle(ronda.id);
            cargarRondas();
          }}
        />
      )}

      {vista === 'detalle' && rondaActiva && (
        <DetalleRonda
          ronda={rondaActiva}
          token={token}
          rol={rol}
          onBack={()=>{ setVista('lista'); setRondaActiva(null); cargarRondas(); }}
          onUpdate={()=>verDetalle(rondaActiva.id)}
        />
      )}
    </>
  );
}

// ─── COMPONENTE NUEVA RONDA ────────────────────────────────────
function NuevaRonda({ token, equipos, onCancel, onCreated }) {
  const [servicio, setServicio] = useState('');
  const [obs, setObs] = useState('');
  const [creando, setCreando] = useState(false);
  
  const servicios = [...new Set(equipos.map(e=>e.servicio).filter(Boolean))].sort();
  const equiposFiltrados = servicio ? equipos.filter(e=>e.servicio===servicio) : equipos;
  const equiposActivos = equiposFiltrados.filter(e=>e.estado!=='Baja');

  const iniciar = async () => {
    if (equiposActivos.length === 0) {
      return alert('No hay equipos activos para esta ronda');
    }
    if (!window.confirm(`¿Iniciar ronda con ${equiposActivos.length} equipos?`)) return;
    
    setCreando(true);
    try {
      const res = await fetch(`${API}/rondas`, {
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:token},
        body:JSON.stringify({servicio_filtro: servicio||null, observaciones_generales: obs||null})
      });
      const data = await res.json();
      if (data.error) { alert(data.error); setCreando(false); return; }
      onCreated(data);
    } catch(e) { alert('Error: '+e.message); }
    setCreando(false);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">📋 Configurar nueva ronda de inventario</div>
        <button className="btn btn-ghost btn-icon" onClick={onCancel}>✕</button>
      </div>
      <div className="panel-body">
        <div style={{padding:14,background:'rgba(0,229,160,0.06)',border:'1px solid rgba(0,229,160,0.2)',borderRadius:6,fontSize:12,color:G.text,marginBottom:18}}>
          💡 Una ronda de inventario es un chequeo físico de los equipos. Selecciona si quieres rondar todos los equipos o solo un servicio. Luego ve equipo por equipo verificando si está presente.
        </div>

        <div className="form-grid-2">
          <div className="field">
            <label>Servicio (opcional)</label>
            <select value={servicio} onChange={e=>setServicio(e.target.value)}>
              <option value="">Todos los equipos ({equiposActivos.length})</option>
              {servicios.map(s=>{
                const count = equipos.filter(e=>e.servicio===s && e.estado!=='Baja').length;
                return <option key={s} value={s}>{s} ({count} equipos)</option>;
              })}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Observaciones generales (opcional)</label>
          <textarea value={obs} onChange={e=>setObs(e.target.value)} placeholder="Ej: Ronda mensual de UCI, verificación post-mantenimiento, etc." />
        </div>

        <div style={{marginTop:14,padding:14,background:G.input,borderRadius:6,fontSize:13}}>
          <div style={{color:G.textMuted,fontSize:11,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:6}}>Resumen</div>
          <div>Equipos a verificar: <b style={{color:G.accent,fontFamily:'IBM Plex Mono',fontSize:18}}>{equiposActivos.length}</b></div>
          <div style={{fontSize:11,color:G.textMuted,marginTop:4}}>
            {servicio ? `Solo del servicio: ${servicio}` : 'Todos los servicios'}
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" onClick={iniciar} disabled={creando||equiposActivos.length===0}>
          {creando?'Iniciando...':`▶ Iniciar ronda (${equiposActivos.length})`}
        </button>
      </div>
    </div>
  );
}

// ─── COMPONENTE DETALLE DE RONDA ───────────────────────────────
function DetalleRonda({ ronda, token, rol, onBack, onUpdate }) {
  const [filtroItem, setFiltroItem] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [itemEditando, setItemEditando] = useState(null);
  const [obs, setObs] = useState(ronda.observaciones_generales || '');
  const [finalizando, setFinalizando] = useState(false);

  const enProgreso = ronda.estado === 'EN_PROGRESO';
  const headers = { Authorization: token };

  const items = ronda.items || [];
  const itemsFiltrados = items.filter(it => {
    if (filtroItem !== 'TODOS' && it.estado !== filtroItem) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (it.equipo_nombre||'').toLowerCase().includes(q) ||
             (it.serie||'').toLowerCase().includes(q) ||
             (it.activo_fijo||'').toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    pendientes: items.filter(i=>i.estado==='PENDIENTE').length,
    presentes: items.filter(i=>i.estado==='PRESENTE').length,
    noEncontrados: items.filter(i=>i.estado==='NO_ENCONTRADO').length,
    conObs: items.filter(i=>i.estado==='CON_OBSERVACION').length,
  };

  const actualizarItem = async (item, estado, servicio_real, observaciones) => {
    try {
      await fetch(`${API}/rondas/${ronda.id}/item/${item.equipo_id}`, {
        method:'PUT',
        headers:{'Content-Type':'application/json',Authorization:token},
        body:JSON.stringify({estado, servicio_real, observaciones})
      });
      onUpdate();
      setItemEditando(null);
    } catch(e) { alert('Error: '+e.message); }
  };

  const marcarRapido = async (item, estado) => {
    if (estado === 'PRESENTE') {
      // Si está presente y en su servicio correcto, marcar directo
      await actualizarItem(item, 'PRESENTE', null, null);
    } else {
      // Para otros estados, abrir el modal para detallar
      setItemEditando({...item, estadoNuevo: estado});
    }
  };

  const finalizarRonda = async () => {
    if (stats.pendientes > 0) {
      if (!window.confirm(`Aún hay ${stats.pendientes} equipos sin chequear. ¿Finalizar de todas formas?`)) return;
    } else {
      if (!window.confirm('¿Finalizar ronda?')) return;
    }
    setFinalizando(true);
    await fetch(`${API}/rondas/${ronda.id}/finalizar`, {
      method:'PUT',
      headers:{'Content-Type':'application/json',Authorization:token},
      body:JSON.stringify({observaciones_generales: obs})
    });
    setFinalizando(false);
    onBack();
  };

  const exportarPDF = () => {
    const w = window.open('', '_blank');
    if (!w) return alert('Permite ventanas emergentes');
    const fechaHoy = new Date().toLocaleDateString('es-CO');
    const logoHtml = ronda.logo_url ? `<img src="${ronda.logo_url}" style="width:70px;height:70px;object-fit:contain"/>` : '🏥';

    const filasItems = items.map((it, i) => {
      const estadoColor = it.estado==='PRESENTE'?'#d1fae5':it.estado==='NO_ENCONTRADO'?'#fee2e2':it.estado==='CON_OBSERVACION'?'#fef3c7':'#f3f4f6';
      const estadoTexto = it.estado==='PRESENTE'?'✓ Presente':it.estado==='NO_ENCONTRADO'?'✗ No encontrado':it.estado==='CON_OBSERVACION'?'⚠ Con observación':'⏳ Pendiente';
      return `
        <tr style="background:${estadoColor}">
          <td style="text-align:center">${i+1}</td>
          <td>${it.activo_fijo||'—'}</td>
          <td>${it.equipo_nombre||''}</td>
          <td>${it.marca||''} ${it.modelo||''}</td>
          <td>${it.serie||'—'}</td>
          <td>${it.servicio_registrado||'—'}</td>
          <td>${it.servicio_real||'—'}</td>
          <td style="font-weight:bold">${estadoTexto}</td>
          <td>${it.observaciones||'—'}</td>
        </tr>
      `;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ronda ${ronda.numero_ronda}</title>
    <style>
      @page { size: A4 landscape; margin: 8mm; }
      body { font-family: Arial,sans-serif; font-size:9px; color:#000; margin:0; padding:0; }
      .header { display:flex; align-items:center; gap:14px; padding:12px; background:#0a2342; color:#fff; margin-bottom:10px; border-radius:4px; }
      .header h1 { font-size:18px; margin:0; }
      .header .meta { font-size:10px; margin-top:3px; opacity:0.9; }
      .resumen { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:12px; }
      .kpi { padding:10px; border-radius:4px; text-align:center; }
      .kpi-num { font-size:20px; font-weight:bold; }
      .kpi-label { font-size:9px; text-transform:uppercase; opacity:0.8; }
      table.items { border-collapse:collapse; width:100%; }
      table.items th, table.items td { border:1px solid #999; padding:4px 5px; font-size:8.5px; vertical-align:middle; }
      table.items th { background:#0a2342; color:#fff; font-size:9px; padding:6px 4px; }
    </style></head><body>
    <div class="header">
      <div style="font-size:32px">${logoHtml}</div>
      <div style="flex:1">
        <h1>RONDA DE INVENTARIO ${ronda.numero_ronda}</h1>
        <div class="meta">${ronda.institucion_nombre||'—'} · ${ronda.servicio_filtro||'Todos los servicios'}</div>
        <div class="meta">Inicio: ${formatFechaHora(ronda.fecha_inicio)} · ${ronda.fecha_fin?'Fin: '+formatFechaHora(ronda.fecha_fin):'En progreso'}</div>
        <div class="meta">Responsable: ${ronda.responsable_nombre||'—'}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:36px;font-weight:bold;color:#00e5a0">${Math.round(ronda.porcentaje_cumplimiento||0)}%</div>
        <div style="font-size:10px;opacity:0.9">Cumplimiento</div>
      </div>
    </div>

    <div class="resumen">
      <div class="kpi" style="background:#dbeafe;color:#1e40af"><div class="kpi-num">${ronda.total_equipos}</div><div class="kpi-label">Total equipos</div></div>
      <div class="kpi" style="background:#d1fae5;color:#065f46"><div class="kpi-num">${stats.presentes}</div><div class="kpi-label">Presentes</div></div>
      <div class="kpi" style="background:#fee2e2;color:#991b1b"><div class="kpi-num">${stats.noEncontrados}</div><div class="kpi-label">No encontrados</div></div>
      <div class="kpi" style="background:#fef3c7;color:#92400e"><div class="kpi-num">${stats.conObs}</div><div class="kpi-label">Con observación</div></div>
    </div>

    ${ronda.observaciones_generales?`<div style="padding:8px 12px;background:#f3f4f6;border-radius:4px;margin-bottom:10px;font-size:10px"><b>Observaciones:</b> ${ronda.observaciones_generales}</div>`:''}

    <table class="items">
      <thead><tr>
        <th>#</th><th>A. Fijo</th><th>Equipo</th><th>Marca/Modelo</th><th>Serie</th>
        <th>Servicio registrado</th><th>Servicio real</th><th>Estado</th><th>Observaciones</th>
      </tr></thead>
      <tbody>${filasItems}</tbody>
    </table>

    <div style="margin-top:12px;font-size:8px;color:#666;text-align:center">
      Generado: ${fechaHoy} · Total equipos chequeados: ${stats.presentes+stats.noEncontrados+stats.conObs}/${ronda.total_equipos}
    </div>
    <script>window.onload=()=>setTimeout(()=>window.print(),600);</script>
    </body></html>`;
    
    w.document.write(html);
    w.document.close();
  };

  return (
    <>
      {/* Header de la ronda */}
      <div className="panel" style={{padding:14,marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <div>
            <button className="btn btn-ghost" style={{fontSize:11,marginBottom:8}} onClick={onBack}>← Volver al historial</button>
            <div style={{fontSize:18,fontWeight:600,color:G.accent,fontFamily:'IBM Plex Mono'}}>{ronda.numero_ronda}</div>
            <div style={{fontSize:11,color:G.textMuted,marginTop:2}}>
              {ronda.servicio_filtro||'Todos los servicios'} · Iniciada: {formatFechaHora(ronda.fecha_inicio)}
            </div>
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <button className="btn btn-orange" onClick={exportarPDF} style={{fontSize:11}}>📄 Exportar PDF</button>
            {enProgreso && rol!=='Auditor' && (
              <button className="btn btn-primary" onClick={finalizarRonda} disabled={finalizando} style={{fontSize:11}}>
                {finalizando?'Finalizando...':'✓ Finalizar ronda'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPIs de la ronda */}
      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(5,1fr)',marginBottom:14}}>
        <div className="kpi-card blue"><div className="kpi-label">Total</div><div className="kpi-value">{ronda.total_equipos}</div></div>
        <div className="kpi-card gray"><div className="kpi-label">Pendientes</div><div className="kpi-value">{stats.pendientes}</div></div>
        <div className="kpi-card green"><div className="kpi-label">Presentes</div><div className="kpi-value">{stats.presentes}</div></div>
        <div className="kpi-card red"><div className="kpi-label">No encontrados</div><div className="kpi-value">{stats.noEncontrados}</div></div>
        <div className="kpi-card orange"><div className="kpi-label">Con observación</div><div className="kpi-value">{stats.conObs}</div></div>
      </div>

      {/* Filtros */}
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
        {[
          {id:'TODOS',label:'Todos'},
          {id:'PENDIENTE',label:'⏳ Pendientes'},
          {id:'PRESENTE',label:'✓ Presentes'},
          {id:'NO_ENCONTRADO',label:'✗ No encontrados'},
          {id:'CON_OBSERVACION',label:'⚠ Con observación'},
        ].map(f=>(
          <button key={f.id} className={`btn ${filtroItem===f.id?'btn-primary':'btn-ghost'}`} style={{fontSize:11}} onClick={()=>setFiltroItem(f.id)}>{f.label}</button>
        ))}
      </div>

      <div className="search-bar">
        <span>⌕</span>
        <input placeholder="Buscar por nombre, serie o activo fijo..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} />
      </div>

      {/* Lista de equipos */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Equipos a verificar</div>
          <span className="badge badge-gray">{itemsFiltrados.length}</span>
        </div>
        {itemsFiltrados.length === 0 ? (
          <div className="empty-state">Sin equipos con ese filtro</div>
        ) : (
          <div style={{padding:8}}>
            {itemsFiltrados.map(it => {
              const colorEstado = it.estado==='PRESENTE'?G.accent:it.estado==='NO_ENCONTRADO'?G.danger:it.estado==='CON_OBSERVACION'?G.warning:G.textMuted;
              return (
                <div key={it.equipo_id} style={{
                  background:G.input,
                  borderLeft:`3px solid ${colorEstado}`,
                  padding:'10px 14px',
                  marginBottom:6,
                  borderRadius:4,
                  display:'flex',
                  justifyContent:'space-between',
                  alignItems:'center',
                  gap:10,
                  flexWrap:'wrap'
                }}>
                  <div style={{flex:1,minWidth:200}}>
                    <div style={{fontWeight:600,fontSize:13}}>{it.equipo_nombre}</div>
                    <div style={{fontSize:10,color:G.textMuted,marginTop:2,fontFamily:'IBM Plex Mono'}}>
                      {it.activo_fijo&&`AF: ${it.activo_fijo} · `}
                      Serie: {it.serie||'—'} · {it.marca} {it.modelo}
                    </div>
                    <div style={{fontSize:10,color:G.textMuted,marginTop:2}}>
                      Servicio: <b>{it.servicio_registrado||'—'}</b>
                      {it.servicio_real && it.servicio_real !== it.servicio_registrado && (
                        <span style={{color:G.warning}}> → Encontrado en: <b>{it.servicio_real}</b></span>
                      )}
                    </div>
                    {it.observaciones && (
                      <div style={{fontSize:10,color:G.warning,marginTop:3,fontStyle:'italic'}}>⚠ {it.observaciones}</div>
                    )}
                  </div>
                  
                  {enProgreso && rol!=='Auditor' ? (
                    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                      <button onClick={()=>marcarRapido(it,'PRESENTE')} title="Presente" style={{
                        background:it.estado==='PRESENTE'?G.accent:'transparent',
                        color:it.estado==='PRESENTE'?'#0a1520':G.accent,
                        border:`1px solid ${G.accent}`,
                        borderRadius:4,padding:'6px 10px',fontSize:11,cursor:'pointer',fontWeight:600
                      }}>✓</button>
                      <button onClick={()=>marcarRapido(it,'NO_ENCONTRADO')} title="No encontrado" style={{
                        background:it.estado==='NO_ENCONTRADO'?G.danger:'transparent',
                        color:it.estado==='NO_ENCONTRADO'?'#fff':G.danger,
                        border:`1px solid ${G.danger}`,
                        borderRadius:4,padding:'6px 10px',fontSize:11,cursor:'pointer',fontWeight:600
                      }}>✗</button>
                      <button onClick={()=>marcarRapido(it,'CON_OBSERVACION')} title="Con observación" style={{
                        background:it.estado==='CON_OBSERVACION'?G.warning:'transparent',
                        color:it.estado==='CON_OBSERVACION'?'#0a1520':G.warning,
                        border:`1px solid ${G.warning}`,
                        borderRadius:4,padding:'6px 10px',fontSize:11,cursor:'pointer',fontWeight:600
                      }}>⚠</button>
                      <button onClick={()=>setItemEditando(it)} className="btn btn-ghost btn-icon" title="Editar detalle">✎</button>
                    </div>
                  ) : (
                    <span className={`badge ${it.estado==='PRESENTE'?'badge-green':it.estado==='NO_ENCONTRADO'?'badge-red':it.estado==='CON_OBSERVACION'?'badge-orange':'badge-gray'}`}>
                      {it.estado==='PRESENTE'?'✓ PRESENTE':it.estado==='NO_ENCONTRADO'?'✗ NO ENCONTRADO':it.estado==='CON_OBSERVACION'?'⚠ CON OBSERV.':'⏳ PENDIENTE'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {itemEditando && (
        <ModalEditarItem
          item={itemEditando}
          estadoInicial={itemEditando.estadoNuevo || itemEditando.estado}
          onClose={()=>setItemEditando(null)}
          onSave={(estado, servicio_real, observaciones)=>actualizarItem(itemEditando, estado, servicio_real, observaciones)}
        />
      )}
    </>
  );
}

// ─── MODAL EDITAR ITEM ───────────────────────────────────────
function ModalEditarItem({ item, estadoInicial, onClose, onSave }) {
  const [estado, setEstado] = useState(estadoInicial);
  const [servicioReal, setServicioReal] = useState(item.servicio_real || '');
  const [observaciones, setObservaciones] = useState(item.observaciones || '');

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:560}}>
        <div className="modal-header">
          <div className="modal-title">📋 {item.equipo_nombre}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{padding:10,background:G.input,borderRadius:4,fontSize:11,marginBottom:14}}>
            <div><b>Marca/Modelo:</b> {item.marca} {item.modelo}</div>
            <div><b>Serie:</b> {item.serie || '—'}</div>
            <div><b>Activo fijo:</b> {item.activo_fijo || '—'}</div>
            <div><b>Servicio registrado:</b> {item.servicio_registrado || '—'}</div>
          </div>

          <div className="field">
            <label>Estado de verificación</label>
            <select value={estado} onChange={e=>setEstado(e.target.value)}>
              <option value="PRESENTE">✓ Presente y correcto</option>
              <option value="NO_ENCONTRADO">✗ No encontrado</option>
              <option value="CON_OBSERVACION">⚠ Con observación</option>
              <option value="PENDIENTE">⏳ Pendiente (sin verificar)</option>
            </select>
          </div>

          {(estado === 'PRESENTE' || estado === 'CON_OBSERVACION') && (
            <div className="field">
              <label>Servicio donde se encontró (si difiere del registrado)</label>
              <input value={servicioReal} onChange={e=>setServicioReal(e.target.value)} placeholder={`Registrado: ${item.servicio_registrado||'—'}`} />
              <div style={{fontSize:10,color:G.textMuted,marginTop:3,fontStyle:'italic'}}>Déjalo vacío si está en el servicio correcto</div>
            </div>
          )}

          <div className="field">
            <label>Observaciones</label>
            <textarea
              value={observaciones}
              onChange={e=>setObservaciones(e.target.value)}
              placeholder={
                estado==='NO_ENCONTRADO' ? 'Ej: No estaba en el lugar, posiblemente prestado o en mantenimiento...' :
                estado==='CON_OBSERVACION' ? 'Ej: No funciona, pantalla rota, sin cable de alimentación...' :
                'Notas adicionales...'
              }
              style={{minHeight:80}}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={()=>onSave(estado, servicioReal||null, observaciones||null)}>
            ✓ Guardar
          </button>
        </div>
      </div>
    </div>
  );
}