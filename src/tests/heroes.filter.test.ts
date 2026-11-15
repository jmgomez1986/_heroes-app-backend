import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { Hero } from '../models/Hero';
import { catalogHeroes, seedHeroes } from '../data/catalog';
import { IHero } from '../dtos/hero.dto';
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
// correcto sin editar assertions
const matchesName = (term: string) =>
  catalogHeroes.filter((hero: IHero) =>
    hero.name.toLowerCase().includes(term.toLowerCase()),
  ).length;

const matchesAlias = (term: string) =>
  catalogHeroes.filter((hero: IHero) =>
    hero.alias.toLowerCase().includes(term.toLowerCase()),
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
        hero.name.toLowerCase().includes('bruce') &&
        hero.alias.toLowerCase().includes('batman'),
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
      .filter((hero: IHero) => hero.name.toLowerCase().includes('e'))
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

  it('ignores query params outside the filterable whitelist', async () => {
    // Act: 'team' NO es filtrable todavia (decision: solo name y alias por
    // ahora). El param desconocido no filtra y no rompe: responde el
    // dataset completo
    const res = await request(app).get(
      '/api/heroes?team=Liga%20de%20la%20Justicia',
    );

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(catalogHeroes.length);
  });
});
