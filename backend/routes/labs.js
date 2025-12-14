const express = require('express');
const router = express.Router();
const { createLab, getUserLabs, deleteLab, getStats } = require('../controllers/labController');
const pool = require('../config/database');  // ← AGREGAR
const portainerClient = require('../config/portainer');  // ← AGREGAR

// Middleware de autenticación REAL
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  next();
}

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

// Obtener estadísticas generales
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener laboratorios del usuario
router.get('/my-labs', requireAuth, async (req, res) => {
  try {
    const labs = await getUserLabs(req.session.user.id);
    res.json(labs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear nuevo laboratorio
router.post('/create', requireAuth, async (req, res) => {
  try {
    const lab = await createLab(req.session.user.id, req.session.user.email);
    res.json(lab);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const labId = req.params.id;
    
    const labResult = await pool.query('SELECT * FROM labs WHERE id = $1', [labId]);
    
    if (labResult.rows.length === 0) {
      return res.status(404).json({ error: 'Laboratorio no encontrado' });
    }
    
    const lab = labResult.rows[0];
    
    if (lab.user_id !== req.session.user.id && !req.session.user.is_admin) {
      return res.status(403).json({ error: 'No tienes permiso' });
    }
    
    // Intentar eliminar en Portainer (pero no fallar si no existe)
    try {
      await portainerClient.delete(
        `/stacks/${lab.stack_id}?endpointId=${process.env.PORTAINER_ENDPOINT_ID}`
      );
      console.log(`Stack ${lab.stack_id} eliminado de Portainer`);
    } catch (portainerError) {
      if (portainerError.response && portainerError.response.status === 404) {
        console.log(`Stack ${lab.stack_id} ya no existe en Portainer (OK)`);
      } else {
        console.error('Error en Portainer (continuando):', portainerError.message);
      }
    }
    
    await pool.query('UPDATE labs SET status = $1 WHERE id = $2', ['deleted', labId]);
    
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.session.user.id, 'lab_deleted', `Lab ${lab.container_name} eliminado`]
    );
    
    res.json({ success: true, message: 'Laboratorio eliminado' });
    
  } catch (error) {
    console.error('Error eliminando lab:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;