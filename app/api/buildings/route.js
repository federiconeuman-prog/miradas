import { getCache } from '@/lib/sheets';

export async function GET() {
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
        result.push({
          id:             h.id,
          name:           h.nombre,
          address:        h.direccion,
          style:          h.estilo,
          year:           h.año_construccion,
          fact:           h.hecho_curioso,
          lat:            parseCoord(h.lat),
          lng:            parseCoord(h.lng),
          imageUrl:       h.imagen,
          collectionYear: year,
          hasEntrega:     fotosIds.has(h.id) || textosIds.has(h.id),
          ...extra,
        });
      }
    }

    return Response.json(result);
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Error cargando hitos' }, { status: 500 });
  }
}
