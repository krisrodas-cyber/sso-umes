# Sistema de Atenciones SSO UMES

## Pruebas manuales del Historial de atenciones

### Monitora

- Solo ve sus propias atenciones según RLS y visualiza su sede y turno como información fija.
- No puede seleccionar otra sede ni otra monitora.
- Abre el detalle de una atención permitida y ve sus productos.
- Una atención sin productos muestra el estado vacío correspondiente.
- No existen acciones para editar, eliminar, corregir o duplicar.

### RRHH

- Ve todas las atenciones permitidas y filtra por sede, turno y monitora.
- Combina fechas, tipo de persona, resultado y búsqueda general.
- Abre cualquier detalle permitido por RLS.

### Administrador

- Ve todas las atenciones y los filtros combinados funcionan.
- No dispone de edición ni eliminación desde este módulo.

### Paginación y privacidad

- El conteo coincide con los registros y Anterior/Siguiente cambian de página correctamente.
- Cambiar o limpiar filtros vuelve a la página 1 y deja las fechas vacías.
- No se guardan pacientes ni filtros en Local Storage o Session Storage.
- La consola no muestra nombres, teléfonos, síntomas ni objetos clínicos.
- El listado no muestra teléfono, síntomas ni observaciones clínicas.

## Pruebas manuales de Inventario, Movimientos y Dashboard

### Inventario

- Una monitora solo ve y puede consultar su sede asignada.
- RRHH y administrador pueden consultar ambas sedes y la opción Todas las sedes.
- Búsqueda, sede, categoría, estado y tipo de control funcionan combinados.
- Agotados y existencias bajas coinciden con existencia actual y mínima.
- Los reutilizables aparecen identificados como “Reutilizable / sin descuento”.
- No aparecen botones para editar, eliminar o ajustar inventario.
- Los vencimientos y sus filtros respetan RLS.

### Movimientos

- Un consumible usado aparece como Salida por atención.
- Un reutilizable registrado en una atención no genera movimiento.
- Una monitora solo ve movimientos propios o vinculados a sus atenciones según RLS.
- RRHH y administrador ven todos los movimientos permitidos.
- La atención aparece mediante su código y nunca mediante el nombre del paciente.
- Los filtros de fecha, sede, tipo, producto y código de atención funcionan.
- La paginación conserva el orden del movimiento más reciente al más antiguo.

### Dashboard

- Los indicadores coinciden con Inventario para el alcance permitido por RLS.
- Las alertas muestran agotados antes de existencias bajas.
- “Ver inventario completo” abre el módulo Inventario.

## Control de productos e inventario inicial

La existencia inicial por sede se toma exclusivamente de **Stock para el semestre Z3** y **Stock para el semestre Z9**; no se suma con Cantidad ni con Ingreso Febrero. El mínimo inicial se calcula por sede como el 20 % de la existencia, redondeado hacia arriba y con mínimo absoluto de 1. Para insumos se conserva el mínimo numérico explícito del Excel cuando existe.

Los productos consumibles descuentan inventario y lote mediante `registrar_atencion`. Los reutilizables o productos autorizados para registro sin descuento aparecen en el detalle de la atención, pero no actualizan inventario, lote ni generan un movimiento de salida. La RPC decide el comportamiento usando `es_consumible` y `permite_registro_sin_descuento`; el cliente no escribe directamente en las tablas.

Los productos totalmente vencidos conservan su producto y existencia utilizable 0. Solo se preparan lotes históricos vencidos cuando fecha y sede son inequívocas. Las fechas o distribuciones ambiguas permanecen en `data/procesado/pendientes_revision.csv`.

`contenido_por_presentacion` documenta contenido interno conocido, pero la carga inicial no multiplica existencias. Deben revisarse especialmente cajas y paquetes cuando el inventario está expresado en presentaciones y las atenciones probablemente registren unidades internas.

Orden de ejecución para una instalación nueva:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/seed/001_catalogos.sql`
3. `supabase/migrations/002_product_control_fields.sql`
4. `supabase/seed/002_productos_inventario.sql`

El último seed debe revisarse antes de ejecutarse; no crea perfiles, usuarios ni movimientos de inventario inicial.

## Pruebas manuales de Nueva atención

Usa cuentas de prueba y datos ficticios no clínicos en desarrollo.

### Monitora

- Visualiza responsable, sede y turno asignados sin poder cambiarlos.
- Registra una atención sin productos.
- Registra con producto sin lotes utilizables y con `lote_id` nulo.
- Registra seleccionando producto y lote utilizable.
- No puede exceder el inventario general ni la disponibilidad del lote.
- Un doble clic o segundo envío durante el proceso no crea dos atenciones.
- Después de guardar no existe opción para editar la atención.

### Administrador

- Selecciona una monitora y registra para ella; sede y turno se completan y bloquean.
- No puede registrar sin responsable, sede o turno, ni con una combinación incoherente.
- Puede seleccionarse como responsable y elegir sede y turno.

### RRHH y privacidad

- RRHH no ve el enlace y al abrir `#/nueva-atencion` recibe acceso restringido.
- Al recargar no se recupera información escrita en el formulario.
- Local Storage y Session Storage no contienen información personal o clínica.
- La consola no contiene nombres, payloads, tokens, contraseñas ni claves.

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

El código de interfaz se divide en `components`, `pages`, `guards`, `services`, `utils` y `config`. El esquema inicial está en `supabase/migrations/001_initial_schema.sql` y los catálogos base en `supabase/seed/001_catalogos.sql`.

El esquema incluye sedes, turnos, perfiles enlazados a `auth.users`, productos, inventario por sede, lotes, atenciones, detalle entregado, movimientos y auditoría. Todas las tablas públicas tienen RLS. Las vistas de alertas de inventario y vencimiento usan `security_invoker` para respetar las políticas de las tablas subyacentes.

## Roles

- `administrador`
- `monitora`
- `rrhh`

El frontend actualmente lee el rol desde `app_metadata.role`. La autorización de datos se aplica en PostgreSQL contra `public.perfiles`; ambas asignaciones deben mantenerse sincronizadas desde un entorno administrativo confiable.

## Orden de instalación

1. Ejecuta `supabase/migrations/001_initial_schema.sql`.
2. Ejecuta `supabase/seed/001_catalogos.sql`.
3. Crea los usuarios con Supabase Authentication (Dashboard o flujo administrativo seguro). No los crees mediante SQL.
4. Crea los perfiles correspondientes solo después de que existan sus usuarios en `auth.users`.

No ejecutes ningún seed de perfiles antes de crear los usuarios Auth: `perfiles.id` referencia directamente `auth.users.id`. El seed incluido solo carga sedes y turnos; no contiene medicamentos, insumos ni datos de pacientes.

## Registro transaccional de atenciones

La única vía habilitada para guardar una atención es la RPC `registrar_atencion`. La función inserta la atención, bloquea el inventario y el lote aplicables, valida existencias, registra el detalle y el movimiento, y descuenta cantidades dentro de la misma transacción. Ante cualquier error, PostgreSQL revierte la llamada completa.

Las monitoras no pueden manipular sede, turno o responsable: la RPC toma esos valores de su perfil activo. Un administrador puede proporcionarlos explícitamente, pero si selecciona una monitora debe respetar su sede y turno asignados. Las escrituras directas de atenciones, detalle y movimientos están bloqueadas para todos los usuarios `authenticated`. Las correcciones o eliminaciones administrativas se implementarán posteriormente mediante RPC administrativas específicas.

Si hay lotes utilizables para un producto en la sede, la RPC exige seleccionar uno. Cuando no hay lotes utilizables registrados, permite descontar solo el inventario general; todavía no selecciona lotes automáticamente.

## Bootstrap del primer administrador

Después de ejecutar la migración y el seed:

1. Crea el usuario administrador desde **Authentication > Users** en el Dashboard de Supabase.
2. Copia el UUID asignado al usuario.
3. Consulta los catálogos ya cargados y, si deseas asignar sede o turno al administrador, usa sus IDs existentes.
4. Desde SQL Editor, inserta manualmente el primer perfil reemplazando los marcadores:

```sql
insert into public.perfiles (id, nombre_completo, correo, rol, sede_id, turno_id)
values (
  '<UUID_DEL_USUARIO_AUTH>'::uuid,
  '<NOMBRE_COMPLETO>',
  lower('<CORREO_INSTITUCIONAL>'),
  'administrador',
  null, -- o <SEDE_ID_EXISTENTE>
  null  -- o <TURNO_ID_EXISTENTE>
);
```

El SQL no debe contener la contraseña del usuario, una `service_role` key ni ningún otro secreto. SQL Editor usa el contexto administrativo del proyecto para este bootstrap puntual.

## Matriz resumida de permisos

| Recurso | Administrador | Monitora | RRHH |
|---|---|---|---|
| Sedes, turnos y productos | Consulta; cambios futuros mediante RPC administrativa | Consulta habilitada | Consulta habilitada |
| Perfiles | Consulta; bootstrap inicial desde SQL Editor y cambios futuros mediante RPC | Solo perfil propio | Perfil propio y monitoras para filtros |
| Inventario y lotes | Consulta; cambios futuros mediante RPC administrativa | Consulta de su sede | Consulta global |
| Atenciones | Consulta y registra mediante RPC; correcciones futuras mediante RPC administrativa | Registra mediante RPC y consulta solo las propias | Consulta global; no escribe |
| Detalles y movimientos | Consulta; escritura mediante RPC | Consulta de registros propios; escritura indirecta mediante RPC | Consulta global; no escribe |
| Auditoría | Solo consulta | Sin acceso | Sin acceso |

RLS es la barrera efectiva aunque `authenticated` tenga privilegios SQL de tabla necesarios para que PostgreSQL evalúe las políticas.

## Prueba en Supabase SQL Editor

1. Usa primero un proyecto de desarrollo vacío, nunca producción como primera prueba.
2. Abre SQL Editor, pega la migración completa y usa **Run** una sola vez.
3. Revisa que no haya errores y confirma en Table Editor que las diez tablas muestran RLS habilitado.
4. Ejecuta el seed de catálogos y verifica las dos sedes y los dos turnos.
5. Crea usuarios Auth de prueba sin datos reales y luego sus perfiles con correos en minúsculas.
6. Prueba cada rol desde el cliente con su sesión `authenticated`; no pruebes usando `service_role`, porque omite RLS.
7. Verifica que una monitora solo vea su sede y sus atenciones, que RRHH no pueda escribir y que una entrega insuficiente mediante `registrar_atencion` no deje registros parciales.

## Respaldo antes de cambios sobre datos reales

Antes de aplicar cambios en una base con información real, detén escrituras de la aplicación y genera un respaldo desde las herramientas oficiales de Supabase o con `pg_dump` usando una conexión autorizada y cifrada. Conserva el archivo fuera del repositorio, verifica que tenga tamaño y contenido esperados, registra la versión de la migración y ensaya la restauración en un proyecto aislado. Aplica primero en staging y define una ventana y un responsable de reversión antes de intervenir producción.

No guardes contraseñas, claves de servicio, cadenas de conexión ni respaldos en Git. La aplicación solo debe usar la URL pública y la publishable key configuradas fuera del código.

## Navegación y acceso

La página inicial es el inicio de sesión. La aplicación usa rutas hash (`#/ruta`) y una base relativa para funcionar en subrutas de GitHub Pages. `Usuarios` está disponible para `administrador`; `Nueva atención`, para `administrador` y `monitora`. La interfaz no presenta controles de edición o eliminación para `monitora`.
