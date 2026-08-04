-- Esquema inicial del Sistema de Atenciones SSO UMES.
-- Diseñado para PostgreSQL/Supabase. No crea usuarios de Authentication.

do $$ begin create type public.rol_usuario as enum ('administrador', 'monitora', 'rrhh'); exception when duplicate_object then null; end $$;
do $$ begin create type public.tipo_persona as enum ('estudiante', 'docente', 'administrativo', 'visitante'); exception when duplicate_object then null; end $$;
do $$ begin create type public.resultado_atencion as enum ('atendido_retirado', 'reposo', 'referido_clinica', 'traslado_hospital', 'aviso_familiar', 'otro'); exception when duplicate_object then null; end $$;
do $$ begin create type public.categoria_producto as enum ('medicamento', 'insumo'); exception when duplicate_object then null; end $$;
do $$ begin create type public.estado_producto as enum ('activo', 'inactivo'); exception when duplicate_object then null; end $$;
do $$ begin create type public.estado_lote as enum ('disponible', 'en_uso', 'agotado', 'vencido', 'descartado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.tipo_movimiento as enum ('inventario_inicial', 'ingreso', 'salida_atencion', 'ajuste_positivo', 'ajuste_negativo', 'vencimiento', 'traslado_entrada', 'traslado_salida'); exception when duplicate_object then null; end $$;

create table public.sedes (
  id bigint generated always as identity primary key,
  nombre text unique not null check (nullif(btrim(nombre), '') is not null),
  codigo text unique not null check (nullif(btrim(codigo), '') is not null),
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.turnos (
  id bigint generated always as identity primary key,
  nombre text unique not null check (nullif(btrim(nombre), '') is not null),
  codigo text unique not null check (nullif(btrim(codigo), '') is not null),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null check (nullif(btrim(nombre_completo), '') is not null),
  correo text unique not null check (nullif(btrim(correo), '') is not null),
  rol public.rol_usuario not null,
  sede_id bigint references public.sedes(id),
  turno_id bigint references public.turnos(id),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint perfiles_monitora_ubicacion_chk check (rol <> 'monitora' or (sede_id is not null and turno_id is not null)),
  constraint perfiles_correo_minusculas_chk check (correo = lower(correo))
);

create table public.productos (
  id bigint generated always as identity primary key,
  codigo text unique not null check (nullif(btrim(codigo), '') is not null),
  nombre text not null check (nullif(btrim(nombre), '') is not null),
  categoria public.categoria_producto not null,
  presentacion text,
  unidad_medida text not null check (nullif(btrim(unidad_medida), '') is not null),
  descripcion text,
  estado public.estado_producto not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventario_sede (
  id bigint generated always as identity primary key,
  producto_id bigint not null references public.productos(id),
  sede_id bigint not null references public.sedes(id),
  existencia_actual numeric(12,2) not null default 0 check (existencia_actual >= 0),
  existencia_minima numeric(12,2) not null default 0 check (existencia_minima >= 0),
  updated_at timestamptz not null default now(),
  unique (producto_id, sede_id)
);

create table public.lotes (
  id bigint generated always as identity primary key,
  producto_id bigint not null references public.productos(id),
  sede_id bigint not null references public.sedes(id),
  numero_lote text,
  fecha_vencimiento date,
  cantidad_disponible numeric(12,2) not null default 0 check (cantidad_disponible >= 0),
  estado public.estado_lote not null default 'disponible',
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence public.atenciones_codigo_seq;

create table public.atenciones (
  id bigint generated always as identity primary key,
  codigo text unique,
  fecha_hora timestamptz not null default now(),
  sede_id bigint not null references public.sedes(id),
  turno_id bigint not null references public.turnos(id),
  monitora_id uuid not null references public.perfiles(id),
  tipo_persona public.tipo_persona not null,
  nombre_persona text not null check (nullif(btrim(nombre_persona), '') is not null),
  identificacion_institucional text,
  facultad_carrera_departamento text,
  telefono text,
  motivo_atencion text not null check (nullif(btrim(motivo_atencion), '') is not null),
  sintomas_referidos text,
  presion_arterial text,
  temperatura numeric(4,1) check (temperatura is null or temperatura between 25 and 45),
  frecuencia_cardiaca integer check (frecuencia_cardiaca is null or frecuencia_cardiaca between 20 and 250),
  saturacion_oxigeno integer check (saturacion_oxigeno is null or saturacion_oxigeno between 0 and 100),
  glucosa numeric(6,2) check (glucosa is null or glucosa >= 0),
  atencion_realizada text not null check (nullif(btrim(atencion_realizada), '') is not null),
  observaciones text,
  resultado public.resultado_atencion not null,
  resultado_otro text,
  created_at timestamptz not null default now(),
  constraint atenciones_resultado_otro_chk check (resultado <> 'otro' or nullif(btrim(resultado_otro), '') is not null)
);

create table public.detalle_atencion (
  id bigint generated always as identity primary key,
  atencion_id bigint not null references public.atenciones(id) on delete restrict,
  producto_id bigint not null references public.productos(id),
  lote_id bigint references public.lotes(id),
  cantidad numeric(12,2) not null check (cantidad > 0),
  observaciones text,
  created_at timestamptz not null default now()
);

create table public.movimientos_inventario (
  id bigint generated always as identity primary key,
  producto_id bigint not null references public.productos(id),
  sede_id bigint not null references public.sedes(id),
  lote_id bigint references public.lotes(id),
  atencion_id bigint references public.atenciones(id),
  tipo public.tipo_movimiento not null,
  cantidad numeric(12,2) not null check (cantidad > 0),
  existencia_anterior numeric(12,2) not null check (existencia_anterior >= 0),
  existencia_posterior numeric(12,2) not null check (existencia_posterior >= 0),
  usuario_id uuid not null references public.perfiles(id),
  observaciones text,
  created_at timestamptz not null default now()
);

create table public.auditoria (
  id bigint generated always as identity primary key,
  tabla text not null,
  registro_id text not null,
  accion text not null,
  usuario_id uuid references public.perfiles(id),
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  created_at timestamptz not null default now()
);

create index perfiles_rol_sede_turno_idx on public.perfiles (rol, sede_id, turno_id);
create index productos_nombre_idx on public.productos (nombre);
create index productos_categoria_estado_idx on public.productos (categoria, estado);
create index inventario_sede_sede_producto_idx on public.inventario_sede (sede_id, producto_id);
create index lotes_sede_producto_vencimiento_estado_idx on public.lotes (sede_id, producto_id, fecha_vencimiento, estado);
create index atenciones_fecha_hora_idx on public.atenciones (fecha_hora desc);
create index atenciones_sede_turno_monitora_tipo_idx on public.atenciones (sede_id, turno_id, monitora_id, tipo_persona);
create index detalle_atencion_atencion_producto_idx on public.detalle_atencion (atencion_id, producto_id);
create index movimientos_fecha_idx on public.movimientos_inventario (created_at desc);
create index movimientos_sede_producto_usuario_atencion_idx on public.movimientos_inventario (sede_id, producto_id, usuario_id, atencion_id);

create or replace function public.current_user_role()
returns public.rol_usuario language sql stable security definer set search_path = pg_catalog, public
as $$ select p.rol from public.perfiles p where p.id = auth.uid() and p.activo $$;
create or replace function public.current_user_sede_id()
returns bigint language sql stable security definer set search_path = pg_catalog, public
as $$ select p.sede_id from public.perfiles p where p.id = auth.uid() and p.activo $$;
create or replace function public.current_user_turno_id()
returns bigint language sql stable security definer set search_path = pg_catalog, public
as $$ select p.turno_id from public.perfiles p where p.id = auth.uid() and p.activo $$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = pg_catalog, public
as $$ select coalesce((select p.rol = 'administrador' from public.perfiles p where p.id = auth.uid() and p.activo), false) $$;
create or replace function public.is_rrhh()
returns boolean language sql stable security definer set search_path = pg_catalog, public
as $$ select coalesce((select p.rol = 'rrhh' from public.perfiles p where p.id = auth.uid() and p.activo), false) $$;
create or replace function public.is_monitora()
returns boolean language sql stable security definer set search_path = pg_catalog, public
as $$ select coalesce((select p.rol = 'monitora' from public.perfiles p where p.id = auth.uid() and p.activo), false) $$;

revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_sede_id() from public;
revoke all on function public.current_user_turno_id() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_rrhh() from public;
revoke all on function public.is_monitora() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_sede_id() to authenticated;
grant execute on function public.current_user_turno_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_rrhh() to authenticated;
grant execute on function public.is_monitora() to authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = pg_catalog
as $$ begin new.updated_at := now(); return new; end $$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger perfiles_set_updated_at before update on public.perfiles for each row execute function public.set_updated_at();
create trigger productos_set_updated_at before update on public.productos for each row execute function public.set_updated_at();
create trigger inventario_sede_set_updated_at before update on public.inventario_sede for each row execute function public.set_updated_at();
create trigger lotes_set_updated_at before update on public.lotes for each row execute function public.set_updated_at();

create or replace function public.asignar_codigo_atencion()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$ begin
  -- Se sobrescribe cualquier valor recibido: el cliente nunca controla el código.
  new.codigo := 'ATE-' || to_char(coalesce(new.fecha_hora, now()), 'YYYY') || '-' || lpad(nextval('public.atenciones_codigo_seq')::text, 6, '0');
  return new;
end $$;
revoke all on function public.asignar_codigo_atencion() from public, anon, authenticated;

create or replace function public.validar_atencion_actor()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_actor public.perfiles%rowtype; v_monitora public.perfiles%rowtype;
begin
  select * into v_actor from public.perfiles where id = auth.uid() and activo for share;
  if not found or v_actor.rol = 'rrhh' then raise exception 'Usuario no autorizado para registrar atenciones'; end if;
  select * into v_monitora from public.perfiles where id = new.monitora_id and activo and rol in ('monitora', 'administrador') for share;
  if not found then raise exception 'El responsable debe ser una monitora o administrador activo'; end if;
  if v_actor.rol = 'monitora' and (new.monitora_id <> auth.uid() or new.sede_id is distinct from v_actor.sede_id or new.turno_id is distinct from v_actor.turno_id) then
    raise exception 'La monitora solo puede registrar en su sede y turno asignados';
  end if;
  return new;
end $$;
revoke all on function public.validar_atencion_actor() from public, anon, authenticated;

create trigger atenciones_asignar_codigo before insert on public.atenciones for each row execute function public.asignar_codigo_atencion();
create trigger atenciones_validar_actor before insert on public.atenciones for each row execute function public.validar_atencion_actor();

create or replace function public.validar_detalle_atencion_lote()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_sede_atencion bigint;
begin
  if new.lote_id is null then return new; end if;

  select a.sede_id into v_sede_atencion
    from public.atenciones a where a.id = new.atencion_id;
  if not found then raise exception 'La atención indicada no existe'; end if;

  if not exists (
    select 1 from public.lotes l
     where l.id = new.lote_id
       and l.producto_id = new.producto_id
       and l.sede_id = v_sede_atencion
  ) then
    raise exception 'El lote debe pertenecer al producto y a la sede de la atención';
  end if;
  return new;
end $$;
revoke all on function public.validar_detalle_atencion_lote() from public, anon, authenticated;

create trigger detalle_atencion_validar_lote
before insert or update of atencion_id, producto_id, lote_id on public.detalle_atencion
for each row execute function public.validar_detalle_atencion_lote();

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
    select * into v_responsable from public.perfiles
      where perfiles.id = v_monitora and activo and rol in ('monitora', 'administrador') for share;
    if not found then raise exception 'El responsable debe ser una monitora o administrador activo'; end if;
    if v_responsable.rol = 'monitora'
       and (v_sede is distinct from v_responsable.sede_id or v_turno is distinct from v_responsable.turno_id) then
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
    v_item_obs := v_item->>'observaciones';
    if v_producto_id is null or v_cantidad is null or v_cantidad <= 0 then raise exception 'Producto y cantidad positiva son obligatorios'; end if;
    if not exists (select 1 from public.productos where productos.id = v_producto_id and estado = 'activo') then raise exception 'Producto % inexistente o inactivo', v_producto_id; end if;

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
    elsif exists (
      select 1 from public.lotes l
       where l.producto_id = v_producto_id and l.sede_id = v_sede
         and l.cantidad_disponible > 0 and l.estado in ('disponible', 'en_uso')
    ) then
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

create view public.vista_inventario_alertas with (security_invoker = true) as
select p.id producto_id, p.codigo, p.nombre producto, p.categoria, s.id sede_id, s.nombre sede,
  i.existencia_actual, i.existencia_minima,
  case when i.existencia_actual = 0 then 'agotado' when i.existencia_actual <= i.existencia_minima then 'bajo' else 'normal' end estado_alerta
from public.inventario_sede i join public.productos p on p.id = i.producto_id join public.sedes s on s.id = i.sede_id;

create view public.vista_lotes_vencimiento with (security_invoker = true) as
select l.id lote_id, p.nombre producto, s.nombre sede, l.numero_lote, l.fecha_vencimiento, l.cantidad_disponible,
  case when l.fecha_vencimiento is null then 'sin_fecha'
       when l.fecha_vencimiento < current_date then 'vencido'
       when l.fecha_vencimiento <= current_date + 30 then 'vence_30_dias'
       when l.fecha_vencimiento <= current_date + 90 then 'vence_90_dias' else 'vigente' end estado_vencimiento
from public.lotes l join public.productos p on p.id = l.producto_id join public.sedes s on s.id = l.sede_id;

alter table public.sedes enable row level security;
alter table public.turnos enable row level security;
alter table public.perfiles enable row level security;
alter table public.productos enable row level security;
alter table public.inventario_sede enable row level security;
alter table public.lotes enable row level security;
alter table public.atenciones enable row level security;
alter table public.detalle_atencion enable row level security;
alter table public.movimientos_inventario enable row level security;
alter table public.auditoria enable row level security;

create policy sedes_select_activos on public.sedes for select to authenticated using (public.current_user_role() is not null);
create policy sedes_admin_insert on public.sedes for insert to authenticated with check (public.is_admin());
create policy sedes_admin_update on public.sedes for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy sedes_admin_delete on public.sedes for delete to authenticated using (public.is_admin());
create policy turnos_select_activos on public.turnos for select to authenticated using (public.current_user_role() is not null);
create policy turnos_admin_insert on public.turnos for insert to authenticated with check (public.is_admin());
create policy turnos_admin_update on public.turnos for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy turnos_admin_delete on public.turnos for delete to authenticated using (public.is_admin());

create policy perfiles_select on public.perfiles for select to authenticated
 using (id = auth.uid() or public.is_admin() or (public.is_rrhh() and rol = 'monitora'));
create policy perfiles_admin_insert on public.perfiles for insert to authenticated with check (public.is_admin());
create policy perfiles_admin_update on public.perfiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy perfiles_admin_delete on public.perfiles for delete to authenticated using (public.is_admin());

create policy productos_select on public.productos for select to authenticated
 using (public.current_user_role() is not null and (estado = 'activo' or public.is_admin()));
create policy productos_admin_insert on public.productos for insert to authenticated with check (public.is_admin());
create policy productos_admin_update on public.productos for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy productos_admin_delete on public.productos for delete to authenticated using (public.is_admin());

create policy inventario_select on public.inventario_sede for select to authenticated
 using (public.is_admin() or public.is_rrhh() or (public.is_monitora() and sede_id = public.current_user_sede_id()));
create policy inventario_admin_all on public.inventario_sede for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy lotes_select on public.lotes for select to authenticated
 using (public.is_admin() or public.is_rrhh() or (public.is_monitora() and sede_id = public.current_user_sede_id()));
create policy lotes_admin_all on public.lotes for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy atenciones_select on public.atenciones for select to authenticated
 using (public.is_admin() or public.is_rrhh() or (public.is_monitora() and monitora_id = auth.uid()));

create policy detalle_select on public.detalle_atencion for select to authenticated using (
  public.is_admin() or public.is_rrhh() or (public.is_monitora() and exists
    (select 1 from public.atenciones a where a.id = atencion_id and a.monitora_id = auth.uid())));
create policy movimientos_select on public.movimientos_inventario for select to authenticated using (
  public.is_admin() or public.is_rrhh() or (public.is_monitora() and (usuario_id = auth.uid() or exists
    (select 1 from public.atenciones a where a.id = atencion_id and a.monitora_id = auth.uid()))));
create policy auditoria_admin_select on public.auditoria for select to authenticated using (public.is_admin());

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on public.vista_inventario_alertas, public.vista_lotes_vencimiento from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from authenticated;
grant select on public.sedes, public.turnos, public.perfiles, public.productos, public.inventario_sede,
  public.lotes, public.atenciones, public.detalle_atencion, public.movimientos_inventario,
  public.auditoria, public.vista_inventario_alertas, public.vista_lotes_vencimiento to authenticated;

comment on function public.registrar_atencion(public.tipo_persona,text,text,text,public.resultado_atencion,jsonb,timestamptz,bigint,bigint,uuid,text,text,text,text,text,numeric,integer,integer,numeric,text,text)
is 'Registra atencion y descuenta inventario/lote atómicamente. Monitoras no controlan sede, turno ni responsable.';
