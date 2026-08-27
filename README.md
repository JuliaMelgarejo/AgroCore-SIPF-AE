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
3. Levantar los servicios de base de datos con `docker compose up -d`.
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

## Estructura del proyecto

La estructura del repositorio se documentará a medida que avance el desarrollo, siguiendo la organización estándar de un proyecto Next.js con TypeScript: rutas y API en `app/`, componentes de React en `components/`, configuración de autenticación y de Drizzle en `lib/`, y configuración de contenedores en `docker/`.

## Contexto del proyecto

Este proyecto se desarrolla en el marco de la cátedra de Administración de Sistemas de Información, de la carrera de Ingeniería en Sistemas de Información de la UTN Facultad Regional Rosario.

## Licencia

A definir.
