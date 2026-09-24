-- Catálogos fijos: fuentes, provincias, texturas, campañas, insumos comunes.

INSERT INTO fuente_dato (codigo, nombre, url, tipo, notas) VALUES
    ('inase',          'INASE - Catálogo Nacional de Cultivares (RNC/RNPC)', 'https://gestion.inase.gob.ar/registroCultivares/publico/catalogo', 'scraping', 'También publicado en datos.magyp.gob.ar'),
    ('asista',         'ASISTA - Experiencia Nidera (recomendaciones por lote)', 'https://asista.experiencianidera.com', 'manual', 'Reportes compartidos por link; hay que cargarlos a mano o scrapear cada link'),
    ('agroenso',       'AgroENSO - rindes vs. ENSO', 'https://agroenso.netlify.app/', 'manual', 'Usa ONI de NOAA (trimestre OND) y estimaciones MAGyP'),
    ('soilgrids',      'ISRIC SoilGrids 250m', 'https://soilgrids.org/', 'api', 'Licencia CC-BY 4.0'),
    ('nasa-power',     'NASA POWER - datos agroclimáticos diarios', 'https://power.larc.nasa.gov/', 'api', 'Grilla ~0.5°, desde 1981'),
    ('matba-rofex',    'MATba-Rofex / Primary - futuros', 'https://matbarofex.primary.ventures/fyo/futurosfinancieros', 'scraping', NULL),
    ('bcr',            'Bolsa de Comercio de Rosario - precios pizarra', 'https://www.bcr.com.ar/es', 'scraping', NULL),
    ('agroads',        'Agroads - avisos de alquiler de campos', 'https://www.agroads.com.ar', 'scraping', NULL),
    ('agrofy',         'Agrofy - avisos de alquiler de campos', 'https://www.agrofy.com.ar', 'scraping', NULL),
    ('argenprop',      'Argenprop - campos', 'https://www.argenprop.com', 'scraping', NULL),
    ('zonaprop',       'Zonaprop - campos en alquiler', 'https://www.zonaprop.com.ar', 'scraping', 'Bloquea el scraping (status blocked)'),
    ('nordheimer',     'Nordheimer - campos', 'https://nordheimer.com', 'scraping', NULL),
    ('mercadolibre',   'MercadoLibre - alquiler de hectáreas', 'https://listado.mercadolibre.com.ar/alquiler-hectarea-en-rosario', 'scraping', NULL),
    ('magyp-estimaciones', 'MAGyP - Estimaciones agrícolas por departamento', 'https://datos.magyp.gob.ar/dataset/estimaciones-agricolas', 'descarga', 'Superficie, producción y rinde por departamento desde 1969/70'),
    ('noaa-oni',       'NOAA CPC - Oceanic Niño Index (ONI)', 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt', 'descarga', 'Anomalía trimestral Niño 3.4 desde 1950'),
    ('usuario',        'Carga del productor', NULL, 'usuario', NULL),
    ('sipf-modelo',    'Predicciones del sistema', NULL, 'modelo', NULL);

INSERT INTO provincia (id, nombre) VALUES
    (2, 'Ciudad Autónoma de Buenos Aires'), (6, 'Buenos Aires'), (10, 'Catamarca'),
    (14, 'Córdoba'), (18, 'Corrientes'), (22, 'Chaco'), (26, 'Chubut'),
    (30, 'Entre Ríos'), (34, 'Formosa'), (38, 'Jujuy'), (42, 'La Pampa'),
    (46, 'La Rioja'), (50, 'Mendoza'), (54, 'Misiones'), (58, 'Neuquén'),
    (62, 'Río Negro'), (66, 'Salta'), (70, 'San Juan'), (74, 'San Luis'),
    (78, 'Santa Cruz'), (82, 'Santa Fe'), (86, 'Santiago del Estero'),
    (90, 'Tucumán'), (94, 'Tierra del Fuego');

-- Clases texturales USDA
INSERT INTO textura_suelo (nombre) VALUES
    ('Arenoso'), ('Arenoso franco'), ('Franco arenoso'), ('Franco'),
    ('Franco limoso'), ('Limoso'), ('Franco arcillo arenoso'), ('Franco arcilloso'),
    ('Franco arcillo limoso'), ('Arcillo arenoso'), ('Arcillo limoso'), ('Arcilloso');

-- Campañas 1969/70 → 2030/31 (el histórico de MAGyP arranca en 1969/70)
INSERT INTO campania (id, anio_inicio)
SELECT y || '/' || lpad(((y + 1) % 100)::TEXT, 2, '0'), y
FROM generate_series(1969, 2030) AS y;

-- Insumos más comunes, con su contenido de nutrientes (% en peso)
INSERT INTO insumo (nombre, categoria, unidad, n_pct, p_pct, k_pct, s_pct) VALUES
    ('Urea',                          'fertilizante', 'kg', 46,   NULL, NULL, NULL),
    ('UAN (solución 32%)',            'fertilizante', 'kg', 32,   NULL, NULL, NULL),
    ('Fosfato monoamónico (MAP)',     'fertilizante', 'kg', 11,   22.7, NULL, NULL),
    ('Fosfato diamónico (DAP)',       'fertilizante', 'kg', 18,   20.1, NULL, NULL),
    ('Superfosfato triple (SPT)',     'fertilizante', 'kg', NULL, 20,   NULL, NULL),
    ('Superfosfato simple (SPS)',     'fertilizante', 'kg', NULL, 9,    NULL, 12),
    ('Sulfato de amonio',             'fertilizante', 'kg', 21,   NULL, NULL, 24),
    ('Tiosulfato de amonio (ATS)',    'fertilizante', 'kg', 12,   NULL, NULL, 26),
    ('Yeso agrícola',                 'fertilizante', 'kg', NULL, NULL, NULL, 18),
    ('Cloruro de potasio',            'fertilizante', 'kg', NULL, NULL, 50,   NULL),
    ('Glifosato 66%',                 'herbicida',    'l',  NULL, NULL, NULL, NULL),
    ('Atrazina 90%',                  'herbicida',    'kg', NULL, NULL, NULL, NULL),
    ('Inoculante soja',               'inoculante',   'dosis', NULL, NULL, NULL, NULL),
    ('Gasoil',                        'combustible',  'l',  NULL, NULL, NULL, NULL),
    ('Siembra (labor contratada)',    'labor',        'ha', NULL, NULL, NULL, NULL),
    ('Cosecha (labor contratada)',    'labor',        'ha', NULL, NULL, NULL, NULL),
    ('Pulverización terrestre',       'labor',        'ha', NULL, NULL, NULL, NULL);
