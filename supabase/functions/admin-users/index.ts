import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const actions = new Set(['list', 'create', 'update_profile', 'set_password', 'set_active', 'send_recovery'])
const roles = new Set(['administrador', 'rrhh', 'monitora'])
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const commonPasswords = new Set(['12345', '123456', 'password', 'contraseña', 'admin123', 'qwerty'])

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const fail = (status: number, code: string, message: string) => json(status, { ok: false, error: { code, message } })
const text = (value: unknown, message: string) => {
  const result = typeof value === 'string' ? value.trim() : ''
  if (!result) throw new ApiError(400, 'validation_error', message)
  return result
}
const optionalId = (value: unknown) => value === '' || value == null ? null : Number(value)
const isId = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0
const userId = (value: unknown) => {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new ApiError(400, 'validation_error', 'El usuario no es válido.')
  return value
}
const password = (value: unknown) => {
  const result = typeof value === 'string' ? value : ''
  if (result.length < 12 || !/[A-Z]/.test(result) || !/[a-z]/.test(result) || !/\d/.test(result) || !/[^A-Za-z0-9]/.test(result) || commonPasswords.has(result.toLocaleLowerCase('es'))) {
    throw new ApiError(400, 'weak_password', 'La contraseña debe tener al menos 12 caracteres, mayúscula, minúscula, número y símbolo.')
  }
  return result
}
const profileFields = 'id, nombre_completo, correo, rol, sede_id, turno_id, activo, created_at'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Método no permitido.')
  try {
    const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY'); const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !anon || !secret) throw new ApiError(500, 'server_configuration', 'La función no está configurada correctamente.')
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) throw new ApiError(401, 'session_required', 'Se requiere una sesión válida.')
    const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: authData, error: authError } = await caller.auth.getUser()
    if (authError || !authData.user) throw new ApiError(401, 'session_expired', 'La sesión no es válida o venció.')
    const { data: actor, error: actorError } = await admin.from('perfiles').select('id, rol, activo').eq('id', authData.user.id).maybeSingle()
    if (actorError) throw new ApiError(500, 'profile_query_failed', 'No fue posible validar el acceso.')
    if (!actor || !actor.activo || actor.rol !== 'administrador') throw new ApiError(403, 'forbidden', 'No tienes autorización para administrar usuarios.')

    let body: { action?: unknown; payload?: Record<string, unknown> }
    try { body = await request.json() } catch { throw new ApiError(400, 'invalid_json', 'El cuerpo de la solicitud no es válido.') }
    if (typeof body.action !== 'string' || !actions.has(body.action)) throw new ApiError(400, 'invalid_action', 'La acción solicitada no está permitida.')
    const payload = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload) ? body.payload : {}
    const audit = async (accion: string, affected: string, before: unknown = null, after: unknown = null) => {
      const { error } = await admin.from('auditoria').insert({ tabla: 'perfiles', registro_id: affected, accion, usuario_id: actor.id, datos_anteriores: before, datos_nuevos: after })
      if (error) console.error('[admin-users] audit_failed', { action: accion, code: error.code, message: error.message })
    }
    const location = (role: string, site: unknown, shift: unknown) => {
      if (!roles.has(role)) throw new ApiError(400, 'invalid_role', 'El rol seleccionado no es válido.')
      let sedeId = optionalId(site); let turnoId = optionalId(shift)
      if ((sedeId != null && !isId(sedeId)) || (turnoId != null && !isId(turnoId))) throw new ApiError(400, 'validation_error', 'La sede o el turno no son válidos.')
      if (role === 'monitora' && (!isId(sedeId) || !isId(turnoId))) throw new ApiError(400, 'location_required', 'La sede y el turno son obligatorios para una monitora.')
      return { sedeId, turnoId }
    }

    if (body.action === 'list') {
      const authUsers = []; let page = 1
      while (true) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
        if (error) throw new ApiError(500, 'users_query_failed', 'No fue posible consultar los usuarios.')
        authUsers.push(...data.users); if (data.users.length < 1000) break; page += 1
      }
      const [profilesResult, sitesResult, shiftsResult] = await Promise.all([
        admin.from('perfiles').select(`${profileFields}, sedes(nombre), turnos(nombre)`),
        admin.from('sedes').select('id, nombre, activa').order('nombre'),
        admin.from('turnos').select('id, nombre, activo').order('nombre'),
      ])
      if (profilesResult.error || sitesResult.error || shiftsResult.error) throw new ApiError(500, 'users_query_failed', 'No fue posible consultar los usuarios.')
      const byId = new Map(authUsers.map((item) => [item.id, item]))
      const usuarios = (profilesResult.data ?? []).map((item) => {
        const authUser = byId.get(item.id); const sede = Array.isArray(item.sedes) ? item.sedes[0] : item.sedes; const turno = Array.isArray(item.turnos) ? item.turnos[0] : item.turnos
        return { user_id: item.id, nombre_completo: item.nombre_completo, correo: item.correo, rol: item.rol, sede: sede?.nombre ?? null, turno: turno?.nombre ?? null, activo: item.activo, fecha_creacion: authUser?.created_at ?? item.created_at, ultimo_acceso: authUser?.last_sign_in_at ?? null }
      }).sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es', { sensitivity: 'base' }))
      return json(200, { ok: true, data: { usuarios, sedes: sitesResult.data ?? [], turnos: shiftsResult.data ?? [] } })
    }

    if (body.action === 'create') {
      const nombreCompleto = text(payload.nombreCompleto, 'El nombre completo es obligatorio.'); const correo = text(payload.correo, 'El correo es obligatorio.').toLowerCase(); const rol = text(payload.rol, 'El rol es obligatorio.')
      if (!emailPattern.test(correo)) throw new ApiError(400, 'invalid_email', 'El correo no es válido.')
      const { sedeId, turnoId } = location(rol, payload.sedeId, payload.turnoId); const temporary = password(payload.passwordTemporal)
      const { data: duplicate } = await admin.from('perfiles').select('id').eq('correo', correo).maybeSingle()
      if (duplicate) throw new ApiError(409, 'email_exists', 'Ya existe un usuario con ese correo.')
      const { data: created, error } = await admin.auth.admin.createUser({ email: correo, password: temporary, email_confirm: true })
      if (error || !created.user) throw new ApiError(/already|registered|exists/i.test(error?.message ?? '') ? 409 : 400, /already|registered|exists/i.test(error?.message ?? '') ? 'email_exists' : 'auth_create_failed', /already|registered|exists/i.test(error?.message ?? '') ? 'Ya existe un usuario con ese correo.' : 'No fue posible crear el usuario.')
      const { error: profileError } = await admin.from('perfiles').upsert({ id: created.user.id, nombre_completo: nombreCompleto, correo, rol, sede_id: sedeId, turno_id: turnoId, activo: true })
      if (profileError) { await admin.auth.admin.deleteUser(created.user.id); throw new ApiError(500, 'profile_create_failed', 'No fue posible crear el perfil del usuario.') }
      await audit('usuario_creado', created.user.id, null, { rol, sede_id: sedeId, turno_id: turnoId, activo: true })
      return json(201, { ok: true, data: { userId: created.user.id, created: true } })
    }

    if (body.action === 'update_profile') {
      const id = userId(payload.userId); const nombreCompleto = text(payload.nombreCompleto, 'El nombre completo es obligatorio.'); const rol = text(payload.rol, 'El rol es obligatorio.'); const { sedeId, turnoId } = location(rol, payload.sedeId, payload.turnoId)
      const { data: current } = await admin.from('perfiles').select('id, rol, activo, nombre_completo, sede_id, turno_id').eq('id', id).maybeSingle()
      if (!current) throw new ApiError(404, 'user_not_found', 'El usuario no existe.')
      if (current.rol === 'administrador' && rol !== 'administrador' && current.activo) { const { count } = await admin.from('perfiles').select('id', { count: 'exact', head: true }).eq('rol', 'administrador').eq('activo', true); if ((count ?? 0) <= 1) throw new ApiError(409, 'last_admin', 'No puedes quitar el rol al único administrador activo.') }
      const next = { nombre_completo: nombreCompleto, rol, sede_id: sedeId, turno_id: turnoId, updated_at: new Date().toISOString() }
      const { error } = await admin.from('perfiles').update(next).eq('id', id); if (error) throw new ApiError(500, 'profile_update_failed', 'No fue posible actualizar el perfil.')
      await audit('perfil_actualizado', id, current, next); return json(200, { ok: true, data: { userId: id, profileUpdated: true } })
    }

    if (body.action === 'set_password') {
      const id = userId(payload.userId); const temporary = password(payload.newPassword); const { data: exists } = await admin.from('perfiles').select('id').eq('id', id).maybeSingle()
      if (!exists) throw new ApiError(404, 'user_not_found', 'El usuario no existe.')
      const { error } = await admin.auth.admin.updateUserById(id, { password: temporary }); if (error) throw new ApiError(500, 'password_update_failed', 'No fue posible cambiar la contraseña.')
      await audit('password_reset_by_admin', id); return json(200, { ok: true, data: { userId: id, passwordUpdated: true } })
    }

    if (body.action === 'set_active') {
      const id = userId(payload.userId); if (typeof payload.activo !== 'boolean') throw new ApiError(400, 'validation_error', 'El estado no es válido.'); if (id === actor.id && !payload.activo) throw new ApiError(409, 'self_deactivation', 'No puedes desactivar tu propio usuario.')
      const { data: current } = await admin.from('perfiles').select('id, rol, activo').eq('id', id).maybeSingle(); if (!current) throw new ApiError(404, 'user_not_found', 'El usuario no existe.')
      if (current.rol === 'administrador' && current.activo && !payload.activo) { const { count } = await admin.from('perfiles').select('id', { count: 'exact', head: true }).eq('rol', 'administrador').eq('activo', true); if ((count ?? 0) <= 1) throw new ApiError(409, 'last_admin', 'No puedes desactivar al único administrador activo.') }
      const { error } = await admin.from('perfiles').update({ activo: payload.activo, updated_at: new Date().toISOString() }).eq('id', id); if (error) throw new ApiError(500, 'status_update_failed', 'No fue posible cambiar el estado del usuario.')
      await audit(payload.activo ? 'usuario_activado' : 'usuario_desactivado', id, { activo: current.activo }, { activo: payload.activo }); return json(200, { ok: true, data: { userId: id, activo: payload.activo } })
    }

    const correo = text(payload.email, 'El correo es obligatorio.').toLowerCase(); if (!emailPattern.test(correo)) throw new ApiError(400, 'invalid_email', 'El correo no es válido.')
    const redirectTo = Deno.env.get('PASSWORD_RECOVERY_REDIRECT_URL'); const { error } = await caller.auth.resetPasswordForEmail(correo, redirectTo ? { redirectTo } : undefined)
    if (error) throw new ApiError(500, 'recovery_failed', 'No fue posible procesar la recuperación.')
    const { data: affected } = await admin.from('perfiles').select('id').eq('correo', correo).maybeSingle(); if (affected) await audit('recuperacion_solicitada', affected.id)
    return json(200, { ok: true, data: { processed: true } })
  } catch (error) {
    if (error instanceof ApiError) return fail(error.status, error.code, error.message)
    console.error('[admin-users] unexpected_error', { name: error instanceof Error ? error.name : 'Error' })
    return fail(500, 'internal_error', 'Ocurrió un error interno.')
  }
})
