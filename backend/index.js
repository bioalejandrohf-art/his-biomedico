const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 4000;
const pool = require('./db');
const SECRET = process.env.SECRET || 'clave_super_segura';

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '20mb' }));

app.get('/', (req, res) => res.send('Servidor funcionando 🚀'));

//////////////////////////////////////////////////
// 🔐 AUTH
//////////////////////////////////////////////////
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(403).json({ error: 'No autorizado' });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { return res.status(403).json({ error: 'Token inválido' }); }
};
const soloAdmin = (req, res, next) => {
  if (!['Admin','SuperAdmin'].includes(req.user?.rol)) return res.status(403).json({ error: 'Solo administradores' });
  next();
};
const soloSuperAdmin = (req, res, next) => {
  if (req.user?.rol !== 'SuperAdmin') return res.status(403).json({ error: 'Solo SuperAdmin' });
  next();
};
const filtroInstitucion = (req) => {
  if (req.user?.rol === 'SuperAdmin') return null;
  return req.user?.institucion_id || null;
};

const registrarAuditoria = async (req, accion, modulo, recurso_id) => {
  try {
    await pool.query(
      `INSERT INTO auditoria (usuario_id, accion, modulo, recurso_id, ip, institucion_id) VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.user?.id||null, accion, modulo, recurso_id, req.ip, req.user?.institucion_id||null]
    );
  } catch(e) { console.error('Auditoría:', e.message); }
};
const registrarHistorial = async (equipo_id, accion, descripcion, institucion_id) => {
  try {
    await pool.query(
      `INSERT INTO historial_equipos (equipo_id, accion, descripcion, institucion_id) VALUES ($1,$2,$3,$4)`,
      [equipo_id, accion, descripcion, institucion_id||null]
    );
  } catch(e) { console.error('Historial:', e.message); }
};

//////////////////////////////////////////////////
// 🏥 INSTITUCIONES
//////////////////////////////////////////////////
app.get('/instituciones', authMiddleware, async (req, res) => {
  // SuperAdmin ve todas, Admin solo ve la suya, Auditor también
  if (req.user.rol === 'SuperAdmin') {
    const result = await pool.query('SELECT * FROM instituciones ORDER BY nombre');
    return res.json(result.rows);
  }
  if (['Admin','Auditor'].includes(req.user.rol)) {
    if (!req.user.institucion_id) return res.json([]);
    const result = await pool.query('SELECT * FROM instituciones WHERE id=$1', [req.user.institucion_id]);
    return res.json(result.rows);
  }
  return res.status(403).json({ error: 'Sin permisos' });
});
app.get('/instituciones/mia', authMiddleware, async (req, res) => {
  if (!req.user.institucion_id) return res.json(null);
  const result = await pool.query('SELECT * FROM instituciones WHERE id=$1', [req.user.institucion_id]);
  res.json(result.rows[0] || null);
});
app.post('/instituciones', authMiddleware, soloSuperAdmin, async (req, res) => {
  try {
    const { nombre, nit, direccion, ciudad, telefono, email, logo_url, codigo_reps,
            doc_inventario_codigo, doc_inventario_version, doc_inventario_vigencia } = req.body;
    const result = await pool.query(
      `INSERT INTO instituciones (nombre,nit,direccion,ciudad,telefono,email,logo_url,codigo_reps,doc_inventario_codigo,doc_inventario_version,doc_inventario_vigencia)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [nombre, nit, direccion, ciudad, telefono, email, logo_url, codigo_reps,
       doc_inventario_codigo||'GTE-FR-001', doc_inventario_version||'2', doc_inventario_vigencia||'2026-12-31']
    );
    res.json(result.rows[0]);
  } catch(e) {
    if (e.code==='23505') return res.status(400).json({ error: 'NIT ya existe' });
    res.status(500).json({ error: e.message });
  }
});
app.put('/instituciones/:id', authMiddleware, soloSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, nit, direccion, ciudad, telefono, email, logo_url, codigo_reps, activa,
            doc_inventario_codigo, doc_inventario_version, doc_inventario_vigencia } = req.body;
    await pool.query(
      `UPDATE instituciones SET nombre=$1,nit=$2,direccion=$3,ciudad=$4,telefono=$5,email=$6,logo_url=$7,codigo_reps=$8,activa=$9,
       doc_inventario_codigo=$10,doc_inventario_version=$11,doc_inventario_vigencia=$12 WHERE id=$13`,
      [nombre, nit, direccion, ciudad, telefono, email, logo_url, codigo_reps, activa,
       doc_inventario_codigo||'GTE-FR-001', doc_inventario_version||'2', doc_inventario_vigencia||'2026-12-31', id]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.delete('/instituciones/:id', authMiddleware, soloSuperAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE instituciones SET activa=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/instituciones/seleccionar/:id', authMiddleware, soloSuperAdmin, async (req, res) => {
  const inst = await pool.query('SELECT * FROM instituciones WHERE id=$1', [req.params.id]);
  if (!inst.rows.length) return res.status(404).json({ error: 'No encontrada' });
  const token = jwt.sign(
    { id: req.user.id, rol: req.user.rol, nombre: req.user.nombre, institucion_id: parseInt(req.params.id), institucion_nombre: inst.rows[0].nombre },
    SECRET
  );
  res.json({ token });
});

//////////////////////////////////////////////////
// 👤 AUTH
//////////////////////////////////////////////////
app.post('/register', async (req, res) => {
  try {
    const { nombre, email, password, rol, institucion_id } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO usuarios (nombre,email,password,rol,institucion_id) VALUES ($1,$2,$3,$4,$5) RETURNING id,nombre,email,rol,institucion_id,creado_en',
      [nombre, email, hash, rol, institucion_id||null]
    );
    res.json(result.rows[0]);
  } catch(e) {
    if (e.code==='23505') return res.status(400).json({ error: 'El email ya existe' });
    res.status(500).json({ error: e.message });
  }
});
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await pool.query('SELECT * FROM usuarios WHERE email=$1', [email]);
  if (!user.rows.length) return res.status(400).json({ error: 'Usuario no existe' });
  const valid = await bcrypt.compare(password, user.rows[0].password);
  if (!valid) return res.status(400).json({ error: 'Contraseña incorrecta' });
  const u = user.rows[0];
  if (u.institucion_id) {
    const inst = await pool.query('SELECT nombre FROM instituciones WHERE id=$1', [u.institucion_id]);
    return res.json({ token: jwt.sign({ id: u.id, rol: u.rol, nombre: u.nombre, institucion_id: u.institucion_id, institucion_nombre: inst.rows[0]?.nombre || '' }, SECRET) });
  }
  res.json({ token: jwt.sign({ id: u.id, rol: u.rol, nombre: u.nombre, institucion_id: null, institucion_nombre: null }, SECRET) });
});

//////////////////////////////////////////////////
// 👥 USUARIOS
//////////////////////////////////////////////////
app.get('/usuarios', authMiddleware, soloSuperAdmin, async (req, res) => {
  const instId = filtroInstitucion(req);
  const q = instId
    ? `SELECT id,nombre,email,rol,institucion_id,creado_en FROM usuarios WHERE institucion_id=$1 ORDER BY creado_en DESC`
    : `SELECT u.id,u.nombre,u.email,u.rol,u.institucion_id,u.creado_en,i.nombre AS institucion_nombre FROM usuarios u LEFT JOIN instituciones i ON i.id=u.institucion_id ORDER BY u.creado_en DESC`;
  const result = await pool.query(q, instId ? [instId] : []);
  res.json(result.rows);
});
app.put('/usuarios/:id', authMiddleware, soloSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, rol, password, institucion_id } = req.body;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE usuarios SET nombre=$1,email=$2,rol=$3,password=$4,institucion_id=$5 WHERE id=$6',[nombre,email,rol,hash,institucion_id||null,id]);
    } else {
      await pool.query('UPDATE usuarios SET nombre=$1,email=$2,rol=$3,institucion_id=$4 WHERE id=$5',[nombre,email,rol,institucion_id||null,id]);
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.delete('/usuarios/:id', authMiddleware, soloSuperAdmin, async (req, res) => {
  try {
    if (parseInt(req.params.id)===req.user.id) return res.status(400).json({ error: 'No puedes eliminarte' });
    await pool.query('DELETE FROM usuarios WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

//////////////////////////////////////////////////
// 📦 EQUIPOS
//////////////////////////////////////////////////
app.get('/equipos', authMiddleware, async (req, res) => {
  const instId = filtroInstitucion(req);
  const q = instId
    ? 'SELECT * FROM equipos_biomedicos WHERE institucion_id=$1 ORDER BY nombre'
    : 'SELECT e.*,i.nombre AS institucion_nombre FROM equipos_biomedicos e LEFT JOIN instituciones i ON i.id=e.institucion_id ORDER BY i.nombre,e.nombre';
  const result = await pool.query(q, instId ? [instId] : []);
  res.json(result.rows);
});
app.post('/equipos', authMiddleware, async (req, res) => {
  const data = req.body;
  const instId = req.user.institucion_id || null;
  const result = await pool.query(
    `INSERT INTO equipos_biomedicos (nombre,marca,modelo,serie,registro_invima,fecha_vencimiento_invima,clasificacion_riesgo,ubicacion,servicio,estado,tipo_equipo,activo_fijo,garantia,garantia_vencimiento,institucion_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [data.nombre,data.marca,data.modelo,data.serie,data.registro_invima,data.fecha_vencimiento_invima||null,data.clasificacion_riesgo,data.ubicacion,data.servicio,data.estado,data.tipo_equipo||null,data.activo_fijo||null,!!data.garantia,data.garantia_vencimiento||null,instId]
  );
  const equipo = result.rows[0];
  await registrarAuditoria(req,'CREAR','EQUIPOS',equipo.id);
  await registrarHistorial(equipo.id,'CREACIÓN',`Equipo creado: ${equipo.nombre}`,instId);
  res.json(equipo);
});
app.put('/equipos/:id', authMiddleware, async (req, res) => {
  const { id } = req.params; const data = req.body;
  await pool.query(
    `UPDATE equipos_biomedicos SET nombre=$1,marca=$2,modelo=$3,serie=$4,registro_invima=$5,fecha_vencimiento_invima=$6,clasificacion_riesgo=$7,ubicacion=$8,servicio=$9,estado=$10,tipo_equipo=$11,activo_fijo=$12,garantia=$13,garantia_vencimiento=$14 WHERE id=$15`,
    [data.nombre,data.marca,data.modelo,data.serie,data.registro_invima,data.fecha_vencimiento_invima||null,data.clasificacion_riesgo,data.ubicacion,data.servicio,data.estado,data.tipo_equipo||null,data.activo_fijo||null,!!data.garantia,data.garantia_vencimiento||null,id]
  );
  await registrarAuditoria(req,'EDITAR','EQUIPOS',id);
  await registrarHistorial(id,'EDICIÓN','Equipo actualizado',req.user.institucion_id);
  res.json({ ok: true });
});
app.delete('/equipos/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const existe = await pool.query('SELECT * FROM equipos_biomedicos WHERE id=$1',[id]);
    if (!existe.rows.length) return res.status(404).json({ error: 'Equipo no encontrado' });
    await registrarAuditoria(req,'ELIMINAR','EQUIPOS',id);
    await pool.query('DELETE FROM repuesto_equipo WHERE equipo_id=$1',[id]);
    await pool.query('DELETE FROM historial_equipos WHERE equipo_id=$1',[id]);
    await pool.query('DELETE FROM ot_repuestos WHERE mantenimiento_id IN (SELECT id FROM mantenimientos WHERE equipo_id=$1)',[id]);
    await pool.query('DELETE FROM reportes_mantenimiento WHERE mantenimiento_id IN (SELECT id FROM mantenimientos WHERE equipo_id=$1)',[id]);
    await pool.query('DELETE FROM mantenimientos WHERE equipo_id=$1',[id]);
    await pool.query('DELETE FROM tecnovigilancia WHERE equipo_id=$1',[id]);
    await pool.query('DELETE FROM equipos_biomedicos WHERE id=$1',[id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

//////////////////////////////////////////////////
// 🏷️ TIPOS DE EQUIPO
//////////////////////////////////////////////////
app.get('/tipos-equipo', authMiddleware, async (req, res) => {
  const result = await pool.query('SELECT * FROM tipos_equipo ORDER BY nombre');
  res.json(result.rows);
});
app.post('/tipos-equipo', authMiddleware, soloAdmin, async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    const result = await pool.query('INSERT INTO tipos_equipo (nombre,descripcion) VALUES ($1,$2) RETURNING *',[nombre,descripcion||null]);
    res.json(result.rows[0]);
  } catch(e) {
    if (e.code==='23505') return res.status(400).json({ error: 'Ya existe' });
    res.status(500).json({ error: e.message });
  }
});
app.delete('/tipos-equipo/:id', authMiddleware, soloAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM tipos_equipo WHERE id=$1',[req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

//////////////////////////////////////////////////
// 📋 PROTOCOLOS
//////////////////////////////////////////////////
app.get('/protocolos', authMiddleware, async (req, res) => {
  const tipo = req.query.tipo;
  const q = tipo
    ? 'SELECT * FROM protocolos WHERE activo=true AND tipo_equipo=$1 ORDER BY nombre'
    : 'SELECT * FROM protocolos ORDER BY tipo_equipo, nombre';
  const result = await pool.query(q, tipo ? [tipo] : []);
  res.json(result.rows);
});
app.get('/protocolos/:id', authMiddleware, async (req, res) => {
  const p = await pool.query('SELECT * FROM protocolos WHERE id=$1',[req.params.id]);
  if (!p.rows.length) return res.status(404).json({ error: 'No encontrado' });
  const items = await pool.query('SELECT * FROM protocolo_items WHERE protocolo_id=$1 ORDER BY orden, id',[req.params.id]);
  res.json({ ...p.rows[0], items: items.rows });
});
app.post('/protocolos', authMiddleware, soloAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { nombre, tipo_equipo, descripcion, items } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre obligatorio' });
    await client.query('BEGIN');
    const r = await client.query(
      'INSERT INTO protocolos (nombre,tipo_equipo,descripcion) VALUES ($1,$2,$3) RETURNING *',
      [nombre, tipo_equipo||null, descripcion||null]
    );
    const protId = r.rows[0].id;
    if (Array.isArray(items)) {
      for (let i=0; i<items.length; i++) {
        const a = (items[i].actividad || items[i]).toString().trim();
        if (a) await client.query('INSERT INTO protocolo_items (protocolo_id,orden,actividad) VALUES ($1,$2,$3)',[protId, i, a]);
      }
    }
    await client.query('COMMIT');
    await registrarAuditoria(req,'CREAR','PROTOCOLOS',protId);
    res.json(r.rows[0]);
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});
app.put('/protocolos/:id', authMiddleware, soloAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { nombre, tipo_equipo, descripcion, activo, items } = req.body;
    await client.query('BEGIN');
    await client.query(
      'UPDATE protocolos SET nombre=$1,tipo_equipo=$2,descripcion=$3,activo=$4 WHERE id=$5',
      [nombre, tipo_equipo||null, descripcion||null, activo!==false, id]
    );
    if (Array.isArray(items)) {
      await client.query('DELETE FROM protocolo_items WHERE protocolo_id=$1',[id]);
      for (let i=0; i<items.length; i++) {
        const a = (items[i].actividad || items[i]).toString().trim();
        if (a) await client.query('INSERT INTO protocolo_items (protocolo_id,orden,actividad) VALUES ($1,$2,$3)',[id, i, a]);
      }
    }
    await client.query('COMMIT');
    await registrarAuditoria(req,'EDITAR','PROTOCOLOS',id);
    res.json({ ok: true });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});
app.delete('/protocolos/:id', authMiddleware, soloAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM protocolos WHERE id=$1',[req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

//////////////////////////////////////////////////
// 🔧 MANTENIMIENTOS
//////////////////////////////////////////////////
app.post('/mantenimientos', authMiddleware, async (req, res) => {
  try {
    const { equipo_id, tipo, descripcion, fecha_programada, prioridad,
            proveedor_id, contrato_id, tercerizada, costo_servicio,
            factura_numero, factura_fecha, estado_servicio } = req.body;
    const instId = req.user.institucion_id || null;
    const result = await pool.query(
      `INSERT INTO mantenimientos 
       (equipo_id,tipo,descripcion,fecha_programada,estado,prioridad,institucion_id,
        proveedor_id,contrato_id,tercerizada,costo_servicio,factura_numero,factura_fecha,estado_servicio)
       VALUES ($1,$2,$3,$4,'PENDIENTE',$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [equipo_id, tipo, descripcion, fecha_programada, prioridad||'NORMAL', instId,
       proveedor_id||null, contrato_id||null, !!tercerizada, costo_servicio||0,
       factura_numero||null, factura_fecha||null, estado_servicio||null]
    );
    await registrarAuditoria(req,'CREAR','MANTENIMIENTO',result.rows[0].id);
    await registrarHistorial(equipo_id,'MANTENIMIENTO',`OT creada: ${tipo}`,instId);
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/mantenimientos', authMiddleware, async (req, res) => {
  const instId = filtroInstitucion(req);
  const q = instId
    ? `SELECT m.*,e.nombre AS equipo_nombre,e.servicio AS equipo_servicio,e.tipo_equipo,
       p.razon_social AS proveedor_nombre,
       c.numero_contrato AS contrato_numero,
       (SELECT id FROM reportes_mantenimiento WHERE mantenimiento_id=m.id LIMIT 1) AS reporte_id
       FROM mantenimientos m 
       JOIN equipos_biomedicos e ON e.id=m.equipo_id 
       LEFT JOIN proveedores p ON p.id = m.proveedor_id
       LEFT JOIN contratos c ON c.id = m.contrato_id
       WHERE m.institucion_id=$1
       ORDER BY CASE m.prioridad WHEN 'CRITICA' THEN 1 WHEN 'ALTA' THEN 2 ELSE 3 END, m.fecha_programada`
    : `SELECT m.*,e.nombre AS equipo_nombre,e.servicio AS equipo_servicio,e.tipo_equipo,
       i.nombre AS institucion_nombre,
       p.razon_social AS proveedor_nombre,
       c.numero_contrato AS contrato_numero,
       (SELECT id FROM reportes_mantenimiento WHERE mantenimiento_id=m.id LIMIT 1) AS reporte_id
       FROM mantenimientos m 
       JOIN equipos_biomedicos e ON e.id=m.equipo_id 
       LEFT JOIN instituciones i ON i.id=m.institucion_id
       LEFT JOIN proveedores p ON p.id = m.proveedor_id
       LEFT JOIN contratos c ON c.id = m.contrato_id
       ORDER BY i.nombre, m.fecha_programada`;
  const result = await pool.query(q, instId ? [instId] : []);
  res.json(result.rows);
});
app.put('/mantenimientos/:id', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { observaciones, repuestos_usados } = req.body;
    const m = await client.query('SELECT * FROM mantenimientos WHERE id=$1',[id]);
    if (!m.rows.length) return res.status(404).json({ error: 'OT no encontrada' });
    await client.query('BEGIN');
    await client.query(`UPDATE mantenimientos SET estado='REALIZADO',fecha_realizada=NOW(),observaciones=$1,realizado_por=$2 WHERE id=$3`,[observaciones||null, req.user.id, id]);
    if (Array.isArray(repuestos_usados) && repuestos_usados.length>0) {
      for (const r of repuestos_usados) {
        if (!r.repuesto_id || !r.cantidad || r.cantidad<=0) continue;
        const rep = await client.query('SELECT stock_actual, costo_unitario FROM repuestos WHERE id=$1', [r.repuesto_id]);
        if (!rep.rows.length) continue;
        if (rep.rows[0].stock_actual < r.cantidad) throw new Error(`Stock insuficiente`);
        const costoTotal = (rep.rows[0].costo_unitario || 0) * r.cantidad;
        await client.query('UPDATE repuestos SET stock_actual=stock_actual-$1 WHERE id=$2', [r.cantidad, r.repuesto_id]);
        await client.query(`INSERT INTO movimientos_repuestos (repuesto_id,tipo,cantidad,motivo,mantenimiento_id,usuario_id,institucion_id,descripcion) VALUES ($1,'SALIDA',$2,'USO_OT',$3,$4,$5,$6)`,[r.repuesto_id, r.cantidad, id, req.user.id, req.user.institucion_id||null, `OT #${id}`]);
        await client.query(`INSERT INTO ot_repuestos (mantenimiento_id,repuesto_id,cantidad,costo_total) VALUES ($1,$2,$3,$4) ON CONFLICT (mantenimiento_id,repuesto_id) DO UPDATE SET cantidad=ot_repuestos.cantidad+EXCLUDED.cantidad, costo_total=ot_repuestos.costo_total+EXCLUDED.costo_total`,[id, r.repuesto_id, r.cantidad, costoTotal]);
      }
    }
    await client.query('COMMIT');
    await registrarAuditoria(req,'FINALIZAR','MANTENIMIENTO',id);
    await registrarHistorial(m.rows[0].equipo_id,'MANTENIMIENTO',`OT finalizada: ${m.rows[0].tipo}`,req.user.institucion_id);
    res.json({ ok: true });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});
app.get('/mantenimientos/kpis', authMiddleware, async (req, res) => {
  try {
    const instId = filtroInstitucion(req);
    const w = instId ? 'WHERE institucion_id=$1' : '';
    const p = instId ? [instId] : [];
    const total      = await pool.query(`SELECT COUNT(*) FROM mantenimientos ${w}`, p);
    const pendientes = await pool.query(`SELECT COUNT(*) FROM mantenimientos WHERE estado='PENDIENTE'${instId?' AND institucion_id=$1':''}`, p);
    const realizados = await pool.query(`SELECT COUNT(*) FROM mantenimientos WHERE estado='REALIZADO'${instId?' AND institucion_id=$1':''}`, p);
    const criticas   = await pool.query(`SELECT COUNT(*) FROM mantenimientos WHERE prioridad='CRITICA' AND estado='PENDIENTE'${instId?' AND institucion_id=$1':''}`, p);
    const mttr = await pool.query(`SELECT ROUND(AVG(EXTRACT(EPOCH FROM (fecha_realizada-fecha_programada))/86400)::numeric,1) AS mttr FROM mantenimientos WHERE estado='REALIZADO' AND fecha_realizada IS NOT NULL ${instId?' AND institucion_id=$1':''}`, p);
    res.json({ total: parseInt(total.rows[0].count), pendientes: parseInt(pendientes.rows[0].count), realizados: parseInt(realizados.rows[0].count), criticas: parseInt(criticas.rows[0].count), mttr: mttr.rows[0].mttr||0 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Reprogramar fecha de OT (drag & drop del calendario)
app.put('/mantenimientos/:id/reprogramar', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_programada } = req.body;
    if (!fecha_programada) return res.status(400).json({ error: 'Fecha obligatoria' });

    const m = await pool.query('SELECT * FROM mantenimientos WHERE id=$1', [id]);
    if (!m.rows.length) return res.status(404).json({ error: 'OT no encontrada' });
    if (m.rows[0].estado === 'REALIZADO') return res.status(400).json({ error: 'No se puede reprogramar una OT realizada' });

    const fechaAnterior = m.rows[0].fecha_programada;
    await pool.query('UPDATE mantenimientos SET fecha_programada=$1 WHERE id=$2', [fecha_programada, id]);

    await registrarAuditoria(req, 'REPROGRAMAR', 'MANTENIMIENTO', id);
    await registrarHistorial(
      m.rows[0].equipo_id,
      'REPROGRAMACIÓN',
      `OT reprogramada del ${new Date(fechaAnterior).toLocaleDateString('es-CO')} al ${new Date(fecha_programada).toLocaleDateString('es-CO')}`,
      req.user.institucion_id
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/mantenimientos/:id/repuestos', authMiddleware, async (req, res) => {
  const result = await pool.query(
    `SELECT or_.*, r.nombre, r.codigo, r.unidad_medida FROM ot_repuestos or_ JOIN repuestos r ON r.id = or_.repuesto_id WHERE or_.mantenimiento_id = $1`,
    [req.params.id]
  );
  res.json(result.rows);
});

//////////////////////////////////////////////////
// 📝 REPORTES DE MANTENIMIENTO
//////////////////////////////////////////////////
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
app.post('/reportes-mantenimiento', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      mantenimiento_id, numero_reporte, tipo_reporte, fecha_inicio, fecha_entrega, estado_reporte,
      protocolo_id, obs_recepcion, trabajo_realizado, obs_entrega, repuestos_texto,
      resp_servicio_nombre, resp_servicio_cc, resp_servicio_cargo, resp_servicio_firma,
      resp_recepcion_nombre, resp_recepcion_cc, resp_recepcion_cargo, resp_recepcion_firma,
      recepcion, entrega, actividades, fotos
    } = req.body;
    if (!mantenimiento_id) return res.status(400).json({ error: 'mantenimiento_id obligatorio' });
    const instId = req.user.institucion_id || null;
    await client.query('BEGIN');
    const existe = await client.query('SELECT id FROM reportes_mantenimiento WHERE mantenimiento_id=$1', [mantenimiento_id]);
    let reporteId;
    if (existe.rows.length) {
      reporteId = existe.rows[0].id;
      await client.query(
        `UPDATE reportes_mantenimiento SET numero_reporte=$1,tipo_reporte=$2,fecha_inicio=$3,fecha_entrega=$4,estado_reporte=$5,
         protocolo_id=$6,obs_recepcion=$7,trabajo_realizado=$8,obs_entrega=$9,repuestos_texto=$10,
         resp_servicio_nombre=$11,resp_servicio_cc=$12,resp_servicio_cargo=$13,resp_servicio_firma=$14,
         resp_recepcion_nombre=$15,resp_recepcion_cc=$16,resp_recepcion_cargo=$17,resp_recepcion_firma=$18,
         updated_at=NOW() WHERE id=$19`,
        [numero_reporte||null, tipo_reporte||null, fecha_inicio||null, fecha_entrega||null, estado_reporte||null,
         protocolo_id||null, obs_recepcion||null, trabajo_realizado||null, obs_entrega||null, repuestos_texto||null,
         resp_servicio_nombre||null, resp_servicio_cc||null, resp_servicio_cargo||null, resp_servicio_firma||null,
         resp_recepcion_nombre||null, resp_recepcion_cc||null, resp_recepcion_cargo||null, resp_recepcion_firma||null,
         reporteId]
      );
      await client.query('DELETE FROM reporte_recepcion WHERE reporte_id=$1', [reporteId]);
      await client.query('DELETE FROM reporte_entrega WHERE reporte_id=$1', [reporteId]);
      await client.query('DELETE FROM reporte_actividades WHERE reporte_id=$1', [reporteId]);
      await client.query('DELETE FROM reporte_fotos WHERE reporte_id=$1', [reporteId]);
    } else {
      const r = await client.query(
        `INSERT INTO reportes_mantenimiento (mantenimiento_id,numero_reporte,tipo_reporte,fecha_inicio,fecha_entrega,estado_reporte,
         protocolo_id,obs_recepcion,trabajo_realizado,obs_entrega,repuestos_texto,
         resp_servicio_nombre,resp_servicio_cc,resp_servicio_cargo,resp_servicio_firma,
         resp_recepcion_nombre,resp_recepcion_cc,resp_recepcion_cargo,resp_recepcion_firma,institucion_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING id`,
        [mantenimiento_id, numero_reporte||null, tipo_reporte||null, fecha_inicio||null, fecha_entrega||null, estado_reporte||null,
         protocolo_id||null, obs_recepcion||null, trabajo_realizado||null, obs_entrega||null, repuestos_texto||null,
         resp_servicio_nombre||null, resp_servicio_cc||null, resp_servicio_cargo||null, resp_servicio_firma||null,
         resp_recepcion_nombre||null, resp_recepcion_cc||null, resp_recepcion_cargo||null, resp_recepcion_firma||null, instId]
      );
      reporteId = r.rows[0].id;
    }
    if (Array.isArray(recepcion)) {
      for (let i=0; i<recepcion.length; i++) {
        const it = recepcion[i];
        const numero = it.item_numero || (i+1);
        const texto = it.item_texto || ITEMS_RECEPCION[numero-1] || '';
        await client.query(`INSERT INTO reporte_recepcion (reporte_id,item_numero,item_texto,estado) VALUES ($1,$2,$3,$4)`,[reporteId, numero, texto, it.estado || null]);
      }
    }
    if (Array.isArray(entrega)) {
      for (let i=0; i<entrega.length; i++) {
        const it = entrega[i];
        const numero = it.item_numero || (i+1);
        const texto = it.item_texto || ITEMS_RECEPCION[numero-1] || '';
        await client.query(`INSERT INTO reporte_entrega (reporte_id,item_numero,item_texto,estado) VALUES ($1,$2,$3,$4)`,[reporteId, numero, texto, it.estado || null]);
      }
    }
    if (Array.isArray(actividades)) {
      for (let i=0; i<actividades.length; i++) {
        const a = actividades[i];
        await client.query(`INSERT INTO reporte_actividades (reporte_id,orden,actividad,realizado,observaciones) VALUES ($1,$2,$3,$4,$5)`,[reporteId, a.orden??i, a.actividad||'', !!a.realizado, a.observaciones||null]);
      }
    }
    if (Array.isArray(fotos)) {
      for (let i=0; i<fotos.length; i++) {
        const f = fotos[i];
        if (!f.url) continue;
        await client.query(`INSERT INTO reporte_fotos (reporte_id,url,descripcion,orden) VALUES ($1,$2,$3,$4)`,[reporteId, f.url, f.descripcion||null, i]);
      }
    }
    await client.query('COMMIT');
    await registrarAuditoria(req,'GUARDAR','REPORTE',reporteId);
    res.json({ ok: true, id: reporteId });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});
app.get('/reportes-mantenimiento/por-ot/:mant_id', authMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT rm.*, m.equipo_id, m.tipo AS ot_tipo, m.fecha_programada, m.fecha_realizada, m.estado AS ot_estado,
       e.nombre AS equipo_nombre, e.marca, e.modelo, e.serie, e.ubicacion, e.estado AS equipo_estado, e.tipo_equipo,
       i.nombre AS institucion_nombre, i.nit, i.direccion, i.ciudad, i.telefono, i.email, i.codigo_reps, i.logo_url
       FROM mantenimientos m
       LEFT JOIN reportes_mantenimiento rm ON rm.mantenimiento_id=m.id
       JOIN equipos_biomedicos e ON e.id=m.equipo_id
       LEFT JOIN instituciones i ON i.id=m.institucion_id
       WHERE m.id=$1`,
      [req.params.mant_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'OT no encontrada' });
    const data = r.rows[0];
    if (data.id) {
      const rec = await pool.query('SELECT * FROM reporte_recepcion WHERE reporte_id=$1 ORDER BY item_numero',[data.id]);
      const ent = await pool.query('SELECT * FROM reporte_entrega WHERE reporte_id=$1 ORDER BY item_numero',[data.id]);
      const act = await pool.query('SELECT * FROM reporte_actividades WHERE reporte_id=$1 ORDER BY orden',[data.id]);
      const fot = await pool.query('SELECT * FROM reporte_fotos WHERE reporte_id=$1 ORDER BY orden',[data.id]);
      data.recepcion = rec.rows; data.entrega = ent.rows; data.actividades = act.rows; data.fotos = fot.rows;
    } else {
      data.recepcion = []; data.entrega = []; data.actividades = []; data.fotos = [];
    }
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

//////////////////////////////////////////////////
// 🚨 TECNOVIGILANCIA
//////////////////////////////////////////////////
app.get('/tecnovigilancia', authMiddleware, async (req, res) => {
  const instId = filtroInstitucion(req);
  const q = instId
    ? `SELECT t.*,e.nombre AS equipo_nombre,e.servicio AS equipo_servicio,u.nombre AS reportado_nombre FROM tecnovigilancia t LEFT JOIN equipos_biomedicos e ON e.id=t.equipo_id LEFT JOIN usuarios u ON u.id=t.reportado_por WHERE t.institucion_id=$1 ORDER BY t.created_at DESC`
    : `SELECT t.*,e.nombre AS equipo_nombre,e.servicio AS equipo_servicio,u.nombre AS reportado_nombre,i.nombre AS institucion_nombre FROM tecnovigilancia t LEFT JOIN equipos_biomedicos e ON e.id=t.equipo_id LEFT JOIN usuarios u ON u.id=t.reportado_por LEFT JOIN instituciones i ON i.id=t.institucion_id ORDER BY t.created_at DESC`;
  const result = await pool.query(q, instId ? [instId] : []);
  res.json(result.rows);
});
app.post('/tecnovigilancia', authMiddleware, async (req, res) => {
  try {
    const { equipo_id, tipo, descripcion, fecha_evento, gravedad } = req.body;
    const instId = req.user.institucion_id || null;
    const result = await pool.query(
      `INSERT INTO tecnovigilancia (equipo_id,tipo,descripcion,fecha_evento,gravedad,estado,reportado_por,institucion_id) VALUES ($1,$2,$3,$4,$5,'ABIERTO',$6,$7) RETURNING *`,
      [equipo_id, tipo, descripcion, fecha_evento, gravedad, req.user.id, instId]
    );
    await registrarAuditoria(req,'CREAR','TECNOVIGILANCIA',result.rows[0].id);
    if (equipo_id) await registrarHistorial(equipo_id,'TECNOVIGILANCIA',`Reporte ${tipo}: ${gravedad}`,instId);
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.put('/tecnovigilancia/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE tecnovigilancia SET estado=$1 WHERE id=$2',[req.body.estado,req.params.id]);
    await registrarAuditoria(req,'ACTUALIZAR','TECNOVIGILANCIA',req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

//////////////////////////////////////////////////
// 📦 REPUESTOS
//////////////////////////////////////////////////
app.get('/repuestos', authMiddleware, async (req, res) => {
  const instId = filtroInstitucion(req);
  const q = instId ? `SELECT * FROM repuestos WHERE institucion_id=$1 ORDER BY nombre` : `SELECT r.*,i.nombre AS institucion_nombre FROM repuestos r LEFT JOIN instituciones i ON i.id=r.institucion_id ORDER BY i.nombre,r.nombre`;
  const result = await pool.query(q, instId ? [instId] : []);
  res.json(result.rows);
});
app.get('/repuestos/:id', authMiddleware, async (req, res) => {
  const r = await pool.query('SELECT * FROM repuestos WHERE id=$1', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'No encontrado' });
  const equipos = await pool.query(`SELECT e.id, e.nombre FROM repuesto_equipo re JOIN equipos_biomedicos e ON e.id=re.equipo_id WHERE re.repuesto_id=$1`,[req.params.id]);
  res.json({ ...r.rows[0], equipos_compatibles: equipos.rows });
});
app.post('/repuestos', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { codigo, nombre, descripcion, categoria, marca, modelo, unidad_medida, stock_actual, stock_minimo, costo_unitario, proveedor, ubicacion, lote, fecha_vencimiento, equipos_compatibles } = req.body;
    const instId = req.user.institucion_id || null;
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO repuestos (codigo,nombre,descripcion,categoria,marca,modelo,unidad_medida,stock_actual,stock_minimo,costo_unitario,proveedor,ubicacion,lote,fecha_vencimiento,institucion_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [codigo||null, nombre, descripcion||null, categoria||null, marca||null, modelo||null, unidad_medida||'UND', stock_actual||0, stock_minimo||0, costo_unitario||0, proveedor||null, ubicacion||null, lote||null, fecha_vencimiento||null, instId]
    );
    const rep = result.rows[0];
    if (Array.isArray(equipos_compatibles)) {
      for (const eqId of equipos_compatibles) await client.query('INSERT INTO repuesto_equipo (repuesto_id,equipo_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [rep.id, eqId]);
    }
    if ((stock_actual||0) > 0) {
      await client.query(`INSERT INTO movimientos_repuestos (repuesto_id,tipo,cantidad,motivo,usuario_id,institucion_id,descripcion) VALUES ($1,'ENTRADA',$2,'COMPRA',$3,$4,'Stock inicial')`,[rep.id, stock_actual, req.user.id, instId]);
    }
    await client.query('COMMIT');
    await registrarAuditoria(req,'CREAR','REPUESTOS',rep.id);
    res.json(rep);
  } catch(e) {
    await client.query('ROLLBACK');
    if (e.code==='23505') return res.status(400).json({ error: 'Código ya existe' });
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});
app.put('/repuestos/:id', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { codigo, nombre, descripcion, categoria, marca, modelo, unidad_medida, stock_minimo, costo_unitario, proveedor, ubicacion, lote, fecha_vencimiento, equipos_compatibles } = req.body;
    await client.query('BEGIN');
    await client.query(
      `UPDATE repuestos SET codigo=$1,nombre=$2,descripcion=$3,categoria=$4,marca=$5,modelo=$6,unidad_medida=$7,stock_minimo=$8,costo_unitario=$9,proveedor=$10,ubicacion=$11,lote=$12,fecha_vencimiento=$13,updated_at=NOW() WHERE id=$14`,
      [codigo||null, nombre, descripcion||null, categoria||null, marca||null, modelo||null, unidad_medida||'UND', stock_minimo||0, costo_unitario||0, proveedor||null, ubicacion||null, lote||null, fecha_vencimiento||null, id]
    );
    if (Array.isArray(equipos_compatibles)) {
      await client.query('DELETE FROM repuesto_equipo WHERE repuesto_id=$1', [id]);
      for (const eqId of equipos_compatibles) await client.query('INSERT INTO repuesto_equipo (repuesto_id,equipo_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, eqId]);
    }
    await client.query('COMMIT');
    await registrarAuditoria(req,'EDITAR','REPUESTOS',id);
    res.json({ ok: true });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});
app.delete('/repuestos/:id', authMiddleware, async (req, res) => {
  try {
    await registrarAuditoria(req,'ELIMINAR','REPUESTOS',req.params.id);
    await pool.query('DELETE FROM repuesto_equipo WHERE repuesto_id=$1',[req.params.id]);
    await pool.query('DELETE FROM movimientos_repuestos WHERE repuesto_id=$1',[req.params.id]);
    await pool.query('DELETE FROM ot_repuestos WHERE repuesto_id=$1',[req.params.id]);
    await pool.query('DELETE FROM repuestos WHERE id=$1',[req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/repuestos/:id/movimientos', authMiddleware, async (req, res) => {
  const result = await pool.query(`SELECT m.*, u.nombre AS usuario_nombre FROM movimientos_repuestos m LEFT JOIN usuarios u ON u.id=m.usuario_id WHERE m.repuesto_id=$1 ORDER BY m.fecha DESC`,[req.params.id]);
  res.json(result.rows);
});
app.post('/repuestos/:id/movimiento', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { tipo, cantidad, motivo, descripcion } = req.body;
    if (!['ENTRADA','SALIDA','AJUSTE'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
    if (!cantidad || cantidad<=0) return res.status(400).json({ error: 'Cantidad debe ser mayor a 0' });
    await client.query('BEGIN');
    const r = await client.query('SELECT stock_actual FROM repuestos WHERE id=$1', [id]);
    if (!r.rows.length) throw new Error('No encontrado');
    let nuevoStock;
    if (tipo==='ENTRADA') nuevoStock = r.rows[0].stock_actual + cantidad;
    else if (tipo==='SALIDA') {
      if (r.rows[0].stock_actual < cantidad) throw new Error('Stock insuficiente');
      nuevoStock = r.rows[0].stock_actual - cantidad;
    } else nuevoStock = cantidad;
    await client.query('UPDATE repuestos SET stock_actual=$1,updated_at=NOW() WHERE id=$2', [nuevoStock, id]);
    await client.query(`INSERT INTO movimientos_repuestos (repuesto_id,tipo,cantidad,motivo,descripcion,usuario_id,institucion_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,[id, tipo, cantidad, motivo||null, descripcion||null, req.user.id, req.user.institucion_id||null]);
    await client.query('COMMIT');
    await registrarAuditoria(req,tipo,'REPUESTOS',id);
    res.json({ ok: true, stock_actual: nuevoStock });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});
app.get('/repuestos/kpis/general', authMiddleware, async (req, res) => {
  try {
    const instId = filtroInstitucion(req);
    const w = instId ? 'WHERE institucion_id=$1' : '';
    const p = instId ? [instId] : [];
    const total = await pool.query(`SELECT COUNT(*) FROM repuestos ${w}`, p);
    const stockBajo = await pool.query(`SELECT COUNT(*) FROM repuestos WHERE stock_actual<=stock_minimo AND stock_minimo>0 ${instId?'AND institucion_id=$1':''}`, p);
    const sinStock = await pool.query(`SELECT COUNT(*) FROM repuestos WHERE stock_actual=0 ${instId?'AND institucion_id=$1':''}`, p);
    const valorTotal = await pool.query(`SELECT COALESCE(SUM(stock_actual*costo_unitario),0) AS total FROM repuestos ${w}`, p);
    const porCategoria = await pool.query(`SELECT COALESCE(categoria,'SIN CATEGORÍA') AS categoria, COUNT(*) as total FROM repuestos ${w} GROUP BY categoria ORDER BY total DESC LIMIT 8`, p);
    res.json({ total: parseInt(total.rows[0].count), stockBajo: parseInt(stockBajo.rows[0].count), sinStock: parseInt(sinStock.rows[0].count), valorTotal: parseFloat(valorTotal.rows[0].total), porCategoria: porCategoria.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

//////////////////////////////////////////////////
// 📊 DASHBOARD KPIs
//////////////////////////////////////////////////
app.get('/dashboard/kpis', authMiddleware, async (req, res) => {
  try {
    const instId = filtroInstitucion(req);
    const w = instId ? 'WHERE institucion_id=$1' : '';
    const p = instId ? [instId] : [];
    const totalEquipos = await pool.query(`SELECT COUNT(*) FROM equipos_biomedicos ${w}`, p);
    const activos = await pool.query(`SELECT COUNT(*) FROM equipos_biomedicos WHERE estado='Activo'${instId?' AND institucion_id=$1':''}`, p);
    const enMant = await pool.query(`SELECT COUNT(*) FROM equipos_biomedicos WHERE estado='Mantenimiento'${instId?' AND institucion_id=$1':''}`, p);
    const invVencidos = await pool.query(`SELECT COUNT(*) FROM equipos_biomedicos WHERE fecha_vencimiento_invima < NOW()${instId?' AND institucion_id=$1':''}`, p);
    const otPendientes = await pool.query(`SELECT COUNT(*) FROM mantenimientos WHERE estado='PENDIENTE'${instId?' AND institucion_id=$1':''}`, p);
    const otRealizados = await pool.query(`SELECT COUNT(*) FROM mantenimientos WHERE estado='REALIZADO'${instId?' AND institucion_id=$1':''}`, p);
    const tecnoAbiertos = await pool.query(`SELECT COUNT(*) FROM tecnovigilancia WHERE estado='ABIERTO'${instId?' AND institucion_id=$1':''}`, p);
    const repuestosTotal = await pool.query(`SELECT COUNT(*) FROM repuestos ${w}`, p);
    const repuestosBajo = await pool.query(`SELECT COUNT(*) FROM repuestos WHERE stock_actual<=stock_minimo AND stock_minimo>0 ${instId?'AND institucion_id=$1':''}`, p);
    const porServicio = await pool.query(`SELECT servicio, COUNT(*) as total FROM equipos_biomedicos WHERE servicio IS NOT NULL AND servicio!=''${instId?' AND institucion_id=$1':''} GROUP BY servicio ORDER BY total DESC LIMIT 8`, p);
    const porMes = await pool.query(`SELECT TO_CHAR(fecha_programada,'Mon YY') AS mes, COUNT(*) AS total, SUM(CASE WHEN estado='REALIZADO' THEN 1 ELSE 0 END) AS realizados FROM mantenimientos WHERE fecha_programada >= NOW()-INTERVAL '6 months'${instId?' AND institucion_id=$1':''} GROUP BY TO_CHAR(fecha_programada,'Mon YY'),DATE_TRUNC('month',fecha_programada) ORDER BY DATE_TRUNC('month',fecha_programada)`, p);
    const porRiesgo = await pool.query(`SELECT clasificacion_riesgo AS riesgo, COUNT(*) as total FROM equipos_biomedicos WHERE clasificacion_riesgo IS NOT NULL AND clasificacion_riesgo!=''${instId?' AND institucion_id=$1':''} GROUP BY clasificacion_riesgo ORDER BY clasificacion_riesgo`, p);
    const porGravedad = await pool.query(`SELECT gravedad, COUNT(*) as total FROM tecnovigilancia ${instId?'WHERE institucion_id=$1':''} GROUP BY gravedad`, p);
    res.json({
      totalEquipos: parseInt(totalEquipos.rows[0].count), activos: parseInt(activos.rows[0].count),
      enMant: parseInt(enMant.rows[0].count), invVencidos: parseInt(invVencidos.rows[0].count),
      otPendientes: parseInt(otPendientes.rows[0].count), otRealizados: parseInt(otRealizados.rows[0].count),
      tecnoAbiertos: parseInt(tecnoAbiertos.rows[0].count), repuestosTotal: parseInt(repuestosTotal.rows[0].count),
      repuestosBajo: parseInt(repuestosBajo.rows[0].count),
      porServicio: porServicio.rows, porMes: porMes.rows, porRiesgo: porRiesgo.rows, porGravedad: porGravedad.rows,
    });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

//////////////////////////////////////////////////
// 📈 INDICADORES DE GESTIÓN AVANZADOS
//////////////////////////////////////////////////

// Función helper para construir el filtro de fechas
const filtroFecha = (campo, dias) => `${campo} >= NOW() - INTERVAL '${parseInt(dias)||90} days'`;

// 1. CUMPLIMIENTO DE MANTENIMIENTOS PREVENTIVOS (programados vs realizados)
app.get('/indicadores/cumplimiento', authMiddleware, async (req, res) => {
  try {
    const instId = filtroInstitucion(req);
    const dias = parseInt(req.query.dias) || 90;
    const params = instId ? [instId] : [];
    const wInst = instId ? 'AND m.institucion_id=$1' : '';

    // Cumplimiento global
    const global = await pool.query(
      `SELECT 
        COUNT(*) AS programados,
        SUM(CASE WHEN estado='REALIZADO' THEN 1 ELSE 0 END) AS realizados,
        SUM(CASE WHEN estado='REALIZADO' AND fecha_realizada <= fecha_programada + INTERVAL '5 days' THEN 1 ELSE 0 END) AS a_tiempo,
        SUM(CASE WHEN estado='PENDIENTE' AND fecha_programada < NOW() THEN 1 ELSE 0 END) AS atrasados
       FROM mantenimientos m
       WHERE ${filtroFecha('m.fecha_programada', dias)} ${wInst}`,
      params
    );

    // Por servicio
    const porServicio = await pool.query(
      `SELECT 
        COALESCE(e.servicio, 'Sin servicio') AS servicio,
        COUNT(m.id) AS programados,
        SUM(CASE WHEN m.estado='REALIZADO' THEN 1 ELSE 0 END) AS realizados,
        ROUND(SUM(CASE WHEN m.estado='REALIZADO' THEN 1 ELSE 0 END)::numeric * 100 / NULLIF(COUNT(m.id),0), 1) AS porcentaje
       FROM mantenimientos m
       JOIN equipos_biomedicos e ON e.id = m.equipo_id
       WHERE ${filtroFecha('m.fecha_programada', dias)} ${wInst}
       GROUP BY e.servicio
       ORDER BY programados DESC`,
      params
    );

    // Por tipo de equipo
    const porTipo = await pool.query(
      `SELECT 
        COALESCE(e.tipo_equipo, 'Sin tipo') AS tipo,
        COUNT(m.id) AS programados,
        SUM(CASE WHEN m.estado='REALIZADO' THEN 1 ELSE 0 END) AS realizados,
        ROUND(SUM(CASE WHEN m.estado='REALIZADO' THEN 1 ELSE 0 END)::numeric * 100 / NULLIF(COUNT(m.id),0), 1) AS porcentaje
       FROM mantenimientos m
       JOIN equipos_biomedicos e ON e.id = m.equipo_id
       WHERE ${filtroFecha('m.fecha_programada', dias)} ${wInst}
       GROUP BY e.tipo_equipo
       ORDER BY programados DESC
       LIMIT 10`,
      params
    );

    // Tendencia mensual
    const tendencia = await pool.query(
      `SELECT 
        TO_CHAR(DATE_TRUNC('month', m.fecha_programada), 'Mon YY') AS mes,
        DATE_TRUNC('month', m.fecha_programada) AS orden,
        COUNT(*) AS programados,
        SUM(CASE WHEN m.estado='REALIZADO' THEN 1 ELSE 0 END) AS realizados
       FROM mantenimientos m
       WHERE ${filtroFecha('m.fecha_programada', dias)} ${wInst}
       GROUP BY DATE_TRUNC('month', m.fecha_programada)
       ORDER BY orden`,
      params
    );

    const g = global.rows[0];
    const cumplimiento = g.programados > 0 ? Math.round((g.realizados / g.programados) * 100) : 0;
    const aTiempo = g.programados > 0 ? Math.round((g.a_tiempo / g.programados) * 100) : 0;

    res.json({
      programados: parseInt(g.programados),
      realizados: parseInt(g.realizados),
      atrasados: parseInt(g.atrasados),
      cumplimiento,
      aTiempo,
      porServicio: porServicio.rows,
      porTipo: porTipo.rows,
      tendencia: tendencia.rows,
    });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// 2. MTBF / MTTR / DISPONIBILIDAD
app.get('/indicadores/disponibilidad', authMiddleware, async (req, res) => {
  try {
    const instId = filtroInstitucion(req);
    const dias = parseInt(req.query.dias) || 90;
    const params = instId ? [instId] : [];
    const wInst = instId ? 'AND m.institucion_id=$1' : '';
    const wInstE = instId ? 'WHERE e.institucion_id=$1' : '';

    // MTTR global (tiempo promedio en días para reparar)
    const mttr = await pool.query(
      `SELECT ROUND(AVG(EXTRACT(EPOCH FROM (fecha_realizada - fecha_programada))/86400)::numeric, 1) AS mttr
       FROM mantenimientos m
       WHERE estado='REALIZADO' AND fecha_realizada IS NOT NULL 
       AND ${filtroFecha('m.fecha_realizada', dias)} ${wInst}`,
      params
    );

    // MTBF estimado (días promedio entre fallas correctivas por equipo)
    const mtbf = await pool.query(
      `SELECT ROUND(AVG(intervalo)::numeric, 1) AS mtbf FROM (
         SELECT EXTRACT(EPOCH FROM (fecha_programada - LAG(fecha_programada) OVER (PARTITION BY equipo_id ORDER BY fecha_programada)))/86400 AS intervalo
         FROM mantenimientos m
         WHERE tipo IN ('Correctivo','correctivo','CORRECTIVO') ${wInst}
       ) t WHERE intervalo IS NOT NULL`,
      params
    );

    // Disponibilidad (% de equipos activos)
    const dispo = await pool.query(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN estado='Activo' THEN 1 ELSE 0 END) AS activos,
        SUM(CASE WHEN estado='Mantenimiento' THEN 1 ELSE 0 END) AS en_mant,
        SUM(CASE WHEN estado='Baja' THEN 1 ELSE 0 END) AS baja
       FROM equipos_biomedicos e ${wInstE}`,
      params
    );

    // MTTR por servicio
    const mttrServicio = await pool.query(
      `SELECT 
        COALESCE(e.servicio, 'Sin servicio') AS servicio,
        ROUND(AVG(EXTRACT(EPOCH FROM (m.fecha_realizada - m.fecha_programada))/86400)::numeric, 1) AS mttr,
        COUNT(*) AS total
       FROM mantenimientos m
       JOIN equipos_biomedicos e ON e.id = m.equipo_id
       WHERE m.estado='REALIZADO' AND m.fecha_realizada IS NOT NULL 
       AND ${filtroFecha('m.fecha_realizada', dias)} ${wInst}
       GROUP BY e.servicio
       ORDER BY mttr DESC NULLS LAST
       LIMIT 10`,
      params
    );

    // Top equipos con más fallas correctivas
    const topFallas = await pool.query(
      `SELECT 
        e.id, e.nombre, e.marca, e.modelo, e.servicio,
        COUNT(m.id) AS fallas
       FROM mantenimientos m
       JOIN equipos_biomedicos e ON e.id = m.equipo_id
       WHERE m.tipo IN ('Correctivo','correctivo','CORRECTIVO') 
       AND ${filtroFecha('m.fecha_programada', dias)} ${wInst}
       GROUP BY e.id, e.nombre, e.marca, e.modelo, e.servicio
       ORDER BY fallas DESC
       LIMIT 10`,
      params
    );

    const d = dispo.rows[0];
    const disponibilidad = d.total > 0 ? Math.round((d.activos / d.total) * 100) : 0;

    res.json({
      mttr: parseFloat(mttr.rows[0]?.mttr) || 0,
      mtbf: parseFloat(mtbf.rows[0]?.mtbf) || 0,
      disponibilidad,
      total: parseInt(d.total),
      activos: parseInt(d.activos),
      enMant: parseInt(d.en_mant),
      baja: parseInt(d.baja),
      mttrServicio: mttrServicio.rows,
      topFallas: topFallas.rows,
    });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// 3. PRODUCTIVIDAD POR TÉCNICO
app.get('/indicadores/productividad', authMiddleware, async (req, res) => {
  try {
    const instId = filtroInstitucion(req);
    const dias = parseInt(req.query.dias) || 90;
    const params = instId ? [instId] : [];
    const wInst = instId ? 'AND m.institucion_id=$1' : '';

    const tecnicos = await pool.query(
      `SELECT 
        u.id, u.nombre, u.rol,
        COUNT(m.id) AS total_ots,
        ROUND(AVG(EXTRACT(EPOCH FROM (m.fecha_realizada - m.fecha_programada))/86400)::numeric, 1) AS promedio_dias,
        SUM(CASE WHEN m.fecha_realizada <= m.fecha_programada + INTERVAL '3 days' THEN 1 ELSE 0 END) AS a_tiempo
       FROM usuarios u
       LEFT JOIN mantenimientos m ON m.realizado_por = u.id 
         AND m.estado='REALIZADO' 
         AND ${filtroFecha('m.fecha_realizada', dias)} ${wInst}
       WHERE u.rol IN ('Biomedico','Ingeniero','Admin') 
       ${instId ? 'AND (u.institucion_id=$1 OR u.rol=\'Admin\')' : ''}
       GROUP BY u.id, u.nombre, u.rol
       HAVING COUNT(m.id) > 0
       ORDER BY total_ots DESC`,
      params
    );

    res.json({ tecnicos: tecnicos.rows });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// 4. ANÁLISIS DE COSTOS
app.get('/indicadores/costos', authMiddleware, async (req, res) => {
  try {
    const instId = filtroInstitucion(req);
    const dias = parseInt(req.query.dias) || 90;
    const params = instId ? [instId] : [];
    const wInst = instId ? 'AND m.institucion_id=$1' : '';

    // Gasto total en repuestos en OTs
    const gasto = await pool.query(
      `SELECT 
        COALESCE(SUM(or_.costo_total), 0) AS gasto_total,
        COUNT(DISTINCT or_.mantenimiento_id) AS ots_con_repuestos,
        COUNT(or_.id) AS items_usados,
        COALESCE(SUM(or_.cantidad), 0) AS unidades_totales
       FROM ot_repuestos or_
       JOIN mantenimientos m ON m.id = or_.mantenimiento_id
       WHERE ${filtroFecha('m.fecha_realizada', dias)} ${wInst}`,
      params
    );

    // Top equipos con mayor gasto
    const topEquipos = await pool.query(
      `SELECT 
        e.id, e.nombre, e.marca, e.modelo, e.servicio,
        COALESCE(SUM(or_.costo_total), 0) AS gasto,
        COUNT(or_.id) AS repuestos_usados
       FROM ot_repuestos or_
       JOIN mantenimientos m ON m.id = or_.mantenimiento_id
       JOIN equipos_biomedicos e ON e.id = m.equipo_id
       WHERE ${filtroFecha('m.fecha_realizada', dias)} ${wInst}
       GROUP BY e.id, e.nombre, e.marca, e.modelo, e.servicio
       ORDER BY gasto DESC
       LIMIT 10`,
      params
    );

    // Gasto por servicio
    const porServicio = await pool.query(
      `SELECT 
        COALESCE(e.servicio, 'Sin servicio') AS servicio,
        COALESCE(SUM(or_.costo_total), 0) AS gasto,
        COUNT(DISTINCT m.id) AS ots
       FROM ot_repuestos or_
       JOIN mantenimientos m ON m.id = or_.mantenimiento_id
       JOIN equipos_biomedicos e ON e.id = m.equipo_id
       WHERE ${filtroFecha('m.fecha_realizada', dias)} ${wInst}
       GROUP BY e.servicio
       ORDER BY gasto DESC`,
      params
    );

    // Gasto mensual
    const tendencia = await pool.query(
      `SELECT 
        TO_CHAR(DATE_TRUNC('month', m.fecha_realizada), 'Mon YY') AS mes,
        DATE_TRUNC('month', m.fecha_realizada) AS orden,
        COALESCE(SUM(or_.costo_total), 0) AS gasto
       FROM ot_repuestos or_
       JOIN mantenimientos m ON m.id = or_.mantenimiento_id
       WHERE ${filtroFecha('m.fecha_realizada', dias)} ${wInst}
       GROUP BY DATE_TRUNC('month', m.fecha_realizada)
       ORDER BY orden`,
      params
    );

    res.json({
      gastoTotal: parseFloat(gasto.rows[0].gasto_total),
      otsConRepuestos: parseInt(gasto.rows[0].ots_con_repuestos),
      itemsUsados: parseInt(gasto.rows[0].items_usados),
      unidadesTotales: parseInt(gasto.rows[0].unidades_totales),
      topEquipos: topEquipos.rows,
      porServicio: porServicio.rows,
      tendencia: tendencia.rows,
    });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// 5. TECNOVIGILANCIA POR SERVICIO
app.get('/indicadores/tecnovigilancia', authMiddleware, async (req, res) => {
  try {
    const instId = filtroInstitucion(req);
    const dias = parseInt(req.query.dias) || 90;
    const params = instId ? [instId] : [];
    const wInst = instId ? 'AND t.institucion_id=$1' : '';

    const general = await pool.query(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN gravedad='LEVE' THEN 1 ELSE 0 END) AS leves,
        SUM(CASE WHEN gravedad='MODERADO' THEN 1 ELSE 0 END) AS moderados,
        SUM(CASE WHEN gravedad='GRAVE' THEN 1 ELSE 0 END) AS graves,
        SUM(CASE WHEN estado='ABIERTO' THEN 1 ELSE 0 END) AS abiertos,
        SUM(CASE WHEN estado='CERRADO' THEN 1 ELSE 0 END) AS cerrados
       FROM tecnovigilancia t
       WHERE ${filtroFecha('t.fecha_evento', dias)} ${wInst}`,
      params
    );

    const porServicio = await pool.query(
      `SELECT 
        COALESCE(e.servicio, 'Sin servicio') AS servicio,
        COUNT(*) AS total,
        SUM(CASE WHEN t.gravedad='GRAVE' THEN 1 ELSE 0 END) AS graves
       FROM tecnovigilancia t
       LEFT JOIN equipos_biomedicos e ON e.id = t.equipo_id
       WHERE ${filtroFecha('t.fecha_evento', dias)} ${wInst}
       GROUP BY e.servicio
       ORDER BY total DESC`,
      params
    );

    const porTipo = await pool.query(
      `SELECT 
        tipo, COUNT(*) AS total
       FROM tecnovigilancia t
       WHERE ${filtroFecha('t.fecha_evento', dias)} ${wInst}
       GROUP BY tipo
       ORDER BY total DESC`,
      params
    );

    const tendencia = await pool.query(
      `SELECT 
        TO_CHAR(DATE_TRUNC('month', t.fecha_evento), 'Mon YY') AS mes,
        DATE_TRUNC('month', t.fecha_evento) AS orden,
        COUNT(*) AS total
       FROM tecnovigilancia t
       WHERE ${filtroFecha('t.fecha_evento', dias)} ${wInst}
       GROUP BY DATE_TRUNC('month', t.fecha_evento)
       ORDER BY orden`,
      params
    );

    const g = general.rows[0];
    res.json({
      total: parseInt(g.total),
      leves: parseInt(g.leves),
      moderados: parseInt(g.moderados),
      graves: parseInt(g.graves),
      abiertos: parseInt(g.abiertos),
      cerrados: parseInt(g.cerrados),
      porServicio: porServicio.rows,
      porTipo: porTipo.rows,
      tendencia: tendencia.rows,
    });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// 6. CURVA DE ENVEJECIMIENTO (basada en fecha de creación del registro como proxy)
app.get('/indicadores/envejecimiento', authMiddleware, async (req, res) => {
  try {
    const instId = filtroInstitucion(req);
    const params = instId ? [instId] : [];
    const wInst = instId ? 'WHERE institucion_id=$1' : '';

    // Distribución por antigüedad (años desde creación en sistema)
    const distribucion = await pool.query(
      `SELECT 
        CASE 
          WHEN EXTRACT(YEAR FROM AGE(NOW(), creado_en)) < 1 THEN '<1 año'
          WHEN EXTRACT(YEAR FROM AGE(NOW(), creado_en)) < 3 THEN '1-3 años'
          WHEN EXTRACT(YEAR FROM AGE(NOW(), creado_en)) < 5 THEN '3-5 años'
          WHEN EXTRACT(YEAR FROM AGE(NOW(), creado_en)) < 10 THEN '5-10 años'
          ELSE '>10 años'
        END AS rango,
        COUNT(*) AS total
       FROM equipos_biomedicos ${wInst}
       GROUP BY rango
       ORDER BY 
         CASE 
           WHEN rango = '<1 año' THEN 1
           WHEN rango = '1-3 años' THEN 2
           WHEN rango = '3-5 años' THEN 3
           WHEN rango = '5-10 años' THEN 4
           ELSE 5
         END`,
      params
    );

    // Estado INVIMA
    const invima = await pool.query(
      `SELECT 
        SUM(CASE WHEN fecha_vencimiento_invima IS NULL THEN 1 ELSE 0 END) AS sin_fecha,
        SUM(CASE WHEN fecha_vencimiento_invima < NOW() THEN 1 ELSE 0 END) AS vencido,
        SUM(CASE WHEN fecha_vencimiento_invima >= NOW() AND fecha_vencimiento_invima < NOW() + INTERVAL '30 days' THEN 1 ELSE 0 END) AS por_vencer,
        SUM(CASE WHEN fecha_vencimiento_invima >= NOW() + INTERVAL '30 days' THEN 1 ELSE 0 END) AS vigente
       FROM equipos_biomedicos ${wInst}`,
      params
    );

    // Por servicio + edad promedio
    const porServicio = await pool.query(
      `SELECT 
        COALESCE(servicio, 'Sin servicio') AS servicio,
        COUNT(*) AS total,
        ROUND(AVG(EXTRACT(EPOCH FROM AGE(NOW(), creado_en))/(365.25*86400))::numeric, 1) AS edad_promedio
       FROM equipos_biomedicos ${wInst}
       GROUP BY servicio
       ORDER BY total DESC
       LIMIT 10`,
      params
    );

    res.json({
      distribucion: distribucion.rows,
      invima: invima.rows[0],
      porServicio: porServicio.rows,
    });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// 7. ALERTAS PREDICTIVAS (equipos sin mantenimiento reciente)
app.get('/indicadores/alertas-predictivas', authMiddleware, async (req, res) => {
  try {
    const instId = filtroInstitucion(req);
    const params = instId ? [instId] : [];
    const wInst = instId ? 'WHERE e.institucion_id=$1' : '';

    // Equipos sin mantenimiento en >180 días
    const sinMant = await pool.query(
      `SELECT 
        e.id, e.nombre, e.marca, e.modelo, e.serie, e.servicio, e.tipo_equipo,
        COALESCE(MAX(m.fecha_realizada), e.creado_en) AS ultimo,
        EXTRACT(DAY FROM AGE(NOW(), COALESCE(MAX(m.fecha_realizada), e.creado_en))) AS dias_sin_mant
       FROM equipos_biomedicos e
       LEFT JOIN mantenimientos m ON m.equipo_id = e.id AND m.estado='REALIZADO'
       ${wInst}
       GROUP BY e.id, e.nombre, e.marca, e.modelo, e.serie, e.servicio, e.tipo_equipo, e.creado_en
       HAVING EXTRACT(DAY FROM AGE(NOW(), COALESCE(MAX(m.fecha_realizada), e.creado_en))) > 180
       ORDER BY dias_sin_mant DESC
       LIMIT 30`,
      params
    );

    // OTs vencidas (programadas y no realizadas)
    const otVencidas = await pool.query(
      `SELECT 
        m.id, m.tipo, m.fecha_programada, m.prioridad,
        e.nombre AS equipo_nombre, e.servicio,
        EXTRACT(DAY FROM AGE(NOW(), m.fecha_programada)) AS dias_atraso
       FROM mantenimientos m
       JOIN equipos_biomedicos e ON e.id = m.equipo_id
       WHERE m.estado='PENDIENTE' AND m.fecha_programada < NOW()
       ${instId ? 'AND m.institucion_id=$1' : ''}
       ORDER BY m.fecha_programada ASC
       LIMIT 30`,
      params
    );

    // INVIMA vencidos o por vencer
    const invimaCritico = await pool.query(
      `SELECT 
        e.id, e.nombre, e.marca, e.modelo, e.servicio, e.fecha_vencimiento_invima,
        EXTRACT(DAY FROM AGE(e.fecha_vencimiento_invima, NOW())) AS dias_restantes
       FROM equipos_biomedicos e
       WHERE e.fecha_vencimiento_invima IS NOT NULL
         AND e.fecha_vencimiento_invima < NOW() + INTERVAL '60 days'
         ${instId ? 'AND e.institucion_id=$1' : ''}
       ORDER BY e.fecha_vencimiento_invima ASC
       LIMIT 30`,
      params
    );

    res.json({
      equiposSinMantenimiento: sinMant.rows,
      otsVencidas: otVencidas.rows,
      invimaCritico: invimaCritico.rows,
    });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// EXPORTACIÓN — JSON consolidado de todos los indicadores
app.get('/indicadores/consolidado', authMiddleware, async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 90;
    const baseUrl = `http://localhost:${PORT}`;
    const headers = { Authorization: req.headers.authorization };
    // Llamamos endpoints internos para consolidar — más simple es repetir queries:
    // Para no duplicar todo, devolvemos los IDs de endpoints a llamar
    res.json({
      ok: true,
      dias,
      endpoints: ['cumplimiento','disponibilidad','productividad','costos','tecnovigilancia','envejecimiento','alertas-predictivas']
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

//////////////////////////////////////////////////
// 🏢 PROVEEDORES
//////////////////////////////////////////////////

// Listar proveedores con filtros y stats
app.get('/proveedores', authMiddleware, soloSuperAdmin, async (req, res) => {
  try {
    const instId = filtroInstitucion(req);
    const q = instId
      ? `SELECT p.*,
         (SELECT COUNT(*) FROM contratos c WHERE c.proveedor_id = p.id AND c.estado = 'VIGENTE') AS contratos_vigentes,
         (SELECT COUNT(*) FROM mantenimientos m WHERE m.proveedor_id = p.id) AS ots_realizadas
         FROM proveedores p WHERE p.institucion_id = $1
         ORDER BY p.razon_social`
      : `SELECT p.*, i.nombre AS institucion_nombre,
         (SELECT COUNT(*) FROM contratos c WHERE c.proveedor_id = p.id AND c.estado = 'VIGENTE') AS contratos_vigentes,
         (SELECT COUNT(*) FROM mantenimientos m WHERE m.proveedor_id = p.id) AS ots_realizadas
         FROM proveedores p
         LEFT JOIN instituciones i ON i.id = p.institucion_id
         ORDER BY i.nombre, p.razon_social`;
    const result = await pool.query(q, instId ? [instId] : []);
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Detalle de un proveedor
app.get('/proveedores/:id', authMiddleware, soloSuperAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT p.*, u.nombre AS creador_nombre, i.nombre AS institucion_nombre
       FROM proveedores p
       LEFT JOIN usuarios u ON u.id = p.creado_por
       LEFT JOIN instituciones i ON i.id = p.institucion_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Crear proveedor
app.post('/proveedores', authMiddleware, soloSuperAdmin, async (req, res) => {
  try {
    const d = req.body;
    const instId = req.user.institucion_id || null;
    const result = await pool.query(
      `INSERT INTO proveedores 
       (razon_social,nit,tipo,contacto_nombre,contacto_cargo,telefono,celular,email,direccion,ciudad,pais,sitio_web,especialidades,certificaciones,observaciones,estado,institucion_id,creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [d.razon_social, d.nit||null, d.tipo||null, d.contacto_nombre||null, d.contacto_cargo||null,
       d.telefono||null, d.celular||null, d.email||null, d.direccion||null, d.ciudad||null,
       d.pais||'Colombia', d.sitio_web||null, d.especialidades||null, d.certificaciones||null,
       d.observaciones||null, d.estado||'ACTIVO', instId, req.user.id]
    );
    await registrarAuditoria(req,'CREAR','PROVEEDORES',result.rows[0].id);
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Actualizar proveedor
app.put('/proveedores/:id', authMiddleware, soloSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const d = req.body;
    await pool.query(
      `UPDATE proveedores SET 
       razon_social=$1,nit=$2,tipo=$3,contacto_nombre=$4,contacto_cargo=$5,
       telefono=$6,celular=$7,email=$8,direccion=$9,ciudad=$10,pais=$11,
       sitio_web=$12,especialidades=$13,certificaciones=$14,observaciones=$15,
       estado=$16,updated_at=NOW() WHERE id=$17`,
      [d.razon_social, d.nit||null, d.tipo||null, d.contacto_nombre||null, d.contacto_cargo||null,
       d.telefono||null, d.celular||null, d.email||null, d.direccion||null, d.ciudad||null,
       d.pais||'Colombia', d.sitio_web||null, d.especialidades||null, d.certificaciones||null,
       d.observaciones||null, d.estado||'ACTIVO', id]
    );
    await registrarAuditoria(req,'EDITAR','PROVEEDORES',id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Eliminar proveedor
app.delete('/proveedores/:id', authMiddleware, soloSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // Verificar que no tenga contratos ni OTs asociadas
    const cont = await pool.query('SELECT COUNT(*) FROM contratos WHERE proveedor_id=$1',[id]);
    const ots = await pool.query('SELECT COUNT(*) FROM mantenimientos WHERE proveedor_id=$1',[id]);
    if (parseInt(cont.rows[0].count) > 0 || parseInt(ots.rows[0].count) > 0) {
      return res.status(400).json({ error: 'No se puede eliminar: tiene contratos u OTs asociados. Cámbialo a estado INACTIVO.' });
    }
    await registrarAuditoria(req,'ELIMINAR','PROVEEDORES',id);
    await pool.query('DELETE FROM proveedores WHERE id=$1',[id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// KPIs proveedores
app.get('/proveedores/kpis/general', authMiddleware, soloSuperAdmin, async (req, res) => {
  try {
    const instId = filtroInstitucion(req);
    const w = instId ? 'WHERE institucion_id=$1' : '';
    const p = instId ? [instId] : [];
    const total = await pool.query(`SELECT COUNT(*) FROM proveedores ${w}`, p);
    const activos = await pool.query(`SELECT COUNT(*) FROM proveedores WHERE estado='ACTIVO'${instId?' AND institucion_id=$1':''}`, p);
    const inactivos = await pool.query(`SELECT COUNT(*) FROM proveedores WHERE estado='INACTIVO'${instId?' AND institucion_id=$1':''}`, p);
    const porTipo = await pool.query(`SELECT COALESCE(tipo,'Sin tipo') AS tipo, COUNT(*) AS total FROM proveedores ${w} GROUP BY tipo ORDER BY total DESC LIMIT 8`, p);
    res.json({
      total: parseInt(total.rows[0].count),
      activos: parseInt(activos.rows[0].count),
      inactivos: parseInt(inactivos.rows[0].count),
      porTipo: porTipo.rows
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

//////////////////////////////////////////////////
// 📄 CONTRATOS
//////////////////////////////////////////////////

// Listar contratos
app.get('/contratos', authMiddleware, soloSuperAdmin, async (req, res) => {
  try {
    const instId = filtroInstitucion(req);
    const q = instId
      ? `SELECT c.*, p.razon_social AS proveedor_nombre, p.nit AS proveedor_nit,
         CASE 
           WHEN c.fecha_fin < NOW() THEN 'VENCIDO'
           WHEN c.fecha_fin < NOW() + INTERVAL '1 day' * COALESCE(c.alerta_vencimiento_dias, 30) THEN 'POR_VENCER'
           ELSE c.estado
         END AS estado_calculado,
         (SELECT COUNT(*) FROM mantenimientos m WHERE m.contrato_id = c.id) AS ots_asociadas
         FROM contratos c
         JOIN proveedores p ON p.id = c.proveedor_id
         WHERE c.institucion_id = $1
         ORDER BY c.fecha_fin DESC NULLS LAST`
      : `SELECT c.*, p.razon_social AS proveedor_nombre, p.nit AS proveedor_nit,
         i.nombre AS institucion_nombre,
         CASE 
           WHEN c.fecha_fin < NOW() THEN 'VENCIDO'
           WHEN c.fecha_fin < NOW() + INTERVAL '1 day' * COALESCE(c.alerta_vencimiento_dias, 30) THEN 'POR_VENCER'
           ELSE c.estado
         END AS estado_calculado,
         (SELECT COUNT(*) FROM mantenimientos m WHERE m.contrato_id = c.id) AS ots_asociadas
         FROM contratos c
         JOIN proveedores p ON p.id = c.proveedor_id
         LEFT JOIN instituciones i ON i.id = c.institucion_id
         ORDER BY i.nombre, c.fecha_fin DESC NULLS LAST`;
    const result = await pool.query(q, instId ? [instId] : []);
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Detalle de un contrato
app.get('/contratos/:id', authMiddleware, soloSuperAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.*, p.razon_social AS proveedor_nombre, p.nit AS proveedor_nit, p.email AS proveedor_email
       FROM contratos c
       JOIN proveedores p ON p.id = c.proveedor_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Crear contrato
app.post('/contratos', authMiddleware, soloSuperAdmin, async (req, res) => {
  try {
    const d = req.body;
    if (!d.numero_contrato || !d.proveedor_id) return res.status(400).json({ error: 'Número y proveedor obligatorios' });
    const instId = req.user.institucion_id || null;
    const result = await pool.query(
      `INSERT INTO contratos
       (numero_contrato,proveedor_id,objeto,tipo,fecha_inicio,fecha_fin,valor,forma_pago,
        estado,responsable_cliente,responsable_proveedor,documento_url,observaciones,
        alerta_vencimiento_dias,institucion_id,creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [d.numero_contrato, d.proveedor_id, d.objeto||null, d.tipo||null,
       d.fecha_inicio||null, d.fecha_fin||null, d.valor||0, d.forma_pago||null,
       d.estado||'VIGENTE', d.responsable_cliente||null, d.responsable_proveedor||null,
       d.documento_url||null, d.observaciones||null, d.alerta_vencimiento_dias||30,
       instId, req.user.id]
    );
    await registrarAuditoria(req,'CREAR','CONTRATOS',result.rows[0].id);
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Actualizar contrato
app.put('/contratos/:id', authMiddleware, soloSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const d = req.body;
    await pool.query(
      `UPDATE contratos SET
       numero_contrato=$1,proveedor_id=$2,objeto=$3,tipo=$4,fecha_inicio=$5,fecha_fin=$6,
       valor=$7,forma_pago=$8,estado=$9,responsable_cliente=$10,responsable_proveedor=$11,
       documento_url=$12,observaciones=$13,alerta_vencimiento_dias=$14,updated_at=NOW()
       WHERE id=$15`,
      [d.numero_contrato, d.proveedor_id, d.objeto||null, d.tipo||null,
       d.fecha_inicio||null, d.fecha_fin||null, d.valor||0, d.forma_pago||null,
       d.estado||'VIGENTE', d.responsable_cliente||null, d.responsable_proveedor||null,
       d.documento_url||null, d.observaciones||null, d.alerta_vencimiento_dias||30, id]
    );
    await registrarAuditoria(req,'EDITAR','CONTRATOS',id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Eliminar contrato
app.delete('/contratos/:id', authMiddleware, soloSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const ots = await pool.query('SELECT COUNT(*) FROM mantenimientos WHERE contrato_id=$1',[id]);
    if (parseInt(ots.rows[0].count) > 0) {
      return res.status(400).json({ error: 'No se puede eliminar: tiene OTs asociadas' });
    }
    await registrarAuditoria(req,'ELIMINAR','CONTRATOS',id);
    await pool.query('DELETE FROM contratos WHERE id=$1',[id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// KPIs contratos
app.get('/contratos/kpis/general', authMiddleware, soloSuperAdmin, async (req, res) => {
  try {
    const instId = filtroInstitucion(req);
    const w = instId ? 'WHERE institucion_id=$1' : '';
    const p = instId ? [instId] : [];
    
    const total = await pool.query(`SELECT COUNT(*) FROM contratos ${w}`, p);
    const vigentes = await pool.query(
      `SELECT COUNT(*) FROM contratos 
       WHERE estado='VIGENTE' AND (fecha_fin IS NULL OR fecha_fin >= NOW())
       ${instId?'AND institucion_id=$1':''}`, p);
    const porVencer = await pool.query(
      `SELECT COUNT(*) FROM contratos
       WHERE estado='VIGENTE' AND fecha_fin IS NOT NULL
       AND fecha_fin BETWEEN NOW() AND NOW() + INTERVAL '30 days'
       ${instId?'AND institucion_id=$1':''}`, p);
    const vencidos = await pool.query(
      `SELECT COUNT(*) FROM contratos 
       WHERE fecha_fin < NOW() ${instId?'AND institucion_id=$1':''}`, p);
    const valorTotal = await pool.query(
      `SELECT COALESCE(SUM(valor),0) AS total FROM contratos 
       WHERE estado='VIGENTE' ${instId?'AND institucion_id=$1':''}`, p);
    
    res.json({
      total: parseInt(total.rows[0].count),
      vigentes: parseInt(vigentes.rows[0].count),
      porVencer: parseInt(porVencer.rows[0].count),
      vencidos: parseInt(vencidos.rows[0].count),
      valorTotal: parseFloat(valorTotal.rows[0].total)
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Alertas: contratos por vencer (próximos 60 días)
app.get('/contratos/alertas/vencimiento', authMiddleware, soloSuperAdmin, async (req, res) => {
  try {
    const instId = filtroInstitucion(req);
    const r = await pool.query(
      `SELECT c.id, c.numero_contrato, c.fecha_fin, c.objeto, c.valor,
       p.razon_social AS proveedor_nombre,
       EXTRACT(DAY FROM AGE(c.fecha_fin, NOW())) AS dias_restantes
       FROM contratos c
       JOIN proveedores p ON p.id = c.proveedor_id
       WHERE c.estado = 'VIGENTE'
       AND c.fecha_fin IS NOT NULL
       AND c.fecha_fin BETWEEN NOW() - INTERVAL '7 days' AND NOW() + INTERVAL '60 days'
       ${instId ? 'AND c.institucion_id=$1' : ''}
       ORDER BY c.fecha_fin ASC`,
      instId ? [instId] : []
    );
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

//////////////////////////////////////////////////
// 📋 RONDAS DE INVENTARIO
//////////////////////////////////////////////////

// Listar todas las rondas
app.get('/rondas', authMiddleware, async (req, res) => {
  try {
    const instId = filtroInstitucion(req);
    const q = instId
      ? `SELECT r.*, u.nombre AS responsable_nombre 
         FROM rondas_inventario r 
         LEFT JOIN usuarios u ON u.id = r.responsable_id 
         WHERE r.institucion_id = $1 
         ORDER BY r.fecha_inicio DESC`
      : `SELECT r.*, u.nombre AS responsable_nombre, i.nombre AS institucion_nombre
         FROM rondas_inventario r 
         LEFT JOIN usuarios u ON u.id = r.responsable_id 
         LEFT JOIN instituciones i ON i.id = r.institucion_id
         ORDER BY r.fecha_inicio DESC`;
    const result = await pool.query(q, instId ? [instId] : []);
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Ver detalle de una ronda específica con todos los ítems
app.get('/rondas/:id', authMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT r.*, u.nombre AS responsable_nombre, i.nombre AS institucion_nombre, i.logo_url 
       FROM rondas_inventario r 
       LEFT JOIN usuarios u ON u.id = r.responsable_id 
       LEFT JOIN instituciones i ON i.id = r.institucion_id 
       WHERE r.id = $1`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Ronda no encontrada' });
    
    const items = await pool.query(
      `SELECT ri.*, e.nombre AS equipo_nombre, e.marca, e.modelo, e.serie, 
              e.servicio AS servicio_registrado, e.activo_fijo, e.ubicacion 
       FROM ronda_items ri 
       JOIN equipos_biomedicos e ON e.id = ri.equipo_id 
       WHERE ri.ronda_id = $1 
       ORDER BY e.servicio, e.nombre`,
      [req.params.id]
    );
    
    res.json({ ...r.rows[0], items: items.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Iniciar nueva ronda
app.post('/rondas', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { servicio_filtro, observaciones_generales } = req.body;
    const instId = req.user.institucion_id || null;
    
    // Generar número de ronda automático
    const ultima = await client.query(
      `SELECT COUNT(*) AS total FROM rondas_inventario 
       WHERE institucion_id IS NOT DISTINCT FROM $1 
       AND EXTRACT(YEAR FROM fecha_inicio) = EXTRACT(YEAR FROM NOW())`,
      [instId]
    );
    const num = parseInt(ultima.rows[0].total) + 1;
    const numeroRonda = `RND-${new Date().getFullYear()}-${String(num).padStart(4,'0')}`;
    
    await client.query('BEGIN');
    
    // Crear cabecera de ronda
    const r = await client.query(
      `INSERT INTO rondas_inventario 
       (numero_ronda, servicio_filtro, observaciones_generales, responsable_id, institucion_id) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [numeroRonda, servicio_filtro || null, observaciones_generales || null, req.user.id, instId]
    );
    const rondaId = r.rows[0].id;
    
    // Cargar equipos al detalle (snapshot del inventario actual)
    let equiposQ = `SELECT id FROM equipos_biomedicos WHERE estado != 'Baja'`;
    const params = [];
    if (instId) {
      params.push(instId);
      equiposQ += ` AND institucion_id = $${params.length}`;
    }
    if (servicio_filtro) {
      params.push(servicio_filtro);
      equiposQ += ` AND servicio = $${params.length}`;
    }
    
    const equipos = await client.query(equiposQ, params);
    
    for (const eq of equipos.rows) {
      await client.query(
        `INSERT INTO ronda_items (ronda_id, equipo_id, estado) 
         VALUES ($1, $2, 'PENDIENTE')`,
        [rondaId, eq.id]
      );
    }
    
    // Actualizar total de equipos
    await client.query(
      'UPDATE rondas_inventario SET total_equipos = $1 WHERE id = $2',
      [equipos.rows.length, rondaId]
    );
    
    await client.query('COMMIT');
    await registrarAuditoria(req, 'CREAR', 'RONDA', rondaId);
    
    res.json({ ...r.rows[0], total_equipos: equipos.rows.length });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// Actualizar el estado de un ítem de la ronda
app.put('/rondas/:rondaId/item/:equipoId', authMiddleware, async (req, res) => {
  try {
    const { rondaId, equipoId } = req.params;
    const { estado, servicio_real, observaciones } = req.body;
    
    if (!['PRESENTE', 'NO_ENCONTRADO', 'CON_OBSERVACION', 'PENDIENTE'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    
    await pool.query(
      `UPDATE ronda_items 
       SET estado = $1, servicio_real = $2, observaciones = $3, fecha_chequeo = NOW() 
       WHERE ronda_id = $4 AND equipo_id = $5`,
      [estado, servicio_real || null, observaciones || null, rondaId, equipoId]
    );
    
    // Recalcular contadores de la ronda
    const stats = await pool.query(
      `SELECT 
        SUM(CASE WHEN estado='PRESENTE' THEN 1 ELSE 0 END) AS presentes,
        SUM(CASE WHEN estado='NO_ENCONTRADO' THEN 1 ELSE 0 END) AS no_encontrados,
        SUM(CASE WHEN estado='CON_OBSERVACION' THEN 1 ELSE 0 END) AS con_observacion,
        COUNT(*) AS total
       FROM ronda_items WHERE ronda_id = $1`,
      [rondaId]
    );
    
    const s = stats.rows[0];
    const chequeados = parseInt(s.presentes) + parseInt(s.no_encontrados) + parseInt(s.con_observacion);
    const pct = s.total > 0 ? Math.round((chequeados / s.total) * 1000) / 10 : 0;
    
    await pool.query(
      `UPDATE rondas_inventario 
       SET presentes = $1, no_encontrados = $2, con_observacion = $3, porcentaje_cumplimiento = $4 
       WHERE id = $5`,
      [s.presentes, s.no_encontrados, s.con_observacion, pct, rondaId]
    );
    
    res.json({ ok: true, stats: s });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Finalizar ronda
app.put('/rondas/:id/finalizar', authMiddleware, async (req, res) => {
  try {
    const { observaciones_generales } = req.body;
    await pool.query(
      `UPDATE rondas_inventario 
       SET estado = 'FINALIZADA', fecha_fin = NOW(), observaciones_generales = COALESCE($1, observaciones_generales) 
       WHERE id = $2`,
      [observaciones_generales || null, req.params.id]
    );
    await registrarAuditoria(req, 'FINALIZAR', 'RONDA', req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Eliminar ronda (solo Admin/SuperAdmin y solo si está en progreso)
app.delete('/rondas/:id', authMiddleware, soloAdmin, async (req, res) => {
  try {
    await registrarAuditoria(req, 'ELIMINAR', 'RONDA', req.params.id);
    await pool.query('DELETE FROM rondas_inventario WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// KPIs de rondas
app.get('/rondas/kpis/general', authMiddleware, async (req, res) => {
  try {
    const instId = filtroInstitucion(req);
    const w = instId ? 'WHERE institucion_id = $1' : '';
    const p = instId ? [instId] : [];
    
    const total = await pool.query(`SELECT COUNT(*) FROM rondas_inventario ${w}`, p);
    const enProgreso = await pool.query(
      `SELECT COUNT(*) FROM rondas_inventario WHERE estado='EN_PROGRESO'${instId?' AND institucion_id=$1':''}`, p
    );
    const finalizadas = await pool.query(
      `SELECT COUNT(*) FROM rondas_inventario WHERE estado='FINALIZADA'${instId?' AND institucion_id=$1':''}`, p
    );
    const promCumplimiento = await pool.query(
      `SELECT COALESCE(AVG(porcentaje_cumplimiento), 0) AS prom 
       FROM rondas_inventario 
       WHERE estado='FINALIZADA'${instId?' AND institucion_id=$1':''}`, p
    );
    
    res.json({
      total: parseInt(total.rows[0].count),
      enProgreso: parseInt(enProgreso.rows[0].count),
      finalizadas: parseInt(finalizadas.rows[0].count),
      promedioCumplimiento: parseFloat(promCumplimiento.rows[0].prom)
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

//////////////////////////////////////////////////
// 📜 HISTORIAL
//////////////////////////////////////////////////
app.get('/historial/:equipo_id', authMiddleware, async (req, res) => {
  const result = await pool.query('SELECT * FROM historial_equipos WHERE equipo_id=$1 ORDER BY fecha DESC', [req.params.equipo_id]);
  res.json(result.rows);
});

//////////////////////////////////////////////////
// 📄 PDF GENERAL
//////////////////////////////////////////////////
app.get('/reporte/equipos', authMiddleware, async (req, res) => {
  try {
    const instId = filtroInstitucion(req);
    const equipos = await pool.query(`SELECT * FROM equipos_biomedicos ${instId?'WHERE institucion_id=$1':''} ORDER BY servicio,nombre`, instId?[instId]:[]);
    const usuario = await pool.query('SELECT nombre,rol FROM usuarios WHERE id=$1',[req.user?.id]);
    let instNombre = req.user?.institucion_nombre || 'Todas las instituciones';
    const AZUL='#0a2342',MUTED='#6b7a8d',NEGRO='#1a1a2e',BLANCO='#ffffff';
    const now=new Date();
    const doc=new PDFDocument({margin:40,size:'A4',layout:'landscape'});
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition','attachment; filename=reporte_biomed.pdf');
    doc.pipe(res);
    doc.rect(0,0,842,70).fill(AZUL);
    doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(18).text('REPORTE DE EQUIPOS BIOMÉDICOS',60,12);
    doc.fillColor('#00e5a0').font('Helvetica').fontSize(10).text(instNombre,60,36);
    doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(`Generado: ${now.toLocaleDateString('es-CO')} · Por: ${usuario.rows[0]?.nombre||'Sistema'}`,60,80);
    doc.fillColor(NEGRO).fontSize(10).text(`Total equipos: ${equipos.rows.length}`,60,100);
    let y = 140;
    equipos.rows.forEach((eq,i)=>{
      if (y > 530) { doc.addPage({size:'A4',layout:'landscape'}); y = 40; }
      doc.fillColor(NEGRO).fontSize(9).text(`${i+1}. ${eq.nombre} | ${eq.marca||''} ${eq.modelo||''} | Serie: ${eq.serie||'—'} | Servicio: ${eq.servicio||'—'} | ${eq.estado||'—'}`,40,y);
      y += 16;
    });
    doc.end();
  } catch(e){ console.error('PDF:',e); res.status(500).json({error:'Error PDF'}); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Servidor en puerto ${PORT}`));