# Heroes App — Backend

API REST para administrar un catálogo de superhéroes: creación, consulta paginada, edición y borrado. Construida con Express y TypeScript sobre MongoDB (mongoose), con el **slug** como identificador público de cada héroe (ej: `heroes/superman`).

## Stack

| Herramienta | Uso |
|---|---|
| Node.js + Express 5 | Servidor HTTP y routing |
| TypeScript | Tipado estático (`tsc` para compilar, `tsx` en desarrollo) |
| MongoDB + mongoose 9 | Persistencia (cluster en MongoDB Atlas) |
| express-validator | Validación de input en las rutas |
| slug | Generación del slug a partir del alias |
| Cloudinary | Hosting de las imágenes de los héroes (SDK oficial) |
| cors | Whitelist de orígenes para el frontend |

## Puesta en marcha

1. Instalar dependencias: `npm install`
2. Crear tu `.env` a partir de `.env.template` (ver [Variables de entorno](#variables-de-entorno))
3. Levantar en modo desarrollo: `npm run dev`
4. Verificar: `curl http://localhost:4000/api/heroes`

> **Nota sobre CORS**: la API solo acepta requests con `Origin` en la whitelist. Para probar con curl o Postman (que no envían `Origin`), usar `npm run dev:api`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Desarrollo con recarga automática (tsx watch). Solo acepta requests con `Origin` del frontend |
| `npm run dev:api` | Igual que `dev`, pero también acepta requests sin `Origin` (curl, Postman) |
| `npm run build` | Compila a JavaScript en `dist/` |
| `npm start` | Ejecuta la versión compilada desde `dist/` |
| `npm run seed` | **Pisa** la colección `heroes`: borra los datos actuales y carga los 25 héroes de `src/data/heroes-full-alias.json` (restaurar catálogo) |

## Tests

- `npm run test` — corre la suite completa (vitest + supertest)
- `npm run test:coverage` — ídem + reporte HTML en `coverage/` (abrir `coverage/index.html`)

Los tests **no tocan la base de datos real**: los casos que consultan datos corren contra una **MongoDB en memoria** (`mongodb-memory-server`) que se crea y destruye con la suite. `NODE_ENV=test` (lo setea Vitest automáticamente) habilita el CORS para clientes sin `Origin`.

Cobertura actual: validación de GET/POST (`400` con mensajes exactos, incluida la acumulación de errores) y paginación completa del GET (defaults, ventanas exactas por `_id`, última página parcial, página inexistente con metadata intacta y colección vacía).

## Variables de entorno

Definidas en `.env` (no se versiona; usar `.env.template` como guía):

| Variable | Obligatoria | Descripción |
|---|---|---|
| `PORT` | No (default `4000`) | Puerto donde escucha el servidor |
| `MONGODB_URI` | **Sí** | Connection string de MongoDB. Sin esta variable el proceso corta con error claro |
| `MONGODB_USERNAME` / `MONGODB_PASSWORD` | No | Solo como referencia del user de Atlas; la autenticación viaja dentro del `MONGODB_URI` |
| `FRONTEND_URL` | Sí | Origen del frontend autorizado por CORS (ej: `http://localhost:5173`) |
| `CLOUDINARY_NAME` | **Sí** (para upload de imágenes) | Cloud name de la cuenta de Cloudinary |
| `CLOUDINARY_API_KEY` | **Sí** (para upload de imágenes) | API key de Cloudinary |
| `CLOUDINARY_API_SECRET` | **Sí** (para upload de imágenes) | API secret de Cloudinary (secreto: nunca exponer del lado del front) |

## Endpoints

Base URL: `http://localhost:4000/api`

### `GET /heroes` — Listar con paginación

| Query param | Default | Restricción |
|---|---|---|
| `page` | `1` | Entero ≥ 1 |
| `elements_per_page` | `10` | Entero entre 1 y 50 |

**200 OK:**

```json
{
  "total_pages": 1,
  "current_page": 1,
  "elements_per_page": 10,
  "total_elements": 4,
  "data": [
    { "_id": "...", "name": "Clark Kent", "alias": "Superman", "slug": "superman", "powers": ["Súper fuerza"], "...": "..." }
  ]
}
```

Pedir una página más allá de la última devuelve `data: []` con la metadata real, para que el front detecte que llegó al final. Parámetros inválidos (`page=0`, `page=abc`, `elements_per_page=51`) devuelven `400`.

### `POST /heroes` — Crear

Campos requeridos en el body: `name`, `alias`, `description`, `team`, `status`, `category`, `universe`. Opcionales: `powers` (array de strings), `image`.

El **slug se genera automáticamente a partir del alias** (`Superman Prime` → `superman-prime`) y no se acepta del body.

- `201` — creado. Body: `{ "msg": "Hero created correctly.", "response": { ...heroe creado con su slug e _id } }`
- `400` — falta un campo requerido. Body: `{ "errors": [ { "msg": "Description is required", ... } ] }`
- `409` — ya existe un héroe con el mismo alias, o cuyo alias genera el mismo slug

### `PATCH /heroes/:slug` — Editar (semántica parcial)

Solo aplica los campos presentes en el body (whitelist): `description`, `powers`, `team`, `image`, `status`, `category`, `universe`.

Reglas especiales:

- **`name`**: inmutable. Si se envía un valor distinto → `400`
- **`alias`**: editable. Al cambiarlo, **el slug se regenera** para reflejar el alias actual. Si el slug nuevo pertenece a otro héroe → `409`
- Consecuencia: editar el alias invalida la URL anterior (la URL vieja pasa a dar `404`)

- `200` — editado. Body: `{ "msg": "Hero modified correctly", "response": { ...heroe actualizado } }`
- `404` — no existe héroe con ese slug

### `DELETE /heroes/:slug` — Borrar

- `200` — borrado. Body: `{ "msg": "Hero deleted correctly." }`
- `404` — no existe héroe con ese slug

### `POST /heroes/:slug/image` — Subir imagen del héroe

Se consume **después de crear (o editar) el héroe**: el front llama primero al `POST`/`PATCH` de datos y, si salió bien, sube la imagen con el slug del héroe.

El body **no es JSON ni multipart**: es el archivo binario crudo como body entero, con `Content-Type: image/png` o `image/jpeg`. Tamaño máximo: `1MB`.

```js
// Angular / Front
this.http.post(`${apiUrl}/heroes/${slug}/image`, file, {
  headers: { 'Content-Type': file.type },
});
```

- `200` — imagen subida. Body: `{ "msg": "Image uploaded correctly.", "response": { ...heroe actualizado, con image = secure_url de Cloudinary } }`
- `400` — body vacío o no llega como binario
- `404` — no existe héroe con ese slug
- `413` — el body supera el límite de tamaño (`1MB` en la imagen, default de `100KB` en los endpoints JSON)
- `415` — `Content-Type` distinto de PNG/JPEG

## Decisiones de diseño

| Decisión | Motivo |
|---|---|
| **Slug como identificador público** en lugar del `_id` de Mongo | URLs legibles y estables (`heroes/superman` vs `heroes/665f1a2b...`). El `_id` sigue existiendo internamente (se usa para ordenar la paginación) |
| **Unicidad garantizada por índice único en la DB** (`unique: true` en `slug`) | Los checks a nivel app pueden perder una carrera con requests concurrentes; el índice único es la última línea de defensa. Las violaciones (`E11000`) se mapean a `409` en el error handler global |
| **Slug regenerado al editar el alias** | Alias y slug van siempre sincronizados: la URL refleja el alias actual. Aceptamos que editar un alias invalida la URL previa |
| **Alias editable, `name` inmutable** | Un héroe evoluciona ("Supermann" → "Superman Prime"), pero su nombre civil no cambia |
| **Whitelist de campos editables** (nunca copiar `req.body` completo) | Protección contra *mass assignment*: solo los campos autorizados se copian al documento |
| **Check + índice único en dos capas** | El check a nivel app da mensajes amigables (`409` con detalle); el índice garantiza la invariante siempre |
| **Comentarios de código en español, mensajes de API en inglés** | Convención del proyecto: el código se lee en español, la API expone mensajes en inglés |
| **CORS con whitelist y flag `--api`** | En desarrollo solo el origen del frontend consume la API; `dev:api` habilita clientes sin `Origin` para pruebas |
| **Imagen como endpoint separado del CRUD** (`POST /heroes/:slug/image`) | Cloudinary es una API externa con su propio dominio de fallas: si la subida falla, el héroe ya existe y el front reintenta solo la imagen. El `POST`/`PATCH` de datos quedan JSON puro, sin multipart |
| **Imagen como binario crudo (`express.raw`), no multipart** | El body entero es la imagen: no hay que agregar multer/formidable solo para desarmar el sobre multipart. El límite (1MB) lo corta el parser mismo y el handler lo mapea a `413` |
| **`public_id` determinístico en Cloudinary (`heroes-app/<slug>`)** | Re-subir la imagen del mismo slug sobreescribe la anterior sin dejar basura en el bucket, y un futuro delete de héroe sabe la ruta sin guardar campos extra |
| **Body demasiado grande mapeado a `413` en el error handler global** | `express.raw` (imágenes: 1MB) y `express.json` (default 100KB) cortan fuera del handler; sin el mapeo, Express 5 lo delegaba al error handler y quedaba como `500` engañoso |

## Estructura del proyecto

```text
src/
├── config/
│   ├── cloudinary.ts   # Config del SDK de Cloudinary (credenciales del .env)
│   ├── cors.ts        # Whitelist de orígenes (FRONTEND_URL, flag --api)
│   └── db.ts          # Conexión a MongoDB via mongoose
├── constants/
│   └── default.constants.ts   # Defaults de paginación y campos editables
├── data/
│   ├── catalog.ts      # Dataset tipado con IHero + seedHeroes (con _id explícito)
│   └── heroes-full-alias.json   # Catálogo de héroes (única fuente de verdad)
├── dtos/
│   └── hero.dto.ts    # Interfaces IHero e IHeroPageResponse
├── handlers/
│   └── index.ts       # Lógica de los endpoints (addHero, getHeroes, updateHero, deleteHero, addHeroImage)
├── middleware/
│   ├── errors.ts      # Error handler global (E11000 -> 409, body grande -> 413, resto -> 500)
│   └── validation.ts  # Respuesta 400 con los errores de express-validator
├── models/
│   └── Hero.ts        # Schema de mongoose (slug con índice único)
├── routers/
│   └── router.ts      # Rutas + validaciones de input por ruta
├── tests/
│   ├── heroes.test.ts           # Validación de GET/POST (400s, sin DB)
│   ├── heroes.db.test.ts        # Paginación del GET contra Mongo en memoria
│   └── heroes.empty-db.test.ts  # Edge: colección vacía (metadata en cero)
├── server.ts          # Configuración de Express (CORS, JSON, rutas, error handler)
└── index.ts           # Punto de entrada: levanta el server en PORT
```
