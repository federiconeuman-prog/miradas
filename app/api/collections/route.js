import { getCache } from '@/lib/sheets';

export async function GET() {
  try {
    const { colecciones } = await getCache();
    const result = {};
    colecciones.forEach(c => {
      if (c.año) result[c.año] = { titulo: c.titulo, imagen: c.imagen, estado: c.estado };
    });
    return Response.json(result);
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Error cargando colecciones' }, { status: 500 });
  }
}
