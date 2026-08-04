-- Campos de control de consumo y actualización transaccional de registrar_atencion.
begin;

alter table public.productos
  add column if not exists es_consumible boolean not null default true,
  add column if not exists contenido_por_presentacion numeric(12,2) not null default 1,
  add column if not exists unidad_dispensacion text,
  add column if not exists permite_registro_sin_descuento boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'productos_contenido_presentacion_chk' and conrelid = 'public.productos'::regclass) then
    alter table public.productos add constraint productos_contenido_presentacion_chk check (contenido_por_presentacion > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'productos_unidad_dispensacion_chk' and conrelid = 'public.productos'::regclass) then
    alter table public.productos add constraint productos_unidad_dispensacion_chk check (unidad_dispensacion is null or nullif(btrim(unidad_dispensacion), '') is not null);
  end if;
end $$;

comment on column public.productos.es_consumible is 'Indica si el producto normalmente descuenta inventario al utilizarse.';
comment on column public.productos.contenido_por_presentacion is 'Número conocido de unidades dispensables dentro de una presentación; 1 cuando no se conoce otro contenido.';
comment on column public.productos.unidad_dispensacion is 'Unidad utilizada durante la atención, por ejemplo tableta, jeringa, curita, unidad o frasco.';
comment on column public.productos.permite_registro_sin_descuento is 'Permite registrar el producto en el detalle de atención sin descontar inventario ni lote.';

create or replace function public.registrar_atencion(
  p_tipo_persona public.tipo_persona, p_nombre_persona text, p_motivo_atencion text,
  p_atencion_realizada text, p_resultado public.resultado_atencion, p_productos jsonb default '[]'::jsonb,
  p_fecha_hora timestamptz default now(), p_sede_id bigint default null, p_turno_id bigint default null,
  p_monitora_id uuid default null, p_identificacion_institucional text default null,
  p_facultad_carrera_departamento text default null, p_telefono text default null,
  p_sintomas_referidos text default null, p_presion_arterial text default null,
  p_temperatura numeric default null, p_frecuencia_cardiaca integer default null,
  p_saturacion_oxigeno integer default null, p_glucosa numeric default null,
  p_observaciones text default null, p_resultado_otro text default null
) returns table (id bigint, codigo text)
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_actor public.perfiles%rowtype; v_atencion_id bigint; v_codigo text; v_item jsonb;
  v_producto_id bigint; v_lote_id bigint; v_cantidad numeric(12,2); v_item_obs text;
  v_anterior numeric(12,2); v_inv_id bigint; v_lote_cantidad numeric(12,2);
  v_sede bigint; v_turno bigint; v_monitora uuid; v_responsable public.perfiles%rowtype;
  v_producto public.productos%rowtype; v_descuenta boolean;
begin
  select * into v_actor from public.perfiles where perfiles.id = auth.uid() and activo for share;
  if not found or v_actor.rol not in ('monitora', 'administrador') then raise exception 'Usuario no autorizado o inactivo'; end if;
  if p_productos is null or jsonb_typeof(p_productos) <> 'array' then raise exception 'p_productos debe ser un arreglo JSON'; end if;
  if nullif(btrim(p_nombre_persona), '') is null then raise exception 'El nombre de la persona es obligatorio'; end if;
  if nullif(btrim(p_motivo_atencion), '') is null then raise exception 'El motivo de atención es obligatorio'; end if;
  if nullif(btrim(p_atencion_realizada), '') is null then raise exception 'La atención realizada es obligatoria'; end if;

  if v_actor.rol = 'monitora' then
    v_sede := v_actor.sede_id; v_turno := v_actor.turno_id; v_monitora := v_actor.id;
  else
    v_sede := p_sede_id; v_turno := p_turno_id; v_monitora := coalesce(p_monitora_id, v_actor.id);
    if v_sede is null or v_turno is null then raise exception 'El administrador debe indicar sede y turno'; end if;
    select * into v_responsable from public.perfiles where perfiles.id = v_monitora and activo and rol in ('monitora', 'administrador') for share;
    if not found then raise exception 'El responsable debe ser una monitora o administrador activo'; end if;
    if v_responsable.rol = 'monitora' and (v_sede is distinct from v_responsable.sede_id or v_turno is distinct from v_responsable.turno_id) then
      raise exception 'La sede y turno deben coincidir con los asignados a la monitora responsable';
    end if;
  end if;

  insert into public.atenciones (fecha_hora, sede_id, turno_id, monitora_id, tipo_persona, nombre_persona,
    identificacion_institucional, facultad_carrera_departamento, telefono, motivo_atencion, sintomas_referidos,
    presion_arterial, temperatura, frecuencia_cardiaca, saturacion_oxigeno, glucosa, atencion_realizada,
    observaciones, resultado, resultado_otro)
  values (p_fecha_hora, v_sede, v_turno, v_monitora, p_tipo_persona, p_nombre_persona,
    p_identificacion_institucional, p_facultad_carrera_departamento, p_telefono, p_motivo_atencion,
    p_sintomas_referidos, p_presion_arterial, p_temperatura, p_frecuencia_cardiaca,
    p_saturacion_oxigeno, p_glucosa, p_atencion_realizada, p_observaciones, p_resultado, p_resultado_otro)
  returning atenciones.id, atenciones.codigo into v_atencion_id, v_codigo;

  for v_item in select value from jsonb_array_elements(p_productos) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'Cada producto debe ser un objeto JSON'; end if;
    begin
      v_producto_id := (v_item->>'producto_id')::bigint;
      v_lote_id := nullif(v_item->>'lote_id', '')::bigint;
      v_cantidad := (v_item->>'cantidad')::numeric(12,2);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Producto, lote o cantidad con formato inválido';
    end;
    v_item_obs := nullif(btrim(v_item->>'observaciones'), '');
    if v_producto_id is null or v_cantidad is null or v_cantidad <= 0 then raise exception 'Producto y cantidad positiva son obligatorios'; end if;

    select * into v_producto from public.productos where productos.id = v_producto_id and estado = 'activo' for share;
    if not found then raise exception 'Producto % inexistente o inactivo', v_producto_id; end if;
    v_descuenta := v_producto.es_consumible and not v_producto.permite_registro_sin_descuento;

    if not v_descuenta then
      insert into public.detalle_atencion (atencion_id, producto_id, lote_id, cantidad, observaciones)
        values (v_atencion_id, v_producto_id, null, v_cantidad, v_item_obs);
      continue;
    end if;

    select inventario_sede.id, existencia_actual into v_inv_id, v_anterior
      from public.inventario_sede where producto_id = v_producto_id and sede_id = v_sede for update;
    if not found then raise exception 'No existe inventario del producto % en la sede', v_producto_id; end if;
    if v_anterior < v_cantidad then raise exception 'Inventario insuficiente para producto %', v_producto_id; end if;

    if v_lote_id is not null then
      select cantidad_disponible into v_lote_cantidad from public.lotes
       where lotes.id = v_lote_id and producto_id = v_producto_id and sede_id = v_sede
         and estado in ('disponible', 'en_uso') for update;
      if not found then raise exception 'Lote % inválido para producto y sede', v_lote_id; end if;
      if v_lote_cantidad < v_cantidad then raise exception 'Cantidad insuficiente en lote %', v_lote_id; end if;
      update public.lotes set cantidad_disponible = cantidad_disponible - v_cantidad,
        estado = case when cantidad_disponible - v_cantidad = 0 then 'agotado'::public.estado_lote else 'en_uso'::public.estado_lote end
       where lotes.id = v_lote_id;
    elsif exists (select 1 from public.lotes l where l.producto_id = v_producto_id and l.sede_id = v_sede and l.cantidad_disponible > 0 and l.estado in ('disponible', 'en_uso')) then
      raise exception 'Debe seleccionarse un lote utilizable para el producto %', v_producto_id;
    end if;

    update public.inventario_sede set existencia_actual = existencia_actual - v_cantidad where inventario_sede.id = v_inv_id;
    insert into public.detalle_atencion (atencion_id, producto_id, lote_id, cantidad, observaciones)
      values (v_atencion_id, v_producto_id, v_lote_id, v_cantidad, v_item_obs);
    insert into public.movimientos_inventario (producto_id, sede_id, lote_id, atencion_id, tipo, cantidad,
      existencia_anterior, existencia_posterior, usuario_id, observaciones)
      values (v_producto_id, v_sede, v_lote_id, v_atencion_id, 'salida_atencion', v_cantidad,
        v_anterior, v_anterior - v_cantidad, v_actor.id, v_item_obs);
  end loop;
  return query select v_atencion_id, v_codigo;
end $$;

revoke all on function public.registrar_atencion(public.tipo_persona,text,text,text,public.resultado_atencion,jsonb,timestamptz,bigint,bigint,uuid,text,text,text,text,text,numeric,integer,integer,numeric,text,text) from public, anon;
grant execute on function public.registrar_atencion(public.tipo_persona,text,text,text,public.resultado_atencion,jsonb,timestamptz,bigint,bigint,uuid,text,text,text,text,text,numeric,integer,integer,numeric,text,text) to authenticated;

commit;
