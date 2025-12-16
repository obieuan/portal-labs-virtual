# Portal de Laboratorios Virtuales (MVP)

Sistema de laboratorios virtuales con autenticacion Microsoft 365 y provision via Portainer. Roles: Alumno (2 labs max) y Admin (sin limite, con panel).

## Funcionalidades (MVP)
- Auth Azure AD (login, logout con limpieza de sesion y `prompt=select_account`).
- Labs: eliges imagen (Ubuntu 20/22/24 y Debian 11/12 si estan en `ALLOWED_LAB_IMAGES`), 5 puertos expuestos (evitando puertos comunes de juegos), 2 por alumno, 20 globales, TTL 24h, estados: ACTIVO / CANCELADO_POR_USUARIO / CANCELADO_POR_TIEMPO. Imagen limpia (sin DB preinstalada).
- Asignacion de puertos en rango configurable (SSH/App/DB), nombres unicos de contenedores/volumenes por stack.
- Limpieza de labs expirados, eliminacion marca status y limpia en Portainer (best-effort).
- Panel Admin: ver/filtrar/paginar labs, extender/ eliminar, ver usuarios, buscar y togglear rol admin (protege admin original via `SUPER_ADMIN_EMAIL` o id=1).
- Front alumno: solo ve sus contadores (activos/maximo/disponibles); selector de imagen por tarjetas (Ubuntu/Debian) con logos opcionales en `frontend/assets`.

## Stack
- Backend: Node.js + Express.
- Frontend: HTML + Tailwind CDN.
- DB: PostgreSQL 15.
- Orquestacion: Docker + Portainer CE.
- Proxy: Nginx.
- Auth: Azure AD OAuth2.

## Requisitos
- Docker y Docker Compose.
- Portainer CE accesible (con API key y endpoint ID).
- Azure AD app (Client ID, Tenant ID, Client Secret).

## Setup rapido (local)
1) Clona:
```bash
git clone https://github.com/obieuan/portal-labs-virtual.git
cd portal-labs-virtual
```
2) Env en la raiz:
```bash
cp backend/.env.example .env
# Edita .env con DB_*, PORTAINER_URL/TOKEN/ENDPOINT_ID, LAB_IMAGE/ALLOWED_LAB_IMAGES, LAB_EXPOSED_PORTS_COUNT, LAB_BLOCKED_PORTS, PUBLIC_HOST, CORS_ORIGINS, AZURE_*, SESSION_SECRET, SUPER_ADMIN_EMAIL (opcional).
```
3) Imagen base labs (una vez):
```bash
docker build -t lab-base:latest -f lab-base/Dockerfile lab-base
```
4) Migracion MVP (si usas el postgres del compose):
```bash
docker cp migrations/20251214_lab_mvp.sql portal-db:/tmp/
docker exec -i portal-db psql -U portal_admin -d portal_labs -f /tmp/20251214_lab_mvp.sql
docker cp migrations/20251215_multi_image_multi_ports.sql portal-db:/tmp/
docker exec -i portal-db psql -U portal_admin -d portal_labs -f /tmp/20251215_multi_image_multi_ports.sql
```
5) Levanta:
```bash
docker compose build --no-cache backend
docker compose up -d
```
6) Acceso:
- Front local: `http://localhost:8081` (sirve `frontend/` con `npx http-server . -p 8081 -P http://localhost:4000` o similar).
- Health backend: `http://localhost:4000/api/health`

## Azure AD
- Redirect local: `http://localhost:8081/auth/callback` (prod: `https://tu-dominio/auth/callback`).
- Permisos: `User.Read`, `email`, `profile`, `openid`.
- `prompt=select_account` ya esta incluido.

## Portainer
- Cliente usa solo header `X-API-Key`.
- Si Portainer esta en el mismo compose, usa `PORTAINER_URL=http://portainer:9000` y conectalo a la red del proyecto.
- Si usas host Linux, puedes usar `host.docker.internal` con `extra_hosts: ["host.docker.internal:host-gateway"]` en backend.

## Estructura
```
backend/        # config, controllers, routes (auth, labs, admin)
frontend/       # index/login/admin + JS (app.js, admin.js)
frontend/assets # logos opcionales (ubuntu.png, debian.png)
lab-base/       # Dockerfile imagen base (node:20 + sshd + postgres + sudo)
migrations/     # SQL de esquema/MVP
docker-compose.yml
nginx.conf
README.md
```

## Notas de operacion
- Contenedores/volumenes se nombran por stack `lab-<user>-<timestamp>` para evitar colisiones.
- El rol en sesion se refresca en cada `/auth/me` y en `requireAdmin` para evitar admins stale.
- Imagenes quedan en cache (ej. `lab-base`); limpia con `docker image prune` si necesitas espacio, pero mantener `lab-base` acelera despliegues.

## Licencia
MIT License
