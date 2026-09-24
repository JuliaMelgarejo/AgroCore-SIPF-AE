import type { ScraperOutcome } from "../types.js";

// A propósito, este archivo NO hace ningún request a MercadoLibre. Motivos:
//
// 1. robots.txt de mercadolibre.com.ar bloquea explícitamente por nombre a
//    los bots de IA, incluido Claude:
//
//      User-agent: ClaudeBot
//      User-agent: Claude-User
//      ... (y GPTBot, PerplexityBot, Amazonbot, etc.)
//      Disallow: /
//
//    Es una señal directa e inequívoca de la propia empresa: no quiere que
//    agentes como este scrapeen su sitio. La respetamos y no lo hacemos.
//
// 2. MercadoLibre SÍ tiene una API pública y bien documentada
//    (https://developers.mercadolibre.com.ar), pensada justamente para
//    evitar tener que scrapear el HTML. Pero:
//      - api.mercadolibre.com también publica robots.txt con
//        "Disallow: /" para todos los user-agents.
//      - Probando el endpoint de búsqueda sin autenticación
//        (GET /sites/MLA/search) devuelve HTTP 403 "forbidden": desde 2024
//        MercadoLibre exige un access token de una app registrada
//        (OAuth) incluso para leer resultados de búsqueda.
//
// Conclusión: si más adelante se quiere sumar MercadoLibre a este proyecto,
// el camino correcto NO es scrapear ni llamar la API sin permiso, sino que
// la usuaria registre una aplicación en developers.mercadolibre.com.ar,
// obtenga sus credenciales OAuth, y se implemente un cliente de API con
// esas credenciales propias.
const SOURCE = "mercadolibre";
const SOURCE_URL = "https://listado.mercadolibre.com.ar/alquiler-hectarea-en-rosario";

export async function scrapeMercadoLibre(): Promise<ScraperOutcome> {
  return {
    source: SOURCE,
    sourceUrl: SOURCE_URL,
    scrapedAt: new Date().toISOString(),
    status: "not-attempted",
    note:
      "No se scrapea a propósito: robots.txt de MercadoLibre excluye explícitamente a ClaudeBot/Claude-User, " +
      "y su API pública requiere credenciales OAuth propias (ver comentarios en este archivo).",
    count: 0,
    listings: [],
  };
}
