import { Chart, registerables } from 'chart.js'
import { ROLES } from '../utils/constants.js'
import { ALERT_LABELS, ATTENTION_RESULT_LABELS, CATEGORY_LABELS, PERSON_TYPE_LABELS, formatMonthYear, formatPercentage, formatQuantity } from '../utils/formatters.js'
import { clearReportesCache, getAlertasInventarioReporte, getAtencionesPorMes, getAtencionesPorMonitora, getAtencionesPorSede, getAtencionesPorTipoPersona, getAtencionesPorTurno, getCatalogosReportes, getProductosMasUtilizados, getResultadosAtencion, getResumenGeneral } from '../services/reportesService.js'

Chart.register(...registerables)

const escapeHtml = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
const safeError = (error) => console.error('[Reportes]', { name: error?.name ?? 'Error', code: error?.code ?? null, message: error?.message ?? 'Error desconocido', details: error?.details ?? null, hint: error?.hint ?? null })
const metric = (label, id) => `<article class="metric-card"><span>${label}</span><strong id="${id}">0</strong></article>`
const chartPanel = (id, title, wide = false) => `<section class="data-panel report-chart-panel ${wide ? 'report-wide' : ''}"><h3>${title}</h3><div id="${id}-status" class="report-section-status" aria-live="polite"></div><div class="report-chart"><canvas id="${id}" role="img" aria-label="${title}"></canvas></div></section>`

export const reportesPage = ({ session }) => {
  if (![ROLES.ADMINISTRADOR, ROLES.RRHH].includes(session?.profile?.rol)) return '<section class="empty-state"><h3>Acceso restringido</h3><p>Tu perfil no tiene acceso a Reportes.</p></section>'
  return `<section class="data-page reports-page"><div class="page-heading data-heading"><div><p class="eyebrow">Análisis</p><h2>Reportes</h2><p class="text-muted">Indicadores agregados de atenciones e inventario, sujetos a los permisos de tu perfil.</p></div><button class="btn btn-outline-primary" id="reports-refresh" type="button">Actualizar</button></div>
    <section class="data-panel"><h3>Filtros generales</h3><form id="reports-filters" class="row g-3">
      <div class="col-md-2"><label class="form-label" for="reports-from">Desde</label><input class="form-control" type="date" id="reports-from" name="fechaDesde"></div>
      <div class="col-md-2"><label class="form-label" for="reports-to">Hasta</label><input class="form-control" type="date" id="reports-to" name="fechaHasta"></div>
      <div class="col-md-2"><label class="form-label" for="reports-site">Sede</label><select class="form-select" id="reports-site" name="sedeId"><option value="">Todas</option></select></div>
      <div class="col-md-2"><label class="form-label" for="reports-shift">Turno</label><select class="form-select" id="reports-shift" name="turnoId"><option value="">Todos</option></select></div>
      <div class="col-md-2"><label class="form-label" for="reports-monitor">Monitora</label><select class="form-select" id="reports-monitor" name="monitoraId"><option value="">Todas</option></select></div>
      <div class="col-md-2"><label class="form-label" for="reports-person-type">Tipo de persona</label><select class="form-select" id="reports-person-type" name="tipoPersona"><option value="">Todos</option>${Object.entries(PERSON_TYPE_LABELS).map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select></div>
      <div class="col-12 d-flex gap-2"><button class="btn btn-primary" id="reports-apply" type="submit">Aplicar filtros</button><button class="btn btn-outline-secondary" id="reports-clear" type="button">Limpiar filtros</button></div>
    </form></section>
    <div id="reports-global-status" class="loading-state" aria-live="polite">Generando reporte...</div>
    <div class="report-metrics">${metric('Total de atenciones','report-total')}${metric('Estudiantes atendidos','report-students')}${metric('Docentes atendidos','report-teachers')}${metric('Personal administrativo atendido','report-staff')}${metric('Visitantes atendidos','report-visitors')}${metric('Referencias o traslados','report-referrals')}${metric('Productos entregados','report-delivered')}${metric('Productos con alerta','report-alert-products')}</div>
    <div class="report-grid">${chartPanel('report-month','Atenciones por mes',true)}${chartPanel('report-site','Atenciones por sede')}${chartPanel('report-shift','Atenciones por turno')}${chartPanel('report-person','Atenciones por tipo de persona')}${chartPanel('report-monitor','Atenciones por monitora')}${chartPanel('report-result','Resultado de las atenciones',true)}</div>
    <section class="data-panel report-wide"><h3>Medicamentos e insumos más utilizados</h3><div id="report-products-status" class="report-section-status" aria-live="polite"></div><div class="report-chart"><canvas id="report-products" role="img" aria-label="Medicamentos e insumos más utilizados"></canvas></div><div id="report-products-table"></div></section>
    <section class="data-panel"><h3>Alertas de inventario</h3><div id="report-inventory-status" class="report-section-status" aria-live="polite"></div><div class="metrics-grid metrics-four">${metric('Existencia baja','report-low')}${metric('Agotados','report-empty')}${metric('Próximos a vencer','report-expiring')}${metric('Vencidos','report-expired')}</div><div id="report-inventory-table"></div></section>
  </section>`
}

export const initReportesPage = async ({ session }) => {
  if (![ROLES.ADMINISTRADOR, ROLES.RRHH].includes(session?.profile?.rol)) return
  const root = document.querySelector('.reports-page'); if (!root) return
  const state = { loading: false, charts: {} }
  const $ = (id) => root.querySelector(`#${id}`)
  const filters = () => Object.fromEntries(new FormData($('reports-filters')))
  const colors = ['#0b5563','#c17c18','#557a46','#8a4f7d','#2f6fb0','#a64b3c','#667085','#1f8a70']
  const setText = (id, value) => { const element = $(id); if (element) element.textContent = value }
  const setSummary = (value = {}) => { setText('report-total', value.total ?? 0); setText('report-students', value.estudiantes ?? 0); setText('report-teachers', value.docentes ?? 0); setText('report-staff', value.administrativos ?? 0); setText('report-visitors', value.visitantes ?? 0); setText('report-referrals', value.referencias ?? 0); setText('report-delivered', formatQuantity(value.productosEntregados ?? 0)); setText('report-alert-products', value.productosAlerta ?? 0) }
  const sectionError = (id, error) => { safeError(error); setText(`${id}-status`, 'No fue posible generar esta sección del reporte.'); destroyChart(id) }
  const destroyChart = (id) => { state.charts[id]?.destroy(); delete state.charts[id] }
  const drawChart = (id, rows, config) => {
    destroyChart(id)
    const status = $(`${id}-status`); const canvas = $(id)
    if (!rows.length) { status.textContent = 'No hay datos para los filtros seleccionados.'; canvas.hidden = true; return }
    status.textContent = ''; canvas.hidden = false
    state.charts[id] = new Chart(canvas, { ...config, options: { responsive: true, maintainAspectRatio: false, animation: false, ...config.options, plugins: { legend: { labels: { usePointStyle: true } }, ...config.options?.plugins } } })
  }
  const barChart = (id, rows, label, horizontal = false, tooltipLabel) => drawChart(id, rows, { type: 'bar', data: { labels: rows.map((row) => row.label), datasets: [{ label, data: rows.map((row) => row.total), backgroundColor: colors, borderColor: '#173f49', borderWidth: 1 }] }, options: { indexAxis: horizontal ? 'y' : 'x', scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { beginAtZero: horizontal, ticks: horizontal ? { precision: 0 } : {} } }, plugins: tooltipLabel ? { tooltip: { callbacks: { label: tooltipLabel } } } : {} } })
  const doughnutChart = (id, rows, label) => {
    const total = rows.reduce((value, row) => value + row.total, 0)
    drawChart(id, rows, { type: 'doughnut', data: { labels: rows.map((row) => row.label), datasets: [{ label, data: rows.map((row) => row.total), backgroundColor: colors, borderColor: '#fff', borderWidth: 2 }] }, options: { plugins: { tooltip: { callbacks: { label: (context) => `${context.label}: ${context.parsed} (${formatPercentage(context.parsed, total)})` } } } } })
  }
  const renderProducts = (rows) => {
    const chartRows = rows.map((row) => ({ ...row, label: row.producto }))
    barChart('report-products', chartRows, 'Cantidad utilizada', true, (context) => { const row = rows[context.dataIndex]; return `${formatQuantity(row.total)} ${row.unidad || 'unidad'} · ${row.reutilizable ? 'Reutilizable' : 'Consumible'}` })
    $('report-products-table').innerHTML = rows.length ? `<div class="desktop-table mt-3"><table class="table align-middle"><thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th>Cantidad</th><th>Unidad</th><th>Tipo</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.codigo)}</td><td>${escapeHtml(row.producto)}</td><td>${escapeHtml(CATEGORY_LABELS[row.categoria] || row.categoria || 'No disponible')}</td><td>${formatQuantity(row.total)}</td><td>${escapeHtml(row.unidad || 'No disponible')}</td><td>${row.reutilizable ? 'Reutilizable' : 'Consumible'}</td></tr>`).join('')}</tbody></table></div>` : ''
  }
  const renderInventory = (value) => {
    setText('report-low', value.bajos); setText('report-empty', value.agotados); setText('report-expiring', value.proximos); setText('report-expired', value.vencidos)
    setText('report-inventory-status', value.alerts.length ? '' : 'No hay datos para los filtros seleccionados.')
    $('report-inventory-table').innerHTML = value.alerts.length ? `<div class="desktop-table"><table class="table align-middle"><thead><tr><th>Código</th><th>Producto</th><th>Sede</th><th>Existencia actual</th><th>Existencia mínima</th><th>Estado</th></tr></thead><tbody>${value.alerts.map((row) => `<tr><td>${escapeHtml(row.codigo)}</td><td>${escapeHtml(row.producto)}</td><td>${escapeHtml(row.sede)}</td><td>${formatQuantity(row.existencia_actual)}</td><td>${formatQuantity(row.existencia_minima)}</td><td><span class="status-badge status-${escapeHtml(row.estado_alerta)}">${escapeHtml(ALERT_LABELS[row.estado_alerta] || row.estado_alerta)}</span></td></tr>`).join('')}</tbody></table></div>` : ''
  }
  const populateCatalogs = async () => {
    const ids = ['reports-site','reports-shift','reports-monitor']; const empty = ['Todas','Todos','Todas']; const results = await getCatalogosReportes()
    results.forEach((result, index) => { const select = $(ids[index]); if (result.error) { safeError(result.error); select.disabled = true; select.innerHTML = '<option value="">No disponible</option>'; return } select.innerHTML = `<option value="">${empty[index]}</option>${result.data.map((item) => `<option value="${item.id}">${escapeHtml(item.nombre || item.nombre_completo)}</option>`).join('')}` })
  }
  const loadReports = async () => {
    if (state.loading) return
    state.loading = true; clearReportesCache(); setText('reports-global-status', 'Generando reporte...')
    const apply = $('reports-apply'); const refresh = $('reports-refresh'); apply.disabled = true; refresh.disabled = true; apply.textContent = 'Generando reporte...'
    try {
      const activeFilters = filters()
      const results = await Promise.allSettled([getResumenGeneral(activeFilters), getAtencionesPorMes(activeFilters), getAtencionesPorSede(activeFilters), getAtencionesPorTurno(activeFilters), getAtencionesPorTipoPersona(activeFilters), getAtencionesPorMonitora(activeFilters), getResultadosAtencion(activeFilters), getProductosMasUtilizados(activeFilters), getAlertasInventarioReporte({ sedeId: activeFilters.sedeId })])
      const [summary, month, site, shift, person, monitor, outcome, products, inventory] = results
      if (summary.status === 'fulfilled') setSummary(summary.value); else { setSummary(); safeError(summary.reason) }
      if (month.status === 'fulfilled') drawChart('report-month', month.value, { type: 'line', data: { labels: month.value.map((row) => formatMonthYear(row.year, row.month)), datasets: [{ label: 'Atenciones', data: month.value.map((row) => row.total), borderColor: colors[0], backgroundColor: 'rgba(11,85,99,.15)', pointRadius: 4, tension: .2, fill: true }] }, options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } }); else sectionError('report-month', month.reason)
      if (site.status === 'fulfilled') { const expected = [['Z3','SSO zona 3'],['Z9','SSO zona 9']]; barChart('report-site', expected.map(([key,label]) => ({ key, label, total: site.value.find((row) => row.key === key)?.total ?? 0 })), 'Atenciones') } else sectionError('report-site', site.reason)
      if (shift.status === 'fulfilled') { const expected = [['MAT','Matutino'],['VES','Vespertino']]; barChart('report-shift', expected.map(([key,label]) => ({ key, label, total: shift.value.find((row) => row.key === key)?.total ?? 0 })), 'Atenciones') } else sectionError('report-shift', shift.reason)
      if (person.status === 'fulfilled') doughnutChart('report-person', person.value.filter((row) => row.total > 0).map((row) => ({ ...row, label: PERSON_TYPE_LABELS[row.key] || row.key })), 'Atenciones'); else sectionError('report-person', person.reason)
      if (monitor.status === 'fulfilled') barChart('report-monitor', monitor.value.map((row) => ({ ...row, label: row.label })), 'Atenciones', true); else sectionError('report-monitor', monitor.reason)
      if (outcome.status === 'fulfilled') doughnutChart('report-result', outcome.value.filter((row) => row.total > 0).map((row) => ({ ...row, label: ATTENTION_RESULT_LABELS[row.key] || row.key })), 'Atenciones'); else sectionError('report-result', outcome.reason)
      if (products.status === 'fulfilled') renderProducts(products.value); else { sectionError('report-products', products.reason); $('report-products-table').innerHTML = '' }
      if (inventory.status === 'fulfilled') renderInventory(inventory.value); else { safeError(inventory.reason); setText('report-low', 0); setText('report-empty', 0); setText('report-expiring', 0); setText('report-expired', 0); $('report-inventory-table').innerHTML = ''; setText('report-inventory-status', 'No fue posible generar esta sección del reporte.') }
      setText('reports-global-status', results.every((result) => result.status === 'fulfilled') ? '' : 'Algunas secciones no pudieron generarse.')
    } catch (error) { safeError(error); setText('reports-global-status', 'No fue posible generar el reporte.') }
    finally { state.loading = false; apply.disabled = false; refresh.disabled = false; apply.textContent = 'Aplicar filtros' }
  }
  $('reports-filters').addEventListener('change', () => { Object.keys(state.charts).forEach(destroyChart); setText('reports-global-status', 'Filtros modificados. Presiona Aplicar filtros para actualizar.') })
  $('reports-filters').addEventListener('submit', (event) => { event.preventDefault(); loadReports() })
  $('reports-clear').addEventListener('click', () => { $('reports-filters').reset(); loadReports() })
  $('reports-refresh').addEventListener('click', loadReports)
  window.addEventListener('hashchange', () => Object.keys(state.charts).forEach(destroyChart), { once: true })
  await populateCatalogs()
  await loadReports()
}
