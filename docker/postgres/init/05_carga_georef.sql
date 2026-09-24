-- Centroides de departamentos desde la API Georef (data/raw/georef-departamentos.json).
-- Sirven para cruzar cada departamento con la grilla de clima (NASA POWER)
-- y con SoilGrids cuando no hay un lote con coordenadas propias.

CREATE TEMP TABLE stg_georef AS
SELECT
    (d->>'id')::INTEGER                     AS id,
    (d->'provincia'->>'id')::SMALLINT       AS provincia_id,
    d->>'nombre'                            AS nombre,
    (d->'centroide'->>'lat')::NUMERIC(8,5)  AS lat,
    (d->'centroide'->>'lon')::NUMERIC(8,5)  AS lon
FROM jsonb_array_elements(pg_read_file('/seed/raw/georef-departamentos.json')::JSONB -> 'departamentos') AS d;

-- Departamentos que ya vinieron de MAGyP: se completan coordenadas y se
-- deja el nombre de MAGyP (difiere solo en tildes/abreviaturas en 9 casos).
UPDATE departamento dep
SET lat = g.lat, lon = g.lon
FROM stg_georef g
WHERE g.id = dep.id;

-- MAGyP sigue usando el código viejo de Chascomús (06217, anterior a la
-- separación de Lezama en 2009); Georef usa 06218. Se toma ese centroide.
UPDATE departamento dep
SET lat = g.lat, lon = g.lon
FROM stg_georef g
WHERE dep.id = 6217 AND g.id = 6218;

-- Departamentos que MAGyP no tiene (sin producción agrícola informada):
-- se agregan igual para que un productor pueda ubicar su establecimiento.
INSERT INTO departamento (id, provincia_id, nombre, lat, lon)
SELECT g.id, g.provincia_id, g.nombre, g.lat, g.lon
FROM stg_georef g
WHERE NOT EXISTS (SELECT 1 FROM departamento dep WHERE dep.id = g.id)
  AND g.id <> 6218;

-- Los códigos xx000 ('sin definir') de MAGyP no tienen ubicación y quedan sin coordenadas.

INSERT INTO fuente_dato (codigo, nombre, url, tipo, notas, ultima_carga) VALUES
    ('georef', 'Georef - API del Servicio de Normalización de Datos Geográficos', 'https://apis.datos.gob.ar/georef', 'api', 'Centroides de departamentos (códigos INDEC)', now());
