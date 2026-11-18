import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../server';
import { Hero } from '../models/Hero';
import { seedHeroes } from '../data/catalog';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  // Arrange global del archivo: mongo en memoria + data sembrada
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Hero.insertMany(seedHeroes);
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
}, 30_000);

describe('GET /api/heroes/stats', () => {
  it('returns catalog totals', async () => {
    // Act
    const res = await request(app).get('/api/heroes/stats');

    // Assert: 200 con los totales del catalogo sembrado (25 docs:
    // 18 'Hero' + 7 'Villain'; por estado: 21 'Active', 3 'Inactive' y
    // 1 'Deceased', que juntos cierran contra total_elements)
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total_elements: 25,
      total_heroes: 18,
      total_villains: 7,
      total_active: 21,
      total_inactive: 3,
      total_deceased: 1,
    });
  });

  it('is not shadowed by the /heroes/:slug route', async () => {
    // Act
    const res = await request(app).get('/api/heroes/stats');

    // Assert: si la ruta dinamica capturara 'stats' como slug, la
    // respuesta seria 404 'Hero not found.' en vez de los totales
    expect(res.status).toBe(200);
    expect(res.body.msg).toBeUndefined();
  });

  it('returns 500 with its own message when the DB query fails', async () => {
    // Arrange: la primera consulta de conteo rechaza (DB caida)
    const spy = vi
      .spyOn(Hero, 'countDocuments')
      .mockRejectedValueOnce(new Error('DB down'));

    // Act
    const res = await request(app).get('/api/heroes/stats');

    // Assert: mensaje propio del endpoint, no el 500 generico
    expect(res.status).toBe(500);
    expect(res.body.msg).toBe('Error fetching hero stats.');
    spy.mockRestore();
  });
});
