require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./config/database');


const app = express();

app.set('trust proxy', 1);


// Middleware
const defaultOrigins = ['http://158.69.215.225', 'https://devlabs.eium.com.mx', 'http://localhost:8080', 'http://localhost:3000'];
const envOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean) : [];
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Session con PostgreSQL
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Routes
const authRoutes = require('./routes/auth');
const labRoutes = require('./routes/labs');
const adminRoutes = require('./routes/admin'); 

app.use('/auth', authRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/admin', adminRoutes); 

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  
  // Verificar conexión a PostgreSQL
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('❌ Error conectando a PostgreSQL:', err);
    } else {
      console.log('✅ Conexión a PostgreSQL exitosa');
    }
  });
});

// Cleanup de labs expirados cada 5 minutos
const { cleanupExpiredLabs } = require('./controllers/labController');
setInterval(cleanupExpiredLabs, 5 * 60 * 1000);
