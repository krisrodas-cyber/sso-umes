import { ROLES, ROUTE_ROLES } from '../utils/constants.js'

const validRoles = Object.values(ROLES)
export const getSessionRole = (session) => session?.user?.app_metadata?.role ?? null
export const roleGuard = (session, allowedRoles = validRoles) => {
  const role = getSessionRole(session)
  return validRoles.includes(role) && allowedRoles.includes(role)
}
export const canAccessRoute = (session, route) => roleGuard(session, ROUTE_ROLES[route] ?? [])
export const canManageRecords = (session) => getSessionRole(session) === ROLES.ADMINISTRADOR
