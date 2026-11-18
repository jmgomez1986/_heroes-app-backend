import heroesJson from './heroes-full-alias.json';
import { IHero } from '../dtos/hero.dto';
import { HERO_STATUSES, HeroStatus } from '../constants/default.constants';

const isHeroStatus = (value: string): value is HeroStatus =>
  (HERO_STATUSES as readonly string[]).includes(value);

// El JSON infiere `status` como `string` (TS widen-ea los literales), asi que
// el dominio del enum no se puede verificar en compilacion. Se verifica aca,
// al importar el catalogo: un valor fuera del dominio rompe seed y tests con
// el slug culpable en el mensaje, en vez de reventar en la primera escritura
// a Mongo. El resto de los campos sigue verificado por el compilador.
export const catalogHeroes: IHero[] = heroesJson.map((hero) => {
  if (!isHeroStatus(hero.status)) {
    throw new Error(
      `Invalid status '${hero.status}' in catalog for '${hero.slug}'.`,
    );
  }
  return { ...hero, status: hero.status };
});

// El dataset listo para persistir: _ids explicitos para que el
// sort({ _id: 1 }) sea deterministico en seed y en tests
const padId = (index: number) => String(index + 1).padStart(24, '0');
export const seedHeroes = catalogHeroes.map((h, i) => ({
  ...h,
  _id: padId(i),
}));
