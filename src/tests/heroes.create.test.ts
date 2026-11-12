import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../server';
import { Hero } from '../models/Hero';
import { seedHeroes } from '../data/catalog';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  // Arrange global: mongo en memoria + data sembrada.
  // La semilla importa: los proximos 409 por duplicado van a chocar
  // contra estos heroes
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Hero.insertMany(seedHeroes);
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
}, 30_000);

describe('POST /api/heroes', () => {
  it('creates a hero and generates the slug from the alias', async () => {
    // Arrange: un heroe nuevo, valido, cuyo alias tiene espacios
    // (asi el test prueba la transformacion alias -> slug, no la pasividad)
    const newHero = {
      name: 'Kal-El Prime',
      alias: 'Superman Prime',
      description: 'The Last Son of Krypton, prime version.',
      team: 'Liga de la Justicia',
      status: 'Active',
      category: 'Hero',
      universe: 'DC',
    };

    // Act
    const res = await request(app).post('/api/heroes').send(newHero);

    // Assert: el contrato del 201 segun tu handler
    expect(res.status).toBe(201);
    expect(res.body.msg).toBe('Hero created correctly.');
    // El slug NO viaja en el body: lo genera el backend a partir del alias
    expect(res.body.response.slug).toBe('superman-prime');
    // El _id existe: Mongo lo asigno al guardar
    expect(res.body.response._id).toBeDefined();
  });

  it('returns the complete hero document in the response', async () => {
    // Arrange: otro heroe valido (cada test crea el suyo para no
    // depender del orden de ejecucion entre tests)
    const newHero = {
      name: 'Bruce Wayne Prime',
      alias: 'Batman Prime',
      description: 'The Dark Knight, prime version.',
      team: 'Liga de la Justicia',
      status: 'Active',
      category: 'Hero',
      universe: 'DC',
    };

    // Act
    const res = await request(app).post('/api/heroes').send(newHero);

    // Assert: todos los campos del documento, no solo el slug.
    // toMatchObject afirma un subconjunto sin fijar el documento entero
    expect(res.status).toBe(201);
    expect(res.body.response).toMatchObject({
      name: 'Bruce Wayne Prime',
      alias: 'Batman Prime',
      slug: 'batman-prime',
      description: 'The Dark Knight, prime version.',
      team: 'Liga de la Justicia',
      status: 'Active',
      category: 'Hero',
      universe: 'DC',
      powers: [],
    });
    // La imagen NO existe como campo hasta que se sube: el schema no la
    // crea con default, el POST /:slug/image es quien la agrega
    expect(res.body.response).not.toHaveProperty('image');
  });

  it('persists the created hero in the database', async () => {
    // Arrange: creamos un heroe DEDICADO a este test...
    const res = await request(app)
      .post('/api/heroes')
      .send({
        name: 'James Howlett',
        alias: 'Wolverine',
        description: 'The best there is at what he does.',
        team: 'X-Men',
        status: 'Active',
        category: 'Hero',
        universe: 'Marvel',
      });
    expect(res.status).toBe(201);

    // ...y verificamos la persistencia leyendo la DB con el mismo
    // modelo que usa el handler: la escritura y la lectura van por
    // el mismo camino que en produccion
    const stored = await Hero.findOne({ slug: 'wolverine' });
    expect(stored).not.toBeNull();
    expect(stored?.alias).toBe('Wolverine');
    expect(stored?.universe).toBe('Marvel');
  });
});
