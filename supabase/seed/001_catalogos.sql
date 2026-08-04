-- Catálogos base. No crea usuarios, perfiles, productos ni pacientes.
insert into public.sedes (codigo, nombre)
values ('Z3', 'SSO zona 3'), ('Z9', 'SSO zona 9')
on conflict (codigo) do update set nombre = excluded.nombre;

insert into public.turnos (codigo, nombre)
values ('MAT', 'Matutino'), ('VES', 'Vespertino')
on conflict (codigo) do update set nombre = excluded.nombre;
