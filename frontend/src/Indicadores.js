import { useEffect, useState, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area, CartesianGrid
} from 'recharts';
import * as XLSX from 'xlsx';

const API = 'https://his-biomedico-production.up.railway.app';

const G = {
  bg:'#0f1623', card:'#19253a', cardBorder:'#1e2f47',
  accent:'#00e5a0', accentDim:'#00b87a', danger:'#ff4d6d', warning:'#ffb347',
  text:'#e2eaf4', textMuted:'#6b8099', input:'#0f1e30', inputBorder:'#1e3a56',
};
const COLORS = ['#00e5a0','#4da6ff','#ffb347','#ff4d6d','#a78bfa','#34d399','#f472b6','#fbbf24'];
const fmtMoney = (n) => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n||0);
const fmtFecha = (f) => f ? new Date(f).toLocaleDateString('es-CO',{year:'numeric',month:'short',day:'2-digit'}) : '—';

const TABS = [
  { id: 'cumplimiento', label: '✓ Cumplimiento', icon: '📋' },
  { id: 'disponibilidad', label: '⚙ MTBF/MTTR', icon: '⚙️' },
  { id: 'productividad', label: '👤 Productividad', icon: '👥' },
  { id: 'costos', label: '$ Costos', icon: '💰' },
  { id: 'tecnovigilancia', label: '⚠ Tecnovigilancia', icon: '🚨' },
  { id: 'envejecimiento', label: '⌛ Envejecimiento', icon: '📅' },
  { id: 'alertas', label: '🔔 Alertas', icon: '🔔' },
];

export default function Indicadores({ token, esSuperAdmin, institucion }) {
  const [tab, setTab] = useState('cumplimiento');
  const [dias, setDias] = useState(90);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});
  const contentRef = useRef(null);

  const cargarIndicador = async (endpoint) => {
    try {
      const res = await fetch(`${API}/indicadores/${endpoint}?dias=${dias}`,{headers:{Authorization:token}});
      return await res.json();
    } catch(e) { console.error(e); return null; }
  };

  const cargarTodos = async () => {
    setLoading(true);
    const [cumplimiento, disponibilidad, productividad, costos, tecnovigilancia, envejecimiento, alertas] = await Promise.all([
      cargarIndicador('cumplimiento'),
      cargarIndicador('disponibilidad'),
      cargarIndicador('productividad'),
      cargarIndicador('costos'),
      cargarIndicador('tecnovigilancia'),
      cargarIndicador('envejecimiento'),
      cargarIndicador('alertas-predictivas'),
    ]);
    setData({ cumplimiento, disponibilidad, productividad, costos, tecnovigilancia, envejecimiento, alertas });
    setLoading(false);
  };

  // eslint-disable-next-line
  useEffect(() => { cargarTodos(); }, [dias]);

  // ───── EXPORTAR A EXCEL ─────
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    const fechaHoy = new Date().toLocaleDateString('es-CO');
    const inst = institucion?.nombre || 'Todas las instituciones';

    // Hoja 1: Cumplimiento
    if (data.cumplimiento) {
      const c = data.cumplimiento;
      const hoja1 = [
        ['INDICADORES DE GESTIÓN — CUMPLIMIENTO DE MANTENIMIENTOS'],
        [`Institución: ${inst}`],
        [`Periodo: últimos ${dias} días — Generado: ${fechaHoy}`],
        [],
        ['RESUMEN GENERAL'],
        ['Programados', c.programados],
        ['Realizados', c.realizados],
        ['Atrasados', c.atrasados],
        ['% Cumplimiento', `${c.cumplimiento}%`],
        ['% A tiempo', `${c.aTiempo}%`],
        [],
        ['POR SERVICIO'],
        ['Servicio','Programados','Realizados','% Cumplimiento'],
        ...(c.porServicio||[]).map(s=>[s.servicio, s.programados, s.realizados, `${s.porcentaje||0}%`]),
        [],
        ['POR TIPO DE EQUIPO'],
        ['Tipo','Programados','Realizados','% Cumplimiento'],
        ...(c.porTipo||[]).map(t=>[t.tipo, t.programados, t.realizados, `${t.porcentaje||0}%`]),
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(hoja1);
      ws1['!cols'] = [{wch:35},{wch:15},{wch:15},{wch:15}];
      XLSX.utils.book_append_sheet(wb, ws1, 'Cumplimiento');
    }

    // Hoja 2: Disponibilidad
    if (data.disponibilidad) {
      const d = data.disponibilidad;
      const hoja2 = [
        ['INDICADORES — DISPONIBILIDAD Y CONFIABILIDAD'],
        [`Institución: ${inst}`],
        [`Periodo: últimos ${dias} días`],
        [],
        ['INDICADORES CLAVE'],
        ['MTTR (días promedio)', d.mttr],
        ['MTBF (días promedio entre fallas)', d.mtbf],
        ['% Disponibilidad', `${d.disponibilidad}%`],
        ['Total equipos', d.total],
        ['Activos', d.activos],
        ['En mantenimiento', d.enMant],
        ['De baja', d.baja],
        [],
        ['MTTR POR SERVICIO'],
        ['Servicio','MTTR (días)','Total OTs'],
        ...(d.mttrServicio||[]).map(s=>[s.servicio, s.mttr||0, s.total]),
        [],
        ['TOP EQUIPOS CON MÁS FALLAS'],
        ['Equipo','Marca','Modelo','Servicio','# Fallas'],
        ...(d.topFallas||[]).map(e=>[e.nombre, e.marca||'—', e.modelo||'—', e.servicio||'—', e.fallas]),
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(hoja2);
      ws2['!cols'] = [{wch:35},{wch:15},{wch:15},{wch:15},{wch:15}];
      XLSX.utils.book_append_sheet(wb, ws2, 'MTBF-MTTR');
    }

    // Hoja 3: Productividad
    if (data.productividad) {
      const hoja3 = [
        ['PRODUCTIVIDAD POR TÉCNICO'],
        [`Institución: ${inst}`],
        [`Periodo: últimos ${dias} días`],
        [],
        ['Técnico','Rol','Total OTs','Promedio días','A tiempo'],
        ...(data.productividad.tecnicos||[]).map(t=>[t.nombre, t.rol, t.total_ots, t.promedio_dias||0, t.a_tiempo||0]),
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(hoja3);
      ws3['!cols'] = [{wch:30},{wch:15},{wch:15},{wch:15},{wch:15}];
      XLSX.utils.book_append_sheet(wb, ws3, 'Productividad');
    }

    // Hoja 4: Costos
    if (data.costos) {
      const c = data.costos;
      const hoja4 = [
        ['ANÁLISIS DE COSTOS'],
        [`Institución: ${inst}`],
        [`Periodo: últimos ${dias} días`],
        [],
        ['RESUMEN'],
        ['Gasto total', fmtMoney(c.gastoTotal)],
        ['OTs con repuestos', c.otsConRepuestos],
        ['Items utilizados', c.itemsUsados],
        ['Unidades totales', c.unidadesTotales],
        [],
        ['TOP EQUIPOS POR GASTO'],
        ['Equipo','Marca','Modelo','Servicio','Gasto','# Repuestos'],
        ...(c.topEquipos||[]).map(e=>[e.nombre, e.marca||'—', e.modelo||'—', e.servicio||'—', fmtMoney(e.gasto), e.repuestos_usados]),
        [],
        ['POR SERVICIO'],
        ['Servicio','Gasto','# OTs'],
        ...(c.porServicio||[]).map(s=>[s.servicio, fmtMoney(s.gasto), s.ots]),
      ];
      const ws4 = XLSX.utils.aoa_to_sheet(hoja4);
      ws4['!cols'] = [{wch:30},{wch:15},{wch:15},{wch:25},{wch:20},{wch:15}];
      XLSX.utils.book_append_sheet(wb, ws4, 'Costos');
    }

    // Hoja 5: Tecnovigilancia
    if (data.tecnovigilancia) {
      const t = data.tecnovigilancia;
      const hoja5 = [
        ['TECNOVIGILANCIA'],
        [`Institución: ${inst}`],
        [`Periodo: últimos ${dias} días`],
        [],
        ['RESUMEN'],
        ['Total eventos', t.total],
        ['Leves', t.leves],
        ['Moderados', t.moderados],
        ['Graves', t.graves],
        ['Abiertos', t.abiertos],
        ['Cerrados', t.cerrados],
        [],
        ['POR SERVICIO'],
        ['Servicio','Total','Graves'],
        ...(t.porServicio||[]).map(s=>[s.servicio, s.total, s.graves]),
        [],
        ['POR TIPO'],
        ['Tipo','Total'],
        ...(t.porTipo||[]).map(s=>[s.tipo, s.total]),
      ];
      const ws5 = XLSX.utils.aoa_to_sheet(hoja5);
      ws5['!cols'] = [{wch:35},{wch:15},{wch:15}];
      XLSX.utils.book_append_sheet(wb, ws5, 'Tecnovigilancia');
    }

    // Hoja 6: Envejecimiento
    if (data.envejecimiento) {
      const e = data.envejecimiento;
      const hoja6 = [
        ['CURVA DE ENVEJECIMIENTO'],
        [`Institución: ${inst}`],
        [],
        ['DISTRIBUCIÓN POR ANTIGÜEDAD'],
        ['Rango','Total'],
        ...(e.distribucion||[]).map(d=>[d.rango, d.total]),
        [],
        ['ESTADO INVIMA'],
        ['Vigente', e.invima?.vigente||0],
        ['Por vencer (30 días)', e.invima?.por_vencer||0],
        ['Vencido', e.invima?.vencido||0],
        ['Sin fecha', e.invima?.sin_fecha||0],
        [],
        ['POR SERVICIO — EDAD PROMEDIO'],
        ['Servicio','Total','Edad promedio (años)'],
        ...(e.porServicio||[]).map(s=>[s.servicio, s.total, s.edad_promedio||0]),
      ];
      const ws6 = XLSX.utils.aoa_to_sheet(hoja6);
      ws6['!cols'] = [{wch:30},{wch:20},{wch:25}];
      XLSX.utils.book_append_sheet(wb, ws6, 'Envejecimiento');
    }

    // Hoja 7: Alertas
    if (data.alertas) {
      const a = data.alertas;
      const hoja7 = [
        ['ALERTAS PREDICTIVAS'],
        [`Institución: ${inst}`],
        [],
        ['EQUIPOS SIN MANTENIMIENTO >180 DÍAS'],
        ['Equipo','Marca','Modelo','Serie','Servicio','Tipo','Días sin mantenimiento'],
        ...(a.equiposSinMantenimiento||[]).map(e=>[e.nombre, e.marca||'—', e.modelo||'—', e.serie||'—', e.servicio||'—', e.tipo_equipo||'—', e.dias_sin_mant]),
        [],
        ['OTs VENCIDAS'],
        ['Equipo','Servicio','Tipo OT','Prioridad','Fecha programada','Días atraso'],
        ...(a.otsVencidas||[]).map(o=>[o.equipo_nombre, o.servicio||'—', o.tipo, o.prioridad, fmtFecha(o.fecha_programada), o.dias_atraso]),
        [],
        ['INVIMA CRÍTICO (vencido o por vencer 60 días)'],
        ['Equipo','Marca','Modelo','Servicio','Vencimiento','Días restantes'],
        ...(a.invimaCritico||[]).map(e=>[e.nombre, e.marca||'—', e.modelo||'—', e.servicio||'—', fmtFecha(e.fecha_vencimiento_invima), e.dias_restantes]),
      ];
      const ws7 = XLSX.utils.aoa_to_sheet(hoja7);
      ws7['!cols'] = [{wch:30},{wch:15},{wch:15},{wch:18},{wch:20},{wch:18},{wch:18}];
      XLSX.utils.book_append_sheet(wb, ws7, 'Alertas');
    }

    XLSX.writeFile(wb, `Indicadores_${inst.replace(/\s+/g,'_')}_${fechaHoy.replace(/\//g,'-')}.xlsx`);
  };

  // ───── EXPORTAR A PDF ─────
  const exportarPDF = () => {
    const w = window.open('', '_blank');
    if (!w) return alert('Permite ventanas emergentes para generar el PDF');
    const inst = institucion?.nombre || 'Todas las instituciones';
    const logo = institucion?.logo_url ? `<img src="${institucion.logo_url}" style="width:60px;height:60px;object-fit:contain"/>` : '🏥';
    const fechaHoy = new Date().toLocaleDateString('es-CO',{year:'numeric',month:'long',day:'2-digit'});

    const c = data.cumplimiento || {};
    const d = data.disponibilidad || {};
    const co = data.costos || {};
    const t = data.tecnovigilancia || {};
    const e = data.envejecimiento || {};
    const a = data.alertas || {};

    const tablaSimple = (titulo, headers, rows) => `
      <h3 style="margin:14px 0 6px;color:#0a2342;font-size:13px;border-bottom:2px solid #00b87a;padding-bottom:4px">${titulo}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:10px">
        <thead><tr style="background:#0a2342;color:#fff">${headers.map(h=>`<th style="padding:6px;text-align:left">${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r,i)=>`<tr style="background:${i%2?'#f7fafc':'#fff'}">${r.map(c=>`<td style="padding:5px 6px;border:1px solid #ddd">${c}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Indicadores</title>
    <style>
      @page { size: A4; margin: 12mm; }
      body { font-family: Arial,sans-serif; font-size:11px; color:#000; margin:0; padding:0; }
      h1 { font-size:16px; margin:0; }
      h2 { font-size:13px; margin:14px 0 6px; color:#0a2342 }
      .header { background:#0a2342;color:#fff;padding:14px;display:flex;align-items:center;gap:12px;margin-bottom:14px }
      .kpi-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:8px 0 }
      .kpi { background:#f0f4f8;border-left:3px solid #00b87a;padding:8px 10px;border-radius:3px }
      .kpi-label { font-size:9px;color:#666;text-transform:uppercase;letter-spacing:1px }
      .kpi-value { font-size:18px;font-weight:bold;color:#0a2342 }
      .page-break { page-break-after: always; }
    </style></head><body>

    <div class="header">
      <div style="font-size:36px">${logo}</div>
      <div>
        <h1>INDICADORES DE GESTIÓN</h1>
        <div style="font-size:11px;margin-top:4px">${inst}</div>
        <div style="font-size:10px;opacity:0.8">Periodo: últimos ${dias} días · Generado: ${fechaHoy}</div>
      </div>
    </div>

    <h2>1. CUMPLIMIENTO DE MANTENIMIENTOS</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Programados</div><div class="kpi-value">${c.programados||0}</div></div>
      <div class="kpi"><div class="kpi-label">Realizados</div><div class="kpi-value">${c.realizados||0}</div></div>
      <div class="kpi"><div class="kpi-label">% Cumplimiento</div><div class="kpi-value">${c.cumplimiento||0}%</div></div>
      <div class="kpi"><div class="kpi-label">% A tiempo</div><div class="kpi-value">${c.aTiempo||0}%</div></div>
    </div>
    ${tablaSimple('Cumplimiento por servicio', ['Servicio','Programados','Realizados','%'],
      (c.porServicio||[]).map(s=>[s.servicio, s.programados, s.realizados, `${s.porcentaje||0}%`]))}

    <div class="page-break"></div>

    <h2>2. DISPONIBILIDAD Y CONFIABILIDAD</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">MTTR (días)</div><div class="kpi-value">${d.mttr||0}</div></div>
      <div class="kpi"><div class="kpi-label">MTBF (días)</div><div class="kpi-value">${d.mtbf||0}</div></div>
      <div class="kpi"><div class="kpi-label">% Disponibilidad</div><div class="kpi-value">${d.disponibilidad||0}%</div></div>
      <div class="kpi"><div class="kpi-label">Equipos activos</div><div class="kpi-value">${d.activos||0}/${d.total||0}</div></div>
    </div>
    ${tablaSimple('Top equipos con más fallas', ['Equipo','Marca/Modelo','Servicio','# Fallas'],
      (d.topFallas||[]).slice(0,10).map(e=>[e.nombre, `${e.marca||''} ${e.modelo||''}`, e.servicio||'—', e.fallas]))}

    <div class="page-break"></div>

    <h2>3. ANÁLISIS DE COSTOS</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Gasto total</div><div class="kpi-value" style="font-size:13px">${fmtMoney(co.gastoTotal||0)}</div></div>
      <div class="kpi"><div class="kpi-label">OTs con repuestos</div><div class="kpi-value">${co.otsConRepuestos||0}</div></div>
      <div class="kpi"><div class="kpi-label">Items usados</div><div class="kpi-value">${co.itemsUsados||0}</div></div>
      <div class="kpi"><div class="kpi-label">Unidades</div><div class="kpi-value">${co.unidadesTotales||0}</div></div>
    </div>
    ${tablaSimple('Top equipos por gasto', ['Equipo','Servicio','Gasto'],
      (co.topEquipos||[]).slice(0,10).map(e=>[e.nombre, e.servicio||'—', fmtMoney(e.gasto)]))}

    <div class="page-break"></div>

    <h2>4. TECNOVIGILANCIA</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Total eventos</div><div class="kpi-value">${t.total||0}</div></div>
      <div class="kpi"><div class="kpi-label">Graves</div><div class="kpi-value" style="color:#c52232">${t.graves||0}</div></div>
      <div class="kpi"><div class="kpi-label">Moderados</div><div class="kpi-value" style="color:#e8821a">${t.moderados||0}</div></div>
      <div class="kpi"><div class="kpi-label">Abiertos</div><div class="kpi-value">${t.abiertos||0}</div></div>
    </div>
    ${tablaSimple('Por servicio', ['Servicio','Total','Graves'],
      (t.porServicio||[]).map(s=>[s.servicio, s.total, s.graves]))}

    <h2>5. ENVEJECIMIENTO</h2>
    ${tablaSimple('Distribución por antigüedad', ['Rango','Total'],
      (e.distribucion||[]).map(d=>[d.rango, d.total]))}
    ${tablaSimple('Estado INVIMA', ['Estado','Cantidad'],
      [['Vigente', e.invima?.vigente||0],['Por vencer (30d)', e.invima?.por_vencer||0],['Vencido', e.invima?.vencido||0],['Sin fecha', e.invima?.sin_fecha||0]])}

    <div class="page-break"></div>

    <h2>6. ALERTAS PREDICTIVAS</h2>
    ${tablaSimple('Equipos sin mantenimiento >180 días', ['Equipo','Servicio','Días'],
      (a.equiposSinMantenimiento||[]).slice(0,15).map(e=>[e.nombre, e.servicio||'—', e.dias_sin_mant]))}
    ${tablaSimple('OTs vencidas', ['Equipo','Tipo','Prioridad','Días atraso'],
      (a.otsVencidas||[]).slice(0,15).map(o=>[o.equipo_nombre, o.tipo, o.prioridad, o.dias_atraso]))}
    ${tablaSimple('INVIMA crítico', ['Equipo','Vencimiento','Días restantes'],
      (a.invimaCritico||[]).slice(0,15).map(e=>[e.nombre, fmtFecha(e.fecha_vencimiento_invima), e.dias_restantes]))}

    <script>window.onload=()=>setTimeout(()=>window.print(),700);</script>
    </body></html>`;

    w.document.write(html);
    w.document.close();
  };

  if (loading) return <div style={{textAlign:'center',padding:60,color:G.textMuted}}>📊 Cargando indicadores...</div>;

  const tooltipStyle = { background:G.card, border:`1px solid ${G.cardBorder}`, borderRadius:4, fontSize:12 };
  const tickStyle = { fill:G.textMuted, fontSize:10 };

  return (
    <>
      {/* HEADER CON CONTROLES */}
      <div className="panel" style={{padding:14, marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:14,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
            <div>
              <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:4}}>Periodo</div>
              <select value={dias} onChange={e=>setDias(parseInt(e.target.value))} style={{background:G.input,border:`1px solid ${G.inputBorder}`,borderRadius:4,padding:'8px 12px',color:G.text,fontSize:12,outline:'none'}}>
                <option value={30}>Último mes (30 días)</option>
                <option value={90}>Últimos 3 meses (90 días)</option>
                <option value={180}>Últimos 6 meses (180 días)</option>
                <option value={365}>Último año (365 días)</option>
                <option value={730}>Últimos 2 años</option>
              </select>
            </div>
            <button className="btn btn-ghost" onClick={cargarTodos} style={{fontSize:11}}>🔄 Recargar</button>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-purple" onClick={exportarExcel} style={{fontSize:11}}>📊 Exportar Excel</button>
            <button className="btn btn-orange" onClick={exportarPDF} style={{fontSize:11}}>📄 Exportar PDF</button>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{display:'flex',gap:6,marginBottom:18,flexWrap:'wrap',borderBottom:`1px solid ${G.cardBorder}`,paddingBottom:0}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            background: tab===t.id ? G.accent : 'transparent',
            color: tab===t.id ? '#0a1520' : G.textMuted,
            border:'none', padding:'10px 16px',
            fontSize:12, fontWeight:600, cursor:'pointer',
            borderRadius:'4px 4px 0 0',
            borderBottom: tab===t.id ? `2px solid ${G.accent}` : '2px solid transparent'
          }}>{t.label}</button>
        ))}
      </div>

      <div ref={contentRef}>

        {/* TAB 1: CUMPLIMIENTO */}
        {tab==='cumplimiento' && data.cumplimiento && (
          <>
            <div className="kpi-grid" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
              <div className="kpi-card blue"><div className="kpi-label">Programados</div><div className="kpi-value">{data.cumplimiento.programados}</div></div>
              <div className="kpi-card green"><div className="kpi-label">Realizados</div><div className="kpi-value">{data.cumplimiento.realizados}</div></div>
              <div className="kpi-card red"><div className="kpi-label">Atrasados</div><div className="kpi-value">{data.cumplimiento.atrasados}</div></div>
              <div className={`kpi-card ${data.cumplimiento.cumplimiento>=80?'green':data.cumplimiento.cumplimiento>=60?'orange':'red'}`}><div className="kpi-label">% Cumplimiento</div><div className="kpi-value">{data.cumplimiento.cumplimiento}%</div></div>
              <div className={`kpi-card ${data.cumplimiento.aTiempo>=80?'green':data.cumplimiento.aTiempo>=60?'orange':'red'}`}><div className="kpi-label">% A tiempo</div><div className="kpi-value">{data.cumplimiento.aTiempo}%</div></div>
            </div>

            <div className="chart-grid">
              <div className="panel"><div className="panel-header"><div className="panel-title">Cumplimiento por servicio</div></div>
                <div className="panel-body" style={{height:300}}>
                  {data.cumplimiento.porServicio?.length>0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.cumplimiento.porServicio} margin={{top:4,right:10,left:-20,bottom:50}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={G.cardBorder} />
                        <XAxis dataKey="servicio" tick={tickStyle} angle={-30} textAnchor="end" />
                        <YAxis tick={tickStyle} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{fontSize:11,color:G.textMuted}} />
                        <Bar dataKey="programados" name="Programados" fill="#4da6ff" />
                        <Bar dataKey="realizados" name="Realizados" fill={G.accent} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="empty-state">Sin datos</div>}
                </div>
              </div>

              <div className="panel"><div className="panel-header"><div className="panel-title">Tendencia mensual</div></div>
                <div className="panel-body" style={{height:300}}>
                  {data.cumplimiento.tendencia?.length>0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.cumplimiento.tendencia} margin={{top:4,right:10,left:-20,bottom:10}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={G.cardBorder} />
                        <XAxis dataKey="mes" tick={tickStyle} />
                        <YAxis tick={tickStyle} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{fontSize:11,color:G.textMuted}} />
                        <Area type="monotone" dataKey="programados" name="Programados" stroke="#4da6ff" fill="#4da6ff33" />
                        <Area type="monotone" dataKey="realizados" name="Realizados" stroke={G.accent} fill={`${G.accent}33`} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <div className="empty-state">Sin datos</div>}
                </div>
              </div>
            </div>

            <div className="panel"><div className="panel-header"><div className="panel-title">Por tipo de equipo</div></div>
              {data.cumplimiento.porTipo?.length>0 ? (
                <table className="data-table">
                  <thead><tr><th>Tipo de equipo</th><th>Programados</th><th>Realizados</th><th>% Cumplimiento</th></tr></thead>
                  <tbody>{data.cumplimiento.porTipo.map((t,i)=>(
                    <tr key={i}>
                      <td style={{fontWeight:500}}>{t.tipo}</td>
                      <td style={{fontFamily:'IBM Plex Mono'}}>{t.programados}</td>
                      <td style={{fontFamily:'IBM Plex Mono',color:G.accent}}>{t.realizados}</td>
                      <td><span className={`badge ${t.porcentaje>=80?'badge-green':t.porcentaje>=60?'badge-orange':'badge-red'}`}>{t.porcentaje||0}%</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <div className="empty-state">Sin datos</div>}
            </div>
          </>
        )}

        {/* TAB 2: DISPONIBILIDAD MTBF/MTTR */}
        {tab==='disponibilidad' && data.disponibilidad && (
          <>
            <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
              <div className="kpi-card blue"><div className="kpi-label">MTTR (días)</div><div className="kpi-value">{data.disponibilidad.mttr}</div><div className="kpi-sub">Tiempo medio de reparación</div></div>
              <div className="kpi-card purple"><div className="kpi-label">MTBF (días)</div><div className="kpi-value">{data.disponibilidad.mtbf}</div><div className="kpi-sub">Tiempo medio entre fallas</div></div>
              <div className={`kpi-card ${data.disponibilidad.disponibilidad>=90?'green':data.disponibilidad.disponibilidad>=75?'orange':'red'}`}><div className="kpi-label">% Disponibilidad</div><div className="kpi-value">{data.disponibilidad.disponibilidad}%</div></div>
              <div className="kpi-card teal"><div className="kpi-label">Equipos activos</div><div className="kpi-value">{data.disponibilidad.activos}<span style={{fontSize:14,color:G.textMuted}}>/{data.disponibilidad.total}</span></div></div>
            </div>

            <div className="chart-grid">
              <div className="panel"><div className="panel-header"><div className="panel-title">MTTR por servicio</div></div>
                <div className="panel-body" style={{height:300}}>
                  {data.disponibilidad.mttrServicio?.length>0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.disponibilidad.mttrServicio} layout="vertical" margin={{top:4,right:10,left:60,bottom:10}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={G.cardBorder} />
                        <XAxis type="number" tick={tickStyle} />
                        <YAxis dataKey="servicio" type="category" tick={tickStyle} width={120} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="mttr" name="Días" fill={G.warning} radius={[0,3,3,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="empty-state">Sin datos</div>}
                </div>
              </div>

              <div className="panel"><div className="panel-header"><div className="panel-title">Distribución de equipos</div></div>
                <div className="panel-body" style={{height:300}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[
                        {name:'Activos', value:data.disponibilidad.activos},
                        {name:'En mantenimiento', value:data.disponibilidad.enMant},
                        {name:'Baja', value:data.disponibilidad.baja},
                      ]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({name,value})=>`${name}: ${value}`}>
                        <Cell fill={G.accent} /><Cell fill={G.warning} /><Cell fill={G.textMuted} />
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="panel"><div className="panel-header"><div className="panel-title">⚠ Top equipos con más fallas correctivas</div></div>
              {data.disponibilidad.topFallas?.length>0 ? (
                <table className="data-table">
                  <thead><tr><th>Equipo</th><th>Marca/Modelo</th><th>Servicio</th><th># Fallas</th></tr></thead>
                  <tbody>{data.disponibilidad.topFallas.map(e=>(
                    <tr key={e.id}>
                      <td style={{fontWeight:500}}>{e.nombre}</td>
                      <td style={{color:G.textMuted}}>{e.marca} {e.modelo}</td>
                      <td style={{color:G.textMuted}}>{e.servicio||'—'}</td>
                      <td><span className={`badge ${e.fallas>=5?'badge-red':e.fallas>=3?'badge-orange':'badge-gray'}`}>{e.fallas}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <div className="empty-state">Sin fallas correctivas registradas</div>}
            </div>
          </>
        )}

        {/* TAB 3: PRODUCTIVIDAD */}
        {tab==='productividad' && data.productividad && (
          <>
            <div className="panel"><div className="panel-header"><div className="panel-title">Productividad por técnico</div></div>
              {data.productividad.tecnicos?.length>0 ? (
                <table className="data-table">
                  <thead><tr><th>Técnico</th><th>Rol</th><th>Total OTs</th><th>Tiempo promedio</th><th>A tiempo</th><th>% A tiempo</th></tr></thead>
                  <tbody>{data.productividad.tecnicos.map(t=>{
                    const pct = t.total_ots>0 ? Math.round((t.a_tiempo/t.total_ots)*100) : 0;
                    return (
                      <tr key={t.id}>
                        <td style={{fontWeight:500}}>👤 {t.nombre}</td>
                        <td><span className="badge badge-purple">{t.rol}</span></td>
                        <td style={{fontFamily:'IBM Plex Mono',color:G.accent,fontWeight:600}}>{t.total_ots}</td>
                        <td style={{fontFamily:'IBM Plex Mono'}}>{t.promedio_dias||0} días</td>
                        <td style={{fontFamily:'IBM Plex Mono'}}>{t.a_tiempo||0}</td>
                        <td><span className={`badge ${pct>=80?'badge-green':pct>=60?'badge-orange':'badge-red'}`}>{pct}%</span></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              ) : <div className="empty-state">Sin datos de productividad. Asegúrate de que las OTs finalizadas tengan asignado el técnico.</div>}
            </div>

            {data.productividad.tecnicos?.length>0 && (
              <div className="panel" style={{marginTop:16}}><div className="panel-header"><div className="panel-title">Comparativo OTs realizadas</div></div>
                <div className="panel-body" style={{height:340}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.productividad.tecnicos} margin={{top:4,right:10,left:-20,bottom:60}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={G.cardBorder} />
                      <XAxis dataKey="nombre" tick={tickStyle} angle={-30} textAnchor="end" />
                      <YAxis tick={tickStyle} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="total_ots" name="OTs realizadas" fill={G.accent} radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 4: COSTOS */}
        {tab==='costos' && data.costos && (
          <>
            <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
              <div className="kpi-card green"><div className="kpi-label">Gasto total</div><div className="kpi-value" style={{fontSize:18}}>{fmtMoney(data.costos.gastoTotal)}</div></div>
              <div className="kpi-card blue"><div className="kpi-label">OTs con repuestos</div><div className="kpi-value">{data.costos.otsConRepuestos}</div></div>
              <div className="kpi-card purple"><div className="kpi-label">Items distintos</div><div className="kpi-value">{data.costos.itemsUsados}</div></div>
              <div className="kpi-card teal"><div className="kpi-label">Unidades totales</div><div className="kpi-value">{data.costos.unidadesTotales}</div></div>
            </div>

            <div className="chart-grid">
              <div className="panel"><div className="panel-header"><div className="panel-title">Gasto mensual</div></div>
                <div className="panel-body" style={{height:300}}>
                  {data.costos.tendencia?.length>0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.costos.tendencia} margin={{top:4,right:10,left:0,bottom:10}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={G.cardBorder} />
                        <XAxis dataKey="mes" tick={tickStyle} />
                        <YAxis tick={tickStyle} tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} />
                        <Tooltip contentStyle={tooltipStyle} formatter={v=>fmtMoney(v)} />
                        <Area type="monotone" dataKey="gasto" name="Gasto" stroke={G.accent} fill={`${G.accent}44`} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <div className="empty-state">Sin datos</div>}
                </div>
              </div>

              <div className="panel"><div className="panel-header"><div className="panel-title">Gasto por servicio</div></div>
                <div className="panel-body" style={{height:300}}>
                  {data.costos.porServicio?.length>0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.costos.porServicio} dataKey="gasto" nameKey="servicio" cx="50%" cy="50%" outerRadius={90} label={({servicio,gasto})=>`${servicio}: ${fmtMoney(gasto)}`}>
                          {data.costos.porServicio.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} formatter={v=>fmtMoney(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div className="empty-state">Sin datos</div>}
                </div>
              </div>
            </div>

            <div className="panel"><div className="panel-header"><div className="panel-title">💰 Top equipos por gasto en repuestos</div></div>
              {data.costos.topEquipos?.length>0 ? (
                <table className="data-table">
                  <thead><tr><th>Equipo</th><th>Marca/Modelo</th><th>Servicio</th><th>Gasto</th><th># Repuestos</th></tr></thead>
                  <tbody>{data.costos.topEquipos.map(e=>(
                    <tr key={e.id}>
                      <td style={{fontWeight:500}}>{e.nombre}</td>
                      <td style={{color:G.textMuted}}>{e.marca} {e.modelo}</td>
                      <td style={{color:G.textMuted}}>{e.servicio||'—'}</td>
                      <td style={{fontFamily:'IBM Plex Mono',color:G.accent,fontWeight:600}}>{fmtMoney(e.gasto)}</td>
                      <td style={{fontFamily:'IBM Plex Mono'}}>{e.repuestos_usados}</td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <div className="empty-state">Sin datos de costos</div>}
            </div>
          </>
        )}

        {/* TAB 5: TECNOVIGILANCIA */}
        {tab==='tecnovigilancia' && data.tecnovigilancia && (
          <>
            <div className="kpi-grid" style={{gridTemplateColumns:'repeat(6,1fr)'}}>
              <div className="kpi-card blue"><div className="kpi-label">Total</div><div className="kpi-value">{data.tecnovigilancia.total}</div></div>
              <div className="kpi-card gray"><div className="kpi-label">Leves</div><div className="kpi-value">{data.tecnovigilancia.leves}</div></div>
              <div className="kpi-card orange"><div className="kpi-label">Moderados</div><div className="kpi-value">{data.tecnovigilancia.moderados}</div></div>
              <div className="kpi-card red"><div className="kpi-label">Graves</div><div className="kpi-value">{data.tecnovigilancia.graves}</div></div>
              <div className="kpi-card yellow"><div className="kpi-label">Abiertos</div><div className="kpi-value">{data.tecnovigilancia.abiertos}</div></div>
              <div className="kpi-card green"><div className="kpi-label">Cerrados</div><div className="kpi-value">{data.tecnovigilancia.cerrados}</div></div>
            </div>

            <div className="chart-grid">
              <div className="panel"><div className="panel-header"><div className="panel-title">Eventos por servicio</div></div>
                <div className="panel-body" style={{height:300}}>
                  {data.tecnovigilancia.porServicio?.length>0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.tecnovigilancia.porServicio} margin={{top:4,right:10,left:-20,bottom:50}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={G.cardBorder} />
                        <XAxis dataKey="servicio" tick={tickStyle} angle={-30} textAnchor="end" />
                        <YAxis tick={tickStyle} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{fontSize:11,color:G.textMuted}} />
                        <Bar dataKey="total" name="Total" fill="#4da6ff" />
                        <Bar dataKey="graves" name="Graves" fill={G.danger} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="empty-state">Sin eventos</div>}
                </div>
              </div>

              <div className="panel"><div className="panel-header"><div className="panel-title">Tendencia mensual</div></div>
                <div className="panel-body" style={{height:300}}>
                  {data.tecnovigilancia.tendencia?.length>0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.tecnovigilancia.tendencia} margin={{top:4,right:10,left:-20,bottom:10}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={G.cardBorder} />
                        <XAxis dataKey="mes" tick={tickStyle} />
                        <YAxis tick={tickStyle} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Line type="monotone" dataKey="total" stroke={G.danger} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <div className="empty-state">Sin datos</div>}
                </div>
              </div>
            </div>

            <div className="panel"><div className="panel-header"><div className="panel-title">Por tipo de evento</div></div>
              {data.tecnovigilancia.porTipo?.length>0 ? (
                <table className="data-table">
                  <thead><tr><th>Tipo de evento</th><th>Total</th></tr></thead>
                  <tbody>{data.tecnovigilancia.porTipo.map((t,i)=>(
                    <tr key={i}>
                      <td><span className="badge badge-gray">{t.tipo}</span></td>
                      <td style={{fontFamily:'IBM Plex Mono',fontWeight:600}}>{t.total}</td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <div className="empty-state">Sin datos</div>}
            </div>
          </>
        )}

        {/* TAB 6: ENVEJECIMIENTO */}
        {tab==='envejecimiento' && data.envejecimiento && (
          <>
            <div className="chart-grid">
              <div className="panel"><div className="panel-header"><div className="panel-title">Distribución por antigüedad</div></div>
                <div className="panel-body" style={{height:300}}>
                  {data.envejecimiento.distribucion?.length>0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.envejecimiento.distribucion} margin={{top:4,right:10,left:-20,bottom:10}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={G.cardBorder} />
                        <XAxis dataKey="rango" tick={tickStyle} />
                        <YAxis tick={tickStyle} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="total" fill={G.accent} radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="empty-state">Sin datos</div>}
                </div>
              </div>

              <div className="panel"><div className="panel-header"><div className="panel-title">Estado INVIMA</div></div>
                <div className="panel-body" style={{height:300}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[
                        {name:'Vigente', value:parseInt(data.envejecimiento.invima?.vigente||0)},
                        {name:'Por vencer (30d)', value:parseInt(data.envejecimiento.invima?.por_vencer||0)},
                        {name:'Vencido', value:parseInt(data.envejecimiento.invima?.vencido||0)},
                        {name:'Sin fecha', value:parseInt(data.envejecimiento.invima?.sin_fecha||0)},
                      ]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({name,value})=>`${name}: ${value}`}>
                        <Cell fill={G.accent} /><Cell fill={G.warning} /><Cell fill={G.danger} /><Cell fill={G.textMuted} />
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="panel"><div className="panel-header"><div className="panel-title">Edad promedio por servicio</div></div>
              {data.envejecimiento.porServicio?.length>0 ? (
                <table className="data-table">
                  <thead><tr><th>Servicio</th><th># Equipos</th><th>Edad promedio (años)</th></tr></thead>
                  <tbody>{data.envejecimiento.porServicio.map((s,i)=>(
                    <tr key={i}>
                      <td style={{fontWeight:500}}>{s.servicio}</td>
                      <td style={{fontFamily:'IBM Plex Mono'}}>{s.total}</td>
                      <td style={{fontFamily:'IBM Plex Mono',color:s.edad_promedio>=5?G.warning:G.accent}}>{s.edad_promedio||0} años</td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <div className="empty-state">Sin datos</div>}
            </div>
          </>
        )}

        {/* TAB 7: ALERTAS PREDICTIVAS */}
        {tab==='alertas' && data.alertas && (
          <>
            <div className="kpi-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
              <div className="kpi-card orange"><div className="kpi-label">Sin mantenimiento &gt;180 días</div><div className="kpi-value">{data.alertas.equiposSinMantenimiento?.length||0}</div></div>
              <div className="kpi-card red"><div className="kpi-label">OTs vencidas</div><div className="kpi-value">{data.alertas.otsVencidas?.length||0}</div></div>
              <div className="kpi-card purple"><div className="kpi-label">INVIMA crítico</div><div className="kpi-value">{data.alertas.invimaCritico?.length||0}</div></div>
            </div>

            <div className="panel"><div className="panel-header"><div className="panel-title">⏰ Equipos sin mantenimiento &gt;180 días</div></div>
              {data.alertas.equiposSinMantenimiento?.length>0 ? (
                <table className="data-table">
                  <thead><tr><th>Equipo</th><th>Marca/Modelo</th><th>Servicio</th><th>Tipo</th><th>Días sin mant.</th></tr></thead>
                  <tbody>{data.alertas.equiposSinMantenimiento.map(e=>(
                    <tr key={e.id}>
                      <td style={{fontWeight:500}}>{e.nombre}</td>
                      <td style={{color:G.textMuted}}>{e.marca} {e.modelo}</td>
                      <td style={{color:G.textMuted}}>{e.servicio||'—'}</td>
                      <td>{e.tipo_equipo?<span className="badge badge-purple">{e.tipo_equipo}</span>:'—'}</td>
                      <td><span className={`badge ${e.dias_sin_mant>=365?'badge-red':e.dias_sin_mant>=270?'badge-orange':'badge-gray'}`}>{e.dias_sin_mant} días</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <div className="empty-state">✓ Todos los equipos están al día</div>}
            </div>

            <div className="panel" style={{marginTop:16}}><div className="panel-header"><div className="panel-title">🚨 OTs vencidas (programadas y no realizadas)</div></div>
              {data.alertas.otsVencidas?.length>0 ? (
                <table className="data-table">
                  <thead><tr><th>Equipo</th><th>Servicio</th><th>Tipo OT</th><th>Prioridad</th><th>Programada</th><th>Días atraso</th></tr></thead>
                  <tbody>{data.alertas.otsVencidas.map(o=>(
                    <tr key={o.id}>
                      <td style={{fontWeight:500}}>{o.equipo_nombre}</td>
                      <td style={{color:G.textMuted}}>{o.servicio||'—'}</td>
                      <td><span className="badge badge-gray">{o.tipo}</span></td>
                      <td><span className={`badge ${o.prioridad==='CRITICA'?'badge-red':o.prioridad==='ALTA'?'badge-orange':'badge-gray'}`}>{o.prioridad}</span></td>
                      <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{fmtFecha(o.fecha_programada)}</td>
                      <td><span className="badge badge-red">{o.dias_atraso} días</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <div className="empty-state">✓ Sin OTs vencidas</div>}
            </div>

            <div className="panel" style={{marginTop:16}}><div className="panel-header"><div className="panel-title">📜 INVIMA vencido o por vencer (60 días)</div></div>
              {data.alertas.invimaCritico?.length>0 ? (
                <table className="data-table">
                  <thead><tr><th>Equipo</th><th>Marca/Modelo</th><th>Servicio</th><th>Vencimiento</th><th>Días restantes</th></tr></thead>
                  <tbody>{data.alertas.invimaCritico.map(e=>(
                    <tr key={e.id}>
                      <td style={{fontWeight:500}}>{e.nombre}</td>
                      <td style={{color:G.textMuted}}>{e.marca} {e.modelo}</td>
                      <td style={{color:G.textMuted}}>{e.servicio||'—'}</td>
                      <td style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{fmtFecha(e.fecha_vencimiento_invima)}</td>
                      <td><span className={`badge ${e.dias_restantes<=0?'badge-red':e.dias_restantes<=30?'badge-orange':'badge-gray'}`}>{e.dias_restantes<=0?'VENCIDO':`${e.dias_restantes} días`}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <div className="empty-state">✓ Todos los registros INVIMA están vigentes</div>}
            </div>
          </>
        )}

      </div>
    </>
  );
}