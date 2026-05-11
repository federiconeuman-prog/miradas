export const config = {
  sheetId: '1yNUjBkJ8SD3VLwajOynG5mTjzNnrJHEqS8ub8q3ch1Q',
  refreshKey: 'miradas2026',
};

// CSV Parser - Maneja campos con comas, saltos de línea y comillas dentro de comillas dobles.
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if      (ch === '"')  { inQuotes = true; }
      else if (ch === ',')  { row.push(field); field = ''; }
      else if (ch === '\r') { /* ignorar */ }
      else if (ch === '\n') {
        row.push(field); field = '';
        if (row.some(c => c !== '')) rows.push(row);
        row = [];
      } else { field += ch; }
    }
  }
  row.push(field);
  if (row.some(c => c !== '')) rows.push(row);

  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = (r[i] ?? '').trim(); });
    return obj;
  });
}

// Fetch desde Google Sheets
export async function fetchSheet(tabName) {
  const url = `https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Error en tab "${tabName}": HTTP ${res.status}`);
  return parseCSV(await res.text());
}

// Cache simple en memoria (se reinicia al rebuild)
let cache = null;
let cacheLoadedAt = null;

export async function buildCache() {
  console.log('[Sheets] Cargando datos...');
  const colecciones = await fetchSheet('colecciones');
  const years = colecciones.map(c => c.año).filter(Boolean);

  const yearData = {};
  for (const year of years) {
    const [hitos, textos, fotos] = await Promise.all([
      fetchSheet(`hitos_${year}`).catch(() => { console.warn(`[Sheets] No se encontró hitos_${year}`); return []; }),
      fetchSheet(`textos_${year}`).catch(() => { console.warn(`[Sheets] No se encontró textos_${year}`); return []; }),
      fetchSheet(`fotos_${year}`).catch(() => { console.warn(`[Sheets] No se encontró fotos_${year}`); return []; }),
    ]);
    yearData[year] = { hitos, textos, fotos };
  }

  cache = { colecciones, yearData };
  cacheLoadedAt = new Date().toISOString();
  console.log(`[Sheets] OK — años cargados: ${years.join(', ')}`);
  return cache;
}

export async function getCache() {
  if (!cache) await buildCache();
  return { ...cache, loadedAt: cacheLoadedAt };
}

export function clearCache() {
  cache = null;
  cacheLoadedAt = null;
}
