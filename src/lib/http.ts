import axios from "axios";

// Cliente HTTP compartido por los scrapers que NO necesitan un navegador
// (agrofy, argenprop, zonaprop, nordheimer). Los cuatro devuelven el HTML
// ya renderizado en el servidor, así que un GET con un User-Agent de
// navegador real alcanza: no hace falta Playwright ni ejecutar JS.
export const httpClient = axios.create({
  timeout: 20_000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
    "Accept-Language": "es-AR,es;q=0.9",
  },
});

// Algunos sitios (Zonaprop, a veces Agroads) están detrás de un WAF que
// puede frenar la request con un 403/429 en vez de devolver el HTML. En
// lugar de dejar que ese error explote hacia arriba, lo convertimos en un
// resultado que cada scraper puede reportar como "blocked" sin romper el
// resto de la corrida.
export async function fetchHtml(
  url: string
): Promise<{ ok: true; html: string } | { ok: false; note: string }> {
  try {
    const response = await httpClient.get<string>(url);
    return { ok: true, html: response.data };
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    return {
      ok: false,
      note: status
        ? `El sitio respondió HTTP ${status} (probable bloqueo anti-bot / WAF).`
        : `Error de red: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
