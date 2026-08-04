const links = [['dashboard', 'Inicio'], ['nueva-atencion', 'Nueva atención'], ['atenciones', 'Atenciones'], ['inventario', 'Inventario'], ['movimientos', 'Movimientos'], ['reportes', 'Reportes'], ['usuarios', 'Usuarios']]

export const sidebar = (activeRoute = '') => `
  <aside class="app-sidebar" id="app-sidebar" aria-label="Navegación principal">
    <a class="brand" href="#/dashboard"><img src="./Logo-umes.png" alt="UMES" /><span>Atenciones SSO</span></a>
    <nav class="nav flex-column">${links.map(([route, label]) => `<a class="nav-link ${activeRoute === `/${route}` ? 'active' : ''}" href="#/${route}" ${activeRoute === `/${route}` ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
  </aside>`
