const pool = require('../config/database');
const portainerClient = require('../config/portainer');

// Función auxiliar: Obtener siguiente puerto disponible
async function getNextAvailablePort(rangeStart, rangeEnd) {
  const result = await pool.query(
    'SELECT ssh_port, app_port FROM labs WHERE status = $1',
    ['deleted']
  );
  
  const usedPorts = new Set();
  result.rows.forEach(row => {
    usedPorts.add(row.ssh_port);
    usedPorts.add(row.app_port);
  });
  
  for (let port = rangeStart; port <= rangeEnd; port++) {
    if (!usedPorts.has(port)) {
      return port;
    }
  }
  
  throw new Error('No hay puertos disponibles');
}

// Función auxiliar: Generar docker-compose.yml
function generateDockerCompose(sshPort, appPort, userEmail, stackName) {  
  const username = userEmail.split('@')[0];
  const password = username + '2024'; // Contraseña simple por ahora
  
  return `version: '3.8'

services:
  dev-environment:
    image: node:20
    container_name: lab-${username}
    working_dir: /home/${username}/proyecto
    ports:
      - "${sshPort}:22"
      - "${appPort}:3000"
      - "${appPort + 1000}:5432"
    volumes:
      - lab_${username}_workspace:/home/${username}/proyecto
    environment:
      - POSTGRES_HOST=localhost
      - POSTGRES_USER=${username}
      - POSTGRES_PASSWORD=${password}
      - POSTGRES_DB=proyecto_db
    command: >
      bash -c "
      apt-get update &&
      apt-get install -y openssh-server postgresql postgresql-contrib sudo nano &&
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
  lab_${username}_workspace:
`;
}

// Crear laboratorio
async function createLab(userId, userEmail) {
  try {
    // 1. Verificar si el usuario ya tiene un lab activo
    const existingLab = await pool.query(
      'SELECT * FROM labs WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );
    
    if (existingLab.rows.length > 0) {
      throw new Error('Ya tienes un laboratorio activo');
    }
    
    // 2. Verificar capacidad disponible
    const configResult = await pool.query(
      "SELECT value FROM system_config WHERE key = 'max_labs'"
    );
    const maxLabs = parseInt(configResult.rows[0].value);
    
    const activeLabsResult = await pool.query(
      'SELECT COUNT(*) FROM labs WHERE status = $1',
      ['active']
    );
    const activeLabs = parseInt(activeLabsResult.rows[0].count);
    
    if (activeLabs >= maxLabs) {
      throw new Error('No hay laboratorios disponibles en este momento');
    }
    
    // 3. Obtener puertos disponibles
    const sshPortRange = await pool.query(
      "SELECT value FROM system_config WHERE key IN ('ssh_port_range_start', 'ssh_port_range_end')"
    );
    const sshPortStart = parseInt(sshPortRange.rows[0].value);
    const sshPortEnd = parseInt(sshPortRange.rows[1].value);
    
    const appPortRange = await pool.query(
      "SELECT value FROM system_config WHERE key IN ('app_port_range_start', 'app_port_range_end')"
    );
    const appPortStart = parseInt(appPortRange.rows[0].value);
    const appPortEnd = parseInt(appPortRange.rows[1].value);
    
    const sshPort = await getNextAvailablePort(sshPortStart, sshPortEnd);
    const appPort = await getNextAvailablePort(appPortStart, appPortEnd);
    
    // 4. Crear stack en Portainer
    const username = userEmail.split('@')[0];
    const stackName = `lab-${username}-${Date.now()}`;
    const dockerCompose = generateDockerCompose(sshPort, appPort, userEmail, stackName); 
    
    const portainerResponse = await portainerClient.post(
      `/stacks/create/standalone/string?endpointId=${process.env.PORTAINER_ENDPOINT_ID}`,
      {
        name: stackName,
        stackFileContent: dockerCompose
      }
    );
    
    // 5. Calcular tiempo de expiración
    const durationResult = await pool.query(
      "SELECT value FROM system_config WHERE key = 'lab_duration_hours'"
    );
    const durationHours = parseInt(durationResult.rows[0].value);
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    
    // 6. Guardar en base de datos
    const password = username + '2024';
    const insertResult = await pool.query(
      `INSERT INTO labs (user_id, container_name, ssh_port, app_port, stack_id, password, expires_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, stackName, sshPort, appPort, portainerResponse.data.Id, password, expiresAt, 'active']
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
        host: '158.69.215.225',
        port: sshPort,
        username: username,
        password: password,
        command: `ssh -p ${sshPort} ${username}@158.69.215.225`
      },
      app: {
        url: `http://158.69.215.225:${appPort}`,
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
      createdAt: insertResult.rows[0].created_at
    };
    
  } catch (error) {
    console.error('Error creando laboratorio:', error);
    throw error;
  }
}

// Obtener laboratorios del usuario (excluye eliminados)
async function getUserLabs(userId) {
  const result = await pool.query(
    'SELECT * FROM labs WHERE user_id = $1 AND status != $2 ORDER BY created_at DESC',
    [userId, 'deleted']
  );
  return result.rows;
}

// Obtener todos los laboratorios para admins
async function getAllLabs() {
  const result = await pool.query(
    'SELECT * FROM labs WHERE status != $1 ORDER BY created_at DESC',
    ['deleted']
  );
  return result.rows;
}

// Eliminar laboratorio (soft delete)
async function deleteLab(labId, userId, isAdmin = false) {
  try {
    let query = 'SELECT * FROM labs WHERE id = $1 AND status != $2';
    let params = [labId, 'deleted'];

    if (!isAdmin) {
      query += ' AND user_id = $3';
      params.push(userId);
    }

    const labResult = await pool.query(query, params);

    if (labResult.rows.length === 0) {
      throw new Error('Laboratorio no encontrado o no autorizado para eliminar.');
    }

    // Soft delete - marcar como eliminado
    await pool.query(
      'UPDATE labs SET status = $1 WHERE id = $2',
      ['deleted', labId]
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
      ['active']
    );
    
    console.log(`Encontrados ${expiredLabs.rows.length} laboratorios expirados`);
    
    for (const lab of expiredLabs.rows) {
      try {
        await portainerClient.delete(
          `/stacks/${lab.stack_id}?endpointId=${process.env.PORTAINER_ENDPOINT_ID}`
        );
        
        await pool.query(
          'UPDATE labs SET status = $1 WHERE id = $2',
          ['deleted', lab.id]
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
    ['active']
  );
  
  const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
  
  const configResult = await pool.query(
    "SELECT value FROM system_config WHERE key = 'max_labs'"
  );
  
  return {
    activeLabs: parseInt(activeLabs.rows[0].count),
    maxLabs: parseInt(configResult.rows[0].value),
    totalUsers: parseInt(totalUsers.rows[0].count),
    availableLabs: parseInt(configResult.rows[0].value) - parseInt(activeLabs.rows[0].count)
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
