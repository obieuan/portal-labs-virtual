// Verificar autenticacion al cargar
async function checkAuth() {
    try {
        const response = await fetch('/auth/me', {
            credentials: 'include',
            cache: 'no-cache'
        });
        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.href = '/login.html';
            return false;
        }
        
        window.currentUser = data.user;
        
        const userEmailElement = document.getElementById('userEmail');
        if (userEmailElement) {
            userEmailElement.textContent = data.user.email;
        }
        
        if (data.user.isAdmin) {
            showAdminButton();
        }
        
        return true;
    } catch (error) {
        console.error('Error verificando autenticacion:', error);
        window.location.href = '/login.html';
        return false;
    }
}

function showAdminButton() {
    const adminBtn = document.getElementById('adminPanelBtn');
    if (adminBtn) {
        adminBtn.classList.remove('hidden');
    }
}

function goToAdminPanel() {
    window.location.href = '/admin.html';
}

checkAuth().then(authenticated => {
    if (authenticated) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initApp);
        } else {
            initApp();
        }
    }
});

const API_URL = '/api';
const PUBLIC_HOST = window.location.hostname || '158.69.215.225';
const SSH_HOST = PUBLIC_HOST;
const MAX_LABS_ALUMNO = 2;
let allowedImages = [];

function initApp() {
    const isAdmin = window.currentUser?.isAdmin;
    loadImages();
    if (isAdmin) {
        loadStats();
        loadMyLabs();
        setInterval(loadStats, 30000);
        setInterval(loadMyLabs, 30000);
    } else {
        hideElementById('card-users');
        loadMyLabs();
        setInterval(loadMyLabs, 30000);
    }
}

function hideElementById(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('hidden');
    }
}

// Cargar lista de imagenes permitidas
async function loadImages() {
    try {
        const response = await fetch(`${API_URL}/labs/images`, {
            credentials: 'include'
        });
        const data = await response.json();
        allowedImages = data.images || [];
        renderImageOptions();
    } catch (error) {
        console.error('Error cargando imagenes disponibles:', error);
    }
}

function renderImageOptions() {
    renderImageCards();
}

function setCreateButtonsEnabled(enabled, disabledMessage = null) {
  const buttons = document.querySelectorAll('.create-lab-btn');
  buttons.forEach(btn => {
    if (btn.dataset.locked === 'true') {
      return;
    }
    if (!btn.dataset.label) {
      btn.dataset.label = btn.innerHTML;
    }
    btn.disabled = !enabled;
    btn.classList.toggle('opacity-50', !enabled);
        btn.classList.toggle('cursor-not-allowed', !enabled);
        if (!enabled && disabledMessage) {
            btn.innerHTML = `<i class="fas fa-ban"></i> ${disabledMessage}`;
        } else {
            btn.innerHTML = btn.dataset.label;
        }
  });
}

function renderImageCards() {
  const container = document.getElementById('imageCards');
  const empty = document.getElementById('imageCardsEmpty');
  if (!container) return;

  const DISTROS = [
    {
      key: 'ubuntu',
      title: 'Ubuntu',
      description: 'Entorno limpio tipo mini-servidor para prácticas de programación y despliegue de servicios. Incluye 5 puertos libres para tus aplicaciones.',
      logo: './assets/ubuntu.png',
      logoColor: '#E95420'
    },
    {
      key: 'debian',
      title: 'Debian',
      description: 'Entorno limpio tipo mini-servidor para prácticas de programación y despliegue de servicios. Incluye 5 puertos libres para tus aplicaciones.',
      logo: './assets/debian.png',
      logoColor: '#A80030'
    }
  ];

  const versionMap = (allowedImages || []).reduce((acc, img) => {
    const [name, version = ''] = img.split(':');
    if (!name) return acc;
    acc[name] = acc[name] || [];
    if (version) acc[name].push(version);
    return acc;
  }, {});

  const sortVersionsDesc = (arr) => [...arr].sort((a, b) => {
    const ap = a.split('.').map(n => parseInt(n, 10) || 0);
    const bp = b.split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(ap.length, ap.length);
    for (let i = 0; i < len; i++) {
      const av = ap[i] ?? 0;
      const bv = bp[i] ?? 0;
      if (av !== bv) return bv - av;
    }
    return b.localeCompare(a);
  });

  const cards = DISTROS.map(distro => {
    const versions = sortVersionsDesc(versionMap[distro.key] || []);
    const hasVersions = versions.length > 0;
    const selectId = `version-select-${distro.key}`;
    const options = hasVersions
      ? versions.map(v => `<option value="${v}">Version ${v}</option>`).join('')
      : '<option value="">Sin versiones configuradas</option>';
    const buttonLocked = hasVersions ? '' : 'data-locked="true"';
    const buttonDisabled = hasVersions ? '' : 'disabled';

    return `
      <div class="image-card">
        <!-- Header con logo, título y descripción -->
        <div class="image-card-header">
          <div class="image-card-logo" style="background-color: ${distro.logoColor}20;">
            <img src="${distro.logo}" alt="${distro.title} logo" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=&quot;fas fa-box text-4xl&quot; style=&quot;color: ${distro.logoColor}&quot;></i>';">
          </div>
          <div class="image-card-info">
            <h3 class="image-card-title">${distro.title}</h3>
            <p class="image-card-description">${distro.description}</p>
          </div>
        </div>
        
        <!-- Divider -->
        <div class="image-card-divider"></div>
        
        <!-- Sección de versión -->
        <div class="image-card-version-section">
          <label class="version-label">Elige versión:</label>
          <select id="${selectId}" class="version-select" ${hasVersions ? '' : 'disabled'}>
            ${options}
          </select>
        </div>
        
        <!-- Botón de desplegar -->
        <div class="image-card-button-wrapper">
          <button
            class="deploy-button create-lab-btn"
            onclick="createLabFromCard('${selectId}', '${distro.key}')"
            data-label='<i class="fas fa-plus"></i> Desplegar Laboratorio'
            ${buttonLocked} ${buttonDisabled}>
            <i class="fas fa-plus"></i> Desplegar Laboratorio
          </button>
        </div>
      </div>
    `;
  });

  if (!cards.length) {
    container.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }

  container.innerHTML = cards.join('');
  if (empty) empty.classList.add('hidden');
}

function createLabFromCard(selectId, name) {
  const select = document.getElementById(selectId);
  if (!select) {
    alert('No se encontró el selector de versión');
    return;
  }
  const version = select.value;
  if (!version) {
    alert('Elige una versión antes de crear el laboratorio.');
    return;
  }
  createLab(`${name}:${version}`);
}

// Cargar estadisticas
async function loadStats() {
    if (!window.currentUser?.isAdmin) {
        return;
    }
    try {
        const response = await fetch(`${API_URL}/labs/stats`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        document.getElementById('activeLabs').textContent = data.activeLabs;
        document.getElementById('maxLabs').textContent = data.maxLabs;
        document.getElementById('availableLabs').textContent = data.availableLabs;
        document.getElementById('totalUsers').textContent = data.totalUsers;
        
        setCreateButtonsEnabled(data.availableLabs > 0, data.availableLabs === 0 ? 'No hay laboratorios disponibles' : null);
    } catch (error) {
        console.error('Error cargando estadisticas:', error);
    }
}

// Cargar laboratorios del usuario
async function loadMyLabs() {
    try {
        const response = await fetch(`${API_URL}/labs/my-labs`, {
            credentials: 'include'
        });
        const labs = await response.json();
        
        const labsList = document.getElementById('labsList');
        const noLabs = document.getElementById('noLabs');
        
        if (labs.length === 0) {
            labsList.innerHTML = '';
            noLabs.classList.remove('hidden');
        } else {
            noLabs.classList.add('hidden');
            labsList.innerHTML = labs.map(lab => renderLab(lab)).join('');
        }

        if (!window.currentUser?.isAdmin) {
            updateUserCounters(labs.length);
        }
    } catch (error) {
        console.error('Error cargando laboratorios:', error);
    }
}

function updateUserCounters(myLabsCount) {
    const maxUserLabs = MAX_LABS_ALUMNO;
    const remaining = Math.max(maxUserLabs - myLabsCount, 0);

    const activeEl = document.getElementById('activeLabs');
    const maxEl = document.getElementById('maxLabs');
    const availableEl = document.getElementById('availableLabs');

    if (activeEl) activeEl.textContent = myLabsCount;
    if (maxEl) maxEl.textContent = maxUserLabs;
    if (availableEl) availableEl.textContent = remaining;
}

// Renderizar un laboratorio
function renderLab(lab) {
    const expiresAt = new Date(lab.expires_at);
    const now = new Date();
    const timeLeft = Math.max(0, Math.floor((expiresAt - now) / 1000 / 60));
    const hours = Math.floor(timeLeft / 60);
    const minutes = timeLeft % 60;
    
    const isExpired = timeLeft === 0;
    const timeColor = timeLeft < 30 ? 'text-red-500' : 'text-green-500';
    const username = lab.ssh_username || (lab.password ? lab.password.replace('2024', '') : '');
    const sshHost = SSH_HOST;
    const sshCommand = username ? `ssh -p ${lab.ssh_port} ${username}@${sshHost}` : 'SSH no disponible';
    const appUrl = `http://${PUBLIC_HOST}:${lab.app_port}`;
    const exposedPorts = Array.isArray(lab.exposed_ports) ? lab.exposed_ports : [];
    const portsChips = exposedPorts.map(p => `<span class="px-2 py-1 bg-gray-900 rounded text-xs border border-gray-700">${p}</span>`).join(' ');
    
    // Detectar distribución del nombre de la imagen
    const imageName = (lab.image || '').toLowerCase();
    let distroLogo = './assets/default.png';
    let distroColor = '#6B7280';
    
    if (imageName.includes('ubuntu')) {
        distroLogo = './assets/ubuntu.png';
        distroColor = '#E95420';
    } else if (imageName.includes('debian')) {
        distroLogo = './assets/debian.png';
        distroColor = '#A80030';
    }
    
    return `
        <div class="bg-gray-700 rounded-lg p-6 border border-gray-600">
            <div class="flex gap-4 mb-4">
                <!-- Logo de la distribución -->
                <div class="flex-shrink-0">
                    <div class="w-16 h-16 rounded-lg flex items-center justify-center" style="background-color: ${distroColor}20;">
                        <img src="${distroLogo}" alt="Logo" class="w-12 h-12 object-contain" 
                             onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=&quot;fas fa-server text-2xl&quot; style=&quot;color: ${distroColor}&quot;></i>';">
                    </div>
                </div>
                
                <!-- Información del lab -->
                <div class="flex-1 flex justify-between items-start">
                    <div>
                        <h3 class="text-xl font-bold text-blue-400">${lab.container_name}</h3>
                        <p class="text-gray-400 text-sm">Creado: ${new Date(lab.created_at).toLocaleString('es-MX')}</p>
                        <p class="text-gray-400 text-sm">Imagen: ${lab.image || 'N/D'}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm text-gray-400">Tiempo restante</p>
                        <p class="${timeColor} font-bold text-lg">
                            ${isExpired ? 'EXPIRADO' : `${hours}h ${minutes}m`}
                        </p>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div class="bg-gray-800 rounded p-4">
                    <h4 class="text-sm font-semibold text-gray-300 mb-2">
                        <i class="fas fa-terminal text-green-500"></i> Acceso SSH
                    </h4>
                    <code class="text-xs bg-gray-900 p-2 rounded block mb-2">
                        ${sshCommand}
                    </code>
                    <p class="text-xs text-gray-400">
                        <strong>Usuario:</strong> ${username || 'No disponible'}<br>
                        <strong>Contrasena:</strong> ${lab.password || 'No disponible'}
                    </p>
                </div>
                
                <div class="bg-gray-800 rounded p-4">
                    <h4 class="text-sm font-semibold text-gray-300 mb-2">
                        <i class="fas fa-globe text-blue-500"></i> Acceso HTTP/puertos
                    </h4>
                    <a href="${appUrl}" target="_blank" 
                       class="text-blue-400 hover:text-blue-300 text-sm break-all">
                        ${appUrl}
                    </a>
                    <p class="text-xs text-gray-400 mt-2">
                        <strong>Puerto principal:</strong> ${lab.app_port}
                    </p>
                    <div class="text-xs text-gray-400 mt-2">
                        <strong>Puertos expuestos:</strong>
                        <div class="flex flex-wrap gap-2 mt-1">
                            ${portsChips || '<span class="text-gray-500">N/D</span>'}
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="flex gap-2">
                <button 
                    onclick="copySSH('${lab.ssh_port}', '${username}')"
                    class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition duration-200">
                    <i class="fas fa-copy"></i> Copiar comando SSH
                </button>
                <button 
                    onclick="deleteLab(${lab.id})"
                    class="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded transition duration-200">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
    `;
}

// Crear laboratorio
async function createLab(image) {
    const loadingModal = document.getElementById('loadingModal');
    loadingModal.classList.remove('hidden');
    
    try {
        const response = await fetch(`${API_URL}/labs/create`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Laboratorio creado exitosamente!');
            loadStats();
            loadMyLabs();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Error creando laboratorio: ' + error.message);
    } finally {
        loadingModal.classList.add('hidden');
    }
}

// Eliminar laboratorio
async function deleteLab(labId) {
    if (!confirm('Estas seguro de eliminar este laboratorio? Esta accion no se puede deshacer.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/labs/${labId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Laboratorio eliminado correctamente');
            window.location.reload();  
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Error eliminando laboratorio: ' + error.message);
    }
}

// Copiar comando SSH
function copySSH(port, username, host = SSH_HOST) {
    const safeUsername = username || 'usuario';
    const command = `ssh -p ${port} ${safeUsername}@${host}`;
    navigator.clipboard.writeText(command);
    alert('Comando SSH copiado al portapapeles!');
}

// Logout
function logout() {
    if (confirm('Estas seguro de cerrar sesion?')) {
        window.location.href = '/auth/logout';
    }
}