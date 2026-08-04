import Swal from 'sweetalert2'
import { ROLES } from '../utils/constants.js'
import { toLocalDateTimeInput, localDateTimeToIso, formatDate } from '../utils/formatters.js'
import { validateAtencion } from '../utils/validators.js'
import { registrarAtencion } from '../services/atencionesService.js'
import { getCatalogosAtencion, getInventarioDisponiblePorSede, getLotesDisponibles } from '../services/inventarioService.js'

const escapeHtml = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
const option = (item) => `<option value="${item.id}">${escapeHtml(item.nombre)}${item.codigo ? ` (${escapeHtml(item.codigo)})` : ''}</option>`
const input = (id, label, attrs = '', col = 'col-md-6') => `<div class="${col}"><label class="form-label" for="${id}">${label}</label><input class="form-control" id="${id}" name="${id}" ${attrs}><div class="invalid-feedback" data-error-for="${id}"></div></div>`
const textarea = (id, label, required = false) => `<div class="col-12"><label class="form-label" for="${id}">${label}${required ? ' *' : ''}</label><textarea class="form-control" id="${id}" name="${id}" rows="3"></textarea><div class="invalid-feedback" data-error-for="${id}"></div></div>`

export const nuevaAtencionPage = ({ session }) => {
  const profile = session.profile
  const isAdmin = profile.rol === ROLES.ADMINISTRADOR
  return `<section class="attention-page" data-role="${profile.rol}">
    <div class="page-heading"><div><p class="eyebrow">Registro</p><h2>Nueva atención</h2></div></div>
    <div id="attention-loading" class="attention-loading">Cargando datos del formulario…</div>
    <form id="attention-form" class="d-none" novalidate>
      <section class="form-section"><h3>A. Información del registro</h3><div class="row g-3">
        ${input('fecha_hora', 'Fecha y hora *', `type="datetime-local" value="${toLocalDateTimeInput()}" required`, 'col-md-6')}
        <div class="col-md-6"><label class="form-label" for="monitora_id">Monitora o responsable *</label><select class="form-select" id="monitora_id" name="monitora_id" ${isAdmin ? '' : 'disabled'}><option value="${profile.id}">${escapeHtml(profile.nombre_completo)}</option></select><div class="invalid-feedback" data-error-for="monitora_id"></div></div>
        <div class="col-md-6"><label class="form-label" for="sede_id">Sede *</label><select class="form-select" id="sede_id" name="sede_id" ${isAdmin ? '' : 'disabled'}><option value="">Cargando…</option></select><div class="invalid-feedback" data-error-for="sede_id"></div></div>
        <div class="col-md-6"><label class="form-label" for="turno_id">Turno *</label><select class="form-select" id="turno_id" name="turno_id" ${isAdmin ? '' : 'disabled'}><option value="">Cargando…</option></select><div class="invalid-feedback" data-error-for="turno_id"></div></div>
      </div></section>
      <section class="form-section"><h3>B. Persona atendida</h3><div class="row g-3">
        <div class="col-md-6"><label class="form-label" for="tipo_persona">Tipo de persona *</label><select class="form-select" id="tipo_persona" name="tipo_persona"><option value="">Seleccionar</option><option value="estudiante">Estudiante</option><option value="docente">Docente</option><option value="administrativo">Administrativo</option><option value="visitante">Visitante</option></select><div class="invalid-feedback" data-error-for="tipo_persona"></div></div>
        ${input('nombre_persona', 'Nombre completo *', 'type="text" autocomplete="off"', 'col-md-6')}
        ${input('identificacion_institucional', 'Carné, código o identificación institucional', 'type="text" autocomplete="off"', 'col-md-6')}
        ${input('facultad_carrera_departamento', 'Facultad, carrera o departamento', 'type="text" autocomplete="off"', 'col-md-6')}
        ${input('telefono', 'Teléfono', 'type="tel" autocomplete="off"', 'col-md-6')}
      </div></section>
      <section class="form-section"><h3>C. Detalle de la atención</h3><div class="row g-3">
        ${textarea('motivo_atencion', 'Motivo de atención', true)}${textarea('sintomas_referidos', 'Síntomas referidos')}
        ${input('presion_arterial', 'Presión arterial', 'type="text" placeholder="Ej. 120/80"')}
        ${input('temperatura', 'Temperatura (°C)', 'type="number" step="0.1" min="25" max="45"')}
        ${input('frecuencia_cardiaca', 'Frecuencia cardíaca', 'type="number" min="20" max="250"')}
        ${input('saturacion_oxigeno', 'Saturación de oxígeno (%)', 'type="number" min="0" max="100"')}
        ${input('glucosa', 'Glucosa', 'type="number" step="0.01" min="0"')}
        ${textarea('atencion_realizada', 'Atención realizada', true)}${textarea('observaciones', 'Observaciones')}
        <div class="col-md-6"><label class="form-label" for="resultado">Resultado *</label><select class="form-select" id="resultado" name="resultado"><option value="">Seleccionar</option><option value="atendido_retirado">Atendido y retirado</option><option value="reposo">Reposo</option><option value="referido_clinica">Referido a clínica</option><option value="traslado_hospital">Traslado a hospital</option><option value="aviso_familiar">Aviso a familiar</option><option value="otro">Otro</option></select><div class="invalid-feedback" data-error-for="resultado"></div></div>
        <div class="col-md-6 d-none" id="resultado-otro-group"><label class="form-label" for="resultado_otro">Especifica el resultado *</label><input class="form-control" id="resultado_otro" name="resultado_otro"><div class="invalid-feedback" data-error-for="resultado_otro"></div></div>
      </div></section>
      <section class="form-section"><div class="section-title"><div><h3>D. Medicamentos e insumos utilizados</h3><p class="text-muted small">Opcional. Solo se muestran existencias disponibles en la sede seleccionada.</p></div><button class="btn btn-outline-primary" id="add-product" type="button">Agregar medicamento o insumo</button></div><div id="inventory-status" class="small text-muted"></div><div id="product-list" class="product-list"></div></section>
      <div class="form-actions"><button class="btn btn-primary btn-lg" id="save-attention" type="submit">Guardar atención</button></div>
    </form></section>`
}

const friendlyError = (error) => {
  const message = error?.message || 'Error de conexión'
  const known = ['Usuario no autorizado', 'El administrador debe indicar sede y turno', 'Debe seleccionarse un lote', 'Inventario insuficiente', 'Cantidad insuficiente en lote', 'inexistente o inactivo', 'inválido para producto y sede', 'La monitora solo puede registrar', 'El responsable debe', 'Perfil no encontrado']
  const match = known.find((text) => message.toLowerCase().includes(text.toLowerCase()))
  if (match) return message.replace(/^.*?message[:=]\s*/i, '')
  if (/fetch|network|connection/i.test(message)) return 'Error de conexión. Verifica tu red e inténtalo nuevamente.'
  return message.length < 240 ? message : 'No fue posible registrar la atención. Inténtalo nuevamente.'
}

export const initNuevaAtencionPage = async ({ session }) => {
  const form = document.querySelector('#attention-form')
  if (!form) return
  const profile = session.profile
  const isAdmin = profile.rol === ROLES.ADMINISTRADOR
  let catalogs; let inventory = []; let products = []; let submitting = false
  const $ = (id) => form.querySelector(`#${id}`)
  const setOptions = (select, items, placeholder) => { select.innerHTML = `<option value="">${placeholder}</option>${items.map(option).join('')}` }
  const loadInventory = async () => {
    const sedeId = $('sede_id').value
    inventory = []; $('add-product').disabled = true
    $('inventory-status').textContent = sedeId ? 'Consultando inventario…' : 'Selecciona una sede para consultar inventario.'
    products = []; renderProducts()
    if (!sedeId) return
    try { inventory = await getInventarioDisponiblePorSede(sedeId); $('inventory-status').textContent = inventory.length ? `${inventory.length} producto(s) con existencia disponible.` : 'No hay inventario disponible en esta sede.'; $('add-product').disabled = !inventory.length }
    catch (error) { $('inventory-status').textContent = friendlyError(error) }
  }
  const renderProducts = () => {
    $('product-list').innerHTML = products.map((row, index) => `<article class="product-card" data-index="${index}">
      <div class="row g-3"><div class="col-lg-4"><label class="form-label">Producto *</label><select class="form-select product-select"><option value="">Seleccionar</option>${inventory.map((p) => `<option value="${p.producto_id}" ${String(row.producto_id) === String(p.producto_id) ? 'selected' : ''}>${escapeHtml(p.codigo)} · ${escapeHtml(p.nombre)} · ${escapeHtml(p.presentacion || 'Sin presentación')} · ${escapeHtml(p.unidad_medida)} (${p.existencia_actual})</option>`).join('')}</select><div class="invalid-feedback" data-row-error="producto-${index}"></div></div>
      <div class="col-lg-3"><label class="form-label">Lote *</label><select class="form-select lot-select" ${row.loadingLotes || !row.producto_id || !row.lotes?.length ? 'disabled' : ''}><option value="">${row.loadingLotes ? 'Consultando lotes…' : row.producto_id && row.lotes?.length === 0 ? 'Producto sin lotes registrados' : 'Seleccionar lote'}</option>${(row.lotes || []).map((lot) => `<option value="${lot.id}" ${String(row.lote_id) === String(lot.id) ? 'selected' : ''}>${escapeHtml(lot.numero_lote || 'Sin número')} · vence ${formatDate(lot.fecha_vencimiento)} · ${lot.cantidad_disponible}</option>`).join('')}</select><div class="invalid-feedback" data-row-error="producto-${index}-lote"></div></div>
      <div class="col-6 col-lg-2"><label class="form-label">Existencia</label><input class="form-control" value="${row.existencia_actual ?? '—'}" readonly></div><div class="col-6 col-lg-2"><label class="form-label">Cantidad *</label><input class="form-control quantity" type="number" min="0.01" step="0.01" value="${escapeHtml(row.cantidad || '')}"><div class="invalid-feedback" data-row-error="producto-${index}-cantidad"></div></div>
      <div class="col-lg-10"><label class="form-label">Observaciones</label><input class="form-control product-notes" value="${escapeHtml(row.observaciones || '')}"></div><div class="col-lg-2 d-flex align-items-end"><button class="btn btn-outline-danger remove-product w-100" type="button">Eliminar</button></div></div></article>`).join('')
  }
  try {
    catalogs = await getCatalogosAtencion()
    setOptions($('sede_id'), catalogs.sedes, 'Seleccionar sede'); setOptions($('turno_id'), catalogs.turnos, 'Seleccionar turno')
    if (isAdmin) setOptions($('monitora_id'), catalogs.responsables, 'Seleccionar responsable')
    else { $('sede_id').value = profile.sede_id || ''; $('turno_id').value = profile.turno_id || '' }
    document.querySelector('#attention-loading').classList.add('d-none'); form.classList.remove('d-none'); await loadInventory()
  } catch (error) { document.querySelector('#attention-loading').textContent = `No fue posible cargar el formulario: ${friendlyError(error)}`; return }

  $('monitora_id').addEventListener('change', async () => {
    const selected = catalogs.responsables.find((item) => item.id === $('monitora_id').value)
    const lock = selected?.rol === ROLES.MONITORA
    $('sede_id').disabled = lock; $('turno_id').disabled = lock
    if (lock) { $('sede_id').value = selected.sede_id; $('turno_id').value = selected.turno_id }
    else { $('sede_id').value = ''; $('turno_id').value = '' }
    await loadInventory()
  })
  $('sede_id').addEventListener('change', loadInventory)
  $('tipo_persona').addEventListener('change', () => { const labels = { estudiante: 'Carné', docente: 'Código de docente', administrativo: 'Código o identificación', visitante: 'Identificación' }; form.querySelector('label[for="identificacion_institucional"]').textContent = labels[$('tipo_persona').value] || 'Carné, código o identificación institucional' })
  $('resultado').addEventListener('change', () => { $('resultado-otro-group').classList.toggle('d-none', $('resultado').value !== 'otro'); if ($('resultado').value !== 'otro') $('resultado_otro').value = '' })
  $('add-product').addEventListener('click', () => { products.push({ producto_id: '', lote_id: null, cantidad: '', observaciones: '', lotes: [], hasLotes: false }); renderProducts() })
  $('product-list').addEventListener('input', (event) => { const card = event.target.closest('.product-card'); if (!card) return; const row = products[Number(card.dataset.index)]; if (event.target.matches('.quantity')) row.cantidad = event.target.value; if (event.target.matches('.product-notes')) row.observaciones = event.target.value })
  $('product-list').addEventListener('change', async (event) => {
    const card = event.target.closest('.product-card'); if (!card) return
    const index = Number(card.dataset.index); const row = products[index]
    if (event.target.matches('.product-select')) {
      const item = inventory.find((p) => String(p.producto_id) === event.target.value)
      Object.assign(row, { producto_id: event.target.value, lote_id: null, existencia_actual: item?.existencia_actual, lotes: [], loadingLotes: true, hasLotes: false }); renderProducts()
      try { row.lotes = await getLotesDisponibles(row.producto_id, $('sede_id').value); row.hasLotes = row.lotes.length > 0 } catch (error) { row.lotes = []; await Swal.fire({ icon: 'error', title: 'No fue posible consultar lotes', text: friendlyError(error) }) }
      row.loadingLotes = false; renderProducts()
    } else if (event.target.matches('.lot-select')) { row.lote_id = event.target.value || null; row.loteCantidad = row.lotes.find((lot) => String(lot.id) === event.target.value)?.cantidad_disponible; }
  })
  $('product-list').addEventListener('click', (event) => { if (!event.target.matches('.remove-product')) return; products.splice(Number(event.target.closest('.product-card').dataset.index), 1); renderProducts() })

  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (submitting) return
    const values = Object.fromEntries(new FormData(form)); values.productos = products; values.fecha_hora = localDateTimeToIso(values.fecha_hora)
    if (isAdmin) { values.sede_id = $('sede_id').value; values.turno_id = $('turno_id').value; values.monitora_id = $('monitora_id').value }
    if (!isAdmin) { values.sede_id = null; values.turno_id = null; values.monitora_id = null }
    form.querySelectorAll('.is-invalid').forEach((node) => node.classList.remove('is-invalid'))
    const errors = validateAtencion(values, { isAdmin })
    Object.entries(errors).forEach(([field, message]) => { const normal = form.querySelector(`[name="${field}"]`); const rowError = form.querySelector(`[data-row-error="${field}"]`); const errorNode = form.querySelector(`[data-error-for="${field}"]`) || rowError; (normal || rowError?.previousElementSibling)?.classList.add('is-invalid'); if (errorNode) errorNode.textContent = message })
    if (Object.keys(errors).length || !values.fecha_hora) { await Swal.fire({ icon: 'warning', title: 'Revisa el formulario', text: 'Hay campos incompletos o valores que deben corregirse.' }); form.querySelector('.is-invalid')?.focus(); return }
    const confirmation = await Swal.fire({ icon: 'question', title: '¿Deseas registrar esta atención?', text: 'Después no podrá editarse.', showCancelButton: true, confirmButtonText: 'Sí, registrar', cancelButtonText: 'Cancelar' })
    if (!confirmation.isConfirmed) return
    submitting = true; const button = $('save-attention'); button.disabled = true; button.textContent = 'Guardando atención…'
    try {
      const result = await registrarAtencion(values)
      await Swal.fire({ icon: 'success', title: 'Atención registrada correctamente', text: `Código: ${result.codigo}` })
      const preserved = { monitora: $('monitora_id').value, sede: $('sede_id').value, turno: $('turno_id').value }
      form.reset(); products = []; renderProducts(); $('fecha_hora').value = toLocalDateTimeInput(); $('resultado-otro-group').classList.add('d-none')
      $('monitora_id').value = preserved.monitora; $('sede_id').value = preserved.sede; $('turno_id').value = preserved.turno; await loadInventory()
    } catch (error) { await Swal.fire({ icon: 'error', title: 'No fue posible registrar la atención', text: friendlyError(error) }) }
    finally { submitting = false; button.disabled = false; button.textContent = 'Guardar atención' }
  })
}
