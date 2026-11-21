import type { Request } from 'express';
import {
  ACCENT_VARIANTS,
  FILTERABLE_EXACT_FIELDS,
  FILTERABLE_TEXT_FIELDS,
} from '../constants/default.constants';

// $regex recibe el input del usuario crudo: un caracter especial de regex
// ('bat(', 'a.*') cambiaria el significado de la consulta o la haria
// catastroficamente lenta (ReDoS). Se escapan todos los caracteres
// especiales para que el termino busque como texto literal.
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// $regex ignora la collation de Mongo (docs: "always case-sensitive and
// diacritic-sensitive"), asi que la insensibilidad a acentos se resuelve en
// el patron: el query se reduce a letras base y cada letra se expande a una
// clase con sus variantes. El acento lo aporta el documento guardado, no el
// input: "capitan" matchea "Capitan" y "Capitan" con acento.
const stripDiacritics = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Cada caracter del termino normalizado se vuelve una clase si tiene
// variantes acentuadas, o el literal escapado en cualquier otro caso. No
// agrega cuantificadores, asi que no abre una via nueva de ReDoS.
const buildAccentInsensitivePattern = (term: string) =>
  Array.from(stripDiacritics(term))
    .map((char) => {
      const variants = ACCENT_VARIANTS[char.toLowerCase()];
      return variants ? `[${variants}]` : escapeRegex(char);
    })
    .join('');

// El articulo inicial se ignora solo al principio y solo si queda algo: con
// match "contains" sacarlo puede ampliar el resultado, nunca perderlo
// ("los vengadores" -> "vengadores").
const LEADING_ARTICLE = /^(?:el|la|los|las|lo|the)\s+/i;
const normalizeTerm = (term: string) =>
  term.trim().replace(/\s+/g, ' ').replace(LEADING_ARTICLE, '');

const firstQueryValue = (value: unknown) =>
  String((Array.isArray(value) ? value[0] : value) ?? '');

// Arma el filtro de Mongo desde el query string contra la whitelist. La
// ruta ya valido que cada valor sea string; aca solo se decide si filtra
// (valor no vacio) o se ignora (param fuera de la whitelist o vacio).
export const buildTextFilter = (query: Request['query']) => {
  const filter: Record<string, unknown> = {};
  for (const field of FILTERABLE_TEXT_FIELDS) {
    const term = normalizeTerm(firstQueryValue(query[field]));
    if (term) {
      filter[field] = {
        $regex: buildAccentInsensitivePattern(term),
        $options: 'i',
      };
    }
  }
  return filter;
};

// Valores cerrados (selectores del front): coincidencia exacta,
// case-insensitive. El ancla evita que "activ" filtre "Active".
export const buildExactFilter = (query: Request['query']) => {
  const filter: Record<string, unknown> = {};
  for (const field of FILTERABLE_EXACT_FIELDS) {
    const value = firstQueryValue(query[field]).trim();
    // "all" es el radio "Todos" del front y solo aplica a category; se omite
    // sin importar el casing, igual que el resto del filtro exacto.
    if (value && value.toLowerCase() !== 'all') {
      filter[field] = { $regex: `^${escapeRegex(value)}$`, $options: 'i' };
    }
  }
  return filter;
};
