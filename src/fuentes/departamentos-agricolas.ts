import fs from "node:fs/promises";

// Departamentos con agricultura extensiva, para decidir dónde pedir clima
// (NASA POWER) y suelo (SoilGrids). Se arma con los mismos archivos que
// carga la base (MAGyP + Georef), así no depende de que la base esté levantada.
//
// Criterio: al menos 1.000 ha sembradas de algún cultivo extensivo en alguna
// campaña desde 2010/11. Da ~300 departamentos (región pampeana, NOA, NEA).

const CULTIVOS_EXTENSIVOS = new Set([
  "maíz", "soja total", "soja 1ra", "soja 2da", "trigo total", "trigo candeal",
  "girasol", "sorgo", "cebada cervecera", "colza", "arroz", "maní",
]);
const SUPERFICIE_MINIMA_HA = 1000;
const DESDE_ANIO = 2010;

export type DepartamentoAgricola = { id: number; nombre: string; lat: number; lon: number };

// Parser CSV mínimo: el archivo de MAGyP tiene todos los campos entre comillas y sin comillas internas
function parsearLinea(linea: string): string[] {
  return [...linea.matchAll(/"([^"]*)"|([^,]+)|(?<=,)(?=,|$)/g)].map((m) => m[1] ?? m[2] ?? "");
}

export async function departamentosAgricolas(): Promise<DepartamentoAgricola[]> {
  const csv = await fs.readFile("data/raw/magyp-estimaciones-agricolas.csv", "utf-8");
  const [encabezado, ...lineas] = csv.replace(/^﻿/, "").split(/\r?\n/);
  const col = Object.fromEntries(parsearLinea(encabezado).map((c, i) => [c, i]));

  const ids = new Set<number>();
  for (const linea of lineas) {
    if (!linea) continue;
    const f = parsearLinea(linea);
    if (
      CULTIVOS_EXTENSIVOS.has(f[col.cultivo]) &&
      Number(f[col.anio]) >= DESDE_ANIO &&
      Number(f[col.superficie_sembrada_ha]) >= SUPERFICIE_MINIMA_HA &&
      /^\d+$/.test(f[col.departamento_id])
    ) {
      ids.add(Number(f[col.departamento_id]));
    }
  }

  const georef = JSON.parse(await fs.readFile("data/raw/georef-departamentos.json", "utf-8")) as {
    departamentos: { id: string; nombre: string; centroide: { lat: number; lon: number } }[];
  };
  const porId = new Map(georef.departamentos.map((d) => [Number(d.id), d]));
  // MAGyP usa el código viejo de Chascomús (06217); Georef el nuevo (06218)
  const chascomus = porId.get(6218);
  if (chascomus) porId.set(6217, chascomus);

  return [...ids]
    .map((id) => {
      const g = porId.get(id);
      return g ? { id, nombre: g.nombre, lat: g.centroide.lat, lon: g.centroide.lon } : null;
    })
    .filter((d): d is DepartamentoAgricola => d !== null)
    .sort((a, b) => a.id - b.id);
}

// Centro de la celda de 0,5° que contiene el punto (misma grilla que NASA POWER)
export function celda05(lat: number, lon: number) {
  const centro = (v: number) => Math.floor(v * 2) / 2 + 0.25;
  return { lat: centro(lat), lon: centro(lon) };
}

export const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
