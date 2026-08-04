export const ROLES = Object.freeze({ ADMINISTRADOR: 'administrador', MONITORA: 'monitora', RRHH: 'rrhh' })
export const APP_NAME = 'Sistema de Atenciones SSO UMES'
export const ROUTES = Object.freeze({ LOGIN: '/login', DASHBOARD: '/dashboard', NUEVA_ATENCION: '/nueva-atencion', ATENCIONES: '/atenciones', INVENTARIO: '/inventario', MOVIMIENTOS: '/movimientos', REPORTES: '/reportes', USUARIOS: '/usuarios' })
export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMINISTRADOR]: 'Administrador',
  [ROLES.MONITORA]: 'Monitora',
  [ROLES.RRHH]: 'Recursos Humanos',
})

export const ROUTE_ROLES = Object.freeze({
  [ROUTES.DASHBOARD]: Object.values(ROLES),
  [ROUTES.NUEVA_ATENCION]: [ROLES.ADMINISTRADOR, ROLES.MONITORA],
  [ROUTES.ATENCIONES]: Object.values(ROLES),
  [ROUTES.INVENTARIO]: Object.values(ROLES),
  [ROUTES.MOVIMIENTOS]: Object.values(ROLES),
  [ROUTES.REPORTES]: Object.values(ROLES),
  [ROUTES.USUARIOS]: [ROLES.ADMINISTRADOR],
})
