import axios from "axios";
import * as cheerio from "cheerio";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const url =
  "https://www.agroads.com.ar/seccion.asp?subcat=36&tipotransaccion=alquiler";

type Listing = {
  id: string;
  title: string;
  price: number | null;
  agency: string | null;
  detailUrl: string;
  imageUrl: string | null;
  details?: ListingDetails;
};

type ListingDetails = {
  priceText: string | null;
  surfaceHa: string | null;
  transaction: string | null;
  aptitude: string | null;
  facilities: string[];
  description: string | null;
  detailError?: string;
};

function parseListings(html: string): Listing[] {
  const $ = cheerio.load(html);

  return $("li.item.anuncio")
    .map((_, element) => {
      const item = $(element);
      const price = Number(item.attr("data-p_gtm"));
      const imageUrl = item.find("img.anuncio_img").attr("src") ?? null;
      const detailPath = item.find("a[href*='detalle.asp']").attr("href");

      return {
        id: item.attr("data-id") ?? "",
        title: item.attr("data-n_gtm") ?? "",
        price: Number.isFinite(price) && price > 0 ? price : null,
        agency: item.attr("data-u_apodo") || null,
        detailUrl: detailPath
          ? new URL(detailPath, "https://www.agroads.com.ar").href
          : "",
        imageUrl,
      };
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
    const response = await page.goto(url, {
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

async function enrichListings(listings: Listing[]): Promise<void> {
  for (const [index, listing] of listings.entries()) {
    console.log(`Detalle ${index + 1}/${listings.length}: ${listing.id}`);
    const browser = await chromium.launch({ headless: false });

    try {
      const page = await browser.newPage({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
      });

      try {
        await page.goto(listing.detailUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
        await page.locator("h1").first().waitFor({ timeout: 15_000 });

        const fields = await page.locator("dt").evaluateAll((elements) =>
          elements.map((element) => ({
            label: element.textContent?.trim() ?? "",
            value: element.nextElementSibling?.textContent?.trim() ?? "",
          }))
        );
        const field = (label: string) =>
          fields.find((item) => item.label.toLowerCase() === label.toLowerCase())
            ?.value || null;
        const descriptionParts = await page
          .locator("dt")
          .filter({ hasText: /^Descripción$/i })
          .locator("xpath=following-sibling::dd[1] p")
          .allTextContents();
        const facilities = await page
          .locator("dt")
          .filter({ hasText: /^Instalaciones$/i })
          .locator("xpath=following-sibling::dd[1] li")
          .allTextContents();
        const bodyText = await page.locator("body").innerText();
        const priceText = bodyText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => /^(?:\$|u\$s|consultar)/i.test(line));

        listing.details = {
          priceText: priceText || null,
          surfaceHa: field("Superficie"),
          transaction: field("Transaccion"),
          aptitude: field("Aptitud"),
          facilities: facilities.map((item) => item.trim()).filter(Boolean),
          description:
            descriptionParts
              .map((item) => item.replace(/\s+/g, " ").trim())
              .filter(Boolean)
              .join("\n") || null,
        };
      } catch (error) {
          listing.details = {
            priceText: null,
            surfaceHa: null,
            transaction: null,
            aptitude: null,
            facilities: [],
            description: null,
            detailError: error instanceof Error ? error.message : String(error),
          };
      }
    } finally {
      await browser.close();
    }
  }
}

async function main() {
  const response = await fetchListingPage();

  console.log("Status:", response.status);

  await fs.mkdir("data/raw", { recursive: true });

  await fs.writeFile(
    "data/raw/agroads-alquiler.html",
    response.html,
    "utf-8"
  );

  const listings = parseListings(response.html);
  await enrichListings(listings);
  await fs.mkdir("data/processed", { recursive: true });
  await fs.writeFile(
    "data/processed/agroads-alquiler.json",
    JSON.stringify(
      {
        sourceUrl: url,
        scrapedAt: new Date().toISOString(),
        count: listings.length,
        listings,
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log("HTML guardado correctamente");
  console.log(`Avisos estructurados: ${listings.length}`);
}

main().catch((error: unknown) => {
  if (axios.isAxiosError(error)) {
    console.error(
      `No se pudo descargar la página: HTTP ${error.response?.status ?? "desconocido"}`
    );
    process.exitCode = 1;
    return;
  }

  console.error("Error inesperado:", error);
  process.exitCode = 1;
});