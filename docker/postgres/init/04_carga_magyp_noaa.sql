-- Carga de MAGyP (estimaciones agrícolas) y NOAA (ONI).
-- Archivos descargados con `pnpm fuentes:descargar` en data/raw/.

-- ---------------------------------------------------------------------
-- NOAA ONI (data/raw/noaa-oni.txt)
-- ---------------------------------------------------------------------
-- Formato de texto con columnas separadas por espacios:
--   SEAS  YR   TOTAL   ANOM
--    DJF 1950  25.01  -1.32
INSERT INTO enso_oni (anio, trimestre, valor, fuente_id)
SELECT
    c[2]::SMALLINT,
    c[1],
    c[4]::NUMERIC,
    (SELECT id FROM fuente_dato WHERE codigo = 'noaa-oni')
FROM (
    SELECT regexp_split_to_array(trim(linea), '\s+') AS c
    FROM regexp_split_to_table(pg_read_file('/seed/raw/noaa-oni.txt'), '\r?\n') AS linea
) t
WHERE c[1] ~ '^[A-Z]{3}$' AND c[1] <> 'SEA'
  AND c[2] ~ '^\d{4}$';

UPDATE fuente_dato SET ultima_carga = now() WHERE codigo = 'noaa-oni';

-- ---------------------------------------------------------------------
-- MAGyP estimaciones agrícolas (data/raw/magyp-estimaciones-agricolas.csv)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE stg_magyp (
    cultivo TEXT, anio TEXT, campania TEXT, provincia TEXT, provincia_id TEXT,
    departamento TEXT, departamento_id TEXT, superficie_sembrada_ha NUMERIC,
    superficie_cosechada_ha NUMERIC, produccion_tm NUMERIC, rendimiento_kgxha NUMERIC
);

COPY stg_magyp FROM '/seed/raw/magyp-estimaciones-agricolas.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

-- Hay 8 filas sin departamento (provincia 'NULL'): no se pueden ubicar, se descartan.
DELETE FROM stg_magyp WHERE departamento_id !~ '^\d+$';

-- Departamentos (código INDEC de 5 dígitos, p. ej. '06854' → 6854).
-- Si un código aparece con más de un nombre se queda con el más reciente.
INSERT INTO departamento (id, provincia_id, nombre)
SELECT DISTINCT ON (departamento_id::INTEGER)
    departamento_id::INTEGER, provincia_id::SMALLINT, departamento
FROM stg_magyp
ORDER BY departamento_id::INTEGER, anio DESC;

-- Cruce de nombres de cultivo MAGyP → especie INASE
CREATE TEMP TABLE map_cultivo (cultivo_magyp TEXT PRIMARY KEY, especie TEXT, tipo_siembra TEXT NOT NULL DEFAULT 'total');
INSERT INTO map_cultivo VALUES
    ('maíz', 'MAIZ', 'total'),
    ('soja total', 'SOJA', 'total'),
    ('soja 1ra', 'SOJA', '1ra'),
    ('soja 2da', 'SOJA', '2da'),
    ('trigo total', 'TRIGO PAN', 'total'),
    ('trigo candeal', 'TRIGO FIDEOS O CANDEAL', 'total'),
    ('girasol', 'GIRASOL', 'total'),
    ('sorgo', 'SORGO', 'total'),
    ('cebada cervecera', 'CEBADA CERVECERA', 'total'),
    ('cebada forrajera', 'CEBADA FORRAJERA', 'total'),
    ('avena', 'AVENA', 'total'),
    ('centeno', 'CENTENO', 'total'),
    ('colza', 'COLZA-CANOLA', 'total'),
    ('lino', 'LINO', 'total'),
    ('maní', 'MANI', 'total'),
    ('arroz', 'ARROZ', 'total'),
    ('algodón', 'ALGODONERO', 'total'),
    ('alpiste', 'ALPISTE', 'total'),
    ('mijo', 'MIJO', 'total'),
    ('cártamo', 'CARTAMO', 'total'),
    ('arveja', 'ARVEJA', 'total'),
    ('garbanzo', 'GARBANZO', 'total'),
    ('lenteja', 'LENTEJA', 'total'),
    ('poroto total', 'POROTO', 'total');

INSERT INTO estimacion_agricola (
    campania_id, departamento_id, cultivo_magyp, especie_id, tipo_siembra,
    superficie_sembrada_ha, superficie_cosechada_ha, produccion_tn, rendimiento_kg_ha, fuente_id
)
SELECT
    c.id,
    s.departamento_id::INTEGER,
    s.cultivo,
    e.id,
    COALESCE(m.tipo_siembra, 'total'),
    s.superficie_sembrada_ha,
    s.superficie_cosechada_ha,
    s.produccion_tm,
    -- MAGyP informa 0 cuando no hubo cosecha: no es un rinde real
    CASE WHEN s.superficie_cosechada_ha > 0 THEN s.rendimiento_kgxha END,
    (SELECT id FROM fuente_dato WHERE codigo = 'magyp-estimaciones')
FROM stg_magyp s
JOIN campania c ON c.anio_inicio = s.anio::SMALLINT
LEFT JOIN map_cultivo m ON m.cultivo_magyp = s.cultivo
LEFT JOIN especie e ON e.nombre = m.especie;

UPDATE fuente_dato SET ultima_carga = now() WHERE codigo = 'magyp-estimaciones';
