const express = require('express');
const router = express.Router();
const { createLab, getUserLabs, deleteLab, getStats } = require('../controllers/labController');

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

// Eliminar laboratorio
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await deleteLab(
      req.params.id, 
      req.session.user.id,
      req.session.user.isAdmin
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
