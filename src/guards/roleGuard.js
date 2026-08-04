import { ROLES, ROUTE_ROLES } from '../utils/constants.js'

const validRoles = Object.values(ROLES)
export const getSessionRole = (session) => session?.profile?.rol ?? null
export const roleGuard = (session, allowedRoles = validRoles) => {
  const rol = getSessionRole(session)
  return validRoles.includes(rol) && allowedRoles.includes(rol)
}
export const canAccessRoute = (session, route) => roleGuard(session, ROUTE_ROLES[route] ?? [])
export const canManageRecords = (session) => getSessionRole(session) === ROLES.ADMINISTRADOR
