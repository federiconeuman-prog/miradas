// Verifica el estado real de la app en Render.
// Uso: APP_URL=https://miradas-2026.onrender.com node test-ping.js

const APP_URL = process.env.APP_URL || 'https://miradas.onrender.com';
const ENDPOINT = `${APP_URL}/health`;

function ok(msg)   { console.log(`  ✓ ${msg}`); }
function warn(msg) { console.warn(`  ⚠ ${msg}`); }
function fail(msg) { console.error(`  ✗ ${msg}`); process.exit(1); }

console.log(`\nDiagnóstico de estado — ${new Date().toLocaleString('es-AR')}`);
console.log(`URL: ${ENDPOINT}\n`);

const start = Date.now();
let res;
try {
  res = await fetch(ENDPOINT);
} catch (e) {
  fail(`Sin conexión — ${e.message}`);
}

const ms = Date.now() - start;

// 1. Status HTTP
if (res.status !== 200) fail(`HTTP ${res.status} (se esperaba 200)`);
ok(`Conexión establecida — ${ms}ms`);

// 2. Content-Type: si Render devuelve HTML, la app todavía está despertando
const ct = res.headers.get('content-type') || '';
if (!ct.includes('application/json')) {
  fail(`Respuesta HTML en lugar de JSON — la app está despertando o caída\n     Content-Type: "${ct}"`);
}

// 3. Parsear health check
let data;
try {
  data = await res.json();
} catch (e) {
  fail(`Respuesta no es JSON válido: ${e.message}`);
}

if (!data.ok) fail(`Servidor reportó ok=false`);

// 4. Estado del caché
if (!data.cacheLoaded) {
  warn('El caché no está cargado — los datos de Google Sheets todavía se están descargando');
} else {
  const loadedAt = new Date(data.loadedAt);
  const minAgo = Math.floor((Date.now() - loadedAt) / 60000);
  ok(`Caché cargado — hace ${minAgo} min (${loadedAt.toLocaleTimeString('es-AR')})`);
}

// 5. Uptime del proceso
const uptime = data.uptime;
const uptimeMin = Math.floor(uptime / 60);
if (uptimeMin < 1) {
  warn(`Uptime: ${uptime}s — la app acaba de arrancar (cold start)`);
} else {
  ok(`Uptime: ${uptimeMin} min activa`);
}

// 6. Tiempo de respuesta → detecta cold start
if (ms > 8000) {
  warn(`Tiempo de respuesta: ${ms}ms — Render tuvo que despertar la app (estaba dormida)`);
} else if (ms > 3000) {
  warn(`Tiempo de respuesta: ${ms}ms — un poco lento, puede estar bajo carga`);
} else {
  ok(`Tiempo de respuesta: ${ms}ms — app caliente y respondiendo`);
}

// Resumen final
console.log('');
if (!data.cacheLoaded || ms > 8000 || uptimeMin < 1) {
  console.log('  ESTADO: DESFASADA — la app está activa pero recién arrancó.');
  console.log('          Esperá ~30s y volvé a correr este script para confirmar.\n');
} else {
  console.log('  ESTADO: OK — la app está viva, caliente y con datos cargados.\n');
}
