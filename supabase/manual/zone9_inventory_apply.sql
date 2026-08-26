-- Aplicacion de la conciliacion oficial de Zona 9.
-- Requiere ejecutar y confirmar previamente zone9_inventory_prepare.sql.

begin;

do $$
declare
  v_missing_tables text;
  v_missing_codes text;
begin
  select string_agg(table_name, ', ' order by table_name)
    into v_missing_tables
  from (
    values
      ('public._recon_z9_official_inventory_20260826'),
      ('public._recon_z9_product_map_20260826'),
      ('public._recon_z9_products_zeroed_20260826')
  ) required(table_name)
  where to_regclass(table_name) is null;

  if v_missing_tables is not null then
    raise exception 'Faltan tablas de staging: %', v_missing_tables;
  end if;

  if (select count(*) from public._recon_z9_official_inventory_20260826) <> 103 then
    raise exception 'El staging no contiene los 103 articulos oficiales';
  end if;

  if (select count(*) from public._recon_z9_product_map_20260826) <> 103 then
    raise exception 'El mapa no contiene los 103 articulos oficiales';
  end if;

  if exists (
    select 1
    from public._recon_z9_official_inventory_20260826 o
    full join public._recon_z9_product_map_20260826 m using (ordinal)
    where (o.existing_code, o.new_code)
          is distinct from (m.existing_code, m.new_code)
  ) then
    raise exception 'El mapa no coincide con los codigos del inventario oficial';
  end if;

  if (select sum(quantity) from public._recon_z9_official_inventory_20260826) <> 8068 then
    raise exception 'El staging no contiene las 8068 unidades oficiales';
  end if;

  if (select count(*) from public._recon_z9_official_inventory_20260826 where existing_code is not null) <> 85 then
    raise exception 'El staging no contiene las 85 equivalencias reutilizadas';
  end if;

  if (select count(*) from public._recon_z9_official_inventory_20260826 where new_code is not null) <> 18 then
    raise exception 'El staging no contiene los 18 productos nuevos';
  end if;

  if (select count(*) from public._recon_z9_official_inventory_20260826 where expiry_date is not null) <> 94 then
    raise exception 'El staging no contiene los 94 articulos con vencimiento';
  end if;

  if (select count(*) from public._recon_z9_official_inventory_20260826 where expiry_date is null) <> 9 then
    raise exception 'El staging no contiene los 9 articulos sin vencimiento';
  end if;

  if exists (
    select 1
    from public._recon_z9_official_inventory_20260826
    where quantity < 0
  ) then
    raise exception 'El staging contiene cantidades negativas';
  end if;

  select string_agg(o.existing_code, ', ' order by o.existing_code)
    into v_missing_codes
  from public._recon_z9_official_inventory_20260826 o
  left join public.productos p on p.codigo = o.existing_code
  where o.existing_code is not null
    and p.id is null;

  if v_missing_codes is not null then
    raise exception 'No existen los codigos reutilizados: %', v_missing_codes;
  end if;

  if (select count(*) from public.sedes where codigo = 'Z9') <> 1 then
    raise exception 'Debe existir exactamente una sede con codigo Z9';
  end if;
end
$$;

-- Solo se crean los 18 productos clasificados como nuevos. Los productos
-- reutilizados no reciben ninguna modificacion global.
insert into public.productos
  (codigo, nombre, categoria, presentacion, unidad_medida, descripcion, estado,
   es_consumible, contenido_por_presentacion, unidad_dispensacion,
   permite_registro_sin_descuento)
select
  o.new_code,
  o.canonical_name,
  o.category,
  o.presentation,
  o.unit_of_measure,
  'Creado para conciliar el conteo oficial de Zona 9; fuente: Medicamentos e insumos CZ9.docx.',
  'activo'::public.estado_producto,
  true,
  1,
  o.dispensing_unit,
  false
from public._recon_z9_official_inventory_20260826 o
where o.new_code is not null
on conflict (codigo) do nothing;

do $$
declare
  v_conflicts text;
begin
  select string_agg(o.new_code, ', ' order by o.new_code)
    into v_conflicts
  from public._recon_z9_official_inventory_20260826 o
  join public.productos p on p.codigo = o.new_code
  where o.new_code is not null
    and (p.nombre, p.categoria, p.presentacion, p.unidad_medida, p.unidad_dispensacion)
        is distinct from
        (o.canonical_name, o.category, o.presentation, o.unit_of_measure, o.dispensing_unit);

  if v_conflicts is not null then
    raise exception 'Los codigos nuevos ya existen con otra definicion: %', v_conflicts;
  end if;
end
$$;

-- Completa los identificadores que no existian al preparar el staging.
update public._recon_z9_product_map_20260826 m
set product_id = p.id
from public.productos p
where p.codigo = coalesce(m.existing_code, m.new_code);

do $$
begin
  if (select count(*) from public._recon_z9_product_map_20260826) <> 103
     or exists (
       select 1
       from public._recon_z9_product_map_20260826
       where product_id is null
     ) then
    raise exception 'No fue posible resolver los 103 productos oficiales';
  end if;
end
$$;

insert into public._recon_z9_products_zeroed_20260826
  (producto_id, existencia_anterior)
select i.producto_id, i.existencia_actual
from public.inventario_sede i
join public.sedes s on s.id = i.sede_id
where s.codigo = 'Z9'
  and not exists (
    select 1
    from public._recon_z9_product_map_20260826 m
    where m.product_id = i.producto_id
  );

-- Los productos anteriores de Z9 que no estan en la fuente quedan en cero.
update public.inventario_sede i
set existencia_actual = 0
from public.sedes s
where i.sede_id = s.id
  and s.codigo = 'Z9'
  and exists (
    select 1
    from public._recon_z9_products_zeroed_20260826 z
    where z.producto_id = i.producto_id
  );

-- Los productos existentes conservan existencia_minima; solo una fila nueva
-- recibe existencia_minima igual a cero.
insert into public.inventario_sede
  (producto_id, sede_id, existencia_actual, existencia_minima)
select m.product_id, s.id, o.quantity, 0
from public._recon_z9_product_map_20260826 m
join public._recon_z9_official_inventory_20260826 o using (ordinal)
cross join public.sedes s
where s.codigo = 'Z9'
on conflict (producto_id, sede_id) do update
set existencia_actual = excluded.existencia_actual;

-- Se conserva el historial de lotes de Z9, pero sus saldos anteriores quedan en cero.
update public.lotes l
set cantidad_disponible = 0,
    estado = case
      when l.fecha_vencimiento is not null and l.fecha_vencimiento < current_date
        then 'vencido'::public.estado_lote
      else 'agotado'::public.estado_lote
    end,
    observaciones = case
      when coalesce(l.observaciones, '') like '%Saldo sustituido por conciliacion oficial de Zona 9.%'
        then l.observaciones
      else concat_ws(
        ' | ',
        nullif(l.observaciones, ''),
        'Saldo sustituido por conciliacion oficial de Zona 9.'
      )
    end
from public.sedes s
where l.sede_id = s.id
  and s.codigo = 'Z9';

-- Los 94 articulos con vencimiento generan un lote anonimo de Z9.
insert into public.lotes
  (producto_id, sede_id, numero_lote, fecha_vencimiento, cantidad_disponible,
   estado, observaciones)
select
  m.product_id,
  s.id,
  null,
  o.expiry_date,
  o.quantity,
  case
    when o.expiry_date < current_date then 'vencido'::public.estado_lote
    else 'disponible'::public.estado_lote
  end,
  format(
    'Fuente oficial CZ9: vencimiento declarado %s; fecha normalizada al ultimo dia del mes.',
    o.expiry_month
  )
from public._recon_z9_product_map_20260826 m
join public._recon_z9_official_inventory_20260826 o using (ordinal)
cross join public.sedes s
where s.codigo = 'Z9'
  and o.expiry_date is not null
on conflict (producto_id, sede_id, fecha_vencimiento)
  where numero_lote is null
do update
set cantidad_disponible = excluded.cantidad_disponible,
    estado = excluded.estado,
    observaciones = excluded.observaciones;

do $$
declare
  v_z9_id bigint;
  v_inventory_count integer;
  v_inventory_total numeric(12,2);
begin
  select id into strict v_z9_id
  from public.sedes
  where codigo = 'Z9';

  if (select count(*) from public._recon_z9_official_inventory_20260826) <> 103 then
    raise exception 'El staging dejo de contener los 103 articulos oficiales';
  end if;

  select count(*), sum(i.existencia_actual)
    into v_inventory_count, v_inventory_total
  from public.inventario_sede i
  join public._recon_z9_product_map_20260826 m
    on m.product_id = i.producto_id
  where i.sede_id = v_z9_id;

  if v_inventory_count <> 103 or v_inventory_total <> 8068 then
    raise exception 'Inventario Z9 invalido: productos %, unidades %',
      v_inventory_count, v_inventory_total;
  end if;

  if exists (
    select 1
    from public.inventario_sede i
    where i.sede_id = v_z9_id
      and i.existencia_actual < 0
  ) then
    raise exception 'Z9 contiene existencias negativas';
  end if;

  if exists (
    select 1
    from public.lotes l
    where l.sede_id = v_z9_id
      and l.cantidad_disponible < 0
  ) then
    raise exception 'Z9 contiene lotes con cantidad negativa';
  end if;

  if exists (
    select 1
    from public.inventario_sede i
    left join public.lotes l
      on l.producto_id = i.producto_id
     and l.sede_id = i.sede_id
    where i.sede_id = v_z9_id
    group by i.producto_id, i.existencia_actual
    having coalesce(sum(l.cantidad_disponible), 0) > i.existencia_actual
  ) then
    raise exception 'La suma de lotes disponibles supera la existencia actual en Z9';
  end if;

  if exists (
    select 1
    from public._recon_z9_products_zeroed_20260826 z
    join public.inventario_sede i on i.producto_id = z.producto_id
    where i.sede_id = v_z9_id
      and i.existencia_actual <> 0
  ) then
    raise exception 'No todos los productos antiguos identificados quedaron en cero en Z9';
  end if;
end
$$;

select
  p.codigo,
  p.nombre,
  i.existencia_actual,
  i.existencia_minima,
  o.expiry_date as fecha_vencimiento,
  m.product_type as tipo
from public._recon_z9_product_map_20260826 m
join public._recon_z9_official_inventory_20260826 o using (ordinal)
join public.productos p on p.id = m.product_id
join public.sedes s on s.codigo = 'Z9'
join public.inventario_sede i
  on i.producto_id = m.product_id
 and i.sede_id = s.id
order by m.ordinal;

select
  count(*) as total_articulos_oficiales,
  count(*) filter (where existing_code is not null) as equivalencias_reutilizadas,
  count(*) filter (where new_code is not null) as productos_nuevos,
  sum(quantity) as unidades_totales,
  count(*) filter (where expiry_date is not null) as lotes_anonimos,
  count(*) filter (where expiry_date is null) as articulos_sin_vencimiento,
  (select count(*) from public._recon_z9_products_zeroed_20260826)
    as productos_antiguos_puestos_en_cero
from public._recon_z9_official_inventory_20260826;

drop table public._recon_z9_products_zeroed_20260826;
drop table public._recon_z9_product_map_20260826;
drop table public._recon_z9_official_inventory_20260826;

commit;
