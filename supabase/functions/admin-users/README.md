# admin-users

Función administrativa exclusiva para perfiles activos con rol `administrador`. Usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` desde los secretos administrados por Supabase; ninguna de estas credenciales administrativas pertenece al frontend.

Despliegue pendiente:

```sh
supabase functions deploy admin-users
```

La recuperación usa el flujo estándar de Supabase. Si el proyecto ya tiene una ruta permitida para actualizar contraseñas, configura su URL exacta como secreto `PASSWORD_RECOVERY_REDIRECT_URL`. Actualmente el frontend no incluye una página para establecer la nueva contraseña; si el secreto no está configurado, Supabase usa la Site URL configurada en Authentication y no se inventa un dominio desde esta función.
