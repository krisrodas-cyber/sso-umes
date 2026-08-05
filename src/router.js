import Swal from 'sweetalert2'
import { sidebar } from './components/sidebar.js'
import { topbar } from './components/topbar.js'
import { loginPage } from './pages/login.js'
import { dashboardPage, initDashboardPage } from './pages/dashboard.js'
import { nuevaAtencionPage, initNuevaAtencionPage } from './pages/nueva-atencion.js'
import { atencionesPage, initAtencionesPage } from './pages/atenciones.js'
import { inventarioPage, initInventarioPage } from './pages/inventario.js'
import { movimientosPage, initMovimientosPage } from './pages/movimientos.js'
import { reportesPage, initReportesPage } from './pages/reportes.js'
import { usuariosPage, initUsuariosPage } from './pages/usuarios.js'
import { signIn, signOut } from './services/authService.js'
import { authGuard } from './guards/authGuard.js'
import { canAccessRoute } from './guards/roleGuard.js'
import { isSupabaseConfigured } from './config/supabase.js'
import { ROUTES } from './utils/constants.js'

const routes = {
  '/dashboard': { title: 'Panel principal', view: dashboardPage },
  '/nueva-atencion': { title: 'Nueva atención', view: nuevaAtencionPage },
  '/atenciones': { title: 'Atenciones', view: atencionesPage },
  '/inventario': { title: 'Inventario', view: inventarioPage },
  '/movimientos': { title: 'Movimientos', view: movimientosPage },
  '/reportes': { title: 'Reportes', view: reportesPage },
  '/usuarios': { title: 'Usuarios', view: usuariosPage },
}

const getPath = () => {
  const path = window.location.hash.slice(1).split('?')[0]
  return path.startsWith('/') ? path : ROUTES.LOGIN
}

const go = (path) => { window.location.hash = path }

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const renderAuthError = (root, message) => {
  root.innerHTML = `<main class="login-page"><section class="login-card"><h1>No fue posible validar el acceso</h1><p>${escapeHtml(message)}</p><a href="#/login" class="btn btn-primary mt-3">Volver al inicio de sesión</a></section></main>`
}

const bindMenu = () => {
  const button = document.querySelector('#sidebar-toggle')
  button?.addEventListener('click', () => {
    const menu = document.querySelector('#app-sidebar')
    const open = menu.classList.toggle('is-open')
    button.setAttribute('aria-expanded', String(open))
  })
}

const bindLogin = () => {
  document.querySelector('#login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    try {
      await signIn(data.get('email'), data.get('password'))
      go(ROUTES.DASHBOARD)
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'No fue posible ingresar', text: error.message })
    }
  })
}

const bindLogout = () => {
  document.querySelector('#logout-button')?.addEventListener('click', async () => {
    await signOut()
    go(ROUTES.LOGIN)
  })
}

export const initRouter = (root) => {
  const render = async () => {
    const path = getPath()
    if (path === ROUTES.LOGIN) {
      root.innerHTML = loginPage()
      bindLogin()
      return
    }

    let session
    try {
      session = await authGuard()
    } catch (error) {
      console.error('No fue posible validar la sesión o el perfil.', error)
      renderAuthError(root, error.message || 'No se pudo validar el acceso del usuario.')
      return
    }
    if (!isSupabaseConfigured || !session) {
      go(ROUTES.LOGIN)
      return
    }

    const route = routes[path] ?? routes['/dashboard']
    const resolvedPath = routes[path] ? path : ROUTES.DASHBOARD
    if (!canAccessRoute(session, resolvedPath)) {
      root.innerHTML = `<main class="login-page"><section class="login-card"><h1>Acceso restringido</h1><p>Tu rol no tiene acceso a este módulo.</p><a href="#/dashboard" class="btn btn-primary mt-3">Volver al inicio</a></section></main>`
      return
    }

    root.innerHTML = `<div class="app-shell">${sidebar(resolvedPath, session)}<div class="app-column">${topbar(route.title, session)}<main class="app-content">${route.view({ session })}</main></div></div>`
    bindMenu()
    bindLogout()
    if (resolvedPath === ROUTES.NUEVA_ATENCION) await initNuevaAtencionPage({ session })
    if (resolvedPath === ROUTES.ATENCIONES) await initAtencionesPage({ session })
    if (resolvedPath === ROUTES.INVENTARIO) await initInventarioPage({ session })
    if (resolvedPath === ROUTES.MOVIMIENTOS) await initMovimientosPage({ session })
    if (resolvedPath === ROUTES.REPORTES) await initReportesPage({ session })
    if (resolvedPath === ROUTES.DASHBOARD) await initDashboardPage({ session })
    if (resolvedPath === ROUTES.USUARIOS) await initUsuariosPage({ session })
  }

  window.addEventListener('hashchange', render)
  if (!window.location.hash) go(ROUTES.LOGIN)
  else render()
}
