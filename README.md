# 🧪 Portal de Laboratorios Virtuales

Sistema de gestión de laboratorios virtuales con autenticación Microsoft 365 para Universidad Modelo.

## 🚀 Características

- ✅ Autenticación Microsoft 365 (Azure AD)
- ✅ Contenedores con SSH + Node.js + PostgreSQL
- ✅ Panel de administración
- ✅ Gestión de roles (Admin/Alumno)
- ✅ Límites de tiempo automáticos
- ✅ Métricas en tiempo real

## 📋 Stack Tecnológico

- **Backend**: Node.js + Express
- **Frontend**: HTML + TailwindCSS
- **Base de datos**: PostgreSQL
- **Contenedores**: Docker + Portainer
- **Proxy**: Nginx
- **Auth**: Azure AD OAuth 2.0

## ⚙️ Instalación

### Requisitos previos
- Docker & Docker Compose
- Node.js 20+
- PostgreSQL 13+
- Portainer
- Nginx
- Cuenta Azure AD

### Setup

1. Clonar repo:
```bash
git clone https://github.com/obieuan/portal-labs-virtual.git
cd portal-labs-virtual
```

2. Configurar variables de entorno:
```bash
cp backend/.env.example backend/.env
# Editar backend/.env con tus credenciales
```

3. Iniciar base de datos:
```bash
docker compose up -d portal-db
```

4. Ejecutar migraciones:
```bash
docker exec -it portal-db psql -U portal_admin -d portal_labs -f /docker-entrypoint-initdb.d/init.sql
```

5. Iniciar servicios:
```bash
docker compose up -d
```

6. Acceder:
```
https://tu-dominio.com
```

## 🔐 Configuración Azure AD

1. Registrar aplicación en [Azure Portal](https://portal.azure.com)
2. Obtener: Client ID, Tenant ID, Client Secret
3. Configurar Redirect URI: `https://tu-dominio.com/auth/callback`
4. Agregar permisos: User.Read, email, profile, openid
5. Actualizar `backend/.env`

## 📁 Estructura del proyecto
```
portal-labs/
├── backend/
│   ├── config/         # Configuraciones
│   ├── controllers/    # Lógica de negocio
│   ├── routes/         # Rutas API
│   └── server.js       # Punto de entrada
├── frontend/
│   ├── index.html
│   ├── login.html
│   └── app.js
├── docker-compose.yml
└── README.md
```

## 📝 Licencia

MIT License

## 👨‍💻 Autor

Gabriel Euan - Universidad Modelo
