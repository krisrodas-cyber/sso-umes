import { ROLE_LABELS } from '../utils/constants.js'
import { getSessionRole } from '../guards/roleGuard.js'
import { getUserDisplayName } from '../services/authService.js'

export const topbar = (title = 'Sistema de Atenciones', session = null) => `
  <header class="app-topbar">
    <button class="btn btn-outline-secondary d-lg-none" type="button" id="sidebar-toggle" aria-controls="app-sidebar" aria-expanded="false" aria-label="Abrir menú">☰</button>
    <div class="topbar-title"><p class="eyebrow">Seguridad y Salud Ocupacional</p><h1>${title}</h1></div>
    <div class="topbar-user"><span><strong>${getUserDisplayName(session)}</strong><small>${ROLE_LABELS[getSessionRole(session)] ?? 'Rol pendiente'}</small></span><button class="btn btn-sm btn-outline-secondary" id="logout-button" type="button">Cerrar sesión</button></div>
  </header>`
