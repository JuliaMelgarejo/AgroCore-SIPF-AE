import * as cheerio from "cheerio";
import fs from "node:fs/promises";
import { fetchHtml } from "../lib/http.js";
import type { FieldListing, ScraperOutcome } from "../types.js";

// Argenprop renderiza el listado directamente en el HTML (no hay JSON
// embebido como en Agrofy). Cada aviso es un <div class="listing__item">
// que contiene un <a class="card"> con el precio ya como atributo HTML
// (montooperacion="2000000"), así que lo leemos de ahí en vez de parsear
// el texto visible (más confiable que sacar los puntos de miles a mano).
//
// OJO con la URL: "/campos/rosario" (la que se pidió originalmente) mezcla
// avisos en venta y en alquiler. La URL específica de alquiler es
// "/campos/alquiler/rosario" — se confirmó usando el filtro "Operación"
// del propio sitio y viendo a qué URL navegaba.
//
// robots.txt de argenprop.com no restringe esta ruta.
const SOURCE = "argenprop";
const SOURCE_URL = "https://www.argenprop.com/campos/alquiler/rosario";

export async function scrapeArgenprop(): Promise<ScraperOutcome> {
  const scrapedAt = new Date().toISOString();
  const fetched = await fetchHtml(SOURCE_URL);

  if (!fetched.ok) {
    return {
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      scrapedAt,
      status: "blocked",
      note: fetched.note,
      count: 0,
      listings: [],
    };
  }

  await fs.mkdir("data/raw", { recursive: true });
  await fs.writeFile("data/raw/argenprop-alquiler.html", fetched.html, "utf-8");

  const $ = cheerio.load(fetched.html);

  const listings: FieldListing[] = $(".listing__item")
    .map((_, el) => {
      const item = $(el);
      const card = item.find("a.card").first();

      const id = item.attr("id") ?? card.attr("data-item-card") ?? "";
      const href = card.attr("href") ?? "";
      const rawPrice = card.attr("montooperacion");

      const priceText = item.find(".card__price").text().replace(/\s+/g, " ").trim();
      const currency = item.find(".card__currency").text().trim() || null;
      const location = item.find(".card__address").text().replace(/\s+/g, " ").trim();
      const title = item
        .find(".card__title--primary")
        .text()
        .replace(/\s+/g, " ")
        .trim();
      const agency = item.find(".card__agent img").attr("alt") ?? null;
      const surfaceMatch = location.match(/(\d+(?:[.,]\d+)?)\s*ha/i);
      const image =
        item.find(".card__photos img[data-src]").first().attr("data-src") ??
        item.find(".card__photos img[src]").first().attr("src") ??
        null;

      return {
        source: SOURCE,
        id,
        title,
        price: rawPrice ? Number(rawPrice) : null,
        currency,
        priceText: priceText || null,
        location: location || null,
        surfaceText: surfaceMatch ? `${surfaceMatch[1]} ha` : null,
        agency,
        detailUrl: href ? new URL(href, "https://www.argenprop.com").href : "",
        imageUrl: image,
      } satisfies FieldListing;
    })
    .get()
    .filter((listing) => listing.id && listing.detailUrl);

  return {
    source: SOURCE,
    sourceUrl: SOURCE_URL,
    scrapedAt,
    status: "ok",
    count: listings.length,
    listings,
  };
}
