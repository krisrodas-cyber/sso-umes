export const formatDate = (value, locale = 'es-GT') => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(locale).format(date)
}
export const formatNumber = (value, locale = 'es-GT') => new Intl.NumberFormat(locale).format(Number(value) || 0)
export const capitalize = (value = '') => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()

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
