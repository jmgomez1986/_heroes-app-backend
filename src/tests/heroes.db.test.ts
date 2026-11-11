import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../server';
import { Hero } from '../models/Hero';
import { catalogHeroes, seedHeroes } from '../data/catalog';
import { IHero } from '../dtos/hero.dto';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  // Arrange global del archivo: mongo en memoria + data sembrada
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  // _ids explicitos: el handler ordena por _id, asi que fijandolos vos
  // el orden es deterministico y las assertions de paginacion son exactas
  await Hero.insertMany(seedHeroes);
}, 60_000);

afterAll(async () => {
  // Limpieza total: sin esto, el proceso de test queda colgado
  await mongoose.disconnect();
  await mongo?.stop(); // optional chaining: si el before fallo, no explota
}, 30_000);

describe('GET /api/heroes', () => {
  it('applies defaults values on page and elements_per_page when there are no query parameters', async () => {
    // Arrange: la DB ya esta sembrada en el beforeAll con 25 heroes en memoria

    // Act: request sin query params, directo contra el app
    const res = await request(app).get('/api/heroes');

    // Assert: status, shape completo y defaults aplicados.
    // Los numeros derivan del dataset, no estan hardcodeados
    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(catalogHeroes.length);
    expect(res.body.current_page).toBe(1);
    expect(res.body.elements_per_page).toBe(10);
    expect(res.body.total_pages).toBe(Math.ceil(catalogHeroes.length / 10));
  });

  it('returns exact result with correct params', async () => {
    const page = 2;
    const elementsPerPage = 10;
    const totalPages = Math.ceil(catalogHeroes.length / elementsPerPage);

    const res = await request(app).get(
      `/api/heroes?page=${page}&elements_per_page=${elementsPerPage}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(catalogHeroes.length);
    expect(res.body.current_page).toBe(page);
    expect(res.body.elements_per_page).toBe(elementsPerPage);
    expect(res.body.total_pages).toBe(totalPages);
    expect(res.body.data.length).toBe(elementsPerPage);
    expect(res.body.data.map((hero: IHero) => hero.slug)).toEqual(
      catalogHeroes.slice(10, 20).map((hero: IHero) => hero.slug),
    );
  });

  it('returns last page with partial content', async () => {
    const page = 3;
    const elementsPerPage = 10;
    const totalPages = Math.ceil(catalogHeroes.length / elementsPerPage);

    const res = await request(app).get(
      `/api/heroes?page=${page}&elements_per_page=${elementsPerPage}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(catalogHeroes.length);
    expect(res.body.current_page).toBe(page);
    expect(res.body.elements_per_page).toBe(elementsPerPage);
    expect(res.body.total_pages).toBe(totalPages);
    expect(res.body.data.length).toBe(catalogHeroes.length % elementsPerPage);
    expect(res.body.data.map((hero: IHero) => hero.slug)).toEqual(
      catalogHeroes.slice(20, 30).map((h) => h.slug),
    );
  });

  it('returns empty data when the page does not exist', async () => {
    const page = 99;
    const elementsPerPage = 10;
    const totalPages = Math.ceil(catalogHeroes.length / elementsPerPage);

    const res = await request(app).get(
      `/api/heroes?page=${page}&elements_per_page=${elementsPerPage}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(catalogHeroes.length);
    expect(res.body.current_page).toBe(page);
    expect(res.body.elements_per_page).toBe(elementsPerPage);
    expect(res.body.total_pages).toBe(totalPages);
    expect(res.body.data).toEqual([]);
  });

  it('returns data without "__v"', async () => {
    const page = 1;
    const elementsPerPage = 10;
    const totalPages = Math.ceil(catalogHeroes.length / elementsPerPage);

    const res = await request(app).get(
      `/api/heroes?page=${page}&elements_per_page=${elementsPerPage}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(catalogHeroes.length);
    expect(res.body.current_page).toBe(page);
    expect(res.body.elements_per_page).toBe(elementsPerPage);
    expect(res.body.total_pages).toBe(totalPages);
    expect(res.body.data.length).toEqual(10);
    expect(res.body.data[0]).not.toHaveProperty('__v');
  });
});
