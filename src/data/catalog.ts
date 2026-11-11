import heroesJson from './heroes-full-alias.json';
import { IHero } from '../dtos/hero.dto';

// El compilador verifica el JSON contra IHero en cada build:
// si falta un campo o un tipo no coincide, tsc falla
export const catalogHeroes: IHero[] = heroesJson;

// El dataset listo para persistir: _ids explicitos para que el
// sort({ _id: 1 }) sea deterministico en seed y en tests
const padId = (index: number) => String(index + 1).padStart(24, '0');
export const seedHeroes = catalogHeroes.map((h, i) => ({
  ...h,
  _id: padId(i),
}));
