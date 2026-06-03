let buildings = [];
let mapGeneral, mapDetail, markerDetail, mapAbout, mapFullPage;
let currentPhotoIndex = 0;

let currentCollectionYear = 2026;

async function loadData() {
    try {
        const res = await fetch('/api/buildings');
        buildings = await res.json();
        
        // Cargar metadatos de colecciones (años)
        const colRes = await fetch('/api/collections');
        const collections = await colRes.json();
        
        await renderYears(collections);
        updateHomeTexts(collections);
        renderCollection();

        // Cargar sección de información dinámica desde el Excel
        try {
            const infoRes = await fetch('/api/info-proyecto');
            if (infoRes.ok) {
                const infoData = await infoRes.json();
                updateInfoTexts(infoData);
            }
        } catch (infoErr) {
            console.warn('No se pudieron cargar los textos de la sección de información dinámica', infoErr);
        }

        // Cargar fotos de portada para las letras del título "MIRADAS"
        try {
            const landingRes = await fetch('/api/landing-photos');
            if (landingRes.ok) {
                const landingPhotos = await landingRes.json();
                renderLandingPhotos(landingPhotos);
            }
        } catch (landingErr) {
            console.warn('No se pudieron cargar las fotos de portada', landingErr);
        }

        // Cargar sección de muestra física
        try {
            const muestraRes = await fetch('/api/muestra-fisica');
            if (muestraRes.ok) {
                const muestraData = await muestraRes.json();
                renderMuestraFisica(muestraData);
            }
        } catch (muestraErr) {
            console.warn('No se pudo cargar la sección de muestra física', muestraErr);
        }

        // Inicializar sección y estado según URL actual en la carga inicial de la página
        const p = window.location.pathname;
        const params = new URLSearchParams(window.location.search);
        const detailId = params.get('detalle');
        const fotoIndexStr = params.get('foto');

        let initialTab = 'inicio';
        if (p === '/hitos') initialTab = 'hitos';
        else if (p === '/mapa') initialTab = 'mapa';
        else if (p === '/informacion') initialTab = 'informacion';

        showTab(initialTab, null, false);

        if (detailId) {
            await showDetail(detailId, false, false);
            if (fotoIndexStr !== null) {
                const fIndex = parseInt(fotoIndexStr, 10);
                openFullscreen(fIndex, false);
            }
        }
    } catch (err) {
        console.error('Error cargando datos', err);
    }
}

function renderLandingPhotos(photos) {
    const mainTitle = document.getElementById('main-title');
    if (!mainTitle || !photos || !Array.isArray(photos) || photos.length === 0) return;

    const letterSpans = mainTitle.querySelectorAll('.letter');
    if (letterSpans.length === 0) return;

    // Normalizar datos del Excel/Sheet
    const letterMap = {};
    photos.forEach((p, idx) => {
        const letraKey = Object.keys(p).find(k => k.toLowerCase() === 'letra' || k.toLowerCase() === 'letra_id');
        const urlKey = Object.keys(p).find(k => k.toLowerCase() === 'url' || k.toLowerCase() === 'link' || k.toLowerCase() === 'imagen' || k.toLowerCase() === 'image');
        
        if (letraKey && urlKey && p[letraKey] && p[urlKey]) {
            const val = String(p[letraKey]).toUpperCase().trim();
            letterMap[val] = p[urlKey];
        }
    });

    letterSpans.forEach((span, index) => {
        const char = (span.getAttribute('data-letter') || span.textContent || '').toUpperCase().trim();
        let targetUrl = '';

        // Intentar emparejar en este orden de prioridad:
        // 1. Clave compuesta específica de la letra A ("A1" para el 1er A de MIRADAS, "A2" para el 2do A de MIRADAS)
        if (char === 'A') {
            const specificKey = index === 3 ? 'A1' : 'A2';
            if (letterMap[specificKey]) {
                targetUrl = letterMap[specificKey];
            }
        }

        // 2. Por letra simple ("M", "I", "R", "A", "D", "S")
        if (!targetUrl && letterMap[char]) {
            targetUrl = letterMap[char];
        }

        // 3. Por índice (1, 2, 3, 4, 5, 6, 7)
        if (!targetUrl) {
            const indexKey = String(index + 1);
            if (letterMap[indexKey]) {
                targetUrl = letterMap[indexKey];
            }
        }

        // 4. Secuencial: simplemente usar el objeto de la fila correspondiente si existe
        if (!targetUrl && photos[index]) {
            const item = photos[index];
            const urlKey = Object.keys(item).find(k => k.toLowerCase() === 'url' || k.toLowerCase() === 'link' || k.toLowerCase() === 'imagen' || k.toLowerCase() === 'image');
            if (urlKey && item[urlKey]) {
                targetUrl = item[urlKey];
            } else if (typeof item === 'string') {
                targetUrl = item;
            }
        }

        // Si encontramos una URL, la aplicamos
        if (targetUrl) {
            const directLink = getDriveDirectLink(targetUrl, 'w400');
            span.style.setProperty('--img', `url('${directLink}')`);
        }
    });
}

async function renderYears(collections) {
    const container = document.getElementById('years-container');
    if (!container) return;

    const years = Object.keys(collections).sort((a, b) => b - a);

    if (years.length === 0) {
        container.innerHTML = `
            <div class="font-sans text-[10px] uppercase tracking-widest opacity-30">
                Aguardando sincronización de datos...
            </div>
        `;
        return;
    }

    // Precargar imágenes antes de renderizar para que estén en caché
    await Promise.all(years.map(year => new Promise(resolve => {
        const src = getDriveDirectLink(collections[year].imagen, 'w1200');
        if (!src) return resolve();
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve;
        img.src = src;
    })));

    container.innerHTML = years.map(year => {
        const c = collections[year];
        const src = getDriveDirectLink(c.imagen, 'w1200');
        const isActive = c.estado === 'activo';
        return `
            <button ${isActive ? `onclick="showTab('hitos', ${year})"` : ''} class="group relative flex flex-col items-center p-8 md:p-12 lg:p-16 max-w-3xl overflow-hidden rounded-2xl ${isActive ? 'cursor-pointer active:scale-95' : 'opacity-20 grayscale cursor-default pointer-events-none'} transition-transform duration-300">
                <!-- Project Image Reveal -->
                <div class="absolute inset-2 opacity-50 md:opacity-[0.24] group-hover:opacity-[0.65] transition-all duration-1000 pointer-events-none overflow-hidden grayscale md:grayscale-0">
                    <img src="${src}"
                         srcset="${getDriveDirectLink(c.imagen, 'w400')} 400w, ${getDriveDirectLink(c.imagen, 'w800')} 800w, ${getDriveDirectLink(c.imagen, 'w1200')} 1200w"
                         sizes="(max-width: 768px) 100vw, 1200px"
                         class="w-full h-full object-cover scale-[1.3] group-hover:scale-110 transition-transform duration-[8000ms] ease-out mobile-animate-card-img"
                         alt="${c.titulo || 'Proyecto Miradas'}"
                         loading="lazy">
                </div>

                <!-- Framing corners -->
                <div class="absolute top-0 left-0 w-6 h-6 md:w-8 md:h-8 border-t border-l border-black/15 group-hover:border-black/40 transition-all duration-500 z-10 mobile-animate-card-corners"></div>
                <div class="absolute top-0 right-0 w-6 h-6 md:w-8 md:h-8 border-t border-r border-black/15 group-hover:border-black/40 transition-all duration-500 z-10 mobile-animate-card-corners"></div>
                <div class="absolute bottom-0 left-0 w-6 h-6 md:w-8 md:h-8 border-b border-l border-black/15 group-hover:border-black/40 transition-all duration-500 z-10 mobile-animate-card-corners"></div>
                <div class="absolute bottom-0 right-0 w-6 h-6 md:w-8 md:h-8 border-b border-r border-black/15 group-hover:border-black/40 transition-all duration-500 z-10 mobile-animate-card-corners"></div>

                <div class="relative flex flex-col items-center gap-3 md:gap-4 z-10 text-center">
                    <span class="font-sans text-[10px] md:text-xs font-bold uppercase tracking-[0.5em] text-black/50 md:text-black/30 group-hover:text-black/60 transition-all duration-500 mobile-animate-card-text">
                        Colección Activa — ${year}
                    </span>
                    <h2 class="font-sans font-bold text-2xl sm:text-3xl md:text-5xl lg:text-6xl uppercase tracking-tighter text-black leading-tight max-w-3xl px-4 md:px-6">
                        ${c.titulo || 'Proyecto Miradas'}
                    </h2>
                </div>
            </button>
        `;
    }).join('') + `
        <!-- Elegant 'Muestra en la escuela — Próximamente' indicator (Muestra indicator with horizontal lines in the sides and prominent arrow) -->
        <div class="group flex items-center justify-center gap-4 sm:gap-6 md:gap-8 mt-16 mb-12 select-none text-center mx-auto w-full max-w-sm px-4">
            <div class="h-px w-8 sm:w-12 md:w-16 bg-black/10 group-hover:w-16 sm:group-hover:w-24 md:group-hover:w-36 group-hover:bg-black/35 transition-all duration-700 shrink-0 mobile-animate-line-h"></div>
            <button onclick="showTab('muestra')" class="font-sans py-4 flex flex-col items-center gap-2 cursor-pointer bg-transparent border-none outline-none select-none transition-all duration-700 shrink-0">
                <span class="text-[9px] md:text-[11px] font-bold uppercase tracking-[0.4em] text-black/30 group-hover:text-black/50 transition-colors duration-500">Muestra física</span>
                <h3 class="text-xs md:text-sm font-semibold uppercase tracking-[0.3em] text-black/40 group-hover:text-black transition-colors duration-500 my-1 pb-0.5">
                    En la escuela
                </h3>
                <p class="text-[9px] uppercase tracking-[0.4em] text-black/25 group-hover:text-black/45 transition-colors duration-500">
                    Próximamente
                </p>
                <div class="mt-4 flex flex-col items-center gap-2 text-[9px] md:text-[11px] font-bold uppercase tracking-[0.4em] text-black/20 group-hover:text-black/85 transition-colors duration-500">
                    <span>Ver Muestra</span>
                    <span class="text-xl md:text-2xl font-light transform group-hover:translate-y-2 transition-all duration-500 leading-none select-none mobile-animate-arrow-d">&darr;</span>
                </div>
            </button>
            <div class="h-px w-8 sm:w-12 md:w-16 bg-black/10 group-hover:w-16 sm:group-hover:w-24 md:group-hover:w-36 group-hover:bg-black/35 transition-all duration-700 shrink-0 mobile-animate-line-h"></div>
        </div>
    `;
}

function parseSimpleMinimarkdown(text) {
    if (!text) return '';
    // Escapar entidades básicas de HTML para evitar romper el diseño
    let safeText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    // Convertir **negrita** o __negrita__ en span estilizado para coincidir con la estética
    safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<span class="font-semibold text-black/90">$1</span>');
    safeText = safeText.replace(/__(.*?)__/g, '<span class="font-semibold text-black/90">$1</span>');
    
    // Convertir *cursiva* o _cursiva_ en cursiva
    safeText = safeText.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    safeText = safeText.replace(/_(.*?)_/g, '<em class="italic">$1</em>');
    
    // Reemplazar saltos de línea por <br>
    safeText = safeText.replace(/\n/g, '<br>');
    return safeText;
}

function updateHomeTexts(collections) {
    if (!collections) return;
    
    const years = Object.keys(collections);
    if (years.length === 0) return;
    
    const activeYear = years.find(year => collections[year].estado === 'activo') || years[0];
    const act = collections[activeYear];
    if (!act) return;

    // Buscar propiedades de manera flexible y tolerante a tildes/mayúsculas
    const findValue = (obj, searchWords) => {
        const keys = Object.keys(obj);
        
        // 1. Coincidencia exacta (normalizada) primero
        const exactMatch = keys.find(k => {
            const normKey = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
            return searchWords.some(w => {
                const normWord = w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
                return normKey === normWord;
            });
        });
        if (exactMatch) return obj[exactMatch];
        
        // 2. Coincidencia parcial con resguardo
        const partialMatch = keys.find(k => {
            const normKey = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
            return searchWords.some(w => {
                const normWord = w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
                return normKey.includes(normWord);
            });
        });
        return partialMatch ? obj[partialMatch] : null;
    };

    const preTitle = findValue(act, ['pretitulo', 'pretitle', 'subtitulo', 'subtitle', 'copete']);
    const cita = findValue(act, ['cita', 'quote', 'frase', 'bajada', 'slogan']);
    const desc = findValue(act, ['descripcion', 'description', 'texto', 'parrafo', 'intro']);

    if (preTitle) {
        const el = document.getElementById('home-pre-titulo');
        if (el) el.innerHTML = parseSimpleMinimarkdown(preTitle);
    }
    if (cita) {
        const el = document.getElementById('home-cita');
        if (el) el.innerHTML = parseSimpleMinimarkdown(cita);
    }
    if (desc) {
        const el = document.getElementById('home-descripcion');
        if (el) el.innerHTML = parseSimpleMinimarkdown(desc);
    }
}

function parseSimpleMinimarkdownDark(text) {
    if (!text) return '';
    let safeText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<span class="font-semibold text-white/90">$1</span>');
    safeText = safeText.replace(/__(.*?)__/g, '<span class="font-semibold text-white/90">$1</span>');
    safeText = safeText.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    safeText = safeText.replace(/_(.*?)_/g, '<em class="italic">$1</em>');
    safeText = safeText.replace(/\n/g, '<br>');
    return safeText;
}

window.scrollCarousel = function(containerId, direction) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const slideWidth = container.clientWidth;
    container.scrollBy({ left: slideWidth * direction, behavior: 'smooth' });
};

// Actualiza la sección de la Muestra Física
function renderMuestraFisica(data) {
    if (!data) return;

    if (!Array.isArray(data)) data = [data];

    const container = document.getElementById('muestra-gallery');
    const navContainer = document.getElementById('muestra-carousel-nav');
    const carouselWrapper = container ? container.closest('.group\\/carousel') : null;
    
    if (!container) return; // Wait until DOM is available

    // Filter valid items correctly preventing whitespace-only empty rows
    const validItems = data.filter(item => Object.values(item).some(val => val && String(val).trim() !== ''));

    const getKey = (item, possibleKeys) => {
        const keys = Object.keys(item);
        const match = keys.find(k => {
            const normKey = String(k).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
            return possibleKeys.some(p => normKey.includes(p));
        });
        return match ? item[match] : '';
    };

    let carouselItems = [];

    // Parse logic that supports BOTH traditional "columns" format and clean "clave/valor" format
    validItems.forEach(item => {
        // Formato A: Tabular (tipo, titulo, descripcion, url)
        // Formato B: Clave/Valor (campo, contenido)
        const claveRaw = getKey(item, ['tipo', 'type', 'formato', 'categoria', 'campo', 'clave', 'propiedad', 'key']);
        const tipoOCampo = String(claveRaw).toLowerCase().trim();
        
        let titulo = '';
        let descripcion = '';
        let url = '';
        let isMedia = false;
        
        // Detección de formato "Clave - Valor" vs "Columnas extendidas"
        const valorGeneral = getKey(item, ['valor', 'value', 'contenido', 'texto_principal']);
        
        if (valorGeneral && !item.url && !item.link) {
            // Estamos en formato "Clave - Valor" vertical
            if (tipoOCampo.includes('video') || tipoOCampo.includes('foto') || tipoOCampo.includes('img') || tipoOCampo.includes('imagen')) {
                url = valorGeneral;
                isMedia = true;
            } else {
                titulo = valorGeneral;
                // Si hay un tercer campo para detalle/bajada
                descripcion = getKey(item, ['descripcion', 'detalle', 'info', 'extra']);
            }
        } else {
            // Formato de columnas normal
            const tituloRaw = getKey(item, ['titulo', 'title', 'nombre', 'encabezado']);
            titulo = (typeof tituloRaw === 'string') ? tituloRaw.trim() : '';
            
            const descripcionRaw = getKey(item, ['descripcion', 'texto', 'detalle', 'info', 'bajada']);
            descripcion = (typeof descripcionRaw === 'string') ? descripcionRaw.trim() : '';
            
            const urlRaw = getKey(item, ['url', 'link', 'video', 'imagen', 'foto', 'enlace', 'archivo']);
            url = (typeof urlRaw === 'string') ? urlRaw.trim() : '';
        }

        // Determinar qué hacer con esta fila
        if (tipoOCampo === 'titulo' || tipoOCampo === 'encabezado' || tipoOCampo === 'title') {
            if (titulo) {
                const el = document.getElementById('muestra-titulo');
                if (el) el.innerText = titulo;
            }
            if (descripcion) {
                const el = document.getElementById('muestra-subtitulo');
                if (el) el.innerText = descripcion;
            }
        } else if (tipoOCampo === 'cita' || tipoOCampo === 'frase' || tipoOCampo === 'quote') {
            const content = descripcion || titulo;
            if (content) {
                const el = document.getElementById('muestra-cita');
                if (el) el.innerHTML = `“${content}”`;
            }
        } else if (tipoOCampo === 'descripcion' || tipoOCampo === 'parrafo' || tipoOCampo === 'texto') {
            const content = descripcion || titulo;
            if (content) {
                const el = document.getElementById('muestra-descripcion');
                if (el) el.innerHTML = parseSimpleMinimarkdown(content);
            }
        } else {
            // Assume it's a media/carousel item if it's explicitly video/foto or has a URL, 
            // or if it doesn't match the structural types above but has content.
            const itemUrl = url || getKey(item, ['url', 'link', 'enlace', 'archivo']);
            if (itemUrl && (isMedia || tipoOCampo.includes('video') || tipoOCampo.includes('foto') || tipoOCampo.includes('img') || tipoOCampo.includes('imagen') || tipoOCampo.includes('galeria') || tipoOCampo)) {
                // Ensure we pass a properly structured item to the carousel array
                let mediaObj = { ...item };
                if (isMedia) {
                    mediaObj.url = url;
                    mediaObj.tipo = tipoOCampo;
                    mediaObj.titulo = getKey(item, ['titulo', 'detalle', 'extra']) || ''; // If they put an extra column for media titles
                }
                carouselItems.push(mediaObj);
            }
        }
    });

    // Reset container contents completely to avoid duplicate overlapping
    container.innerHTML = '';
    
    if (navContainer) {
        navContainer.innerHTML = '';
        if (carouselItems.length > 1) {
            navContainer.classList.remove('hidden');
            if (carouselWrapper) {
                carouselWrapper.querySelectorAll('button').forEach(b => b.style.display = 'flex');
            }
        } else {
            navContainer.classList.add('hidden');
            if (carouselWrapper) {
                carouselWrapper.querySelectorAll('button').forEach(b => b.style.display = 'none');
            }
        }
    }

    if (carouselItems.length === 0) {
        // Show an elegant fallback presentation when there is no media data
        if (carouselWrapper) {
            carouselWrapper.style.display = '';
            carouselWrapper.querySelectorAll('button').forEach(b => b.style.display = 'none');
        }
        container.innerHTML = `
            <div class="w-full shrink-0 snap-center flex flex-col items-center justify-center aspect-[16/9] md:aspect-[21/9] bg-white/50 relative transition-all">
                <!-- Framing corners -->
                <div class="absolute top-0 left-0 w-6 h-6 md:w-8 md:h-8 border-t border-l border-black/15 z-10"></div>
                <div class="absolute top-0 right-0 w-6 h-6 md:w-8 md:h-8 border-t border-r border-black/15 z-10"></div>
                <div class="absolute bottom-0 left-0 w-6 h-6 md:w-8 md:h-8 border-b border-l border-black/15 z-10"></div>
                <div class="absolute bottom-0 right-0 w-6 h-6 md:w-8 md:h-8 border-b border-r border-black/15 z-10"></div>
                
                <div class="w-14 h-14 md:w-16 md:h-16 border border-[#2d1b40]/10 rounded-full flex items-center justify-center mx-auto mb-4 bg-[#fdfbfd] shadow-sm">
                    <span class="text-2xl text-[#2d1b40]/40 font-light">⧖</span>
                </div>
                <span class="text-[10px] md:text-[11px] font-sans tracking-[0.4em] font-semibold uppercase text-[#2d1b40]/50 relative z-10 text-center px-4">Próximamente</span>
                <p class="font-sans text-xs md:text-sm text-[#2d1b40]/40 mt-3 max-w-[280px] md:max-w-md text-center leading-relaxed relative z-10 px-4">El registro final de la muestra en la escuela será cargado en este espacio.</p>
            </div>
        `;
        return;
    }
    
    if (carouselWrapper) carouselWrapper.style.display = '';

    carouselItems.forEach((item, index) => {
        const urlRaw = getKey(item, ['url', 'link', 'video', 'imagen', 'foto', 'enlace', 'archivo']);
        const url = (typeof urlRaw === 'string') ? urlRaw.trim() : '';
        const tipoRaw = getKey(item, ['tipo', 'type', 'formato']);
        const tipo = (typeof tipoRaw === 'string' && tipoRaw.trim()) ? tipoRaw.toLowerCase() : '';
        
        const isVideo = tipo.includes('video') || (url && (url.includes('youtube') || url.includes('youtu.be') || url.includes('vimeo') || url.includes('drive.google.com/file')));
        const isFoto = !isVideo && (tipo.includes('foto') || tipo.includes('img') || tipo.includes('imagen') || (url && url.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null));
        
        const finalType = isVideo ? 'video' : (isFoto ? 'foto' : (url ? 'link' : 'empty'));

        const tituloRaw = getKey(item, ['titulo', 'title', 'nombre', 'encabezado']);
        const titulo = (typeof tituloRaw === 'string') ? tituloRaw.trim() : '';
        const descripcionRaw = getKey(item, ['descripcion', 'texto', 'detalle', 'info', 'bajada']);
        const descripcion = (typeof descripcionRaw === 'string') ? descripcionRaw.trim() : '';

        let mediaHtml = '';

        if (url) {
            if (finalType === 'video') {
                let embedUrl = url;
                if (url.includes('youtube.com/watch')) {
                    const urlParams = new URL(url).searchParams;
                    const videoId = urlParams.get('v');
                    if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0`;
                } else if (url.includes('youtu.be/')) {
                    const videoId = url.split('youtu.be/')[1].split('?')[0];
                    if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0`;
                } else if (url.includes('drive.google.com/file/d/')) {
                    const driveIdMatch = url.match(/\/d\/(.+?)\//);
                    if (driveIdMatch) embedUrl = `https://drive.google.com/file/d/${driveIdMatch[1]}/preview`;
                }
                
                mediaHtml = `
                    <div class="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-lg border border-[#2d1b40]/10 flex items-center justify-center">
                        <iframe src="${embedUrl}" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                    </div>
                `;
            } else if (finalType === 'foto') {
                 const imgSrc = url.includes('drive.google.com') ? getDriveDirectLink(url, 'w800') : url;
                 const srcsetAttr = url.includes('drive.google.com') ? `srcset="${getDriveDirectLink(url, 'w400')} 400w, ${getDriveDirectLink(url, 'w800')} 800w, ${getDriveDirectLink(url, 'w1200')} 1200w"` : '';
                 mediaHtml = `
                    <div class="aspect-[4/3] md:aspect-[3/2] lg:aspect-video w-full rounded-2xl overflow-hidden bg-[#2d1b40]/5 shadow-sm border border-[#2d1b40]/10 relative group bg-cover bg-center">
                        <img src="${imgSrc}" ${srcsetAttr} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 1000px" class="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-105" alt="${titulo || 'Registro Fotográfico de Exposición'}" loading="lazy" />
                    </div>
                 `;
            } else {
                 mediaHtml = `
                    <a href="${url}" target="_blank" rel="noopener noreferrer" class="aspect-video w-full rounded-2xl bg-[#fdfbfd]/50 shadow-sm border border-[#6d4d8c]/15 hover:bg-white hover:border-[#6d4d8c]/40 hover:shadow-md transition-all flex flex-col items-center justify-center gap-4 group">
                        <div class="w-12 h-12 rounded-full border border-[#6d4d8c]/20 bg-white flex items-center justify-center group-hover:-translate-y-1 group-hover:scale-110 transition-transform">
                            <span class="text-xl rotate-45 transform text-[#6d4d8c]">&uarr;</span>
                        </div>
                        <span class="font-sans text-[10px] uppercase tracking-[0.2em] text-[#6d4d8c]/80 font-semibold">Abrir Enlace</span>
                    </a>
                 `;
            }
        } else {
            mediaHtml = `
                <div class="aspect-video w-full rounded-2xl overflow-hidden bg-white/50 shadow-sm border border-[#2d1b40]/10 flex flex-col items-center justify-center relative">
                    <div class="w-12 h-12 rounded-full border border-[#2d1b40]/10 bg-[#fdfbfd] flex items-center justify-center mb-3">
                        <span class="text-[#2d1b40]/30 text-xl font-light">⧖</span>
                    </div>
                    <span class="text-[9px] md:text-[10px] font-sans tracking-[0.3em] font-semibold uppercase text-[#2d1b40]/50 text-center px-4">Próximamente</span>
                </div>
            `;
        }

        const infoHtml = (titulo || descripcion) ? `
            <div class="mt-5 text-center px-2 md:px-4 max-w-2xl mx-auto pt-4 border-t border-[#2d1b40]/5">
                ${titulo ? `<h3 class="font-bold text-[18px] md:text-[20px] font-display text-[#2d1b40] tracking-tight leading-tight">${titulo}</h3>` : ''}
                ${descripcion ? `<div class="text-[12px] md:text-[13px] font-sans text-[#2d1b40]/50 leading-relaxed mt-2">${parseSimpleMinimarkdown(descripcion)}</div>` : ''}
            </div>
        ` : '';

        // Add to carousel
        const slideContainer = document.createElement('div');
        // Standard full width sizing for a clean 1-item carousel
        slideContainer.className = `shrink-0 snap-center flex flex-col pt-2 transition-all w-full px-2 md:px-12 relative`;
        slideContainer.innerHTML = `
            ${mediaHtml}
            ${infoHtml}
        `;
        container.appendChild(slideContainer);

        // Populate navigation pagination dots natively reacting to scroll 
        if (carouselItems.length > 1 && navContainer) {
            const dot = document.createElement('button');
            dot.className = `h-1.5 rounded-full transition-all duration-500 ${index === 0 ? 'bg-[#6d4d8c] w-6' : 'bg-[#2d1b40]/15 hover:bg-[#6d4d8c]/40 w-1.5'}`;
            dot.onclick = () => {
                const scrollPos = slideContainer.offsetLeft - (container.clientWidth / 2) + (slideContainer.clientWidth / 2);
                container.scrollTo({ left: scrollPos, behavior: 'smooth' });
            };
            navContainer.appendChild(dot);
        }
    });

    // Scroll listener calculates center-most slide iteratively 
    if (carouselItems.length > 1 && navContainer) {
        container.addEventListener('scroll', () => {
             const centerContainer = container.scrollLeft + (container.clientWidth / 2);
             let activeIndex = 0;
             let minDiff = Infinity;

             Array.from(container.children).forEach((slide, idx) => {
                 const centerSlide = slide.offsetLeft + (slide.clientWidth / 2);
                 const diff = Math.abs(centerContainer - centerSlide);
                 if (diff < minDiff) {
                     minDiff = diff;
                     activeIndex = idx;
                 }
             });

             Array.from(navContainer.children).forEach((dot, index) => {
                 dot.className = index === activeIndex ? 'h-1.5 rounded-full transition-all duration-300 bg-[#6d4d8c] w-6' : 'h-1.5 rounded-full transition-all duration-300 bg-[#2d1b40]/15 hover:bg-[#6d4d8c]/40 w-1.5';
             });
        }, { passive: true });
    }
}

function updateInfoTexts(data) {
    if (!data) return;

    // Helper flexible mapping con resguardo contra falsos positivos
    const getVal = (searchWords) => {
        const keys = Object.keys(data);
        
        // 1. Coincidencia exacta (normalizada) primero
        const exactMatch = keys.find(k => {
            const normKey = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
            return searchWords.some(w => {
                const normWord = w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
                return normKey === normWord;
            });
        });
        if (exactMatch) return data[exactMatch];
        
        // 2. Coincidencia parcial con exclusiones explícitas para evitar cross-contamination
        const partialMatch = keys.find(k => {
            const normKey = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
            return searchWords.some(w => {
                const normWord = w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
                if (normWord === 'titulo' && normKey.includes('destacado')) return false;
                if (normWord === 'texto' && normKey.includes('secundario')) return false;
                return normKey.includes(normWord);
            });
        });
        return partialMatch ? data[partialMatch] : null;
    };

    const titleOne = getVal(['titulouno', 'titulo1', 'titulo', 'title', 'nombre']);
    const titleTwo = getVal(['titulodos', 'titulo2', 'titulodestacado', 'subtitulo', 'subtitle']);
    const desc = getVal(['descripcion', 'description', 'texto', 'textoprincipal']);
    const cita = getVal(['cita', 'quote', 'frase', 'bajada']);
    const descSec = getVal(['textosecundario', 'descripcionsecundaria', 'textodos', 'texto2']);
    const inst = getVal(['institucion', 'colegio', 'escuela', 'institution']);
    const orient = getVal(['orientacion', 'especialidad', 'orientation']);
    const cat = getVal(['catedra', 'materia', 'profesor', 'curso']);

    if (titleOne) {
        const el = document.getElementById('info-titulo');
        if (el) el.innerHTML = parseSimpleMinimarkdownDark(titleOne);
    }
    if (titleTwo) {
        const el = document.getElementById('info-titulo-destacado');
        if (el) el.innerHTML = parseSimpleMinimarkdownDark(titleTwo);
    }
    if (desc) {
         const el = document.getElementById('info-descripcion');
         if (el) el.innerHTML = parseSimpleMinimarkdownDark(desc);
    }
    if (cita) {
         const el = document.getElementById('info-cita');
         if (el) el.innerHTML = parseSimpleMinimarkdownDark(cita);
    }
    if (descSec) {
         const el = document.getElementById('info-texto-secundario');
         if (el) el.innerHTML = parseSimpleMinimarkdownDark(descSec);
    }
    if (inst) {
         const el = document.getElementById('info-institucion');
         if (el) el.innerHTML = parseSimpleMinimarkdownDark(inst);
    }
    if (orient) {
         const el = document.getElementById('info-orientacion');
         if (el) el.innerHTML = parseSimpleMinimarkdownDark(orient);
    }
    if (cat) {
         const el = document.getElementById('info-catedra');
         if (el) el.innerHTML = parseSimpleMinimarkdownDark(cat);
    }

    // Extraer campos específicos de la Muestra Física
    const mTitle = getVal(['muestratitulo', 'titulo_muestra', 'muestranombre', 'muestra_titulo']);
    const mSub = getVal(['muestrasubtitulo', 'subtitulo_muestra', 'muestrasub', 'muestra_subtitulo']);
    const mCita = getVal(['muestracita', 'cita_muestra', 'frase_muestra', 'muestra_cita']);
    const mDesc = getVal(['muestradescripcion', 'descripcion_muestra', 'muestratexto', 'muestra_descripcion']);
    const mVideo = getVal(['muestravideo', 'video_muestra', 'videomuestra', 'video', 'video_url', 'muestra_video_url']);

    if (mTitle) {
        const el = document.getElementById('muestra-titulo');
        if (el) el.innerHTML = parseSimpleMinimarkdownDark(mTitle);
    }
    if (mSub) {
        const el = document.getElementById('muestra-subtitulo');
        if (el) el.innerHTML = parseSimpleMinimarkdownDark(mSub);
    }
    if (mCita) {
        const el = document.getElementById('muestra-cita');
        if (el) el.innerHTML = parseSimpleMinimarkdownDark(mCita);
    }
    if (mDesc) {
        const el = document.getElementById('muestra-descripcion');
        if (el) el.innerHTML = parseSimpleMinimarkdownDark(mDesc);
    }

    // Embed connected Video if link is provided, or show placeholder if empty or says "próximamente"
    const videoUrl = mVideo ? String(mVideo).trim() : '';
    const isProximamente = !videoUrl || videoUrl.toLowerCase().includes('proximamente') || videoUrl.toLowerCase().includes('próximamente') || videoUrl.toLowerCase() === 'no' || videoUrl.toLowerCase() === 'por venir';
    
    const placeholderEl = document.getElementById('muestra-video-placeholder');
    const playerEl = document.getElementById('muestra-video-player');
    const iframeEl = document.getElementById('muestra-iframe');

    if (isProximamente) {
        if (placeholderEl) placeholderEl.classList.remove('hidden');
        if (playerEl) playerEl.classList.add('hidden');
        if (iframeEl) iframeEl.removeAttribute('src');
    } else {
        // Resolve embed link
        let embedUrl = '';
        
        // YouTube Support
        let ytMatch = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i);
        if (ytMatch && ytMatch[1]) {
            embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
        }
        
        // Vimeo Support
        if (!embedUrl) {
            let vimeoMatch = videoUrl.match(/(?:vimeo\.com\/)(?:video\/)?([0-9]+)/i);
            if (vimeoMatch && vimeoMatch[1]) {
                embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
            }
        }
        
        // Google Drive Support
        if (!embedUrl) {
            let driveMatch = videoUrl.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]+)/);
            if (driveMatch && driveMatch[1]) {
                embedUrl = `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
            }
        }

        // If not any, use raw url as fallback
        if (!embedUrl) {
            embedUrl = videoUrl;
        }

        if (embedUrl) {
            if (iframeEl) iframeEl.src = embedUrl;
            if (placeholderEl) placeholderEl.classList.add('hidden');
            if (playerEl) playerEl.classList.remove('hidden');
        } else {
            if (placeholderEl) placeholderEl.classList.remove('hidden');
            if (playerEl) playerEl.classList.add('hidden');
            if (iframeEl) iframeEl.removeAttribute('src');
        }
    }
}

function getActiveBuildings() {
    return buildings.filter(b => String(b.collectionYear) === String(currentCollectionYear));
}

function renderCollection() {
    const data = getActiveBuildings();
    renderPublicGrid(data);
    initGeneralMap(data);
}

function showTab(id, year = null, pushHistory = true) {
    if (year) {
        currentCollectionYear = year;
        const logo = document.querySelector('#main-header button');
        if (logo) logo.textContent = `MIRADAS`;
    }

    const grid = document.getElementById('spatial-grid');
    const isSpatialTab = ['inicio', 'informacion', 'muestra'].includes(id);

    if (grid) {
        if (isSpatialTab) {
            grid.style.display = 'grid';
            void grid.offsetWidth; // Force reflow
            grid.classList.remove('inactive');
            
            if (id === 'inicio') {
                grid.style.transform = 'translate3d(0vw, 0vh, 0)';
            } else if (id === 'informacion') {
                grid.style.transform = 'translate3d(-100vw, 0vh, 0)';
            } else if (id === 'muestra') {
                grid.style.transform = 'translate3d(0vw, -100vh, 0)';
            }
        } else {
            grid.classList.add('inactive');
            setTimeout(() => {
                const currentTab = document.querySelector('.tab-content.active')?.id;
                if (!['inicio', 'informacion', 'muestra'].includes(currentTab)) {
                    grid.style.display = 'none';
                }
            }, 1000);
        }
    }

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    const element = document.getElementById(id);
    if (element) {
        element.classList.add('active');
    }

    if (isSpatialTab) {
        const gridScreen = document.getElementById(id);
        if (gridScreen) {
            gridScreen.scrollTo({ top: 0, behavior: 'smooth' });
        }
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    if (id === 'hitos') {
        renderCollection();
        if (mapGeneral) {
            setTimeout(() => mapGeneral.invalidateSize(), 300);
        }
    } else if (id === 'informacion') {
        setTimeout(() => {
            initAboutMap();
            if (mapAbout) {
                if (typeof mapAbout.invalidateSize === 'function') {
                    mapAbout.invalidateSize();
                } else if (typeof mapAbout.resize === 'function') {
                    mapAbout.resize();
                }
            }
        }, 150);
    } else if (id === 'mapa') {
        setTimeout(() => {
            initFullPageMap();
            if (mapFullPage) {
                mapFullPage.invalidateSize();
            }
        }, 150);
    }

    if (pushHistory && !window.isPopStateRunning) {
        let path = '/';
        if (id === 'inicio') path = '/';
        else if (id === 'hitos') path = '/hitos';
        else if (id === 'mapa') path = '/mapa';
        else if (id === 'informacion') path = '/informacion';
        else if (id === 'muestra') path = '/muestra';
        
        // Preserve any custom query params if present (like ?clave=...)
        const params = new URLSearchParams(window.location.search);
        const searchStr = params.toString() ? `?${params.toString()}` : '';
        
        window.history.pushState({ tab: id, year: year }, '', path + searchStr);
    }
}

// BUSCADOR
function removeAccents(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function handleSearch() {
    const input = document.getElementById('search-input');
    const query = removeAccents(input.value.toLowerCase().trim());
    const suggestionsBox = document.getElementById('search-suggestions');
    
    if (query.length > 0) {
        const filtered = getActiveBuildings().filter(b => {
            const nameNorm = removeAccents((b.name || '').toLowerCase());
            const styleNorm = removeAccents((b.style || '').toLowerCase());
            return nameNorm.includes(query) || styleNorm.includes(query);
        });
        renderPublicGrid(filtered);
        renderSuggestions(filtered);
    } else {
        renderPublicGrid(getActiveBuildings());
        suggestionsBox.classList.add('hidden');
    }
}

function renderSuggestions(data) {
    const box = document.getElementById('search-suggestions');
    if (data.length === 0) {
        box.classList.add('hidden');
        return;
    }
    
    box.classList.remove('hidden');
    box.innerHTML = data.slice(0, 5).map(b => `
        <div onclick="selectSuggestion('${b.id}')" class="px-6 py-4 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-none flex items-center justify-between">
            <div>
                <div class="font-bold text-sm">${b.name}</div>
                <div class="text-[10px] uppercase font-sans text-gray-400 font-sans tracking-widest">${b.style}</div>
            </div>
            <span class="opacity-20">→</span>
        </div>
    `).join('');
}

function selectSuggestion(id) {
    const b = buildings.find(x => x.id === id);
    document.getElementById('search-input').value = b.name;
    document.getElementById('search-suggestions').classList.add('hidden');
    showDetail(id);
}

function showSuggestions() {
    const query = document.getElementById('search-input').value;
    if(query.length > 0) document.getElementById('search-suggestions').classList.remove('hidden');
}

document.addEventListener('click', (e) => {
    if(!e.target.closest('.search-container')) {
        document.getElementById('search-suggestions')?.classList.add('hidden');
    }
});

// RESIZER LOGIC
let isResizing = false;
let lastSplitPercentage = 40;

document.getElementById('split-resizer')?.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.classList.add('select-none');
    const container = document.getElementById('main-split-container');
    const panel = document.getElementById('detail-panel');
    if (container) {
        container.classList.remove('transition-all', 'duration-700');
    }
    if (panel) {
        panel.classList.remove('duration-700');
    }
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const container = document.getElementById('main-split-container');
    const panel = document.getElementById('detail-panel');
    const gridContainer = document.getElementById('grid-container');
    
    if (!container || !panel || !gridContainer) return;

    const containerRect = container.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const percentage = Math.max(20, Math.min(80, (mouseX / containerRect.width) * 100));
    
    lastSplitPercentage = percentage;
    
    gridContainer.style.flex = `0 0 ${percentage}%`;
    gridContainer.style.width = `${percentage}%`;
    
    panel.style.flex = `0 0 ${100 - percentage}%`;
    panel.style.width = `${100 - percentage}%`;
    
    if (mapGeneral) mapGeneral.invalidateSize();
    if (mapDetail) mapDetail.invalidateSize();
});

document.addEventListener('mouseup', () => {
    isResizing = false;
    document.body.style.cursor = 'default';
    document.body.classList.remove('select-none');
    
    const container = document.getElementById('main-split-container');
    const panel = document.getElementById('detail-panel');
    if (container) {
        container.classList.add('transition-all', 'duration-700');
    }
    if (panel && !panel.classList.contains('hidden')) {
        panel.classList.add('duration-700');
    }
});

// For better responsiveness during window resize
window.addEventListener('resize', () => {
    if (window.innerWidth < 1024) {
        const gridContainer = document.getElementById('grid-container');
        const panel = document.getElementById('detail-panel');
        if (gridContainer) {
            gridContainer.style.flex = '';
            gridContainer.style.width = '';
        }
        if (panel) {
            panel.style.flex = '';
            panel.style.width = '';
        }
    }
    renderPublicGrid();
});

// SCROLL LOGIC FOR HEADER
let lastScrolls = {
    window: 0,
    panel: 0,
    grid: 0
};

function handleHeaderScroll(scrollTop, source = 'window') {
    const header = document.getElementById('main-header');
    if (!header) return;
    
    const lastScrollY = lastScrolls[source];
    
    if (scrollTop > lastScrollY && scrollTop > 50) {
        header.style.transform = 'translateY(-100%)';
    } else {
        header.style.transform = 'translateY(0)';
    }
    lastScrolls[source] = scrollTop;
}

window.addEventListener('scroll', () => handleHeaderScroll(window.scrollY, 'window'));
document.getElementById('detail-panel')?.addEventListener('scroll', (e) => handleHeaderScroll(e.target.scrollTop, 'panel'));
document.getElementById('grid-container')?.addEventListener('scroll', (e) => handleHeaderScroll(e.target.scrollTop, 'grid'));

// VISTA DETALLE
function getDriveDirectLink(url, sz = null) {
    if (!url) return '';
    let qs = sz ? `?sz=${sz}` : '';
    let match = url.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return `/api/image/${match[1]}${qs}`;
    match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return `/api/image/${match[1]}${qs}`;
    return url;
}

async function showDetail(id, isFromMap = false, pushHistory = true) {
    const b = buildings.find(x => x.id === id);
    if (!b) return;

    window.currentBuildingId = id;
    window.isDetailFromMap = isFromMap;

    if (pushHistory && !window.isPopStateRunning) {
        const activeTab = document.querySelector('.tab-content.active')?.id || 'hitos';
        let path = '/';
        if (activeTab === 'inicio') path = '/';
        else if (activeTab === 'hitos') path = '/hitos';
        else if (activeTab === 'mapa') path = '/mapa';
        else if (activeTab === 'informacion') path = '/informacion';
        
        const params = new URLSearchParams(window.location.search);
        params.set('detalle', id);
        
        window.history.pushState({ tab: activeTab, year: currentCollectionYear, detailId: id }, '', `${path}?${params.toString()}`);
    }

    try {
        const panel = document.getElementById('detail-panel');
        const content = document.getElementById('detail-content');

        // Reset any inline styling leftovers
        panel.style.width = '';
        panel.style.flex = '';

        // Efecto de fondo (Link Título/Fondo)
        if (b.bgUrl) {
            panel.style.backgroundImage = `linear-gradient(rgba(255,255,255,0.92), rgba(255,255,255,0.92)), url(${getDriveDirectLink(b.bgUrl)})`;
            panel.style.backgroundSize = 'cover';
            panel.style.backgroundPosition = 'center';
            panel.style.backgroundAttachment = 'fixed';
        } else {
            panel.style.background = 'white';
        }

        // Unhide
        panel.classList.remove('hidden');

        // Force a browser reflow/repaint to ensure transitions trigger correctly
        panel.offsetHeight;

        // Animaciones de escala y opacidad
        panel.classList.remove('scale-95', 'opacity-0');
        panel.classList.add('scale-100', 'opacity-100');

        // Bloquear scroll de fondo
        document.body.style.overflow = 'hidden';

        currentPhotoIndex = 0;
        
        // Persist or fetch current building photos
        window.userBuildingPhotos = window.userBuildingPhotos || {};
        if (!window.userBuildingPhotos[id]) {
            const res = await fetch(`/api/entregas/${id}`);
            const entregaData = await res.json();
            window.userBuildingPhotos[id] = (entregaData && entregaData.fotos && entregaData.fotos.length > 0) ? [...entregaData.fotos] : [];
            window.lastEntregaMap = window.lastEntregaMap || {};
            window.lastEntregaMap[id] = entregaData;
        }
        
        const entrega = window.lastEntregaMap ? window.lastEntregaMap[id] : null;
        const creditWords = ['créditos', 'creditos', 'autor', 'autores', 'alumnos', 'integrantes', 'registro', 'fotografía', 'fotografias', 'fotógrafos', 'fotografos', 'estudiantes'];
        const creditosSec = entrega && entrega.secciones
            ? entrega.secciones.find(s => creditWords.includes(s.titulo.toLowerCase().trim()))
            : null;
        const standardSecciones = entrega && entrega.secciones
            ? entrega.secciones.filter(s => !creditWords.includes(s.titulo.toLowerCase().trim()))
            : [];

        window.currentPhotos = window.userBuildingPhotos[id];
        const fotos = window.currentPhotos;

        // Precargar la primera foto para que aparezca sin flash al abrir el panel
        if (fotos.length > 0) {
            const firstSrc = getDriveDirectLink(typeof fotos[0] === 'string' ? fotos[0] : fotos[0].url);
            if (firstSrc) await new Promise(resolve => {
                const img = new Image();
                img.onload = img.onerror = resolve;
                img.src = firstSrc;
            });
        }

        content.innerHTML = `
            <div class="lg:pt-0">
                <!-- Back Link -->
                <div class="bg-white/95 backdrop-blur-md pb-6 static z-20 flex items-center justify-between">
                    <button onclick="closeDetail()" class="text-gray-400 hover:text-black transition-all flex items-center gap-3 group cursor-pointer bg-transparent border-none p-0 outline-none">
                        <svg class="w-5 h-5 transition-transform group-hover:-translate-x-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 12H5M12 19l-7-7 7-7"></path>
                        </svg>
                        <span class="font-sans text-[11px] font-bold uppercase tracking-[0.3em] text-black/50 group-hover:text-black transition-all">Volver</span>
                    </button>
                </div>

                <!-- CAROUSEL FULL-SIZE -->
                <div class="relative bg-white -mx-6 lg:-mx-10 group/carousel-master">
                    ${fotos.length > 0 ? `
                        <div class="relative group/carousel-main overflow-hidden">
                            <div id="carousel-track" class="flex transition-transform duration-1000 cubic-bezier(0.16, 1, 0.3, 1)">
                                ${fotos.map((f, i) => {
                                    const urlStr = typeof f === 'string' ? f : f.url;
                                    const srcBase = getDriveDirectLink(urlStr, 'w800');
                                    const src400 = getDriveDirectLink(urlStr, 'w400');
                                    const src1200 = getDriveDirectLink(urlStr, 'w1200');
                                    const hasUrl = urlStr && (urlStr.includes('drive.google.com') || urlStr.includes('id='));
                                    const srcset = hasUrl ? `srcset="${src400} 400w, ${srcBase} 800w, ${src1200} 1200w"` : '';
                                    return `
                                    <div class="group min-w-full h-[50vh] lg:h-[70vh] flex items-center justify-center bg-gray-50/20 cursor-zoom-in relative" onclick="openFullscreen(${i})">
                                        <img src="${srcBase}"
                                             ${srcset} sizes="(max-width: 1024px) 100vw, 80vw"
                                             class="max-w-full max-h-full object-contain select-none ${i === 0 ? '' : 'opacity-0'} transition-opacity duration-500"
                                             draggable="false"
                                             ${i === 0 ? 'loading="eager"' : 'loading="lazy"'}
                                             onload="this.classList.remove('opacity-0')"
                                             onerror="this.src='https://picsum.photos/seed/broken/1200/800?grayscale'; this.onerror=null; this.onload=()=>this.classList.remove('opacity-0')">
                                        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300">
                                            <span class="bg-black/80 text-white px-5 py-2.5 rounded-full text-[10px] uppercase tracking-[0.3em] font-bold font-sans backdrop-blur-md shadow-2xl">Pantalla completa</span>
                                        </div>
                                    </div>
                                    `;
                                }).join('')}
                            </div>
                                    
                            <!-- Controls -->
                            <div class="absolute inset-y-0 left-0 flex items-center z-10 pointer-events-none px-2 lg:px-6">
                                <button onclick="stopProp(event); moveCarousel(-1)" class="w-12 h-12 flex items-center justify-center text-black/50 hover:text-black transition-all active:scale-75 pointer-events-auto cursor-pointer drop-shadow-sm">
                                    <span class="text-6xl font-thin leading-none">‹</span>
                                </button>
                            </div>
                            <div class="absolute inset-y-0 right-0 flex items-center z-10 pointer-events-none px-2 lg:px-6">
                                <button onclick="stopProp(event); moveCarousel(1)" class="w-12 h-12 flex items-center justify-center text-black/50 hover:text-black transition-all active:scale-75 pointer-events-auto cursor-pointer drop-shadow-sm">
                                    <span class="text-6xl font-thin leading-none">›</span>
                                </button>
                            </div>
                        </div>
                                
                        <div class="px-0 py-3 flex justify-center items-center gap-4">
                            <p id="carousel-epigraph" class="font-sans text-[10px] md:text-sm leading-relaxed text-gray-400 uppercase tracking-[0.2em] max-w-xl italic text-center">
                                ${typeof fotos[0] === 'object' ? (fotos[0].epigraph || '') : 'Documentación visual.'}
                            </p>
                        </div>
                    ` : `
                        <div class="h-[40vh] bg-gray-50 flex flex-col items-center justify-center text-center gap-4 p-8 border-y border-gray-100">
                             <p class="font-sans text-[10px] uppercase tracking-[0.3em] font-bold text-gray-300">Sin registros visuales disponibles</p>
                        </div>
                    `}
                </div>

                <div class="pt-6">
                    <h2 class="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[1.1] text-black uppercase">${b.name}</h2>
                    <div class="font-sans text-[10px] md:text-sm uppercase tracking-[0.4em] text-gray-400 mt-4 pb-4 border-b border-gray-100 font-bold">
                        ${b.address} • ${b.style}
                    </div>
                </div>

                <!-- DESCRIPCIONES -->
                <div class="grid grid-cols-1 gap-8 py-6">
                    ${standardSecciones.length > 0
                        ? standardSecciones.map(s => `
                            <section class="space-y-3">
                                <h4 class="font-sans text-[10px] font-bold uppercase tracking-[0.5em] text-gray-400">${s.titulo}</h4>
                                <p class="text-xl md:text-2xl leading-relaxed text-black/80 font-light">${s.texto}</p>
                            </section>
                        `).join('')
                        : `<section class="space-y-3">
                            <p class="text-xl leading-relaxed text-black/30 italic font-light">Contenido en preparación.</p>
                        </section>`
                    }
                </div>

                ${b.fact ? `
                <div class="pt-6 border-t border-gray-50">
                    <p class="text-2xl md:text-3xl font-serif italic text-gray-400 leading-tight">${b.fact}</p>
                </div>
                ` : ''}

                <!-- CRÉDITOS DEDICADOS -->
                ${creditosSec ? `
                <div class="pt-8 mt-4 border-t border-gray-50/50 space-y-3">
                    <h4 class="font-sans text-[10px] font-bold uppercase tracking-[0.5em] text-gray-400">CRÉDITOS</h4>
                    <p class="font-sans text-lg md:text-xl text-black/80 font-light leading-relaxed tracking-wide">
                        ${formatCredits(creditosSec.texto)}
                    </p>
                </div>
                ` : ''}

                <!-- UBICACIÓN -->
                <div class="space-y-4 pt-12 pb-32">
                    <div class="flex items-center gap-4">
                        <div class="h-px flex-1 bg-gray-50"></div>
                        <h4 class="font-sans text-[10px] md:text-[11px] font-bold uppercase tracking-[0.5em] text-gray-300 whitespace-nowrap">Patrimonios en el mapa</h4>
                        <div class="h-px flex-1 bg-gray-50"></div>
                    </div>
                    <div id="map-detail" class="h-[400px] w-full shadow-inner rounded-3xl border border-gray-100 overflow-hidden grayscale contrast-125"></div>
                </div>
            </div>
        `;        window.currentPhotos = fotos;

        setTimeout(() => {
            initDetailMap(b.lat, b.lng, b.name);
        }, 500);

    } catch (e) {
        console.error('Error al ver detalle', e);
    }
}

function moveCarousel(direction) {
    const fotos = window.currentPhotos || [];
    if (fotos.length < 2) return;

    currentPhotoIndex = (currentPhotoIndex + direction + fotos.length) % fotos.length;
    const track = document.getElementById('carousel-track');
    const epigraph = document.getElementById('carousel-epigraph');

    if (track) {
        track.style.transform = `translateX(-${currentPhotoIndex * 100}%)`;
    }
    if (epigraph) {
        const current = fotos[currentPhotoIndex];
        epigraph.textContent = typeof current === 'object' ? current.epigraph : 'Documentación visual.';
    }
}

function closeDetail(shouldGoBackHistory = true) {
    if (shouldGoBackHistory && !window.isPopStateRunning && window.history.state && window.history.state.detailId) {
        window.history.back();
        return;
    }

    const header = document.getElementById('main-header');
    if (header) header.style.transform = 'translateY(0)';
    
    const panel = document.getElementById('detail-panel');
    if (!panel) return;
    
    // Scale down and fade out
    panel.classList.remove('scale-100', 'opacity-100');
    panel.classList.add('scale-95', 'opacity-0');
    
    // Enable background scrolling if fullscreen is not shown
    const fullscreenOverlay = document.getElementById('fullscreen-overlay');
    const isFullscreenVisible = fullscreenOverlay && !fullscreenOverlay.classList.contains('pointer-events-none');
    if (!isFullscreenVisible) {
        document.body.style.overflow = 'auto';
    }

    // Wait for the transition to finish
    setTimeout(() => {
        panel.classList.add('hidden');
    }, 500);

    if (!window.isPopStateRunning && !shouldGoBackHistory) {
         const activeTab = document.querySelector('.tab-content.active')?.id || 'hitos';
         let path = '/';
         if (activeTab === 'inicio') path = '/';
         else if (activeTab === 'hitos') path = '/hitos';
         else if (activeTab === 'mapa') path = '/mapa';
         else if (activeTab === 'informacion') path = '/informacion';
         
         const params = new URLSearchParams(window.location.search);
         params.delete('detalle');
         params.delete('foto');
         const searchStr = params.toString() ? `?${params.toString()}` : '';
         window.history.pushState({ tab: activeTab, year: currentCollectionYear }, '', path + searchStr);
    }

    if (mapGeneral) {
        setTimeout(() => mapGeneral.invalidateSize(), 400);
    }
}

function renderPublicGrid(data = null) {
    if (data === null) data = getActiveBuildings();
    const grid = document.getElementById('buildings-public-grid');
    if (!grid) return;
    
    // Empty state for future collections
    if (data.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-32 text-center space-y-4 animate-in fade-in duration-1000">
                <div class="text-8xl font-thin opacity-5 italic mb-8">Próximamente</div>
                <p class="font-sans text-[10px] uppercase tracking-[0.6em] text-gray-300">Esta colección se encuentra en etapa de investigación.</p>
                <div class="h-px w-24 bg-gray-100 mx-auto mt-12"></div>
            </div>
        `;
        return;
    }
    
    grid.classList.remove('grid-cols-1');
    grid.classList.add('md:grid-cols-2', 'xl:grid-cols-3');

    grid.innerHTML = data.map((b, idx) => {
        const fallback = `https://picsum.photos/seed/${b.id}/600/400?grayscale`;
        const baseSrc = getDriveDirectLink(b.imageUrl, 'w600') || fallback;
        const hasUrl = b.imageUrl && (b.imageUrl.includes('drive.google.com') || b.imageUrl.includes('id='));
        const srcset = hasUrl ? `srcset="${getDriveDirectLink(b.imageUrl, 'w400')} 400w, ${baseSrc} 600w, ${getDriveDirectLink(b.imageUrl, 'w800')} 800w"` : '';
        const lazyAttr = idx < 4 ? 'loading="eager"' : 'loading="lazy"';
        
        return `
        <div onclick="showDetail('${b.id}')" class="group cursor-pointer bg-white p-4 md:p-6 hover:bg-gray-50/50 transition-all duration-300 overflow-hidden relative">
            <div class="space-y-4 h-full">
                <div class="w-full aspect-video overflow-hidden rounded-xl md:rounded-2xl bg-gray-50 shrink-0">
                    <img src="${baseSrc}" ${srcset} sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                         class="w-full h-full object-cover transition-all duration-700 group-hover:scale-105 grayscale opacity-0"
                         alt="${b.name}"
                         ${lazyAttr}
                         onload="this.classList.remove('opacity-0')"
                         onerror="this.src='${fallback}'; this.onerror=null; this.onload=()=>this.classList.remove('opacity-0')">
                </div>
                <div class="py-1 text-center flex-1 min-w-0">
                    <h3 class="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-black uppercase truncate w-full mb-1">${b.name}</h3>
                    <div class="flex flex-col gap-0.5 opacity-40 min-w-0">
                       <p class="font-sans text-[9px] md:text-xs uppercase tracking-widest font-bold truncate">${b.style} — ${b.year}</p>
                       <p class="font-sans text-[9px] md:text-xs uppercase tracking-tight truncate italic font-light">${b.address}</p>
                    </div>
                </div>
            </div>
            <div class="absolute bottom-0 left-6 right-6 h-px bg-gray-50 lg:hidden"></div>
        </div>
        `;
    }).join('');
}

// MAPAS
function initGeneralMap(data = null) {
    if (data === null) data = getActiveBuildings();
    if(!mapGeneral) {
        mapGeneral = L.map('map-general', { 
            zoomControl: false,
            scrollWheelZoom: false 
        }).setView([-34.6037, -58.3816], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mapGeneral);
    }
    
    mapGeneral.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker) mapGeneral.removeLayer(layer);
    });

    data.forEach(b => {
        const m = L.circleMarker([b.lat, b.lng], {
            radius: 8,
            fillColor: "#000",
            color: "#fff",
            weight: 3,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(mapGeneral);
        m.on('click', () => showDetail(b.id, true));
        m.bindPopup(`<b class="font-sans text-[12px] uppercase tracking-widest">${b.name}</b>`, { closeButton: false });
        m.on('mouseover', function() { this.openPopup(); });
        m.on('mouseout', function() { this.closePopup(); });
    });
}

function initDetailMap(lat, lng, name) {
    const mapEl = document.getElementById('map-detail');
    if(!mapEl) return;

    if (mapDetail) {
        mapDetail.remove();
        mapDetail = null;
    }

    mapDetail = L.map('map-detail', { 
        zoomControl: false,
        attributionControl: false 
    }).setView([lat, lng], 16);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mapDetail);
    
    markerDetail = L.circleMarker([lat, lng], {
        radius: 12,
        fillColor: "#000",
        color: "#fff",
        weight: 4,
        opacity: 1,
        fillOpacity: 1
    }).addTo(mapDetail);
    
    setTimeout(() => {
        if (mapDetail) mapDetail.invalidateSize();
    }, 500);
}

const darkVectorStyle = {
    "version": 8,
    "sources": {
        "carto-dark": {
            "type": "raster",
            "tiles": [
                "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            ],
            "tileSize": 256,
            "attribution": "© OpenStreetMap contributors, © CARTO"
        }
    },
    "layers": [
        {
            "id": "carto-dark-layer",
            "type": "raster",
            "source": "carto-dark",
            "minzoom": 0,
            "maxzoom": 20
        }
    ]
};

function initAboutMap(data = null) {
    if (data === null) data = buildings;
    if (!data || data.length === 0) return;
    
    const mapEl = document.getElementById('map-about');
    if (!mapEl) return;

    if (!mapAbout) {
        mapAbout = L.map('map-about', { 
            zoomControl: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            dragging: true,
            attributionControl: false
        }).setView([-34.6037, -58.3816], 13);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapAbout);
    }

    mapAbout.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker) mapAbout.removeLayer(layer);
    });

    data.forEach(b => {
        const m = L.circleMarker([b.lat, b.lng], {
            radius: 8,
            fillColor: "#000",
            color: "#fff",
            weight: 2,
            opacity: 1,
            fillOpacity: 1
        }).addTo(mapAbout);
        
        m.on('click', () => {
            showTab('hitos', b.collectionYear);
            setTimeout(() => {
                showDetail(b.id, true);
            }, 300);
        });
        
        m.bindPopup(`<b class="font-sans text-[12px] uppercase tracking-widest text-[#0f131b] px-0.5 font-bold">${b.name}</b>`, { closeButton: false, offset: [0, -5] });
        m.on('mouseover', function() { this.openPopup(); });
        m.on('mouseout', function() { this.closePopup(); });
    });
}

function initFullPageMap() {
    if (!buildings || buildings.length === 0) return;
    
    if (!mapFullPage) {
        mapFullPage = L.map('map-fullpage', { 
            zoomControl: false,
            scrollWheelZoom: true 
        }).setView([-34.6037, -58.3816], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mapFullPage);
        L.control.zoom({ position: 'bottomright' }).addTo(mapFullPage);
    }
    
    mapFullPage.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker) mapFullPage.removeLayer(layer);
    });

    buildings.forEach(b => {
        const m = L.circleMarker([b.lat, b.lng], {
            radius: 8,
            fillColor: "#000",
            color: "#fff",
            weight: 3,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(mapFullPage);
        
        m.on('click', () => {
            showDetail(b.id, true);
        });
        
        m.bindPopup(`<b class="font-sans text-[12px] uppercase tracking-widest text-black">${b.name}</b>`, { closeButton: false });
        m.on('mouseover', function() { this.openPopup(); });
        m.on('mouseout', function() { this.closePopup(); });
    });
}

// FULLSCREEN LOGIC
function openFullscreen(index, pushHistory = true) {
    const fotos = window.currentPhotos || [];
    if (fotos.length === 0) return;
    
    currentPhotoIndex = index;
    const overlay = document.getElementById('fullscreen-overlay');
    const track = document.getElementById('fullscreen-track');
    window.isFullscreenOpen = true;

    if (pushHistory && !window.isPopStateRunning) {
        const activeTab = document.querySelector('.tab-content.active')?.id || 'hitos';
        let path = '/';
        if (activeTab === 'inicio') path = '/';
        else if (activeTab === 'hitos') path = '/hitos';
        else if (activeTab === 'mapa') path = '/mapa';
        else if (activeTab === 'informacion') path = '/informacion';
        
        const params = new URLSearchParams(window.location.search);
        params.set('detalle', window.currentBuildingId || '');
        params.set('foto', index);
        
        window.history.pushState({ 
            tab: activeTab, 
            year: currentCollectionYear, 
            detailId: window.currentBuildingId, 
            fullscreenIndex: index 
        }, '', `${path}?${params.toString()}`);
    }
    
        track.innerHTML = fotos.map(f => {
            const urlStr = typeof f === 'string' ? f : f.url;
            const srcBase = getDriveDirectLink(urlStr, 'w1200');
            const src800 = getDriveDirectLink(urlStr, 'w800');
            const srcMax = getDriveDirectLink(urlStr, 'w2000');
            const hasUrl = urlStr && (urlStr.includes('drive.google.com') || urlStr.includes('id='));
            const srcset = hasUrl ? `srcset="${src800} 800w, ${srcBase} 1200w, ${srcMax} 2000w"` : '';
            return `
                <div class="min-w-full h-full flex items-center justify-center bg-transparent">
                    <img src="${srcBase}"
                         ${srcset} sizes="100vw"
                         class="max-w-full max-h-full m-auto object-contain select-none shadow-[20px_20px_60px_rgba(0,0,0,0.6)] opacity-0 transition-opacity duration-500"
                         draggable="false"
                         loading="lazy"
                         onload="this.classList.remove('opacity-0')"
                         onerror="this.src='https://picsum.photos/seed/broken/1600/1200?grayscale'; this.onerror=null; this.onload=()=>this.classList.remove('opacity-0')">
                </div>
            `;
        }).join('');

        // Navigation controls
        const existingControls = overlay.querySelector('.fullscreen-controls');
        if (existingControls) existingControls.remove();

        const controls = document.createElement('div');
        controls.className = "fullscreen-controls absolute inset-0 flex items-center justify-between z-20 pointer-events-none px-4 lg:px-12";
        controls.innerHTML = `
            <button onclick="moveFullscreenCarousel(-1)" class="w-24 h-24 flex items-center justify-center text-white/50 hover:text-white transition-all text-8xl font-thin select-none cursor-pointer pointer-events-auto active:scale-75 drop-shadow-md">‹</button>
            <button onclick="moveFullscreenCarousel(1)" class="w-24 h-24 flex items-center justify-center text-white/50 hover:text-white transition-all text-8xl font-thin select-none cursor-pointer pointer-events-auto active:scale-75 drop-shadow-md">›</button>
        `;
        overlay.appendChild(controls);
    
    updateFullscreenCarousel();
    overlay.classList.remove('opacity-0', 'pointer-events-none');
    document.body.style.overflow = 'hidden';
}

function closeFullscreen(shouldGoBackHistory = true) {
    if (shouldGoBackHistory && !window.isPopStateRunning && window.history.state && window.history.state.fullscreenIndex !== undefined) {
        window.history.back();
        return;
    }

    window.isFullscreenOpen = false;
    const overlay = document.getElementById('fullscreen-overlay');
    if (overlay) {
        overlay.classList.add('opacity-0', 'pointer-events-none');
    }
    const detailPanel = document.getElementById('detail-panel');
    if (detailPanel && !detailPanel.classList.contains('hidden')) {
        // Keep hidden only if detail is not open (mobile case)
    } else {
        document.body.style.overflow = 'auto';
    }

    if (!window.isPopStateRunning && !shouldGoBackHistory) {
         const activeTab = document.querySelector('.tab-content.active')?.id || 'hitos';
         let path = '/';
         if (activeTab === 'inicio') path = '/';
         else if (activeTab === 'hitos') path = '/hitos';
         else if (activeTab === 'mapa') path = '/mapa';
         else if (activeTab === 'informacion') path = '/informacion';
         
         const params = new URLSearchParams(window.location.search);
         params.delete('foto');
         if (!window.currentBuildingId) {
             params.delete('detalle');
         } else {
             params.set('detalle', window.currentBuildingId);
         }
         const searchStr = params.toString() ? `?${params.toString()}` : '';
         window.history.pushState({ tab: activeTab, year: currentCollectionYear, detailId: window.currentBuildingId }, '', path + searchStr);
    }
}

function moveFullscreenCarousel(direction) {
    const fotos = window.currentPhotos || [];
    if (fotos.length < 2) return;
    
    currentPhotoIndex = (currentPhotoIndex + direction + fotos.length) % fotos.length;
    updateFullscreenCarousel();
}

function updateFullscreenCarousel() {
    const fotos = window.currentPhotos || [];
    const track = document.getElementById('fullscreen-track');
    const info = document.getElementById('fullscreen-info');
    
    if (track) {
        track.style.transform = `translateX(-${currentPhotoIndex * 100}%)`;
    }
    if (info) {
        info.textContent = `${String(currentPhotoIndex + 1).padStart(2, '0')} / ${String(fotos.length).padStart(2, '0')}`;
    }
    
    // Sync back to standard carousel
    const stdTrack = document.getElementById('carousel-track');
    const stdEpigraph = document.getElementById('carousel-epigraph');
    if (stdTrack) stdTrack.style.transform = `translateX(-${currentPhotoIndex * 100}%)`;
    if (stdEpigraph) {
        const current = fotos[currentPhotoIndex];
        stdEpigraph.textContent = typeof current === 'object' ? current.epigraph : 'Documentación visual.';
    }
}

function formatCredits(text) {
    if (!text) return '';
    let normalized = text.replace(/\s+y\s+/gi, ', ').replace(/;/g, ',');
    let parts = normalized.split(',').map(p => p.trim()).filter(Boolean);
    
    let formattedParts = parts.map(name => {
        let words = name.split(/\s+/).filter(Boolean);
        if (words.length === 0) return '';
        if (words.length === 1) return words[0];
        
        let firstName = words[0];
        let lastName = words[words.length - 1];
        let lastNameInitial = lastName[0].toUpperCase() + '.';
        return `${firstName} ${lastNameInitial}`;
    });
    
    if (formattedParts.length === 0) return '';
    if (formattedParts.length === 1) return formattedParts[0];
    if (formattedParts.length === 2) return `${formattedParts[0]} y ${formattedParts[1]}`;
    return formattedParts.slice(0, -1).join(', ') + ` y ${formattedParts[formattedParts.length - 1]}`;
}

function stopProp(e) {
    if(e && e.stopPropagation) e.stopPropagation();
}

// POPSTATE NAVIGATION HANDLER
window.isPopStateRunning = false;

// Set initial state
if (!window.history.state) {
    const p = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const detailId = params.get('detalle');
    const fotoIndexStr = params.get('foto');

    let initialTab = 'inicio';
    if (p === '/hitos') initialTab = 'hitos';
    else if (p === '/mapa') initialTab = 'mapa';
    else if (p === '/informacion') initialTab = 'informacion';
    else if (p === '/muestra') initialTab = 'muestra';

    window.history.replaceState({ 
        tab: initialTab, 
        year: currentCollectionYear,
        detailId: detailId || undefined,
        fullscreenIndex: fotoIndexStr !== null ? parseInt(fotoIndexStr, 10) : undefined
    }, '', window.location.pathname + window.location.search);
}

window.addEventListener('popstate', (event) => {
    window.isPopStateRunning = true;
    try {
        const state = event.state;
        if (state) {
            // Soportar compatibilidad de nombres anteriores por si quedaron en el historial del usuario
            let tabId = state.tab;
            if (tabId === 'tab-home') tabId = 'inicio';
            else if (tabId === 'tab-publico') tabId = 'hitos';
            else if (tabId === 'tab-about') tabId = 'informacion';
            else if (tabId === 'tab-mapa') tabId = 'mapa';

            // 1. Fullscreen coordination
            const fullscreenOverlay = document.getElementById('fullscreen-overlay');
            const isFullscreenCurrentlyOpen = window.isFullscreenOpen || (fullscreenOverlay && !fullscreenOverlay.classList.contains('pointer-events-none'));
            
            if (isFullscreenCurrentlyOpen) {
                if (state.fullscreenIndex === undefined) {
                    closeFullscreen(false);
                } else if (state.fullscreenIndex !== currentPhotoIndex) {
                    openFullscreen(state.fullscreenIndex, false);
                }
            } else if (state.fullscreenIndex !== undefined) {
                openFullscreen(state.fullscreenIndex, false);
            }

            // 2. Detail panel coordination
            const detailPanel = document.getElementById('detail-panel');
            const isDetailCurrentlyOpen = detailPanel && !detailPanel.classList.contains('hidden');
            
            if (isDetailCurrentlyOpen) {
                if (!state.detailId) {
                    closeDetail(false);
                } else if (state.detailId !== window.currentBuildingId) {
                    showDetail(state.detailId, false, false);
                }
            } else if (state.detailId) {
                showDetail(state.detailId, false, false);
            }

            // 3. Main tab coordination
            const currentTabId = document.querySelector('.tab-content.active')?.id;
            if (tabId && tabId !== currentTabId) {
                showTab(tabId, state.year, false);
            }
        } else {
            // Fallback
            closeFullscreen(false);
            closeDetail(false);
            showTab('inicio', null, false);
        }
    } catch (e) {
        console.error('Error handling popstate navigation:', e);
    } finally {
        window.isPopStateRunning = false;
    }
});

loadData();

// Spatial swipe gesture support for mobile devices
(function() {
    let touchStartX = 0;
    let touchStartY = 0;
    const SWIPE_THRESHOLD = 70;

    document.addEventListener('touchstart', (e) => {
        touchStartX = 0;
        touchStartY = 0;

        const activeTab = document.querySelector('.tab-content.active')?.id;
        if (!['inicio', 'informacion', 'muestra'].includes(activeTab)) return;
        
        // Prevent interference with maps, search elements, input forms, overlays or horizontally scrollable containers like carousels
        if (e.target.closest('#map-about') || 
            e.target.closest('.leaflet-container') || 
            e.target.closest('#search-input') || 
            e.target.closest('#detail-container') ||
            e.target.closest('button') ||
            e.target.closest('.overflow-x-auto') ||
            e.target.closest('a')) {
            return;
        }
        
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (!touchStartX || !touchStartY) return;

        const activeTab = document.querySelector('.tab-content.active')?.id;
        if (!['inicio', 'informacion', 'muestra'].includes(activeTab)) return;
        
        if (e.target.closest('#map-about') || 
            e.target.closest('.leaflet-container') || 
            e.target.closest('#search-input') || 
            e.target.closest('#detail-container') ||
            e.target.closest('button') ||
            e.target.closest('.overflow-x-auto') ||
            e.target.closest('a')) {
            return;
        }

        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;

        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;

        // Discard very short taps or noise
        if (Math.abs(diffX) < SWIPE_THRESHOLD && Math.abs(diffY) < SWIPE_THRESHOLD) return;

        const scrollContainer = document.getElementById(activeTab);

        // Determine main axis: Horizontal vs Vertical
        if (Math.abs(diffX) > Math.abs(diffY)) {
            // Horizontal navigation (X-axis)
            if (activeTab === 'inicio' && diffX < -SWIPE_THRESHOLD) {
                // Swipe left -> Pan right to Información
                showTab('informacion');
            } else if (activeTab === 'informacion' && diffX > SWIPE_THRESHOLD) {
                // Swipe right -> Pan left to Inicio
                showTab('inicio');
            }
        } else {
            // Vertical navigation (Y-axis)
            if (activeTab === 'inicio' && diffY < -SWIPE_THRESHOLD) {
                // Swipe up -> Pan down to Muestra
                if (scrollContainer) {
                    const atBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 10;
                    if (!atBottom) return;
                }
                showTab('muestra');
            } else if (activeTab === 'muestra' && diffY > SWIPE_THRESHOLD) {
                // Swipe down -> Pan up to Inicio
                if (scrollContainer) {
                    const atTop = scrollContainer.scrollTop <= 10;
                    if (!atTop) return;
                }
                showTab('inicio');
            }
        }
    }, { passive: true });
})();

// Botón de actualizar — solo visible con ?clave=XXXX en la URL
const _clave = new URLSearchParams(window.location.search).get('clave');
if (_clave) {
    const _btn = document.createElement('button');
    _btn.textContent = 'Actualizar contenido';
    _btn.className = 'fixed bottom-6 right-6 z-[999] bg-black text-white font-sans text-[10px] uppercase tracking-[0.3em] font-bold px-6 py-3 rounded-full shadow-2xl hover:bg-gray-800 transition-all cursor-pointer';
    _btn.onclick = async () => {
        _btn.textContent = 'Actualizando...';
        _btn.disabled = true;
        try {
            const r = await fetch(`/api/refresh?clave=${encodeURIComponent(_clave)}`, { method: 'POST' });
            const d = await r.json();
            if (d.ok) {
                _btn.textContent = '✓ Listo';
                await loadData();
            } else {
                _btn.textContent = 'Clave incorrecta';
            }
        } catch {
            _btn.textContent = 'Error de red';
        }
        setTimeout(() => { _btn.textContent = 'Actualizar contenido'; _btn.disabled = false; }, 2500);
    };
    document.body.appendChild(_btn);
}
