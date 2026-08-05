import { supabase } from '../config/supabase.js'
import { localDateBoundaryToIso, normalizeRelation } from '../utils/formatters.js'

const throwIfError = (error) => { if (error) throw error }

export const getSedesActivas = async () => {
  const { data, error } = await supabase.from('sedes').select('id, codigo, nombre').eq('activa', true).order('nombre')
  throwIfError(error)
  return data || []
}

export const getInventarioDisponiblePorSede = async (sedeId) => {
  if (!sedeId) return []
  const { data, error } = await supabase
    .from('inventario_sede')
    .select('producto_id, sede_id, existencia_actual, existencia_minima, productos!inner(id, codigo, nombre, categoria, presentacion, unidad_medida, estado, es_consumible, contenido_por_presentacion, unidad_dispensacion, permite_registro_sin_descuento)')
    .eq('sede_id', sedeId)
    .eq('productos.estado', 'activo')
    .order('producto_id')
  throwIfError(error)
  return (data || [])
    .map(({ productos, ...item }) => ({ ...item, ...productos }))
    .filter((item) => Number(item.existencia_actual) > 0 || !item.es_consumible || item.permite_registro_sin_descuento)
}

export const getLotesDisponibles = async (productoId, sedeId) => {
  if (!productoId || !sedeId) return []
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' })
  const { data, error } = await supabase
    .from('lotes')
    .select('id, producto_id, sede_id, numero_lote, fecha_vencimiento, cantidad_disponible, estado')
    .eq('producto_id', productoId)
    .eq('sede_id', sedeId)
    .in('estado', ['disponible', 'en_uso'])
    .gt('cantidad_disponible', 0)
    .or(`fecha_vencimiento.is.null,fecha_vencimiento.gte.${today}`)
    .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
  throwIfError(error)
  return data || []
}

export const getCatalogosAtencion = async () => {
  const [sedes, turnos, responsables] = await Promise.all([
    supabase.from('sedes').select('id, codigo, nombre').eq('activa', true).order('nombre'),
    supabase.from('turnos').select('id, codigo, nombre').eq('activo', true).order('nombre'),
    supabase.from('perfiles').select('id, nombre_completo, rol, sede_id, turno_id').eq('activo', true).in('rol', ['monitora', 'administrador']).order('nombre_completo'),
  ])
  throwIfError(sedes.error); throwIfError(turnos.error); throwIfError(responsables.error)
  return { sedes: sedes.data || [], turnos: turnos.data || [], responsables: responsables.data || [] }
}

const normalizeInventory = (rows = []) => rows.map(({ productos, sedes, ...item }) => ({
  ...item,
  codigo: productos?.codigo,
  nombre: productos?.nombre,
  categoria: productos?.categoria,
  presentacion: productos?.presentacion,
  unidad_medida: productos?.unidad_medida,
  unidad_dispensacion: productos?.unidad_dispensacion,
  es_consumible: productos?.es_consumible,
  permite_registro_sin_descuento: productos?.permite_registro_sin_descuento,
  sede: sedes?.nombre,
  codigo_sede: sedes?.codigo,
  estado_alerta: Number(item.existencia_actual) === 0 ? 'agotado' : Number(item.existencia_actual) <= Number(item.existencia_minima) ? 'bajo' : 'normal',
}))

export const getInventario = async ({ sedeId, categoria, estadoAlerta, tipoControl, busqueda } = {}) => {
  let query = supabase.from('inventario_sede').select('producto_id, sede_id, existencia_actual, existencia_minima, productos!inner(codigo, nombre, categoria, presentacion, unidad_medida, unidad_dispensacion, es_consumible, permite_registro_sin_descuento, estado), sedes!inner(codigo, nombre)').eq('productos.estado', 'activo')
  if (sedeId) query = query.eq('sede_id', sedeId)
  if (categoria) query = query.eq('productos.categoria', categoria)
  const { data, error } = await query.order('producto_id')
  throwIfError(error)
  const term = String(busqueda || '').trim().toLocaleLowerCase('es')
  return normalizeInventory(data).filter((item) => {
    if (estadoAlerta && item.estado_alerta !== estadoAlerta) return false
    const reusable = !item.es_consumible || item.permite_registro_sin_descuento
    if (tipoControl === 'consumible' && reusable) return false
    if (tipoControl === 'reutilizable' && !reusable) return false
    return !term || `${item.codigo} ${item.nombre}`.toLocaleLowerCase('es').includes(term)
  }).sort((a, b) => (({ agotado: 0, bajo: 1, normal: 2 })[a.estado_alerta] - ({ agotado: 0, bajo: 1, normal: 2 })[b.estado_alerta] || a.nombre.localeCompare(b.nombre, 'es')))
}

const getExpiryState = (date) => {
  if (!date) return 'sin_fecha'
  const todayText = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' })
  const today = new Date(`${todayText}T00:00:00Z`); const expiry = new Date(`${date}T00:00:00Z`)
  const days = Math.ceil((expiry - today) / 86400000)
  return days < 0 ? 'vencido' : days <= 30 ? 'vence_30_dias' : days <= 90 ? 'vence_90_dias' : 'vigente'
}

export const getLotesVencimiento = async ({ sedeId, estadoVencimiento } = {}) => {
  let query = supabase.from('lotes').select('id, producto_id, sede_id, numero_lote, fecha_vencimiento, cantidad_disponible, estado, productos!inner(codigo, nombre), sedes!inner(codigo, nombre)')
  if (sedeId) query = query.eq('sede_id', sedeId)
  const { data, error } = await query.order('fecha_vencimiento', { ascending: true, nullsFirst: false })
  throwIfError(error)
  return (data || []).map(({ productos, sedes, ...lot }) => ({ ...lot, producto: productos?.nombre, codigo_producto: productos?.codigo, sede: sedes?.nombre, codigo_sede: sedes?.codigo, estado_vencimiento: getExpiryState(lot.fecha_vencimiento) }))
    .filter((lot) => !estadoVencimiento || lot.estado_vencimiento === estadoVencimiento)
    .sort((a, b) => (({ vencido: 0, vence_30_dias: 1, vence_90_dias: 2, vigente: 3, sin_fecha: 4 })[a.estado_vencimiento] - ({ vencido: 0, vence_30_dias: 1, vence_90_dias: 2, vigente: 3, sin_fecha: 4 })[b.estado_vencimiento]))
}

export const getResumenInventario = async (sedeId) => {
  const [items, lots] = await Promise.all([getInventario({ sedeId }), getLotesVencimiento({ sedeId })])
  const alerts = items.filter((item) => ['agotado', 'bajo'].includes(item.estado_alerta))
  return {
    total: items.length,
    disponibles: items.filter((item) => item.estado_alerta === 'normal').length,
    bajos: items.filter((item) => item.estado_alerta === 'bajo').length,
    agotados: items.filter((item) => item.estado_alerta === 'agotado').length,
    proximosVencer: lots.filter((lot) => ['vence_30_dias', 'vence_90_dias'].includes(lot.estado_vencimiento)).length,
    reutilizables: items.filter((item) => !item.es_consumible || item.permite_registro_sin_descuento).length,
    alertas: alerts.slice(0, 5),
  }
}

export const getAlertasInventario = async (sedeId) => {
  const [items, lots] = await Promise.all([getInventario({ sedeId }), getLotesVencimiento({ sedeId })])
  return { inventario: items.filter((item) => ['agotado', 'bajo'].includes(item.estado_alerta)), vencimientos: lots.filter((lot) => ['vencido', 'vence_30_dias'].includes(lot.estado_vencimiento)) }
}

export const getMovimientosInventario = async ({ sedeId, productoId, tipoMovimiento, fechaDesde, fechaHasta, limite = 20, offset = 0, codigoAtencion, busqueda } = {}) => {
  const searchTerm = String(busqueda ?? '').trim()
  const attentionCode = String(codigoAtencion ?? '').trim().toUpperCase()
  let productMatches = null
  if (searchTerm) {
    const term = searchTerm.replace(/[(),]/g, ' ')
    const { data, error } = await supabase.from('productos').select('id').or(`codigo.ilike.%${term}%,nombre.ilike.%${term}%`)
    throwIfError(error); productMatches = (data || []).map((item) => item.id)
  }
  let attentionMatches = null
  if (attentionCode) {
    const { data, error } = await supabase.from('atenciones').select('id').eq('codigo', attentionCode).maybeSingle()
    throwIfError(error)
    if (data === null) return { data: [], count: 0, limite, offset }
    attentionMatches = [data.id]
  }
  let query = supabase.from('movimientos_inventario').select(`
    id,
    created_at,
    producto_id,
    sede_id,
    lote_id,
    atencion_id,
    tipo,
    cantidad,
    existencia_anterior,
    existencia_posterior,
    usuario_id,
    observaciones,
    producto:productos!movimientos_inventario_producto_id_fkey(codigo, nombre, categoria, unidad_medida),
    sede:sedes!movimientos_inventario_sede_id_fkey(codigo, nombre),
    atencion:atenciones!movimientos_inventario_atencion_id_fkey(codigo),
    responsable:perfiles!movimientos_inventario_usuario_id_fkey(nombre_completo)
  `, { count: 'exact' })
  if (sedeId) query = query.eq('sede_id', sedeId)
  if (productoId) query = query.eq('producto_id', productoId)
  if (tipoMovimiento) query = query.eq('tipo', tipoMovimiento)
  if (String(fechaDesde ?? '').trim()) {
    const fromIso = localDateBoundaryToIso(fechaDesde)
    if (fromIso) query = query.gte('created_at', fromIso)
  }
  if (String(fechaHasta ?? '').trim()) {
    const toIso = localDateBoundaryToIso(fechaHasta, true)
    if (toIso) query = query.lte('created_at', toIso)
  }
  if (attentionMatches) query = query.in('atencion_id', attentionMatches)
  if (searchTerm) {
    const safeTerm = searchTerm.replace(/[(),]/g, ' ')
    query = productMatches.length ? query.or(`observaciones.ilike.%${safeTerm}%,producto_id.in.(${productMatches.join(',')})`) : query.ilike('observaciones', `%${safeTerm}%`)
  }
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(offset, offset + limite - 1)
  if (error) throw error
  const rows = (Array.isArray(data) ? data : []).map(({ producto, sede, atencion, responsable, ...item }) => {
    const normalizedProduct = normalizeRelation(producto)
    const normalizedSite = normalizeRelation(sede)
    const normalizedAttention = normalizeRelation(atencion)
    const normalizedResponsible = normalizeRelation(responsable)
    return {
      ...item,
      codigo_producto: normalizedProduct?.codigo ?? 'No disponible',
      producto: normalizedProduct?.nombre ?? 'No disponible',
      categoria_producto: normalizedProduct?.categoria ?? null,
      unidad_medida: normalizedProduct?.unidad_medida ?? null,
      codigo_sede: normalizedSite?.codigo ?? null,
      sede: normalizedSite?.nombre ?? 'No disponible',
      codigo_atencion: normalizedAttention?.codigo ?? null,
      responsable: normalizedResponsible?.nombre_completo ?? 'Sin identificar',
    }
  })
  return { data: rows, count: Number.isFinite(count) ? count : 0, limite, offset }
}

export const inventarioService = Object.freeze({ getSedesActivas, getInventarioDisponiblePorSede, getLotesDisponibles, getCatalogosAtencion, getInventario, getResumenInventario, getAlertasInventario, getLotesVencimiento, getMovimientosInventario })
