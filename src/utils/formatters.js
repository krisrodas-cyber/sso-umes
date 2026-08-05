export const formatDate = (value, locale = 'es-GT') => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(locale).format(date)
}
export const formatNumber = (value, locale = 'es-GT') => new Intl.NumberFormat(locale).format(Number(value) || 0)
export const formatQuantity = (value, locale = 'es-GT') => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(value) || 0)
export const formatPercentage = (value, total, locale = 'es-GT') => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(total ? Number(value) / Number(total) : 0)
export const formatMonthYear = (year, month, locale = 'es-GT') => {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1))
  if (Number.isNaN(date.getTime())) return 'No disponible'
  const label = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date).replace('.', '')
  return label.charAt(0).toUpperCase() + label.slice(1)
}
export const formatDateTime = (value, locale = 'es-GT') => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(locale, { timeZone: 'America/Guatemala', dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
export const CATEGORY_LABELS = Object.freeze({ medicamento: 'Medicamento', insumo: 'Insumo' })
export const MOVEMENT_LABELS = Object.freeze({ inventario_inicial: 'Inventario inicial', ingreso: 'Ingreso', salida_atencion: 'Salida por atención', ajuste_positivo: 'Ajuste positivo', ajuste_negativo: 'Ajuste negativo', vencimiento: 'Vencimiento', traslado_entrada: 'Traslado de entrada', traslado_salida: 'Traslado de salida' })
export const ALERT_LABELS = Object.freeze({ normal: 'Normal', bajo: 'Existencia baja', agotado: 'Agotado' })
export const EXPIRY_LABELS = Object.freeze({ vencido: 'Vencido', vence_30_dias: 'Vence en 30 días', vence_90_dias: 'Vence en 90 días', vigente: 'Vigente', sin_fecha: 'Sin fecha registrada' })
export const PERSON_TYPE_LABELS = Object.freeze({ estudiante: 'Estudiante', docente: 'Docente', administrativo: 'Administrativo', visitante: 'Visitante' })
export const ATTENTION_RESULT_LABELS = Object.freeze({ atendido_retirado: 'Atendido y retirado', reposo: 'Reposo', referido_clinica: 'Referido a clínica', traslado_hospital: 'Traslado a hospital', aviso_familiar: 'Aviso a familiar', otro: 'Otro' })
export const formatCategory = (value) => CATEGORY_LABELS[value] || value || '—'
export const formatMovementType = (value) => MOVEMENT_LABELS[value] || value || '—'
export const formatAlertState = (value) => ALERT_LABELS[value] || value || '—'
export const formatExpiryState = (value) => EXPIRY_LABELS[value] || value || '—'
export const formatPersonType = (value) => PERSON_TYPE_LABELS[value] || value || 'No registrado'
export const formatAttentionResult = (value) => ATTENTION_RESULT_LABELS[value] || value || 'No registrado'
export const formatEmpty = (value) => value == null || String(value).trim() === '' ? 'No registrado' : String(value)
export const formatProductControl = (product) => !product?.es_consumible || product?.permite_registro_sin_descuento ? 'Reutilizable / sin descuento' : 'Consumible'
export const capitalize = (value = '') => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()

export const normalizeRelation = (value) => {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export const toLocalDateTimeInput = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

export const localDateTimeToIso = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || '')) return null
  const date = new Date(`${value}:00-06:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export const localDateBoundaryToIso = (value, endOfDay = false) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null
  const time = endOfDay ? '23:59:59.999' : '00:00:00.000'
  const date = new Date(`${value}T${time}-06:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
