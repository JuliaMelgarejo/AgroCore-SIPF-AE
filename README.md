# AgroCore-SIPF-AE

Sistema Inteligente de Planificación y Predicción para la Agricultura y la Empresa, desarrollado por AgroCore.

## Descripción

SIPF-AE es una plataforma tecnológica orientada al sector agropecuario que permite a productores y asesores agrícolas analizar información productiva, simular escenarios agronómicos y económicos, y obtener recomendaciones basadas en datos para la toma de decisiones.

A partir de la información de las explotaciones agrícolas y campañas productivas cargada por cada usuario, combinada con fuentes externas de datos climáticos y agronómicos, el motor de simulación de SIPF-AE genera proyecciones y recomendaciones que funcionan como una herramienta de apoyo a la decisión, sin reemplazar el criterio profesional de productores, asesores o especialistas del sector.

El sistema acompaña al productor a lo largo de las distintas etapas de una campaña (siembra, manejo y cosecha), ayudando a anticipar escenarios y reducir la incertidumbre productivo-económica propia de la actividad agropecuaria.

## Características principales

- Simulación de escenarios productivo-económicos a partir de datos de campañas, cultivos y condiciones agroclimáticas.
- Generación de recomendaciones a partir de los resultados de las simulaciones.
- Integración con fuentes externas de datos climáticos y agronómicos.
- Gestión de usuarios y de la información de sus explotaciones agrícolas.
- API que expone las funcionalidades del sistema a la aplicación web y a futuras integraciones.

## Stack tecnológico

Backend: Next.js con TypeScript.

Frontend: React con TypeScript, estilos con Tailwind CSS.

Autenticación: Better Auth.

Base de datos y base de conocimiento: PostgreSQL, con Drizzle como ORM.

Infraestructura de datos: Docker, para el almacenamiento de la base de datos y la base de conocimiento.

Testing: a definir.

Control de errores: a definir.

## Requisitos previos

- Node.js (versión LTS)
- Docker y Docker Compose
- Un gestor de paquetes (npm, pnpm o yarn)

## Instalación

1. Clonar el repositorio.
2. Instalar las dependencias con `npm install`.
3. Bajar los datos de las fuentes externas (no se versionan): `pnpm fuentes:descargar` (obligatorio) y, opcionalmente, `pnpm fuentes:clima`, `pnpm fuentes:suelo` y `pnpm fuentes:precios`. Después levantar la base con `docker compose up -d`: los scripts de carga necesitan esos archivos en `data/raw/`.
4. Copiar `.env.example` a `.env` y completar las variables de entorno (conexión a la base de datos, claves de Better Auth, credenciales de las APIs externas de datos climáticos y agronómicos, entre otras).
5. Aplicar las migraciones de Drizzle con `npm run db:migrate`.
6. Levantar el entorno de desarrollo con `npm run dev`.

La aplicación queda disponible por defecto en `http://localhost:3000`.

## Scripts disponibles

- `npm run dev`: levanta el entorno de desarrollo.
- `npm run build`: genera el build de producción.
- `npm run start`: ejecuta la aplicación en modo producción.
- `npm run db:generate`: genera las migraciones de Drizzle a partir del esquema.
- `npm run db:migrate`: aplica las migraciones pendientes a la base de datos.
- `npm run lint`: corre el linter sobre el proyecto.

## Base de datos

PostgreSQL 18 en Docker (`docker-compose.yml`). Al crearse el volumen por primera vez corren los scripts de `docker/postgres/init/`:

- `01_schema.sql`: esquema completo (semillas, suelo, clima/ENSO, economía, lotes y campañas, predicciones) y la vista `v_dataset_entrenamiento`, que junta todas las variables de entrada por lote y campaña.
- `02_catalogos.sql`: fuentes de datos, provincias, texturas de suelo, campañas 1969/70–2030/31 e insumos comunes.
- `03_carga_inicial.sql`: carga los cultivares INASE (`data/raw/inase-cultivares.csv`) y los avisos de alquiler (`data/processed/campos-alquiler.json`).
- `04_carga_magyp_noaa.sql`: carga las estimaciones agrícolas de MAGyP por departamento desde 1969/70 (`data/raw/magyp-estimaciones-agricolas.csv`) y el índice ONI de NOAA (`data/raw/noaa-oni.txt`). La vista `v_rendimiento_enso` compara el rinde de cada departamento contra su tendencia según la fase Niño/Niña.
- `05_carga_georef.sql`: completa los centroides (lat/lon) de los departamentos con la API Georef (`data/raw/georef-departamentos.json`).
- `06_carga_matba_rofex.sql`: carga los futuros de granos de Matba Rofex (`data/raw/matba-rofex-futuros.csv`) si el archivo existe.
- `07_carga_clima_suelo.sql`: clima diario de NASA POWER desde 1981 (`data/raw/nasa-power/`, una celda de 0,5° por zona agrícola) y perfiles de suelo de SoilGrids (`data/raw/soilgrids/`, uno por departamento agrícola). Cada departamento queda vinculado a su celda de clima y su perfil de suelo.
- `08_carga_economia_enso.sql`: tipo de cambio oficial del BCRA desde 2002, precios pizarra de BCR desde 1988 (la vista `v_precio_grano_usd` los pasa a dólares), retenciones del Decreto 423/2026 y el pronóstico oficial de ENSO de NOAA.

Comandos:

- `pnpm fuentes:descargar`: vuelve a bajar MAGyP, ONI y pronóstico de NOAA y Georef a `data/raw/`.
- `pnpm fuentes:clima`: baja el clima diario de NASA POWER (~10 min, ~230 MB, no se versiona).
- `pnpm fuentes:suelo`: baja los perfiles de SoilGrids (~1,5 h por el límite de la API; se puede cortar y retomar).
- `pnpm fuentes:precios`: baja precios pizarra de BCR y tipo de cambio del BCRA.
- Después de cualquiera de estos, `pnpm db:reset` recrea la base con los datos nuevos.
- `pnpm fuentes:rofex [días]`: baja los futuros de granos de Matba Rofex usando `ROFEX_USER` / `ROFEX_PASSWORD` del `.env` (la cuenta tiene que tener acceso a la API de Primary).
- `pnpm db:up`: levanta la base (puerto **5433** para no chocar con un PostgreSQL local en 5432; usuario/clave/base `agrocore`).
- `pnpm db:reset`: borra el volumen y la vuelve a crear desde los scripts.
- `pnpm db:psql`: abre una consola `psql` dentro del contenedor.

## Estructura del proyecto

La estructura del repositorio se documentará a medida que avance el desarrollo, siguiendo la organización estándar de un proyecto Next.js con TypeScript: rutas y API en `app/`, componentes de React en `components/`, configuración de autenticación y de Drizzle en `lib/`, y configuración de contenedores en `docker/`.

## Contexto del proyecto

Este proyecto se desarrolla en el marco de la cátedra de Administración de Sistemas de Información, de la carrera de Ingeniería en Sistemas de Información de la UTN Facultad Regional Rosario.

## Licencia

A definir.
