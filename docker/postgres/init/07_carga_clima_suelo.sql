-- Clima diario (NASA POWER) y perfiles de suelo (SoilGrids) por departamento agrícola.
-- Archivos generados por `pnpm fuentes:clima` (data/raw/nasa-power/*.csv) y
-- `pnpm fuentes:suelo` (data/raw/soilgrids/*.json). Si no existen, se saltea.

INSERT INTO fuente_dato (codigo, nombre, url, tipo, notas) VALUES
    ('nasa-power-api', 'NASA POWER - API diaria (comunidad AG)', 'https://power.larc.nasa.gov/api/temporal/daily/point', 'api',
     'Celdas de 0,5° con centro en x.25/x.75. ET0 calculada con Hargreaves-Samani (FAO-56). Radiación desde 1984.')
ON CONFLICT (codigo) DO NOTHING;

-- Clase textural USDA a partir de % de arcilla, limo y arena
CREATE FUNCTION textura_usda(arcilla NUMERIC, limo NUMERIC, arena NUMERIC) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN arcilla IS NULL OR limo IS NULL OR arena IS NULL THEN NULL
        WHEN limo + 1.5 * arcilla < 15 THEN 'Arenoso'
        WHEN limo + 2 * arcilla < 30 THEN 'Arenoso franco'
        WHEN arcilla >= 40 AND limo >= 40 THEN 'Arcillo limoso'
        WHEN arcilla >= 40 AND arena <= 45 THEN 'Arcilloso'
        WHEN arcilla >= 35 AND arena > 45 THEN 'Arcillo arenoso'
        WHEN arcilla >= 27 AND arena <= 20 THEN 'Franco arcillo limoso'
        WHEN arcilla >= 27 AND arena <= 45 THEN 'Franco arcilloso'
        WHEN arcilla >= 20 AND limo < 28 AND arena > 45 THEN 'Franco arcillo arenoso'
        WHEN limo >= 80 AND arcilla < 12 THEN 'Limoso'
        WHEN limo >= 50 THEN 'Franco limoso'
        WHEN arcilla >= 7 AND limo >= 28 AND arena <= 52 THEN 'Franco'
        ELSE 'Franco arenoso'
    END
$$;

DO $$
DECLARE
    archivo TEXT;
    n INTEGER := 0;
BEGIN
    -- ---------------------------------------------------------------- clima
    IF pg_stat_file('/seed/raw/nasa-power', true) IS NULL THEN
        RAISE NOTICE 'Sin data/raw/nasa-power: se omite la carga de clima';
    ELSE
        CREATE TEMP TABLE stg_clima (
            lat NUMERIC, lon NUMERIC, fecha DATE, t_max_c NUMERIC, t_min_c NUMERIC, precipitacion_mm NUMERIC,
            radiacion_mj_m2 NUMERIC, humedad_relativa_pct NUMERIC, viento_m_s NUMERIC, et0_mm NUMERIC
        );
        FOR archivo IN SELECT f FROM pg_ls_dir('/seed/raw/nasa-power') AS f WHERE f LIKE 'celda_%.csv' ORDER BY f LOOP
            EXECUTE format('COPY stg_clima FROM %L WITH (FORMAT csv, HEADER true)', '/seed/raw/nasa-power/' || archivo);
            n := n + 1;
        END LOOP;
        RAISE NOTICE 'Clima: % celdas leídas', n;

        INSERT INTO celda_clima (lat, lon) SELECT DISTINCT lat, lon FROM stg_clima ON CONFLICT DO NOTHING;

        INSERT INTO clima_diario (celda_id, fecha, t_max_c, t_min_c, precipitacion_mm, radiacion_mj_m2,
                                  humedad_relativa_pct, viento_m_s, et0_mm, fuente_id)
        SELECT c.id, s.fecha, s.t_max_c, s.t_min_c, s.precipitacion_mm, s.radiacion_mj_m2,
               s.humedad_relativa_pct, s.viento_m_s, s.et0_mm,
               (SELECT id FROM fuente_dato WHERE codigo = 'nasa-power-api')
        FROM stg_clima s
        JOIN celda_clima c ON c.lat = s.lat AND c.lon = s.lon;

        DROP TABLE stg_clima;

        -- Cada departamento apunta a la celda de 0,5° que contiene su centroide
        UPDATE departamento d
        SET celda_clima_id = c.id
        FROM celda_clima c
        WHERE d.lat IS NOT NULL
          AND c.lat = floor(d.lat * 2) / 2 + 0.25
          AND c.lon = floor(d.lon * 2) / 2 + 0.25;

        UPDATE fuente_dato SET ultima_carga = now() WHERE codigo = 'nasa-power-api';
    END IF;

    -- ---------------------------------------------------------------- suelo
    IF pg_stat_file('/seed/raw/soilgrids', true) IS NULL THEN
        RAISE NOTICE 'Sin data/raw/soilgrids: se omite la carga de suelos';
    ELSE
        CREATE TEMP TABLE stg_suelo (departamento_id INTEGER, lat NUMERIC, lon NUMERIC, respuesta JSONB);
        n := 0;
        FOR archivo IN SELECT f FROM pg_ls_dir('/seed/raw/soilgrids') AS f WHERE f LIKE '%.json' ORDER BY f LOOP
            INSERT INTO stg_suelo
            SELECT (j->>'departamento_id')::INTEGER, (j->>'lat')::NUMERIC, (j->>'lon')::NUMERIC, j->'respuesta'
            FROM (SELECT pg_read_file('/seed/raw/soilgrids/' || archivo)::JSONB AS j) t;
            n := n + 1;
        END LOOP;
        RAISE NOTICE 'Suelos: % perfiles leídos', n;

        -- Valores por propiedad y profundidad, ya en las unidades de suelo_horizonte
        -- (SoilGrids entrega enteros escalados: arcilla g/kg, SOC dg/kg, pH×10, CIC mmol/kg, DAP cg/cm³, N cg/kg)
        CREATE TEMP TABLE stg_capas AS
        SELECT s.departamento_id,
               (d->'range'->>'top_depth')::SMALLINT AS desde,
               (d->'range'->>'bottom_depth')::SMALLINT AS hasta,
               l->>'name' AS propiedad,
               (d->'values'->>'mean')::NUMERIC AS valor
        FROM stg_suelo s,
             jsonb_array_elements(s.respuesta->'properties'->'layers') AS l,
             jsonb_array_elements(l->'depths') AS d;

        CREATE TEMP TABLE stg_horizonte AS
        SELECT departamento_id, desde, hasta,
               max(valor) FILTER (WHERE propiedad = 'clay') / 10     AS arcilla_pct,
               max(valor) FILTER (WHERE propiedad = 'silt') / 10     AS limo_pct,
               max(valor) FILTER (WHERE propiedad = 'sand') / 10     AS arena_pct,
               max(valor) FILTER (WHERE propiedad = 'soc') / 10      AS carbono_organico_g_kg,
               max(valor) FILTER (WHERE propiedad = 'phh2o') / 10    AS ph,
               max(valor) FILTER (WHERE propiedad = 'cec') / 10      AS cic_cmol_kg,
               max(valor) FILTER (WHERE propiedad = 'bdod') / 100    AS densidad_aparente_g_cm3,
               max(valor) FILTER (WHERE propiedad = 'nitrogen') / 100 AS nitrogeno_total_g_kg
        FROM stg_capas
        GROUP BY 1, 2, 3;

        -- Un perfil por departamento. Textura: promedio ponderado de 0-30 cm (capa arable).
        -- Perfiles sin dato (centroide en ciudad o agua) no se cargan.
        WITH arable AS (
            SELECT departamento_id,
                   sum(arcilla_pct * (hasta - desde)) / 30 AS arcilla,
                   sum(limo_pct * (hasta - desde)) / 30 AS limo,
                   sum(arena_pct * (hasta - desde)) / 30 AS arena
            FROM stg_horizonte WHERE hasta <= 30
            GROUP BY 1
            HAVING count(arcilla_pct) = 3
        ),
        nuevos AS (
            INSERT INTO suelo_perfil (lat, lon, origen, textura_id, fuente_id)
            SELECT s.lat, s.lon, 'soilgrids', t.id, (SELECT id FROM fuente_dato WHERE codigo = 'soilgrids')
            FROM stg_suelo s
            JOIN arable a ON a.departamento_id = s.departamento_id
            LEFT JOIN textura_suelo t ON t.nombre = textura_usda(a.arcilla, a.limo, a.arena)
            RETURNING id, lat, lon
        )
        -- suelo_perfil guarda lat/lon con 5 decimales: se compara redondeando igual
        UPDATE departamento d
        SET suelo_perfil_id = n.id
        FROM nuevos n
        JOIN stg_suelo s ON round(s.lat, 5) = n.lat AND round(s.lon, 5) = n.lon
        WHERE d.id = s.departamento_id;

        INSERT INTO suelo_horizonte (perfil_id, profundidad_desde_cm, profundidad_hasta_cm, arcilla_pct, limo_pct,
                                     arena_pct, carbono_organico_g_kg, materia_organica_pct, ph, cic_cmol_kg,
                                     densidad_aparente_g_cm3, nitrogeno_total_g_kg)
        SELECT d.suelo_perfil_id, h.desde, h.hasta, h.arcilla_pct, h.limo_pct, h.arena_pct, h.carbono_organico_g_kg,
               round(h.carbono_organico_g_kg * 1.724 / 10, 2),  -- MO % = SOC (g/kg) × 1,724 (factor de van Bemmelen) / 10
               h.ph, h.cic_cmol_kg, h.densidad_aparente_g_cm3, h.nitrogeno_total_g_kg
        FROM stg_horizonte h
        JOIN departamento d ON d.id = h.departamento_id
        WHERE d.suelo_perfil_id IS NOT NULL;

        UPDATE fuente_dato SET ultima_carga = now() WHERE codigo = 'soilgrids';
    END IF;
END $$;
