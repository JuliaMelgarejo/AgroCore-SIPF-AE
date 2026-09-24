-- =====================================================================
-- AgroCore SIPF-AE — esquema base para predicción de rendimiento y margen
-- =====================================================================
-- Organización:
--   1. Trazabilidad de fuentes
--   2. Geografía
--   3. Cultivos y semillas (INASE)
--   4. Suelo (SoilGrids / INTA / análisis del productor / ASISTA)
--   5. Clima y ENSO (NOAA ONI / NASA POWER)
--   6. Economía (precios, tipo de cambio, insumos, alquileres, retenciones)
--   7. Estadísticas históricas regionales (MAGyP) — base de entrenamiento
--   8. Datos del productor: establecimientos, lotes, campañas por lote
--   9. Recomendaciones externas y predicciones del sistema
--  10. Vista de dataset para entrenamiento
--
-- Convenciones: nombres en español y snake_case; superficies en ha,
-- rendimientos en kg/ha, precios en la moneda indicada en cada fila.
-- =====================================================================

SET client_encoding = 'UTF8';

-- ---------------------------------------------------------------------
-- 1. Trazabilidad de fuentes
-- ---------------------------------------------------------------------
-- Cada fila de datos externos apunta a la fuente de la que salió, para
-- saber qué tan confiable es y cuándo hay que actualizarla.
CREATE TABLE fuente_dato (
    id              SERIAL PRIMARY KEY,
    codigo          TEXT NOT NULL UNIQUE,          -- 'inase', 'nasa-power', ...
    nombre          TEXT NOT NULL,
    url             TEXT,
    tipo            TEXT NOT NULL CHECK (tipo IN ('api', 'scraping', 'descarga', 'manual', 'usuario', 'modelo')),
    licencia        TEXT,
    notas           TEXT,
    ultima_carga    TIMESTAMPTZ
);

-- ---------------------------------------------------------------------
-- 2. Geografía
-- ---------------------------------------------------------------------
-- El departamento/partido es la unidad en la que MAGyP publica rendimientos
-- históricos, así que es la unidad común para cruzar con clima y ENSO.
CREATE TABLE provincia (
    id              SMALLINT PRIMARY KEY,          -- código INDEC
    nombre          TEXT NOT NULL UNIQUE
);

CREATE TABLE departamento (
    id              INTEGER PRIMARY KEY,           -- código INDEC (provincia*1000 + depto)
    provincia_id    SMALLINT NOT NULL REFERENCES provincia(id),
    nombre          TEXT NOT NULL,
    lat             NUMERIC(8,5),                  -- centroide
    lon             NUMERIC(8,5),
    UNIQUE (provincia_id, nombre)
);

-- ---------------------------------------------------------------------
-- 3. Cultivos y semillas
-- ---------------------------------------------------------------------
CREATE TABLE especie (
    id                  SERIAL PRIMARY KEY,
    nombre              TEXT NOT NULL UNIQUE,      -- como figura en INASE: 'SOJA', 'MAIZ', 'TRIGO PAN'
    nombre_cientifico   TEXT,
    grupo_inase         TEXT,                      -- CE cereales, OL oleaginosas, FO forrajeras, ...
    es_cultivo_extensivo BOOLEAN NOT NULL DEFAULT FALSE  -- los que el sistema predice
);

-- Catálogo Nacional de Cultivares (RNC/RNPC) de INASE.
CREATE TABLE cultivar (
    id                          SERIAL PRIMARY KEY,
    numero_registro_inase       INTEGER UNIQUE,    -- NULL si lo cargó un usuario y no está en INASE
    nombre                      TEXT NOT NULL,
    -- INASE escribe igual cultivar de formas distintas ('NS 7765 VIPTERA3' / 'NS7765VIPTERA3'):
    -- buscar siempre por esta columna.
    nombre_normalizado          TEXT GENERATED ALWAYS AS (upper(regexp_replace(nombre, '[^[:alnum:]]', '', 'g'))) STORED,
    especie_id                  INTEGER NOT NULL REFERENCES especie(id),
    condicion_genetica          TEXT,              -- HIBRIDO SIMPLE, VARIEDAD, LINEA, ...
    es_hibrido                  BOOLEAN GENERATED ALWAYS AS (condicion_genetica ILIKE '%HIBRID%') STORED,
    -- Soja: grupo de madurez (INASE lo trae en "caracteristicas", p. ej. 'IV').
    -- Maíz: ciclo en días/madurez relativa, no viene de INASE y se completa aparte.
    grupo_madurez               TEXT,
    madurez_relativa_dias       SMALLINT,
    caracteristicas_inase       TEXT,
    evento_transgenico          TEXT,              -- p. ej. 'MIR162 x Bt11 x GA21' (Viptera3)
    evento_transgenico_caracteristica TEXT,        -- tolerancia a herbicida, resistencia a insectos, ...
    pais_origen                 TEXT,
    obtentor                    TEXT,              -- solicitante RNC
    representante               TEXT,
    fecha_inscripcion_rnc       DATE,
    fecha_inscripcion_rnpc      DATE,
    validez_rnpc                DATE,
    fuente_id                   INTEGER REFERENCES fuente_dato(id)
);
CREATE INDEX cultivar_especie_idx ON cultivar (especie_id);
CREATE INDEX cultivar_nombre_idx ON cultivar (nombre_normalizado);

-- Rendimiento de cada cultivar en redes de ensayos (INTA RET/RECSO, ensayos
-- de semilleras, ASISTA). INASE solo dice que el cultivar existe; esto dice
-- cómo rinde, y es lo que permite comparar genéticas entre sí.
CREATE TABLE ensayo_cultivar (
    id                  SERIAL PRIMARY KEY,
    cultivar_id         INTEGER NOT NULL REFERENCES cultivar(id),
    campania            TEXT NOT NULL,             -- '2024/25'
    departamento_id     INTEGER REFERENCES departamento(id),
    localidad           TEXT,
    fecha_siembra       DATE,
    rendimiento_kg_ha   NUMERIC(8,1) NOT NULL,
    rendimiento_relativo_pct NUMERIC(5,1),         -- respecto del promedio del ensayo
    red_ensayos         TEXT,
    fuente_id           INTEGER REFERENCES fuente_dato(id)
);

-- ---------------------------------------------------------------------
-- 4. Suelo
-- ---------------------------------------------------------------------
CREATE TABLE textura_suelo (
    id                  SMALLSERIAL PRIMARY KEY,
    nombre              TEXT NOT NULL UNIQUE       -- clases USDA en español ('Franco arcilloso', ...)
);

-- Un perfil es "el suelo en un punto": puede venir de SoilGrids (por
-- coordenadas), de la carta de suelos INTA, de un análisis de laboratorio
-- del productor o de lo que el productor cargó a mano.
CREATE TABLE suelo_perfil (
    id                          SERIAL PRIMARY KEY,
    lat                         NUMERIC(8,5) NOT NULL,
    lon                         NUMERIC(8,5) NOT NULL,
    origen                      TEXT NOT NULL CHECK (origen IN ('soilgrids', 'inta', 'laboratorio', 'usuario', 'asista')),
    fecha_muestreo              DATE,
    textura_id                  SMALLINT REFERENCES textura_suelo(id),
    profundidad_efectiva_cm     SMALLINT,          -- hasta tosca/limitante
    indice_productividad_inta   NUMERIC(5,1),      -- IP 0-100 de las cartas de suelo
    clase_capacidad_uso         TEXT,              -- I..VIII
    capacidad_agua_util_mm      NUMERIC(6,1),      -- agua útil máxima del perfil
    profundidad_napa_cm         SMALLINT,
    fuente_id                   INTEGER REFERENCES fuente_dato(id)
);
CREATE INDEX suelo_perfil_coord_idx ON suelo_perfil (lat, lon);

-- Capas del perfil. SoilGrids publica 0-5, 5-15, 15-30, 30-60, 60-100, 100-200 cm.
CREATE TABLE suelo_horizonte (
    id                  SERIAL PRIMARY KEY,
    perfil_id           INTEGER NOT NULL REFERENCES suelo_perfil(id) ON DELETE CASCADE,
    profundidad_desde_cm SMALLINT NOT NULL,
    profundidad_hasta_cm SMALLINT NOT NULL,
    arcilla_pct         NUMERIC(5,2),
    limo_pct            NUMERIC(5,2),
    arena_pct           NUMERIC(5,2),
    materia_organica_pct NUMERIC(5,2),
    carbono_organico_g_kg NUMERIC(6,2),
    ph                  NUMERIC(4,2),
    cic_cmol_kg         NUMERIC(6,2),
    densidad_aparente_g_cm3 NUMERIC(4,2),
    nitrogeno_total_g_kg NUMERIC(6,3),
    -- Análisis de laboratorio del productor (no los trae SoilGrids)
    fosforo_bray_ppm    NUMERIC(6,1),
    nitratos_ppm        NUMERIC(6,1),
    azufre_ppm          NUMERIC(6,1),
    UNIQUE (perfil_id, profundidad_desde_cm)
);

-- ---------------------------------------------------------------------
-- 5. Clima y ENSO
-- ---------------------------------------------------------------------
-- ONI trimestral de NOAA (anomalía de temperatura del mar en Niño 3.4).
CREATE TABLE enso_oni (
    anio                SMALLINT NOT NULL,
    trimestre           CHAR(3) NOT NULL CHECK (trimestre IN ('DJF','JFM','FMA','MAM','AMJ','MJJ','JJA','JAS','ASO','SON','OND','NDJ')),
    valor               NUMERIC(4,2) NOT NULL,
    es_pronostico       BOOLEAN NOT NULL DEFAULT FALSE,  -- IRI/CPC para campañas futuras
    fuente_id           INTEGER REFERENCES fuente_dato(id),
    PRIMARY KEY (anio, trimestre)
);

-- Campaña agrícola (jul→jun). La fase ENSO se calcula con el ONI de OND
-- del año de siembra (mismo criterio que AgroENSO): >= +0.5 Niño, <= -0.5 Niña.
CREATE TABLE campania (
    id                  TEXT PRIMARY KEY,          -- '2025/26'
    anio_inicio         SMALLINT NOT NULL UNIQUE,
    -- Se deja editable para poder cargar la fase pronosticada antes de que exista el ONI real.
    fase_enso_manual    TEXT CHECK (fase_enso_manual IN ('nino', 'nina', 'neutral'))
);

-- Pronóstico probabilístico oficial NOAA CPC/IRI: para cada trimestre
-- próximo, % de chance de Niña / Neutral / Niño. Se guarda cada emisión
-- (sale el 2º jueves de cada mes) para no perder la historia.
CREATE TABLE enso_pronostico (
    emitido             DATE NOT NULL,             -- mes de emisión (día 1)
    anio                SMALLINT NOT NULL,         -- año del trimestre (el del mes del medio, como en enso_oni)
    trimestre           CHAR(3) NOT NULL,
    prob_nina_pct       SMALLINT NOT NULL,
    prob_neutral_pct    SMALLINT NOT NULL,
    prob_nino_pct       SMALLINT NOT NULL,
    fuente_id           INTEGER REFERENCES fuente_dato(id),
    PRIMARY KEY (emitido, anio, trimestre)
);

-- Fase de cada campaña: ONI observado de OND si ya existe; si no, el
-- pronóstico más reciente para ese OND (la fase más probable); si no, la manual.
CREATE VIEW v_campania_enso AS
SELECT
    c.id AS campania_id,
    c.anio_inicio,
    o.valor AS oni_ond,
    (o.valor IS NULL AND p.anio IS NOT NULL) AS es_pronostico,
    p.prob_nina_pct, p.prob_neutral_pct, p.prob_nino_pct,
    COALESCE(
        c.fase_enso_manual,
        CASE WHEN o.valor >= 0.5 THEN 'nino'
             WHEN o.valor <= -0.5 THEN 'nina'
             WHEN o.valor IS NOT NULL THEN 'neutral' END,
        CASE WHEN p.prob_nino_pct >= greatest(p.prob_nina_pct, p.prob_neutral_pct) THEN 'nino'
             WHEN p.prob_nina_pct >= p.prob_neutral_pct THEN 'nina'
             WHEN p.anio IS NOT NULL THEN 'neutral' END
    ) AS fase_enso,
    CASE WHEN abs(o.valor) >= 1.5 THEN 'fuerte'
         WHEN abs(o.valor) >= 1.0 THEN 'moderado'
         WHEN abs(o.valor) >= 0.5 THEN 'debil' END AS intensidad_enso
FROM campania c
LEFT JOIN enso_oni o ON o.anio = c.anio_inicio AND o.trimestre = 'OND'
LEFT JOIN LATERAL (
    SELECT * FROM enso_pronostico ep
    WHERE ep.anio = c.anio_inicio AND ep.trimestre = 'OND'
    ORDER BY ep.emitido DESC LIMIT 1
) p ON TRUE;

-- Grilla de clima (NASA POWER tiene resolución ~0.5°). Cada lote y
-- departamento se asocia a la celda más cercana.
CREATE TABLE celda_clima (
    id                  SERIAL PRIMARY KEY,
    lat                 NUMERIC(7,4) NOT NULL,
    lon                 NUMERIC(7,4) NOT NULL,
    UNIQUE (lat, lon)
);

CREATE TABLE clima_diario (
    celda_id            INTEGER NOT NULL REFERENCES celda_clima(id),
    fecha               DATE NOT NULL,
    t_max_c             NUMERIC(4,1),
    t_min_c             NUMERIC(4,1),
    precipitacion_mm    NUMERIC(6,1),
    radiacion_mj_m2     NUMERIC(5,2),
    humedad_relativa_pct NUMERIC(5,1),
    viento_m_s          NUMERIC(4,1),
    et0_mm              NUMERIC(5,2),              -- evapotranspiración de referencia
    fuente_id           INTEGER REFERENCES fuente_dato(id),
    PRIMARY KEY (celda_id, fecha)
);

-- Clima y suelo "de referencia" de cada departamento (celda que contiene su
-- centroide y perfil SoilGrids en ese punto). Se usan cuando un lote no
-- tiene coordenadas o análisis propios, y para cruzar con MAGyP.
ALTER TABLE departamento
    ADD COLUMN celda_clima_id  INTEGER REFERENCES celda_clima(id),
    ADD COLUMN suelo_perfil_id INTEGER REFERENCES suelo_perfil(id);

-- ---------------------------------------------------------------------
-- 6. Economía
-- ---------------------------------------------------------------------
CREATE TABLE tipo_cambio (
    fecha               DATE NOT NULL,
    tipo                TEXT NOT NULL CHECK (tipo IN ('oficial_mayorista', 'oficial_minorista', 'mep', 'ccl', 'blue')),
    valor_ars_usd       NUMERIC(12,4) NOT NULL,
    fuente_id           INTEGER REFERENCES fuente_dato(id),
    PRIMARY KEY (fecha, tipo)
);

-- Pizarra BCR (disponible) y futuros MATba-Rofex.
CREATE TABLE precio_grano (
    id                  BIGSERIAL PRIMARY KEY,
    fecha               DATE NOT NULL,
    especie_id          INTEGER NOT NULL REFERENCES especie(id),
    mercado             TEXT NOT NULL,             -- 'BCR-pizarra', 'MATBA-ROFEX'
    tipo                TEXT NOT NULL CHECK (tipo IN ('disponible', 'futuro', 'forward')),
    posicion            TEXT,                      -- 'MAY27' para futuros; NULL para disponible
    plaza               TEXT,                      -- 'Rosario', 'Quequén', ...
    precio              NUMERIC(12,2) NOT NULL,
    moneda              TEXT NOT NULL CHECK (moneda IN ('USD', 'ARS')),
    unidad              TEXT NOT NULL DEFAULT 'tn',
    fuente_id           INTEGER REFERENCES fuente_dato(id),
    UNIQUE NULLS NOT DISTINCT (fecha, especie_id, mercado, tipo, posicion, plaza)
);

-- Precios de grano en USD/tn: los que vienen en pesos (pizarra BCR) se pasan
-- con el tipo de cambio oficial del mismo día o del último día hábil anterior.
-- Entre abr-1991 y ene-2002 rige la convertibilidad (1 = 1); antes, sin conversión.
CREATE VIEW v_precio_grano_usd AS
SELECT
    pg.fecha, pg.especie_id, e.nombre AS especie, pg.mercado, pg.tipo, pg.posicion, pg.plaza,
    pg.precio AS precio_original, pg.moneda,
    tc.valor_ars_usd,
    round(CASE
        WHEN pg.moneda = 'USD' THEN pg.precio
        WHEN tc.valor_ars_usd IS NOT NULL THEN pg.precio / tc.valor_ars_usd
        WHEN pg.fecha BETWEEN DATE '1991-04-01' AND DATE '2002-01-10' THEN pg.precio
    END, 2) AS precio_usd_tn
FROM precio_grano pg
JOIN especie e ON e.id = pg.especie_id
LEFT JOIN LATERAL (
    SELECT t.valor_ars_usd FROM tipo_cambio t
    WHERE pg.moneda = 'ARS' AND t.tipo = 'oficial_mayorista'
      AND t.fecha <= pg.fecha AND t.fecha > pg.fecha - 10
    ORDER BY t.fecha DESC LIMIT 1
) tc ON TRUE;

-- Precio actual de cada futuro vigente (último cierre de cada posición que
-- todavía no venció). Es lo que usa el cálculo de margen como precio a cosecha.
CREATE VIEW v_futuro_actual AS
WITH futuros AS (
    SELECT pg.*,
           -- 'MAY27' → 2027-05-01
           make_date(2000 + right(pg.posicion, 2)::INT,
                     array_position(ARRAY['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'], left(pg.posicion, 3)),
                     1) AS mes_vencimiento
    FROM precio_grano pg
    WHERE pg.mercado = 'MATBA-ROFEX' AND pg.tipo = 'futuro' AND pg.posicion ~ '^[A-Z]{3}\d{2}$'
)
SELECT DISTINCT ON (f.especie_id, f.mes_vencimiento)
    e.nombre AS especie,
    f.posicion,
    f.mes_vencimiento,
    f.fecha AS fecha_cierre,
    f.precio AS precio_usd_tn
FROM futuros f
JOIN especie e ON e.id = f.especie_id
WHERE f.mes_vencimiento >= date_trunc('month', current_date)
ORDER BY f.especie_id, f.mes_vencimiento, f.fecha DESC;

-- Derechos de exportación: cambian seguido y afectan directo el precio que cobra el productor.
CREATE TABLE derecho_exportacion (
    especie_id          INTEGER NOT NULL REFERENCES especie(id),
    vigente_desde       DATE NOT NULL,
    alicuota_pct        NUMERIC(5,2) NOT NULL,
    norma               TEXT,
    PRIMARY KEY (especie_id, vigente_desde)
);

CREATE TABLE insumo (
    id                  SERIAL PRIMARY KEY,
    nombre              TEXT NOT NULL UNIQUE,      -- 'Urea', 'MAP', 'Glifosato 66%', 'Gasoil'
    categoria           TEXT NOT NULL CHECK (categoria IN ('fertilizante', 'herbicida', 'insecticida', 'fungicida', 'inoculante', 'curasemilla', 'semilla', 'combustible', 'labor', 'otro')),
    unidad              TEXT NOT NULL,             -- 'kg', 'l', 'bolsa', 'ha'
    -- Contenido de nutrientes, para pasar de kg de producto a kg de N/P/S
    n_pct               NUMERIC(5,2),
    p_pct               NUMERIC(5,2),
    k_pct               NUMERIC(5,2),
    s_pct               NUMERIC(5,2)
);

CREATE TABLE precio_insumo (
    insumo_id           INTEGER NOT NULL REFERENCES insumo(id),
    fecha               DATE NOT NULL,
    precio              NUMERIC(12,2) NOT NULL,
    moneda              TEXT NOT NULL CHECK (moneda IN ('USD', 'ARS')),
    fuente_id           INTEGER REFERENCES fuente_dato(id),
    PRIMARY KEY (insumo_id, fecha, fuente_id)
);

-- Avisos de alquiler scrapeados (Agroads, Agrofy, Argenprop, Zonaprop, ...).
-- Se guarda el texto original además de lo normalizado porque los precios
-- vienen en unidades muy distintas (qq soja/ha, USD/ha, kg carne/ha).
CREATE TABLE aviso_alquiler_campo (
    id                  BIGSERIAL PRIMARY KEY,
    fuente              TEXT NOT NULL,
    id_externo          TEXT NOT NULL,
    titulo              TEXT NOT NULL,
    precio              NUMERIC(14,2),
    moneda              TEXT,
    precio_texto        TEXT,
    unidad_precio       TEXT CHECK (unidad_precio IN ('qq_soja_ha', 'usd_ha', 'ars_ha', 'kg_carne_ha', 'total', 'otro')),
    superficie_ha       NUMERIC(10,1),
    superficie_texto    TEXT,
    ubicacion_texto     TEXT,
    departamento_id     INTEGER REFERENCES departamento(id),
    aptitud             TEXT,                      -- agrícola, ganadero, mixto
    inmobiliaria        TEXT,
    url                 TEXT NOT NULL,
    imagen_url          TEXT,
    scrapeado_en        TIMESTAMPTZ NOT NULL,
    UNIQUE (fuente, id_externo)
);

-- ---------------------------------------------------------------------
-- 7. Estadísticas históricas regionales (MAGyP)
-- ---------------------------------------------------------------------
-- Superficie y rendimiento por departamento y campaña desde 1969. Es el
-- histórico más largo que hay y lo que permite medir el efecto Niño/Niña
-- por zona antes de tener datos propios de lotes.
-- MAGyP usa sus propios nombres de cultivo ('soja 1ra', 'soja 2da',
-- 'soja total', 'trigo total', ...), así que la clave es ese nombre y
-- especie_id es el cruce con el catálogo de INASE (NULL para frutales,
-- hortalizas, etc. que el sistema no predice).
CREATE TABLE estimacion_agricola (
    campania_id             TEXT NOT NULL REFERENCES campania(id),
    departamento_id         INTEGER NOT NULL REFERENCES departamento(id),
    cultivo_magyp           TEXT NOT NULL,
    especie_id              INTEGER REFERENCES especie(id),
    tipo_siembra            TEXT NOT NULL DEFAULT 'total' CHECK (tipo_siembra IN ('total', '1ra', '2da')),
    superficie_sembrada_ha  NUMERIC(12,1),
    superficie_cosechada_ha NUMERIC(12,1),
    produccion_tn           NUMERIC(14,1),
    rendimiento_kg_ha       NUMERIC(8,1),          -- NULL si no se cosechó nada
    fuente_id               INTEGER REFERENCES fuente_dato(id),
    PRIMARY KEY (campania_id, departamento_id, cultivo_magyp)
);
CREATE INDEX estimacion_agricola_especie_idx ON estimacion_agricola (especie_id, departamento_id);

-- Rinde de cada departamento contra la fase ENSO de la campaña: la primera
-- aproximación al "efecto Niño/Niña" por zona y cultivo. Los rindes suben
-- año a año por genética y manejo, así que se comparan contra la tendencia
-- lineal del propio departamento/cultivo (como AgroENSO) y no contra un
-- promedio histórico, que haría ver cualquier año reciente como "bueno".
CREATE VIEW v_rendimiento_enso AS
WITH base AS (
    SELECT
        ea.campania_id, c.anio_inicio, ea.departamento_id, d.nombre AS departamento,
        p.nombre AS provincia, ea.cultivo_magyp, ea.especie_id,
        ea.superficie_sembrada_ha, ea.rendimiento_kg_ha,
        ce.fase_enso, ce.intensidad_enso, ce.oni_ond
    FROM estimacion_agricola ea
    JOIN campania c ON c.id = ea.campania_id
    JOIN departamento d ON d.id = ea.departamento_id
    JOIN provincia p ON p.id = d.provincia_id
    LEFT JOIN v_campania_enso ce ON ce.campania_id = ea.campania_id
    WHERE ea.rendimiento_kg_ha > 0
),
tendencia AS (
    SELECT
        b.*,
        count(*) OVER w AS campanias_serie,
        regr_intercept(b.rendimiento_kg_ha, b.anio_inicio) OVER w
          + regr_slope(b.rendimiento_kg_ha, b.anio_inicio) OVER w * b.anio_inicio AS tendencia
    FROM base b
    WINDOW w AS (PARTITION BY b.departamento_id, b.cultivo_magyp)
)
SELECT
    campania_id, anio_inicio, departamento_id, departamento, provincia, cultivo_magyp, especie_id,
    superficie_sembrada_ha, rendimiento_kg_ha, fase_enso, intensidad_enso, oni_ond,
    campanias_serie,
    round(tendencia::NUMERIC, 1) AS rendimiento_tendencia_kg_ha,
    -- Con menos de 10 campañas la tendencia no es confiable
    CASE WHEN campanias_serie >= 10 AND tendencia > 0
         THEN round((100.0 * rendimiento_kg_ha / tendencia - 100)::NUMERIC, 1) END AS desvio_vs_tendencia_pct
FROM tendencia;

-- ---------------------------------------------------------------------
-- 8. Datos del productor
-- ---------------------------------------------------------------------
-- usuario_id es el id de Better Auth (TEXT); no se pone FK porque esas
-- tablas las crea Better Auth/Drizzle más adelante.
CREATE TABLE establecimiento (
    id                  SERIAL PRIMARY KEY,
    usuario_id          TEXT NOT NULL,
    nombre              TEXT NOT NULL,
    departamento_id     INTEGER REFERENCES departamento(id),
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX establecimiento_usuario_idx ON establecimiento (usuario_id);

CREATE TABLE lote (
    id                  SERIAL PRIMARY KEY,
    establecimiento_id  INTEGER NOT NULL REFERENCES establecimiento(id) ON DELETE CASCADE,
    nombre              TEXT NOT NULL,
    superficie_ha       NUMERIC(10,2) NOT NULL CHECK (superficie_ha > 0),
    lat                 NUMERIC(8,5),
    lon                 NUMERIC(8,5),
    contorno_geojson    JSONB,
    suelo_perfil_id     INTEGER REFERENCES suelo_perfil(id),
    celda_clima_id      INTEGER REFERENCES celda_clima(id),
    tenencia            TEXT CHECK (tenencia IN ('propio', 'alquilado', 'aparceria')),
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (establecimiento_id, nombre)
);

-- Ambientes dentro del lote (zonificación alta/media/baja, como ASISTA).
CREATE TABLE ambiente_lote (
    id                  SERIAL PRIMARY KEY,
    lote_id             INTEGER NOT NULL REFERENCES lote(id) ON DELETE CASCADE,
    nombre              TEXT NOT NULL,             -- 'ALTA', 'MEDIA', 'BAJA'
    superficie_ha       NUMERIC(10,2),
    indice_ambiental_tn_ha NUMERIC(5,2),           -- potencial de rinde del ambiente
    UNIQUE (lote_id, nombre)
);

-- Hecho central: qué se sembró en un lote en una campaña, cómo y qué rindió.
-- Una fila por cultivo (en doble cultivo, p. ej. trigo/soja, hay dos filas
-- con distinto orden_en_campania).
CREATE TABLE lote_campania (
    id                      SERIAL PRIMARY KEY,
    lote_id                 INTEGER NOT NULL REFERENCES lote(id) ON DELETE CASCADE,
    campania_id             TEXT NOT NULL REFERENCES campania(id),
    orden_en_campania       SMALLINT NOT NULL DEFAULT 1,  -- 1 = primera, 2 = de segunda
    especie_id              INTEGER NOT NULL REFERENCES especie(id),
    cultivar_id             INTEGER REFERENCES cultivar(id),

    -- Antecesor: se deduce de la campaña anterior del mismo lote si está
    -- cargada; si no, el productor lo puede declarar acá. Puede quedar NULL.
    antecesor_especie_id    INTEGER REFERENCES especie(id),
    antecesor_declarado     BOOLEAN NOT NULL DEFAULT FALSE,
    cultivo_servicio        TEXT,                  -- vicia, centeno, ... entre cosecha y siembra

    -- Siembra y manejo
    fecha_siembra           DATE,
    densidad_semillas_m2    NUMERIC(6,2),
    distancia_surcos_cm     SMALLINT,
    sistema_labranza        TEXT CHECK (sistema_labranza IN ('directa', 'convencional', 'minima')),
    riego                   BOOLEAN NOT NULL DEFAULT FALSE,
    agua_util_siembra_pct   NUMERIC(5,1),          -- % de agua útil del perfil al sembrar
    profundidad_napa_cm     SMALLINT,

    -- Resultado (la variable a predecir)
    fecha_cosecha           DATE,
    rendimiento_kg_ha       NUMERIC(8,1),
    humedad_cosecha_pct     NUMERIC(4,1),
    superficie_cosechada_ha NUMERIC(10,2),

    -- Adversidades de la campaña: explican rindes fuera de lo esperado
    -- y conviene poder excluirlas al entrenar.
    adversidades            TEXT[],                -- {'granizo','helada','sequia','chicharrita',...}
    adversidad_perdida_pct  NUMERIC(5,1),

    -- Economía del lote en esa campaña
    costo_alquiler_usd_ha   NUMERIC(10,2),
    costo_alquiler_qq_ha    NUMERIC(6,2),
    precio_venta_usd_tn     NUMERIC(10,2),
    gastos_comercializacion_pct NUMERIC(5,2),

    notas                   TEXT,
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (lote_id, campania_id, orden_en_campania)
);
CREATE INDEX lote_campania_campania_idx ON lote_campania (campania_id, especie_id);

-- Fertilizantes, fitosanitarios, semilla, labores aplicados al cultivo.
CREATE TABLE aplicacion_insumo (
    id                  SERIAL PRIMARY KEY,
    lote_campania_id    INTEGER NOT NULL REFERENCES lote_campania(id) ON DELETE CASCADE,
    insumo_id           INTEGER NOT NULL REFERENCES insumo(id),
    fecha               DATE,
    momento             TEXT,                      -- 'presiembra', 'siembra', 'V6', 'R3', ...
    dosis               NUMERIC(10,2) NOT NULL,
    unidad_dosis        TEXT NOT NULL,             -- 'kg/ha', 'l/ha', 'ha'
    costo_usd_ha        NUMERIC(10,2)
);
CREATE INDEX aplicacion_insumo_lc_idx ON aplicacion_insumo (lote_campania_id);

-- ---------------------------------------------------------------------
-- 9. Recomendaciones externas y predicciones del sistema
-- ---------------------------------------------------------------------
-- Recomendaciones de herramientas de semilleras (ASISTA/Nidera, etc.), por
-- ambiente. Sirven como referencia/benchmark de nuestras predicciones.
CREATE TABLE recomendacion_externa (
    id                      SERIAL PRIMARY KEY,
    lote_campania_id        INTEGER REFERENCES lote_campania(id) ON DELETE CASCADE,
    ambiente_id             INTEGER REFERENCES ambiente_lote(id) ON DELETE CASCADE,
    fuente                  TEXT NOT NULL,         -- 'asista'
    url_reporte             TEXT,
    cultivar_id             INTEGER REFERENCES cultivar(id),
    estrategia              TEXT,                  -- 'Moderada', ...
    fecha_siembra_optima    DATE,
    indice_ambiental_tn_ha  NUMERIC(5,2),
    densidad_optima_sem_m2  NUMERIC(6,2),
    rendimiento_esperado_kg_ha NUMERIC(8,1),
    fertilizante_insumo_id  INTEGER REFERENCES insumo(id),
    fertilizante_kg_ha      NUMERIC(8,2),
    bolsas_semilla          NUMERIC(8,2),
    coeficiente_logro_pct   NUMERIC(5,1),
    datos_originales        JSONB,                 -- reporte completo tal cual vino
    obtenido_en             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE modelo (
    id                  SERIAL PRIMARY KEY,
    nombre              TEXT NOT NULL,
    version             TEXT NOT NULL,
    especie_id          INTEGER REFERENCES especie(id),
    descripcion         TEXT,
    metricas            JSONB,                     -- RMSE, MAE, R2 sobre validación
    entrenado_en        TIMESTAMPTZ,
    UNIQUE (nombre, version)
);

-- Cada simulación que corre el usuario. Las entradas se guardan como JSONB
-- porque un escenario puede ser hipotético (otro cultivar, otra fecha, otra
-- fase ENSO) y no tiene por qué coincidir con lo cargado en lote_campania.
CREATE TABLE prediccion (
    id                      BIGSERIAL PRIMARY KEY,
    modelo_id               INTEGER NOT NULL REFERENCES modelo(id),
    usuario_id              TEXT,
    lote_campania_id        INTEGER REFERENCES lote_campania(id) ON DELETE SET NULL,
    lote_id                 INTEGER REFERENCES lote(id) ON DELETE SET NULL,
    escenario_nombre        TEXT,
    entradas                JSONB NOT NULL,
    rendimiento_p10_kg_ha   NUMERIC(8,1),
    rendimiento_p50_kg_ha   NUMERIC(8,1) NOT NULL,
    rendimiento_p90_kg_ha   NUMERIC(8,1),
    ingreso_bruto_usd_ha    NUMERIC(10,2),
    costo_total_usd_ha      NUMERIC(10,2),
    margen_bruto_usd_ha     NUMERIC(10,2),
    rinde_indiferencia_kg_ha NUMERIC(8,1),
    explicacion             JSONB,                 -- importancia de cada variable (SHAP, etc.)
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX prediccion_lote_campania_idx ON prediccion (lote_campania_id);

-- ---------------------------------------------------------------------
-- 10. Vista para entrenamiento
-- ---------------------------------------------------------------------
-- Una fila por cultivo-lote-campaña con todas las variables de entrada ya
-- cruzadas. El antecesor se toma de lo declarado o, si falta, del cultivo
-- cargado en la campaña anterior del mismo lote.
CREATE VIEW v_dataset_entrenamiento AS
WITH clima_campania AS (
    SELECT
        lc.id AS lote_campania_id,
        sum(cd.precipitacion_mm) AS lluvia_ciclo_mm,
        sum(cd.et0_mm) AS et0_ciclo_mm,
        count(*) FILTER (WHERE cd.t_min_c <= 0) AS dias_helada,
        count(*) FILTER (WHERE cd.t_max_c >= 35) AS dias_calor_extremo,
        avg(cd.radiacion_mj_m2) AS radiacion_media
    FROM lote_campania lc
    JOIN lote l ON l.id = lc.lote_id
    JOIN establecimiento est ON est.id = l.establecimiento_id
    LEFT JOIN departamento dep ON dep.id = est.departamento_id
    JOIN clima_diario cd
      ON cd.celda_id = COALESCE(l.celda_clima_id, dep.celda_clima_id)
     AND cd.fecha BETWEEN lc.fecha_siembra
                      AND COALESCE(lc.fecha_cosecha, lc.fecha_siembra + 160)
    GROUP BY lc.id
),
nutrientes AS (
    SELECT
        ai.lote_campania_id,
        round(sum(ai.dosis * i.n_pct / 100) FILTER (WHERE ai.unidad_dosis = 'kg/ha'), 1) AS n_kg_ha,
        round(sum(ai.dosis * i.p_pct / 100) FILTER (WHERE ai.unidad_dosis = 'kg/ha'), 1) AS p_kg_ha,
        round(sum(ai.dosis * i.s_pct / 100) FILTER (WHERE ai.unidad_dosis = 'kg/ha'), 1) AS s_kg_ha,
        sum(ai.costo_usd_ha) AS costo_insumos_usd_ha
    FROM aplicacion_insumo ai
    JOIN insumo i ON i.id = ai.insumo_id
    GROUP BY ai.lote_campania_id
)
SELECT
    lc.id AS lote_campania_id,
    lc.campania_id,
    e.nombre AS especie,
    -- ENSO
    ce.fase_enso,
    ce.oni_ond,
    -- Semilla
    cv.nombre AS cultivar,
    cv.condicion_genetica,
    cv.es_hibrido,
    cv.grupo_madurez,
    cv.madurez_relativa_dias,
    cv.evento_transgenico,
    -- Suelo
    ts.nombre AS textura_suelo,
    sp.profundidad_efectiva_cm,
    sp.indice_productividad_inta,
    sp.capacidad_agua_util_mm,
    COALESCE(lc.profundidad_napa_cm, sp.profundidad_napa_cm) AS profundidad_napa_cm,
    sh.materia_organica_pct AS mo_superficial_pct,
    sh.ph AS ph_superficial,
    sh.fosforo_bray_ppm,
    -- Antecesor (opcional)
    COALESCE(ant_decl.nombre, ant_prev.nombre) AS antecesor,
    lc.cultivo_servicio,
    -- Manejo
    lc.fecha_siembra,
    EXTRACT(DOY FROM lc.fecha_siembra)::INT AS dia_juliano_siembra,
    lc.orden_en_campania,
    lc.densidad_semillas_m2,
    lc.distancia_surcos_cm,
    lc.sistema_labranza,
    lc.riego,
    lc.agua_util_siembra_pct,
    n.n_kg_ha,
    n.p_kg_ha,
    n.s_kg_ha,
    -- Clima del ciclo
    cc.lluvia_ciclo_mm,
    cc.et0_ciclo_mm,
    cc.dias_helada,
    cc.dias_calor_extremo,
    cc.radiacion_media,
    -- Ubicación
    d.provincia_id,
    est.departamento_id,
    l.lat,
    l.lon,
    ea.rendimiento_kg_ha AS rendimiento_depto_kg_ha,
    -- Economía
    l.tenencia,
    lc.costo_alquiler_usd_ha,
    n.costo_insumos_usd_ha,
    lc.precio_venta_usd_tn,
    -- Objetivo
    lc.rendimiento_kg_ha,
    lc.adversidades,
    lc.adversidad_perdida_pct
FROM lote_campania lc
JOIN lote l ON l.id = lc.lote_id
JOIN establecimiento est ON est.id = l.establecimiento_id
JOIN especie e ON e.id = lc.especie_id
JOIN campania cam ON cam.id = lc.campania_id
LEFT JOIN v_campania_enso ce ON ce.campania_id = lc.campania_id
LEFT JOIN cultivar cv ON cv.id = lc.cultivar_id
LEFT JOIN departamento dsuelo ON dsuelo.id = est.departamento_id
-- Suelo propio del lote o, si no tiene, el perfil SoilGrids del departamento
LEFT JOIN suelo_perfil sp ON sp.id = COALESCE(l.suelo_perfil_id, dsuelo.suelo_perfil_id)
LEFT JOIN textura_suelo ts ON ts.id = sp.textura_id
LEFT JOIN suelo_horizonte sh ON sh.perfil_id = sp.id AND sh.profundidad_desde_cm = 0
LEFT JOIN especie ant_decl ON ant_decl.id = lc.antecesor_especie_id
LEFT JOIN LATERAL (
    SELECT e2.nombre
    FROM lote_campania prev
    JOIN campania c2 ON c2.id = prev.campania_id
    JOIN especie e2 ON e2.id = prev.especie_id
    WHERE prev.lote_id = lc.lote_id
      AND (c2.anio_inicio, prev.orden_en_campania) < (cam.anio_inicio, lc.orden_en_campania)
    ORDER BY c2.anio_inicio DESC, prev.orden_en_campania DESC
    LIMIT 1
) ant_prev ON TRUE
LEFT JOIN departamento d ON d.id = est.departamento_id
-- Rinde del departamento para ese cultivo: si MAGyP distingue 1ra/2da
-- (soja) se usa la que corresponde; si no, el total.
LEFT JOIN LATERAL (
    SELECT e.rendimiento_kg_ha
    FROM estimacion_agricola e
    WHERE e.campania_id = lc.campania_id
      AND e.departamento_id = est.departamento_id
      AND e.especie_id = lc.especie_id
    ORDER BY (e.tipo_siembra = CASE lc.orden_en_campania WHEN 1 THEN '1ra' ELSE '2da' END) DESC,
             (e.tipo_siembra = 'total') DESC
    LIMIT 1
) ea ON TRUE
LEFT JOIN clima_campania cc ON cc.lote_campania_id = lc.id
LEFT JOIN nutrientes n ON n.lote_campania_id = lc.id;
