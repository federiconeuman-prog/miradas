// Pinga la app en Render cada 14 min para evitar que se duerma (free tier = 15 min).
// Uso: APP_URL=https://miradas-2026.onrender.com node keep-alive.js

const APP_URL = process.env.APP_URL || 'https://miradas-2026.onrender.com';
const ENDPOINT = `${APP_URL}/health`;
const INTERVAL_MS = 14 * 60 * 1000;

async function ping() {
  const ts = new Date().toISOString();
  const start = Date.now();
  try {
    const res = await fetch(ENDPOINT);
    const ms = Date.now() - start;
    if (res.ok) {
      console.log(`[${ts}] OK ${res.status} — ${ms}ms`);
    } else {
      console.warn(`[${ts}] WARN ${res.status} — ${ms}ms`);
    }
  } catch (e) {
    console.error(`[${ts}] ERROR — ${e.message}`);
  }
}

console.log(`Keep-alive iniciado → ${ENDPOINT}`);
console.log(`Intervalo: cada 14 minutos\n`);

ping();
setInterval(ping, INTERVAL_MS);
