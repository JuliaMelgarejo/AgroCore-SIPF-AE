import * as cheerio from "cheerio";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import type { FieldListing, ScraperOutcome } from "../types.js";

// Agroads está protegido por AWS WAF Bot Control (challenge.js/captcha.js
// de awswaf.com). Cuando el WAF sospecha de la sesión (navigator.webdriver
// = true es la huella estándar de cualquier navegador automatizado,
// Playwright incluido) devuelve, en vez de la página con los avisos, un
// HTTP 202 con una pantalla "Confirme que es humano".
//
// La protección es PROBABILÍSTICA, no determinística: en las pruebas de
// este scraper, a veces el bloqueo apareció de inmediato y otras veces la
// misma request pasó de largo y trajo los 60 avisos reales. Eso significa
// que este scraper puede funcionar hoy y fallar mañana (o al revés) sin
// que haya cambiado nada del lado nuestro — no es confiable para depender
// de él en producción.
//
// No se intenta estabilizar/forzar el bypass del WAF (fingerprint
// spoofing, resolver el challenge, rotar IP, etc.) porque cruza la línea
// de evasión de anti-bot/anti-detección. Este scraper queda tal cual (usa
// Playwright porque, a diferencia de los demás sitios, Agroads si
// funcionara necesitaría un navegador real) y reporta status "blocked"
// cuando el WAF lo frena, para que quede claro en el resumen final.
const SOURCE = "agroads";
const SOURCE_URL =
  "https://www.agroads.com.ar/seccion.asp?subcat=36&tipotransaccion=alquiler";

function parseListings(html: string): FieldListing[] {
  const $ = cheerio.load(html);

  return $("li.item.anuncio")
    .map((_, element) => {
      const item = $(element);
      const price = Number(item.attr("data-p_gtm"));
      const imageUrl = item.find("img.anuncio_img").attr("src") ?? null;
      const detailPath = item.find("a[href*='detalle.asp']").attr("href");

      return {
        source: SOURCE,
        id: item.attr("data-id") ?? "",
        title: item.attr("data-n_gtm") ?? "",
        price: Number.isFinite(price) && price > 0 ? price : null,
        currency: null,
        priceText: null,
        location: null,
        surfaceText: null,
        agency: item.attr("data-u_apodo") || null,
        detailUrl: detailPath
          ? new URL(detailPath, "https://www.agroads.com.ar").href
          : "",
        imageUrl,
      } satisfies FieldListing;
    })
    .get()
    .filter((listing) => listing.id && listing.title && listing.detailUrl);
}

async function fetchListingPage(): Promise<{ html: string; status: number }> {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
  });

  try {
    const response = await page.goto(SOURCE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.locator("li.item.anuncio").first().waitFor({ timeout: 15_000 });
    return {
      html: await page.content(),
      status: response?.status() ?? 200,
    };
  } finally {
    await browser.close();
  }
}

export async function scrapeAgroads(): Promise<ScraperOutcome> {
  const scrapedAt = new Date().toISOString();

  try {
    const { html } = await fetchListingPage();

    await fs.mkdir("data/raw", { recursive: true });
    await fs.writeFile("data/raw/agroads-alquiler.html", html, "utf-8");

    const listings = parseListings(html);
    return {
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      scrapedAt,
      status: "ok",
      count: listings.length,
      listings,
    };
  } catch (error) {
    return {
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      scrapedAt,
      status: "blocked",
      note:
        "Bloqueado por AWS WAF Bot Control (challenge 'Confirme que es humano'). " +
        `Detalle: ${error instanceof Error ? error.message : String(error)}`,
      count: 0,
      listings: [],
    };
  }
}
