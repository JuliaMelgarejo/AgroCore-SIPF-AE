-- Economía (BCR, BCRA, retenciones) y pronóstico ENSO oficial (NOAA CPC/IRI).
-- Archivos de `pnpm fuentes:precios` y `pnpm fuentes:descargar`. Si faltan, se saltean.

INSERT INTO fuente_dato (codigo, nombre, url, tipo, notas) VALUES
    ('bcra-cambiarias', 'BCRA - API de Estadísticas Cambiarias (USD)', 'https://api.bcra.gob.ar/estadisticascambiarias/v1.0', 'api',
     'Cotización oficial del BCRA desde 2002. Antes: convertibilidad 1 ARS = 1 USD (abr-1991 a ene-2002).'),
    ('bcr-pizarra', 'BCR - Cámara Arbitral de Cereales, precios pizarra Rosario', 'https://www.cac.bcr.com.ar/es/precios-de-pizarra/consultas', 'descarga',
     'ARS/tn. Export a Excel año por año desde 1988.'),
    ('noaa-enso-pronostico', 'NOAA CPC/IRI - pronóstico probabilístico oficial de ENSO', 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/probabilities/', 'scraping',
     'Se verifica con RONI (ONI relativo), no con ONI. Actualiza el 2º jueves de cada mes.'),
    ('boletin-oficial', 'Boletín Oficial - Decreto 423/2026 (derechos de exportación)', 'https://www.boletinoficial.gob.ar/', 'manual',
     'Cargado a mano desde el texto del decreto (BO 03/06/2026).')
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------------
-- Retenciones (Decreto 423/2026). La alícuota rige según la fecha de
-- embarque declarada en la DJVE; acá se toma como fecha de vigencia.
--   Soja: 24% en 2026; baja 0,25 pt/mes en 2027 (21% en dic-2027) y
--         0,5 pt/mes en 2028 (15% en dic-2028).
--   Maíz y sorgo: 8,5% en 2026, 7,5% en dic-2027, 5,5% en dic-2028 (el
--         decreto fija esos hitos; los pasos intermedios no se cargan).
--   Trigo y cebada: baja inmediata a 5,5%.
--   Girasol: queda afuera (el decreto fija un rango 2,5%-4,5% según posición).
-- Alícuotas anteriores a junio 2026 no están cargadas.
-- ---------------------------------------------------------------------
INSERT INTO derecho_exportacion (especie_id, vigente_desde, alicuota_pct, norma)
SELECT e.id, v.desde, v.alicuota, 'Decreto 423/2026'
FROM (
    VALUES ('SOJA', DATE '2026-06-03', 24.0),
           ('MAIZ', DATE '2026-06-03', 8.5), ('MAIZ', DATE '2027-12-01', 7.5), ('MAIZ', DATE '2028-12-01', 5.5),
           ('SORGO', DATE '2026-06-03', 8.5), ('SORGO', DATE '2027-12-01', 7.5), ('SORGO', DATE '2028-12-01', 5.5),
           ('TRIGO PAN', DATE '2026-06-03', 5.5), ('TRIGO FIDEOS O CANDEAL', DATE '2026-06-03', 5.5),
           ('CEBADA CERVECERA', DATE '2026-06-03', 5.5), ('CEBADA FORRAJERA', DATE '2026-06-03', 5.5)
) AS v (especie, desde, alicuota)
JOIN especie e ON e.nombre = v.especie
UNION ALL
-- Soja: un escalón por mes en 2027 (-0,25) y 2028 (-0,5)
SELECT e.id, make_date(2027, m, 1), 24.0 - 0.25 * m, 'Decreto 423/2026 (cronograma mensual)'
FROM especie e, generate_series(1, 12) AS m WHERE e.nombre = 'SOJA'
UNION ALL
SELECT e.id, make_date(2028, m, 1), 21.0 - 0.5 * m, 'Decreto 423/2026 (cronograma mensual)'
FROM especie e, generate_series(1, 12) AS m WHERE e.nombre = 'SOJA';

DO $$
BEGIN
    -- ------------------------------------------------------ tipo de cambio
    IF pg_stat_file('/seed/raw/bcra-tipo-cambio.csv', true) IS NULL THEN
        RAISE NOTICE 'Sin data/raw/bcra-tipo-cambio.csv: se omite el tipo de cambio';
    ELSE
        CREATE TEMP TABLE stg_tc (fecha DATE, valor NUMERIC);
        COPY stg_tc FROM '/seed/raw/bcra-tipo-cambio.csv' WITH (FORMAT csv, HEADER true);
        INSERT INTO tipo_cambio (fecha, tipo, valor_ars_usd, fuente_id)
        SELECT fecha, 'oficial_mayorista', valor, (SELECT id FROM fuente_dato WHERE codigo = 'bcra-cambiarias')
        FROM stg_tc ON CONFLICT DO NOTHING;
        UPDATE fuente_dato SET ultima_carga = now() WHERE codigo = 'bcra-cambiarias';
    END IF;

    -- ------------------------------------------------------ pizarra BCR
    IF pg_stat_file('/seed/raw/bcr-pizarra.csv', true) IS NULL THEN
        RAISE NOTICE 'Sin data/raw/bcr-pizarra.csv: se omiten los precios pizarra';
    ELSE
        CREATE TEMP TABLE stg_pizarra (fecha DATE, especie TEXT, precio NUMERIC);
        COPY stg_pizarra FROM '/seed/raw/bcr-pizarra.csv' WITH (FORMAT csv, HEADER true);
        INSERT INTO precio_grano (fecha, especie_id, mercado, tipo, posicion, plaza, precio, moneda, unidad, fuente_id)
        SELECT s.fecha, e.id, 'BCR-pizarra', 'disponible', NULL, 'Rosario', s.precio, 'ARS', 'tn',
               (SELECT id FROM fuente_dato WHERE codigo = 'bcr-pizarra')
        FROM stg_pizarra s JOIN especie e ON e.nombre = s.especie
        ON CONFLICT DO NOTHING;
        UPDATE fuente_dato SET ultima_carga = now() WHERE codigo = 'bcr-pizarra';
    END IF;

    -- ------------------------------------------------------ pronóstico ENSO
    IF pg_stat_file('/seed/raw/noaa-enso-pronostico.csv', true) IS NULL THEN
        RAISE NOTICE 'Sin data/raw/noaa-enso-pronostico.csv: se omite el pronóstico ENSO';
    ELSE
        CREATE TEMP TABLE stg_pron (emitido DATE, anio SMALLINT, trimestre CHAR(3), nina SMALLINT, neutral SMALLINT, nino SMALLINT);
        COPY stg_pron FROM '/seed/raw/noaa-enso-pronostico.csv' WITH (FORMAT csv, HEADER true);
        INSERT INTO enso_pronostico (emitido, anio, trimestre, prob_nina_pct, prob_neutral_pct, prob_nino_pct, fuente_id)
        SELECT emitido, anio, trimestre, nina, neutral, nino, (SELECT id FROM fuente_dato WHERE codigo = 'noaa-enso-pronostico')
        FROM stg_pron ON CONFLICT DO NOTHING;
        UPDATE fuente_dato SET ultima_carga = now() WHERE codigo = 'noaa-enso-pronostico';
    END IF;
END $$;
