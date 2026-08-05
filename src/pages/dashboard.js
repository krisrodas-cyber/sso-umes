import { ROLES } from '../utils/constants.js'
import { getResumenInventario } from '../services/inventarioService.js'
import { getAtencionesDelDia } from '../services/atencionesService.js'
import { formatAlertState } from '../utils/formatters.js'

const escapeHtml = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
const metric = (label, id) => `<article class="metric-card"><span>${label}</span><strong id="${id}">—</strong></article>`

export const dashboardPage = () => `<section class="data-page dashboard-page"><div class="page-heading"><div><p class="eyebrow">Resumen general</p><h2>Dashboard</h2><p class="text-muted">Indicadores operativos permitidos por tu perfil.</p></div></div>
  <div class="metrics-grid metrics-four">${metric('Atenciones del día','dash-attentions')}${metric('Existencia baja','dash-low')}${metric('Productos agotados','dash-empty')}${metric('Próximos vencimientos','dash-expiry')}</div>
  <section class="data-panel"><div class="section-title"><div><h3>Alertas de inventario</h3><p class="text-muted small">Agotados primero, seguidos de existencias bajas.</p></div><a class="btn btn-outline-primary" href="#/inventario">Ver inventario completo</a></div><div id="dashboard-status" class="loading-state" aria-live="polite">Consultando indicadores…</div><div id="dashboard-alerts"></div></section></section>`

export const initDashboardPage = async ({ session }) => {
  const root = document.querySelector('.dashboard-page'); if (!root) return
  const sedeId = session.profile.rol === ROLES.MONITORA ? session.profile.sede_id : null
  try {
    const [attentions, inventory] = await Promise.all([getAtencionesDelDia(), getResumenInventario(sedeId)])
    root.querySelector('#dash-attentions').textContent = attentions; root.querySelector('#dash-low').textContent = inventory.bajos; root.querySelector('#dash-empty').textContent = inventory.agotados; root.querySelector('#dash-expiry').textContent = inventory.proximosVencer
    root.querySelector('#dashboard-status').textContent = inventory.alertas.length ? `${inventory.alertas.length} alerta(s) prioritaria(s).` : 'No hay alertas de existencia.'
    root.querySelector('#dashboard-alerts').innerHTML = inventory.alertas.map((x) => `<a class="dashboard-alert" href="#/inventario"><span aria-hidden="true">${x.estado_alerta === 'agotado' ? '⛔' : '⚠'}</span><span><strong>${escapeHtml(x.nombre)}</strong><small>${escapeHtml(x.sede)} · ${formatAlertState(x.estado_alerta)}</small></span></a>`).join('')
  } catch { root.querySelector('#dashboard-status').textContent = 'No fue posible consultar los indicadores.' }
}
