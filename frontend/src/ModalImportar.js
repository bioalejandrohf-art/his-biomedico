import { useState } from 'react';
import * as XLSX from 'xlsx';

const API = 'https://his-biomedico-production.up.railway.app';

const G = {
  bg:'#0f1623', card:'#19253a', cardBorder:'#1e2f47',
  accent:'#00e5a0', accentDim:'#00b87a', danger:'#ff4d6d', warning:'#ffb347',
  text:'#e2eaf4', textMuted:'#6b8099', input:'#0f1e30', inputBorder:'#1e3a56',
};

// Mapa de sinónimos para autodetección de columnas
const MAPA_COLUMNAS = {
  nombre: ['nombre','equipo','nombre del equipo','nombre equipo','equipo biomedico','descripcion'],
  marca: ['marca','fabricante','brand'],
  modelo: ['modelo','model','referencia','ref'],
  serie: ['serie','numero de serie','n° serie','serial','no serie','no. serie','número serie','nro serie'],
  registro_invima: ['registro invima','invima','registro','reg invima','reg. invima','no invima','número invima'],
  fecha_vencimiento_invima: ['vencimiento invima','vence invima','fecha vencimiento','vencimiento','venc invima','venc. invima','fecha venc'],
  clasificacion_riesgo: ['clasificacion riesgo','riesgo','clase','clasificacion','clase riesgo','clasificación'],
  ubicacion: ['ubicacion','ubicación','area','sala','consultorio','lugar'],
  servicio: ['servicio','area','departamento','seccion','sección','servicio clinico'],
  estado: ['estado','status','condicion','condición'],
};

const normalizar = (s) => (s||'').toString().trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // quita tildes
  .replace(/\s+/g,' ');

const detectarColumna = (header) => {
  const h = normalizar(header);
  for (const [campo, sinonimos] of Object.entries(MAPA_COLUMNAS)) {
    if (sinonimos.some(s => normalizar(s) === h)) return campo;
    if (sinonimos.some(s => h.includes(normalizar(s)))) return campo;
  }
  return null;
};

// Convertir fecha de Excel a formato YYYY-MM-DD
const parsearFecha = (val) => {
  if (!val) return '';
  // Si ya es string formato fecha
  if (typeof val === 'string') {
    const limpio = val.trim();
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(limpio)) return limpio.slice(0,10);
    // DD/MM/YYYY o DD-MM-YYYY
    const m = limpio.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return '';
  }
  // Si es número (fecha de Excel)
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) return `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`;
  }
  // Si es Date
  if (val instanceof Date) {
    return val.toISOString().slice(0,10);
  }
  return '';
};

const normalizarRiesgo = (val) => {
  if (!val) return '';
  const v = val.toString().trim().toUpperCase().replace(/\s+/g,'');
  if (['I','1','CLASEI','CLASE1'].includes(v)) return 'I';
  if (['IIA','2A','CLASEIIA','CLASE2A'].includes(v)) return 'IIa';
  if (['IIB','2B','CLASEIIB','CLASE2B'].includes(v)) return 'IIb';
  if (['III','3','CLASEIII','CLASE3'].includes(v)) return 'III';
  return '';
};

const normalizarEstado = (val) => {
  if (!val) return '';
  const v = val.toString().trim().toLowerCase();
  if (['activo','operativo','funcional','funcionando'].includes(v)) return 'Activo';
  if (['mantenimiento','en mantenimiento','reparacion','reparación'].includes(v)) return 'Mantenimiento';
  if (['baja','dado de baja','inactivo','descartado'].includes(v)) return 'Baja';
  return val.toString().trim();
};

export default function ModalImportar({ token, equiposActuales, onClose, onSaved }) {
  const [paso, setPaso] = useState(1); // 1=upload, 2=mapeo, 3=preview, 4=resultado
  const [archivo, setArchivo] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [filas, setFilas] = useState([]);
  const [mapeo, setMapeo] = useState({});
  const [datosFinales, setDatosFinales] = useState([]);
  const [duplicados, setDuplicados] = useState([]);
  const [accionesDup, setAccionesDup] = useState({}); // { serie: 'sobrescribir' | 'saltar' }
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);

  // PASO 1: Descargar plantilla
  const descargarPlantilla = () => {
    const data = [
      ['Nombre','Marca','Modelo','Serie','Registro INVIMA','Vencimiento INVIMA','Clasificación Riesgo','Ubicación','Servicio','Estado'],
      ['Monitor Signos Vitales','Mindray','VS-800','MND-001-2024','2020M-0012345-R1','2027-12-31','IIa','UCI Adultos','UCI','Activo'],
      ['Desfibrilador','Philips','HeartStart','PHL-456','2019M-9876543','2026-06-15','III','Urgencias','Urgencias','Activo'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch:25},{wch:15},{wch:15},{wch:18},{wch:20},{wch:14},{wch:12},{wch:18},{wch:15},{wch:12}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipos');
    XLSX.writeFile(wb, 'plantilla_equipos_biomed.xlsx');
  };

  // PASO 1: Cargar archivo
  const cargarArchivo = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setArchivo(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type:'array', cellDates:true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header:1, defval:'', raw:false });
        if (json.length < 2) { alert('Archivo vacío o sin datos'); return; }

        const heads = json[0].map(h => h.toString().trim());
        const datas = json.slice(1).filter(row => row.some(c => c !== '' && c !== null));

        setHeaders(heads);
        setFilas(datas);

        // Autodetectar mapeo
        const map = {};
        heads.forEach((h, i) => {
          const campo = detectarColumna(h);
          if (campo && !Object.values(map).includes(campo)) map[i] = campo;
        });
        setMapeo(map);
        setPaso(2);
      } catch (err) {
        alert('Error al leer archivo: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(f);
  };

  // PASO 2 → 3: Procesar mapeo y detectar duplicados
  const procesarMapeo = () => {
    if (!Object.values(mapeo).includes('nombre')) {
      alert('Debes mapear al menos la columna "Nombre"');
      return;
    }

    const procesados = filas.map((row, idx) => {
      const obj = { _row: idx + 2 }; // fila Excel real
      Object.entries(mapeo).forEach(([colIdx, campo]) => {
        let val = row[colIdx];
        if (campo === 'fecha_vencimiento_invima') val = parsearFecha(val);
        else if (campo === 'clasificacion_riesgo') val = normalizarRiesgo(val);
        else if (campo === 'estado') val = normalizarEstado(val);
        else val = (val||'').toString().trim();
        obj[campo] = val;
      });
      return obj;
    }).filter(r => r.nombre); // descartar filas sin nombre

    // Detectar duplicados (mismo serial en BD)
    const seriesExistentes = new Set(equiposActuales.filter(e=>e.serie).map(e=>e.serie.toString().trim().toLowerCase()));
    const dups = procesados.filter(p => p.serie && seriesExistentes.has(p.serie.toLowerCase()));
    const acciones = {};
    dups.forEach(d => { acciones[d.serie] = 'saltar'; }); // por defecto saltar

    setDatosFinales(procesados);
    setDuplicados(dups);
    setAccionesDup(acciones);
    setPaso(3);
  };

  // PASO 3 → 4: Importar
  const importar = async () => {
    setImportando(true);
    let creados = 0, actualizados = 0, errores = 0;
    const erroresList = [];

    for (const eq of datosFinales) {
      try {
        // Verificar si es duplicado
        const esDup = duplicados.find(d => d.serie === eq.serie);
        if (esDup) {
          const accion = accionesDup[eq.serie];
          if (accion === 'saltar') continue;
          if (accion === 'sobrescribir') {
            // Buscar id del existente
            const existente = equiposActuales.find(e => e.serie?.toLowerCase() === eq.serie.toLowerCase());
            if (existente) {
              await fetch(`${API}/equipos/${existente.id}`,{
                method:'PUT', headers:{'Content-Type':'application/json',Authorization:token},
                body: JSON.stringify(eq)
              });
              actualizados++;
              continue;
            }
          }
        }
        // Crear nuevo
        const res = await fetch(`${API}/equipos`,{
          method:'POST', headers:{'Content-Type':'application/json',Authorization:token},
          body: JSON.stringify(eq)
        });
        const data = await res.json();
        if (data.error) { errores++; erroresList.push(`Fila ${eq._row}: ${data.error}`); }
        else creados++;
      } catch(e) {
        errores++;
        erroresList.push(`Fila ${eq._row}: ${e.message}`);
      }
    }

    setResultado({ creados, actualizados, errores, erroresList });
    setImportando(false);
    setPaso(4);
  };

  const cerrarYRefrescar = () => { onSaved(); onClose(); };

  const camposDisponibles = ['nombre','marca','modelo','serie','registro_invima','fecha_vencimiento_invima','clasificacion_riesgo','ubicacion','servicio','estado'];
  const labelCampo = {
    nombre:'Nombre *', marca:'Marca', modelo:'Modelo', serie:'Serie',
    registro_invima:'Reg. INVIMA', fecha_vencimiento_invima:'Venc. INVIMA',
    clasificacion_riesgo:'Riesgo', ubicacion:'Ubicación', servicio:'Servicio', estado:'Estado'
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:780, maxWidth:'95vw'}}>
        <div className="modal-header">
          <div className="modal-title">📊 Importar Equipos — Paso {paso} de 4</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">

          {/* PASO 1: Subir archivo */}
          {paso === 1 && (
            <>
              <div style={{textAlign:'center',padding:'30px 0'}}>
                <div style={{fontSize:48,marginBottom:16}}>📂</div>
                <div style={{fontSize:14,fontWeight:600,color:G.text,marginBottom:6}}>Sube tu archivo Excel o CSV</div>
                <div style={{fontSize:12,color:G.textMuted,marginBottom:24}}>Detectaremos automáticamente las columnas</div>

                <input id="file-import" type="file" accept=".xlsx,.xls,.csv" onChange={cargarArchivo} style={{display:'none'}} />
                <label htmlFor="file-import" className="btn btn-primary" style={{cursor:'pointer',padding:'10px 24px'}}>
                  📁 Seleccionar archivo
                </label>

                <div style={{marginTop:24,padding:16,background:G.input,borderRadius:6,fontSize:12,color:G.textMuted,textAlign:'left'}}>
                  <b style={{color:G.text}}>Formatos soportados:</b> .xlsx, .xls, .csv<br/>
                  <b style={{color:G.text}}>Columnas detectables automáticamente:</b><br/>
                  Nombre, Marca, Modelo, Serie, Registro INVIMA, Vencimiento INVIMA, Clasificación Riesgo, Ubicación, Servicio, Estado
                </div>

                <div style={{marginTop:16}}>
                  <button className="btn btn-ghost" onClick={descargarPlantilla}>
                    ↓ Descargar plantilla Excel
                  </button>
                </div>
              </div>
            </>
          )}

          {/* PASO 2: Mapeo de columnas */}
          {paso === 2 && (
            <>
              <div style={{marginBottom:14,padding:'10px 14px',background:G.input,borderRadius:4,fontSize:12}}>
                <b>Archivo:</b> {archivo?.name} · <b>{filas.length} filas</b> detectadas
              </div>
              <div style={{fontSize:12,color:G.textMuted,marginBottom:14}}>
                Verifica el mapeo automático de columnas. Asigna cada columna del archivo al campo correspondiente:
              </div>
              <table style={{width:'100%',fontSize:12}}>
                <thead><tr style={{borderBottom:`1px solid ${G.cardBorder}`}}>
                  <th style={{textAlign:'left',padding:'8px 4px',color:G.textMuted,fontSize:10,letterSpacing:1,textTransform:'uppercase'}}>Columna del archivo</th>
                  <th style={{textAlign:'left',padding:'8px 4px',color:G.textMuted,fontSize:10,letterSpacing:1,textTransform:'uppercase'}}>→ Campo del sistema</th>
                  <th style={{textAlign:'left',padding:'8px 4px',color:G.textMuted,fontSize:10,letterSpacing:1,textTransform:'uppercase'}}>Ejemplo</th>
                </tr></thead>
                <tbody>
                  {headers.map((h,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid rgba(30,47,71,0.5)`}}>
                      <td style={{padding:'8px 4px',fontWeight:500}}>{h}</td>
                      <td style={{padding:'8px 4px'}}>
                        <select
                          value={mapeo[i]||''}
                          onChange={e=>{
                            const nuevo = {...mapeo};
                            if (e.target.value === '') delete nuevo[i];
                            else nuevo[i] = e.target.value;
                            setMapeo(nuevo);
                          }}
                          style={{background:G.input,border:`1px solid ${G.inputBorder}`,borderRadius:4,padding:'6px 8px',color:G.text,fontSize:12,minWidth:180}}
                        >
                          <option value="">— Ignorar columna —</option>
                          {camposDisponibles.map(c=>(
                            <option key={c} value={c} disabled={Object.values(mapeo).includes(c)&&mapeo[i]!==c}>
                              {labelCampo[c]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{padding:'8px 4px',color:G.textMuted,fontSize:11,fontFamily:'IBM Plex Mono'}}>
                        {filas[0]?.[i] ? (filas[0][i].toString().slice(0,30)) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{marginTop:14,fontSize:11,color:G.textMuted}}>
                ✓ {Object.keys(mapeo).length} columnas mapeadas · El campo <b style={{color:G.accent}}>Nombre</b> es obligatorio
              </div>
            </>
          )}

          {/* PASO 3: Preview y duplicados */}
          {paso === 3 && (
            <>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
                <div className="kpi-card green" style={{padding:14}}><div className="kpi-label">A importar</div><div className="kpi-value" style={{fontSize:24}}>{datosFinales.length-duplicados.length}</div></div>
                <div className="kpi-card orange" style={{padding:14}}><div className="kpi-label">Duplicados</div><div className="kpi-value" style={{fontSize:24}}>{duplicados.length}</div></div>
                <div className="kpi-card blue" style={{padding:14}}><div className="kpi-label">Total</div><div className="kpi-value" style={{fontSize:24}}>{datosFinales.length}</div></div>
              </div>

              {duplicados.length>0 && (
                <>
                  <div style={{padding:'10px 14px',background:'rgba(255,179,71,0.08)',border:'1px solid rgba(255,179,71,0.3)',borderRadius:6,marginBottom:14,fontSize:12}}>
                    ⚠ <b>{duplicados.length} equipo(s) ya existen</b> con el mismo número de serie. Elige qué hacer con cada uno:
                  </div>
                  <div style={{maxHeight:200,overflowY:'auto',marginBottom:14,border:`1px solid ${G.cardBorder}`,borderRadius:6}}>
                    <table style={{width:'100%',fontSize:11}}>
                      <thead><tr style={{borderBottom:`1px solid ${G.cardBorder}`,background:G.input}}>
                        <th style={{textAlign:'left',padding:'8px 10px',color:G.textMuted}}>Equipo</th>
                        <th style={{textAlign:'left',padding:'8px 10px',color:G.textMuted}}>Serie</th>
                        <th style={{textAlign:'left',padding:'8px 10px',color:G.textMuted}}>Acción</th>
                      </tr></thead>
                      <tbody>
                        {duplicados.map((d,i)=>(
                          <tr key={i} style={{borderBottom:`1px solid rgba(30,47,71,0.5)`}}>
                            <td style={{padding:'8px 10px'}}>{d.nombre}</td>
                            <td style={{padding:'8px 10px',fontFamily:'IBM Plex Mono',color:G.textMuted}}>{d.serie}</td>
                            <td style={{padding:'8px 10px'}}>
                              <select value={accionesDup[d.serie]||'saltar'}
                                onChange={e=>setAccionesDup({...accionesDup,[d.serie]:e.target.value})}
                                style={{background:G.input,border:`1px solid ${G.inputBorder}`,borderRadius:4,padding:'4px 8px',color:G.text,fontSize:11}}>
                                <option value="saltar">Saltar (no importar)</option>
                                <option value="sobrescribir">Sobrescribir existente</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{display:'flex',gap:8,marginBottom:14}}>
                    <button className="btn btn-ghost" style={{fontSize:11}} onClick={()=>{const n={};duplicados.forEach(d=>n[d.serie]='saltar');setAccionesDup(n);}}>Saltar todos</button>
                    <button className="btn btn-ghost" style={{fontSize:11}} onClick={()=>{const n={};duplicados.forEach(d=>n[d.serie]='sobrescribir');setAccionesDup(n);}}>Sobrescribir todos</button>
                  </div>
                </>
              )}

              <div style={{fontSize:12,color:G.textMuted,marginBottom:8}}>Vista previa (primeros 5 equipos):</div>
              <div style={{maxHeight:240,overflowY:'auto',border:`1px solid ${G.cardBorder}`,borderRadius:6}}>
                <table style={{width:'100%',fontSize:11}}>
                  <thead><tr style={{borderBottom:`1px solid ${G.cardBorder}`,background:G.input}}>
                    <th style={{textAlign:'left',padding:'8px',color:G.textMuted}}>Nombre</th>
                    <th style={{textAlign:'left',padding:'8px',color:G.textMuted}}>Marca/Modelo</th>
                    <th style={{textAlign:'left',padding:'8px',color:G.textMuted}}>Serie</th>
                    <th style={{textAlign:'left',padding:'8px',color:G.textMuted}}>Servicio</th>
                  </tr></thead>
                  <tbody>
                    {datosFinales.slice(0,5).map((d,i)=>(
                      <tr key={i} style={{borderBottom:`1px solid rgba(30,47,71,0.5)`}}>
                        <td style={{padding:'8px',fontWeight:500}}>{d.nombre}</td>
                        <td style={{padding:'8px',color:G.textMuted}}>{d.marca||'—'} {d.modelo||''}</td>
                        <td style={{padding:'8px',fontFamily:'IBM Plex Mono'}}>{d.serie||'—'}</td>
                        <td style={{padding:'8px',color:G.textMuted}}>{d.servicio||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* PASO 4: Resultado */}
          {paso === 4 && resultado && (
            <div style={{textAlign:'center',padding:'20px 0'}}>
              <div style={{fontSize:48,marginBottom:12}}>{resultado.errores===0?'✅':'⚠️'}</div>
              <div style={{fontSize:16,fontWeight:600,color:G.text,marginBottom:20}}>Importación completada</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
                <div className="kpi-card green" style={{padding:14}}><div className="kpi-label">Creados</div><div className="kpi-value" style={{fontSize:24}}>{resultado.creados}</div></div>
                <div className="kpi-card blue" style={{padding:14}}><div className="kpi-label">Actualizados</div><div className="kpi-value" style={{fontSize:24}}>{resultado.actualizados}</div></div>
                <div className="kpi-card red" style={{padding:14}}><div className="kpi-label">Errores</div><div className="kpi-value" style={{fontSize:24}}>{resultado.errores}</div></div>
              </div>
              {resultado.erroresList.length>0 && (
                <div style={{marginTop:14,padding:12,background:'rgba(255,77,109,0.08)',borderRadius:6,fontSize:11,color:G.danger,textAlign:'left',maxHeight:160,overflowY:'auto'}}>
                  <b>Detalle de errores:</b>
                  {resultado.erroresList.slice(0,10).map((e,i)=><div key={i} style={{marginTop:4}}>• {e}</div>)}
                  {resultado.erroresList.length>10&&<div style={{marginTop:4}}>... y {resultado.erroresList.length-10} más</div>}
                </div>
              )}
            </div>
          )}

        </div>

        <div className="modal-footer">
          {paso === 1 && <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>}
          {paso === 2 && (<>
            <button className="btn btn-ghost" onClick={()=>setPaso(1)}>← Atrás</button>
            <button className="btn btn-primary" onClick={procesarMapeo}>Continuar →</button>
          </>)}
          {paso === 3 && (<>
            <button className="btn btn-ghost" onClick={()=>setPaso(2)}>← Atrás</button>
            <button className="btn btn-primary" onClick={importar} disabled={importando}>
              {importando?'Importando...':`✓ Importar ${datosFinales.length-duplicados.filter(d=>accionesDup[d.serie]==='saltar').length} equipos`}
            </button>
          </>)}
          {paso === 4 && <button className="btn btn-primary" onClick={cerrarYRefrescar}>Cerrar y ver inventario</button>}
        </div>
      </div>
    </div>
  );
}