-- Carga inicial con lo que ya se scrapeó en data/ (montado en /seed).
-- Si los archivos no existen, el init falla: correr antes `pnpm dev`.

-- ---------------------------------------------------------------------
-- Cultivares INASE (data/raw/inase-cultivares.csv)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE stg_inase (
    numero TEXT, cultivar TEXT, especie TEXT, condicion_genetica TEXT,
    nombre_cientifico TEXT, grupo TEXT, inscripcion_rnc TEXT, inscripcion_rnpc TEXT,
    validez_rnpc TEXT, pais TEXT, caracteristicas TEXT, evento_transgenico TEXT,
    evento_transgenico_caracteristica TEXT, solicitante_rnc TEXT, representante_rnc TEXT,
    solicitante_rnpc TEXT, representante_rnpc TEXT
);

COPY stg_inase FROM '/seed/raw/inase-cultivares.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

-- Algunas especies aparecen con más de un nombre científico/grupo:
-- se queda con el más frecuente.
INSERT INTO especie (nombre, nombre_cientifico, grupo_inase)
SELECT DISTINCT ON (especie) especie, nullif(nombre_cientifico, ''), nullif(grupo, '')
FROM (
    SELECT especie, nombre_cientifico, grupo, count(*) AS n
    FROM stg_inase
    GROUP BY 1, 2, 3
) t
ORDER BY especie, n DESC;

UPDATE especie SET es_cultivo_extensivo = TRUE
WHERE nombre IN ('SOJA', 'MAIZ', 'TRIGO PAN', 'GIRASOL', 'SORGO', 'CEBADA CERVECERA',
                 'TRIGO FIDEOS O CANDEAL', 'COLZA-CANOLA', 'ARROZ', 'MANI', 'AVENA BLANCA');

-- Especies que el productor puede declarar como antecesor o cultivo de
-- servicio y que no están en el catálogo con ese nombre.
INSERT INTO especie (nombre) VALUES ('PASTURA'), ('BARBECHO'), ('CAMPO NATURAL')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO cultivar (
    numero_registro_inase, nombre, especie_id, condicion_genetica,
    grupo_madurez, caracteristicas_inase, evento_transgenico, evento_transgenico_caracteristica,
    pais_origen, obtentor, representante,
    fecha_inscripcion_rnc, fecha_inscripcion_rnpc, validez_rnpc, fuente_id
)
SELECT
    s.numero::INTEGER,
    s.cultivar,
    e.id,
    nullif(s.condicion_genetica, ''),
    -- En soja INASE informa el grupo de madurez en características ('IV - TR' → 'IV')
    CASE WHEN s.especie = 'SOJA'
         THEN (regexp_match(s.caracteristicas, '\m(VIII|VII|VI|IV|IX|V|III|II|I|X)\M'))[1] END,
    nullif(s.caracteristicas, ''),
    nullif(s.evento_transgenico, ''),
    nullif(s.evento_transgenico_caracteristica, ''),
    nullif(s.pais, ''),
    COALESCE(nullif(s.solicitante_rnc, ''), nullif(s.solicitante_rnpc, '')),
    COALESCE(nullif(s.representante_rnc, ''), nullif(s.representante_rnpc, '')),
    nullif(s.inscripcion_rnc, '')::DATE,
    nullif(s.inscripcion_rnpc, '')::DATE,
    nullif(s.validez_rnpc, '')::DATE,
    (SELECT id FROM fuente_dato WHERE codigo = 'inase')
FROM stg_inase s
JOIN especie e ON e.nombre = s.especie;

UPDATE fuente_dato SET ultima_carga = now() WHERE codigo = 'inase';

-- ---------------------------------------------------------------------
-- Avisos de alquiler (data/processed/campos-alquiler.json)
-- ---------------------------------------------------------------------
INSERT INTO aviso_alquiler_campo (
    fuente, id_externo, titulo, precio, moneda, precio_texto,
    superficie_ha, superficie_texto, ubicacion_texto, inmobiliaria,
    url, imagen_url, scrapeado_en
)
SELECT
    l->>'source',
    l->>'id',
    l->>'title',
    (l->>'price')::NUMERIC,
    l->>'currency',
    l->>'priceText',
    -- Superficie: del texto de superficie o, si no hay, del título ("... 470 Ha")
    replace(replace(
        (regexp_match(COALESCE(l->>'surfaceText', l->>'title'), '(\d[\d\.]*(?:,\d+)?)\s*(?:ha|has|hectáreas|hectareas)\M', 'i'))[1],
        '.', ''), ',', '.')::NUMERIC,
    l->>'surfaceText',
    l->>'location',
    l->>'agency',
    l->>'detailUrl',
    l->>'imageUrl',
    (r->>'scrapedAt')::TIMESTAMPTZ
FROM jsonb_array_elements(pg_read_file('/seed/processed/campos-alquiler.json')::JSONB) AS r,
     jsonb_array_elements(r->'listings') AS l
ON CONFLICT (fuente, id_externo) DO NOTHING;

UPDATE fuente_dato f SET ultima_carga = now()
WHERE codigo IN (SELECT DISTINCT fuente FROM aviso_alquiler_campo);
