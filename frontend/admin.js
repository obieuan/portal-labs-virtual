// Verificar que sea admin
async function checkAdmin() {
    try {
        const response = await fetch('/auth/me', {
            credentials: 'include',
            cache: 'no-cache'
        });
        const data = await response.json();
        
        if (!data.authenticated || !data.user.isAdmin) {
            alert('Acceso denegado. Solo administradores.');
            window.location.href = '/';
            return false;
        }
        
        window.currentUser = data.user;
        document.getElementById('userEmail').textContent = data.user.email;
        return true;
    } catch (error) {
        window.location.href = '/';
        return false;
    }
}

// Cargar datos al iniciar
checkAdmin().then(isAdmin => {
    if (isAdmin) {
        loadAllLabs();
        loadUserStats();
    }
});

// Gestión de tabs
function showTab(tabName) {
    // Ocultar todos
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));
    
    // Mostrar seleccionado
    document.getElementById(`content-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

// Cargar todos los labs
async function loadAllLabs() {
    try {
        const response = await fetch('/api/admin/all-labs', {
            credentials: 'include'
        });
        const labs = await response.json();
        
        const list = document.getElementById('allLabsList');
        const noLabs = document.getElementById('noAllLabs');
        
        if (labs.length === 0) {
            list.innerHTML = '';
            noLabs.classList.remove('hidden');
        } else {
            noLabs.classList.add('hidden');
            list.innerHTML = labs.map(lab => renderAdminLab(lab)).join('');
        }
    } catch (error) {
        console.error('Error cargando labs:', error);
    }
}

// Renderizar lab para admin
function renderAdminLab(lab) {
    const expiresAt = new Date(lab.expires_at);
    const now = new Date();
    const timeLeft = Math.max(0, Math.floor((expiresAt - now) / 1000 / 60));
    const hours = Math.floor(timeLeft / 60);
    const minutes = timeLeft % 60;
    
    const timeColor = timeLeft < 30 ? 'text-red-500' : 'text-green-500';
    
    return `
        <div class="bg-gray-700 rounded-lg p-6 border border-gray-600">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-xl font-bold text-blue-400">${lab.container_name}</h3>
                    <p class="text-gray-400 text-sm">Usuario: ${lab.user_name} (${lab.email})</p>
                    <p class="text-gray-400 text-sm">Creado: ${new Date(lab.created_at).toLocaleString('es-MX')}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm text-gray-400">Tiempo restante</p>
                    <p class="${timeColor} font-bold text-lg">${hours}h ${minutes}m</p>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div><strong>SSH Port:</strong> ${lab.ssh_port}</div>
                <div><strong>App Port:</strong> ${lab.app_port}</div>
            </div>
            
            <div class="flex gap-2">
                <button onclick="extendLab(${lab.id}, 2)" 
                        class="bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded">
                    <i class="fas fa-clock"></i> +2h
                </button>
                <button onclick="extendLab(${lab.id}, 24)" 
                        class="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded">
                    <i class="fas fa-clock"></i> +24h
                </button>
                <button onclick="adminDeleteLab(${lab.id})" 
                        class="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded ml-auto">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
    `;
}

// Cargar estadísticas de usuarios
async function loadUserStats() {
    try {
        const response = await fetch('/api/admin/user-stats', {
            credentials: 'include'
        });
        const users = await response.json();
        
        const table = document.getElementById('usersTable');
        table.innerHTML = users.map(user => `
            <tr class="${user.is_admin ? 'bg-purple-900 bg-opacity-20' : ''}">
                <td class="px-4 py-3">
                    ${user.name}
                    ${user.is_admin ? '<span class="ml-2 text-xs bg-purple-600 px-2 py-1 rounded">ADMIN</span>' : ''}
                </td>
                <td class="px-4 py-3">${user.email}</td>
                <td class="px-4 py-3 text-center">${user.active_labs}</td>
                <td class="px-4 py-3 text-center">${user.total_labs_created}</td>
                <td class="px-4 py-3">${user.last_login ? new Date(user.last_login).toLocaleString('es-MX') : 'Nunca'}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error cargando usuarios:', error);
    }
}

// Extender tiempo de lab
async function extendLab(labId, hours) {
    try {
        const response = await fetch(`/api/admin/lab/${labId}/extend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ hours })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(`Laboratorio extendido ${hours} horas`);
            loadAllLabs();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Error extendiendo laboratorio');
    }
}

// Eliminar lab como admin
async function adminDeleteLab(labId) {
    if (!confirm('¿Eliminar este laboratorio? Esta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/lab/${labId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Laboratorio eliminado');
            loadAllLabs();
            loadUserStats();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Error eliminando laboratorio');
    }
}

// Navegación
function goToMainPanel() {
    window.location.href = '/';
}

function logout() {
    window.location.href = '/auth/logout';
}
