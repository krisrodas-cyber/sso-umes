export const formatDate = (value, locale = 'es-GT') => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(locale).format(date)
}
export const formatNumber = (value, locale = 'es-GT') => new Intl.NumberFormat(locale).format(Number(value) || 0)
export const capitalize = (value = '') => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
