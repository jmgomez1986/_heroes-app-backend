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

// Campos filtrables de texto libre de GET /api/heroes. Coincidencia
// "contiene", case-insensitive, acento-insensitive (el acento lo aporta el
// documento guardado) y con el articulo inicial ignorado ("los vengadores"
// matchea "Vengadores"). Sumar un campo aca agrega su validacion y su filtro
// sin tocar el router ni el handler. Cuando entren campos numericos (fuerza,
// inteligencia), subir de lista a mapa de config con tipo y rango por campo.
export const FILTERABLE_TEXT_FIELDS = [
  'name',
  'alias',
  'team',
  'universe',
] as const;

// Campos filtrables de valor cerrado: en el front los elige un selector, asi
// que la comparacion es EXACTA (case-insensitive), no "contiene". `status`
// ademas se valida contra HERO_STATUSES en el router (400 si no pertenece al
// dominio). `description` queda excluida por decision de diseño.
export const FILTERABLE_EXACT_FIELDS = ['category', 'status'] as const;

// Estados validos de un heroe. Fuente unica del dominio: la usan el modelo
// (enum de mongoose), el router (validacion de entrada) y el DTO (tipo). Es
// cerrado a proposito: los contadores de stats agregan por estado, y un valor
// fuera del dominio dejaria registros que no caen en ninguna card.
export const HERO_STATUSES = ['Active', 'Inactive', 'Deceased'] as const;
export type HeroStatus = (typeof HERO_STATUSES)[number];

// Mensaje de error derivado del dominio: agregar un estado no obliga a tocar
// el router ni a mantener dos listas sincronizadas a mano.
export const HERO_STATUSES_MESSAGE = `Status must be one of: ${HERO_STATUSES.join(', ')}`;

// Slug valido: minusculas y numeros en "palabras" separadas por guiones
// simples, sin guiones en los bordes. Es exactamente el formato que genera
// la libreria `slug` al crear un heroe, asi que un slug bien formado pero
// inexistente cae en el 404 del handler, nunca en un 400.
export const HERO_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Content-Types aceptados y su extension para el mensaje de error
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
};

// `n` incluye `ñ` porque stripDiacritics convierte `ñ` -> `n`: sin eso
// "espana" no encontraria "Espana" con virgulilla.
export const ACCENT_VARIANTS: Record<string, string> = {
  a: 'aáàäâã',
  e: 'eéèëê',
  i: 'iíìïî',
  o: 'oóòöôõ',
  u: 'uúùüû',
  n: 'nñ',
};
