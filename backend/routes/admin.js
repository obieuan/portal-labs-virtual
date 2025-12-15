const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const portainerClient = require('../config/portainer');

// Middleware para verificar que sea admin
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  if (!req.session.user.is_admin) {
    return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
  }
  next();
}

// Obtener todos los labs (de todos los usuarios)
router.get('/all-labs', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, u.email, u.name as user_name
      FROM labs l
      JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener estadísticas de usuarios
router.get('/user-stats', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM user_lab_stats');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar cualquier lab (admin puede eliminar labs de otros usuarios)
router.delete('/lab/:id', requireAdmin, async (req, res) => {
  try {
    const labId = req.params.id;
    
    const labResult = await pool.query('SELECT * FROM labs WHERE id = $1', [labId]);
    
    if (labResult.rows.length === 0) {
      return res.status(404).json({ error: 'Laboratorio no encontrado' });
    }
    
    const lab = labResult.rows[0];
    
    // Eliminar stack en Portainer (best-effort)
    try {
      await portainerClient.delete(
        `/stacks/${lab.stack_id}?endpointId=${process.env.PORTAINER_ENDPOINT_ID}`
      );
      console.log(`Stack ${lab.stack_id} eliminado de Portainer por admin`);
    } catch (portainerError) {
      if (portainerError.response && portainerError.response.status === 404) {
        console.log(`Stack ${lab.stack_id} ya no existe en Portainer (admin)`);
      } else {
        console.error('Error eliminando stack en Portainer (continuando):', portainerError.message);
      }
    }
    
    // Actualizar estado en BD
    await pool.query('UPDATE labs SET status = $1, canceled_at = NOW(), cancel_reason = $3 WHERE id = $2', ['CANCELADO_POR_USUARIO', labId, 'cancelado_por_admin']);
    
    // Registrar actividad
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.session.user.id, 'admin_lab_deleted', `Admin eliminó lab ${lab.container_name} del usuario ${lab.user_id}`]
    );
    
    res.json({ success: true, message: 'Laboratorio eliminado por administrador' });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Extender tiempo de un lab
router.post('/lab/:id/extend', requireAdmin, async (req, res) => {
  try {
    const labId = req.params.id;
    const { hours } = req.body; // Horas a extender
    
    if (!hours || hours <= 0) {
      return res.status(400).json({ error: 'Debe especificar horas válidas' });
    }
    
    const result = await pool.query(
      `UPDATE labs 
       SET expires_at = expires_at + INTERVAL '${hours} hours'
       WHERE id = $1 AND status = 'ACTIVO'
       RETURNING *`,
      [labId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Laboratorio no encontrado' });
    }
    
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.session.user.id, 'admin_lab_extended', `Admin extendió lab ${labId} por ${hours} horas`]
    );
    
    res.json({ success: true, lab: result.rows[0] });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
