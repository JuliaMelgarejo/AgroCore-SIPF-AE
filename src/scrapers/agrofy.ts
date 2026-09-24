import * as cheerio from "cheerio";
import fs from "node:fs/promises";
import { fetchHtml } from "../lib/http.js";
import type { FieldListing, ScraperOutcome } from "../types.js";

// Agrofy (agrofy.com.ar) es una app Next.js: el HTML que devuelve el
// servidor ya trae, dentro de <script id="__NEXT_DATA__">, el JSON
// completo con el que React hidrata la página. No hace falta interpretar
// el CSS de las tarjetas (que además usa clases hasheadas de
// styled-components, poco confiables entre builds): alcanza con pedir el
// HTML por HTTP y leer ese <script>.
//
// robots.txt de agrofy.com.ar bloquea "/listado" y "/listado*", pero la
// sección de campos vive bajo "/campos/...", que no está restringida.
const SOURCE = "agrofy";
const SOURCE_URL = "https://www.agrofy.com.ar/campos/rosario/santa-fe/alquiler";

type AgrofyHit = {
  id: number | string;
  name?: string;
  price?: number;
  usdPrice?: number;
  currency?: string;
  priceText?: string;
  city?: string;
  province?: string;
  merchant?: string;
  url?: string;
  image?: string;
  hectares?: { totalArea?: number };
};

export async function scrapeAgrofy(): Promise<ScraperOutcome> {
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
  await fs.writeFile("data/raw/agrofy-alquiler.html", fetched.html, "utf-8");

  const $ = cheerio.load(fetched.html);
  const nextDataRaw = $("#__NEXT_DATA__").html();

  if (!nextDataRaw) {
    return {
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      scrapedAt,
      status: "no-data",
      note: "No se encontró el script __NEXT_DATA__ en la respuesta (puede que Agrofy haya cambiado de framework).",
      count: 0,
      listings: [],
    };
  }

  const nextData = JSON.parse(nextDataRaw);
  const hits: AgrofyHit[] = nextData?.props?.pageProps?.listing?.Hits ?? [];

  const listings: FieldListing[] = hits.map((hit) => ({
    source: SOURCE,
    id: String(hit.id),
    title: hit.name ?? "",
    price: typeof hit.usdPrice === "number" ? hit.usdPrice : hit.price ?? null,
    currency: hit.currency ?? null,
    priceText: hit.priceText ?? null,
    location: [hit.city, hit.province].filter(Boolean).join(", ") || null,
    surfaceText:
      hit.hectares?.totalArea != null ? `${hit.hectares.totalArea} ha` : null,
    agency: hit.merchant ?? null,
    detailUrl: hit.url ? new URL(hit.url, "https://www.agrofy.com.ar").href : "",
    imageUrl: hit.image ?? null,
  }));

  return {
    source: SOURCE,
    sourceUrl: SOURCE_URL,
    scrapedAt,
    status: "ok",
    count: listings.length,
    listings,
  };
}
