import { supabase } from '../config/supabase.js'
import { localDateBoundaryToIso, normalizeRelation } from '../utils/formatters.js'

const textOrNull = (value) => String(value ?? '').trim() || null
const numberOrNull = (value) => value === '' || value == null ? null : Number(value)

export const registrarAtencion = async (payload) => {
  const { data, error } = await supabase.rpc('registrar_atencion', {
    p_tipo_persona: payload.tipo_persona,
    p_nombre_persona: String(payload.nombre_persona || '').trim(),
    p_motivo_atencion: String(payload.motivo_atencion || '').trim(),
    p_atencion_realizada: String(payload.atencion_realizada || '').trim(),
    p_resultado: payload.resultado,
    p_productos: (payload.productos || []).map((item) => ({ producto_id: Number(item.producto_id), lote_id: item.lote_id ? Number(item.lote_id) : null, cantidad: Number(item.cantidad), observaciones: textOrNull(item.observaciones) })),
    p_fecha_hora: payload.fecha_hora,
    p_sede_id: payload.sede_id ? Number(payload.sede_id) : null,
    p_turno_id: payload.turno_id ? Number(payload.turno_id) : null,
    p_monitora_id: payload.monitora_id || null,
    p_identificacion_institucional: textOrNull(payload.identificacion_institucional),
    p_facultad_carrera_departamento: textOrNull(payload.facultad_carrera_departamento),
    p_telefono: textOrNull(payload.telefono),
    p_sintomas_referidos: textOrNull(payload.sintomas_referidos),
    p_presion_arterial: textOrNull(payload.presion_arterial),
    p_temperatura: numberOrNull(payload.temperatura),
    p_frecuencia_cardiaca: numberOrNull(payload.frecuencia_cardiaca),
    p_saturacion_oxigeno: numberOrNull(payload.saturacion_oxigeno),
    p_glucosa: numberOrNull(payload.glucosa),
    p_observaciones: textOrNull(payload.observaciones),
    p_resultado_otro: textOrNull(payload.resultado_otro),
  })
  if (error) throw error
  const record = Array.isArray(data) ? data[0] : data
  if (!record?.id || !record?.codigo) throw new Error('La atención fue procesada, pero no se recibió su código.')
  return { id: record.id, codigo: record.codigo }
}

export const getAtencionesDelDia = async () => {
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' })
  const { count, error } = await supabase.from('atenciones').select('id', { count: 'exact', head: true }).gte('fecha_hora', `${day}T00:00:00-06:00`).lte('fecha_hora', `${day}T23:59:59-06:00`)
  if (error) throw error
  return count || 0
}

const ATTENTION_LIST_FIELDS = `
  id, codigo, fecha_hora, sede_id, turno_id, monitora_id, tipo_persona, nombre_persona,
  identificacion_institucional, facultad_carrera_departamento, motivo_atencion, resultado, resultado_otro,
  sede:sedes!atenciones_sede_id_fkey(id, codigo, nombre),
  turno:turnos!atenciones_turno_id_fkey(id, codigo, nombre),
  monitora:perfiles!atenciones_monitora_id_fkey(id, nombre_completo)
`

const ATTENTION_DETAIL_FIELDS = `
  ${ATTENTION_LIST_FIELDS}, telefono, sintomas_referidos, presion_arterial, temperatura,
  frecuencia_cardiaca, saturacion_oxigeno, glucosa, atencion_realizada, observaciones
`

const sanitizeSearch = (value) => String(value || '').trim().replace(/[(),.*%'"\\]/g, ' ').replace(/\s+/g, ' ')
const applyAttentionFilters = (query, { fechaDesde, fechaHasta, sedeId, turnoId, monitoraId, tipoPersona, resultado, busqueda } = {}) => {
  const fromIso = localDateBoundaryToIso(fechaDesde); const toIso = localDateBoundaryToIso(fechaHasta, true)
  if (fromIso) query = query.gte('fecha_hora', fromIso)
  if (toIso) query = query.lte('fecha_hora', toIso)
  if (sedeId) query = query.eq('sede_id', sedeId)
  if (turnoId) query = query.eq('turno_id', turnoId)
  if (monitoraId) query = query.eq('monitora_id', monitoraId)
  if (tipoPersona) query = query.eq('tipo_persona', tipoPersona)
  if (resultado) query = query.eq('resultado', resultado)
  const term = sanitizeSearch(busqueda)
  if (term) query = query.or(`codigo.ilike.*${term}*,nombre_persona.ilike.*${term}*,identificacion_institucional.ilike.*${term}*,facultad_carrera_departamento.ilike.*${term}*,motivo_atencion.ilike.*${term}*`)
  return query
}

const normalizeAttention = ({ sede, turno, monitora, ...item }) => ({
  ...item,
  sede: normalizeRelation(sede) ?? { nombre: 'No disponible' },
  turno: normalizeRelation(turno) ?? { nombre: 'No disponible' },
  monitora: normalizeRelation(monitora) ?? { nombre_completo: 'Sin identificar' },
})

export const getAtenciones = async ({ limite = 20, offset = 0, ...filters } = {}) => {
  let query = supabase.from('atenciones').select(ATTENTION_LIST_FIELDS, { count: 'exact' })
  query = applyAttentionFilters(query, filters)
  const { data, error, count } = await query.order('fecha_hora', { ascending: false }).range(offset, offset + limite - 1)
  if (error) throw error
  const registros = Array.isArray(data) ? data : []
  const total = Number.isFinite(count) ? count : 0
  console.info('[Atenciones] registros recibidos', registros.length)
  return { data: registros.map(normalizeAttention), count: total, limite, offset }
}

export const getAtencionPorId = async (atencionId) => {
  if (!/^\d+$/.test(String(atencionId || ''))) return null
  const { data, error } = await supabase.from('atenciones').select(`${ATTENTION_DETAIL_FIELDS},
    detalles:detalle_atencion!detalle_atencion_atencion_id_fkey(
      id, cantidad, observaciones, lote_id,
      producto:productos!detalle_atencion_producto_id_fkey(id, codigo, nombre, categoria, presentacion, unidad_medida, unidad_dispensacion, es_consumible, permite_registro_sin_descuento),
      lote:lotes!detalle_atencion_lote_id_fkey(id, numero_lote, fecha_vencimiento, estado)
    )`).eq('id', atencionId).maybeSingle()
  if (error) throw error
  if (!data) return null
  const normalized = normalizeAttention(data)
  normalized.detalles = (normalized.detalles || []).map(({ producto, lote, ...detail }) => ({ ...detail, producto: normalizeRelation(producto), lote: normalizeRelation(lote) }))
  return normalized
}

export const getResumenAtenciones = async (filters = {}) => {
  const count = async (extra = {}) => {
    let query = supabase.from('atenciones').select('id', { count: 'exact', head: true })
    query = applyAttentionFilters(query, { ...filters, ...extra, busqueda: null, resultado: extra.resultado })
    const { count: total, error } = await query
    if (error) throw error
    return total || 0
  }
  const [total, estudiantes, docentes, administrativos, referencias] = await Promise.all([
    count(), count({ tipoPersona: 'estudiante' }), count({ tipoPersona: 'docente' }), count({ tipoPersona: 'administrativo' }),
    (async () => { let query = supabase.from('atenciones').select('id', { count: 'exact', head: true }); query = applyAttentionFilters(query, { ...filters, busqueda: null, resultado: null }).in('resultado', ['referido_clinica', 'traslado_hospital']); const { count: totalCount, error } = await query; if (error) throw error; return totalCount || 0 })(),
  ])
  return { total, estudiantes, docentes, administrativos, referencias }
}

export const getCatalogosHistorial = async () => {
  const results = await Promise.allSettled([
    supabase.from('sedes').select('id, codigo, nombre').eq('activa', true).order('nombre'),
    supabase.from('turnos').select('id, codigo, nombre').eq('activo', true).order('nombre'),
    supabase.from('perfiles').select('id, nombre_completo').eq('activo', true).eq('rol', 'monitora').order('nombre_completo'),
  ])
  return results.map((result) => result.status === 'fulfilled' && !result.value.error ? { data: result.value.data || [], error: null } : { data: [], error: result.status === 'fulfilled' ? result.value.error : result.reason })
}

export const atencionesService = Object.freeze({ registrarAtencion, getAtencionesDelDia, getAtenciones, getAtencionPorId, getResumenAtenciones, getCatalogosHistorial })
