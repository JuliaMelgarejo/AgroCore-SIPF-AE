import * as cheerio from "cheerio";
import fs from "node:fs/promises";
import { fetchHtml } from "../lib/http.js";
import type { FieldListing, ScraperOutcome } from "../types.js";

// Zonaprop (mismo grupo/tecnología que Argenprop, Navent) también renderiza
// el listado en el HTML. Las clases CSS son hasheadas por build
// ("postingCardLayout-module__..."), así que NO son confiables: en cambio,
// el sitio marca cada tarjeta y sus partes con atributos data-qa estables
// (pensados para tests automatizados), y esos sí los usamos.
//
// robots.txt de zonaprop.com.ar bloquea "/avisos-api/" (existe una API
// interna, pero está explícitamente vedada para crawlers) y algunos paneles
// internos; no restringe "/campos-alquiler.html".
//
// OJO: a diferencia de Argenprop/Agrofy/Nordheimer, Zonaprop está detrás de
// Cloudflare con protección anti-bot activa. En las pruebas, algunas
// requests trajeron el HTML real (200) y otras recibieron el interstitial
// "Just a moment..." (403, header "cf-mitigated: challenge"). Es la misma
// lógica probabilística que Agroads (ver comentario en agroads.ts): puede
// andar y dejar de andar sin que cambiemos nada. No se intenta resolver el
// challenge de Cloudflare por la misma razón que con Agroads.
const SOURCE = "zonaprop";
const SOURCE_URL = "https://www.zonaprop.com.ar/campos-alquiler.html";

export async function scrapeZonaprop(): Promise<ScraperOutcome> {
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
  await fs.writeFile("data/raw/zonaprop-alquiler.html", fetched.html, "utf-8");

  const $ = cheerio.load(fetched.html);

  const listings: FieldListing[] = $('[data-qa="posting PROPERTY"]')
    .map((_, el) => {
      const item = $(el);

      const id = item.attr("data-id") ?? "";
      const href = item.attr("data-to-posting") ?? "";
      const priceText = item
        .find('[data-qa="POSTING_CARD_PRICE"]')
        .text()
        .replace(/\s+/g, " ")
        .trim();
      const [currency, ...priceParts] = priceText.split(" ");
      const location = item
        .find('[data-qa="POSTING_CARD_LOCATION"]')
        .text()
        .replace(/\s+/g, " ")
        .trim();
      const address = item
        .find(".postingLocations-module__location-address")
        .text()
        .replace(/\s+/g, " ")
        .trim();
      const features = item
        .find('[data-qa="POSTING_CARD_FEATURES"]')
        .text()
        .replace(/\s+/g, " ")
        .trim();
      const title = item
        .find('[data-qa="POSTING_CARD_DESCRIPTION"]')
        .text()
        .replace(/\s+/g, " ")
        .trim();
      const agency = item.find('[data-qa="POSTING_CARD_PUBLISHER"] img').attr("alt") ?? null;
      const image = item.find("img[src]").first().attr("src") ?? null;
      const surfaceMatch = features.match(/(\d+(?:[.,]\d+)?)\s*(ha|m²)/i);
      const priceNumber = Number(priceParts.join("").replace(/\./g, "").replace(",", "."));

      return {
        source: SOURCE,
        id,
        title: title || address || "",
        price: Number.isFinite(priceNumber) && priceParts.length ? priceNumber : null,
        currency: /^(USD|U\$S|\$)$/i.test(currency ?? "") ? currency : null,
        priceText: priceText || null,
        location: [address, location].filter(Boolean).join(" - ") || null,
        surfaceText: surfaceMatch ? `${surfaceMatch[1]} ${surfaceMatch[2]}` : features || null,
        agency,
        detailUrl: href ? new URL(href, "https://www.zonaprop.com.ar").href : "",
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
