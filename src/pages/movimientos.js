import { ROLES } from '../utils/constants.js'
import { getInventario, getMovimientosInventario, getSedesActivas } from '../services/inventarioService.js'
import { formatDateTime, formatMovementType, formatQuantity } from '../utils/formatters.js'

const escapeHtml = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
const types = [['inventario_inicial','Inventario inicial'],['ingreso','Entrada'],['salida_atencion','Salida por atención'],['ajuste_positivo','Ajuste positivo'],['ajuste_negativo','Ajuste negativo'],['vencimiento','Vencimiento'],['traslado_entrada','Traslado de entrada'],['traslado_salida','Traslado de salida']]
const metric = (label, id) => `<article class="metric-card"><span>${label}</span><strong id="${id}">0</strong></article>`
const safeError = (action, error) => ({ action, code: error?.code, message: error?.message, status: error?.status })

export const movimientosPage = ({ session }) => `<section class="data-page"><div class="page-heading data-heading"><div><p class="eyebrow">Trazabilidad</p><h2>Movimientos de inventario</h2><p class="text-muted">Consulta de entradas, salidas y ajustes permitidos por tu perfil.</p></div><button class="btn btn-outline-primary" id="movements-refresh" type="button">Actualizar</button></div>
  <div class="metrics-grid metrics-five">${metric('Movimientos del día','move-today')}${metric('Salidas por atención','move-outputs')}${metric('Ingresos','move-inputs')}${metric('Ajustes','move-adjustments')}${metric('Productos movimentados','move-products')}</div>
  <section class="data-panel"><h3>Filtros</h3><form id="movement-filters" class="row g-3">
    <div class="col-md-3"><label class="form-label" for="move-from">Desde</label><input class="form-control" type="date" id="move-from" name="fechaDesde" value=""></div><div class="col-md-3"><label class="form-label" for="move-to">Hasta</label><input class="form-control" type="date" id="move-to" name="fechaHasta" value=""></div>
    <div class="col-md-3"><label class="form-label" for="move-site">Sede</label><select class="form-select" id="move-site" name="sedeId" ${session.profile.rol === ROLES.MONITORA ? 'disabled' : ''}><option value="">Todas las sedes</option></select></div>
    <div class="col-md-3"><label class="form-label" for="move-type">Tipo</label><select class="form-select" id="move-type" name="tipoMovimiento"><option value="">Todos</option>${types.map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
    <div class="col-md-4"><label class="form-label" for="move-product">Producto</label><select class="form-select" id="move-product" name="productoId"><option value="">Todos</option></select></div>
    <div class="col-md-4"><label class="form-label" for="move-attention">Código de atención</label><input class="form-control" id="move-attention" name="codigoAtencion" value="" placeholder="ATE-AAAA-000000"></div>
    <div class="col-md-4"><label class="form-label" for="move-search">Buscar producto u observación</label><input class="form-control" id="move-search" name="busqueda"></div>
    <div class="col-12 d-flex gap-2"><button class="btn btn-primary" id="movement-apply" type="submit">Aplicar filtros</button><button class="btn btn-outline-secondary" id="movement-clear" type="button">Limpiar filtros</button></div>
  </form></section>
  <section class="data-panel"><div id="movement-status" class="loading-state" aria-live="polite">Consultando movimientos…</div><div id="movement-results"></div><div id="movement-pagination" class="pagination-bar"></div></section></section>`

export const initMovimientosPage = async ({ session }) => {
  const root = document.querySelector('.data-page')
  if (!root) {
    console.error(safeError('iniciar_movimientos', new Error('No se encontró el contenedor de la página.')))
    return
  }
  const monitor = session.profile.rol === ROLES.MONITORA; const limit = 20
  let page = 1; let loading = false
  const $ = (id) => root.querySelector(`#${id}`)
  const params = () => { const form = $('movement-filters'); const value = form ? Object.fromEntries(new FormData(form)) : {}; if (monitor) value.sedeId = session.profile.sede_id; return value }
  const setMetrics = ({ today = 0, outputs = 0, inputs = 0, adjustments = 0, products = 0 } = {}) => {
    if ($('move-today')) $('move-today').textContent = today
    if ($('move-outputs')) $('move-outputs').textContent = outputs
    if ($('move-inputs')) $('move-inputs').textContent = inputs
    if ($('move-adjustments')) $('move-adjustments').textContent = adjustments
    if ($('move-products')) $('move-products').textContent = products
  }
  const updateMetrics = (rows = []) => {
    try {
      const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' })
      const todayRows = rows.filter((item) => {
        const date = new Date(item.created_at)
        return !Number.isNaN(date.getTime()) && date.toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }) === day
      })
      setMetrics({ today: todayRows.length, outputs: rows.filter((item) => item.tipo === 'salida_atencion').length, inputs: rows.filter((item) => item.tipo === 'ingreso').length, adjustments: rows.filter((item) => ['ajuste_positivo','ajuste_negativo'].includes(item.tipo)).length, products: new Set(rows.map((item) => item.producto_id)).size })
    } catch (error) {
      console.error(safeError('calcular_indicadores_movimientos', error))
      setMetrics()
    }
  }
  const render = (result) => {
    const total = Number.isFinite(result.total) ? result.total : 0
    const totalPages = Math.ceil(total / limit)
    $('movement-status').textContent = total ? `${total} movimiento(s) encontrados.` : 'No hay movimientos que coincidan con los filtros.'
    $('movement-results').innerHTML = result.data.length ? `<div class="desktop-table"><table class="table align-middle"><thead><tr><th>Fecha y hora</th><th>Producto</th><th>Sede</th><th>Tipo</th><th>Cantidad</th><th>Anterior</th><th>Posterior</th><th>Responsable</th><th>Atención</th><th>Observaciones</th></tr></thead><tbody>${result.data.map((x) => `<tr><td>${formatDateTime(x.created_at)}</td><td>${escapeHtml(x.codigo_producto)} · ${escapeHtml(x.producto)}</td><td>${escapeHtml(x.sede)}</td><td>${formatMovementType(x.tipo)}</td><td>${formatQuantity(x.cantidad)}</td><td>${formatQuantity(x.existencia_anterior)}</td><td>${formatQuantity(x.existencia_posterior)}</td><td>${escapeHtml(x.responsable)}</td><td>${escapeHtml(x.codigo_atencion || '—')}</td><td>${escapeHtml(x.observaciones || '—')}</td></tr>`).join('')}</tbody></table></div><div class="mobile-cards">${result.data.map((x) => `<article class="data-card"><h4>${escapeHtml(x.codigo_producto)} · ${escapeHtml(x.producto)}</h4><p>${formatDateTime(x.created_at)} · ${escapeHtml(x.sede)}</p><span class="status-badge status-normal">${formatMovementType(x.tipo)}</span><dl><div><dt>Cantidad</dt><dd>${formatQuantity(x.cantidad)}</dd></div><div><dt>Existencia</dt><dd>${formatQuantity(x.existencia_anterior)} → ${formatQuantity(x.existencia_posterior)}</dd></div><div><dt>Responsable</dt><dd>${escapeHtml(x.responsable)}</dd></div><div><dt>Atención</dt><dd>${escapeHtml(x.codigo_atencion || '—')}</dd></div><div><dt>Observaciones</dt><dd>${escapeHtml(x.observaciones || '—')}</dd></div></dl></article>`).join('')}</div>` : ''
    $('movement-pagination').innerHTML = totalPages > 1 ? `<button class="btn btn-sm btn-outline-secondary" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>Anterior</button><span>Página ${page} de ${totalPages}</span><button class="btn btn-sm btn-outline-secondary" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>Siguiente</button>` : ''
  }
  const load = async () => {
    if (loading) return
    loading = true
    const applyButton = $('movement-apply')
    if ($('movements-refresh')) $('movements-refresh').disabled = true
    if (applyButton) { applyButton.disabled = true; applyButton.textContent = 'Consultando...' }
    if ($('movement-status')) $('movement-status').textContent = 'Consultando movimientos…'
    try {
      const limite = limit
      const offset = (page - 1) * limite
      const filtros = params()
      const resultado = await getMovimientosInventario({ ...filtros, limite, offset })
      render(resultado)
      updateMetrics(resultado.data)
    } catch (error) {
      console.error(safeError('consultar_movimientos', error))
      if ($('movement-status')) $('movement-status').textContent = 'No fue posible consultar los movimientos.'
      if ($('movement-results')) $('movement-results').innerHTML = ''
      if ($('movement-pagination')) $('movement-pagination').innerHTML = ''
      setMetrics()
    } finally {
      loading = false
      if ($('movements-refresh')) $('movements-refresh').disabled = false
      if (applyButton) { applyButton.disabled = false; applyButton.textContent = 'Aplicar filtros' }
    }
  }

  const loadFilterOptions = async () => {
    const [sitesResult, inventoryResult] = await Promise.allSettled([getSedesActivas(), getInventario({ sedeId: monitor ? session.profile.sede_id : null })])
    if (sitesResult.status === 'fulfilled' && $('move-site')) {
      $('move-site').innerHTML = `<option value="">Todas las sedes</option>${sitesResult.value.map((x) => `<option value="${x.id}">${escapeHtml(x.nombre)}</option>`).join('')}`
      if (monitor) $('move-site').value = session.profile.sede_id || ''
    } else if (sitesResult.status === 'rejected') console.error(safeError('consultar_sedes_movimientos', sitesResult.reason))
    if (inventoryResult.status === 'fulfilled' && $('move-product')) {
      const unique = [...new Map(inventoryResult.value.map((x) => [x.producto_id, x])).values()].sort((a,b) => a.nombre.localeCompare(b.nombre,'es'))
      $('move-product').innerHTML = `<option value="">Todos</option>${unique.map((x) => `<option value="${x.producto_id}">${escapeHtml(x.codigo)} · ${escapeHtml(x.nombre)}</option>`).join('')}`
    } else if (inventoryResult.status === 'rejected') console.error(safeError('consultar_productos_movimientos', inventoryResult.reason))
  }

  $('movement-filters')?.addEventListener('submit', (event) => { event.preventDefault(); page = 1; load() })
  $('movements-refresh')?.addEventListener('click', load)
  $('movement-clear')?.addEventListener('click', () => { $('movement-filters')?.reset(); if (monitor && $('move-site')) $('move-site').value = session.profile.sede_id || ''; page = 1; load() })
  $('movement-pagination')?.addEventListener('click', (e) => { const nextPage = e.target.closest('[data-page]')?.dataset.page; if (!nextPage) return; page = Number(nextPage); load() })

  await Promise.all([load(), loadFilterOptions()])
}
