import './globals.css';

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
    <html lang="es" className="bg-white">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Inter:wght@100..900&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-white text-black font-serif">
        {children}
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" defer></script>
      </body>
    </html>
  );
}
