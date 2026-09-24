import fs from "node:fs/promises";
import { scrapeAgroads } from "./scrapers/agroads.js";
import { scrapeAgrofy } from "./scrapers/agrofy.js";
import { scrapeArgenprop } from "./scrapers/argenprop.js";
import { scrapeInase } from "./scrapers/inase.js";
import { scrapeMercadoLibre } from "./scrapers/mercadolibre.js";
import { scrapeNordheimer } from "./scrapers/nordheimer.js";
import { scrapeZonaprop } from "./scrapers/zonaprop.js";
import type { ScraperOutcome } from "./types.js";

// Corre cada scraper por separado (cada sitio tiene su propio archivo en
// src/scrapers/, con sus propios comentarios explicando cómo se investigó
// y por qué se armó así). Un error en un sitio no frena a los demás.
//
// scrapeInase queda aparte: no trae avisos de campos (FieldListing) sino
// cultivares (CultivarRecord), así que tiene su propia forma de resultado
// y se reporta por separado en vez de mezclarse en el mismo array.
const scrapers = [
  scrapeAgroads,
  scrapeAgrofy,
  scrapeArgenprop,
  scrapeZonaprop,
  scrapeNordheimer,
  scrapeMercadoLibre,
];

async function main() {
  const results: ScraperOutcome[] = [];
  for (const scrape of scrapers) {
    try {
      const result = await scrape();
      results.push(result);
    } catch (error) {
      results.push({
        source: scrape.name,
        sourceUrl: "",
        scrapedAt: new Date().toISOString(),
        status: "blocked",
        note: `Error inesperado: ${error instanceof Error ? error.message : String(error)}`,
        count: 0,
        listings: [],
      });
    }
  }

  await fs.mkdir("data/processed", { recursive: true });
  await fs.writeFile(
    "data/processed/campos-alquiler.json",
    JSON.stringify(results, null, 2),
    "utf-8"
  );

  console.log("\nResumen (avisos de campos):");
  for (const result of results) {
    console.log(
      `- ${result.source}: ${result.status} (${result.count} avisos)${
        result.note ? ` — ${result.note}` : ""
      }`
    );
  }

  const cultivaresResult = await scrapeInase().catch((error: unknown) => ({
    source: "inase-cultivares",
    sourceUrl: "",
    scrapedAt: new Date().toISOString(),
    status: "blocked" as const,
    note: `Error inesperado: ${error instanceof Error ? error.message : String(error)}`,
    count: 0,
    cultivares: [],
  }));

  console.log("\nResumen (cultivares INASE):");
  console.log(
    `- ${cultivaresResult.source}: ${cultivaresResult.status} (${cultivaresResult.count} cultivares)${
      cultivaresResult.note ? ` — ${cultivaresResult.note}` : ""
    }`
  );
}

main().catch((error: unknown) => {
  console.error("Error inesperado:", error);
  process.exitCode = 1;
});
