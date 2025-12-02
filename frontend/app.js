// Verificar autenticación al cargar
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
         // Mostrar email en navbar
         const userEmailElement = document.getElementById('userEmail');
         if (userEmailElement) {
             userEmailElement.textContent = data.user.email;
         }
         
         // Mostrar/ocultar botón de admin
         if (data.user.isAdmin) {
             showAdminButton();
         }
        return true;
    } catch (error) {
        console.error('Error verificando autenticación:', error);
        window.location.href = '/login.html';
        return false;
    }
}

// Mostrar botón de panel admin
function showAdminButton() {
    const adminBtn = document.getElementById('adminPanelBtn');
    if (adminBtn) {
        adminBtn.classList.remove('hidden');
    }
}

// Verificar autenticación antes de cargar la página
checkAuth().then(authenticated => {
    if (authenticated) {
        document.addEventListener('DOMContentLoaded', () => {
            loadStats();
            loadMyLabs();
            setInterval(loadStats, 30000);
            setInterval(loadMyLabs, 30000);
        });
    }
});

// Ir al panel admin
function goToAdminPanel() {
    window.location.href = '/admin.html';
}

const API_URL = '/api';

// Cargar estadísticas
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/labs/stats`);
        const data = await response.json();
        
        document.getElementById('activeLabs').textContent = data.activeLabs;
        document.getElementById('maxLabs').textContent = data.maxLabs;
        document.getElementById('availableLabs').textContent = data.availableLabs;
        document.getElementById('totalUsers').textContent = data.totalUsers;
        
        const createBtn = document.getElementById('createBtn');
        if (data.availableLabs === 0) {
            createBtn.disabled = true;
            createBtn.classList.add('opacity-50', 'cursor-not-allowed');
            createBtn.innerHTML = '<i class="fas fa-ban"></i> No hay laboratorios disponibles';
        } else {
            createBtn.disabled = false;
            createBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            createBtn.innerHTML = '<i class="fas fa-plus"></i> Crear Nuevo Laboratorio';
        }
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

// Cargar laboratorios del usuario
async function loadMyLabs() {
    try {
        const response = await fetch(`${API_URL}/labs/my-labs`);
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
    } catch (error) {
        console.error('Error cargando laboratorios:', error);
    }
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
    
    return `
        <div class="bg-gray-700 rounded-lg p-6 border border-gray-600">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-xl font-bold text-blue-400">${lab.container_name}</h3>
                    <p class="text-gray-400 text-sm">Creado: ${new Date(lab.created_at).toLocaleString('es-MX')}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm text-gray-400">Tiempo restante</p>
                    <p class="${timeColor} font-bold text-lg">
                        ${isExpired ? 'EXPIRADO' : `${hours}h ${minutes}m`}
                    </p>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div class="bg-gray-800 rounded p-4">
                    <h4 class="text-sm font-semibold text-gray-300 mb-2">
                        <i class="fas fa-terminal text-green-500"></i> Acceso SSH
                    </h4>
                    <code class="text-xs bg-gray-900 p-2 rounded block mb-2">
                        ssh -p ${lab.ssh_port} ${lab.password.replace('2024', '')}@158.69.215.225
                    </code>
                    <p class="text-xs text-gray-400">
                        <strong>Usuario:</strong> ${lab.password.replace('2024', '')}<br>
                        <strong>Contraseña:</strong> ${lab.password}
                    </p>
                </div>
                
                <div class="bg-gray-800 rounded p-4">
                    <h4 class="text-sm font-semibold text-gray-300 mb-2">
                        <i class="fas fa-globe text-blue-500"></i> Aplicación Web
                    </h4>
                    <a href="http://158.69.215.225:${lab.app_port}" target="_blank" 
                       class="text-blue-400 hover:text-blue-300 text-sm break-all">
                        http://158.69.215.225:${lab.app_port}
                    </a>
                    <p class="text-xs text-gray-400 mt-2">
                        <strong>Puerto:</strong> ${lab.app_port}
                    </p>
                </div>
            </div>
            
            <div class="bg-gray-800 rounded p-4 mb-4">
                <h4 class="text-sm font-semibold text-gray-300 mb-2">
                    <i class="fas fa-database text-purple-500"></i> Base de Datos PostgreSQL
                </h4>
                <div class="grid grid-cols-2 gap-2 text-xs text-gray-400">
                    <div><strong>Host:</strong> localhost</div>
                    <div><strong>Puerto:</strong> 5432</div>
                    <div><strong>Usuario:</strong> ${lab.password.replace('2024', '')}</div>
                    <div><strong>Contraseña:</strong> ${lab.password}</div>
                    <div class="col-span-2"><strong>Base de datos:</strong> proyecto_db</div>
                </div>
            </div>
            
            <div class="flex gap-2">
                <button 
                    onclick="copySSH('${lab.ssh_port}', '${lab.password.replace('2024', '')}')"
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
async function createLab() {
    const loadingModal = document.getElementById('loadingModal');
    loadingModal.classList.remove('hidden');
    
    try {
        const response = await fetch(`${API_URL}/labs/create`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('¡Laboratorio creado exitosamente!');
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
    if (!confirm('¿Estás seguro de eliminar este laboratorio? Esta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/labs/${labId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Laboratorio eliminado correctamente');
            loadStats();
            loadMyLabs();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Error eliminando laboratorio: ' + error.message);
    }
}

// Copiar comando SSH
function copySSH(port, username) {
    const command = `ssh -p ${port} ${username}@158.69.215.225`;
    navigator.clipboard.writeText(command);
    alert('Comando SSH copiado al portapapeles!');
}

// Logout
function logout() {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
        window.location.href = '/auth/logout';
    }
}
