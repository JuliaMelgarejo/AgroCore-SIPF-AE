// Forma común que devuelve cada scraper, sin importar el sitio de origen
// ni la técnica usada para obtener los datos (HTTP simple o navegador).

export type FieldListing = {
  source: string;
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  priceText: string | null;
  location: string | null;
  surfaceText: string | null;
  agency: string | null;
  detailUrl: string;
  imageUrl: string | null;
};

export type ScraperStatus = "ok" | "blocked" | "no-data" | "not-attempted";

export type ScraperOutcome = {
  source: string;
  sourceUrl: string;
  scrapedAt: string;
  status: ScraperStatus;
  note?: string;
  count: number;
  listings: FieldListing[];
};

// Un cultivar (semilla) registrado en el RNC/RNPC de INASE. No tiene nada
// que ver con un aviso de campo (FieldListing), así que va como su propio
// tipo en vez de forzarlo dentro de ScraperOutcome/FieldListing.
export type CultivarRecord = {
  source: string;
  numeroRegistro: string;
  cultivar: string;
  especie: string;
  nombreCientifico: string | null;
  condicionGenetica: string | null;
  grupoEspecie: string | null;
  inscripcionRnc: string | null;
  inscripcionRnpc: string | null;
  validezRnpc: string | null;
  paisOrigen: string | null;
  caracteristicas: string | null;
  eventoTransgenico: string | null;
  eventoTransgenicoCaracteristica: string | null;
  solicitanteRnc: string | null;
  representanteRnc: string | null;
  solicitanteRnpc: string | null;
  representanteRnpc: string | null;
};

export type CultivarScraperOutcome = {
  source: string;
  sourceUrl: string;
  scrapedAt: string;
  status: ScraperStatus;
  note?: string;
  count: number;
  cultivares: CultivarRecord[];
};
