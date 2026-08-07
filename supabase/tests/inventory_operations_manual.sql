-- PRUEBAS MANUALES POSTERIORES A 003_inventory_operations.sql
-- No ejecutar en producción sin sustituir IDs y revisar los datos.
-- Cada bloque usa ROLLBACK para no conservar cambios.

-- Preparación por bloque (solo entorno local/staging):
-- set local role authenticated;
-- select set_config('request.jwt.claim.sub', '<UUID_ACTOR>', true);

-- ADMINISTRADOR: entrada, ajustes, edición operativa y mínimo.
begin;
-- set local role authenticated;
-- select set_config('request.jwt.claim.sub', '<UUID_ADMIN>', true);
-- select * from public.registrar_entrada_inventario(<PRODUCTO_ID>, <SEDE_ID>, 25, 'LOTE-REVISION', current_date + 180, 'Prueba manual');
-- select * from public.ajustar_inventario(<PRODUCTO_ID>, <SEDE_ID>, 'ajuste_positivo', 3, 'Conteo físico', null);
-- select * from public.ajustar_inventario(<PRODUCTO_ID>, <SEDE_ID>, 'ajuste_negativo', 2, 'Conteo físico', null);
-- select * from public.actualizar_producto_operativo(<PRODUCTO_ID>, 'Nombre revisado', 'medicamento', 'Caja', 'unidad', 'tableta');
-- select * from public.actualizar_existencia_minima(<PRODUCTO_ID>, <SEDE_ID>, 10);
-- select * from public.movimientos_inventario where producto_id = <PRODUCTO_ID> and sede_id = <SEDE_ID> order by created_at desc;
rollback;

-- MONITORA: operaciones en sede propia deben funcionar.
begin;
-- set local role authenticated;
-- select set_config('request.jwt.claim.sub', '<UUID_MONITORA>', true);
-- select * from public.registrar_entrada_inventario(<PRODUCTO_ID_PROPIO>, <SEDE_PROPIA>, 5, null, null, 'Prueba monitora');
-- select * from public.actualizar_existencia_minima(<PRODUCTO_ID_PROPIO>, <SEDE_PROPIA>, 4);
-- select * from public.actualizar_producto_operativo(<PRODUCTO_ID_PROPIO>, 'Nombre operativo', 'insumo', 'Paquete', 'unidad', 'unidad');
-- select distinct sede_id from public.movimientos_inventario; -- debe devolver únicamente SEDE_PROPIA.
rollback;

-- MONITORA: otra sede y producto ajeno deben devolver SQLSTATE 42501.
begin;
-- set local role authenticated;
-- select set_config('request.jwt.claim.sub', '<UUID_MONITORA>', true);
-- select * from public.registrar_entrada_inventario(<PRODUCTO_ID>, <OTRA_SEDE>, 1, null, null, null);
-- select * from public.actualizar_existencia_minima(<PRODUCTO_ID>, <OTRA_SEDE>, 1);
-- select * from public.actualizar_producto_operativo(<PRODUCTO_AJENO>, 'No permitido', 'insumo', null, 'unidad', null);
rollback;

-- RRHH: todas las escrituras deben devolver SQLSTATE 42501.
begin;
-- set local role authenticated;
-- select set_config('request.jwt.claim.sub', '<UUID_RRHH>', true);
-- select * from public.registrar_entrada_inventario(<PRODUCTO_ID>, <SEDE_ID>, 1, null, null, null);
-- select * from public.ajustar_inventario(<PRODUCTO_ID>, <SEDE_ID>, 'ajuste_positivo', 1, 'No permitido', null);
-- select * from public.actualizar_existencia_minima(<PRODUCTO_ID>, <SEDE_ID>, 1);
rollback;

-- NO NEGATIVOS / ATOMICIDAD: la llamada debe fallar y la existencia permanecer igual.
begin;
-- set local role authenticated;
-- select set_config('request.jwt.claim.sub', '<UUID_ADMIN>', true);
-- select existencia_actual from public.inventario_sede where producto_id = <PRODUCTO_ID> and sede_id = <SEDE_ID>;
-- select * from public.ajustar_inventario(<PRODUCTO_ID>, <SEDE_ID>, 'ajuste_negativo', 999999999, 'Debe fallar', null);
-- Repetir el SELECT anterior en una nueva transacción: el valor no debe cambiar.
rollback;

-- La actualización de inventario y la inserción del movimiento pertenecen a una
-- única sentencia RPC/transacción. Cualquier constraint, trigger o error durante
-- el INSERT de movimientos_inventario aborta y revierte también el UPDATE previo.
