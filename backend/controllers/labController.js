const pool = require('../config/database');
const portainerClient = require('../config/portainer');

const STATUS = {
  ACTIVO: 'ACTIVO',
  CANCELADO_POR_USUARIO: 'CANCELADO_POR_USUARIO',
  CANCELADO_POR_TIEMPO: 'CANCELADO_POR_TIEMPO'
};

const GLOBAL_MAX_LABS = 20;
const MAX_LABS_ALUMNO = 2;
const TTL_HOURS = 24;
const PUBLIC_HOST = process.env.PUBLIC_HOST || 'localhost';

// Función auxiliar: Obtener siguiente puerto disponible evitando labs activos
async function getNextAvailablePort(rangeStart, rangeEnd) {
  const result = await pool.query(
    'SELECT ssh_port, app_port FROM labs WHERE status = $1',
    [STATUS.ACTIVO]
  );

  const usedPorts = new Set();
  const addIfValid = (port) => {
    if (typeof port === 'number' && !Number.isNaN(port)) {
      usedPorts.add(port);
    }
  };

  result.rows.forEach(row => {
    addIfValid(row.ssh_port);
    addIfValid(row.app_port);
  });
  
  for (let port = rangeStart; port <= rangeEnd; port++) {
    if (!usedPorts.has(port)) {
      return port;
    }
  }
  
  throw new Error('No hay puertos disponibles');
}

// Helper para obtener rangos de puertos sin depender del orden de la consulta
async function getPortRange(startKey, endKey) {
  const result = await pool.query(
    'SELECT key, value FROM system_config WHERE key = ANY($1)',
    [[startKey, endKey]]
  );

  const config = result.rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});

  const start = parseInt(config[startKey], 10);
  const end = parseInt(config[endKey], 10);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error(`Configuración de puertos incompleta: ${startKey}/${endKey}`);
  }

  if (start > end) {
    throw new Error(`Rango de puertos inválido: ${startKey} (${start}) > ${endKey} (${end})`);
  }

  return { start, end };
}

function deriveUsername(containerName, password) {
  if (containerName && containerName.startsWith('lab-')) {
    const parts = containerName.split('-');
    if (parts.length >= 3 && parts[1]) {
      return parts[1];
    }
  }
  if (password && password.endsWith('2024')) {
    return password.replace('2024', '');
  }
  return null;
}

// Función auxiliar: Generar docker-compose.yml
function generateDockerCompose(sshPort, appPort, userEmail, stackName) {  
  const username = userEmail.split('@')[0];
  const password = username + '2024'; // Contraseña simple por ahora
  const image = process.env.LAB_IMAGE || 'lab-base:latest';
  const dbHostPort = appPort + 100; // evita colisión con backend (4000)
  
  return `version: '3.8'

services:
  dev-environment:
    image: ${image}
    container_name: ${stackName}
    working_dir: /home/${username}/proyecto
    ports:
      - "${sshPort}:22"
      - "${appPort}:3000"
      - "${dbHostPort}:5432"
    volumes:
      - lab_${stackName}_workspace:/home/${username}/proyecto
    environment:
      - POSTGRES_HOST=localhost
      - POSTGRES_USER=${username}
      - POSTGRES_PASSWORD=${password}
      - POSTGRES_DB=proyecto_db
    command: >
      bash -c "
      useradd -m -s /bin/bash ${username} &&
      echo '${username}:${password}' | chpasswd &&
      echo '${username} ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers &&
      chown -R ${username}:${username} /home/${username} &&
      service postgresql start &&
      sudo -u postgres psql -c \\"CREATE USER ${username} WITH PASSWORD '${password}';\\" 2>/dev/null || true &&
      sudo -u postgres psql -c \\"CREATE DATABASE proyecto_db OWNER ${username};\\" 2>/dev/null || true &&
      sudo -u postgres psql -c \\"GRANT ALL PRIVILEGES ON DATABASE proyecto_db TO ${username};\\" &&
      mkdir -p /run/sshd &&
      /usr/sbin/sshd -D
      "
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G

volumes:
  lab_${stackName}_workspace:
`;
}

// Crear laboratorio
async function createLab(userId, userEmail) {
  try {
    // 1. Verificar límites por usuario y globales
    const isAdmin = !!(await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId])).rows?.[0]?.is_admin;

    const userActive = await pool.query(
      'SELECT COUNT(*) FROM labs WHERE user_id = $1 AND status = $2',
      [userId, STATUS.ACTIVO]
    );
    const userActiveCount = parseInt(userActive.rows[0].count, 10);

    if (!isAdmin && userActiveCount >= MAX_LABS_ALUMNO) {
      throw new Error(`Límite alcanzado: máximo ${MAX_LABS_ALUMNO} laboratorios activos por usuario.`);
    }

    const activeLabsResult = await pool.query(
      'SELECT COUNT(*) FROM labs WHERE status = $1',
      [STATUS.ACTIVO]
    );
    const activeLabs = parseInt(activeLabsResult.rows[0].count, 10);
    const maxLabs = GLOBAL_MAX_LABS;
    
    if (activeLabs >= maxLabs) {
      throw new Error('No hay laboratorios disponibles en este momento (capacidad global alcanzada).');
    }
    
    // 3. Obtener puertos disponibles
    const { start: sshPortStart, end: sshPortEnd } = await getPortRange('ssh_port_range_start', 'ssh_port_range_end');
    const { start: appPortStart, end: appPortEnd } = await getPortRange('app_port_range_start', 'app_port_range_end');
    
    const sshPort = await getNextAvailablePort(sshPortStart, sshPortEnd);
    const appPort = await getNextAvailablePort(appPortStart, appPortEnd);
    
    // 4. Crear stack en Portainer
    if (!process.env.PORTAINER_URL || !process.env.PORTAINER_TOKEN) {
      throw new Error('Portainer no está configurado. Define PORTAINER_URL y PORTAINER_TOKEN en el entorno.');
    }
    const username = userEmail.split('@')[0];
    const stackName = `lab-${username}-${Date.now()}`;
    const dockerCompose = generateDockerCompose(sshPort, appPort, userEmail, stackName); 
    
    let portainerResponse;
    try {
      portainerResponse = await portainerClient.post(
        `/stacks/create/standalone/string?endpointId=${process.env.PORTAINER_ENDPOINT_ID}`,
        {
          name: stackName,
          stackFileContent: dockerCompose
        }
      );
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        throw new Error('No se pudo conectar a Portainer (ECONNREFUSED). ¿Está corriendo y accesible en PORTAINER_URL?');
      }
      throw err;
    }
    
    // 5. Calcular tiempo de expiración (24h fijo para MVP)
    const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);
    
    // 6. Guardar en base de datos
    const password = username + '2024';
    const insertResult = await pool.query(
      `INSERT INTO labs (user_id, owner_email, container_name, ssh_port, ssh_username, app_port, stack_id, portainer_endpoint_id, password, expires_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [userId, userEmail, stackName, sshPort, username, appPort, portainerResponse.data.Id, process.env.PORTAINER_ENDPOINT_ID, password, expiresAt, STATUS.ACTIVO]
    );
    
    // 7. Registrar actividad
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [userId, 'lab_created', `Laboratorio ${stackName} creado`]
    );
    
    // 8. Retornar información del laboratorio
    return {
      id: insertResult.rows[0].id,
      ssh: {
        host: PUBLIC_HOST,
        port: sshPort,
        username: username,
        password: password,
        command: `ssh -p ${sshPort} ${username}@${PUBLIC_HOST}`
      },
      app: {
        url: `http://${PUBLIC_HOST}:${appPort}`,
        port: appPort
      },
      database: {
        host: 'localhost',
        port: 5432,
        username: username,
        password: password,
        database: 'proyecto_db'
      },
      expiresAt: expiresAt,
      createdAt: insertResult.rows[0].created_at,
      status: STATUS.ACTIVO
    };
    
  } catch (error) {
    console.error('Error creando laboratorio:', error);
    throw error;
  }
}

// Obtener laboratorios del usuario (solo activos para dashboard)
async function getUserLabs(userId) {
  const result = await pool.query(
    'SELECT * FROM labs WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
    [userId, STATUS.ACTIVO]
  );
  return result.rows.map((row) => ({
    ...row,
    ssh_username: deriveUsername(row.container_name, row.password)
  }));
}

// Obtener todos los laboratorios para admins
async function getAllLabs() {
  const result = await pool.query(
    'SELECT * FROM labs ORDER BY created_at DESC'
  );
  return result.rows.map((row) => ({
    ...row,
    ssh_username: deriveUsername(row.container_name, row.password)
  }));
}

// Eliminar laboratorio (soft delete)
async function deleteLab(labId, userId, isAdmin = false) {
  try {
    let query = 'SELECT * FROM labs WHERE id = $1 AND status = $2';
    let params = [labId, STATUS.ACTIVO];

    if (!isAdmin) {
      query += ' AND user_id = $3';
      params.push(userId);
    }

    const labResult = await pool.query(query, params);

    if (labResult.rows.length === 0) {
      throw new Error('Laboratorio no encontrado o no autorizado para eliminar.');
    }

    // Soft delete - marcar como cancelado por usuario
    await pool.query(
      'UPDATE labs SET status = $1, canceled_at = NOW(), cancel_reason = $2 WHERE id = $3',
      [STATUS.CANCELADO_POR_USUARIO, 'cancelado_por_usuario', labId]
    );

    return { message: 'Laboratorio eliminado exitosamente.' };
  } catch (error) {
    console.error('Error eliminando laboratorio:', error);
    throw error;
  }
}

// Limpiar laboratorios expirados (cron job)
async function cleanupExpiredLabs() {
  try {
    const expiredLabs = await pool.query(
      'SELECT * FROM labs WHERE expires_at < NOW() AND status = $1',
      [STATUS.ACTIVO]
    );
    
    console.log(`Encontrados ${expiredLabs.rows.length} laboratorios expirados`);
    
    for (const lab of expiredLabs.rows) {
      try {
        await portainerClient.delete(
          `/stacks/${lab.stack_id}?endpointId=${process.env.PORTAINER_ENDPOINT_ID}`
        );
        
        await pool.query(
          'UPDATE labs SET status = $1, canceled_at = NOW(), cancel_reason = $2 WHERE id = $3',
          [STATUS.CANCELADO_POR_TIEMPO, 'expirado', lab.id]
        );
        
        await pool.query(
          'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
          [lab.user_id, 'lab_expired', `Laboratorio ${lab.container_name} expirado y eliminado`]
        );
        
        console.log(`✅ Laboratorio ${lab.container_name} eliminado (expirado)`);
      } catch (error) {
        console.error(`❌ Error eliminando lab ${lab.container_name}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('Error en limpieza automática:', error);
  }
}

// Obtener estadísticas
async function getStats() {
  const activeLabs = await pool.query(
    'SELECT COUNT(*) FROM labs WHERE status = $1',
    [STATUS.ACTIVO]
  );
  
  const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
  
  let maxLabs = GLOBAL_MAX_LABS;
  const configResult = await pool.query(
    "SELECT value FROM system_config WHERE key = 'max_labs'"
  );
  if (configResult.rows.length > 0) {
    const parsed = parseInt(configResult.rows[0].value, 10);
    if (!Number.isNaN(parsed)) {
      maxLabs = parsed;
    }
  }
  
  return {
    activeLabs: parseInt(activeLabs.rows[0].count, 10),
    maxLabs,
    totalUsers: parseInt(totalUsers.rows[0].count, 10),
    availableLabs: Math.max(maxLabs - parseInt(activeLabs.rows[0].count, 10), 0)
  };
}

module.exports = {
  createLab,
  getUserLabs,
  getAllLabs,
  deleteLab,
  cleanupExpiredLabs,
  getStats
};
