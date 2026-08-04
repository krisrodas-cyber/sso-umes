import fs from 'node:fs'
import path from 'node:path'
import XLSX from 'xlsx'

const ROOT = process.cwd()
const SOURCE = path.join(ROOT, 'data', 'origen', 'Inventario Clinica 2.xlsx')
const OUT = path.join(ROOT, 'data', 'procesado')
const SQL_PATH = path.join(ROOT, 'supabase', 'seed', '002_productos_inventario.sql')
const CUTOFF_DATE = '2026-08-04'
const SHEETS = [
  { name: 'Inventario Medicamento', headerRow: 2, category: 'medicamento', prefix: 'MED', minCol: null, stocks: [{ sede: 'Z9', col: 6 }, { sede: 'Z3', col: 8 }] },
  { name: 'Inventario Insumo', headerRow: 3, category: 'insumo', prefix: 'INS', minCol: 5, stocks: [{ sede: 'Z9', col: 7 }, { sede: 'Z3', col: 9 }] },
]

const trim = (value) => value == null ? '' : String(value).trim().replace(/\s+/g, ' ')
const csvValue = (value) => {
  if (value == null) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
const writeCsv = (name, headers, rows) => fs.writeFileSync(path.join(OUT, name), `${headers.join(',')}\n${rows.map((row) => headers.map((key) => csvValue(row[key])).join(',')).join('\n')}\n`, 'utf8')
const sqlText = (value) => value == null || value === '' ? 'null' : `'${String(value).replaceAll("'", "''")}'`
const sqlNumber = (value) => value === '' || value == null ? 'null' : String(value)
const sqlBool = (value) => value ? 'true' : 'false'
const addPending = (list, row, type, field, original, proposed, reason, action, sede = '') => list.push({
  tipo_revision: type, hoja: row.sheet, fila: row.sourceRow, codigo_producto: row.code || '', producto: row.name || '', sede,
  campo: field, valor_original: original == null ? '' : String(original), valor_propuesto: proposed == null ? '' : String(proposed), motivo: reason, accion_requerida: action,
})

const presentationPatterns = [
  [/\bTABLETAS?\b/i, 'tableta'], [/\bAMPOLLAS?\b/i, 'ampolla'], [/\bFRASCOS?\b/i, 'frasco'],
  [/\bCOMPRIMIDOS?\b/i, 'comprimido'], [/\bC[ÁA]PSULAS?\b/i, 'cápsula'], [/\bSOBRES?\b/i, 'sobre'],
  [/\bCREMAS?\b/i, 'crema'], [/\bGEL\b/i, 'gel'], [/\bVIALES?\b/i, 'vial'],
  [/\bGAL[ÓO]N(?:ES)?\b/i, 'galón'], [/\bCAJAS?\b/i, 'caja'], [/\bROLLOS?\b/i, 'rollo'], [/\bUNIDADES?\b/i, 'unidad'],
]
const inferPresentation = (name) => presentationPatterns.find(([regex]) => regex.test(name))?.[1] || null
const inferContent = (name) => {
  const matches = [...name.matchAll(/(?:CAJA\s*(?:DE|[-–])?\s*)?(\d+(?:[.,]\d+)?)\s+(TABLETAS?|COMPRIMIDOS?|C[ÁA]PSULAS?|UNIDADES|SOBRES|CARAMELOS|AMPOLLAS?)\b/gi)]
  if (!matches.length) return { content: 1, unit: inferPresentation(name) || 'unidad', identified: false }
  const last = matches.at(-1)
  const unit = last[2].toLowerCase().replace(/s$/, '').replace('tableta', 'tableta').replace('unidade', 'unidad').replace('ampolla', 'ampolla')
  return { content: Number(last[1].replace(',', '.')), unit, identified: true }
}
const classifyConsumption = (name) => {
  if (/\b(TIJERA|F[ÉE]RULA|CABESTRILLO)\b/i.test(name) || /\b(BAUMAN[ÓO]METRO|ESTETOSCOPIO|TERM[ÓO]METRO|OX[ÍI]METRO|NEBULIZADOR|BANDEJA|PINZA)\b/i.test(name) || /\bEQUIPO\b.*\bREUTILIZABLE\b/i.test(name)) {
    return { consumable: false, noDiscount: true, criterion: 'Clasificado como reutilizable según regla institucional definitiva.' }
  }
  return { consumable: true, noDiscount: false, criterion: 'Consumible por defecto; el nombre no identifica un elemento reutilizable.' }
}

const parseQuantity = (value) => {
  if (value == null || trim(value) === '') return { value: '', resolved: false, review: true, kind: 'cantidad_vacia', interpretation: 'Valor vacío; no se asume cero.' }
  if (typeof value === 'number') return value < 0 ? { value: '', resolved: false, review: true, kind: 'cantidad_ambigua', interpretation: 'Valor negativo no aceptado.' } : { value, resolved: true, review: false, interpretation: 'Stock para el semestre confirmado; valor numérico usado directamente.' }
  const text = trim(value)
  const expires = text.match(/^(\d+(?:[.,]\d+)?)\s+VENCEN?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/i)
  if (expires) {
    const expiry = `${expires[4]}-${expires[3].padStart(2, '0')}-${expires[2].padStart(2, '0')}`
    if (expiry < CUTOFF_DATE) return { value: 0, resolved: true, review: true, kind: 'vencido', expiry, expiredCount: Number(expires[1]), interpretation: `${expires[1]} unidad(es) vencidas el ${expiry}; existencia utilizable: 0.` }
    return { value: Number(expires[1]), resolved: true, review: false, interpretation: `Cantidad disponible con vencimiento indicado ${expiry}.` }
  }
  if (/vencid[oa]s?/i.test(text)) return { value: 0, resolved: true, review: true, kind: 'vencido', interpretation: 'Toda la cantidad indicada está vencida; existencia utilizable: 0.' }
  const combined = text.match(/^(\d+(?:[.,]\d+)?)\s*N\s*y\s*(\d+(?:[.,]\d+)?)\s*en\s+uso$/i)
  if (combined) return { value: Number(combined[1].replace(',', '.')) + Number(combined[2].replace(',', '.')), resolved: true, review: false, interpretation: 'Suma aprobada de unidades N y unidades en uso.' }
  const simple = text.match(/^(\d+(?:[.,]\d+)?)\s*(?:tab(?:leta)?s?|frascos?|en\s+uso|N|dispensador)?$/i)
  if (simple) return { value: Number(simple[1].replace(',', '.')), resolved: true, review: false, interpretation: /en\s+uso/i.test(text) ? 'Cantidad numérica en uso contada como disponible según decisión institucional.' : 'Cantidad numérica extraída de texto inequívoco.' }
  if (/^en\s+uso$/i.test(text)) return { value: '', resolved: false, review: true, kind: 'cantidad_ambigua', interpretation: '“En uso” no incluye cantidad; no se asume una unidad.' }
  return { value: '', resolved: false, review: true, kind: 'cantidad_ambigua', interpretation: 'Texto no interpretable inequívocamente.' }
}
const calculatedMinimum = (stock) => stock === '' ? '' : Math.max(1, Math.ceil(Number(stock) * 0.2))
const validExcelMinimum = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0

const excelDate = (serial) => { const p = XLSX.SSF.parse_date_code(serial); return p ? `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}` : '' }
const endOfMonth = (year, month) => new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
const monthNames = { jan: 1, ene: 1, feb: 2, mar: 3, apr: 4, abr: 4, may: 5, jun: 6, jul: 7, aug: 8, ago: 8, sep: 9, oct: 10, nov: 11, dec: 12, dic: 12 }
const parseDate = (value, display = '') => {
  if (value == null || trim(value) === '') return { empty: true, date: '', resolved: false, review: false }
  if (typeof value === 'number') {
    const shown = trim(display).match(/^([A-Za-z]{3})-(\d{2}|\d{4})$/)
    if (shown && monthNames[shown[1].toLowerCase()]) return { date: endOfMonth(Number(shown[2].length === 2 ? `20${shown[2]}` : shown[2]), monthNames[shown[1].toLowerCase()]), resolved: true, review: true, monthOnly: true }
    const date = excelDate(value); return { date, resolved: Boolean(date), review: false }
  }
  const text = trim(value)
  const pieces = text.match(/\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?/g) || []
  if (pieces.length > 1 || /\s+-\s+/.test(text)) return { date: '', resolved: false, review: true, multiple: true }
  const full = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (full) { const date = `${full[3]}-${full[2].padStart(2, '0')}-${full[1].padStart(2, '0')}`; return { date, resolved: !Number.isNaN(Date.parse(`${date}T00:00:00Z`)), review: false } }
  const monthYear = text.match(/^(\d{1,2})\/(\d{2}|\d{4})$/)
  if (monthYear && Number(monthYear[1]) <= 12) return { date: endOfMonth(Number(monthYear[2].length === 2 ? `20${monthYear[2]}` : monthYear[2]), Number(monthYear[1])), resolved: true, review: true, monthOnly: true }
  return { date: '', resolved: false, review: true }
}

if (!fs.existsSync(SOURCE)) throw new Error(`No existe el archivo de origen: ${SOURCE}`)
fs.mkdirSync(OUT, { recursive: true })
const workbook = XLSX.readFile(SOURCE, { raw: true, cellDates: false })
const products = []; const inventory = []; const lots = []; const pending = []; const counters = { medicamento: 0, insumo: 0 }
const stats = { sheetRows: {}, originalCodes: 0, provisionalCodes: 0, quantitiesResolved: 0, quantitiesPending: 0, datesResolved: 0, datesPending: 0, rowsWithoutDescription: 0, minExcel: 0, minCalculated: 0, internalContent: 0, packageReview: 0 }

for (const config of SHEETS) {
  const sheet = workbook.Sheets[config.name]
  if (!sheet) throw new Error(`Falta la hoja requerida: ${config.name}`)
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null })
  const meaningful = rows.slice(config.headerRow).map((values, index) => ({ values, sourceRow: config.headerRow + index + 1 })).filter(({ values }) => values.slice(0, 11).some((value) => trim(value) !== ''))
  stats.sheetRows[config.name] = meaningful.length
  for (const source of meaningful) {
    const originalCode = trim(source.values[0]).toUpperCase(); const name = trim(source.values[1]); const categoryRaw = trim(source.values[2]).toUpperCase()
    if (!name) { stats.rowsWithoutDescription++; addPending(pending, { sheet: config.name, sourceRow: source.sourceRow, code: originalCode }, 'otro', 'descripcion_producto', source.values[1], '', 'Fila con datos o código, pero sin descripción.', 'Completar la descripción o confirmar su exclusión lógica.'); continue }
    counters[config.category]++
    const code = originalCode || `${config.prefix}-AUTO-${String(counters[config.category]).padStart(3, '0')}`
    const row = { sheet: config.name, sourceRow: source.sourceRow, code, name }; let review = false
    if (!originalCode) { stats.provisionalCodes++; review = true; addPending(pending, row, 'codigo_faltante', 'codigo', source.values[0], code, 'No existe código original.', 'Asignar el código institucional definitivo.') } else stats.originalCodes++
    if (!categoryRaw) { review = true; addPending(pending, row, 'categoria_faltante', 'categoria', source.values[2], config.category, 'Categoría vacía; propuesta según hoja.', 'Confirmar categoría.') }
    const presentation = inferPresentation(name)
    if (!presentation) { review = true; addPending(pending, row, 'unidad_dispensacion', 'presentacion/unidad_dispensacion', name, 'unidad provisional', 'No se identificó presentación ni unidad de dispensación inequívoca.', 'Confirmar presentación y unidad usada durante la atención.') }
    const content = inferContent(name); if (content.identified) stats.internalContent++
    const consumption = classifyConsumption(name)
    if (consumption.ambiguous) { review = true; addPending(pending, row, 'clasificacion_consumible', 'es_consumible', name, 'true provisional', consumption.criterion, 'Confirmar si es reutilizable y debe registrarse sin descuento.') }
    if (/\bCAJA\b/i.test(name) && content.content > 1) { review = true; stats.packageReview++; addPending(pending, row, 'contenido_presentacion', 'contenido_por_presentacion', name, content.content, 'Inventario expresado en caja con contenido interno; la atención probablemente use unidades internas.', 'Confirmar unidad de inventario y conversión antes de multiplicar existencias.') }
    products.push({ codigo: code, nombre: name, categoria: config.category, presentacion: presentation || '', unidad_medida: presentation || 'unidad', es_consumible: consumption.consumable, contenido_por_presentacion: content.content, unidad_dispensacion: consumption.consumable ? content.unit : 'unidad', permite_registro_sin_descuento: consumption.noDiscount, criterio_clasificacion: consumption.criterion, descripcion_original: trim(source.values[1]), hoja_origen: config.name, fila_origen: source.sourceRow, requiere_revision: review })

    const excelMin = config.minCol == null ? null : source.values[config.minCol]
    for (const stock of config.stocks) {
      const original = source.values[stock.col]; const parsed = parseQuantity(original)
      if (parsed.resolved) stats.quantitiesResolved++; else stats.quantitiesPending++
      if (parsed.review) addPending(pending, row, parsed.kind, 'existencia_actual', original, parsed.value, parsed.interpretation, parsed.resolved ? 'Conservar como histórico y confirmar el dato.' : 'Indicar la cantidad disponible.', stock.sede)
      const useExcelMin = config.category === 'insumo' && validExcelMinimum(excelMin)
      const minimum = useExcelMin ? Number(excelMin) : calculatedMinimum(parsed.value)
      const minimumOrigin = useExcelMin ? 'excel' : 'calculado_20_por_ciento'
      if (useExcelMin) stats.minExcel++; else if (minimum !== '') stats.minCalculated++
      inventory.push({ codigo_producto: code, codigo_sede: stock.sede, existencia_actual: parsed.value, existencia_minima: minimum, origen_minimo: minimumOrigin, porcentaje_minimo_aplicado: useExcelMin ? 0 : 20, valor_original: original == null ? '' : String(original), hoja_origen: config.name, fila_origen: source.sourceRow, interpretacion: `${parsed.interpretation} Existencia tomada definitivamente de Stock para el semestre ${stock.sede}.`, requiere_revision: parsed.review })
      if (parsed.expiry) lots.push({ codigo_producto: code, codigo_sede: stock.sede, numero_lote: '', fecha_vencimiento: parsed.expiry, cantidad_disponible: 0, estado: 'vencido', valor_original_fecha: parsed.expiry, valor_original_cantidad: original, hoja_origen: config.name, fila_origen: source.sourceRow, requiere_revision: false })
    }
    const originalDate = source.values[3]; const parsedDate = parseDate(originalDate, sheet[`D${source.sourceRow}`]?.w || '')
    if (!parsedDate.empty) {
      if (parsedDate.resolved) stats.datesResolved++; else stats.datesPending++
      const type = parsedDate.multiple ? 'multiples_vencimientos' : parsedDate.date && parsedDate.date < CUTOFF_DATE ? 'vencido' : parsedDate.resolved ? 'lote_sin_cantidad' : 'fecha_ambigua'
      addPending(pending, row, type, 'fecha_vencimiento/lote', originalDate, parsedDate.date, parsedDate.multiple ? 'Múltiples fechas sin distribución de cantidades.' : parsedDate.date && parsedDate.date < CUTOFF_DATE ? 'Fecha histórica vencida sin cantidad distribuida por sede.' : 'Fecha sin cantidad de lote inequívoca por sede.', 'Confirmar cantidad y sede de cada lote.')
    }
  }
}

const duplicateGroups = new Map()
for (const product of products) { const key = product.nombre.toUpperCase(); duplicateGroups.set(key, [...(duplicateGroups.get(key) || []), product]) }
let duplicateCount = 0
for (const group of duplicateGroups.values()) if (group.length > 1) for (const product of group) { duplicateCount++; product.requiere_revision = true; addPending(pending, { sheet: product.hoja_origen, sourceRow: product.fila_origen, code: product.codigo, name: product.nombre }, 'producto_duplicado', 'nombre', product.nombre, group.map((item) => item.codigo).join(' | '), 'Nombre normalizado duplicado; no se combinaron filas.', 'Confirmar si deben consolidarse.') }

const codes = new Set()
for (const product of products) { if (codes.has(product.codigo)) throw new Error(`Código duplicado: ${product.codigo}`); codes.add(product.codigo) }
if (products.length !== 128) throw new Error(`Se esperaban 128 productos y se obtuvieron ${products.length}.`)
if (inventory.length !== 256) throw new Error(`Se esperaban 256 filas potenciales de inventario y se obtuvieron ${inventory.length}.`)
for (const item of inventory) { if (!codes.has(item.codigo_producto)) throw new Error(`Inventario sin producto: ${item.codigo_producto}`); if (item.existencia_actual !== '' && Number(item.existencia_actual) < 0) throw new Error(`Inventario negativo: ${item.codigo_producto}/${item.codigo_sede}`) }

writeCsv('productos_normalizados.csv', ['codigo','nombre','categoria','presentacion','unidad_medida','es_consumible','contenido_por_presentacion','unidad_dispensacion','permite_registro_sin_descuento','criterio_clasificacion','descripcion_original','hoja_origen','fila_origen','requiere_revision'], products)
writeCsv('inventario_inicial_normalizado.csv', ['codigo_producto','codigo_sede','existencia_actual','existencia_minima','origen_minimo','porcentaje_minimo_aplicado','valor_original','hoja_origen','fila_origen','interpretacion','requiere_revision'], inventory)
writeCsv('lotes_normalizados.csv', ['codigo_producto','codigo_sede','numero_lote','fecha_vencimiento','cantidad_disponible','estado','valor_original_fecha','valor_original_cantidad','hoja_origen','fila_origen','requiere_revision'], lots)
writeCsv('pendientes_revision.csv', ['tipo_revision','hoja','fila','codigo_producto','producto','sede','campo','valor_original','valor_propuesto','motivo','accion_requerida'], pending)

const resolvedInventory = inventory.filter((item) => item.existencia_actual !== '')
const productValues = products.map((p) => `  (${sqlText(p.codigo)}, ${sqlText(p.nombre)}, ${sqlText(p.categoria)}::public.categoria_producto, ${sqlText(p.presentacion || null)}, ${sqlText(p.unidad_medida)}, 'activo'::public.estado_producto, ${sqlBool(p.es_consumible)}, ${sqlNumber(p.contenido_por_presentacion)}, ${sqlText(p.unidad_dispensacion)}, ${sqlBool(p.permite_registro_sin_descuento)})`).join(',\n')
const inventoryValues = resolvedInventory.map((i) => `  (${sqlText(i.codigo_producto)}, ${sqlText(i.codigo_sede)}, ${sqlNumber(i.existencia_actual)}, ${sqlNumber(i.existencia_minima)})`).join(',\n')
const lotStatements = lots.map((lot) => `insert into public.lotes (producto_id, sede_id, numero_lote, fecha_vencimiento, cantidad_disponible, estado)\nselect p.id, s.id, null, ${sqlText(lot.fecha_vencimiento)}::date, 0, 'vencido'::public.estado_lote\nfrom public.productos p join public.sedes s on s.codigo = ${sqlText(lot.codigo_sede)}\nwhere p.codigo = ${sqlText(lot.codigo_producto)} and not exists (select 1 from public.lotes l where l.producto_id = p.id and l.sede_id = s.id and l.numero_lote is null and l.fecha_vencimiento = ${sqlText(lot.fecha_vencimiento)}::date and l.estado = 'vencido');`).join('\n\n')
const sql = `-- Generado por scripts/preparar-inventario.mjs. Revisar pendientes antes de ejecutar.\n-- No multiplica existencias por contenido_por_presentacion y no crea movimientos.\nbegin;\n\ndo $$ declare r record; begin\n+  for r in select v.codigo, v.nombre_nuevo, p.nombre nombre_existente from (values\n${products.map((p) => `    (${sqlText(p.codigo)}, ${sqlText(p.nombre)})`).join(',\n')}\n  ) v(codigo, nombre_nuevo) join public.productos p on p.codigo = v.codigo where p.nombre is distinct from v.nombre_nuevo\n+  loop raise warning 'Código % ya existe con nombre distinto: existente=%, propuesto=%', r.codigo, r.nombre_existente, r.nombre_nuevo; end loop;\nend $$;\n\ninsert into public.productos (codigo, nombre, categoria, presentacion, unidad_medida, estado, es_consumible, contenido_por_presentacion, unidad_dispensacion, permite_registro_sin_descuento)\nvalues\n${productValues}\non conflict (codigo) do update set\n+  categoria = excluded.categoria, presentacion = excluded.presentacion, unidad_medida = excluded.unidad_medida, estado = excluded.estado,\n+  es_consumible = excluded.es_consumible, contenido_por_presentacion = excluded.contenido_por_presentacion,\n+  unidad_dispensacion = excluded.unidad_dispensacion, permite_registro_sin_descuento = excluded.permite_registro_sin_descuento;\n\ninsert into public.inventario_sede (producto_id, sede_id, existencia_actual, existencia_minima)\nselect p.id, s.id, v.existencia_actual, v.existencia_minima from (values\n${inventoryValues}\n) v(codigo_producto, codigo_sede, existencia_actual, existencia_minima) join public.productos p on p.codigo = v.codigo_producto join public.sedes s on s.codigo = v.codigo_sede\non conflict (producto_id, sede_id) do update set existencia_actual = excluded.existencia_actual, existencia_minima = excluded.existencia_minima;\n\n${lotStatements}\n\n-- movimientos_inventario se registrarán posteriormente mediante RPC administrativa o script controlado.\ncommit;\n`
fs.writeFileSync(SQL_PATH, sql, 'utf8')

const consumables = products.filter((p) => p.es_consumible).length; const reusable = products.length - consumables
const report = `# Resumen de preparación de inventario\n\n> Revisar \`pendientes_revision.csv\` antes de ejecutar SQL. El SQL fue generado, no ejecutado. Corte reproducible de vencimiento: ${CUTOFF_DATE}.\n\n## Totales\n\n- Filas leídas en Inventario Medicamento: ${stats.sheetRows['Inventario Medicamento']}\n- Filas leídas en Inventario Insumo: ${stats.sheetRows['Inventario Insumo']}\n- Productos normalizados: ${products.length} (${products.filter((p) => p.categoria === 'medicamento').length} medicamentos y ${products.filter((p) => p.categoria === 'insumo').length} insumos)\n- Códigos originales: ${stats.originalCodes}; provisionales: ${stats.provisionalCodes}\n- Posibles duplicados: ${duplicateCount}\n- Consumibles: ${consumables}\n- Reutilizables: ${reusable}\n- Productos con descuento: ${products.filter((p) => p.es_consumible && !p.permite_registro_sin_descuento).length}\n- Productos sin descuento: ${products.filter((p) => !p.es_consumible || p.permite_registro_sin_descuento).length}\n- Mínimos provenientes del Excel: ${stats.minExcel}\n- Mínimos calculados al 20 %: ${stats.minCalculated}\n- Cantidades resueltas: ${stats.quantitiesResolved}; pendientes: ${stats.quantitiesPending}\n- Fechas resueltas: ${stats.datesResolved}; pendientes: ${stats.datesPending}\n- Productos vencidos históricos con lote inequívoco: ${lots.length}\n- Productos con contenido interno identificado: ${stats.internalContent}\n- Productos que requieren revisión por caja/paquete: ${stats.packageReview}\n- Filas de inventario potenciales: ${inventory.length}; incluidas en SQL: ${resolvedInventory.length}; excluidas por cantidad irresoluble: ${inventory.length - resolvedInventory.length}\n- Filas con datos sin descripción: ${stats.rowsWithoutDescription}, registradas como pendientes\n- Hoja Registro: no procesada\n\n## Decisiones institucionales aplicadas\n\n- Stock para el semestre Z3/Z9 es la existencia actual definitiva por sede; no se suma con Cantidad ni Ingreso Febrero.\n- Cantidades numéricas “en uso” cuentan como disponibles; “En uso” sin número permanece pendiente.\n- El mínimo es 20 % redondeado hacia arriba, con mínimo absoluto 1. En insumos se conserva el mínimo numérico explícito del Excel.\n- Lo totalmente vencido tiene existencia utilizable 0. Solo se genera lote histórico cuando fecha y sede son inequívocas.\n- Los reutilizables inequívocos se registran sin descuento. Los ambiguos siguen consumibles provisionalmente y quedan pendientes.\n- contenido_por_presentacion no multiplica existencias. Las cajas con contenido interno quedan para revisión de conversión.\n\n## Pendientes principales\n\n- Confirmar códigos provisionales, presentaciones no identificadas y clasificaciones ambiguas de férulas/cabestrillos/equipos.\n- Resolver “En uso” sin número y otros vacíos.\n- Confirmar conversión entre cajas/paquetes y unidades usadas en atenciones.\n- Distribuir cantidades cuando una celda contiene varios vencimientos.\n`
fs.writeFileSync(path.join(OUT, 'resumen_importacion.md'), report, 'utf8')
console.log(JSON.stringify({ products: products.length, inventoryRows: inventory.length, resolvedInventory: resolvedInventory.length, consumables, reusable, historicalLots: lots.length, pending: pending.length }, null, 2))
