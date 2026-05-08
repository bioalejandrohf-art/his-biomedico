import { useEffect, useState } from 'react';

const API = 'https://his-biomedico-production.up.railway.app';

const G = {
  bg:'#0f1623', card:'#19253a', cardBorder:'#1e2f47',
  accent:'#00e5a0', accentDim:'#00b87a', danger:'#ff4d6d', warning:'#ffb347',
  text:'#e2eaf4', textMuted:'#6b8099', input:'#0f1e30', inputBorder:'#1e3a56',
};

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_SEMANA = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

const formatFecha = (f) => f ? new Date(f).toLocaleDateString('es-CO',{year:'numeric',month:'short',day:'2-digit'}) : '—';

// Color del evento según estado
const colorEvento = (m) => {
  if (m.estado === 'REALIZADO') return { bg:'rgba(0,229,160,0.18)', border:G.accent, text:G.accent, label:'REALIZADO' };
  // Pendiente: revisar si está atrasado
  const fecha = new Date(m.fecha_programada);
  fecha.setHours(0,0,0,0);
  const hoy = new Date();
  hoy.setHours(0,0,0,0);
  if (fecha < hoy) return { bg:'rgba(255,77,109,0.18)', border:G.danger, text:G.danger, label:'ATRASADO' };
  return { bg:'rgba(255,179,71,0.18)', border:G.warning, text:G.warning, label:'PENDIENTE' };
};

// Día YYYY-MM-DD desde Date
const ymd = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
};

export default function Calendario({ token, mantenimientos, equipos, usuarios, rol, onRecargar, onAbrirReporte, onFinalizarOT }) {
  const [vista, setVista] = useState('mes'); // 'mes' | 'semana'
  const [fecha, setFecha] = useState(new Date());
  const [filtros, setFiltros] = useState({ servicio:'', tipo:'', estado:'', prioridad:'', tecnico:'' });
  const [eventoSel, setEventoSel] = useState(null);
  const [arrastrando, setArrastrando] = useState(null);

  // Servicios únicos para el filtro
  const servicios = [...new Set(equipos.map(e=>e.servicio).filter(Boolean))].sort();

  // Aplicar filtros a los mantenimientos
  const mantsFiltrados = mantenimientos.filter(m => {
    if (filtros.servicio && m.equipo_servicio !== filtros.servicio) return false;
    if (filtros.tipo && m.tipo !== filtros.tipo) return false;
    if (filtros.estado && m.estado !== filtros.estado) return false;
    if (filtros.prioridad && m.prioridad !== filtros.prioridad) return false;
    if (filtros.tecnico && m.realizado_por !== parseInt(filtros.tecnico)) return false;
    return true;
  });

  // Agrupar por fecha YYYY-MM-DD
  const eventosPorDia = {};
  mantsFiltrados.forEach(m => {
    const key = m.fecha_programada?.slice(0,10);
    if (!key) return;
    if (!eventosPorDia[key]) eventosPorDia[key] = [];
    eventosPorDia[key].push(m);
  });

  // Generar días para vista mensual
  const generarDiasMes = () => {
    const year = fecha.getFullYear();
    const month = fecha.getMonth();
    const primerDia = new Date(year, month, 1);
    const ultimoDia = new Date(year, month+1, 0);
    // Lunes=0
    let primerDiaSemana = primerDia.getDay() - 1;
    if (primerDiaSemana < 0) primerDiaSemana = 6;
    const dias = [];
    // Días del mes anterior para llenar primera semana
    for (let i = primerDiaSemana; i > 0; i--) {
      const d = new Date(year, month, 1-i);
      dias.push({ fecha:d, otroMes:true });
    }
    // Días del mes
    for (let i = 1; i <= ultimoDia.getDate(); i++) {
      dias.push({ fecha: new Date(year, month, i), otroMes:false });
    }
    // Días del mes siguiente para completar la cuadrícula
    while (dias.length % 7 !== 0) {
      const last = dias[dias.length-1].fecha;
      const next = new Date(last);
      next.setDate(last.getDate()+1);
      dias.push({ fecha: next, otroMes:true });
    }
    return dias;
  };

  // Generar días para vista semanal
  const generarDiasSemana = () => {
    const f = new Date(fecha);
    let dia = f.getDay() - 1;
    if (dia < 0) dia = 6;
    f.setDate(f.getDate() - dia);
    const dias = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(f);
      d.setDate(f.getDate()+i);
      dias.push({ fecha:d, otroMes:false });
    }
    return dias;
  };

  const dias = vista === 'mes' ? generarDiasMes() : generarDiasSemana();

  const navegar = (dir) => {
    const nueva = new Date(fecha);
    if (vista === 'mes') nueva.setMonth(nueva.getMonth() + dir);
    else nueva.setDate(nueva.getDate() + dir*7);
    setFecha(nueva);
  };

  // Drag & drop
  const onDragStart = (e, mant) => {
    if (mant.estado === 'REALIZADO') { e.preventDefault(); return; }
    setArrastrando(mant);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const onDrop = async (e, dia) => {
    e.preventDefault();
    if (!arrastrando) return;
    const nuevaFecha = ymd(dia.fecha);
    const fechaActual = arrastrando.fecha_programada?.slice(0,10);
    if (nuevaFecha === fechaActual) { setArrastrando(null); return; }

    const ok = window.confirm(
      `¿Reprogramar la OT "${arrastrando.equipo_nombre}" del ${formatFecha(fechaActual)} al ${formatFecha(nuevaFecha)}?`
    );
    if (!ok) { setArrastrando(null); return; }

    try {
      const res = await fetch(`${API}/mantenimientos/${arrastrando.id}/reprogramar`,{
        method:'PUT',
        headers:{'Content-Type':'application/json',Authorization:token},
        body:JSON.stringify({fecha_programada: nuevaFecha})
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else onRecargar();
    } catch(err) { alert('Error: '+err.message); }
    setArrastrando(null);
  };

  // KPIs del rango visible
  const fechasVisibles = dias.filter(d=>!d.otroMes).map(d=>ymd(d.fecha));
  const eventosVisibles = mantsFiltrados.filter(m => {
    const k = m.fecha_programada?.slice(0,10);
    return fechasVisibles.includes(k);
  });
  const kpisVisible = {
    total: eventosVisibles.length,
    pendientes: eventosVisibles.filter(m=>m.estado==='PENDIENTE').length,
    realizados: eventosVisibles.filter(m=>m.estado==='REALIZADO').length,
    atrasados: eventosVisibles.filter(m => {
      if (m.estado !== 'PENDIENTE') return false;
      const f = new Date(m.fecha_programada); f.setHours(0,0,0,0);
      const hoy = new Date(); hoy.setHours(0,0,0,0);
      return f < hoy;
    }).length,
  };

  const tecnicos = usuarios.filter(u => ['Biomedico','Ingeniero','Admin'].includes(u.rol));

  const tituloPeriodo = vista === 'mes'
    ? `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`
    : (() => {
        const ini = dias[0].fecha;
        const fin = dias[6].fecha;
        return `${ini.getDate()} ${MESES[ini.getMonth()].slice(0,3)} - ${fin.getDate()} ${MESES[fin.getMonth()].slice(0,3)} ${fin.getFullYear()}`;
      })();

  const hoyStr = ymd(new Date());

  return (
    <>
      {/* CONTROLES SUPERIORES */}
      <div className="panel" style={{padding:14,marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <button className="btn btn-ghost btn-icon" onClick={()=>navegar(-1)} title="Anterior">◀</button>
            <button className="btn btn-ghost" style={{fontSize:11}} onClick={()=>setFecha(new Date())}>Hoy</button>
            <button className="btn btn-ghost btn-icon" onClick={()=>navegar(1)} title="Siguiente">▶</button>
            <div style={{fontSize:16,fontWeight:600,color:G.text,marginLeft:8,minWidth:200}}>{tituloPeriodo}</div>
          </div>

          <div style={{display:'flex',gap:6}}>
            <button className={`btn ${vista==='mes'?'btn-primary':'btn-ghost'}`} style={{fontSize:11}} onClick={()=>setVista('mes')}>📅 Mes</button>
            <button className={`btn ${vista==='semana'?'btn-primary':'btn-ghost'}`} style={{fontSize:11}} onClick={()=>setVista('semana')}>📆 Semana</button>
          </div>
        </div>

        {/* FILTROS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginTop:14}}>
          <div className="field">
            <label>Servicio</label>
            <select value={filtros.servicio} onChange={e=>setFiltros({...filtros,servicio:e.target.value})}>
              <option value="">Todos</option>
              {servicios.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Tipo OT</label>
            <select value={filtros.tipo} onChange={e=>setFiltros({...filtros,tipo:e.target.value})}>
              <option value="">Todos</option>
              {['Preventivo','Correctivo','Calibración','Inspección'].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Estado</label>
            <select value={filtros.estado} onChange={e=>setFiltros({...filtros,estado:e.target.value})}>
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="REALIZADO">Realizado</option>
            </select>
          </div>
          <div className="field">
            <label>Prioridad</label>
            <select value={filtros.prioridad} onChange={e=>setFiltros({...filtros,prioridad:e.target.value})}>
              <option value="">Todas</option>
              {['NORMAL','ALTA','CRITICA'].map(p=><option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Técnico</label>
            <select value={filtros.tecnico} onChange={e=>setFiltros({...filtros,tecnico:e.target.value})}>
              <option value="">Todos</option>
              {tecnicos.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs DEL RANGO */}
      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:14}}>
        <div className="kpi-card blue"><div className="kpi-label">Total visible</div><div className="kpi-value">{kpisVisible.total}</div></div>
        <div className="kpi-card orange"><div className="kpi-label">Pendientes</div><div className="kpi-value">{kpisVisible.pendientes}</div></div>
        <div className="kpi-card green"><div className="kpi-label">Realizados</div><div className="kpi-value">{kpisVisible.realizados}</div></div>
        <div className="kpi-card red"><div className="kpi-label">Atrasados</div><div className="kpi-value">{kpisVisible.atrasados}</div></div>
      </div>

      {/* LEYENDA */}
      <div style={{display:'flex',gap:14,marginBottom:14,fontSize:11,color:G.textMuted,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:14,height:14,background:'rgba(255,179,71,0.3)',border:`2px solid ${G.warning}`,borderRadius:3}}></div>Pendiente</div>
        <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:14,height:14,background:'rgba(0,229,160,0.3)',border:`2px solid ${G.accent}`,borderRadius:3}}></div>Realizado</div>
        <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:14,height:14,background:'rgba(255,77,109,0.3)',border:`2px solid ${G.danger}`,borderRadius:3}}></div>Atrasado</div>
        {rol!=='Auditor' && <div style={{marginLeft:'auto',fontStyle:'italic'}}>💡 Arrastra un evento para reprogramarlo</div>}
      </div>

      {/* GRILLA DEL CALENDARIO */}
      <div className="panel" style={{padding:0,overflow:'hidden'}}>
        {/* Cabecera días de la semana */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',background:G.input,borderBottom:`1px solid ${G.cardBorder}`}}>
          {DIAS_SEMANA.map(d=>(
            <div key={d} style={{padding:'10px 6px',textAlign:'center',fontSize:10,fontWeight:600,color:G.textMuted,letterSpacing:1.5,textTransform:'uppercase'}}>{d}</div>
          ))}
        </div>

        {/* Días */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
          {dias.map((d,i)=>{
            const key = ymd(d.fecha);
            const eventos = eventosPorDia[key] || [];
            const esHoy = key === hoyStr;
            const finde = i%7 >= 5;
            return (
              <div
                key={i}
                onDragOver={onDragOver}
                onDrop={(e)=>onDrop(e, d)}
                style={{
                  minHeight: vista==='mes' ? 110 : 280,
                  borderRight: (i+1)%7 !== 0 ? `1px solid ${G.cardBorder}` : 'none',
                  borderBottom: i < dias.length-7 ? `1px solid ${G.cardBorder}` : 'none',
                  background: d.otroMes ? 'rgba(15,30,48,0.4)' : finde ? 'rgba(15,30,48,0.15)' : 'transparent',
                  padding:6,
                  position:'relative',
                  opacity: d.otroMes ? 0.4 : 1
                }}
              >
                <div style={{
                  display:'flex',
                  justifyContent:'space-between',
                  alignItems:'center',
                  marginBottom:4
                }}>
                  <div style={{
                    fontSize:11,
                    fontWeight: esHoy ? 700 : 500,
                    color: esHoy ? G.accent : G.text,
                    fontFamily:'IBM Plex Mono',
                    background: esHoy ? 'rgba(0,229,160,0.15)' : 'transparent',
                    padding: esHoy ? '2px 6px' : '2px 4px',
                    borderRadius: 3,
                  }}>{d.fecha.getDate()}</div>
                  {eventos.length > 0 && (
                    <div style={{fontSize:9,color:G.textMuted,fontFamily:'IBM Plex Mono'}}>{eventos.length}</div>
                  )}
                </div>

                <div style={{display:'flex',flexDirection:'column',gap:3}}>
                  {eventos.slice(0, vista==='mes'?3:20).map(m=>{
                    const c = colorEvento(m);
                    return (
                      <div
                        key={m.id}
                        draggable={rol !== 'Auditor' && m.estado !== 'REALIZADO'}
                        onDragStart={(e)=>onDragStart(e,m)}
                        onClick={()=>setEventoSel(m)}
                        title={`${m.equipo_nombre} - ${m.tipo}`}
                        style={{
                          background: c.bg,
                          borderLeft: `3px solid ${c.border}`,
                          padding:'3px 6px',
                          borderRadius:3,
                          fontSize:10,
                          cursor:'pointer',
                          color:G.text,
                          overflow:'hidden',
                          textOverflow:'ellipsis',
                          whiteSpace: vista==='mes' ? 'nowrap' : 'normal',
                          lineHeight: 1.3
                        }}
                      >
                        <div style={{fontWeight:600,color:c.text,fontSize:9,letterSpacing:0.3}}>{m.tipo}</div>
                        <div style={{color:G.text,fontSize:10}}>{m.equipo_nombre}</div>
                        {vista==='semana' && m.equipo_servicio && <div style={{fontSize:9,color:G.textMuted}}>{m.equipo_servicio}</div>}
                      </div>
                    );
                  })}
                  {vista==='mes' && eventos.length > 3 && (
                    <div style={{fontSize:9,color:G.textMuted,textAlign:'center',padding:'2px 0',cursor:'pointer'}} onClick={()=>{setVista('semana'); setFecha(d.fecha);}}>
                      +{eventos.length-3} más...
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL DETALLE EVENTO */}
      {eventoSel && (
        <ModalDetalleEvento
          ot={eventoSel}
          onClose={()=>setEventoSel(null)}
          onAbrirReporte={()=>{ onAbrirReporte(eventoSel); setEventoSel(null); }}
          onFinalizarOT={()=>{ onFinalizarOT(eventoSel); setEventoSel(null); }}
          rol={rol}
        />
      )}
    </>
  );
}

// ─── MODAL DETALLE DE EVENTO ────────────────────────────────────────
function ModalDetalleEvento({ ot, onClose, onAbrirReporte, onFinalizarOT, rol }) {
  const c = colorEvento(ot);
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:560}}>
        <div className="modal-header" style={{borderBottom:`3px solid ${c.border}`}}>
          <div className="modal-title">📋 Detalle de la OT</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{display:'flex',gap:8,marginBottom:14}}>
            <span className="badge" style={{background:c.bg,color:c.text,fontSize:10}}>{c.label}</span>
            <span className={`badge ${ot.prioridad==='CRITICA'?'badge-red':ot.prioridad==='ALTA'?'badge-orange':'badge-gray'}`}>{ot.prioridad}</span>
            <span className="badge badge-gray">{ot.tipo}</span>
            {ot.tipo_equipo && <span className="badge badge-purple">{ot.tipo_equipo}</span>}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,fontSize:12,marginBottom:14}}>
            <div>
              <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:3}}>Equipo</div>
              <div style={{fontWeight:600}}>{ot.equipo_nombre}</div>
            </div>
            <div>
              <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:3}}>Servicio</div>
              <div>{ot.equipo_servicio||'—'}</div>
            </div>
            <div>
              <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:3}}>Programado</div>
              <div style={{fontFamily:'IBM Plex Mono'}}>{formatFecha(ot.fecha_programada)}</div>
            </div>
            <div>
              <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:3}}>Realizado</div>
              <div style={{fontFamily:'IBM Plex Mono'}}>{ot.fecha_realizada?formatFecha(ot.fecha_realizada):'—'}</div>
            </div>
            {ot.institucion_nombre && (
              <div style={{gridColumn:'1/3'}}>
                <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:3}}>Institución</div>
                <div>🏥 {ot.institucion_nombre}</div>
              </div>
            )}
          </div>

          {ot.descripcion && (
            <div style={{marginBottom:14,padding:'10px 12px',background:G.input,borderRadius:4}}>
              <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:4}}>Descripción</div>
              <div style={{fontSize:12}}>{ot.descripcion}</div>
            </div>
          )}

          {ot.observaciones && (
            <div style={{marginBottom:14,padding:'10px 12px',background:G.input,borderRadius:4}}>
              <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:4}}>Observaciones</div>
              <div style={{fontSize:12}}>{ot.observaciones}</div>
            </div>
          )}

          {ot.reporte_id && (
            <div style={{padding:'10px 12px',background:'rgba(0,229,160,0.08)',border:`1px solid rgba(0,229,160,0.2)`,borderRadius:4,fontSize:11,color:G.accent,marginBottom:8}}>
              ✓ Esta OT ya tiene un reporte de mantenimiento asociado
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          {rol !== 'Auditor' && (
            <>
              <button className="btn btn-purple" onClick={onAbrirReporte}>📋 {ot.reporte_id?'Ver/Editar':'Crear'} reporte</button>
              {ot.estado === 'PENDIENTE' && <button className="btn btn-primary" onClick={onFinalizarOT}>✓ Finalizar OT</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}