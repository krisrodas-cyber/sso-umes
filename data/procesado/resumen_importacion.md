# Resumen de preparación de inventario

> Revisar `pendientes_revision.csv` antes de ejecutar SQL. El SQL fue generado, no ejecutado. Corte reproducible de vencimiento: 2026-08-04.

## Totales

- Filas leídas en Inventario Medicamento: 76
- Filas leídas en Inventario Insumo: 67
- Productos normalizados: 128 (76 medicamentos y 52 insumos)
- Códigos originales: 94; provisionales: 34
- Posibles duplicados: 0
- Consumibles: 124
- Reutilizables: 4
- Productos con descuento: 124
- Productos sin descuento: 4
- Mínimos provenientes del Excel: 70
- Mínimos calculados al 20 %: 159
- Cantidades resueltas: 225; pendientes: 31
- Fechas resueltas: 21; pendientes: 2
- Productos vencidos históricos con lote inequívoco: 1
- Productos con contenido interno identificado: 32
- Productos que requieren revisión por caja/paquete: 3
- Filas de inventario potenciales: 256; incluidas en SQL: 225; excluidas por cantidad irresoluble: 31
- Filas con datos sin descripción: 15, registradas como pendientes
- Hoja Registro: no procesada

## Decisiones institucionales aplicadas

- Stock para el semestre Z3/Z9 es la existencia actual definitiva por sede; no se suma con Cantidad ni Ingreso Febrero.
- Cantidades numéricas “en uso” cuentan como disponibles; “En uso” sin número permanece pendiente.
- El mínimo es 20 % redondeado hacia arriba, con mínimo absoluto 1. En insumos se conserva el mínimo numérico explícito del Excel.
- Lo totalmente vencido tiene existencia utilizable 0. Solo se genera lote histórico cuando fecha y sede son inequívocas.
- Los reutilizables inequívocos se registran sin descuento. Los ambiguos siguen consumibles provisionalmente y quedan pendientes.
- contenido_por_presentacion no multiplica existencias. Las cajas con contenido interno quedan para revisión de conversión.

## Pendientes principales

- Confirmar códigos provisionales, presentaciones no identificadas y clasificaciones ambiguas de férulas/cabestrillos/equipos.
- Resolver “En uso” sin número y otros vacíos.
- Confirmar conversión entre cajas/paquetes y unidades usadas en atenciones.
- Distribuir cantidades cuando una celda contiene varios vencimientos.
