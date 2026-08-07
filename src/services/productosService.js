import { supabase } from '../config/supabase.js'

const throwIfError = (error) => { if (error) throw error }
const clean = (value) => String(value ?? '').trim()

export const getProductosCatalogo = async ({ incluirInactivos = false } = {}) => {
  let query = supabase.from('productos').select('id, codigo, nombre, categoria, presentacion, unidad_medida, unidad_dispensacion, es_consumible, permite_registro_sin_descuento, estado').order('nombre')
  if (!incluirInactivos) query = query.eq('estado', 'activo')
  const { data, error } = await query
  throwIfError(error)
  return data || []
}

const productParams = (product) => ({
  p_codigo: clean(product.codigo).toUpperCase(),
  p_nombre: clean(product.nombre),
  p_categoria: product.categoria || null,
  p_presentacion: clean(product.presentacion) || null,
  p_unidad_medida: clean(product.unidadMedida),
  p_unidad_dispensacion: clean(product.unidadDispensacion) || null,
  p_es_consumible: Boolean(product.esConsumible),
  p_permite_registro_sin_descuento: Boolean(product.permiteSinDescuento),
  p_activo: Boolean(product.activo),
})

export const crearProducto = async (product) => {
  const { data, error } = await supabase.rpc('crear_producto_inventario', productParams(product))
  throwIfError(error)
  return data
}

export const actualizarProductoAdministrador = async (product) => {
  const { data, error } = await supabase.rpc('actualizar_producto_administrador', { p_producto_id: product.productoId, ...productParams(product) })
  throwIfError(error)
  return data
}

export const actualizarProductoOperativo = async (product) => {
  const { data, error } = await supabase.rpc('actualizar_producto_operativo', {
    p_producto_id: product.productoId,
    p_nombre: clean(product.nombre),
    p_categoria: product.categoria || null,
    p_presentacion: clean(product.presentacion) || null,
    p_unidad_medida: clean(product.unidadMedida),
    p_unidad_dispensacion: clean(product.unidadDispensacion) || null,
  })
  throwIfError(error)
  return data
}

export const cambiarEstadoProducto = async (productoId, activo) => {
  const { data, error } = await supabase.rpc('cambiar_estado_producto_inventario', { p_producto_id: productoId, p_activo: Boolean(activo) })
  throwIfError(error)
  return data
}

