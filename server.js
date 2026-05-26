import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import config from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(process.cwd()));

// ── CSV Parser ───────────────────────────────────────────────────────────────
// Maneja campos con comas, saltos de línea y comillas dentro de comillas dobles.

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

// ── Fetch desde Google Sheets ────────────────────────────────────────────────

async function fetchSheet(tabName) {
  const url = `https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error en tab "${tabName}": HTTP ${res.status}`);
  return parseCSV(await res.text());
}

// ── Caché ────────────────────────────────────────────────────────────────────
// Se carga al iniciar el servidor y se refresca manualmente con /api/refresh.

let cache = null;

function parseInfoProyecto(rows) {
  if (!rows || rows.length === 0) return {};
  
  // Buscar columnas de clave-valor flexibles
  const sample = rows[0];
  const keys = Object.keys(sample);
  const keyCol = keys.find(k => ['clave', 'campo', 'key', 'propiedad', 'id'].includes(k.toLowerCase().trim()));
  const valCol = keys.find(k => ['valor', 'value', 'contenido', 'texto'].includes(k.toLowerCase().trim()));
  
  if (keyCol && valCol) {
    const result = {};
    rows.forEach(r => {
      const k = String(r[keyCol] || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_]/g, '');
      if (k) result[k] = r[valCol] ?? '';
    });
    return result;
  }
  
  // Si es fila única con columnas estándar
  return rows[0];
}

function isNotHomePrincipal(rows) {
  if (!rows || rows.length === 0) return true;
  const sample = rows[0];
  const keys = Object.keys(sample).map(k => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ''));
  if (keys.includes('ano') || keys.includes('year') || keys.includes('estado')) {
    return false;
  }
  return true;
}

async function buildCache() {
  console.log('[Sheets] Cargando datos...');
  const colecciones = await fetchSheet('home_principal');
  const years = colecciones.map(c => c.año).filter(Boolean);

  const yearData = {};
  for (const year of years) {
    const [hitos, textos, fotos] = await Promise.all([
      fetchSheet(`miradas_${year}`).catch(() => { console.warn(`[Sheets] No se encontró miradas_${year}`); return []; }),
      fetchSheet(`textos_${year}`).catch(() => { console.warn(`[Sheets] No se encontró textos_${year}`); return []; }),
      fetchSheet(`fotos_${year}`).catch(() => { console.warn(`[Sheets] No se encontró fotos_${year}`); return []; }),
    ]);
    yearData[year] = { hitos, textos, fotos };
  }

  const fetchWithCheck = async (tabName) => {
    const data = await fetchSheet(tabName);
    if (!isNotHomePrincipal(data)) {
      throw new Error(`[Sheets] Gviz retornó home_principal por defecto para pestaña no encontrada "${tabName}"`);
    }
    return data;
  };

  // Buscar fotos de la portada (letras MIRADAS) en varias solapas posibles de manera robusta
  const fotosPortada = await fetchWithCheck('portada_fotos')
    .catch(() => fetchWithCheck('fotos_portada')
      .catch(() => fetchWithCheck('letras_portada')
        .catch(() => [])));

  // Buscar sección "Sobre el proyecto" en varias solapas posibles de manera robusta
  const infoProyectoRaw = await fetchWithCheck('info_proyecto')
    .catch(() => fetchWithCheck('sobre_el_proyecto')
      .catch(() => fetchWithCheck('informacion')
        .catch(() => fetchWithCheck('informacion_proyecto')
          .catch(() => []))));

  const infoProyecto = parseInfoProyecto(infoProyectoRaw);

  cache = { colecciones, yearData, fotosPortada, infoProyecto, loadedAt: new Date().toISOString() };
  console.log(`[Sheets] OK — años cargados: ${years.join(', ')}`);
}

async function getCache() {
  if (!cache) await buildCache();
  return cache;
}

// ── Rutas API ────────────────────────────────────────────────────────────────

// Fotos de portada / letras dinamicas
app.get('/api/landing-photos', async (req, res) => {
  try {
    const { fotosPortada } = await getCache();
    res.json(fotosPortada || []);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error cargando fotos de portada' });
  }
});

// Información sobre el proyecto (editable desde el Excel)
app.get('/api/info-proyecto', async (req, res) => {
  try {
    const { infoProyecto } = await getCache();
    const fallback = {
      titulo: 'El Registro',
      titulo_destacado: 'como Legado',
      descripcion: 'La deconstrucción y conservación visual del patrimonio de Buenos Aires a través del objetivo de los estudiantes. Una perspectiva metodológica que documenta la evolución urbana, el contraste estilístico y las narrativas ocultas en las fachadas porteñas.',
      cita: '“Recorrer las calles registrando el detalle, la luz y la sombra, es redescubrir la identidad colectiva que habita en los muros de nuestra ciudad.”',
      texto_secundario: 'Este espacio funciona como un archivo cartográfico interactivo, vinculando georreferencia, investigación documental e interpretación artística. Cada punto marcado representa un nodo de memoria colectiva, analizado críticamente por las nuevas miradas de nuestra comunidad educativa.',
      institucion: 'Colegio de Comunicación',
      orientacion: 'Producción en Medios',
      catedra: 'Artes Visuales & Registro'
    };
    res.json({ ...fallback, ...infoProyecto });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error cargando información de la sección' });
  }
});

// Colecciones (años disponibles)
app.get('/api/collections', async (req, res) => {
  try {
    const { colecciones } = await getCache();
    const result = {};
    colecciones.forEach(c => {
      if (c.año) result[c.año] = { ...c };
    });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error cargando colecciones' });
  }
});

// Lista de hitos
app.get('/api/buildings', async (req, res) => {
  try {
    const { yearData } = await getCache();
    const CAMPOS_BASE = ['id', 'nombre', 'imagen', 'lat', 'lng', 'direccion', 'estilo', 'año_construccion', 'hecho_curioso'];
    const result = [];
    const parseCoord = s => parseFloat((s || '').replace(',', '.')) || 0;

    for (const [year, data] of Object.entries(yearData)) {
      const fotosIds  = new Set(data.fotos.map(f => f.hito_id));
      const textosIds = new Set(data.textos.map(t => t.hito_id));

      for (const h of data.hitos) {
        if (!h.id) continue;
        const extra = Object.fromEntries(Object.entries(h).filter(([k]) => !CAMPOS_BASE.includes(k)));
        
        const firstFoto = data.fotos.find(f => f.hito_id === h.id);
        const imageUrlFallback = firstFoto ? firstFoto.url : '';
        const isBrokenImage = h.imagen && h.imagen.includes('1pSNj9Kne53NEoq0mTzog9mpPY0OIa8cx');
        const imageUrl = (!h.imagen || isBrokenImage) ? imageUrlFallback : h.imagen;

        result.push({
          id:             h.id,
          name:           h.nombre,
          address:        h.direccion,
          style:          h.estilo,
          year:           h.año_construccion,
          fact:           h.hecho_curioso,
          lat:            parseCoord(h.lat),
          lng:            parseCoord(h.lng),
          imageUrl:       imageUrl,
          collectionYear: year,
          hasEntrega:     fotosIds.has(h.id) || textosIds.has(h.id),
          ...extra,
        });
      }
    }

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error cargando hitos' });
  }
});

// Detalle de un hito (textos + fotos)
app.get('/api/entregas/:id', async (req, res) => {
  try {
    const { yearData } = await getCache();
    const id = req.params.id;

    for (const data of Object.values(yearData)) {
      const textosRow = data.textos.find(t => t.hito_id === id);
      const fotos     = data.fotos
        .filter(f => f.hito_id === id)
        .map(f => ({ url: f.url, epigraph: f.epigrafe || '' }));

      if (!textosRow && fotos.length === 0) continue;

      // Los nombres de columna del tab textos_XXXX se convierten en títulos de sección
      const secciones = textosRow
        ? Object.entries(textosRow)
            .filter(([k]) => k !== 'hito_id' && k.trim() !== '')
            .map(([titulo, texto]) => ({ titulo, texto }))
        : [];

      return res.json({ secciones, fotos, loadedAt: cache.loadedAt });
    }

    res.json(null);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error cargando entrega' });
  }
});

// Proxy de imágenes de Google Drive
app.get('/api/image/:fileId', async (req, res) => {
  const { fileId } = req.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) return res.status(400).send('ID inválido');

  try {
    const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const driveRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
    });

    if (!driveRes.ok) return res.status(404).send('Imagen no encontrada');

    const contentType = driveRes.headers.get('content-type') || 'image/jpeg';
    if (contentType.includes('text/html')) {
      return res.status(403).send('Archivo no accesible — verificá que esté compartido como "Cualquiera con el enlace"');
    }

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    const buffer = await driveRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error('[Image proxy]', e.message);
    res.status(500).send('Error al obtener imagen');
  }
});

// Debug — muestra qué tiene el caché (requiere clave)
app.get('/api/debug', async (req, res) => {
  const clave = req.query.clave;
  if (clave !== config.refreshKey) return res.status(403).json({ error: 'Clave incorrecta' });

  if (!cache) return res.json({ status: 'sin caché' });

  res.json({
    loadedAt: cache.loadedAt,
    colecciones: cache.colecciones,
    years: Object.fromEntries(
      Object.entries(cache.yearData).map(([year, data]) => [year, {
        hitos:        data.hitos.length,
        textos:       data.textos.length,
        fotos:        data.fotos.length,
        hitosIds:     data.hitos.map(h => h.id),
        fotosHitoIds: [...new Set(data.fotos.map(f => f.hito_id))],
        primerasFotos: data.fotos.slice(0, 3),
      }])
    ),
  });
});

// Refresco manual del caché (requiere clave)
app.post('/api/refresh', async (req, res) => {
  const clave = req.query.clave || req.body?.clave;
  if (clave !== config.refreshKey) return res.status(403).json({ error: 'Clave incorrecta' });

  try {
    cache = null;
    await buildCache();
    res.json({ ok: true, loadedAt: cache.loadedAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar: ' + e.message });
  }
});

// Wildcard fallback to serve index.html for clean client routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.includes('.')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Inicio ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor en http://localhost:${PORT}`);
  buildCache().catch(e => console.error('[Sheets] Error al iniciar caché:', e.message));
});
