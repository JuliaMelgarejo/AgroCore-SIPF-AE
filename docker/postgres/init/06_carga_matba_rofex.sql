-- Futuros de granos de Matba Rofex (data/raw/matba-rofex-futuros.csv).
-- El archivo lo genera `pnpm fuentes:rofex` desde la plataforma pública Matriz
-- (sin cuenta); si todavía no existe, este paso se saltea sin error.
-- Se puede volver a correr sobre una base ya creada para sumar cierres nuevos.

INSERT INTO fuente_dato (codigo, nombre, url, tipo, notas) VALUES
    ('matba-rofex', 'Matba Rofex - plataforma Matriz (futuros de granos)', 'https://matbarofex.primary.ventures', 'scraping',
     'Serie diaria pública (modo invitado) de /api/v2/series/securities. API interna del sitio, no documentada. USD/tn, desde 2019.')
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, url = EXCLUDED.url, tipo = EXCLUDED.tipo, notas = EXCLUDED.notas;

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
           (SELECT id FROM fuente_dato WHERE codigo = 'matba-rofex')
    FROM stg_rofex s
    JOIN especie e ON e.nombre = s.especie
    ON CONFLICT (fecha, especie_id, mercado, tipo, posicion, plaza) DO UPDATE SET precio = EXCLUDED.precio;

    DROP TABLE stg_rofex;
    UPDATE fuente_dato SET ultima_carga = now() WHERE codigo = 'matba-rofex';
END $$;
