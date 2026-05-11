let buildings = [];
let mapGeneral, mapDetail, markerDetail;
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
        renderCollection();
    } catch (err) {
        console.error('Error cargando datos', err);
    }
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
        const src = getDriveDirectLink(collections[year].imagen);
        if (!src) return resolve();
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve;
        img.src = src;
    })));

    container.innerHTML = years.map(year => {
        const c = collections[year];
        const src = getDriveDirectLink(c.imagen);
        const isActive = c.estado === 'activo';
        return `
            <button ${isActive ? `onclick="showTab('tab-publico', ${year})"` : ''} class="group relative flex flex-col items-center p-12 md:p-16 overflow-hidden rounded-2xl ${isActive ? 'cursor-pointer' : 'opacity-20 grayscale cursor-default pointer-events-none'}">
                <!-- Project Image Reveal -->
                <div class="absolute inset-2 opacity-0 group-hover:opacity-60 transition-all duration-1000 pointer-events-none overflow-hidden grayscale">
                    <img src="${src}"
                         class="w-full h-full object-cover scale-150 group-hover:scale-110 transition-transform duration-[8000ms] ease-out"
                         alt="${c.titulo || 'Proyecto Miradas'}">
                </div>

                <!-- Framing corners -->
                <div class="absolute top-0 left-0 w-8 h-8 border-t border-l border-black/10 group-hover:border-black/40 transition-all duration-500 z-10"></div>
                <div class="absolute top-0 right-0 w-8 h-8 border-t border-r border-black/10 group-hover:border-black/40 transition-all duration-500 z-10"></div>
                <div class="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-black/10 group-hover:border-black/40 transition-all duration-500 z-10"></div>
                <div class="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-black/10 group-hover:border-black/40 transition-all duration-500 z-10"></div>

                <div class="relative flex flex-col items-center gap-4 z-10">
                    <span class="font-sans font-bold text-7xl md:text-9xl tracking-tighter transition-all duration-500">
                        ${year}
                    </span>
                    <span class="font-sans text-[10px] uppercase tracking-[0.6em] font-bold opacity-30 group-hover:opacity-100 transition-all duration-500">${c.titulo || 'PROYECTO MIRADAS'}</span>
                </div>
            </button>
        `;
    }).join('') + `
        <!-- Placeholder for next year -->
        <div class="group relative flex flex-col items-center p-12 md:p-16 opacity-10 grayscale transition-all duration-700 cursor-default">
            <div class="flex flex-col items-center gap-4">
                <span class="font-sans font-bold text-7xl md:text-9xl tracking-tighter">${parseInt(years[0]) + 1}</span>
                <span class="font-sans text-[10px] uppercase tracking-[0.4em] font-bold">Próximamente</span>
            </div>
        </div>
    `;
}

function getActiveBuildings() {
    return buildings.filter(b => String(b.collectionYear) === String(currentCollectionYear));
}

function renderCollection() {
    const data = getActiveBuildings();
    renderPublicGrid(data);
    initGeneralMap(data);
}

function showTab(id, year = null) {
    if (year) {
        currentCollectionYear = year;
        const logo = document.querySelector('#main-header button');
        if (logo) logo.textContent = `MIRADAS '${String(year).slice(-2)}`;
    }

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0,0);
    
    if(id === 'tab-publico') {
        renderCollection();
        if (mapGeneral) {
            setTimeout(() => mapGeneral.invalidateSize(), 300);
        }
    }
}

// BUSCADOR
function handleSearch() {
    const input = document.getElementById('search-input');
    const query = input.value.toLowerCase();
    const suggestionsBox = document.getElementById('search-suggestions');
    
    if (query.length > 0) {
        const filtered = getActiveBuildings().filter(b => 
            b.name.toLowerCase().includes(query) || 
            b.style.toLowerCase().includes(query)
        );
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
function getDriveDirectLink(url) {
    if (!url) return '';
    let match = url.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return `/api/image/${match[1]}`;
    match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return `/api/image/${match[1]}`;
    return url;
}

async function showDetail(id, isFromMap = false) {
    const b = buildings.find(x => x.id === id);
    if (!b) return;

    window.currentBuildingId = id;
    window.isDetailFromMap = isFromMap;

    try {
        const panel = document.getElementById('detail-panel');
        const content = document.getElementById('detail-content');
        const resizer = document.getElementById('split-resizer');
        const gridContainer = document.getElementById('grid-container');

        panel.classList.remove('hidden');
        
        // Efecto de fondo (Link Título/Fondo)
        if (b.bgUrl) {
            panel.style.backgroundImage = `linear-gradient(rgba(255,255,255,0.9), rgba(255,255,255,0.9)), url(${getDriveDirectLink(b.bgUrl)})`;
            panel.style.backgroundSize = 'cover';
            panel.style.backgroundPosition = 'center';
            panel.style.backgroundAttachment = 'fixed';
        } else {
            panel.style.background = 'white';
        }
        
        if (isFromMap) {
            // Full screen mode
            gridContainer.classList.add('hidden');
            if(resizer) resizer.classList.add('hidden');
            panel.style.width = '100%';
            panel.style.flex = '0 0 100%';
        } else {
            // Split screen mode
            gridContainer.classList.remove('hidden');
            if(resizer) {
                resizer.classList.remove('hidden');
                resizer.style.display = 'flex';
            }
            if (window.innerWidth >= 1024) {
                 gridContainer.style.flex = `0 0 ${lastSplitPercentage}%`;
                 gridContainer.style.width = `${lastSplitPercentage}%`;
                 panel.style.flex = `0 0 ${100 - lastSplitPercentage}%`;
                 panel.style.width = `${100 - lastSplitPercentage}%`;
            }
        }
        
        renderPublicGrid(); // Trigger layout update for left side
        
        if(window.innerWidth < 1024) {
            panel.classList.add('fixed', 'inset-0', 'z-[110]', 'w-full', 'bg-white');
            document.body.style.overflow = 'hidden';
            if(resizer) resizer.style.display = 'none';
        } else {
            document.getElementById('general-map-container').classList.add('hidden');
        }

        currentPhotoIndex = 0;
        
        // Persist or fetch current building photos
        window.userBuildingPhotos = window.userBuildingPhotos || {};
        if (!window.userBuildingPhotos[id]) {
            const res = await fetch(`/api/entregas/${id}`);
            const entregaData = await res.json();
            window.userBuildingPhotos[id] = (entregaData && entregaData.fotos && entregaData.fotos.length > 0) ? [...entregaData.fotos] : [];
            // Cache the entrega data too if needed, but here we only care about photos for now
            window.lastEntregaMap = window.lastEntregaMap || {};
            window.lastEntregaMap[id] = entregaData;
        }
        
        const entrega = window.lastEntregaMap ? window.lastEntregaMap[id] : null;
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
                <div class="bg-white/95 backdrop-blur-md pb-4 z-20 flex items-center justify-between lg:static">
                    <div onclick="closeDetail()" class="flex items-center gap-2 text-gray-400 hover:text-black transition-all group font-sans cursor-pointer uppercase text-[10px] md:text-xs tracking-[0.5em] font-bold">
                        <span class="text-xl">←</span>
                        <span class="border-b border-transparent group-hover:border-gray-200 pb-0.5 whitespace-nowrap">Volver</span>
                    </div>
                </div>

                <!-- CAROUSEL FULL-SIZE -->
                <div class="relative bg-white -mx-6 lg:-mx-10 group/carousel-master">
                    ${fotos.length > 0 ? `
                        <div class="relative group/carousel-main overflow-hidden">
                            <div id="carousel-track" class="flex transition-transform duration-1000 cubic-bezier(0.16, 1, 0.3, 1)">
                                ${fotos.map((f, i) => {
                                    const src = getDriveDirectLink(typeof f === 'string' ? f : f.url);
                                    return `
                                    <div class="group min-w-full h-[50vh] lg:h-[70vh] flex items-center justify-center bg-gray-50/20 cursor-zoom-in relative" onclick="openFullscreen(${i})">
                                        <img src="${src}"
                                             class="max-w-full max-h-full object-contain select-none ${i === 0 ? '' : 'opacity-0'} transition-opacity duration-500"
                                             draggable="false"
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
                                <button onclick="stopProp(event); moveCarousel(-1)" class="w-12 h-12 flex items-center justify-center text-black/10 hover:text-black transition-all active:scale-75 pointer-events-auto cursor-pointer">
                                    <span class="text-6xl font-thin leading-none">‹</span>
                                </button>
                            </div>
                            <div class="absolute inset-y-0 right-0 flex items-center z-10 pointer-events-none px-2 lg:px-6">
                                <button onclick="stopProp(event); moveCarousel(1)" class="w-12 h-12 flex items-center justify-center text-black/10 hover:text-black transition-all active:scale-75 pointer-events-auto cursor-pointer">
                                    <span class="text-6xl font-thin leading-none">›</span>
                                </button>
                            </div>
                        </div>
                                
                        <div class="px-0 py-3 flex justify-between items-start gap-4">
                            <p id="carousel-epigraph" class="font-sans text-[10px] md:text-sm leading-relaxed text-gray-400 uppercase tracking-[0.2em] max-w-xl italic">
                                ${typeof fotos[0] === 'object' ? (fotos[0].epigraph || '') : 'Documentación visual.'}
                            </p>
                            
                            <!-- Subida de Imagen -->
                            <div class="flex items-center gap-2">
                                <input type="file" id="local-photo-input" class="hidden" accept="image/*" onchange="handleLocalPhoto(event)">
                                <button onclick="document.getElementById('local-photo-input').click()" class="font-sans text-[10px] uppercase tracking-[0.1em] font-bold text-gray-400 hover:text-black transition-all border border-gray-100 px-5 py-2.5 rounded-full cursor-pointer hover:bg-gray-50">
                                    + Agregar
                                </button>
                            </div>
                        </div>
                    ` : `
                        <div class="h-[40vh] bg-gray-50 flex flex-col items-center justify-center text-center gap-4 p-8 border-y border-gray-100">
                             <input type="file" id="local-photo-input" class="hidden" accept="image/*" onchange="handleLocalPhoto(event)">
                             <button onclick="document.getElementById('local-photo-input').click()" class="font-sans text-[10px] uppercase tracking-[0.3em] font-bold text-gray-400 hover:text-black transition-all border border-gray-200 px-8 py-4 rounded-full cursor-pointer whitespace-nowrap">
                                + Iniciar registro
                             </button>
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
                    ${entrega && entrega.secciones && entrega.secciones.length > 0
                        ? entrega.secciones.map(s => `
                            <section class="space-y-3">
                                <h4 class="font-sans text-[10px] font-bold uppercase tracking-[0.5em] text-gray-400">${s.titulo}</h4>
                                <p class="text-xl md:text-2xl leading-relaxed text-black/80 font-light">${s.texto}</p>
                            </section>
                        `).join('')
                        : `<section class="space-y-3">
                            <p class="text-xl leading-relaxed text-black/30 italic">Contenido en preparación.</p>
                        </section>`
                    }
                </div>

                <div class="pt-6 border-t border-gray-50">
                    <p class="text-2xl md:text-3xl font-serif italic text-gray-400 leading-tight">${b.fact}</p>
                </div>

                <!-- UBICACIÓN -->
                <div class="space-y-5 pt-8 pb-32">
                    <h4 class="font-sans text-[10px] font-bold uppercase tracking-[0.6em] text-gray-400">Mapa</h4>
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

function handleLocalPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const url = e.target.result;
        const newPhoto = { url, epigraph: 'Imagen agregada por el usuario.' };
        
        if (!window.currentPhotos) window.currentPhotos = [];
        window.currentPhotos.push(newPhoto);
        
        if (window.currentBuildingId) {
            window.userBuildingPhotos = window.userBuildingPhotos || {};
            window.userBuildingPhotos[window.currentBuildingId] = window.currentPhotos;
        }
        
        const track = document.getElementById('carousel-track');
        if (track) {
            const index = window.currentPhotos.length - 1;
            const div = document.createElement('div');
            div.className = "group min-w-full h-[50vh] lg:h-[70vh] flex items-center justify-center bg-gray-50/20 cursor-zoom-in relative";
            div.onclick = () => openFullscreen(index);
            div.innerHTML = `
                <img src="${url}" class="max-w-full max-h-full object-contain select-none" draggable="false">
                <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300">
                    <span class="bg-black/80 text-white px-5 py-2.5 rounded-full text-[9px] uppercase tracking-[0.3em] font-bold font-sans backdrop-blur-md shadow-2xl">Pantalla completa</span>
                </div>
            `;
            track.appendChild(div);
            moveCarousel(window.currentPhotos.length - 1 - currentPhotoIndex);
        }
    };
    reader.readAsDataURL(file);
}

function closeDetail() {
    const header = document.getElementById('main-header');
    if (header) header.style.transform = 'translateY(0)';
    
    const panel = document.getElementById('detail-panel');
    const generalMapContainer = document.getElementById('general-map-container');
    const resizer = document.getElementById('split-resizer');
    const gridContainer = document.getElementById('grid-container');
    
    panel.classList.add('hidden');
    if(resizer) resizer.style.display = 'none';

    // Restore grid visibility if it was hidden (full-screen mode)
    gridContainer.classList.remove('hidden');
    if(resizer) resizer.classList.remove('hidden');

    renderPublicGrid(); 

    document.body.style.overflow = 'auto';
    generalMapContainer.classList.remove('hidden'); 
    
    gridContainer.style.flex = '';
    gridContainer.style.width = '';
    panel.style.width = '';
    panel.style.flex = '';

    if(mapGeneral) {
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
    
    const isDetailOpen = !document.getElementById('detail-panel').classList.contains('hidden');
    const isFromMap = window.isDetailFromMap || false;
    
    if (isDetailOpen && window.innerWidth >= 1024 && !isFromMap) {
        grid.classList.remove('md:grid-cols-2', 'xl:grid-cols-3');
        grid.classList.add('grid-cols-1');
    } else {
        grid.classList.remove('grid-cols-1');
        grid.classList.add('md:grid-cols-2', 'xl:grid-cols-3');
    }

    grid.innerHTML = data.map(b => `
        <div onclick="showDetail('${b.id}')" class="group cursor-pointer bg-white p-4 md:p-6 hover:bg-gray-50/50 transition-all duration-300 overflow-hidden relative">
            <div class="${isDetailOpen && !isFromMap ? 'flex items-center gap-4' : 'space-y-4 h-full'}">
                ${isDetailOpen && !isFromMap ? '' : `
                    <div class="w-full aspect-video overflow-hidden rounded-xl md:rounded-2xl bg-gray-50 shrink-0">
                        <img src="${getDriveDirectLink(b.imageUrl) || `https://picsum.photos/seed/${b.id}/800/600?grayscale`}"
                             class="w-full h-full object-cover transition-all duration-700 group-hover:scale-105 grayscale opacity-0"
                             alt="${b.name}"
                             loading="lazy"
                             onload="this.classList.remove('opacity-0')"
                             onerror="this.src='https://picsum.photos/seed/${b.id}/800/600?grayscale'; this.onerror=null; this.onload=()=>this.classList.remove('opacity-0')">
                    </div>
                `}
                <div class="py-1 ${isDetailOpen && !isFromMap ? 'text-left' : 'text-center'} flex-1 min-w-0">
                    <h3 class="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-black uppercase truncate w-full mb-1">${b.name}</h3>
                    <div class="flex flex-col gap-0.5 opacity-40 min-w-0">
                       <p class="font-sans text-[9px] md:text-xs uppercase tracking-widest font-bold truncate">${b.style} — ${b.year}</p>
                       <p class="font-sans text-[9px] md:text-xs uppercase tracking-tight truncate italic font-light">${b.address}</p>
                    </div>
                </div>
            </div>
            <div class="absolute bottom-0 left-6 right-6 h-px bg-gray-50 lg:hidden"></div>
        </div>
    `).join('');
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
        if(mapDetail) mapDetail.invalidateSize();
    }, 500);
}

// FULLSCREEN LOGIC
function openFullscreen(index) {
    const fotos = window.currentPhotos || [];
    if (fotos.length === 0) return;
    
    currentPhotoIndex = index;
    const overlay = document.getElementById('fullscreen-overlay');
    const track = document.getElementById('fullscreen-track');
    
        track.innerHTML = fotos.map(f => {
            const src = getDriveDirectLink(typeof f === 'string' ? f : f.url);
            return `
                <div class="min-w-full h-full flex items-center justify-center bg-transparent">
                    <img src="${src}"
                         class="max-w-full max-h-full m-auto object-contain select-none shadow-[20px_20px_60px_rgba(0,0,0,0.6)] opacity-0 transition-opacity duration-500"
                         draggable="false"
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
            <button onclick="moveFullscreenCarousel(-1)" class="w-24 h-24 flex items-center justify-center text-white/5 hover:text-white transition-all text-8xl font-thin select-none cursor-pointer pointer-events-auto active:scale-75">‹</button>
            <button onclick="moveFullscreenCarousel(1)" class="w-24 h-24 flex items-center justify-center text-white/5 hover:text-white transition-all text-8xl font-thin select-none cursor-pointer pointer-events-auto active:scale-75">›</button>
        `;
        overlay.appendChild(controls);
    
    updateFullscreenCarousel();
    overlay.classList.remove('opacity-0', 'pointer-events-none');
    document.body.style.overflow = 'hidden';
}

function closeFullscreen() {
    const overlay = document.getElementById('fullscreen-overlay');
    overlay.classList.add('opacity-0', 'pointer-events-none');
    if (!document.getElementById('detail-panel').classList.contains('hidden')) {
        // Keep hidden only if detail is not open (mobile case)
    } else {
        document.body.style.overflow = 'auto';
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

function stopProp(e) {
    if(e && e.stopPropagation) e.stopPropagation();
}

loadData();

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
