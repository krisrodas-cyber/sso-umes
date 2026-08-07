-- Operaciones atómicas y permisos acotados para la administración de inventario.
-- Preparada para revisión: esta migración no debe aplicarse automáticamente.
begin;

-- El enum histórico verificado en 001 usa "ingreso" y ya contiene
-- "ajuste_positivo" y "ajuste_negativo". No se renombran ni eliminan valores.

create or replace function public.registrar_entrada_inventario(
  p_producto_id bigint,
  p_sede_id bigint,
  p_cantidad numeric,
  p_numero_lote text default null,
  p_fecha_vencimiento date default null,
  p_observaciones text default null
) returns table (
  movimiento_id bigint,
  lote_id bigint,
  existencia_anterior numeric,
  existencia_posterior numeric
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor public.perfiles%rowtype;
  v_inventario_id bigint;
  v_lote_id bigint;
  v_movimiento_id bigint;
  v_anterior numeric(12,2);
  v_posterior numeric(12,2);
  v_numero_lote text := nullif(btrim(p_numero_lote), '');
  v_observaciones text := nullif(btrim(p_observaciones), '');
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Usuario no autenticado';
  end if;
  select * into v_actor from public.perfiles p where p.id = auth.uid() and p.activo for share;
  if not found or v_actor.rol not in ('administrador', 'monitora') then
    raise exception using errcode = '42501', message = 'Usuario no autorizado o inactivo';
  end if;
  if v_actor.rol = 'monitora' and p_sede_id is distinct from v_actor.sede_id then
    raise exception using errcode = '42501', message = 'No tienes permiso para modificar esta sede';
  end if;
  if p_producto_id is null or p_sede_id is null then
    raise exception using errcode = '22023', message = 'Producto y sede son obligatorios';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception using errcode = '22023', message = 'La cantidad debe ser mayor que cero';
  end if;
  if not exists (select 1 from public.productos p where p.id = p_producto_id and p.estado = 'activo') then
    raise exception using errcode = '22023', message = 'El producto no existe o está inactivo';
  end if;
  if not exists (select 1 from public.sedes s where s.id = p_sede_id and s.activa) then
    raise exception using errcode = '22023', message = 'La sede no existe o está inactiva';
  end if;

  insert into public.inventario_sede (producto_id, sede_id, existencia_actual, existencia_minima)
  values (p_producto_id, p_sede_id, 0, 0)
  on conflict (producto_id, sede_id) do nothing;

  select i.id, i.existencia_actual into v_inventario_id, v_anterior
  from public.inventario_sede i
  where i.producto_id = p_producto_id and i.sede_id = p_sede_id
  for update;
  if not found then raise exception 'No fue posible bloquear el inventario'; end if;
  v_posterior := v_anterior + p_cantidad;

  if v_numero_lote is not null or p_fecha_vencimiento is not null then
    select l.id into v_lote_id
    from public.lotes l
    where l.producto_id = p_producto_id
      and l.sede_id = p_sede_id
      and l.numero_lote is not distinct from v_numero_lote
      and (v_numero_lote is not null or l.fecha_vencimiento is not distinct from p_fecha_vencimiento)
    order by l.id
    limit 1
    for update;

    if v_lote_id is null then
      insert into public.lotes (producto_id, sede_id, numero_lote, fecha_vencimiento, cantidad_disponible, estado, observaciones)
      values (p_producto_id, p_sede_id, v_numero_lote, p_fecha_vencimiento, p_cantidad,
        case when p_fecha_vencimiento is not null and p_fecha_vencimiento < current_date
          then 'vencido'::public.estado_lote else 'disponible'::public.estado_lote end,
        v_observaciones)
      returning id into v_lote_id;
    else
      update public.lotes
      set cantidad_disponible = cantidad_disponible + p_cantidad,
          fecha_vencimiento = coalesce(p_fecha_vencimiento, fecha_vencimiento),
          estado = case when coalesce(p_fecha_vencimiento, fecha_vencimiento) is not null
            and coalesce(p_fecha_vencimiento, fecha_vencimiento) < current_date
            then 'vencido'::public.estado_lote else 'disponible'::public.estado_lote end,
          observaciones = coalesce(v_observaciones, observaciones)
      where id = v_lote_id;
    end if;
  end if;

  update public.inventario_sede set existencia_actual = v_posterior where id = v_inventario_id;
  insert into public.movimientos_inventario (
    producto_id, sede_id, lote_id, tipo, cantidad, existencia_anterior,
    existencia_posterior, usuario_id, observaciones
  ) values (
    p_producto_id, p_sede_id, v_lote_id, 'ingreso', p_cantidad, v_anterior,
    v_posterior, v_actor.id, v_observaciones
  ) returning id into v_movimiento_id;

  return query select v_movimiento_id, v_lote_id, v_anterior, v_posterior;
end $$;

create or replace function public.ajustar_inventario(
  p_producto_id bigint,
  p_sede_id bigint,
  p_tipo_ajuste public.tipo_movimiento,
  p_cantidad numeric,
  p_motivo text,
  p_observaciones text default null
) returns table (movimiento_id bigint, existencia_anterior numeric, existencia_posterior numeric)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor public.perfiles%rowtype;
  v_inventario_id bigint;
  v_movimiento_id bigint;
  v_anterior numeric(12,2);
  v_posterior numeric(12,2);
  v_motivo text := nullif(btrim(p_motivo), '');
  v_observaciones text := nullif(btrim(p_observaciones), '');
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Usuario no autenticado'; end if;
  select * into v_actor from public.perfiles p where p.id = auth.uid() and p.activo for share;
  if not found or v_actor.rol <> 'administrador' then
    raise exception using errcode = '42501', message = 'Solo un administrador puede ajustar inventario';
  end if;
  if p_tipo_ajuste is null or p_tipo_ajuste not in ('ajuste_positivo', 'ajuste_negativo') then
    raise exception using errcode = '22023', message = 'Tipo de ajuste no válido';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception using errcode = '22023', message = 'La cantidad debe ser mayor que cero';
  end if;
  if v_motivo is null then raise exception using errcode = '22023', message = 'El motivo es obligatorio'; end if;

  select i.id, i.existencia_actual into v_inventario_id, v_anterior
  from public.inventario_sede i
  where i.producto_id = p_producto_id and i.sede_id = p_sede_id
  for update;
  if not found then raise exception using errcode = '22023', message = 'No existe inventario para el producto y sede'; end if;

  v_posterior := case when p_tipo_ajuste = 'ajuste_positivo' then v_anterior + p_cantidad else v_anterior - p_cantidad end;
  if v_posterior < 0 then raise exception using errcode = '22023', message = 'La existencia no puede quedar negativa'; end if;

  update public.inventario_sede set existencia_actual = v_posterior where id = v_inventario_id;
  insert into public.movimientos_inventario (
    producto_id, sede_id, tipo, cantidad, existencia_anterior, existencia_posterior, usuario_id, observaciones
  ) values (
    p_producto_id, p_sede_id, p_tipo_ajuste, p_cantidad, v_anterior, v_posterior, v_actor.id,
    concat(v_motivo, case when v_observaciones is null then '' else ' · ' || v_observaciones end)
  ) returning id into v_movimiento_id;
  return query select v_movimiento_id, v_anterior, v_posterior;
end $$;

create or replace function public.actualizar_existencia_minima(
  p_producto_id bigint, p_sede_id bigint, p_existencia_minima numeric
) returns public.inventario_sede
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_actor public.perfiles%rowtype; v_resultado public.inventario_sede%rowtype;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Usuario no autenticado'; end if;
  select * into v_actor from public.perfiles p where p.id = auth.uid() and p.activo for share;
  if not found or v_actor.rol not in ('administrador', 'monitora') then raise exception using errcode = '42501', message = 'Usuario no autorizado o inactivo'; end if;
  if v_actor.rol = 'monitora' and p_sede_id is distinct from v_actor.sede_id then raise exception using errcode = '42501', message = 'No tienes permiso para modificar esta sede'; end if;
  if p_existencia_minima is null or p_existencia_minima < 0 then raise exception using errcode = '22023', message = 'La existencia mínima no puede ser negativa'; end if;
  update public.inventario_sede i set existencia_minima = p_existencia_minima
  where i.producto_id = p_producto_id and i.sede_id = p_sede_id returning i.* into v_resultado;
  if not found then raise exception using errcode = '22023', message = 'No existe inventario para el producto y sede'; end if;
  return v_resultado;
end $$;

create or replace function public.actualizar_producto_operativo(
  p_producto_id bigint, p_nombre text, p_categoria public.categoria_producto,
  p_presentacion text, p_unidad_medida text, p_unidad_dispensacion text
) returns public.productos
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_actor public.perfiles%rowtype; v_resultado public.productos%rowtype;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Usuario no autenticado'; end if;
  select * into v_actor from public.perfiles p where p.id = auth.uid() and p.activo for share;
  if not found or v_actor.rol not in ('administrador', 'monitora') then raise exception using errcode = '42501', message = 'Usuario no autorizado o inactivo'; end if;
  if v_actor.rol = 'monitora' and not exists (
    select 1 from public.inventario_sede i join public.productos p on p.id = i.producto_id
    where i.producto_id = p_producto_id and i.sede_id = v_actor.sede_id and p.estado = 'activo'
  ) then raise exception using errcode = '42501', message = 'El producto no está disponible en tu sede'; end if;
  if nullif(btrim(p_nombre), '') is null or nullif(btrim(p_unidad_medida), '') is null or p_categoria is null then
    raise exception using errcode = '22023', message = 'Nombre, categoría y unidad de medida son obligatorios';
  end if;
  update public.productos p set
    nombre = btrim(p_nombre), categoria = p_categoria, presentacion = nullif(btrim(p_presentacion), ''),
    unidad_medida = btrim(p_unidad_medida), unidad_dispensacion = nullif(btrim(p_unidad_dispensacion), '')
  where p.id = p_producto_id returning p.* into v_resultado;
  if not found then raise exception using errcode = '22023', message = 'Producto no encontrado'; end if;
  return v_resultado;
end $$;

create or replace function public.administrar_lote_inventario(
  p_lote_id bigint, p_producto_id bigint, p_sede_id bigint, p_numero_lote text,
  p_fecha_vencimiento date, p_observaciones text default null
) returns public.lotes
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_actor public.perfiles%rowtype; v_resultado public.lotes%rowtype; v_numero text := nullif(btrim(p_numero_lote), '');
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Usuario no autenticado'; end if;
  select * into v_actor from public.perfiles p where p.id = auth.uid() and p.activo for share;
  if not found or v_actor.rol not in ('administrador', 'monitora') then raise exception using errcode = '42501', message = 'Usuario no autorizado o inactivo'; end if;
  if v_actor.rol = 'monitora' and p_sede_id is distinct from v_actor.sede_id then raise exception using errcode = '42501', message = 'No tienes permiso para modificar esta sede'; end if;
  if p_lote_id is null then raise exception using errcode = '22023', message = 'El lote es obligatorio'; end if;
  if exists (select 1 from public.lotes l where l.producto_id = p_producto_id and l.sede_id = p_sede_id and l.numero_lote is not distinct from v_numero and l.id <> p_lote_id) then
    raise exception using errcode = '23505', message = 'Ya existe un lote con ese número para el producto y sede';
  end if;
  update public.lotes l set numero_lote = v_numero, fecha_vencimiento = p_fecha_vencimiento,
    observaciones = nullif(btrim(p_observaciones), ''),
    estado = case when p_fecha_vencimiento is not null and p_fecha_vencimiento < current_date then 'vencido'::public.estado_lote
      when l.cantidad_disponible = 0 then 'agotado'::public.estado_lote
      when l.estado = 'descartado' then l.estado else 'disponible'::public.estado_lote end
  where l.id = p_lote_id and l.producto_id = p_producto_id and l.sede_id = p_sede_id returning l.* into v_resultado;
  if not found then raise exception using errcode = '42501', message = 'Lote no encontrado o fuera de la sede permitida'; end if;
  return v_resultado;
end $$;

create or replace function public.crear_producto_inventario(
  p_codigo text, p_nombre text, p_categoria public.categoria_producto, p_presentacion text,
  p_unidad_medida text, p_unidad_dispensacion text, p_es_consumible boolean,
  p_permite_registro_sin_descuento boolean, p_activo boolean default true
) returns public.productos
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_actor public.perfiles%rowtype; v_resultado public.productos%rowtype; v_codigo text := upper(nullif(btrim(p_codigo), ''));
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Usuario no autenticado'; end if;
  select * into v_actor from public.perfiles p where p.id = auth.uid() and p.activo for share;
  if not found or v_actor.rol <> 'administrador' then raise exception using errcode = '42501', message = 'Solo un administrador puede crear productos'; end if;
  if v_codigo is null or nullif(btrim(p_nombre), '') is null or p_categoria is null or nullif(btrim(p_unidad_medida), '') is null then
    raise exception using errcode = '22023', message = 'Código, nombre, categoría y unidad de medida son obligatorios';
  end if;
  if exists (select 1 from public.productos p where upper(p.codigo) = v_codigo) then raise exception using errcode = '23505', message = 'Ya existe un producto con ese código'; end if;
  insert into public.productos (codigo, nombre, categoria, presentacion, unidad_medida, unidad_dispensacion, es_consumible, permite_registro_sin_descuento, estado)
  values (v_codigo, btrim(p_nombre), p_categoria, nullif(btrim(p_presentacion), ''), btrim(p_unidad_medida), nullif(btrim(p_unidad_dispensacion), ''),
    coalesce(p_es_consumible, true), coalesce(p_permite_registro_sin_descuento, false), case when coalesce(p_activo, true) then 'activo'::public.estado_producto else 'inactivo'::public.estado_producto end)
  returning * into v_resultado;
  return v_resultado;
end $$;

create or replace function public.actualizar_producto_administrador(
  p_producto_id bigint, p_codigo text, p_nombre text, p_categoria public.categoria_producto,
  p_presentacion text, p_unidad_medida text, p_unidad_dispensacion text,
  p_es_consumible boolean, p_permite_registro_sin_descuento boolean, p_activo boolean
) returns public.productos
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_actor public.perfiles%rowtype; v_resultado public.productos%rowtype; v_codigo text := upper(nullif(btrim(p_codigo), ''));
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Usuario no autenticado'; end if;
  select * into v_actor from public.perfiles p where p.id = auth.uid() and p.activo for share;
  if not found or v_actor.rol <> 'administrador' then raise exception using errcode = '42501', message = 'Solo un administrador puede editar estos campos'; end if;
  if v_codigo is null or nullif(btrim(p_nombre), '') is null or p_categoria is null or nullif(btrim(p_unidad_medida), '') is null then
    raise exception using errcode = '22023', message = 'Código, nombre, categoría y unidad de medida son obligatorios';
  end if;
  if exists (select 1 from public.productos p where upper(p.codigo) = v_codigo and p.id <> p_producto_id) then raise exception using errcode = '23505', message = 'Ya existe un producto con ese código'; end if;
  update public.productos p set codigo = v_codigo, nombre = btrim(p_nombre), categoria = p_categoria,
    presentacion = nullif(btrim(p_presentacion), ''), unidad_medida = btrim(p_unidad_medida),
    unidad_dispensacion = nullif(btrim(p_unidad_dispensacion), ''), es_consumible = coalesce(p_es_consumible, true),
    permite_registro_sin_descuento = coalesce(p_permite_registro_sin_descuento, false),
    estado = case when coalesce(p_activo, true) then 'activo'::public.estado_producto else 'inactivo'::public.estado_producto end
  where p.id = p_producto_id returning p.* into v_resultado;
  if not found then raise exception using errcode = '22023', message = 'Producto no encontrado'; end if;
  return v_resultado;
end $$;

create or replace function public.cambiar_estado_producto_inventario(p_producto_id bigint, p_activo boolean)
returns public.productos language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_actor public.perfiles%rowtype; v_resultado public.productos%rowtype;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Usuario no autenticado'; end if;
  select * into v_actor from public.perfiles p where p.id = auth.uid() and p.activo for share;
  if not found or v_actor.rol <> 'administrador' then raise exception using errcode = '42501', message = 'Solo un administrador puede cambiar el estado del producto'; end if;
  update public.productos p set estado = case when p_activo then 'activo'::public.estado_producto else 'inactivo'::public.estado_producto end
  where p.id = p_producto_id returning p.* into v_resultado;
  if not found then raise exception using errcode = '22023', message = 'Producto no encontrado'; end if;
  return v_resultado;
end $$;

-- La monitora consulta todos los movimientos de su sede, nunca los de otra sede.
drop policy if exists movimientos_select on public.movimientos_inventario;
create policy movimientos_select on public.movimientos_inventario for select to authenticated using (
  public.is_admin() or public.is_rrhh() or
  (public.is_monitora() and sede_id = public.current_user_sede_id())
);

-- Los productos inactivos siguen resolviendo su nombre en historiales y
-- movimientos. Las pantallas operativas filtran explícitamente estado activo.
drop policy if exists productos_select on public.productos;
create policy productos_select on public.productos for select to authenticated using (
  public.current_user_role() is not null
);

revoke all on function public.registrar_entrada_inventario(bigint,bigint,numeric,text,date,text) from public, anon;
revoke all on function public.ajustar_inventario(bigint,bigint,public.tipo_movimiento,numeric,text,text) from public, anon;
revoke all on function public.actualizar_existencia_minima(bigint,bigint,numeric) from public, anon;
revoke all on function public.actualizar_producto_operativo(bigint,text,public.categoria_producto,text,text,text) from public, anon;
revoke all on function public.administrar_lote_inventario(bigint,bigint,bigint,text,date,text) from public, anon;
revoke all on function public.crear_producto_inventario(text,text,public.categoria_producto,text,text,text,boolean,boolean,boolean) from public, anon;
revoke all on function public.actualizar_producto_administrador(bigint,text,text,public.categoria_producto,text,text,text,boolean,boolean,boolean) from public, anon;
revoke all on function public.cambiar_estado_producto_inventario(bigint,boolean) from public, anon;
grant execute on function public.registrar_entrada_inventario(bigint,bigint,numeric,text,date,text) to authenticated;
grant execute on function public.ajustar_inventario(bigint,bigint,public.tipo_movimiento,numeric,text,text) to authenticated;
grant execute on function public.actualizar_existencia_minima(bigint,bigint,numeric) to authenticated;
grant execute on function public.actualizar_producto_operativo(bigint,text,public.categoria_producto,text,text,text) to authenticated;
grant execute on function public.administrar_lote_inventario(bigint,bigint,bigint,text,date,text) to authenticated;
grant execute on function public.crear_producto_inventario(text,text,public.categoria_producto,text,text,text,boolean,boolean,boolean) to authenticated;
grant execute on function public.actualizar_producto_administrador(bigint,text,text,public.categoria_producto,text,text,text,boolean,boolean,boolean) to authenticated;
grant execute on function public.cambiar_estado_producto_inventario(bigint,boolean) to authenticated;

commit;
