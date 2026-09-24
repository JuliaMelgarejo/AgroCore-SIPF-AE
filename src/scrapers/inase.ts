import fs from "node:fs/promises";
import { httpClient } from "../lib/http.js";
import type { CultivarRecord, CultivarScraperOutcome } from "../types.js";

// Catálogo Nacional de Cultivares de INASE (RNC/RNPC): es la base de datos
// VIVA detrás del catálogo público de datos.magyp.gob.ar (que es apenas un
// export estático de 2019, sin nombre comercial ni datos genéticos). Esta sí
// trae, por cada semilla: nombre comercial ("cultivar"), condición genética
// (variedad/híbrido/transgénico), nombre científico, y para transgénicos el
// evento puntual (ej. "MON-Ø4Ø32-6") y qué hace (ej. "Tolerancia a Glifosato").
//
// La clave para cruzar con el dataset de datos.magyp es numero_registro
// (acá) = expediente (allá): se verificó a mano con varios registros
// (mismo id, misma especie, misma fecha de inscripción en ambos lados).
//
// Cómo se consigue el CSV completo:
// La UI tiene un botón "Exportar a CSV" que llama a
//   /publico/catalogo/downloadcsv/{criteria JSON}/{token}
// El {token} final NO lo valida el servidor (se probó pidiendo la misma URL
// con un token inventado y devolvió el mismo archivo), es solo un
// cache-buster que genera el JS de la página. Por eso lo hardcodeamos.
// Con {"criteria":[],"logic":"AND"} (sin filtro) trae TODO: RNC + RNPC,
// ~14.900 filas — más completo que dejar el filtro "Registro = RNC" que
// tiene la UI por defecto (ese deja afuera algunas filas).
const SOURCE = "inase-cultivares";
const PUBLIC_PAGE_URL =
  "https://gestion.inase.gob.ar/registroCultivares/publico/catalogo";
const EXPORT_URL =
  'https://gestion.inase.gob.ar/registroCultivares/publico/catalogo/downloadcsv/%7B%22criteria%22:[],%22logic%22:%22AND%22%7D/scraper';

// Parser de CSV "a mano": el export de INASE es CSV real (RFC4180), con
// campos entre comillas que pueden contener comas (ej. razones sociales
// como "BRADA, RENE EDUARDO"). Un split(",") ingenuo rompe esas filas, así
// que hay que respetar comillas y comillas escapadas ("").
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

export async function scrapeInase(): Promise<CultivarScraperOutcome> {
  const scrapedAt = new Date().toISOString();

  let csvText: string;
  try {
    const response = await httpClient.get<string>(EXPORT_URL, {
      responseType: "text",
    });
    csvText = response.data;
  } catch (error) {
    return {
      source: SOURCE,
      sourceUrl: PUBLIC_PAGE_URL,
      scrapedAt,
      status: "blocked",
      note: `No se pudo descargar el export CSV: ${
        error instanceof Error ? error.message : String(error)
      }`,
      count: 0,
      cultivares: [],
    };
  }

  await fs.mkdir("data/raw", { recursive: true });
  await fs.writeFile("data/raw/inase-cultivares.csv", csvText, "utf-8");

  const rows = parseCsv(csvText);
  const [header, ...dataRows] = rows;

  if (!header) {
    return {
      source: SOURCE,
      sourceUrl: PUBLIC_PAGE_URL,
      scrapedAt,
      status: "no-data",
      note: "El CSV descargado vino vacío.",
      count: 0,
      cultivares: [],
    };
  }

  const col = (name: string) => header.indexOf(name);
  const idx = {
    numero: col("numero"),
    cultivar: col("cultivar"),
    especie: col("especie"),
    condicionGenetica: col("condicion_genetica"),
    nombreCientifico: col("nombre_cientifico"),
    grupo: col("grupo"),
    inscripcionRnc: col("inscripcion_rnc"),
    inscripcionRnpc: col("inscripcion_rnpc"),
    validezRnpc: col("validez_rnpc"),
    pais: col("pais"),
    caracteristicas: col("caracteristicas"),
    eventoTransgenico: col("evento_transgenico"),
    eventoTransgenicoCaracteristica: col("evento_transgenico_caracteristica"),
    solicitanteRnc: col("solicitante_rnc"),
    representanteRnc: col("representante_rnc"),
    solicitanteRnpc: col("solicitante_rnpc"),
    representanteRnpc: col("representante_rnpc"),
  };

  const get = (row: string[], i: number) => (i >= 0 ? row[i] || null : null);

  const cultivares: CultivarRecord[] = dataRows
    .filter((row) => row.length >= header.length - 2 && get(row, idx.numero))
    .map((row) => ({
      source: SOURCE,
      numeroRegistro: get(row, idx.numero) ?? "",
      cultivar: get(row, idx.cultivar) ?? "",
      especie: get(row, idx.especie) ?? "",
      nombreCientifico: get(row, idx.nombreCientifico),
      condicionGenetica: get(row, idx.condicionGenetica),
      grupoEspecie: get(row, idx.grupo),
      inscripcionRnc: get(row, idx.inscripcionRnc),
      inscripcionRnpc: get(row, idx.inscripcionRnpc),
      validezRnpc: get(row, idx.validezRnpc),
      paisOrigen: get(row, idx.pais),
      caracteristicas: get(row, idx.caracteristicas),
      eventoTransgenico: get(row, idx.eventoTransgenico),
      eventoTransgenicoCaracteristica: get(row, idx.eventoTransgenicoCaracteristica),
      solicitanteRnc: get(row, idx.solicitanteRnc),
      representanteRnc: get(row, idx.representanteRnc),
      solicitanteRnpc: get(row, idx.solicitanteRnpc),
      representanteRnpc: get(row, idx.representanteRnpc),
    }));

  await fs.mkdir("data/processed", { recursive: true });
  await fs.writeFile(
    "data/processed/inase-cultivares.json",
    JSON.stringify(cultivares, null, 2),
    "utf-8"
  );

  return {
    source: SOURCE,
    sourceUrl: PUBLIC_PAGE_URL,
    scrapedAt,
    status: "ok",
    count: cultivares.length,
    cultivares,
  };
}
