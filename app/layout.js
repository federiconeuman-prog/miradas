// Proyecto Miradas - Layout principal
export const metadata = {
  title: 'Proyecto Miradas 2026',
  description: 'Exploración interactiva del patrimonio arquitectónico de Buenos Aires con cartografía integrada y registros visuales detallados.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Inter:wght@100..900&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: `
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body { 
            font-family: 'Cormorant Garamond', serif; 
            background-color: #fdfdfb;
            color: #1a1a1a;
          }
          .font-sans { 
            font-family: 'Inter', sans-serif; 
          }
          .font-display { 
            font-family: 'Playfair Display', serif; 
          }
          #map-general, #map-detail { 
            border-radius: 1rem; 
            filter: grayscale(1) contrast(1.1); 
          }
          .tab-content { 
            display: none; 
          }
          .tab-content.active { 
            display: block; 
          }
          .welcome-bg { 
            background: linear-gradient(rgba(253, 253, 251, 0.95), rgba(253, 253, 251, 0.8)), 
                        url('https://upload.wikimedia.org/wikipedia/commons/e/ea/Plano_de_la_Ciudad_de_Buenos_Aires_-_1900.jpg') center/cover;
          }
          .retro-overlay {
            position: fixed;
            inset: 0;
            pointer-events: none;
            background: url('https://www.transparenttextures.com/patterns/natural-paper.png');
            opacity: 0.15;
            z-index: 1000;
          }
          .letter {
            position: relative;
            color: #000;
            transition: color 0.3s;
          }
          .letter::before {
            content: attr(data-letter);
            position: absolute;
            inset: 0;
            color: transparent;
            background-image: var(--img);
            background-size: cover;
            background-position: center;
            -webkit-background-clip: text;
            background-clip: text;
            opacity: 0;
            transition: opacity 0.5s;
            pointer-events: none;
          }
          .letter:hover {
            color: rgba(0,0,0,0.1);
          }
          .letter:hover::before {
            opacity: 1;
          }
          .leaflet-container {
            background: #f5f5f5;
          }
        `}} />
      </head>
      <body style={{ backgroundColor: '#fdfdfb', color: '#1a1a1a', fontFamily: "'Cormorant Garamond', serif" }}>
        {children}
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" defer></script>
      </body>
    </html>
  );
}
