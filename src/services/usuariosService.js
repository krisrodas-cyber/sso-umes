import { supabase } from '../config/supabase.js'

export class UsuariosServiceError extends Error {
  constructor(code, message, status, cause) {
    super(message, { cause })
    this.name = 'UsuariosServiceError'
    this.code = code
    this.status = status
  }
}

const invoke = async (action, payload = {}) => {
  if (!supabase) throw new UsuariosServiceError('not_configured', 'Supabase no está configurado.')
  const { data, error } = await supabase.functions.invoke('admin-users', { body: { action, payload } })
  if (error || !data?.ok) {
    const context = error?.context
    let responseBody = data
    if (!responseBody && context?.json) {
      try { responseBody = await context.json() } catch { /* respuesta no JSON */ }
    }
    const code = responseBody?.error?.code || (context?.status === 401 ? 'session_expired' : context?.status === 403 ? 'forbidden' : 'network_error')
    const message = responseBody?.error?.message || error?.message || 'No fue posible completar la solicitud.'
    console.error('[Usuarios]', { action, code, message, status: context?.status ?? null })
    throw new UsuariosServiceError(code, message, context?.status, error)
  }
  return data.data
}

export const getUsuarios = () => invoke('list')
export const crearUsuario = (payload) => invoke('create', payload)
export const actualizarPerfilUsuario = (payload) => invoke('update_profile', payload)
export const cambiarPasswordUsuario = (userId, newPassword) => invoke('set_password', { userId, newPassword })
export const cambiarEstadoUsuario = (userId, activo) => invoke('set_active', { userId, activo })
export const enviarRecuperacion = (email) => invoke('send_recovery', { email })

export const usuariosService = Object.freeze({ getUsuarios, crearUsuario, actualizarPerfilUsuario, cambiarPasswordUsuario, cambiarEstadoUsuario, enviarRecuperacion })
