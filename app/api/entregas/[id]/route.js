import { getCache } from '@/lib/sheets';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { yearData, loadedAt } = await getCache();

    for (const data of Object.values(yearData)) {
      const textosRow = data.textos.find(t => t.hito_id === id);
      const fotos     = data.fotos
        .filter(f => f.hito_id === id)
        .map(f => ({ url: f.url, epigraph: f.epigrafe || '' }));

      if (!textosRow && fotos.length === 0) continue;

      const secciones = textosRow
        ? Object.entries(textosRow)
            .filter(([k]) => k !== 'hito_id' && k.trim() !== '')
            .map(([titulo, texto]) => ({ titulo, texto }))
        : [];

      return Response.json({ secciones, fotos, loadedAt });
    }

    return Response.json(null);
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Error cargando entrega' }, { status: 500 });
  }
}
