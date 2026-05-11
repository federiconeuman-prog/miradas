# Guía de carga de contenido — Miradas 2026

## Cómo funciona el sistema

El sitio lee los datos directamente desde un Google Sheets. Para actualizar el contenido, editás el sheet y presionás el botón **"Actualizar contenido"** que aparece en la esquina inferior derecha de la web (solo visible con la URL secreta). El sitio no se actualiza solo: siempre hay que presionar ese botón después de hacer cambios.

---

## Permisos del Sheet y de las imágenes

Tanto el Google Sheets como **cada imagen en Google Drive** deben estar compartidos con la opción **"Cualquiera con el enlace puede ver"**. Si una imagen no tiene ese permiso, no va a aparecer en el sitio.

---

## Estructura del Sheet

El Sheet tiene 4 tipos de pestañas. Los nombres deben ser **exactamente** así, respetando mayúsculas y guiones bajos:

| Pestaña | Para qué sirve |
|---|---|
| `colecciones` | Lista de años/ediciones del proyecto |
| `hitos_2026` | Lista de edificios de la edición 2026 |
| `textos_2026` | Textos descriptivos por edificio |
| `fotos_2026` | Fotos por edificio |

Para agregar una nueva edición (ej. 2027) se agregan las pestañas `hitos_2027`, `textos_2027` y `fotos_2027`, y una nueva fila en `colecciones`.

---

## Pestaña `colecciones`

| Columna | Valores válidos | Notas |
|---|---|---|
| `año` | `2026`, `2027`… | Solo el número, sin texto |
| `titulo` | Cualquier texto | Se muestra debajo del año en la pantalla de inicio |
| `imagen` | Link de Google Drive | La imagen de portada del año (debe tener permiso público) |
| `estado` | `activo` | Escribir exactamente `activo` (minúsculas) para que el año sea accesible. Cualquier otro valor lo muestra como "próximamente" |

---

## Pestaña `hitos_XXXX`

Cada fila es un edificio.

| Columna | Obligatorio | Notas |
|---|---|---|
| `id` | Sí | Identificador único. Solo letras minúsculas, números y guiones (`teatro-colon`, `barolo`). Sin espacios, sin tildes |
| `nombre` | Sí | Nombre completo del edificio |
| `direccion` | Sí | Dirección postal |
| `estilo` | Sí | Estilo arquitectónico |
| `año_construccion` | Sí | Solo el año numérico |
| `hecho_curioso` | Sí | Dato destacado que aparece al pie del detalle |
| `lat` | Sí | Latitud. Usar **punto** como decimal: `-34.6096` ⚠️ |
| `lng` | Sí | Longitud. Usar **punto** como decimal: `-58.3858` ⚠️ |
| `imagen` | No | Link de Google Drive. Es la imagen de la tarjeta |

> ⚠️ **Coordenadas:** Google Sheets puede cambiar el punto decimal por coma automáticamente. Para evitarlo, formateá las columnas `lat` y `lng` como **Texto** (Formato → Número → Texto sin formato) *antes* de escribir los valores.

---

## Pestaña `textos_XXXX`

Cada fila corresponde a un edificio. Los **nombres de las columnas** se convierten en los títulos de las secciones dentro del detalle del edificio.

| Columna | Notas |
|---|---|
| `hito_id` | Debe coincidir exactamente con el `id` del edificio en la pestaña `hitos_XXXX` |
| (nombre libre) | Cada columna extra que agregues se convierte en una sección. El nombre de la columna es el título |

Ejemplo: si la columna se llama `Historia`, en el sitio aparece la sección con título "Historia" y el texto de esa celda como contenido.

---

## Pestaña `fotos_XXXX`

Cada fila es una foto. Un mismo edificio puede tener varias filas.

| Columna | Obligatorio | Notas |
|---|---|---|
| `hito_id` | Sí | Debe coincidir exactamente con el `id` del edificio |
| `url` | Sí | Link de Google Drive de la foto (debe tener permiso público) |
| `epigrafe` | No | Texto que aparece debajo de la foto en el carrusel |

---

## Errores frecuentes

- **El edificio no aparece en el mapa:** El `id` está vacío, o las coordenadas tienen coma en vez de punto como separador decimal.
- **Las fotos no cargan:** La imagen en Drive no tiene permiso "Cualquiera con el enlace puede ver".
- **El año no es accesible:** El campo `estado` en `colecciones` no dice exactamente `activo`.
- **Los textos o fotos no aparecen:** El `hito_id` en la pestaña `textos_XXXX` o `fotos_XXXX` no coincide exactamente con el `id` del edificio (revisar espacios, mayúsculas, tildes).
- **Los cambios no se ven:** Falta presionar el botón "Actualizar contenido" después de editar el sheet.
