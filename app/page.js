'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Script from 'next/script';

export default function Home() {
  const [buildings, setBuildings] = useState([]);
  const [collections, setCollections] = useState({});
  const [currentCollectionYear, setCurrentCollectionYear] = useState(2026);
  const [activeTab, setActiveTab] = useState('tab-home');
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [entregaData, setEntregaData] = useState(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDetailFromMap, setIsDetailFromMap] = useState(false);
  const [userPhotos, setUserPhotos] = useState({});
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  
  const mapGeneralRef = useRef(null);
  const mapDetailRef = useRef(null);
  const lastSplitPercentage = useRef(40);

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        const [buildingsRes, collectionsRes] = await Promise.all([
          fetch('/api/buildings'),
          fetch('/api/collections')
        ]);
        const buildingsData = await buildingsRes.json();
        const collectionsData = await collectionsRes.json();
        setBuildings(buildingsData);
        setCollections(collectionsData);
      } catch (err) {
        console.error('Error cargando datos', err);
      }
    }
    loadData();
  }, []);

  const getActiveBuildings = useCallback(() => {
    return buildings.filter(b => String(b.collectionYear) === String(currentCollectionYear));
  }, [buildings, currentCollectionYear]);

  const getDriveDirectLink = (url) => {
    if (!url) return '';
    let match = url.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return `/api/image/${match[1]}`;
    match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return `/api/image/${match[1]}`;
    return url;
  };

  const showTab = (id, year = null) => {
    if (year) {
      setCurrentCollectionYear(year);
    }
    setActiveTab(id);
    setSelectedBuilding(null);
    setEntregaData(null);
    window.scrollTo(0, 0);
  };

  const showDetail = async (id, fromMap = false) => {
    const b = buildings.find(x => x.id === id);
    if (!b) return;

    setSelectedBuilding(b);
    setIsDetailFromMap(fromMap);
    setCurrentPhotoIndex(0);

    try {
      const res = await fetch(`/api/entregas/${id}`);
      const data = await res.json();
      setEntregaData(data);
    } catch (e) {
      console.error('Error al cargar entrega', e);
      setEntregaData(null);
    }
  };

  const closeDetail = () => {
    setSelectedBuilding(null);
    setEntregaData(null);
  };

  const getCurrentPhotos = () => {
    if (!selectedBuilding) return [];
    const buildingUserPhotos = userPhotos[selectedBuilding.id] || [];
    const entregaPhotos = entregaData?.fotos || [];
    return [...entregaPhotos, ...buildingUserPhotos];
  };

  const photos = getCurrentPhotos();

  const moveCarousel = (direction) => {
    if (photos.length < 2) return;
    setCurrentPhotoIndex(prev => (prev + direction + photos.length) % photos.length);
  };

  const handleLocalPhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedBuilding) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result;
      const newPhoto = { url, epigraph: 'Imagen agregada por el usuario.' };
      setUserPhotos(prev => ({
        ...prev,
        [selectedBuilding.id]: [...(prev[selectedBuilding.id] || []), newPhoto]
      }));
    };
    reader.readAsDataURL(file);
  };

  const markersRef = useRef([]);
  
  // Initialize maps when leaflet is loaded
  useEffect(() => {
    if (!leafletLoaded || typeof window === 'undefined' || !window.L) return;
    if (activeTab !== 'tab-publico' || selectedBuilding) return;
    
    const initGeneralMap = () => {
      const container = document.getElementById('map-general');
      if (!container) return;

      // Create map if it doesn't exist
      if (!mapGeneralRef.current) {
        const map = window.L.map('map-general', { 
          zoomControl: false,
          scrollWheelZoom: false 
        }).setView([-34.6037, -58.3816], 13);
        
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);
        mapGeneralRef.current = map;
      }
      
      // Clear existing markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      const activeBuildings = getActiveBuildings();
      activeBuildings.forEach(b => {
        const m = window.L.circleMarker([b.lat, b.lng], {
          radius: 8,
          fillColor: "#000",
          color: "#fff",
          weight: 3,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(mapGeneralRef.current);
        m.on('click', () => showDetail(b.id, true));
        m.bindPopup(`<b class="font-sans text-[12px] uppercase tracking-widest">${b.name}</b>`, { closeButton: false });
        m.on('mouseover', function() { this.openPopup(); });
        m.on('mouseout', function() { this.closePopup(); });
        markersRef.current.push(m);
      });
    };

    setTimeout(initGeneralMap, 100);
  }, [leafletLoaded, activeTab, selectedBuilding, buildings, currentCollectionYear]);

  // Detail map
  useEffect(() => {
    if (!leafletLoaded || typeof window === 'undefined' || !window.L || !selectedBuilding) return;

    const initDetailMap = () => {
      const container = document.getElementById('map-detail');
      if (!container) return;

      if (mapDetailRef.current) {
        mapDetailRef.current.remove();
        mapDetailRef.current = null;
      }

      const map = window.L.map('map-detail', { 
        zoomControl: false,
        attributionControl: false 
      }).setView([selectedBuilding.lat, selectedBuilding.lng], 16);
      
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);
      
      window.L.circleMarker([selectedBuilding.lat, selectedBuilding.lng], {
        radius: 12,
        fillColor: "#000",
        color: "#fff",
        weight: 4,
        opacity: 1,
        fillOpacity: 1
      }).addTo(map);

      mapDetailRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
    };

    setTimeout(initDetailMap, 300);
  }, [leafletLoaded, selectedBuilding]);

  const years = Object.keys(collections).sort((a, b) => b - a);
  const activeBuildings = getActiveBuildings();

  return (
    <>
      <Script 
        src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        onLoad={() => setLeafletLoaded(true)}
      />
      
      <div className="retro-overlay"></div>

      {/* PANTALLA DE BIENVENIDA */}
      <section 
        className={`tab-content ${activeTab === 'tab-home' ? 'active' : ''} h-screen flex flex-col items-center justify-center text-center welcome-bg px-6`}
      >
        <div className="space-y-4 mb-12 pt-20">
          <h1 
            className="text-[clamp(4rem,20vw,12rem)] font-bold tracking-tighter leading-[0.8] text-black flex justify-center select-none"
            onMouseMove={(e) => {
              const letters = e.currentTarget.querySelectorAll('.letter');
              letters.forEach(letter => {
                const rect = letter.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                letter.style.setProperty('--mouse-x', `${x}px`);
                letter.style.setProperty('--mouse-y', `${y}px`);
              });
            }}
          >
            {'MIRADAS'.split('').map((char, i) => (
              <span 
                key={i} 
                className="letter group relative" 
                data-letter={char}
                style={{ '--img': `url('https://picsum.photos/seed/${char.toLowerCase()}-arch/400/600?grayscale')` }}
              >
                {char}
              </span>
            ))}
          </h1>
          <div className="h-px w-32 bg-black/10 mx-auto"></div>
          <p className="text-sm md:text-lg opacity-40 italic font-sans uppercase tracking-[0.6em]">
            Patrimonio Arquitectónico de Buenos Aires
          </p>
        </div>

        <div className="flex flex-col xl:flex-row gap-12 xl:gap-24 items-center justify-center relative z-10 pt-10">
          {years.length === 0 ? (
            <div className="font-sans text-[10px] uppercase tracking-widest opacity-30">
              Aguardando sincronización de datos...
            </div>
          ) : (
            <>
              {years.map(year => {
                const c = collections[year];
                const src = getDriveDirectLink(c.imagen);
                const isActive = c.estado === 'activo';
                return (
                  <button 
                    key={year}
                    onClick={() => isActive && showTab('tab-publico', year)}
                    className={`group relative flex flex-col items-center p-12 md:p-16 overflow-hidden rounded-2xl ${isActive ? 'cursor-pointer' : 'opacity-20 grayscale cursor-default pointer-events-none'}`}
                  >
                    <div className="absolute inset-2 opacity-0 group-hover:opacity-60 transition-all duration-1000 pointer-events-none overflow-hidden grayscale">
                      <img 
                        src={src}
                        className="w-full h-full object-cover scale-150 group-hover:scale-110 transition-transform duration-[8000ms] ease-out"
                        alt={c.titulo || 'Proyecto Miradas'}
                      />
                    </div>
                    <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-black/10 group-hover:border-black/40 transition-all duration-500 z-10"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-black/10 group-hover:border-black/40 transition-all duration-500 z-10"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-black/10 group-hover:border-black/40 transition-all duration-500 z-10"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-black/10 group-hover:border-black/40 transition-all duration-500 z-10"></div>
                    <div className="relative flex flex-col items-center gap-4 z-10">
                      <span className="font-sans font-bold text-7xl md:text-9xl tracking-tighter transition-all duration-500">
                        {year}
                      </span>
                      <span className="font-sans text-[10px] uppercase tracking-[0.6em] font-bold opacity-30 group-hover:opacity-100 transition-all duration-500">
                        {c.titulo || 'PROYECTO MIRADAS'}
                      </span>
                    </div>
                  </button>
                );
              })}
              <div className="group relative flex flex-col items-center p-12 md:p-16 opacity-10 grayscale transition-all duration-700 cursor-default">
                <div className="flex flex-col items-center gap-4">
                  <span className="font-sans font-bold text-7xl md:text-9xl tracking-tighter">
                    {parseInt(years[0]) + 1}
                  </span>
                  <span className="font-sans text-[10px] uppercase tracking-[0.4em] font-bold">Próximamente</span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* VISTA PUBLICA */}
      <section className={`tab-content ${activeTab === 'tab-publico' ? 'active' : ''} min-h-screen`}>
        <header className="h-[64px] px-6 lg:px-10 border-b border-gray-100 flex justify-between items-center fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md z-[100] transition-transform duration-500">
          <button onClick={() => showTab('tab-home')} className="text-xl font-bold tracking-tighter shrink-0">
            {`MIRADAS '${String(currentCollectionYear).slice(-2)}`}
          </button>
          <div className="flex-1 max-w-lg w-full relative px-4">
            <input 
              type="text" 
              placeholder="Buscar hito..." 
              className="w-full bg-gray-50 px-6 py-2.5 rounded-xl font-sans text-xs outline-none focus:ring-1 focus:ring-black/5 transition-all"
            />
          </div>
          <div className="w-32 hidden md:block"></div>
        </header>

        <main className="max-w-full mx-auto">
          <div className="flex flex-col lg:flex-row h-screen transition-all duration-700 ease-in-out">
            
            {/* Grid de Edificios */}
            <div className={`flex-1 h-full overflow-y-auto p-6 lg:p-10 pt-[80px] lg:pt-[100px] transition-all duration-700 scroll-smooth ${selectedBuilding && isDetailFromMap ? 'hidden' : ''}`}>
              {activeBuildings.length === 0 ? (
                <div className="col-span-full py-32 text-center space-y-4 animate-in fade-in duration-1000">
                  <div className="text-8xl font-thin opacity-5 italic mb-8">Próximamente</div>
                  <p className="font-sans text-[10px] uppercase tracking-[0.6em] text-gray-300">
                    Esta colección se encuentra en etapa de investigación.
                  </p>
                  <div className="h-px w-24 bg-gray-100 mx-auto mt-12"></div>
                </div>
              ) : (
                <div className={`grid gap-12 ${selectedBuilding && !isDetailFromMap ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
                  {activeBuildings.map(b => (
                    <div 
                      key={b.id}
                      onClick={() => showDetail(b.id)}
                      className="group cursor-pointer bg-white p-4 md:p-6 hover:bg-gray-50/50 transition-all duration-300 overflow-hidden relative"
                    >
                      <div className={selectedBuilding && !isDetailFromMap ? 'flex items-center gap-4' : 'space-y-4 h-full'}>
                        {!(selectedBuilding && !isDetailFromMap) && (
                          <div className="w-full aspect-video overflow-hidden rounded-xl md:rounded-2xl bg-gray-50 shrink-0">
                            <img 
                              src={getDriveDirectLink(b.imageUrl) || `https://picsum.photos/seed/${b.id}/800/600?grayscale`}
                              className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105 grayscale"
                              alt={b.name}
                              loading="lazy"
                            />
                          </div>
                        )}
                        <div className={`py-1 flex-1 min-w-0 ${selectedBuilding && !isDetailFromMap ? 'text-left' : 'text-center'}`}>
                          <h3 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-black uppercase truncate w-full mb-1">
                            {b.name}
                          </h3>
                          <div className="flex flex-col gap-0.5 opacity-40 min-w-0">
                            <p className="font-sans text-[9px] md:text-xs uppercase tracking-widest font-bold truncate">
                              {b.style} — {b.year}
                            </p>
                            <p className="font-sans text-[9px] md:text-xs uppercase tracking-tight truncate italic font-light">
                              {b.address}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Mapa General */}
              {!selectedBuilding && (
                <div className="mt-32 pb-20 space-y-12 animate-in fade-in duration-1000">
                  <div className="h-[1px] w-full bg-gray-100"></div>
                  <h2 className="text-6xl font-bold tracking-tight text-center">Cartografía del Patrimonio</h2>
                  <div id="map-general" className="h-[600px] w-full shadow-inner bg-gray-50 border border-gray-100 rounded-[3rem]"></div>
                  <p className="font-sans text-[10px] uppercase tracking-widest text-gray-400 text-center">
                    Explora la distribución espacial de los hitos arquitectónicos
                  </p>
                </div>
              )}
            </div>

            {/* Panel de Detalle */}
            {selectedBuilding && (
              <div className={`bg-white h-full overflow-y-auto animate-in slide-in-from-right-full duration-700 scroll-smooth z-30 pt-[64px] ${isDetailFromMap ? 'w-full' : 'w-full lg:w-[60%] border-l border-gray-100'}`}>
                <div className="px-6 md:px-[6vw] lg:px-[8vw] py-4 space-y-4">
                  {/* Back Link */}
                  <div className="bg-white/95 backdrop-blur-md pb-4 z-20 flex items-center justify-between">
                    <div 
                      onClick={closeDetail}
                      className="flex items-center gap-2 text-gray-400 hover:text-black transition-all group font-sans cursor-pointer uppercase text-[10px] md:text-xs tracking-[0.5em] font-bold"
                    >
                      <span className="text-xl">←</span>
                      <span className="border-b border-transparent group-hover:border-gray-200 pb-0.5 whitespace-nowrap">Volver</span>
                    </div>
                  </div>

                  {/* Carousel */}
                  <div className="relative bg-white -mx-6 lg:-mx-10 group/carousel-master">
                    {photos.length > 0 ? (
                      <>
                        <div className="relative overflow-hidden">
                          <div 
                            className="flex transition-transform duration-1000"
                            style={{ transform: `translateX(-${currentPhotoIndex * 100}%)` }}
                          >
                            {photos.map((f, i) => {
                              const src = getDriveDirectLink(typeof f === 'string' ? f : f.url);
                              return (
                                <div 
                                  key={i}
                                  className="group min-w-full h-[50vh] lg:h-[70vh] flex items-center justify-center bg-gray-50/20 cursor-zoom-in relative"
                                  onClick={() => setIsFullscreen(true)}
                                >
                                  <img 
                                    src={src}
                                    className="max-w-full max-h-full object-contain select-none"
                                    draggable={false}
                                    alt=""
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300">
                                    <span className="bg-black/80 text-white px-5 py-2.5 rounded-full text-[10px] uppercase tracking-[0.3em] font-bold font-sans backdrop-blur-md shadow-2xl">
                                      Pantalla completa
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Controls */}
                          <div className="absolute inset-y-0 left-0 flex items-center z-10 pointer-events-none px-2 lg:px-6">
                            <button 
                              onClick={(e) => { e.stopPropagation(); moveCarousel(-1); }}
                              className="w-12 h-12 flex items-center justify-center text-black/10 hover:text-black transition-all active:scale-75 pointer-events-auto cursor-pointer"
                            >
                              <span className="text-6xl font-thin leading-none">‹</span>
                            </button>
                          </div>
                          <div className="absolute inset-y-0 right-0 flex items-center z-10 pointer-events-none px-2 lg:px-6">
                            <button 
                              onClick={(e) => { e.stopPropagation(); moveCarousel(1); }}
                              className="w-12 h-12 flex items-center justify-center text-black/10 hover:text-black transition-all active:scale-75 pointer-events-auto cursor-pointer"
                            >
                              <span className="text-6xl font-thin leading-none">›</span>
                            </button>
                          </div>
                        </div>

                        <div className="px-0 py-3 flex justify-between items-start gap-4">
                          <p className="font-sans text-[10px] md:text-sm leading-relaxed text-gray-400 uppercase tracking-[0.2em] max-w-xl italic">
                            {typeof photos[currentPhotoIndex] === 'object' ? (photos[currentPhotoIndex].epigraph || 'Documentación visual.') : 'Documentación visual.'}
                          </p>
                          <div className="flex items-center gap-2">
                            <input 
                              type="file" 
                              id="local-photo-input" 
                              className="hidden" 
                              accept="image/*" 
                              onChange={handleLocalPhoto}
                            />
                            <button 
                              onClick={() => document.getElementById('local-photo-input')?.click()}
                              className="font-sans text-[10px] uppercase tracking-[0.1em] font-bold text-gray-400 hover:text-black transition-all border border-gray-100 px-5 py-2.5 rounded-full cursor-pointer hover:bg-gray-50"
                            >
                              + Agregar
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="h-[40vh] bg-gray-50 flex flex-col items-center justify-center text-center gap-4 p-8 border-y border-gray-100">
                        <input 
                          type="file" 
                          id="local-photo-input" 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleLocalPhoto}
                        />
                        <button 
                          onClick={() => document.getElementById('local-photo-input')?.click()}
                          className="font-sans text-[10px] uppercase tracking-[0.3em] font-bold text-gray-400 hover:text-black transition-all border border-gray-200 px-8 py-4 rounded-full cursor-pointer whitespace-nowrap"
                        >
                          + Iniciar registro
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Building Info */}
                  <div className="pt-6">
                    <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[1.1] text-black uppercase">
                      {selectedBuilding.name}
                    </h2>
                    <div className="font-sans text-[10px] md:text-sm uppercase tracking-[0.4em] text-gray-400 mt-4 pb-4 border-b border-gray-100 font-bold">
                      {selectedBuilding.address} • {selectedBuilding.style}
                    </div>
                  </div>

                  {/* Descripciones */}
                  <div className="grid grid-cols-1 gap-8 py-6">
                    {entregaData?.secciones?.length > 0 ? (
                      entregaData.secciones.map((s, i) => (
                        <section key={i} className="space-y-3">
                          <h4 className="font-sans text-[10px] font-bold uppercase tracking-[0.5em] text-gray-400">
                            {s.titulo}
                          </h4>
                          <p className="text-xl md:text-2xl leading-relaxed text-black/80 font-light">
                            {s.texto}
                          </p>
                        </section>
                      ))
                    ) : (
                      <section className="space-y-3">
                        <p className="text-xl leading-relaxed text-black/30 italic">Contenido en preparación.</p>
                      </section>
                    )}
                  </div>

                  <div className="pt-6 border-t border-gray-50">
                    <p className="text-2xl md:text-3xl font-serif italic text-gray-400 leading-tight">
                      {selectedBuilding.fact}
                    </p>
                  </div>

                  {/* Ubicación */}
                  <div className="space-y-5 pt-8 pb-32">
                    <h4 className="font-sans text-[10px] font-bold uppercase tracking-[0.6em] text-gray-400">Mapa</h4>
                    <div id="map-detail" className="h-[400px] w-full shadow-inner rounded-3xl border border-gray-100 overflow-hidden grayscale contrast-125"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </section>

      {/* Fullscreen Overlay */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center"
          onClick={() => setIsFullscreen(false)}
        >
          <div className="absolute top-0 left-0 px-6 lg:px-10 py-4 flex justify-between items-center z-10 w-full bg-gradient-to-b from-black/50 to-transparent">
            <div className="font-sans text-[10px] uppercase tracking-[0.4em] text-white/50 font-bold">
              {String(currentPhotoIndex + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}
            </div>
            <button 
              onClick={() => setIsFullscreen(false)}
              className="font-sans text-[10px] uppercase tracking-[0.4em] font-bold text-white/50 hover:text-white transition-all cursor-pointer flex items-center gap-4 group"
            >
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">Cerrar ventana</span>
              <span className="text-2xl font-light">✕</span>
            </button>
          </div>
          <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
            <div 
              className="flex transition-transform duration-700 h-full w-full"
              style={{ transform: `translateX(-${currentPhotoIndex * 100}%)` }}
            >
              {photos.map((f, i) => {
                const src = getDriveDirectLink(typeof f === 'string' ? f : f.url);
                return (
                  <div key={i} className="min-w-full h-full flex items-center justify-center bg-transparent">
                    <img 
                      src={src}
                      className="max-w-full max-h-full m-auto object-contain select-none shadow-[20px_20px_60px_rgba(0,0,0,0.6)]"
                      draggable={false}
                      alt=""
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-between z-20 pointer-events-none px-4 lg:px-12">
            <button 
              onClick={(e) => { e.stopPropagation(); moveCarousel(-1); }}
              className="w-24 h-24 flex items-center justify-center text-white/5 hover:text-white transition-all text-8xl font-thin select-none cursor-pointer pointer-events-auto active:scale-75"
            >
              ‹
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); moveCarousel(1); }}
              className="w-24 h-24 flex items-center justify-center text-white/5 hover:text-white transition-all text-8xl font-thin select-none cursor-pointer pointer-events-auto active:scale-75"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </>
  );
}
