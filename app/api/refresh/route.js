import { config, buildCache, clearCache, getCache } from '@/lib/sheets';

export async function POST(request) {
  const url = new URL(request.url);
  const clave = url.searchParams.get('clave');
  
  if (clave !== config.refreshKey) {
    return Response.json({ error: 'Clave incorrecta' }, { status: 403 });
  }

  try {
    clearCache();
    await buildCache();
    const { loadedAt } = await getCache();
    return Response.json({ ok: true, loadedAt });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Error al actualizar: ' + e.message }, { status: 500 });
  }
}
