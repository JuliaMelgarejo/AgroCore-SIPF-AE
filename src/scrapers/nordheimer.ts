import * as cheerio from "cheerio";
import fs from "node:fs/promises";
import { fetchHtml } from "../lib/http.js";
import type { FieldListing, ScraperOutcome } from "../types.js";

// Nordheimer no tiene ni WAF ni JS-rendering: /campos devuelve, server-side,
// una grilla <section class="grillacampos"> con una tarjeta <div
// class="col-md-3"> por campo. Se puede scrapear con un simple GET.
//
// PERO: el catálogo público de Nordheimer es 100% de VENTA, no de alquiler.
// El propio título de la página dice "CAMPOS EN VENTA EN TODA LA REGIÓN" y
// las ~700 tarjetas relevadas empiezan todas con el slug "campo-en-venta/...".
// (Ojo al filtrar: un par de esos avisos EN VENTA mencionan "alquiler" en su
// descripción — p.ej. un campo apto para "alquiler ganadero" — así que no
// alcanza con buscar la palabra "alquiler" en cualquier parte de la URL; hay
// que exigir que el slug empiece con "campo-en-alquiler". Con ese criterio
// correcto, ninguno de los avisos relevados califica.)
// La empresa ofrece "arrendamientos" como servicio de asesoría (ver menú
// "Servicios"), pero no como un listado público de avisos navegable. Por eso
// este scraper trae todas las tarjetas y las clasifica según su URL: para
// esta consulta puntual ("alquiler") es esperable que devuelva 0 resultados.
const SOURCE = "nordheimer";
const SOURCE_URL = "https://nordheimer.com/campos";

export async function scrapeNordheimer(): Promise<ScraperOutcome> {
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
  await fs.writeFile("data/raw/nordheimer-campos.html", fetched.html, "utf-8");

  const $ = cheerio.load(fetched.html);

  const allListings: FieldListing[] = $("section.grillacampos .col-md-3")
    .map((_, el) => {
      const item = $(el);
      const href = item.find("a[href]").first().attr("href") ?? "";
      const country = item.find(".pais").text().trim();
      const location = item.find(".datos p").first().text().trim();
      const propertyType = item.find(".datos h2").text().trim();
      const surfaceText = item.find(".datos p").last().text().trim();
      const image = item.find("img[src]").first().attr("src") ?? null;
      const idMatch = href.match(/(\d+)\/?$/);

      return {
        source: SOURCE,
        id: idMatch ? idMatch[1] : href,
        title: [propertyType, location].filter(Boolean).join(" - "),
        price: null,
        currency: null,
        priceText: null,
        location: [location, country].filter(Boolean).join(", ") || null,
        surfaceText: surfaceText || null,
        agency: "Nordheimer",
        detailUrl: href ? new URL(href, "https://nordheimer.com/").href : "",
        imageUrl: image,
      } satisfies FieldListing;
    })
    .get()
    .filter((listing) => listing.id && listing.detailUrl);

  // Nos quedamos solo con lo que realmente es alquiler/arrendamiento (el
  // slug de la URL tiene que EMPEZAR con "campo-en-alquiler", no alcanza con
  // que la palabra "alquiler" aparezca en cualquier parte de la URL — ver
  // comentario de arriba sobre el falso positivo de "alquiler ganadero").
  const rentalListings = allListings.filter((listing) =>
    /\/campo-en-(alquiler|arriendo)-/i.test(listing.detailUrl)
  );

  return {
    source: SOURCE,
    sourceUrl: SOURCE_URL,
    scrapedAt,
    status: rentalListings.length > 0 ? "ok" : "no-data",
    note: `Se relevaron ${allListings.length} campos publicados; el catálogo de Nordheimer es mayormente de venta. Solo ${rentalListings.length} coinciden con alquiler/arrendamiento.`,
    count: rentalListings.length,
    listings: rentalListings,
  };
}
