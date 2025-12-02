const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../config/database');

// Configuración de Azure AD
const AZURE_CONFIG = {
  clientId: process.env.AZURE_CLIENT_ID,
  tenantId: process.env.AZURE_TENANT_ID,
  clientSecret: process.env.AZURE_CLIENT_SECRET,
  redirectUri: process.env.AZURE_REDIRECT_URI,
  scope: 'openid profile email User.Read'
};

// Iniciar login con Microsoft
router.get('/login', (req, res) => {
  const authUrl = `https://login.microsoftonline.com/${AZURE_CONFIG.tenantId}/oauth2/v2.0/authorize?` +
    `client_id=${AZURE_CONFIG.clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(AZURE_CONFIG.redirectUri)}` +
    `&response_mode=query` +
    `&scope=${encodeURIComponent(AZURE_CONFIG.scope)}`;
  
  res.redirect(authUrl);
});

// Callback de Microsoft
router.all('/callback', async (req, res) => {
  console.log('=== CALLBACK RECIBIDO ===');
  console.log('Method:', req.method);
  console.log('Query:', req.query);
  
  const { code } = req.query;
  
  if (!code) {
    console.log('ERROR: No se recibió código');
    return res.redirect('/?error=no_code');
  }

  try {
    console.log('1. Intercambiando código por token...');
    
    // Intercambiar código por token
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${AZURE_CONFIG.tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: AZURE_CONFIG.clientId,
        client_secret: AZURE_CONFIG.clientSecret,
        code: code,
        redirect_uri: AZURE_CONFIG.redirectUri,
        grant_type: 'authorization_code'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('2. Token recibido correctamente');
    const { access_token } = tokenResponse.data;

    console.log('3. Obteniendo info del usuario de Microsoft Graph...');
    
    // Obtener info del usuario
    const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    console.log('4. Info de usuario recibida:', userResponse.data);
    
    const userInfo = userResponse.data;
    const email = userInfo.mail || userInfo.userPrincipalName;
    const name = userInfo.displayName;
    const microsoftId = userInfo.id;

    console.log('5. Buscando usuario en BD:', email);

    // Buscar o crear usuario en la BD
    let user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (user.rows.length === 0) {
      console.log('6. Usuario no existe, creando nuevo...');
      // Crear nuevo usuario
      const newUser = await pool.query(
        'INSERT INTO users (email, name, microsoft_id, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
        [email, name, microsoftId]
      );
      user = newUser;
      console.log('7. Usuario creado:', user.rows[0]);
    } else {
      console.log('6. Usuario existe, actualizando último login...');
      // Actualizar último login
      await pool.query('UPDATE users SET last_login = NOW() WHERE email = $1', [email]);
      console.log('7. Último login actualizado');
    }

    console.log('8. Guardando sesión...');
    
    // Guardar en sesión
    req.session.user = user.rows[0];
    req.session.save((err) => {
      if (err) {
        console.error('ERROR guardando sesión:', err);
        return res.redirect('/?error=session_failed');
      }
      console.log('9. Sesión guardada, redirigiendo a /');
      res.redirect('/');
    });

  } catch (error) {
    console.error('ERROR en autenticación:', error.response?.data || error.message);
    console.error('Stack:', error.stack);
    res.redirect('/?error=auth_failed');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Verificar si está autenticado
router.get('/me', (req, res) => {
  console.log('=== AUTH ME ===');
  console.log('Session ID:', req.sessionID);
  console.log('Session:', req.session);
  console.log('Cookies:', req.headers.cookie);
  
  if (req.session && req.session.user) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.user.id,
        email: req.session.user.email,
        name: req.session.user.name,
        isAdmin: req.session.user.is_admin
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;