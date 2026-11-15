export const DEFAULT_PAGE = 1;
export const DEFAULT_ELEMENTS_PER_PAGE = 10;

// Campos que este endpoint permite actualizar. `name` es un campo de
// identidad inmutable y se maneja explicitamente en el handler. `alias` y
// `slug` son editables via logica explicita (el slug se regenera desde el
// alias, con check de colision), por eso NO se listan aca: nunca deben
// copiarse a ciegas desde el body.
export const EDITABLE_FIELDS = [
  'description',
  'powers',
  'team',
  'image',
  'status',
  'category',
  'universe',
];

// Campos filtrables de GET /api/heroes. Coincidencia "contiene,
// case-insensitive" ($regex escapado). Para expandir (team, universe,
// status, category): agregar el campo aca y el router/handler lo toman
// solo. Cuando entren campos numericos (fuerza, inteligencia), subir de
// lista a mapa de config con tipo y rango por campo. La descripcion queda
// excluida por decision de diseño.
export const FILTERABLE_TEXT_FIELDS = ['name', 'alias'] as const;

// Slug valido: minusculas y numeros en "palabras" separadas por guiones
// simples, sin guiones en los bordes. Es exactamente el formato que genera
// la libreria `slug` al crear un heroe, asi que un slug bien formado pero
// inexistente cae en el 404 del handler, nunca en un 400.
export const HERO_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
