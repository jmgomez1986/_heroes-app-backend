import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { Hero } from '../models/Hero';
import { catalogHeroes, seedHeroes } from '../data/catalog';
import { IHero } from '../dtos/hero.dto';
import { HERO_STATUSES_MESSAGE } from '../constants/default.constants';
import { app } from '../server';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  // Arrange global del archivo: mongo en memoria + data sembrada
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Hero.insertMany(seedHeroes);
}, 60_000);

afterAll(async () => {
  // Limpieza total: sin esto, el proceso de test queda colgado
  await mongoose.disconnect();
  await mongo?.stop();
}, 30_000);

// El numero esperado SIEMPRE deriva del dataset sembrado (misma politica
// que heroes.db.test.ts): si el catalogo cambia, el test sigue siendo
// correcto sin editar assertions. `fold` replica la normalizacion del
// backend (sin acentos, minusculas) para que el esperado mida la semantica
// real del filtro.
const fold = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const matchesName = (term: string) =>
  catalogHeroes.filter((hero: IHero) =>
    fold(hero.name).includes(fold(term)),
  ).length;

const matchesAlias = (term: string) =>
  catalogHeroes.filter((hero: IHero) =>
    fold(hero.alias).includes(fold(term)),
  ).length;

const matchesText = (field: keyof IHero, term: string) =>
  catalogHeroes.filter((hero: IHero) =>
    fold(String(hero[field])).includes(fold(term)),
  ).length;

const matchesExact = (field: keyof IHero, value: string) =>
  catalogHeroes.filter(
    (hero: IHero) => String(hero[field]).toLowerCase() === value.toLowerCase(),
  ).length;

describe('GET /api/heroes filtering', () => {
  it('filters by name with a case-insensitive contains match', async () => {
    // Act
    const res = await request(app).get('/api/heroes?name=bruce');

    // Assert: el count y la pagina reflejan el filtro, no el dataset completo
    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(matchesName('bruce'));
    expect(res.body.data.length).toBe(matchesName('bruce'));
    for (const hero of res.body.data) {
      expect(hero.name.toLowerCase()).toContain('bruce');
    }
  });

  it('filters by alias with a case-insensitive contains match', async () => {
    // Act
    const res = await request(app).get('/api/heroes?alias=super');

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(matchesAlias('super'));
    expect(res.body.data.length).toBe(matchesAlias('super'));
    for (const hero of res.body.data) {
      expect(hero.alias.toLowerCase()).toContain('super');
    }
  });

  it('combines name and alias filters (AND semantics)', async () => {
    // Arrange: "bruce" en name y "batman" en alias solo puede ser Batman
    const expected = catalogHeroes.filter(
      (hero: IHero) =>
        fold(hero.name).includes('bruce') &&
        fold(hero.alias).includes('batman'),
    ).length;

    // Act
    const res = await request(app).get(
      '/api/heroes?name=bruce&alias=batman',
    );

    // Assert
    expect(res.status).toBe(200);
    expect(expected).toBeGreaterThan(0);
    expect(res.body.total_elements).toBe(expected);
    expect(res.body.data.length).toBe(expected);
  });

  it('combines filters with pagination and reports filtered totals', async () => {
    // Arrange: filtro amplio + pagina chica, para ver el count filtrado
    // y el orden determinista (sort por _id) dentro del resultado filtrado
    const elementsPerPage = 2;
    const expected = matchesName('e');
    const expectedSlugs = catalogHeroes
      .filter((hero: IHero) => fold(hero.name).includes('e'))
      .slice(0, elementsPerPage)
      .map((hero: IHero) => hero.slug);

    // Act
    const res = await request(app).get(
      `/api/heroes?name=e&elements_per_page=${elementsPerPage}`,
    );

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(expected);
    expect(res.body.total_pages).toBe(Math.ceil(expected / elementsPerPage));
    expect(res.body.data.length).toBe(
      Math.min(elementsPerPage, expected),
    );
    expect(res.body.data.map((hero: IHero) => hero.slug)).toEqual(
      expectedSlugs,
    );
  });

  it('returns empty data and zero totals when nothing matches', async () => {
    // Act
    const res = await request(app).get('/api/heroes?name=zzz-no-match');

    // Assert: pagina vacia con metadata real, como en el caso page>totalPages
    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(0);
    expect(res.body.total_pages).toBe(0);
    expect(res.body.data).toEqual([]);
  });

  it('treats regex special characters as literal text', async () => {
    // Act: '(' invalida la regex de MongoDB si llega cruda al $regex
    // (500). Con el escape, es texto literal y nadie lo contiene: 200 + vacio
    const res = await request(app).get('/api/heroes?name=bat(');

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(0);
    expect(res.body.data).toEqual([]);
  });

  it('filters by team with a case-insensitive contains match', async () => {
    // Act
    const res = await request(app).get('/api/heroes?team=vengadores');

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(matchesText('team', 'vengadores'));
    expect(res.body.total_elements).toBeGreaterThan(0);
    for (const hero of res.body.data) {
      expect(fold(hero.team)).toContain('vengadores');
    }
  });

  it('filters by universe with a case-insensitive contains match', async () => {
    // Act
    const res = await request(app).get('/api/heroes?universe=marvel');

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(matchesText('universe', 'marvel'));
    expect(res.body.total_elements).toBeGreaterThan(0);
    for (const hero of res.body.data) {
      expect(fold(hero.universe)).toContain('marvel');
    }
  });

  it('ignores a leading article in the filter term', async () => {
    // Arrange: con match "contains", sacar el articulo solo puede ampliar
    const expected = matchesText('team', 'vengadores');

    // Act
    const res = await request(app).get('/api/heroes?team=los%20vengadores');

    // Assert
    expect(res.status).toBe(200);
    expect(expected).toBeGreaterThan(0);
    expect(res.body.total_elements).toBe(expected);
  });

  it('matches accented stored values when the query has no accents', async () => {
    // Arrange: el catalogo guarda "Jovenes Titanes" con acento en la o
    const expected = matchesText('team', 'jovenes');

    // Act
    const res = await request(app).get('/api/heroes?team=jovenes');

    // Assert
    expect(res.status).toBe(200);
    expect(expected).toBeGreaterThan(0);
    expect(res.body.total_elements).toBe(expected);
    expect(res.body.data.map((hero: IHero) => hero.team)).toContain(
      'Jóvenes Titanes',
    );
  });

  it('matches accented alias values when the query has no accents', async () => {
    // Act
    const res = await request(app).get('/api/heroes?alias=fenix');

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(matchesAlias('fenix'));
    expect(res.body.total_elements).toBeGreaterThan(0);
    expect(res.body.data.map((hero: IHero) => hero.alias)).toContain('Fénix');
  });

  it('filters by status with an exact case-insensitive match', async () => {
    // Act
    const res = await request(app).get('/api/heroes?status=active');

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(matchesExact('status', 'Active'));
    expect(res.body.total_elements).toBeGreaterThan(0);
    for (const hero of res.body.data) {
      expect(hero.status).toBe('Active');
    }
  });

  it('rejects a status outside the enum domain with 400', async () => {
    // Act: "activ" es un prefijo de "Active", no un valor del dominio
    const res = await request(app).get('/api/heroes?status=activ');

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errors[0].msg).toBe(HERO_STATUSES_MESSAGE);
  });

  it('filters by category with an exact case-insensitive match', async () => {
    // Act
    const res = await request(app).get('/api/heroes?category=villain');

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(matchesExact('category', 'Villain'));
    expect(res.body.total_elements).toBeGreaterThan(0);
    for (const hero of res.body.data) {
      expect(hero.category).toBe('Villain');
    }
  });

  it('filters by anti-hero category', async () => {
    // Act: harley quinn es la anti-heroina del catalogo sembrado
    const res = await request(app).get('/api/heroes?category=anti-hero');

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(matchesExact('category', 'Anti-hero'));
    expect(res.body.total_elements).toBeGreaterThan(0);
    for (const hero of res.body.data) {
      expect(hero.category).toBe('Anti-hero');
    }
  });

  it('omits the category "all" selector and returns the whole catalog', async () => {
    // Act: "all" es el radio "Todos" del front; no debe filtrar por una
    // categoria inexistente, debe comportarse como un GET sin ese param
    const res = await request(app).get('/api/heroes?category=all');

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(catalogHeroes.length);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('keeps the other filters when category is "all"', async () => {
    // Act: omitir "all" no puede desactivar el resto de los filtros (AND)
    const res = await request(app).get('/api/heroes?category=all&status=active');

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(matchesExact('status', 'Active'));
    expect(res.body.total_elements).toBeGreaterThan(0);
    for (const hero of res.body.data) {
      expect(hero.status).toBe('Active');
    }
  });

  it('omits the category "all" selector regardless of casing', async () => {
    // Act: el resto del filtro exacto es case-insensitive ($options: 'i'),
    // asi que "ALL" tampoco debe caer en una categoria inexistente
    const res = await request(app).get('/api/heroes?category=ALL');

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(catalogHeroes.length);
  });

  it('combines text and exact filters (AND semantics)', async () => {
    // Arrange
    const expected = catalogHeroes.filter(
      (hero: IHero) =>
        fold(hero.universe).includes('dc') &&
        hero.status.toLowerCase() === 'active',
    ).length;

    // Act
    const res = await request(app).get('/api/heroes?universe=DC&status=Active');

    // Assert
    expect(res.status).toBe(200);
    expect(expected).toBeGreaterThan(0);
    expect(res.body.total_elements).toBe(expected);
  });

  it('ignores query params outside the filterable whitelist', async () => {
    // Act: 'description' queda fuera de la whitelist por decision de diseño.
    // El param desconocido no filtra y no rompe: responde el dataset completo
    const res = await request(app).get(
      '/api/heroes?description=traje%20de%20murcielago',
    );

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(catalogHeroes.length);
  });
});
