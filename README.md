# Portal de Laboratorios Virtuales (MVP)

Sistema de laboratorios virtuales con autenticación Microsoft 365 y provisión vía Portainer. Roles: Alumno (2 labs máx) y Admin (sin límite, con panel).

## Funcionalidades (MVP)
- Auth Azure AD (login, logout con limpieza de sesión y `prompt=select_account`).
- Labs: 2 por alumno, 20 globales, TTL 24h, estados: ACTIVO / CANCELADO_POR_USUARIO / CANCELADO_POR_TIEMPO.
- Asignación de puertos en rango configurable (SSH/App/DB), nombres únicos de contenedores/volúmenes por stack.
- Limpieza de labs expirados, eliminación marca status y limpia en Portainer (best-effort).
- Panel Admin: ver/filtrar/paginar labs, extender/ eliminar, ver usuarios, buscar y togglear rol admin (protege admin original vía `SUPER_ADMIN_EMAIL` o id=1).
- Front alumno: solo ve sus contadores (activos/máximo/disponibles); no ve stats globales ni usuarios.

## Stack
- Backend: Node.js + Express.
- Frontend: HTML + Tailwind CDN.
- DB: PostgreSQL 15.
- Orquestación: Docker + Portainer CE.
- Proxy: Nginx.
- Auth: Azure AD OAuth2.

## Requisitos
- Docker y Docker Compose.
- Portainer CE accesible (con API key y endpoint ID).
- Azure AD app (Client ID, Tenant ID, Client Secret).

## Setup rápido (local)
1) Clona:
```bash
git clone https://github.com/obieuan/portal-labs-virtual.git
cd portal-labs-virtual
```
2) Env en la raíz:
```bash
cp backend/.env.example .env
# Edita .env con DB_*, PORTAINER_URL/TOKEN/ENDPOINT_ID, LAB_IMAGE, PUBLIC_HOST, CORS_ORIGINS, AZURE_*, SESSION_SECRET, SUPER_ADMIN_EMAIL (opcional).
```
3) Imagen base labs (una vez):
```bash
docker build -t lab-base:latest -f lab-base/Dockerfile lab-base
```
4) Migración MVP (si usas el postgres del compose):
```bash
docker cp migrations/20251214_lab_mvp.sql portal-db:/tmp/
docker exec -i portal-db psql -U portal_admin -d portal_labs -f /tmp/20251214_lab_mvp.sql
```
5) Levanta:
```bash
docker compose build --no-cache backend
docker compose up -d
```
6) Acceso:
- Front local: `http://localhost:8081`
- Health backend: `http://localhost:4000/api/health`

## Azure AD
- Redirect local: `http://localhost:8081/auth/callback` (prod: `https://tu-dominio/auth/callback`).
- Permisos: `User.Read`, `email`, `profile`, `openid`.
- `prompt=select_account` ya está incluido.

## Portainer
- Cliente usa solo header `X-API-Key`.
- Si Portainer está en el mismo compose, usa `PORTAINER_URL=http://portainer:9000` y conéctalo a la red del proyecto.
- Si usas host Linux, puedes usar `host.docker.internal` con `extra_hosts: ["host.docker.internal:host-gateway"]` en backend.

## Estructura
```
backend/        # config, controllers, routes (auth, labs, admin)
frontend/       # index/login/admin + JS (app.js, admin.js)
lab-base/       # Dockerfile imagen base (node:20 + sshd + postgres + sudo)
migrations/     # SQL de esquema/MVP
docker-compose.yml
nginx.conf
README.md
```

## Notas de operación
- Contenedores/volúmenes se nombran por stack `lab-<user>-<timestamp>` para evitar colisiones.
- El rol en sesión se refresca en cada `/auth/me` y en `requireAdmin` para evitar admins stale.
- Imágenes “unused” quedan en cache (ej. `lab-base`); limpia con `docker image prune` si necesitas espacio, pero mantener `lab-base` acelera despliegues.

## Licencia
MIT License
