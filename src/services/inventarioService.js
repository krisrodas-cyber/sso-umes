import { supabase } from '../config/supabase.js'

const throwIfError = (error) => { if (error) throw error }

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

export const inventarioService = Object.freeze({ getInventarioDisponiblePorSede, getLotesDisponibles, getCatalogosAtencion })
