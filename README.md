# Sistema de Atenciones SSO UMES

Sistema de registro de atenciones e inventario para apoyar la gestión de Seguridad y Salud Ocupacional de UMES.

## Tecnologías

Vite, JavaScript, Bootstrap, Supabase JS, Chart.js y SweetAlert2. La navegación usa rutas hash para ser compatible con GitHub Pages.

## Inicio local

1. Instala dependencias con `npm install`.
2. Copia `.env.example` como `.env`.
3. Completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con valores públicos del proyecto.
4. Ejecuta `npm run dev`.

## Scripts

- `npm run dev`: servidor de desarrollo.
- `npm run build`: compilación de producción.
- `npm run preview`: vista previa de la compilación.

## Estructura

El código de interfaz se divide en `components`, `pages`, `guards`, `services`, `utils` y `config`. Las futuras migraciones y semillas se ubicarán en `supabase/`. En esta etapa no se incluyen tablas, consultas de negocio, políticas RLS ni datos de pacientes.

## Roles previstos

- `administrador`
- `monitora`
- `rrhh`

Los roles se leen desde `app_metadata.role`; la asignación segura deberá realizarse posteriormente desde un entorno administrativo confiable.

## Navegación y acceso

La página inicial es el inicio de sesión. La aplicación usa rutas hash (`#/ruta`) y una base relativa para funcionar en subrutas de GitHub Pages. En esta etapa, `Usuarios` solo está disponible para `administrador`; `Nueva atención` está disponible para `administrador` y `monitora`. La interfaz inicial no presenta controles de edición o eliminación para `monitora`.

## Estado de esta etapa

Las vistas internas son provisionales y no contienen datos reales ni demostrativos. Tampoco se han creado tablas, migraciones SQL, políticas RLS, semillas ni registros de pacientes.
