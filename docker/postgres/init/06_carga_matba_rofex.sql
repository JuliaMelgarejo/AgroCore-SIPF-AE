-- Futuros de granos de Matba Rofex (data/raw/matba-rofex-futuros.csv).
-- El archivo lo genera `pnpm fuentes:rofex` con las credenciales del .env;
-- si todavía no existe, este paso se saltea sin error.

INSERT INTO fuente_dato (codigo, nombre, url, tipo, notas) VALUES
    ('matba-rofex-api', 'Matba Rofex - API Primary (futuros de granos)', 'https://apihub.primary.com.ar/', 'api',
     'Cierre diario = última operación del día. Requiere cuenta con acceso a la API.');

DO $$
BEGIN
    IF pg_stat_file('/seed/raw/matba-rofex-futuros.csv', true) IS NULL THEN
        RAISE NOTICE 'Sin data/raw/matba-rofex-futuros.csv: se omite la carga de futuros';
        RETURN;
    END IF;

    CREATE TEMP TABLE stg_rofex (
        fecha DATE, especie TEXT, posicion TEXT, simbolo TEXT, precio_cierre NUMERIC, volumen NUMERIC
    );
    COPY stg_rofex FROM '/seed/raw/matba-rofex-futuros.csv' WITH (FORMAT csv, HEADER true);

    INSERT INTO precio_grano (fecha, especie_id, mercado, tipo, posicion, plaza, precio, moneda, unidad, fuente_id)
    SELECT s.fecha, e.id, 'MATBA-ROFEX', 'futuro', s.posicion, 'Rosario', s.precio_cierre, 'USD', 'tn',
           (SELECT id FROM fuente_dato WHERE codigo = 'matba-rofex-api')
    FROM stg_rofex s
    JOIN especie e ON e.nombre = s.especie
    ON CONFLICT DO NOTHING;

    UPDATE fuente_dato SET ultima_carga = now() WHERE codigo = 'matba-rofex-api';
END $$;
