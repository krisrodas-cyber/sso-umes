-- Preparacion del staging para la conciliacion manual del inventario oficial de SSO Zona 9.
-- Fuente: data/fuentes/Medicamentos e insumos CZ9.docx (103 articulos).
--
-- IMPORTANTE:
--   * Este archivo esta destinado a revision y ejecucion manual. No es una migracion.
--   * Solo prepara datos auxiliares; no modifica inventario, lotes ni productos.
--   * Las equivalencias confirmadas se reutilizan sin cambiar nombres ni atributos globales.
--   * Los productos son un catalogo compartido: se reutilizan solo equivalencias inequívocas
--     y se crean productos nuevos cuando la presentacion o identidad no coincide con certeza.
--   * La fuente expresa vencimientos como mes/anio. Para conservarlos en una columna DATE,
--     se usa el ultimo dia calendario del mes declarado y se deja constancia en observaciones.
--   * La fuente no contiene numeros de lote. Se crean lotes anonimos (numero_lote = null).
--   * Los articulos sin vencimiento declarado conservan inventario, pero no generan lote.
--
-- El script reemplaza el conteo fisico completo de Z9: productos anteriores no incluidos
-- en la fuente oficial quedan con existencia cero. Los lotes anteriores de Z9 tambien quedan
-- en cero antes de crear/actualizar los lotes anonimos que representan la fuente oficial.

begin;

do $$
begin
  if to_regclass('public._recon_z9_official_inventory_20260826') is not null then
    raise exception 'Ya existe public._recon_z9_official_inventory_20260826; revise una ejecucion anterior incompleta';
  end if;

  if to_regclass('public._recon_z9_product_map_20260826') is not null then
    raise exception 'Ya existe public._recon_z9_product_map_20260826; revise una ejecucion anterior incompleta';
  end if;

  if to_regclass('public._recon_z9_products_zeroed_20260826') is not null then
    raise exception 'Ya existe public._recon_z9_products_zeroed_20260826; revise una ejecucion anterior incompleta';
  end if;
end
$$;

create table public._recon_z9_official_inventory_20260826 (
  ordinal integer primary key,
  official_name text not null,
  quantity numeric(12,2) not null check (quantity >= 0),
  expiry_month text,
  expiry_date date,
  existing_code text,
  new_code text,
  canonical_name text not null,
  category public.categoria_producto not null,
  presentation text,
  unit_of_measure text not null,
  dispensing_unit text not null,
  constraint zone9_official_product_reference_chk check (
    (existing_code is not null and new_code is null)
    or (existing_code is null and new_code is not null)
  ),
  constraint zone9_official_expiry_chk check (
    (expiry_month is null and expiry_date is null)
    or (expiry_month is not null and expiry_date is not null)
  )
);

insert into public._recon_z9_official_inventory_20260826
  (ordinal, official_name, quantity, expiry_month, expiry_date, existing_code, new_code,
   canonical_name, category, presentation, unit_of_measure, dispensing_unit)
values
  (1, 'Vitaflenaco tabletas', 300, '09/2027', '2027-09-30', '25A', null, 'VITAFLENACO - 1 CAPSULA GEL', 'medicamento', 'capsula', 'capsula', 'capsula'),
  (2, 'Dolo neurobion tabletas', 103, '08/2027', '2027-08-31', '21A', null, 'DOLONEUROBION - 1 TABLETA', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (3, 'Acetaminofen Tabletas', 666, '04/2027', '2027-04-30', '8A', null, 'ACETAMINOFEM GENFAR 500 MG - 100 TABLETA', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (4, 'Nauseol tabletas', 239, '06/2027', '2027-06-30', '29A', null, 'NAUSEOL 50MG - 1 COMPRIMIDO', 'medicamento', 'comprimido', 'comprimido', 'comprimido'),
  (5, 'Lansoprazol tabletas', 227, '01/2027', '2027-01-31', '51A', null, 'LANSOPRAZOL CAJA - 100 UNIDADES', 'medicamento', 'caja', 'caja', 'unidad'),
  (6, 'Ibuprofeno 800 mg tableta', 89, '03/2027', '2027-03-31', '14A', null, 'TRIPROFEN (IBUPROFENO) 800MG - 10 TABLETA', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (7, 'Tabcin Gripe y tos tableta', 90, '09/2027', '2027-09-30', '5A', null, 'TABCIN GRIPE Y TOS - 60 TABLETAS', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (8, 'Gloranta sobre', 205, '05/2027', '2027-05-31', 'MED-AUTO-026', null, 'GLORANTA SABORES SURTIDOS 100 CARAMELOS (25 SOBRES X 4)', 'medicamento', 'sobre', 'sobre', 'sobre'),
  (9, 'Sertal compuesto tableta', 64, '03/2028', '2028-03-31', '27A', null, 'SERTAL COMPUESTO 125MG/10MG - 1 COMPRIMIDO', 'medicamento', 'comprimido', 'comprimido', 'comprimido'),
  (10, 'I.R.S tabletas', 533, '04/2027', '2027-04-30', '23A', null, 'I.R.S. - 1 TABLETA', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (11, 'Acerca tabletas', 142, '11/2026', '2026-11-30', '31A', null, 'ACERCA - 10 TABLETA', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (12, 'Loratadina tabletas', 57, '10/2027', '2027-10-31', '37A', null, 'LORATADINA FAMANDINA 10MG - 1 TABLETA', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (13, 'Histaprin tabletas', 146, '03/2029', '2029-03-31', 'MED-AUTO-034', null, 'HISTAPRIN 4MG/32MG - 10 COMPRIMIDOS', 'medicamento', 'comprimido', 'comprimido', 'comprimido'),
  (14, 'Diclofenaco tabletas', 111, '05/2027', '2027-05-31', '50A', null, 'DICLOFENACO 50 MG TABLETA', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (15, 'Desloratadina Tabletas', 38, '11/2027', '2027-11-30', '59A', null, 'DESLORATADINA 5MG - 10 TABLETA', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (16, 'Metocarbamol tabletas', 140, '11/2026', '2026-11-30', '28A', null, 'METOCARBAMOL ECOMED 500MG - 10 TABLETAS', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (17, 'Ibuprofeno 600 mg tabletas', 194, '04/2028', '2028-04-30', '6A', null, 'IBUPROFENO GENFAR 600MG - 50 TABLETA', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (18, 'Doribal tabletas', 76, '11/2027', '2027-11-30', '36A', null, 'DORIVAL 200MG - 36 CAPSULAS GEL', 'medicamento', 'capsula', 'capsula', 'capsula'),
  (19, 'Aspirina forte tableta', 32, '02/2027', '2027-02-28', '38A', null, 'ASPIRINA FORTE 650MG - 1 TABLETA', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (20, 'Metronidazol tableta', 101, '11/2027', '2027-11-30', 'MED-AUTO-044', null, 'METRONIDAZOL 500 MG TABLETAS', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (21, 'Enzimas digestivas tabletas', 75, '09/2028', '2028-09-30', null, 'Z9-MED-004', 'ENZIMAS DIGESTIVAS TABLETA', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (22, 'Alka AD tabletas', 17, '11/2028', '2028-11-30', null, 'Z9-MED-005', 'ALKA AD TABLETA', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (23, 'Simeticona tabletas', 64, '10/2028', '2028-10-31', '22A', null, 'AERO OM VAINILLA 40MG - 1 COMPRIMIDO MASTICABLE', 'medicamento', 'comprimido', 'comprimido', 'comprimido'),
  (24, 'Suero de rehidratacion sobre', 431, '02/2027', '2027-02-28', '45A', null, 'HIDROXONA MIX DE ELECTROLITOS SABORES- 30 SOBRES POLVO', 'medicamento', 'sobre', 'sobre', 'sobre'),
  (25, 'Pasinerva tableta', 15, '06/2027', '2027-06-30', '24A', null, 'PASINERVA - 5 CAPSULAS', 'medicamento', 'capsula', 'capsula', 'capsula'),
  (26, 'Aspirina tableta', 20, '04/2027', '2027-04-30', null, 'Z9-MED-009', 'ASPIRINA TABLETA', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (27, 'Dexketoprofeno tabletas', 16, '04/2028', '2028-04-30', '19A', null, 'DESKETOPROFENO 25 MG TABLETA', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (28, 'Protogastric frasco', 4, '08/2028', '2028-08-31', null, 'Z9-MED-010', 'PROTOGASTRIC FRASCO', 'medicamento', 'frasco', 'frasco', 'frasco'),
  (29, 'Bromuro frasco', 2, '08/2027', '2027-08-31', '55A', null, 'IBATROPIUM VIAL 20ML VIJOSA', 'medicamento', 'vial', 'unidad', 'unidad'),
  (30, 'Budesonida frasco', 2, '11/2026', '2026-11-30', '8B', null, 'BUDENA BUDEGEN 10ML', 'insumo', 'unidad', 'unidad', 'unidad'),
  (31, 'Ampolla para esterilizar', 4, null, null, '6B', null, 'AMPOLLAS PARA ESTERILIZAR EQUIPO 5CC', 'insumo', 'ampolla', 'ampolla', 'ampolla'),
  (32, 'Cardio aspirina tabletas', 30, '09/2027', '2027-09-30', '3A', null, 'CARDIOASPIRINA 81MG', 'medicamento', 'tableta', 'unidad', 'unidad'),
  (33, 'Enalapril tableta', 12, '07/2027', '2027-07-31', 'MED-AUTO-023', null, 'ENALAPRIL 20 MG TABLETA', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (34, 'Clorfeniramida tableta', 66, '11/2028', '2028-11-30', '33A', null, 'CLORFENIRAMINA ECOMED 4MG - 10 TABLETA', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (35, 'Hipopress gotero', 2, '08/2027', '2027-08-31', '43A', null, 'HIPOPRES GOTERO', 'medicamento', 'gotero', 'unidad', 'unidad'),
  (36, 'Dipirona ampolla', 29, '08/2028', '2028-08-31', 'MED-AUTO-019', null, 'DIPIRONA 1G/2 ML AMPOLLA', 'medicamento', 'ampolla', 'ampolla', 'ampolla'),
  (37, 'Clorfeniramida ampolla', 7, '09/2029', '2029-09-30', '57A', null, 'CLORFENIRAMINA SELECT AMPOLLA', 'medicamento', 'ampolla', 'ampolla', 'ampolla'),
  (38, 'Dexametazona ampolla', 9, '05/2028', '2028-05-31', '49A', null, 'DEXAMETASONA AMPOLLA', 'medicamento', 'ampolla', 'ampolla', 'ampolla'),
  (39, 'Metocarbamol ampolla', 21, '10/2029', '2029-10-31', '52A', null, 'METOCARBAMOL 100MG/5ML AMPOLLA', 'medicamento', 'ampolla', 'ampolla', 'ampolla'),
  (40, 'Vitamina K ampolla', 31, '06/2027', '2027-06-30', '56A', null, 'VITAMINA K / BONADINA AMPOLLA', 'medicamento', 'ampolla', 'ampolla', 'ampolla'),
  (41, 'Nauseol ampolla', 25, '06/2027', '2027-06-30', '58A', null, 'NAUSEOL 50 MG/1ML AMPOLLA', 'medicamento', 'ampolla', 'ampolla', 'ampolla'),
  (42, 'Diclofenaco ampolla', 9, '02/2028', '2028-02-29', 'MED-AUTO-016', null, 'DICLOFENACO 75 MG/3 ML AMPOLLA', 'medicamento', 'ampolla', 'ampolla', 'ampolla'),
  (43, 'Histaprin ampolla', 11, '10/2028', '2028-10-31', '34A', null, 'HISTAPRIM 10MG/1 ML AMPOLLA', 'medicamento', 'ampolla', 'ampolla', 'ampolla'),
  (44, 'Dexketoprofeno ampolla', 10, '02/2029', '2029-02-28', '48A', null, 'DESKETOPROFENO AMPOLLA', 'medicamento', 'ampolla', 'ampolla', 'ampolla'),
  (45, 'Diclolev ampollas', 57, '06/2027', '2027-06-30', '39A', null, 'DICLOLEV 75MG/3ML - 2 SOLUCION INYECTABLE IM (KIT)', 'medicamento', null, 'unidad', 'unidad'),
  (46, 'Neumonil ampolla', 42, '09/2028', '2028-09-30', '10A', null, 'NEUOMONIL 1 SOLUCION INYECTABLE', 'medicamento', 'ampolla', 'unidad', 'unidad'),
  (47, 'Doloneurobion ampolla', 30, '03/2027', '2027-03-31', null, 'Z9-MED-014', 'DOLONEUROBION AMPOLLA', 'medicamento', 'ampolla', 'ampolla', 'ampolla'),
  (48, 'Lidocaina frasco', 2, '10/2027', '2027-10-31', '19B', null, 'LIDOCAINA 2% FRASCO', 'insumo', 'frasco', 'frasco', 'frasco'),
  (49, 'Complejo B frasco', 14, '08/2027', '2027-08-31', '47A', null, 'COMPLEJO B VIAL', 'medicamento', 'frasco', 'unidad', 'unidad'),
  (50, 'Gasas vaselinadas', 12, '05/2027', '2027-05-31', 'INS-AUTO-021', null, 'GASAS VASELINADAS', 'insumo', 'unidad', 'unidad', 'unidad'),
  (51, 'Stoper', 9, '10/2029', '2029-10-31', '27B', null, 'STOPPER', 'insumo', 'unidad', 'unidad', 'unidad'),
  (52, 'Neobol frasco spray', 2, '03/2028', '2028-03-31', '4A', null, 'NEOBOL 150 (30ML)', 'medicamento', 'frasco spray', 'unidad', 'unidad'),
  (53, 'Salbutamol gotero', 2, '06/2028', '2028-06-30', '53A', null, 'SALBUTAMO SELECTPHARMA', 'medicamento', 'gotero', 'unidad', 'unidad'),
  (54, 'Glicerina gotero', 1, '10/2026', '2026-10-31', '40A', null, 'GLICERINA GOTERO', 'medicamento', 'gotero', 'unidad', 'unidad'),
  (55, 'Refresh tears gotero', 1, '01/2027', '2027-01-31', '15A', null, 'REFRESH TEARS 0.5% 15ML SOLUCION OFTALMICA', 'medicamento', 'gotero', 'unidad', 'unidad'),
  (56, 'Nasil ofteno gotero', 2, '06/2027', '2027-06-30', '20A', null, 'NAZIL OFTENO 0.1% 15ML SOLUCION OFTALMICA', 'medicamento', 'gotero', 'unidad', 'unidad'),
  (57, 'Alfer eril gotero', 2, '06/2028', '2028-06-30', '9A', null, 'ALFER ERI 0.5% 5ML SOLUCION OFTALMICA', 'medicamento', 'gotero', 'unidad', 'unidad'),
  (58, 'Otik gotero', 2, '10/2027', '2027-10-31', '18A', null, 'OTIK 10ML SOLUCION OTICA', 'medicamento', 'gotero', 'unidad', 'unidad'),
  (59, 'Hisopos', 75, '10/2028', '2028-10-31', '14B', null, 'HISOPOS - 100 UNIDADES', 'insumo', 'unidad', 'unidad', 'unidad'),
  (60, 'Baja lenguas', 200, '02/2028', '2028-02-29', 'INS-AUTO-011', null, 'BAJA LENGUAS LIMPIAS', 'insumo', 'unidad', 'unidad', 'unidad'),
  (61, 'Sulfaplata crema', 2, '06/2027', '2027-06-30', '13A', null, 'SULFADIAZINA DE PLATA GENFAR 1% 15G CREMA', 'medicamento', 'crema', 'crema', 'crema'),
  (62, 'Hojas de bisturi', 75, '02/2028', '2028-02-29', 'INS-AUTO-028', null, 'HOJAS DE BISTURY', 'insumo', 'unidad', 'unidad', 'unidad'),
  (63, 'Diclofenaco gel tubo', 5, '12/2026', '2026-12-31', '11A', null, 'DICLOLEV 0.01% 20G GEL', 'medicamento', 'gel', 'gel', 'gel'),
  (64, 'Dolocalor ub frasco', 4, '07/2028', '2028-07-31', '7A', null, 'DOLO KALORUB 180ML AERO', 'medicamento', 'frasco', 'unidad', 'unidad'),
  (65, 'Frio ub frasco', 3, '07/2028', '2028-07-31', '32A', null, 'FRIORUB 180ML AERO', 'medicamento', 'frasco', 'unidad', 'unidad'),
  (66, 'Angiocat no. 22', 43, '10/2028', '2028-10-31', 'INS-AUTO-009', null, 'ANGIOCATH #22', 'insumo', 'unidad', 'unidad', 'unidad'),
  (67, 'Angiocat no. 24', 47, '10/2028', '2028-10-31', 'INS-AUTO-010', null, 'ANGIOCATH #24', 'insumo', 'unidad', 'unidad', 'unidad'),
  (68, 'Angiocat no. 20', 26, '12/2029', '2029-12-31', '7B', null, 'ANGIOCATH #20', 'insumo', 'unidad', 'unidad', 'unidad'),
  (69, 'Tiras de glucometro Nipro', 250, '11/2027', '2027-11-30', '29B', null, 'TIRAS DE GLUCOMETRO NIPRO PREMIER', 'insumo', 'tira', 'unidad', 'unidad'),
  (70, 'Tiras de glucometro on call', 150, '11/2027', '2027-11-30', '30B', null, 'TIRAS DE GLUCOMETRO ON CALL', 'insumo', 'tira', 'unidad', 'unidad'),
  (71, 'Lancetas', 575, '07/2030', '2030-07-31', '18B', null, 'LANCETAS PARA GLUCOMETRO', 'insumo', 'unidad', 'unidad', 'unidad'),
  (72, 'Hilo de sutura 2-0', 15, '08/2028', '2028-08-31', '13B', null, 'HILO DE SUTURA NYLON 2-0', 'insumo', null, 'unidad', 'unidad'),
  (73, 'Hilo de sutura 4-0', 7, '08/2028', '2028-08-31', null, 'Z9-INS-002', 'HILO DE SUTURA 4-0', 'insumo', 'unidad', 'unidad', 'unidad'),
  (74, 'Curitas', 130, '12/2029', '2029-12-31', null, 'Z9-INS-003', 'CURITA', 'insumo', 'unidad', 'unidad', 'unidad'),
  (75, 'Agujas no. 23', 173, '08/2029', '2029-08-31', '3B', null, 'AGUJAS #23', 'insumo', 'unidad', 'unidad', 'unidad'),
  (76, 'Jeringas de 1 cc', 100, '08/2028', '2028-08-31', '15B', null, 'JERINGA DE 1 CC', 'insumo', 'unidad', 'unidad', 'unidad'),
  (77, 'Jeringas de 5 cc', 36, '07/2029', '2029-07-31', '17B', null, 'JERINGAS DE 5CC CAJA - 100', 'insumo', 'caja', 'caja', 'unidad'),
  (78, 'Jeringas de 10 cc', 128, '07/2028', '2028-07-31', 'INS-AUTO-031', null, 'JERINGAS DE 10CC CAJA - 100 UNIDADES', 'insumo', 'caja', 'caja', 'unidad'),
  (79, 'Jeringas de 3 cc', 75, '07/2028', '2028-07-31', 'INS-AUTO-032', null, 'JERINGAS DE 3CC CAJA - 100 UNIDADES', 'insumo', 'caja', 'caja', 'unidad'),
  (80, 'Jeringas de 50 ml', 20, '06/2030', '2030-06-30', null, 'Z9-INS-007', 'JERINGA DE 50 ML', 'insumo', 'unidad', 'unidad', 'unidad'),
  (81, 'Hisopo esteril', 200, '10/2029', '2029-10-31', null, 'Z9-INS-008', 'HISOPO ESTERIL', 'insumo', 'unidad', 'unidad', 'unidad'),
  (82, 'Venda de 3 pulgadas', 49, '03/2030', '2030-03-31', null, 'Z9-INS-009', 'VENDA DE 3 PULGADAS', 'insumo', 'unidad', 'unidad', 'unidad'),
  (83, 'Venda de gasa de 3 pulgadas', 29, '07/2029', '2029-07-31', null, 'Z9-INS-010', 'VENDA DE GASA DE 3 PULGADAS', 'insumo', 'unidad', 'unidad', 'unidad'),
  (84, 'Venda de 4 pulgadas', 24, '12/2027', '2027-12-31', null, 'Z9-INS-011', 'VENDA DE 4 PULGADAS', 'insumo', 'unidad', 'unidad', 'unidad'),
  (85, 'Venda de 6 pulgadas', 15, '12/2027', '2027-12-31', null, 'Z9-INS-012', 'VENDA DE 6 PULGADAS', 'insumo', 'unidad', 'unidad', 'unidad'),
  (86, 'Solucion salina 100 ml', 12, '11/2028', '2028-11-30', 'INS-AUTO-043', null, 'SOL. SSN 100ML', 'insumo', 'unidad', 'unidad', 'unidad'),
  (87, 'Solucion salina 500 ml', 7, '02/2027', '2027-02-28', '26B', null, 'SOL. SN 500ML', 'insumo', 'unidad', 'unidad', 'unidad'),
  (88, 'Solucion Hartman 500 ml', 2, '03/2028', '2028-03-31', '25B', null, 'SOL. HARTMAN 500ML', 'insumo', 'unidad', 'unidad', 'unidad'),
  (89, 'Agua esteril 500 ml', 3, '08/2030', '2030-08-31', null, 'Z9-INS-013', 'AGUA ESTERIL 500 ML', 'insumo', 'unidad', 'unidad', 'unidad'),
  (90, 'Venoclisis', 24, '04/2028', '2028-04-30', null, 'Z9-INS-014', 'VENOCLISIS', 'insumo', 'unidad', 'unidad', 'unidad'),
  (91, 'Cabestrillo', 9, null, null, 'INS-AUTO-013', null, 'CABESTRILLO ADULTO', 'insumo', null, 'unidad', 'unidad'),
  (92, 'Canula binasal', 24, '11/2030', '2030-11-30', '9B', null, 'CANULAS BINASALES', 'insumo', 'unidad', 'unidad', 'unidad'),
  (93, 'Mascarilla para nebulizar', 6, '09/2030', '2030-09-30', '20B', null, 'MASCARILLA PARA NEBULIZAR', 'insumo', 'unidad', 'unidad', 'unidad'),
  (94, 'Micropore 3 pulgadas', 3, null, null, '23B', null, 'MICROPORE 3 PULGADAS', 'insumo', 'unidad', 'unidad', 'unidad'),
  (95, 'Micropore 1 pulgada', 5, null, null, '22B', null, 'MICROPORE 1 PULGADA', 'insumo', 'unidad', 'unidad', 'unidad'),
  (96, 'Esparadrapo de 3 pulgadas', 3, null, null, 'INS-AUTO-017', null, 'ESPARADRAPO 3 PULGADAS', 'insumo', 'unidad', 'unidad', 'unidad'),
  (97, 'Esparadrapo de 1 pulgada', 4, null, null, 'INS-AUTO-018', null, 'ESPARADRAPO 1PULGADAS', 'insumo', 'unidad', 'unidad', 'unidad'),
  (98, 'Transpore 1 pulgada', 2, null, null, null, 'Z9-INS-016', 'TRANSPORE 1 PULGADA', 'insumo', 'unidad', 'unidad', 'unidad'),
  (99, 'Ferula de dedo pequeno', 25, null, null, 'INS-AUTO-020', null, 'FERULA DE DEDO PEQUENO', 'insumo', 'unidad', 'unidad', 'unidad'),
  (100, 'Ferula de dedo grande', 10, null, null, '12B', null, 'FERULA DE DEDO GRANDE', 'insumo', 'unidad', 'unidad', 'unidad'),
  (101, 'Lomzol desparasitante tableta', 94, '07/2029', '2029-07-31', '16A', null, 'LOMZOL 400MG - 24 TABLETA', 'medicamento', 'tableta', 'tableta', 'tableta'),
  (102, 'Toalla sanitaria nocturna', 536, '08/2028', '2028-08-31', null, 'Z9-INS-017', 'TOALLA SANITARIA NOCTURNA', 'insumo', 'unidad', 'unidad', 'unidad'),
  (103, 'Toalla sanitaria normal', 200, '11/2028', '2028-11-30', null, 'Z9-INS-018', 'TOALLA SANITARIA NORMAL', 'insumo', 'unidad', 'unidad', 'unidad');


create table public._recon_z9_product_map_20260826 (
  ordinal integer primary key,
  existing_code text,
  new_code text,
  product_id bigint,
  product_type text not null check (product_type in ('EXISTENTE', 'NUEVO')),
  check (
    (existing_code is not null and new_code is null)
    or (existing_code is null and new_code is not null)
  )
);

insert into public._recon_z9_product_map_20260826
  (ordinal, existing_code, new_code, product_type)
values
  (1, '25A', null, 'EXISTENTE'),
  (2, '21A', null, 'EXISTENTE'),
  (3, '8A', null, 'EXISTENTE'),
  (4, '29A', null, 'EXISTENTE'),
  (5, '51A', null, 'EXISTENTE'),
  (6, '14A', null, 'EXISTENTE'),
  (7, '5A', null, 'EXISTENTE'),
  (8, 'MED-AUTO-026', null, 'EXISTENTE'),
  (9, '27A', null, 'EXISTENTE'),
  (10, '23A', null, 'EXISTENTE'),
  (11, '31A', null, 'EXISTENTE'),
  (12, '37A', null, 'EXISTENTE'),
  (13, 'MED-AUTO-034', null, 'EXISTENTE'),
  (14, '50A', null, 'EXISTENTE'),
  (15, '59A', null, 'EXISTENTE'),
  (16, '28A', null, 'EXISTENTE'),
  (17, '6A', null, 'EXISTENTE'),
  (18, '36A', null, 'EXISTENTE'),
  (19, '38A', null, 'EXISTENTE'),
  (20, 'MED-AUTO-044', null, 'EXISTENTE'),
  (21, null, 'Z9-MED-004', 'NUEVO'),
  (22, null, 'Z9-MED-005', 'NUEVO'),
  (23, '22A', null, 'EXISTENTE'),
  (24, '45A', null, 'EXISTENTE'),
  (25, '24A', null, 'EXISTENTE'),
  (26, null, 'Z9-MED-009', 'NUEVO'),
  (27, '19A', null, 'EXISTENTE'),
  (28, null, 'Z9-MED-010', 'NUEVO'),
  (29, '55A', null, 'EXISTENTE'),
  (30, '8B', null, 'EXISTENTE'),
  (31, '6B', null, 'EXISTENTE'),
  (32, '3A', null, 'EXISTENTE'),
  (33, 'MED-AUTO-023', null, 'EXISTENTE'),
  (34, '33A', null, 'EXISTENTE'),
  (35, '43A', null, 'EXISTENTE'),
  (36, 'MED-AUTO-019', null, 'EXISTENTE'),
  (37, '57A', null, 'EXISTENTE'),
  (38, '49A', null, 'EXISTENTE'),
  (39, '52A', null, 'EXISTENTE'),
  (40, '56A', null, 'EXISTENTE'),
  (41, '58A', null, 'EXISTENTE'),
  (42, 'MED-AUTO-016', null, 'EXISTENTE'),
  (43, '34A', null, 'EXISTENTE'),
  (44, '48A', null, 'EXISTENTE'),
  (45, '39A', null, 'EXISTENTE'),
  (46, '10A', null, 'EXISTENTE'),
  (47, null, 'Z9-MED-014', 'NUEVO'),
  (48, '19B', null, 'EXISTENTE'),
  (49, '47A', null, 'EXISTENTE'),
  (50, 'INS-AUTO-021', null, 'EXISTENTE'),
  (51, '27B', null, 'EXISTENTE'),
  (52, '4A', null, 'EXISTENTE'),
  (53, '53A', null, 'EXISTENTE'),
  (54, '40A', null, 'EXISTENTE'),
  (55, '15A', null, 'EXISTENTE'),
  (56, '20A', null, 'EXISTENTE'),
  (57, '9A', null, 'EXISTENTE'),
  (58, '18A', null, 'EXISTENTE'),
  (59, '14B', null, 'EXISTENTE'),
  (60, 'INS-AUTO-011', null, 'EXISTENTE'),
  (61, '13A', null, 'EXISTENTE'),
  (62, 'INS-AUTO-028', null, 'EXISTENTE'),
  (63, '11A', null, 'EXISTENTE'),
  (64, '7A', null, 'EXISTENTE'),
  (65, '32A', null, 'EXISTENTE'),
  (66, 'INS-AUTO-009', null, 'EXISTENTE'),
  (67, 'INS-AUTO-010', null, 'EXISTENTE'),
  (68, '7B', null, 'EXISTENTE'),
  (69, '29B', null, 'EXISTENTE'),
  (70, '30B', null, 'EXISTENTE'),
  (71, '18B', null, 'EXISTENTE'),
  (72, '13B', null, 'EXISTENTE'),
  (73, null, 'Z9-INS-002', 'NUEVO'),
  (74, null, 'Z9-INS-003', 'NUEVO'),
  (75, '3B', null, 'EXISTENTE'),
  (76, '15B', null, 'EXISTENTE'),
  (77, '17B', null, 'EXISTENTE'),
  (78, 'INS-AUTO-031', null, 'EXISTENTE'),
  (79, 'INS-AUTO-032', null, 'EXISTENTE'),
  (80, null, 'Z9-INS-007', 'NUEVO'),
  (81, null, 'Z9-INS-008', 'NUEVO'),
  (82, null, 'Z9-INS-009', 'NUEVO'),
  (83, null, 'Z9-INS-010', 'NUEVO'),
  (84, null, 'Z9-INS-011', 'NUEVO'),
  (85, null, 'Z9-INS-012', 'NUEVO'),
  (86, 'INS-AUTO-043', null, 'EXISTENTE'),
  (87, '26B', null, 'EXISTENTE'),
  (88, '25B', null, 'EXISTENTE'),
  (89, null, 'Z9-INS-013', 'NUEVO'),
  (90, null, 'Z9-INS-014', 'NUEVO'),
  (91, 'INS-AUTO-013', null, 'EXISTENTE'),
  (92, '9B', null, 'EXISTENTE'),
  (93, '20B', null, 'EXISTENTE'),
  (94, '23B', null, 'EXISTENTE'),
  (95, '22B', null, 'EXISTENTE'),
  (96, 'INS-AUTO-017', null, 'EXISTENTE'),
  (97, 'INS-AUTO-018', null, 'EXISTENTE'),
  (98, null, 'Z9-INS-016', 'NUEVO'),
  (99, 'INS-AUTO-020', null, 'EXISTENTE'),
  (100, '12B', null, 'EXISTENTE'),
  (101, '16A', null, 'EXISTENTE'),
  (102, null, 'Z9-INS-017', 'NUEVO'),
  (103, null, 'Z9-INS-018', 'NUEVO');

create table public._recon_z9_products_zeroed_20260826 (
  producto_id bigint primary key,
  existencia_anterior numeric(12,2) not null
);

select
  count(*) as total_articulos_oficiales,
  count(*) filter (where existing_code is not null) as equivalencias_existentes,
  count(*) filter (where new_code is not null) as productos_nuevos,
  sum(quantity) as unidades_totales,
  count(*) filter (where expiry_date is not null) as articulos_con_vencimiento,
  count(*) filter (where expiry_date is null) as articulos_sin_vencimiento
from public._recon_z9_official_inventory_20260826;

commit;
