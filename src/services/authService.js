import { supabase } from '../config/supabase.js'
import { ROLES } from '../utils/constants.js'

const validRoles = Object.values(ROLES)
let cachedProfile = null
let profileRequest = null

export class AuthProfileError extends Error {
  constructor(code, message, cause) {
    super(message, { cause })
    this.name = 'AuthProfileError'
    this.code = code
  }
}

const loadProfile = async (userId, { force = false } = {}) => {
  if (!userId) throw new AuthProfileError('missing_user', 'No se encontró el usuario autenticado.')
  if (!force && cachedProfile?.id === userId) return cachedProfile
  if (!force && profileRequest?.userId === userId) return profileRequest.promise

  const promise = (async () => {
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre_completo, correo, rol, activo, sede_id, turno_id')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw new AuthProfileError('profile_query_failed', 'No se pudo consultar el perfil del usuario.', error)
    if (!data) throw new AuthProfileError('profile_not_found', 'El usuario autenticado no tiene un perfil registrado.')
    if (!data.activo) throw new AuthProfileError('profile_inactive', 'El perfil del usuario está inactivo. Contacta a un administrador.')
    if (!validRoles.includes(data.rol)) {
      throw new AuthProfileError('unknown_role', 'El perfil tiene un rol no reconocido. Contacta a un administrador.')
    }

    cachedProfile = data
    return data
  })()

  profileRequest = { userId, promise }
  try {
    return await promise
  } finally {
    if (profileRequest?.promise === promise) profileRequest = null
  }
}

const withProfile = async (session, options) => {
  if (!session) return null
  const profile = await loadProfile(session.user.id, options)
  return { ...session, profile }
}

export const getSession = async () => {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return withProfile(data.session)
}
export const signIn = async (email, password) => {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  cachedProfile = null
  profileRequest = null
  const session = await withProfile(data.session, { force: true })
  return { ...data, session, profile: session.profile }
}
export const signOut = async () => {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  cachedProfile = null
  profileRequest = null
}

export const getUserDisplayName = (session) =>
  session?.profile?.nombre_completo || session?.user?.user_metadata?.full_name || session?.user?.email || 'Usuario'
