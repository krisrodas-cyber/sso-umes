import { Modal } from 'bootstrap'
import { ROLES } from '../utils/constants.js'
import { getAtenciones, getAtencionPorId, getResumenAtenciones, getCatalogosHistorial } from '../services/atencionesService.js'
import { formatAttentionResult, formatCategory, formatDate, formatDateTime, formatEmpty, formatPersonType, formatProductControl, formatQuantity } from '../utils/formatters.js'

const escapeHtml = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
const safeError = (error) => console.error({ name: error?.name ?? 'Error', code: error?.code ?? null, message: error?.message ?? 'Error desconocido', details: error?.details ?? null, hint: error?.hint ?? null })
const metric = (label, id) => `<article class="metric-card"><span>${label}</span><strong id="${id}">0</strong></article>`
const value = (content, unit = '') => `${escapeHtml(formatEmpty(content))}${content != null && String(content).trim() !== '' && unit ? ` ${unit}` : ''}`
const detailItem = (label, content, unit = '') => `<div><dt>${label}</dt><dd>${value(content, unit)}</dd></div>`

export const atencionesPage = ({ session }) => {
  const monitor = session.profile.rol === ROLES.MONITORA
  return `<section class="data-page attentions-page"><div class="page-heading data-heading"><div><p class="eyebrow">Consulta</p><h2>Historial de atenciones</h2><p class="text-muted">Registros disponibles según tu perfil. Este módulo es exclusivamente de lectura.</p>${monitor ? '<small id="monitor-context">Cargando sede y turno…</small>' : ''}</div><button class="btn btn-outline-primary" id="attentions-refresh" type="button">Actualizar</button></div>
    <div class="metrics-grid metrics-five">${metric('Total de atenciones','attention-total')}${metric('Atenciones de estudiantes','attention-students')}${metric('Atenciones de docentes','attention-teachers')}${metric('Personal administrativo','attention-staff')}${metric('Referencias o traslados','attention-referrals')}</div>
    <section class="data-panel"><h3>Filtros</h3><form id="attention-history-filters" class="row g-3">
      <div class="col-md-3"><label class="form-label" for="history-from">Desde</label><input class="form-control" type="date" id="history-from" name="fechaDesde"></div><div class="col-md-3"><label class="form-label" for="history-to">Hasta</label><input class="form-control" type="date" id="history-to" name="fechaHasta"></div>
      ${monitor ? '' : '<div class="col-md-3"><label class="form-label" for="history-site">Sede</label><select class="form-select" id="history-site" name="sedeId"><option value="">Todas</option></select></div><div class="col-md-3"><label class="form-label" for="history-shift">Turno</label><select class="form-select" id="history-shift" name="turnoId"><option value="">Todos</option></select></div><div class="col-md-3"><label class="form-label" for="history-monitor">Monitora</label><select class="form-select" id="history-monitor" name="monitoraId"><option value="">Todas</option></select></div>'}
      <div class="col-md-3"><label class="form-label" for="history-person-type">Tipo de persona</label><select class="form-select" id="history-person-type" name="tipoPersona"><option value="">Todos</option><option value="estudiante">Estudiante</option><option value="docente">Docente</option><option value="administrativo">Administrativo</option><option value="visitante">Visitante</option><option value="operativo">Operativo</option></select></div>
      <div class="col-md-3"><label class="form-label" for="history-result">Resultado</label><select class="form-select" id="history-result" name="resultado"><option value="">Todos</option><option value="atendido_retirado">Atendido y retirado</option><option value="reposo">Reposo</option><option value="referido_clinica">Referido a clínica</option><option value="traslado_hospital">Traslado a hospital</option><option value="aviso_familiar">Aviso a familiar</option><option value="otro">Otro</option></select></div>
      <div class="col-md-6"><label class="form-label" for="history-search">Búsqueda general</label><input class="form-control" id="history-search" name="busqueda" placeholder="Código, persona, identificación, facultad o motivo" autocomplete="off"></div>
      <div class="col-12 d-flex gap-2"><button class="btn btn-primary" id="history-apply" type="submit">Aplicar filtros</button><button class="btn btn-outline-secondary" id="history-clear" type="button">Limpiar filtros</button></div>
    </form></section>
    <section class="data-panel"><div id="history-status" class="loading-state" aria-live="polite">Consultando atenciones…</div><div id="history-results"></div><div id="history-pagination" class="pagination-bar"></div></section>
    <div class="modal fade" id="attention-detail-modal" tabindex="-1" aria-labelledby="attention-detail-title" aria-hidden="true"><div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><h2 class="modal-title fs-5" id="attention-detail-title">Detalle de atención</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar detalle"></button></div><div class="modal-body" id="attention-detail-body" aria-live="polite"></div><div class="modal-footer"><button type="button" class="btn btn-primary" data-bs-dismiss="modal">Cerrar</button></div></div></div></div>
  </section>`
}

const renderDetail = (attention) => {
  const products = attention.detalles || []
  return `<div class="detail-header"><h3>${escapeHtml(attention.codigo)}</h3><p>${formatDateTime(attention.fecha_hora)} · ${escapeHtml(attention.sede?.nombre || 'No registrado')} · ${escapeHtml(attention.turno?.nombre || 'No registrado')} · ${escapeHtml(attention.monitora?.nombre_completo || 'No registrado')}</p></div>
  <section class="detail-section"><h3>A. Persona atendida</h3><dl class="detail-grid">${detailItem('Tipo de persona', formatPersonType(attention.tipo_persona))}${detailItem('Nombre completo', attention.nombre_persona)}${detailItem('Identificación institucional', attention.identificacion_institucional)}${detailItem('Facultad, carrera o departamento', attention.facultad_carrera_departamento)}${detailItem('Teléfono', attention.telefono)}</dl></section>
  <section class="detail-section"><h3>B. Motivo y atención</h3><dl class="detail-grid">${detailItem('Motivo de atención', attention.motivo_atencion)}${detailItem('Síntomas referidos', attention.sintomas_referidos)}${detailItem('Atención realizada', attention.atencion_realizada)}${detailItem('Observaciones', attention.observaciones)}${detailItem('Resultado', formatAttentionResult(attention.resultado))}${attention.resultado === 'otro' ? detailItem('Detalle de otro resultado', attention.resultado_otro) : ''}</dl></section>
  <section class="detail-section"><h3>C. Signos vitales</h3><dl class="detail-grid vital-grid">${detailItem('Presión arterial', attention.presion_arterial)}${detailItem('Temperatura', attention.temperatura, '°C')}${detailItem('Frecuencia cardíaca', attention.frecuencia_cardiaca, 'lpm')}${detailItem('Saturación de oxígeno', attention.saturacion_oxigeno, '%')}${detailItem('Glucosa', attention.glucosa, 'mg/dL')}</dl></section>
  <section class="detail-section"><h3>D. Medicamentos e insumos utilizados</h3>${products.length ? `<div class="detail-products">${products.map((item) => `<article class="detail-product"><h4>${escapeHtml(item.producto?.codigo || '—')} · ${escapeHtml(item.producto?.nombre || 'Producto no disponible')}</h4><p>${formatCategory(item.producto?.categoria)} · ${formatProductControl(item.producto)}</p><dl class="detail-grid">${detailItem('Cantidad', formatQuantity(item.cantidad), item.producto?.unidad_dispensacion || item.producto?.unidad_medida || '')}${detailItem('Presentación', item.producto?.presentacion)}${detailItem('Lote', item.lote?.numero_lote)}${detailItem('Vencimiento', item.lote?.fecha_vencimiento ? formatDate(item.lote.fecha_vencimiento) : null)}${detailItem('Estado del lote', item.lote?.estado)}${detailItem('Observaciones', item.observaciones)}</dl></article>`).join('')}</div>` : '<p class="empty-inline">No se registraron medicamentos o insumos en esta atención.</p>'}</section>`
}

export const initAtencionesPage = async ({ session }) => {
  console.info('[Atenciones] inicio de initAtenciones')
  const root = document.querySelector('.attentions-page'); if (!root) return
  const monitor = session.profile.rol === ROLES.MONITORA; const limit = 20
  let page = 1; let loading = false; let detailTrigger = null
  const $ = (id) => root.querySelector(`#${id}`)
  const modalElement = $('attention-detail-modal'); const detailModal = new Modal(modalElement, { backdrop: true, keyboard: true, focus: true })
  const filters = () => Object.fromEntries(new FormData($('attention-history-filters')))
  const summaryFilters = () => { const { fechaDesde, fechaHasta, sedeId, turnoId, monitoraId } = filters(); return { fechaDesde, fechaHasta, sedeId, turnoId, monitoraId } }
  const renderRows = (result) => {
    const total = Number.isFinite(result.count) ? result.count : 0
    const totalPages = Math.ceil(total / limit)
    $('history-status').textContent = total ? `${total} atención(es) encontradas.` : 'No hay atenciones que coincidan con los filtros.'
    $('history-results').innerHTML = result.data.length ? `<div class="desktop-table"><table class="table align-middle"><thead><tr><th>Código</th><th>Fecha y hora</th><th>Persona</th><th>Tipo</th><th>Sede</th><th>Turno</th><th>Monitora</th><th>Motivo</th><th>Resultado</th><th>Acción</th></tr></thead><tbody>${result.data.map((x) => `<tr><td>${escapeHtml(x.codigo)}</td><td>${formatDateTime(x.fecha_hora)}</td><td>${escapeHtml(x.nombre_persona)}</td><td>${formatPersonType(x.tipo_persona)}</td><td>${escapeHtml(x.sede?.nombre || '—')}</td><td>${escapeHtml(x.turno?.nombre || '—')}</td><td>${escapeHtml(x.monitora?.nombre_completo || '—')}</td><td class="text-wrap">${escapeHtml(x.motivo_atencion)}</td><td>${formatAttentionResult(x.resultado)}</td><td><button class="btn btn-sm btn-outline-primary view-attention" type="button" data-id="${x.id}" aria-label="Ver detalle de ${escapeHtml(x.codigo)}">Ver detalle</button></td></tr>`).join('')}</tbody></table></div><div class="mobile-cards">${result.data.map((x) => `<article class="data-card"><h4>${escapeHtml(x.codigo)} · ${escapeHtml(x.nombre_persona)}</h4><p>${formatDateTime(x.fecha_hora)} · ${escapeHtml(x.sede?.nombre || '—')}</p><dl><div><dt>Motivo</dt><dd>${escapeHtml(x.motivo_atencion)}</dd></div><div><dt>Resultado</dt><dd>${formatAttentionResult(x.resultado)}</dd></div></dl><button class="btn btn-outline-primary view-attention" type="button" data-id="${x.id}" aria-label="Ver detalle de ${escapeHtml(x.codigo)}">Ver detalle</button></article>`).join('')}</div>` : ''
    $('history-pagination').innerHTML = `<span>${total} registro(s) · Página ${totalPages ? page : 0} de ${totalPages}</span>${totalPages > 1 ? `<button class="btn btn-sm btn-outline-secondary" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>Anterior</button><button class="btn btn-sm btn-outline-secondary" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>Siguiente</button>` : ''}`
  }
  const renderSummary = (summary) => { $('attention-total').textContent = summary.total; $('attention-students').textContent = summary.estudiantes; $('attention-teachers').textContent = summary.docentes; $('attention-staff').textContent = summary.administrativos; $('attention-referrals').textContent = summary.referencias }
  const resetSummary = () => renderSummary({ total: 0, estudiantes: 0, docentes: 0, administrativos: 0, referencias: 0 })
  const load = async () => {
    if (loading) return
    console.info('[Atenciones] inicio de loadAtenciones')
    loading = true
    const applyButton = $('history-apply'); const previousApplyText = applyButton.textContent
    $('attentions-refresh').disabled = true; applyButton.disabled = true; applyButton.textContent = 'Consultando...'; $('history-status').textContent = 'Consultando atenciones…'
    try {
      const activeFilters = filters()
      const limite = limit
      const offset = (page - 1) * limite
      const [listResult, summaryResult] = await Promise.allSettled([
        getAtenciones({ ...activeFilters, limite, offset }),
        getResumenAtenciones(summaryFilters()),
      ])
      if (listResult.status === 'fulfilled') renderRows(listResult.value)
      else { safeError(listResult.reason); $('history-status').textContent = 'No fue posible consultar el historial de atenciones.'; $('history-results').innerHTML = ''; $('history-pagination').innerHTML = '' }
      if (summaryResult.status === 'fulfilled') renderSummary(summaryResult.value)
      else { safeError(summaryResult.reason); resetSummary() }
    } catch (error) {
      safeError(error); resetSummary(); $('history-status').textContent = 'No fue posible consultar el historial de atenciones.'; $('history-results').innerHTML = ''; $('history-pagination').innerHTML = ''
    } finally {
      loading = false; $('attentions-refresh').disabled = false; applyButton.disabled = false; applyButton.textContent = previousApplyText
    }
  }
  const openDetail = async (button) => {
    detailTrigger = button; $('attention-detail-title').textContent = 'Detalle de atención'; $('attention-detail-body').innerHTML = '<p class="loading-state">Consultando esta atención…</p>'; detailModal.show()
    try { const attention = await getAtencionPorId(button.dataset.id); if (!attention) throw new Error('Atención no disponible'); $('attention-detail-title').textContent = `Detalle ${attention.codigo}`; $('attention-detail-body').innerHTML = renderDetail(attention) } catch (error) { safeError(error); $('attention-detail-body').innerHTML = '<div class="alert alert-danger" role="alert">No fue posible consultar esta atención.</div>' }
  }
  if (!monitor) {
    const ids = ['history-site','history-shift','history-monitor']; const placeholders = ['Todas','Todos','Todas']; const [sites, shifts, monitors] = await getCatalogosHistorial(); [sites, shifts, monitors].forEach((result, index) => { const select = $(ids[index]); if (result.error) { safeError(result.error); select.disabled = true; select.innerHTML = `<option value="">No disponible</option>`; return } select.innerHTML = `<option value="">${placeholders[index]}</option>${result.data.map((x) => `<option value="${x.id}">${escapeHtml(x.nombre || x.nombre_completo)}</option>`).join('')}` })
  } else {
    const [sites, shifts] = (await getCatalogosHistorial()).slice(0, 2); const site = sites.data.find((x) => String(x.id) === String(session.profile.sede_id)); const shift = shifts.data.find((x) => String(x.id) === String(session.profile.turno_id)); $('monitor-context').textContent = `Sede: ${site?.nombre || 'No disponible'} · Turno: ${shift?.nombre || 'No disponible'}`; if (sites.error) safeError(sites.error); if (shifts.error) safeError(shifts.error)
  }
  $('attention-history-filters').addEventListener('submit', (event) => { event.preventDefault(); page = 1; load() }); $('attentions-refresh').addEventListener('click', load); $('history-clear').addEventListener('click', () => { $('attention-history-filters').reset(); page = 1; load() }); $('history-pagination').addEventListener('click', (event) => { if (!event.target.dataset.page) return; page = Number(event.target.dataset.page); load() }); $('history-results').addEventListener('click', (event) => { const button = event.target.closest('.view-attention'); if (button) openDetail(button) })
  modalElement.addEventListener('hidden.bs.modal', () => { $('attention-detail-title').textContent = 'Detalle de atención'; $('attention-detail-body').replaceChildren(); detailTrigger?.focus(); detailTrigger = null })
  await load()
}
