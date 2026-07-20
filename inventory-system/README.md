# 🏭 Inventory Management System

Sistema completo de gestión de inventario con panel de administración, reportes y control de movimientos.

## 🚀 Stack Tecnológico

| Capa       | Tecnologías                                      |
|------------|--------------------------------------------------|
| Frontend   | React + Vite + TypeScript + TailwindCSS + Chart.js |
| Backend    | Express + TypeScript + Prisma + Zod              |
| Base Datos | PostgreSQL                                        |
| DevOps     | Docker Compose                                   |

## 📋 Requisitos

- Node.js 18+
- Docker y Docker Compose
- npm o bun

## 🔧 Instalación y Ejecución

### Con Docker (recomendado)

```bash
# Clonar el repositorio
git clone <repo-url>
cd inventory-system

# Copiar variables de entorno
cp .env.example .env

# Iniciar servicios
docker compose -f docker/docker-compose.yml up -d --build

# Ejecutar migraciones y seed
docker exec backend npm run prisma:migrate
docker exec backend npm run prisma:seed
```

### Desarrollo local

```bash
# Backend
cd backend
npm install
cp ../.env.example .env
npx prisma migrate dev
npx prisma db seed
npm run dev

# Frontend
cd frontend
npm install
cp ../.env.example .env
npm run dev
```

## 🌐 Acceso

| Servicio  | URL                         |
|-----------|-----------------------------|
| Frontend  | http://localhost:5173        |
| Backend   | http://localhost:3000        |
| API Docs  | http://localhost:3000/api-docs |

## 👥 Roles

- **admin**: Acceso completo a todas las funcionalidades
- **user**: Gestión básica de inventario (ver productos, registrar movimientos)

## 📊 Funcionalidades

- ✅ Dashboard con gráficos de barras y líneas
- ✅ CRUD de productos con búsqueda y filtros
- ✅ Gestión de categorías
- ✅ Registro de entradas y salidas de inventario
- ✅ Autenticación JWT con roles
- ✅ Reportes exportables a PDF y Excel
- ✅ Modo oscuro/claro
- ✅ Diseño responsive
- ✅ API documentada con Swagger

## 📁 Estructura del Proyecto

```
inventory-system/
├── backend/
│   ├── prisma/          # Schema y migraciones
│   ├── src/
│   │   ├── auth/        # Autenticación JWT
│   │   ├── products/    # CRUD productos
│   │   ├── categories/  # CRUD categorías
│   │   ├── movements/   # Movimientos de inventario
│   │   ├── reports/     # Reportes PDF/Excel
│   │   ├── middleware/   # Middlewares
│   │   └── shared/      # Utilidades compartidas
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/       # Páginas de la app
│   │   ├── components/  # Componentes reutilizables
│   │   ├── services/    # Servicios API
│   │   ├── context/     # Contextos React
│   │   └── hooks/       # Hooks personalizados
│   └── Dockerfile
├── docker/
│   └── docker-compose.yml
├── scripts/             # Scripts de build/deploy
└── docs/                # Documentación adicional
```
