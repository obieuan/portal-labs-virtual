# Portal de Laboratorios Virtuales

Sistema de gestión de laboratorios virtuales con autenticación Microsoft 365.

## Características
- Autenticación Microsoft 365 (Azure AD).
- Contenedores con SSH + Node.js + PostgreSQL.
- Panel de administración y gestión de roles (Admin/Alumno).
- Límites automáticos: 2 labs por alumno, 20 globales, TTL 24h.
- Estadísticas y limpieza de labs expirados.

## Stack
- Backend: Node.js + Express.
- Frontend: HTML + TailwindCDN.
- Base de datos: PostgreSQL 15.
- Contenedores: Docker + Portainer.
- Proxy: Nginx.
- Auth: Azure AD OAuth2.

## Requisitos
- Docker y Docker Compose.
- Azure AD app (Client ID, Tenant ID, Client Secret).
- Portainer CE operativo con endpoint configurado.

## Configuración rápida (local)
1) Clonar:
```bash
git clone https://github.com/obieuan/portal-labs-virtual.git
cd portal-labs-virtual
```

2) Variables de entorno (en la raíz):
```bash
cp backend/.env.example .env
# Edita .env con PORTAINER_URL, PORTAINER_TOKEN, PORTAINER_ENDPOINT_ID,
# PUBLIC_HOST, CORS_ORIGINS, AZURE_* y credenciales de DB.
```

3) Imagen base para labs (una sola vez):
```bash
docker build -t lab-base:latest -f lab-base/Dockerfile lab-base
```

4) Migración MVP:
```bash
docker cp migrations/20251214_lab_mvp.sql portal-db:/tmp/
docker exec -i portal-db psql -U portal_admin -d portal_labs -f /tmp/20251214_lab_mvp.sql
```

5) Levantar servicios:
```bash
docker compose build --no-cache backend
docker compose up -d
```

6) Acceso:
- Frontend: `http://localhost:8081`
- Backend health: `http://localhost:4000/api/health`

## Configuración Azure AD
1) Registrar app en Azure Portal.
2) Redirect URI local: `http://localhost:8081/auth/callback` (ajusta para producción).
3) Permisos: `User.Read`, `email`, `profile`, `openid`.
4) Colocar Client ID, Tenant ID y Client Secret en `.env`.

## Estructura
```
backend/
  config/        # DB, Portainer, etc.
  controllers/   # Lógica de negocio
  routes/        # Rutas API
  migrations/    # SQL de esquema
frontend/
  index.html, login.html, admin.html, app.js, admin.js
lab-base/
  Dockerfile     # Imagen base con sshd + postgres + sudo
docker-compose.yml
nginx.conf
README.md
```

## Notas de operación
- Backend lee el `.env` de la raíz (no el de `backend/`).
- El cliente Portainer usa solo `X-API-Key` (sin Authorization).
- Contenedores/volúmenes se nombran por stack (`lab-<usuario>-<timestamp>`) para permitir múltiples labs.

## Licencia
MIT License
