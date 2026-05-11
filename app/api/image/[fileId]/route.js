export async function GET(request, { params }) {
  const { fileId } = await params;
  
  if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return new Response('ID inválido', { status: 400 });
  }

  try {
    const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const driveRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
    });

    if (!driveRes.ok) {
      return new Response('Imagen no encontrada', { status: 404 });
    }

    const contentType = driveRes.headers.get('content-type') || 'image/jpeg';
    if (contentType.includes('text/html')) {
      return new Response('Archivo no accesible — verificá que esté compartido como "Cualquiera con el enlace"', { status: 403 });
    }

    const buffer = await driveRes.arrayBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    console.error('[Image proxy]', e.message);
    return new Response('Error al obtener imagen', { status: 500 });
  }
}
