import { useEffect, useRef, useState } from 'react';

const API = 'https://his-biomedico-production.up.railway.app';

const G = {
  bg:'#0f1623', card:'#19253a', cardBorder:'#1e2f47',
  accent:'#00e5a0', accentDim:'#00b87a', danger:'#ff4d6d', warning:'#ffb347',
  text:'#e2eaf4', textMuted:'#6b8099', input:'#0f1e30', inputBorder:'#1e3a56',
};

const ITEMS_RECEPCION = [
  '1. Apariencia y condiciones físicas del equipo',
  '2. Condiciones ambientales del equipo',
  '3. Auto check, pruebas de encendido y operación',
  '4. Revisión de sistema eléctrico',
  '5. Revisión de sistema mecánico (puertas, resortes, engranes, válvulas)',
  '6. Revisión de sistema óptico',
  '7. Revisión de sistema hidráulico',
  '8. Revisión de sistema electrónico',
  '9. Revisión de sistema neumático',
  '10. Verificación de periféricos y/o accesorios',
  '11. Verificación de configuración',
  '12. Condiciones de limpieza',
  '13. Sello de garantía'
];

const OPCIONES_ESTADO = ['','Adecuadas','Inadecuadas','Cumple','No cumple','No aplica'];

// ─── COMPONENTE FIRMA DIGITAL ────────────────────────────────────────
function FirmaDigital({ valor, onChange, label }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (valor) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = valor;
    }
  // eslint-disable-next-line
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const start = (e) => {
    e.preventDefault();
    setDrawing(true);
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    ctx.lineCap = 'round';
  };

  const draw = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stop = () => {
    if (!drawing) return;
    setDrawing(false);
    const data = canvasRef.current.toDataURL('image/png');
    onChange(data);
  };

  const limpiar = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };

  return (
    <div>
      <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:6}}>{label}</div>
      <div style={{position:'relative'}}>
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          style={{width:'100%',height:120,border:`1px dashed ${G.inputBorder}`,borderRadius:4,background:'#fff',cursor:'crosshair',touchAction:'none'}}
          onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
        />
        <button
          type="button"
          onClick={limpiar}
          style={{position:'absolute',top:4,right:4,background:'rgba(255,77,109,0.9)',color:'#fff',border:'none',borderRadius:3,padding:'2px 8px',fontSize:10,cursor:'pointer',fontWeight:600}}
        >Limpiar</button>
      </div>
      <div style={{fontSize:10,color:G.textMuted,marginTop:4,textAlign:'center',fontStyle:'italic'}}>Firma aquí con el mouse o el dedo</div>
    </div>
  );
}

// ─── MODAL REPORTE COMPLETO ──────────────────────────────────────────
export default function ModalReporte({ ot, token, onClose, onSaved }) {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [protocolosDisp, setProtocolosDisp] = useState([]);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const [form, setForm] = useState({
    numero_reporte:'', tipo_reporte:'Preventivo', fecha_inicio:'', fecha_entrega:'', estado_reporte:'En proceso',
    protocolo_id:'', obs_recepcion:'', trabajo_realizado:'', obs_entrega:'', repuestos_texto:'',
    resp_servicio_nombre:'', resp_servicio_cc:'', resp_servicio_cargo:'', resp_servicio_firma:'',
    resp_recepcion_nombre:'', resp_recepcion_cc:'', resp_recepcion_cargo:'', resp_recepcion_firma:'',
  });
  const [recepcion, setRecepcion] = useState(ITEMS_RECEPCION.map((t,i)=>({item_numero:i+1, item_texto:t, estado:''})));
  const [entrega, setEntrega] = useState(ITEMS_RECEPCION.map((t,i)=>({item_numero:i+1, item_texto:t, estado:''})));
  const [actividades, setActividades] = useState([]);
  const [fotos, setFotos] = useState([]);

  // Cargar datos iniciales
  useEffect(() => {
    fetch(`${API}/reportes-mantenimiento/por-ot/${ot.id}`,{headers:{Authorization:token}})
      .then(r=>r.json())
      .then(d => {
        setDatos(d);
        // Si ya hay reporte, cargar
        if (d.id) {
          setForm({
            numero_reporte: d.numero_reporte||`R-${String(ot.id).padStart(4,'0')}`,
            tipo_reporte: d.tipo_reporte||ot.tipo||'Preventivo',
            fecha_inicio: d.fecha_inicio?.slice(0,10)||new Date().toISOString().slice(0,10),
            fecha_entrega: d.fecha_entrega?.slice(0,10)||'',
            estado_reporte: d.estado_reporte||'En proceso',
            protocolo_id: d.protocolo_id||'',
            obs_recepcion: d.obs_recepcion||'',
            trabajo_realizado: d.trabajo_realizado||'',
            obs_entrega: d.obs_entrega||'',
            repuestos_texto: d.repuestos_texto||'',
            resp_servicio_nombre: d.resp_servicio_nombre||'',
            resp_servicio_cc: d.resp_servicio_cc||'',
            resp_servicio_cargo: d.resp_servicio_cargo||'',
            resp_servicio_firma: d.resp_servicio_firma||'',
            resp_recepcion_nombre: d.resp_recepcion_nombre||'',
            resp_recepcion_cc: d.resp_recepcion_cc||'',
            resp_recepcion_cargo: d.resp_recepcion_cargo||'',
            resp_recepcion_firma: d.resp_recepcion_firma||'',
          });
          if (d.recepcion?.length) setRecepcion(d.recepcion.map(r=>({item_numero:r.item_numero, item_texto:r.item_texto, estado:r.estado||''})));
          if (d.entrega?.length) setEntrega(d.entrega.map(r=>({item_numero:r.item_numero, item_texto:r.item_texto, estado:r.estado||''})));
          if (d.actividades?.length) setActividades(d.actividades.map(a=>({orden:a.orden, actividad:a.actividad, realizado:a.realizado, observaciones:a.observaciones||''})));
          if (d.fotos?.length) setFotos(d.fotos.map(f=>({url:f.url, descripcion:f.descripcion||''})));
        } else {
          // Nuevo reporte: número correlativo + fecha hoy
          setForm(f=>({...f, numero_reporte: `R-${String(ot.id).padStart(4,'0')}`, fecha_inicio: new Date().toISOString().slice(0,10)}));
        }
        setLoading(false);
      })
      .catch(e => { console.error(e); setLoading(false); });
  // eslint-disable-next-line
  }, [ot.id]);

  // Cargar protocolos disponibles según tipo de equipo
  useEffect(() => {
    if (!datos?.tipo_equipo) return;
    fetch(`${API}/protocolos?tipo=${encodeURIComponent(datos.tipo_equipo)}`,{headers:{Authorization:token}})
      .then(r=>r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setProtocolosDisp(d);
          // Si hay un solo protocolo y no hay uno seleccionado, autoasignar
          if (d.length === 1 && !form.protocolo_id && !datos?.id) {
            setForm(f=>({...f, protocolo_id: d[0].id}));
            cargarActividadesProtocolo(d[0].id);
          }
        }
      });
  // eslint-disable-next-line
  }, [datos?.tipo_equipo]);

  const cargarActividadesProtocolo = async (protId) => {
    if (!protId) { setActividades([]); return; }
    const res = await fetch(`${API}/protocolos/${protId}`,{headers:{Authorization:token}});
    const data = await res.json();
    if (data.items) {
      setActividades(data.items.map((it,i)=>({orden:i, actividad:it.actividad, realizado:false, observaciones:''})));
    }
  };

  const cambiarProtocolo = (id) => {
    setForm({...form, protocolo_id: id});
    if (id) cargarActividadesProtocolo(parseInt(id));
    else setActividades([]);
  };

  // SUBIR FOTO A CLOUDINARY
  const subirFoto = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingFoto(true);
    const nuevas = [];
    for (const file of files) {
      if (file.size > 5*1024*1024) { alert(`${file.name} muy grande (máx 5MB)`); continue; }
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', 'biomed_logos');
        const res = await fetch('https://api.cloudinary.com/v1_1/dn4ubmehe/image/upload', {method:'POST',body:fd});
        const data = await res.json();
        if (data.secure_url) nuevas.push({url: data.secure_url, descripcion:''});
      } catch(err) { console.error(err); }
    }
    setFotos([...fotos, ...nuevas]);
    setUploadingFoto(false);
    e.target.value = '';
  };

  const cambiarRecepcion = (i, estado) => { const n=[...recepcion]; n[i].estado=estado; setRecepcion(n); };
  const cambiarEntrega = (i, estado) => { const n=[...entrega]; n[i].estado=estado; setEntrega(n); };
  const cambiarActividad = (i, campo, val) => { const n=[...actividades]; n[i][campo]=val; setActividades(n); };
  const cambiarDescFoto = (i, val) => { const n=[...fotos]; n[i].descripcion=val; setFotos(n); };
  const quitarFoto = (i) => setFotos(fotos.filter((_,j)=>j!==i));

  const guardar = async () => {
    if (!form.fecha_inicio) return alert('Fecha de inicio obligatoria');
    setSaving(true);
    const body = { mantenimiento_id: ot.id, ...form, recepcion, entrega, actividades, fotos };
    const res = await fetch(`${API}/reportes-mantenimiento`,{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:token},
      body:JSON.stringify(body)
    });
    const data = await res.json();
    setSaving(false);
    if (data.error) return alert(data.error);
    alert('Reporte guardado correctamente');
    onSaved(); onClose();
  };

  const generarPDF = () => {
    // Crear ventana imprimible
    const w = window.open('', '_blank');
    if (!w) return alert('Permite ventanas emergentes para generar el PDF');
    const inst = datos?.institucion_nombre || 'Institución';
    const logoHtml = datos?.logo_url ? `<img src="${datos.logo_url}" style="width:80px;height:80px;object-fit:contain"/>` : '';
    const fmtFecha = (f) => f ? new Date(f).toLocaleDateString('es-CO') : '—';

    const itemRow = (it) => `<tr><td style="padding:3px 6px;border:1px solid #999;font-size:9px">${it.item_texto}</td><td style="padding:3px 6px;border:1px solid #999;font-size:9px;text-align:center;width:90px">${it.estado||''}</td></tr>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte ${form.numero_reporte}</title>
    <style>
      @page { size: A4; margin: 10mm; }
      body { font-family: Arial,sans-serif; font-size:10px; color:#000; margin:0; padding:0; }
      table { border-collapse: collapse; width:100%; }
      td, th { border: 1px solid #555; padding: 4px 6px; vertical-align:top; }
      .header-tbl td { padding:6px; }
      .label { font-weight:bold; background:#f0f0f0; font-size:9px; }
      .title { font-weight:bold; text-align:center; font-size:11px; }
      .section-title { background:#0a2342; color:#fff; font-weight:bold; padding:4px; font-size:10px; }
      .firma-box { height:60px; background:#fff; }
      .firma-box img { max-height:55px; max-width:100%; }
      .no-border td { border:none; }
      h2 { font-size:12px; margin:0; }
      .small { font-size:9px; }
    </style></head><body>

    <table class="header-tbl">
      <tr>
        <td rowspan="3" style="width:90px;text-align:center">${logoHtml}</td>
        <td style="text-align:center"><h2>${inst}</h2></td>
        <td style="width:200px" class="small">
          <b>VERSION:</b> 2<br>
          <b>VIGENCIA:</b> 2026-12-31
        </td>
      </tr>
      <tr>
        <td style="text-align:center" class="title">REPORTE DE MANTENIMIENTO PREVENTIVO DE EQUIPOS BIOMEDICOS</td>
        <td class="small"><b>CODIGO:</b> GTE-FR-005</td>
      </tr>
      <tr>
        <td class="small"></td>
        <td class="small"><b>PAGINA:</b> 1 de 1</td>
      </tr>
    </table>

    <br>
    <table>
      <tr>
        <td class="label">N° REPORTE</td>
        <td>${form.numero_reporte}</td>
        <td class="label">TIPO DE REPORTE</td>
        <td>${form.tipo_reporte}</td>
        <td class="label">FECHA INICIO</td>
        <td>${fmtFecha(form.fecha_inicio)}</td>
        <td class="label">FECHA ENTREGA</td>
        <td>${fmtFecha(form.fecha_entrega)}</td>
        <td class="label">ESTADO</td>
        <td>${form.estado_reporte}</td>
      </tr>
    </table>

    <br>
    <div class="section-title">INFORMACIÓN DEL EQUIPO</div>
    <table>
      <tr>
        <td class="label" style="width:80px">EQUIPO:</td><td>${datos?.equipo_nombre||''}</td>
        <td class="label" style="width:80px">SERIE:</td><td>${datos?.serie||''}</td>
      </tr>
      <tr>
        <td class="label">MARCA:</td><td>${datos?.marca||''}</td>
        <td class="label">UBICACIÓN:</td><td>${datos?.ubicacion||''}</td>
      </tr>
      <tr>
        <td class="label">MODELO:</td><td>${datos?.modelo||''}</td>
        <td class="label">ESTADO:</td><td>${datos?.equipo_estado||''}</td>
      </tr>
    </table>

    <br>
    <table>
      <tr>
        <td colspan="2" class="section-title">CONDICIONES DE RECEPCIÓN</td>
        <td colspan="2" class="section-title">CONDICIONES DE ENTREGA</td>
      </tr>
      <tr>
        <td class="label" style="width:62%">ACTIVIDAD</td><td class="label">ESTADO</td>
        <td class="label" style="width:62%">ACTIVIDAD</td><td class="label">ESTADO</td>
      </tr>
      ${recepcion.map((r,i)=>`<tr>
        <td class="small">${r.item_texto}</td>
        <td class="small" style="text-align:center;width:70px">${r.estado||''}</td>
        <td class="small">${entrega[i]?.item_texto||''}</td>
        <td class="small" style="text-align:center;width:70px">${entrega[i]?.estado||''}</td>
      </tr>`).join('')}
    </table>

    <br>
    <div class="section-title">LISTA DE ACTIVIDADES (PROTOCOLO)</div>
    <table>
      <tr><td class="label">N°</td><td class="label" style="width:55%">ACTIVIDAD</td><td class="label">CHECK</td><td class="label">OBSERVACIONES</td></tr>
      ${actividades.length===0 ? '<tr><td colspan="4" class="small" style="text-align:center;font-style:italic">Sin actividades</td></tr>' :
        actividades.map((a,i)=>`<tr>
          <td class="small" style="text-align:center;width:30px">${i+1}</td>
          <td class="small">${a.actividad}</td>
          <td class="small" style="text-align:center;width:50px">${a.realizado?'✓':''}</td>
          <td class="small">${a.observaciones||''}</td>
        </tr>`).join('')}
    </table>

    <br>
    <table>
      <tr><td class="section-title">OBSERVACIONES DE RECEPCIÓN</td></tr>
      <tr><td style="height:40px" class="small">${form.obs_recepcion||''}</td></tr>
    </table>

    <br>
    <table>
      <tr><td class="section-title">TRABAJO REALIZADO</td></tr>
      <tr><td style="height:50px" class="small">${form.trabajo_realizado||''}</td></tr>
    </table>

    <br>
    <table>
      <tr><td class="section-title">OBSERVACIÓN DE ENTREGA</td></tr>
      <tr><td style="height:40px" class="small">${form.obs_entrega||''}</td></tr>
    </table>

    <br>
    <table>
      <tr><td class="section-title">REPUESTOS UTILIZADOS</td></tr>
      <tr><td style="height:30px" class="small">${form.repuestos_texto||'—'}</td></tr>
    </table>

    ${fotos.length>0 ? `
    <br>
    <div class="section-title">SOPORTE FOTOGRÁFICO</div>
    <table>
      <tr>
        ${fotos.map(f=>`<td style="width:33%;text-align:center;padding:4px">
          <img src="${f.url}" style="max-width:100%;max-height:140px;object-fit:contain"/>
          <div class="small" style="margin-top:4px">${f.descripcion||''}</div>
        </td>`).join('')}
      </tr>
    </table>` : ''}

    <br><br>
    <table>
      <tr>
        <td class="section-title" style="width:50%">RESPONSABLE DEL SERVICIO</td>
        <td class="section-title">RESPONSABLE DE RECEPCIÓN</td>
      </tr>
      <tr>
        <td class="firma-box" style="text-align:center">${form.resp_servicio_firma?`<img src="${form.resp_servicio_firma}" />`:''}</td>
        <td class="firma-box" style="text-align:center">${form.resp_recepcion_firma?`<img src="${form.resp_recepcion_firma}" />`:''}</td>
      </tr>
      <tr>
        <td class="small"><b>Nombre:</b> ${form.resp_servicio_nombre||''}</td>
        <td class="small"><b>Nombre:</b> ${form.resp_recepcion_nombre||''}</td>
      </tr>
      <tr>
        <td class="small"><b>C.C:</b> ${form.resp_servicio_cc||''}</td>
        <td class="small"><b>C.C:</b> ${form.resp_recepcion_cc||''}</td>
      </tr>
      <tr>
        <td class="small"><b>Cargo:</b> ${form.resp_servicio_cargo||''}</td>
        <td class="small"><b>Cargo:</b> ${form.resp_recepcion_cargo||''}</td>
      </tr>
    </table>

    <script>
      window.onload = () => { setTimeout(()=>window.print(), 600); };
    </script>
    </body></html>`;

    w.document.write(html);
    w.document.close();
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal" style={{padding:40,textAlign:'center'}}>
          <div style={{color:G.textMuted}}>Cargando reporte...</div>
        </div>
      </div>
    );
  }

  // Estilos del formulario tipo plantilla
  const tablaStyle = { width:'100%', borderCollapse:'collapse', marginBottom:14, fontSize:11 };
  const tdStyle = { border:`1px solid ${G.cardBorder}`, padding:'8px 10px', verticalAlign:'top' };
  const labelTd = { ...tdStyle, background:G.input, fontSize:10, color:G.textMuted, fontWeight:600, letterSpacing:0.5, textTransform:'uppercase', width:130 };
  const sectionTitle = {
    background:'linear-gradient(90deg, #0a2342 0%, #1a3a6e 100%)',
    color:'#fff', fontWeight:600, padding:'8px 12px', fontSize:11, letterSpacing:1,
    textTransform:'uppercase', borderRadius:'4px 4px 0 0', marginTop:18, marginBottom:0
  };
  const inputCellStyle = { width:'100%', background:'transparent', border:'none', color:G.text, fontSize:11, outline:'none', padding:0 };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:1100, maxWidth:'97vw', maxHeight:'95vh'}}>
        <div className="modal-header">
          <div className="modal-title">📋 Reporte de Mantenimiento — {datos?.equipo_nombre}</div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-purple" onClick={generarPDF} style={{fontSize:11}}>↓ Generar PDF</button>
            <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="modal-body" style={{padding:16}}>

          {/* ENCABEZADO TIPO PLANTILLA */}
          <table style={tablaStyle}>
            <tbody>
              <tr>
                <td rowSpan="3" style={{...tdStyle, width:90, textAlign:'center', background:'#fff'}}>
                  {datos?.logo_url ? <img src={datos.logo_url} alt="" style={{width:70,height:70,objectFit:'contain'}} /> : <div style={{fontSize:32}}>🏥</div>}
                </td>
                <td style={{...tdStyle, textAlign:'center', fontWeight:600, fontSize:12, background:G.input}}>
                  {datos?.institucion_nombre || 'Institución'}
                </td>
                <td style={{...tdStyle, width:200, fontSize:10}}>
                  <b>VERSION:</b> 2<br/><b>VIGENCIA:</b> 2026-12-31
                </td>
              </tr>
              <tr>
                <td style={{...tdStyle, textAlign:'center', fontWeight:700, fontSize:11, background:'#0a2342', color:'#fff'}}>
                  REPORTE DE MANTENIMIENTO PREVENTIVO DE EQUIPOS BIOMEDICOS
                </td>
                <td style={{...tdStyle, fontSize:10}}><b>CODIGO:</b> GTE-FR-005</td>
              </tr>
              <tr>
                <td style={tdStyle}></td>
                <td style={{...tdStyle, fontSize:10}}><b>PAGINA:</b> 1 de 1</td>
              </tr>
            </tbody>
          </table>

          {/* DATOS DEL REPORTE */}
          <table style={tablaStyle}>
            <tbody>
              <tr>
                <td style={labelTd}>N° REPORTE</td>
                <td style={tdStyle}><input style={inputCellStyle} value={form.numero_reporte} onChange={e=>setForm({...form,numero_reporte:e.target.value})} /></td>
                <td style={labelTd}>TIPO REPORTE</td>
                <td style={tdStyle}>
                  <select style={inputCellStyle} value={form.tipo_reporte} onChange={e=>setForm({...form,tipo_reporte:e.target.value})}>
                    {['Preventivo','Correctivo','Calibración','Inspección'].map(t=><option key={t} style={{background:G.input}}>{t}</option>)}
                  </select>
                </td>
                <td style={labelTd}>ESTADO</td>
                <td style={tdStyle}>
                  <select style={inputCellStyle} value={form.estado_reporte} onChange={e=>setForm({...form,estado_reporte:e.target.value})}>
                    {['En proceso','Finalizado','Pendiente revisión'].map(t=><option key={t} style={{background:G.input}}>{t}</option>)}
                  </select>
                </td>
              </tr>
              <tr>
                <td style={labelTd}>FECHA INICIO</td>
                <td style={tdStyle}><input type="date" style={inputCellStyle} value={form.fecha_inicio} onChange={e=>setForm({...form,fecha_inicio:e.target.value})} /></td>
                <td style={labelTd}>FECHA ENTREGA</td>
                <td style={tdStyle}><input type="date" style={inputCellStyle} value={form.fecha_entrega} onChange={e=>setForm({...form,fecha_entrega:e.target.value})} /></td>
                <td style={labelTd}>PROTOCOLO</td>
                <td style={tdStyle}>
                  <select style={inputCellStyle} value={form.protocolo_id} onChange={e=>cambiarProtocolo(e.target.value)}>
                    <option value="" style={{background:G.input}}>— Sin protocolo —</option>
                    {protocolosDisp.map(p=><option key={p.id} value={p.id} style={{background:G.input}}>{p.nombre}</option>)}
                  </select>
                </td>
              </tr>
            </tbody>
          </table>

          {/* INFORMACIÓN DEL EQUIPO */}
          <div style={sectionTitle}>INFORMACIÓN DEL EQUIPO</div>
          <table style={{...tablaStyle, marginTop:0, borderTopLeftRadius:0, borderTopRightRadius:0}}>
            <tbody>
              <tr>
                <td style={labelTd}>EQUIPO</td>
                <td style={tdStyle}>{datos?.equipo_nombre||'—'}</td>
                <td style={labelTd}>SERIE</td>
                <td style={tdStyle}>{datos?.serie||'—'}</td>
              </tr>
              <tr>
                <td style={labelTd}>MARCA</td>
                <td style={tdStyle}>{datos?.marca||'—'}</td>
                <td style={labelTd}>UBICACIÓN</td>
                <td style={tdStyle}>{datos?.ubicacion||'—'}</td>
              </tr>
              <tr>
                <td style={labelTd}>MODELO</td>
                <td style={tdStyle}>{datos?.modelo||'—'}</td>
                <td style={labelTd}>ESTADO</td>
                <td style={tdStyle}>{datos?.equipo_estado||'—'}</td>
              </tr>
              <tr>
                <td style={labelTd}>TIPO EQUIPO</td>
                <td colSpan="3" style={tdStyle}>{datos?.tipo_equipo||'No definido'}</td>
              </tr>
            </tbody>
          </table>

          {/* CONDICIONES DE RECEPCIÓN Y ENTREGA */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:18}}>
            <div>
              <div style={{...sectionTitle, marginTop:0}}>CONDICIONES DE RECEPCIÓN</div>
              <table style={{...tablaStyle, marginTop:0}}>
                <thead>
                  <tr>
                    <th style={{...labelTd, fontSize:9}}>ACTIVIDAD</th>
                    <th style={{...labelTd, fontSize:9, width:110}}>ESTADO</th>
                  </tr>
                </thead>
                <tbody>
                  {recepcion.map((it,i)=>(
                    <tr key={i}>
                      <td style={{...tdStyle, fontSize:10, padding:'5px 8px'}}>{it.item_texto}</td>
                      <td style={{...tdStyle, padding:'2px 4px'}}>
                        <select style={{...inputCellStyle, fontSize:10}} value={it.estado} onChange={e=>cambiarRecepcion(i, e.target.value)}>
                          {OPCIONES_ESTADO.map(op=><option key={op} value={op} style={{background:G.input}}>{op||'—'}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div style={{...sectionTitle, marginTop:0}}>CONDICIONES DE ENTREGA</div>
              <table style={{...tablaStyle, marginTop:0}}>
                <thead>
                  <tr>
                    <th style={{...labelTd, fontSize:9}}>ACTIVIDAD</th>
                    <th style={{...labelTd, fontSize:9, width:110}}>ESTADO</th>
                  </tr>
                </thead>
                <tbody>
                  {entrega.map((it,i)=>(
                    <tr key={i}>
                      <td style={{...tdStyle, fontSize:10, padding:'5px 8px'}}>{it.item_texto}</td>
                      <td style={{...tdStyle, padding:'2px 4px'}}>
                        <select style={{...inputCellStyle, fontSize:10}} value={it.estado} onChange={e=>cambiarEntrega(i, e.target.value)}>
                          {OPCIONES_ESTADO.map(op=><option key={op} value={op} style={{background:G.input}}>{op||'—'}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* LISTA DE ACTIVIDADES (PROTOCOLO) */}
          <div style={sectionTitle}>LISTA DE ACTIVIDADES (PROTOCOLO)</div>
          <table style={{...tablaStyle, marginTop:0}}>
            <thead>
              <tr>
                <th style={{...labelTd, width:36, textAlign:'center'}}>N°</th>
                <th style={{...labelTd}}>ACTIVIDAD</th>
                <th style={{...labelTd, width:60, textAlign:'center'}}>CHECK</th>
                <th style={{...labelTd}}>OBSERVACIONES</th>
              </tr>
            </thead>
            <tbody>
              {actividades.length === 0 ? (
                <tr><td colSpan="4" style={{...tdStyle, textAlign:'center', fontStyle:'italic', color:G.textMuted, padding:14}}>
                  {form.protocolo_id ? 'Cargando actividades...' : 'Selecciona un protocolo arriba para cargar la lista de actividades, o continúa sin protocolo'}
                </td></tr>
              ) : actividades.map((a,i)=>(
                <tr key={i}>
                  <td style={{...tdStyle, textAlign:'center', fontFamily:'IBM Plex Mono', fontSize:10}}>{i+1}</td>
                  <td style={{...tdStyle, fontSize:10}}>{a.actividad}</td>
                  <td style={{...tdStyle, textAlign:'center'}}>
                    <input type="checkbox" checked={!!a.realizado} onChange={e=>cambiarActividad(i, 'realizado', e.target.checked)} style={{cursor:'pointer',width:16,height:16}} />
                  </td>
                  <td style={{...tdStyle, padding:'2px 4px'}}>
                    <input style={{...inputCellStyle, fontSize:10}} value={a.observaciones} onChange={e=>cambiarActividad(i, 'observaciones', e.target.value)} placeholder="Observaciones..." />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* OBSERVACIONES DE RECEPCIÓN */}
          <div style={sectionTitle}>OBSERVACIONES DE RECEPCIÓN</div>
          <textarea value={form.obs_recepcion} onChange={e=>setForm({...form,obs_recepcion:e.target.value})}
            style={{width:'100%',minHeight:60,background:G.input,border:`1px solid ${G.cardBorder}`,borderTop:'none',color:G.text,padding:10,fontSize:11,outline:'none',resize:'vertical',borderRadius:'0 0 4px 4px',marginBottom:14}} />

          {/* TRABAJO REALIZADO */}
          <div style={sectionTitle}>TRABAJO REALIZADO</div>
          <textarea value={form.trabajo_realizado} onChange={e=>setForm({...form,trabajo_realizado:e.target.value})}
            style={{width:'100%',minHeight:80,background:G.input,border:`1px solid ${G.cardBorder}`,borderTop:'none',color:G.text,padding:10,fontSize:11,outline:'none',resize:'vertical',borderRadius:'0 0 4px 4px',marginBottom:14}} />

          {/* OBSERVACIÓN DE ENTREGA */}
          <div style={sectionTitle}>OBSERVACIÓN DE ENTREGA</div>
          <textarea value={form.obs_entrega} onChange={e=>setForm({...form,obs_entrega:e.target.value})}
            style={{width:'100%',minHeight:60,background:G.input,border:`1px solid ${G.cardBorder}`,borderTop:'none',color:G.text,padding:10,fontSize:11,outline:'none',resize:'vertical',borderRadius:'0 0 4px 4px',marginBottom:14}} />

          {/* REPUESTOS UTILIZADOS */}
          <div style={sectionTitle}>REPUESTOS UTILIZADOS</div>
          <textarea value={form.repuestos_texto} onChange={e=>setForm({...form,repuestos_texto:e.target.value})} placeholder="Listado de repuestos usados..."
            style={{width:'100%',minHeight:50,background:G.input,border:`1px solid ${G.cardBorder}`,borderTop:'none',color:G.text,padding:10,fontSize:11,outline:'none',resize:'vertical',borderRadius:'0 0 4px 4px',marginBottom:14}} />

          {/* SOPORTE FOTOGRÁFICO */}
          <div style={sectionTitle}>SOPORTE FOTOGRÁFICO ({fotos.length})</div>
          <div style={{background:G.input,border:`1px solid ${G.cardBorder}`,borderTop:'none',padding:14,borderRadius:'0 0 4px 4px',marginBottom:14}}>
            <input id="foto-upload" type="file" accept="image/*" multiple onChange={subirFoto} style={{display:'none'}} />
            <label htmlFor="foto-upload" className="btn btn-primary" style={{cursor:'pointer',fontSize:11,marginBottom:12}}>
              {uploadingFoto ? '⏳ Subiendo...' : '↑ Subir fotos'}
            </label>
            {fotos.length > 0 && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))',gap:10,marginTop:10}}>
                {fotos.map((f,i)=>(
                  <div key={i} style={{background:G.bg,border:`1px solid ${G.cardBorder}`,borderRadius:4,padding:6,position:'relative'}}>
                    <button onClick={()=>quitarFoto(i)} style={{position:'absolute',top:4,right:4,background:'rgba(255,77,109,0.9)',color:'#fff',border:'none',borderRadius:3,padding:'2px 6px',fontSize:10,cursor:'pointer',zIndex:1}}>✕</button>
                    <img src={f.url} alt="" style={{width:'100%',height:120,objectFit:'cover',borderRadius:3,marginBottom:6}} />
                    <input value={f.descripcion} onChange={e=>cambiarDescFoto(i, e.target.value)} placeholder="Descripción..."
                      style={{width:'100%',background:G.input,border:`1px solid ${G.inputBorder}`,borderRadius:3,padding:'4px 6px',color:G.text,fontSize:10,outline:'none'}} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RESPONSABLES Y FIRMAS */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:18}}>
            {/* Responsable del servicio */}
            <div>
              <div style={{...sectionTitle, marginTop:0}}>RESPONSABLE DEL SERVICIO</div>
              <div style={{background:G.input,border:`1px solid ${G.cardBorder}`,borderTop:'none',padding:12,borderRadius:'0 0 4px 4px'}}>
                <FirmaDigital
                  label="Firma"
                  valor={form.resp_servicio_firma}
                  onChange={(v)=>setForm({...form,resp_servicio_firma:v})}
                />
                <div style={{marginTop:10}}>
                  <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:4}}>Nombre</div>
                  <input value={form.resp_servicio_nombre} onChange={e=>setForm({...form,resp_servicio_nombre:e.target.value})} style={{width:'100%',background:G.bg,border:`1px solid ${G.inputBorder}`,borderRadius:4,padding:'6px 10px',color:G.text,fontSize:12,outline:'none',marginBottom:8}} />
                  <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:4}}>C.C</div>
                  <input value={form.resp_servicio_cc} onChange={e=>setForm({...form,resp_servicio_cc:e.target.value})} style={{width:'100%',background:G.bg,border:`1px solid ${G.inputBorder}`,borderRadius:4,padding:'6px 10px',color:G.text,fontSize:12,outline:'none',marginBottom:8}} />
                  <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:4}}>Cargo</div>
                  <input value={form.resp_servicio_cargo} onChange={e=>setForm({...form,resp_servicio_cargo:e.target.value})} style={{width:'100%',background:G.bg,border:`1px solid ${G.inputBorder}`,borderRadius:4,padding:'6px 10px',color:G.text,fontSize:12,outline:'none'}} />
                </div>
              </div>
            </div>

            {/* Responsable de recepción */}
            <div>
              <div style={{...sectionTitle, marginTop:0}}>RESPONSABLE DE RECEPCIÓN</div>
              <div style={{background:G.input,border:`1px solid ${G.cardBorder}`,borderTop:'none',padding:12,borderRadius:'0 0 4px 4px'}}>
                <FirmaDigital
                  label="Firma"
                  valor={form.resp_recepcion_firma}
                  onChange={(v)=>setForm({...form,resp_recepcion_firma:v})}
                />
                <div style={{marginTop:10}}>
                  <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:4}}>Nombre</div>
                  <input value={form.resp_recepcion_nombre} onChange={e=>setForm({...form,resp_recepcion_nombre:e.target.value})} style={{width:'100%',background:G.bg,border:`1px solid ${G.inputBorder}`,borderRadius:4,padding:'6px 10px',color:G.text,fontSize:12,outline:'none',marginBottom:8}} />
                  <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:4}}>C.C</div>
                  <input value={form.resp_recepcion_cc} onChange={e=>setForm({...form,resp_recepcion_cc:e.target.value})} style={{width:'100%',background:G.bg,border:`1px solid ${G.inputBorder}`,borderRadius:4,padding:'6px 10px',color:G.text,fontSize:12,outline:'none',marginBottom:8}} />
                  <div style={{fontSize:10,color:G.textMuted,letterSpacing:1,textTransform:'uppercase',fontWeight:600,marginBottom:4}}>Cargo</div>
                  <input value={form.resp_recepcion_cargo} onChange={e=>setForm({...form,resp_recepcion_cargo:e.target.value})} style={{width:'100%',background:G.bg,border:`1px solid ${G.inputBorder}`,borderRadius:4,padding:'6px 10px',color:G.text,fontSize:12,outline:'none'}} />
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="modal-footer" style={{position:'sticky',bottom:0,background:G.card,zIndex:5}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-purple" onClick={generarPDF}>↓ Generar PDF</button>
          <button className="btn btn-primary" onClick={guardar} disabled={saving}>
            {saving ? 'Guardando...' : '✓ Guardar reporte'}
          </button>
        </div>
      </div>
    </div>
  );
}