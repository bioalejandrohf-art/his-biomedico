const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = 4000;
const pool = require('./db');

app.use(cors());
app.use(express.json());

const SECRET = 'clave_super_segura';

//////////////////////////////////////////////////
// 🔐 AUTH
//////////////////////////////////////////////////
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(403).json({ error: 'No autorizado' });
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: 'Token inválido' });
  }
};

const soloAdmin = (req, res, next) => {
  if (req.user?.rol !== 'Admin')
    return res.status(403).json({ error: 'Solo administradores' });
  next();
};

//////////////////////////////////////////////////
// 🕵️ AUDITORÍA
//////////////////////////////////////////////////
const registrarAuditoria = async (req, accion, modulo, recurso_id) => {
  try {
    await pool.query(
      `INSERT INTO auditoria (usuario_id, accion, modulo, recurso_id, ip)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.user?.id || null, accion, modulo, recurso_id, req.ip]
    );
  } catch (e) { console.error("Error auditoría:", e); }
};

//////////////////////////////////////////////////
// 📜 HISTORIAL
//////////////////////////////////////////////////
const registrarHistorial = async (equipo_id, accion, descripcion) => {
  try {
    await pool.query(
      `INSERT INTO historial_equipos (equipo_id, accion, descripcion)
       VALUES ($1,$2,$3)`,
      [equipo_id, accion, descripcion]
    );
  } catch (e) { console.error("Error historial:", e); }
};

//////////////////////////////////////////////////
// 👤 REGISTER
//////////////////////////////////////////////////
app.post('/register', async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO usuarios (nombre,email,password,rol) VALUES ($1,$2,$3,$4) RETURNING id,nombre,email,rol,creado_en',
      [nombre, email, hash, rol]
    );
    res.json(result.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'El email ya existe' });
    res.status(500).json({ error: e.message });
  }
});

//////////////////////////////////////////////////
// 🔑 LOGIN
//////////////////////////////////////////////////
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
  if (user.rows.length === 0)
    return res.status(400).json({ error: 'Usuario no existe' });
  const valid = await bcrypt.compare(password, user.rows[0].password);
  if (!valid)
    return res.status(400).json({ error: 'Contraseña incorrecta' });
  const token = jwt.sign(
    { id: user.rows[0].id, rol: user.rows[0].rol, nombre: user.rows[0].nombre },
    SECRET
  );
  res.json({ token });
});

//////////////////////////////////////////////////
// 👥 GESTIÓN DE USUARIOS (solo Admin)
//////////////////////////////////////////////////
app.get('/usuarios', authMiddleware, soloAdmin, async (req, res) => {
  const result = await pool.query(
    'SELECT id, nombre, email, rol, creado_en FROM usuarios ORDER BY creado_en DESC'
  );
  res.json(result.rows);
});

app.put('/usuarios/:id', authMiddleware, soloAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, rol, password } = req.body;

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        'UPDATE usuarios SET nombre=$1, email=$2, rol=$3, password=$4 WHERE id=$5',
        [nombre, email, rol, hash, id]
      );
    } else {
      await pool.query(
        'UPDATE usuarios SET nombre=$1, email=$2, rol=$3 WHERE id=$4',
        [nombre, email, rol, id]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/usuarios/:id', authMiddleware, soloAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user.id)
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
    await pool.query('DELETE FROM usuarios WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

//////////////////////////////////////////////////
// 📦 EQUIPOS
//////////////////////////////////////////////////
app.get('/equipos', authMiddleware, async (req, res) => {
  const result = await pool.query('SELECT * FROM equipos_biomedicos ORDER BY nombre');
  res.json(result.rows);
});

app.post('/equipos', authMiddleware, async (req, res) => {
  const data = req.body;
  const result = await pool.query(
    `INSERT INTO equipos_biomedicos 
    (nombre, marca, modelo, serie, registro_invima, fecha_vencimiento_invima,
     clasificacion_riesgo, ubicacion, servicio, estado) 
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [data.nombre, data.marca, data.modelo, data.serie, data.registro_invima,
     data.fecha_vencimiento_invima, data.clasificacion_riesgo,
     data.ubicacion, data.servicio, data.estado]
  );
  const equipo = result.rows[0];
  await registrarAuditoria(req, 'CREAR', 'EQUIPOS', equipo.id);
  await registrarHistorial(equipo.id, 'CREACIÓN', `Equipo creado: ${equipo.nombre}`);
  res.json(equipo);
});

app.put('/equipos/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  await pool.query(
    `UPDATE equipos_biomedicos SET
      nombre=$1, marca=$2, modelo=$3, serie=$4, registro_invima=$5,
      fecha_vencimiento_invima=$6, clasificacion_riesgo=$7,
      ubicacion=$8, servicio=$9, estado=$10
     WHERE id=$11`,
    [data.nombre, data.marca, data.modelo, data.serie, data.registro_invima,
     data.fecha_vencimiento_invima, data.clasificacion_riesgo,
     data.ubicacion, data.servicio, data.estado, id]
  );
  await registrarAuditoria(req, 'EDITAR', 'EQUIPOS', id);
  await registrarHistorial(id, 'EDICIÓN', 'Equipo actualizado');
  res.json({ ok: true });
});

app.delete('/equipos/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const existe = await pool.query('SELECT * FROM equipos_biomedicos WHERE id=$1', [id]);
    if (existe.rows.length === 0)
      return res.status(404).json({ error: 'Equipo no encontrado' });
    await registrarAuditoria(req, 'ELIMINAR', 'EQUIPOS', id);
    await pool.query('DELETE FROM historial_equipos WHERE equipo_id=$1', [id]);
    await pool.query('DELETE FROM mantenimientos WHERE equipo_id=$1', [id]);
    await pool.query('DELETE FROM tecnovigilancia WHERE equipo_id=$1', [id]);
    await pool.query('DELETE FROM equipos_biomedicos WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

//////////////////////////////////////////////////
// 🔧 MANTENIMIENTOS
//////////////////////////////////////////////////
app.post('/mantenimientos', authMiddleware, async (req, res) => {
  try {
    const { equipo_id, tipo, descripcion, fecha_programada, prioridad } = req.body;
    const result = await pool.query(
      `INSERT INTO mantenimientos (equipo_id,tipo,descripcion,fecha_programada,estado,prioridad)
       VALUES ($1,$2,$3,$4,'PENDIENTE',$5) RETURNING *`,
      [equipo_id, tipo, descripcion, fecha_programada, prioridad || 'NORMAL']
    );
    await registrarAuditoria(req, 'CREAR', 'MANTENIMIENTO', result.rows[0].id);
    await registrarHistorial(equipo_id, 'MANTENIMIENTO', `OT creada: ${tipo}`);
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/mantenimientos', authMiddleware, async (req, res) => {
  const result = await pool.query(
    `SELECT m.*, e.nombre AS equipo_nombre, e.servicio AS equipo_servicio
     FROM mantenimientos m
     JOIN equipos_biomedicos e ON e.id=m.equipo_id
     ORDER BY CASE m.prioridad
       WHEN 'CRITICA' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'NORMAL' THEN 3 ELSE 4 END,
       m.fecha_programada ASC`
  );
  res.json(result.rows);
});

app.put('/mantenimientos/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { observaciones } = req.body;
    const m = await pool.query('SELECT * FROM mantenimientos WHERE id=$1', [id]);
    if (m.rows.length === 0) return res.status(404).json({ error: 'OT no encontrada' });
    await pool.query(
      `UPDATE mantenimientos SET estado='REALIZADO', fecha_realizada=NOW(), observaciones=$1 WHERE id=$2`,
      [observaciones || null, id]
    );
    await registrarAuditoria(req, 'FINALIZAR', 'MANTENIMIENTO', id);
    await registrarHistorial(m.rows[0].equipo_id, 'MANTENIMIENTO', `OT finalizada: ${m.rows[0].tipo}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/mantenimientos/kpis', authMiddleware, async (req, res) => {
  try {
    const total      = await pool.query(`SELECT COUNT(*) FROM mantenimientos`);
    const pendientes = await pool.query(`SELECT COUNT(*) FROM mantenimientos WHERE estado='PENDIENTE'`);
    const realizados = await pool.query(`SELECT COUNT(*) FROM mantenimientos WHERE estado='REALIZADO'`);
    const criticas   = await pool.query(`SELECT COUNT(*) FROM mantenimientos WHERE prioridad='CRITICA' AND estado='PENDIENTE'`);
    const mttr = await pool.query(`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (fecha_realizada-fecha_programada))/86400)::numeric,1) AS mttr
      FROM mantenimientos WHERE estado='REALIZADO' AND fecha_realizada IS NOT NULL
    `);
    res.json({
      total:      parseInt(total.rows[0].count),
      pendientes: parseInt(pendientes.rows[0].count),
      realizados: parseInt(realizados.rows[0].count),
      criticas:   parseInt(criticas.rows[0].count),
      mttr:       mttr.rows[0].mttr || 0,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

//////////////////////////////////////////////////
// 🚨 TECNOVIGILANCIA
//////////////////////////////////////////////////
app.get('/tecnovigilancia', authMiddleware, async (req, res) => {
  const result = await pool.query(
    `SELECT t.*, e.nombre AS equipo_nombre, u.nombre AS reportado_nombre
     FROM tecnovigilancia t
     LEFT JOIN equipos_biomedicos e ON e.id=t.equipo_id
     LEFT JOIN usuarios u ON u.id=t.reportado_por
     ORDER BY t.created_at DESC`
  );
  res.json(result.rows);
});

app.post('/tecnovigilancia', authMiddleware, async (req, res) => {
  try {
    const { equipo_id, tipo, descripcion, fecha_evento, gravedad } = req.body;
    const result = await pool.query(
      `INSERT INTO tecnovigilancia (equipo_id,tipo,descripcion,fecha_evento,gravedad,estado,reportado_por)
       VALUES ($1,$2,$3,$4,$5,'ABIERTO',$6) RETURNING *`,
      [equipo_id, tipo, descripcion, fecha_evento, gravedad, req.user.id]
    );
    await registrarAuditoria(req, 'CREAR', 'TECNOVIGILANCIA', result.rows[0].id);
    if (equipo_id) {
      await registrarHistorial(equipo_id, 'TECNOVIGILANCIA', `Reporte ${tipo}: ${gravedad}`);
    }
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/tecnovigilancia/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    await pool.query('UPDATE tecnovigilancia SET estado=$1 WHERE id=$2', [estado, id]);
    await registrarAuditoria(req, 'ACTUALIZAR', 'TECNOVIGILANCIA', id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

//////////////////////////////////////////////////
// 📊 DASHBOARD KPIs GENERALES
//////////////////////////////////////////////////
app.get('/dashboard/kpis', authMiddleware, async (req, res) => {
  try {
    const totalEquipos  = await pool.query(`SELECT COUNT(*) FROM equipos_biomedicos`);
    const activos       = await pool.query(`SELECT COUNT(*) FROM equipos_biomedicos WHERE estado='Activo'`);
    const enMant        = await pool.query(`SELECT COUNT(*) FROM equipos_biomedicos WHERE estado='Mantenimiento'`);
    const invVencidos   = await pool.query(`SELECT COUNT(*) FROM equipos_biomedicos WHERE fecha_vencimiento_invima < NOW()`);
    const otPendientes  = await pool.query(`SELECT COUNT(*) FROM mantenimientos WHERE estado='PENDIENTE'`);
    const otRealizados  = await pool.query(`SELECT COUNT(*) FROM mantenimientos WHERE estado='REALIZADO'`);
    const tecnoAbiertos = await pool.query(`SELECT COUNT(*) FROM tecnovigilancia WHERE estado='ABIERTO'`);

    // Equipos por servicio
    const porServicio = await pool.query(
      `SELECT servicio, COUNT(*) as total FROM equipos_biomedicos
       WHERE servicio IS NOT NULL AND servicio != ''
       GROUP BY servicio ORDER BY total DESC LIMIT 8`
    );

    // Mantenimientos por mes (últimos 6 meses)
    const porMes = await pool.query(`
      SELECT TO_CHAR(fecha_programada, 'Mon YY') AS mes,
             COUNT(*) AS total,
             SUM(CASE WHEN estado='REALIZADO' THEN 1 ELSE 0 END) AS realizados
      FROM mantenimientos
      WHERE fecha_programada >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(fecha_programada, 'Mon YY'), DATE_TRUNC('month', fecha_programada)
      ORDER BY DATE_TRUNC('month', fecha_programada)
    `);

    // Equipos por clasificación de riesgo
    const porRiesgo = await pool.query(
      `SELECT clasificacion_riesgo AS riesgo, COUNT(*) as total
       FROM equipos_biomedicos
       WHERE clasificacion_riesgo IS NOT NULL AND clasificacion_riesgo != ''
       GROUP BY clasificacion_riesgo ORDER BY clasificacion_riesgo`
    );

    // Tecnovigilancia por gravedad
    const porGravedad = await pool.query(
      `SELECT gravedad, COUNT(*) as total FROM tecnovigilancia GROUP BY gravedad`
    );

    res.json({
      totalEquipos:  parseInt(totalEquipos.rows[0].count),
      activos:       parseInt(activos.rows[0].count),
      enMant:        parseInt(enMant.rows[0].count),
      invVencidos:   parseInt(invVencidos.rows[0].count),
      otPendientes:  parseInt(otPendientes.rows[0].count),
      otRealizados:  parseInt(otRealizados.rows[0].count),
      tecnoAbiertos: parseInt(tecnoAbiertos.rows[0].count),
      porServicio:   porServicio.rows,
      porMes:        porMes.rows,
      porRiesgo:     porRiesgo.rows,
      porGravedad:   porGravedad.rows,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

//////////////////////////////////////////////////
// 📜 HISTORIAL
//////////////////////////////////////////////////
app.get('/historial/:equipo_id', authMiddleware, async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM historial_equipos WHERE equipo_id=$1 ORDER BY fecha DESC`,
    [req.params.equipo_id]
  );
  res.json(result.rows);
});

//////////////////////////////////////////////////
// 📄 PDF
//////////////////////////////////////////////////
app.get('/reporte/equipos', authMiddleware, async (req, res) => {
  try {
    const equipos = await pool.query('SELECT * FROM equipos_biomedicos ORDER BY servicio, nombre');
    const mants   = await pool.query(`
      SELECT m.*, e.nombre AS equipo_nombre FROM mantenimientos m
      JOIN equipos_biomedicos e ON e.id=m.equipo_id
      ORDER BY m.fecha_programada DESC LIMIT 20
    `);
    const usuario = await pool.query('SELECT nombre, rol FROM usuarios WHERE id=$1', [req.user?.id]);

    const AZUL='#0a2342', VERDE='#00b87a', GRIS='#f4f6f9', MUTED='#6b7a8d', NEGRO='#1a1a2e', BLANCO='#ffffff';
    const FONT_SIZE=7.5, PADDING=5, MIN_H=18;
    const now = new Date();

    const fmtFecha = (f) => {
      if (!f) return '—';
      return new Date(f).toLocaleDateString('es-CO', { year:'numeric', month:'short', day:'2-digit' });
    };
    const estadoInvima = (fecha) => {
      if (!fecha) return { label:'SIN FECHA', color:MUTED };
      const diff = (new Date(fecha)-now)/(1000*60*60*24);
      if (diff<0)   return { label:'VENCIDO',    color:'#e63946' };
      if (diff<=30) return { label:'POR VENCER', color:'#f4a261' };
      return              { label:'VIGENTE',     color:VERDE };
    };

    const doc = new PDFDocument({ margin:40, size:'A4', layout:'landscape' });
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition','attachment; filename=reporte_biomed.pdf');
    doc.pipe(res);

    const PW=842, PH=595, MARGIN=40, anchoUtil=PW-MARGIN*2;

    const calcRowHeight = (celdas, colWidths) => {
      let maxH = MIN_H;
      celdas.forEach((val,i) => {
        doc.font('Helvetica').fontSize(FONT_SIZE);
        const h = doc.heightOfString(val||'—', { width: colWidths[i]-PADDING*2 });
        if (h+PADDING*2 > maxH) maxH = h+PADDING*2;
      });
      return maxH;
    };

    const drawRow = (celdas, colWidths, colors, bolds, xStart, yStart, rowH, rowBg) => {
      doc.rect(xStart, yStart, anchoUtil, rowH).fill(rowBg);
      let cx = xStart;
      celdas.forEach((val,i) => {
        doc.fillColor(colors[i]).font(bolds[i]?'Helvetica-Bold':'Helvetica').fontSize(FONT_SIZE)
           .text(val||'—', cx+PADDING, yStart+PADDING, { width:colWidths[i]-PADDING*2, lineBreak:true });
        cx += colWidths[i];
      });
      doc.rect(xStart, yStart+rowH-0.5, anchoUtil, 0.5).fill('#dde3ec');
    };

    const drawHeader = (labels, widths, xStart, yStart) => {
      doc.rect(xStart, yStart, anchoUtil, MIN_H).fill(AZUL);
      let cx = xStart;
      labels.forEach((lbl,i) => {
        doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(FONT_SIZE)
           .text(lbl, cx+PADDING, yStart+5, { width:widths[i]-PADDING*2, lineBreak:false });
        cx += widths[i];
      });
      return yStart+MIN_H;
    };

    const nuevaPagina = (titulo) => {
      doc.rect(0,PH-22,PW,22).fill(AZUL);
      doc.fillColor('#8ab4d4').font('Helvetica').fontSize(7)
         .text('BioMed·HIS · Colombia', MARGIN, PH-14);
      doc.addPage({ size:'A4', layout:'landscape' });
      doc.rect(0,0,PW,26).fill(AZUL);
      doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(9)
         .text(titulo+' — continuación', MARGIN, 8);
      return 36;
    };

    // Header
    doc.rect(0,0,PW,70).fill(AZUL);
    doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(20)
       .text('REPORTE DE EQUIPOS BIOMÉDICOS', MARGIN+30, 13);
    doc.fillColor(VERDE).font('Helvetica').fontSize(10)
       .text('Sistema de Gestión de Tecnología Clínica — BioMed·HIS', MARGIN+30, 38);
    doc.fillColor('#8ab4d4').font('Helvetica').fontSize(8)
       .text('Resolución 3100 de 2019 · Decreto 4725 de 2005', MARGIN+30, 54);
    doc.rect(0,70,PW,28).fill('#eef2f7');
    doc.fillColor(MUTED).font('Helvetica').fontSize(8);
    doc.text(`Generado: ${now.toLocaleDateString('es-CO',{year:'numeric',month:'long',day:'2-digit',hour:'2-digit',minute:'2-digit'})}`, MARGIN, 80);
    doc.text(`Por: ${usuario.rows[0]?.nombre||'Sistema'} (${usuario.rows[0]?.rol||''})`, 300, 80);
    doc.text(`Total equipos: ${equipos.rows.length}`, 660, 80);

    let y = 112;
    const vencidos  = equipos.rows.filter(e=>estadoInvima(e.fecha_vencimiento_invima).label==='VENCIDO').length;
    const porVencer = equipos.rows.filter(e=>estadoInvima(e.fecha_vencimiento_invima).label==='POR VENCER').length;
    const activos   = equipos.rows.filter(e=>e.estado==='Activo').length;
    const enMant    = equipos.rows.filter(e=>e.estado==='Mantenimiento').length;

    const kpiCards = [
      { label:'Total Equipos', valor:equipos.rows.length, color:AZUL },
      { label:'Activos',       valor:activos,             color:VERDE },
      { label:'En Mant.',      valor:enMant,              color:'#f4a261' },
      { label:'INVIMA Vencido',valor:vencidos,            color:'#e63946' },
      { label:'Por Vencer',    valor:porVencer,           color:'#f4a261' },
    ];
    let kpiX = MARGIN;
    kpiCards.forEach(k => {
      doc.rect(kpiX,y,130,46).fill(k.color);
      doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(22)
         .text(String(k.valor), kpiX, y+5, { width:130, align:'center' });
      doc.fillColor(BLANCO).font('Helvetica').fontSize(7.5)
         .text(k.label.toUpperCase(), kpiX, y+31, { width:130, align:'center' });
      kpiX += 140;
    });
    y += 62;

    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(11).text('INVENTARIO DE EQUIPOS', MARGIN, y);
    doc.rect(MARGIN,y+14,anchoUtil,1.5).fill(VERDE);
    y += 20;

    const colsInv = {
      labels: ['Nombre del Equipo','Marca','Modelo','N° Serie','Reg. INVIMA','Vencimiento','Est. INVIMA','Estado','Servicio'],
      widths: [148,80,80,80,110,78,72,78,96],
    };
    y = drawHeader(colsInv.labels, colsInv.widths, MARGIN, y);

    equipos.rows.forEach((eq,i) => {
      const inv = estadoInvima(eq.fecha_vencimiento_invima);
      const estColor = eq.estado==='Activo'?VERDE:eq.estado==='Mantenimiento'?'#f4a261':MUTED;
      const celdas = [eq.nombre,eq.marca,eq.modelo,eq.serie,eq.registro_invima,
        fmtFecha(eq.fecha_vencimiento_invima),inv.label,eq.estado,eq.servicio];
      const colors = [NEGRO,NEGRO,NEGRO,MUTED,NEGRO,inv.color,inv.color,estColor,MUTED];
      const bolds  = [true,false,false,false,false,false,true,true,false];
      const rowH   = calcRowHeight(celdas, colsInv.widths);
      if (y+rowH > PH-30) { y = nuevaPagina('INVENTARIO'); y = drawHeader(colsInv.labels,colsInv.widths,MARGIN,y); }
      drawRow(celdas, colsInv.widths, colors, bolds, MARGIN, y, rowH, i%2===0?BLANCO:GRIS);
      y += rowH;
    });

    if (mants.rows.length > 0) {
      y += 18;
      if (y > PH-80) y = nuevaPagina('MANTENIMIENTOS');
      doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(11).text('MANTENIMIENTOS RECIENTES', MARGIN, y);
      doc.rect(MARGIN,y+14,anchoUtil,1.5).fill(VERDE);
      y += 20;
      const colsM = { labels:['Equipo','Tipo','Prioridad','Programado','Realizado','Estado'], widths:[230,110,100,112,112,98] };
      y = drawHeader(colsM.labels, colsM.widths, MARGIN, y);
      mants.rows.forEach((m,i) => {
        const prioColor = m.prioridad==='CRITICA'?'#e63946':m.prioridad==='ALTA'?'#f4a261':MUTED;
        const estColor  = m.estado==='REALIZADO'?VERDE:'#f4a261';
        const celdas = [m.equipo_nombre,m.tipo,m.prioridad,fmtFecha(m.fecha_programada),
          m.fecha_realizada?fmtFecha(m.fecha_realizada):'—',m.estado];
        const colors = [NEGRO,NEGRO,prioColor,NEGRO,NEGRO,estColor];
        const bolds  = [true,false,true,false,false,true];
        const rowH   = calcRowHeight(celdas, colsM.widths);
        if (y+rowH > PH-30) { y = nuevaPagina('MANTENIMIENTOS'); y = drawHeader(colsM.labels,colsM.widths,MARGIN,y); }
        drawRow(celdas, colsM.widths, colors, bolds, MARGIN, y, rowH, i%2===0?BLANCO:GRIS);
        y += rowH;
      });
    }

    y += 16;
    doc.rect(MARGIN,y,anchoUtil,1).fill('#dde3ec');
    y += 6;
    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5)
       .text('BioMed·HIS · Sistema de Gestión de Tecnología Clínica · Colombia  ·  Res. 3100/2019 · Dec. 4725/2005 · Ley 1581/2012',
             MARGIN, y, { width:anchoUtil, align:'center' });
    doc.end();
  } catch (e) {
    console.error('Error PDF:', e);
    res.status(500).json({ error: 'Error generando PDF' });
  }
});

//////////////////////////////////////////////////
// 🚀 SERVER
//////////////////////////////////////////////////
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));