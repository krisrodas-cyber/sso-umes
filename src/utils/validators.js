export const isRequired = (value) => String(value ?? '').trim().length > 0
export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())
export const hasMinLength = (value, length) => String(value ?? '').length >= length
export const validateProduct = (data, { admin = false } = {}) => {
  const errors = {}
  if (admin && !isRequired(data.codigo)) errors.codigo = 'El código es obligatorio.'
  if (!isRequired(data.nombre)) errors.nombre = 'El nombre es obligatorio.'
  if (!isRequired(data.categoria)) errors.categoria = 'La categoría es obligatoria.'
  if (!isRequired(data.unidadMedida)) errors.unidadMedida = 'La unidad de medida es obligatoria.'
  return errors
}
export const validatePositiveQuantity = (value) => Number.isFinite(Number(value)) && Number(value) > 0
export const validateNonNegativeQuantity = (value) => Number.isFinite(Number(value)) && Number(value) >= 0
export const validateStrongPassword = (value) => {
  const password = String(value ?? '')
  const common = ['12345', '123456', 'password', 'contraseña', 'admin123', 'qwerty']
  return password.length >= 12 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password) && !common.includes(password.toLocaleLowerCase('es'))
}

const inRange = (value, min, max) => value === '' || value == null || (Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max)
export const validateAtencion = (data, { isAdmin = false } = {}) => {
  const errors = {}
  ;['tipo_persona', 'nombre_persona', 'motivo_atencion', 'atencion_realizada', 'resultado'].forEach((field) => {
    if (!isRequired(data[field])) errors[field] = 'Este campo es obligatorio.'
  })
  if (data.resultado === 'otro' && !isRequired(data.resultado_otro)) errors.resultado_otro = 'Describe el resultado.'
  if (!inRange(data.temperatura, 25, 45)) errors.temperatura = 'Debe estar entre 25 y 45 °C.'
  if (!inRange(data.frecuencia_cardiaca, 20, 250)) errors.frecuencia_cardiaca = 'Debe estar entre 20 y 250.'
  if (!inRange(data.saturacion_oxigeno, 0, 100)) errors.saturacion_oxigeno = 'Debe estar entre 0 y 100 %.'
  if (!inRange(data.glucosa, 0, Number.MAX_SAFE_INTEGER)) errors.glucosa = 'No puede ser negativa.'
  if (data.telefono && !/^[\d\s()+.-]{6,25}$/.test(data.telefono.trim())) errors.telefono = 'Ingresa un teléfono válido.'
  if (isAdmin) ['sede_id', 'turno_id', 'monitora_id'].forEach((field) => { if (!data[field]) errors[field] = 'Este campo es obligatorio.' })
  const keys = new Set()
  data.productos.forEach((item, index) => {
    const prefix = `producto-${index}`
    if (!item.producto_id) errors[prefix] = 'Selecciona un producto.'
    if (!item.sinDescuento && item.hasLotes && !item.lote_id) errors[`${prefix}-lote`] = 'Selecciona un lote.'
    const quantity = Number(item.cantidad)
    if (!Number.isFinite(quantity) || quantity <= 0) errors[`${prefix}-cantidad`] = 'La cantidad debe ser mayor que cero.'
    else if (!item.sinDescuento && quantity > Number(item.existencia_actual)) errors[`${prefix}-cantidad`] = 'Supera la existencia disponible.'
    else if (!item.sinDescuento && item.lote_id && quantity > Number(item.loteCantidad)) errors[`${prefix}-cantidad`] = 'Supera la cantidad disponible del lote.'
    const key = `${item.producto_id}:${item.lote_id || 'sin-lote'}`
    if (item.producto_id && keys.has(key)) errors[prefix] = 'El producto y lote están repetidos.'
    keys.add(key)
  })
  return errors
}
