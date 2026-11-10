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
