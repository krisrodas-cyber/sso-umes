import { supabase } from '../config/supabase.js'
import { localDateBoundaryToIso, normalizeRelation } from '../utils/formatters.js'

const attentionCache = new Map()
const productCache = new Map()

const cacheKey = (filters = {}) => JSON.stringify(filters, Object.keys(filters).sort())
const safeRows = (data) => Array.isArray(data) ? data : []
const sum = (rows, selector) => rows.reduce((total, row) => total + Number(selector(row) || 0), 0)
const group = (rows, selector) => {
  const totals = new Map()
  rows.forEach((row) => {
    const item = selector(row)
    if (!item?.key) return
    const current = totals.get(item.key) ?? { ...item, total: 0 }
    current.total += Number(item.value ?? 1)
    totals.set(item.key, current)
  })
  return [...totals.values()]
}

const applyAttentionFilters = (query, filters = {}, relationPrefix = '') => {
  const column = (name) => `${relationPrefix}${name}`
  const fromIso = localDateBoundaryToIso(filters.fechaDesde)
  const toIso = localDateBoundaryToIso(filters.fechaHasta, true)
  if (fromIso) query = query.gte(column('fecha_hora'), fromIso)
  if (toIso) query = query.lte(column('fecha_hora'), toIso)
  if (filters.sedeId) query = query.eq(column('sede_id'), filters.sedeId)
  if (filters.turnoId) query = query.eq(column('turno_id'), filters.turnoId)
  if (filters.monitoraId) query = query.eq(column('monitora_id'), filters.monitoraId)
  if (filters.tipoPersona) query = query.eq(column('tipo_persona'), filters.tipoPersona)
  return query
}

const getAttentionRows = (filters = {}) => {
  const key = cacheKey(filters)
  if (!attentionCache.has(key)) attentionCache.set(key, (async () => {
    let query = supabase.from('atenciones').select(`
      id, fecha_hora, sede_id, turno_id, monitora_id, tipo_persona, resultado,
      sede:sedes!atenciones_sede_id_fkey(id, codigo, nombre),
      turno:turnos!atenciones_turno_id_fkey(id, codigo, nombre),
      monitora:perfiles!atenciones_monitora_id_fkey(id, nombre_completo)
    `)
    query = applyAttentionFilters(query, filters)
    const { data, error } = await query.order('fecha_hora', { ascending: true })
    if (error) throw error
    return safeRows(data).map(({ sede, turno, monitora, ...row }) => ({ ...row, sede: normalizeRelation(sede), turno: normalizeRelation(turno), monitora: normalizeRelation(monitora) }))
  })())
  return attentionCache.get(key)
}

const getProductRows = (filters = {}) => {
  const key = cacheKey(filters)
  if (!productCache.has(key)) productCache.set(key, (async () => {
    let query = supabase.from('detalle_atencion').select(`
      cantidad,
      producto:productos!detalle_atencion_producto_id_fkey(id, codigo, nombre, categoria, unidad_medida, unidad_dispensacion, es_consumible, permite_registro_sin_descuento),
      atencion:atenciones!detalle_atencion_atencion_id_fkey!inner(fecha_hora, sede_id, turno_id, monitora_id, tipo_persona)
    `)
    query = applyAttentionFilters(query, filters, 'atencion.')
    const { data, error } = await query
    if (error) throw error
    return safeRows(data).map(({ producto, ...row }) => ({ ...row, producto: normalizeRelation(producto) }))
  })())
  return productCache.get(key)
}

export const clearReportesCache = () => { attentionCache.clear(); productCache.clear() }

export const getCatalogosReportes = async () => {
  const results = await Promise.allSettled([
    supabase.from('sedes').select('id, codigo, nombre').eq('activa', true).order('nombre'),
    supabase.from('turnos').select('id, codigo, nombre').eq('activo', true).order('nombre'),
    supabase.from('perfiles').select('id, nombre_completo').eq('activo', true).eq('rol', 'monitora').order('nombre_completo'),
  ])
  return results.map((result) => result.status === 'fulfilled' && !result.value.error
    ? { data: safeRows(result.value.data), error: null }
    : { data: [], error: result.status === 'fulfilled' ? result.value.error : result.reason })
}

export const getAlertasInventarioReporte = async ({ sedeId } = {}) => {
  let alertsQuery = supabase.from('vista_inventario_alertas').select('producto_id, codigo, producto, categoria, sede_id, sede, existencia_actual, existencia_minima, estado_alerta').in('estado_alerta', ['bajo', 'agotado'])
  let expiryQuery = supabase.from('vista_lotes_vencimiento').select('lote_id, producto, sede, fecha_vencimiento, cantidad_disponible, estado_vencimiento').in('estado_vencimiento', ['vence_30_dias', 'vence_90_dias', 'vencido'])
  const siteQuery = sedeId ? supabase.from('sedes').select('nombre').eq('id', sedeId).maybeSingle() : Promise.resolve({ data: null, error: null })
  if (sedeId) alertsQuery = alertsQuery.eq('sede_id', sedeId)
  const [alertsResult, expiryResult, siteResult] = await Promise.all([alertsQuery, expiryQuery, siteQuery])
  if (alertsResult.error) throw alertsResult.error
  if (expiryResult.error) throw expiryResult.error
  if (siteResult.error) throw siteResult.error
  const alerts = safeRows(alertsResult.data).sort((a, b) => ({ agotado: 0, bajo: 1 }[a.estado_alerta] - { agotado: 0, bajo: 1 }[b.estado_alerta] || String(a.producto).localeCompare(String(b.producto), 'es')))
  const expiry = safeRows(expiryResult.data).filter((row) => !sedeId || row.sede === siteResult.data?.nombre)
  return {
    alerts,
    expiry,
    bajos: alerts.filter((row) => row.estado_alerta === 'bajo').length,
    agotados: alerts.filter((row) => row.estado_alerta === 'agotado').length,
    proximos: expiry.filter((row) => ['vence_30_dias', 'vence_90_dias'].includes(row.estado_vencimiento)).length,
    vencidos: expiry.filter((row) => row.estado_vencimiento === 'vencido').length,
  }
}

export const getResumenGeneral = async (filters = {}) => {
  const rows = await getAttentionRows(filters)
  const [productsResult, inventoryResult] = await Promise.allSettled([getProductRows(filters), getAlertasInventarioReporte({ sedeId: filters.sedeId })])
  const products = productsResult.status === 'fulfilled' ? productsResult.value : []
  const inventory = inventoryResult.status === 'fulfilled' ? inventoryResult.value : { bajos: 0, agotados: 0 }
  return {
    total: rows.length,
    estudiantes: rows.filter((row) => row.tipo_persona === 'estudiante').length,
    docentes: rows.filter((row) => row.tipo_persona === 'docente').length,
    administrativos: rows.filter((row) => row.tipo_persona === 'administrativo').length,
    visitantes: rows.filter((row) => row.tipo_persona === 'visitante').length,
    referencias: rows.filter((row) => ['referido_clinica', 'traslado_hospital'].includes(row.resultado)).length,
    productosEntregados: sum(products, (row) => row.cantidad),
    productosAlerta: inventory.bajos + inventory.agotados,
  }
}

export const getAtencionesPorMes = async (filters = {}) => group(await getAttentionRows(filters), (row) => {
  const date = new Date(row.fecha_hora)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit' }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return { key: `${year}-${month}`, year: Number(year), month: Number(month) }
}).sort((a, b) => a.key.localeCompare(b.key))

export const getAtencionesPorSede = async (filters = {}) => group(await getAttentionRows(filters), (row) => ({ key: row.sede?.codigo ?? String(row.sede_id), label: row.sede?.nombre ?? 'No disponible' }))
export const getAtencionesPorTurno = async (filters = {}) => group(await getAttentionRows(filters), (row) => ({ key: row.turno?.codigo ?? String(row.turno_id), label: row.turno?.nombre ?? 'No disponible' }))
export const getAtencionesPorTipoPersona = async (filters = {}) => group(await getAttentionRows(filters), (row) => ({ key: row.tipo_persona }))
export const getAtencionesPorMonitora = async (filters = {}) => group(await getAttentionRows(filters), (row) => ({ key: String(row.monitora_id), label: row.monitora?.nombre_completo ?? 'Sin identificar' })).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'es'))
export const getResultadosAtencion = async (filters = {}) => group(await getAttentionRows(filters), (row) => ({ key: row.resultado }))

export const getProductosMasUtilizados = async (filters = {}) => group(await getProductRows(filters), (row) => {
  const product = row.producto
  if (!product) return null
  return { key: String(product.id), value: row.cantidad, codigo: product.codigo, producto: product.nombre, categoria: product.categoria, unidad: product.unidad_dispensacion || product.unidad_medida, reutilizable: !product.es_consumible || product.permite_registro_sin_descuento }
}).sort((a, b) => b.total - a.total || a.producto.localeCompare(b.producto, 'es')).slice(0, 10)

export const reportesService = Object.freeze({ clearReportesCache, getCatalogosReportes, getResumenGeneral, getAtencionesPorMes, getAtencionesPorSede, getAtencionesPorTurno, getAtencionesPorTipoPersona, getAtencionesPorMonitora, getResultadosAtencion, getProductosMasUtilizados, getAlertasInventarioReporte })
