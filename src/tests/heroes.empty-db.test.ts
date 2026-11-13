import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../server';

let mongo: MongoMemoryServer;

// Escenario a proposito en archivo aparte: este caso necesita la coleccion
// VACIA, incompatible con la semilla compartida de heroes.db.test.ts
describe('GET /api/heroes con la DB vacia', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    // Sin insertMany: la coleccion queda vacia a proposito
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  }, 30_000);

  it('returns 200 with empty data and zero total_pages', async () => {
    // Arrange: la coleccion no tiene documentos

    // Act: request sin query params (aplican defaults)
    const res = await request(app).get('/api/heroes');

    // Assert: no revienta por division ni miente en la metadata
    expect(res.status).toBe(200);
    expect(res.body.total_elements).toBe(0);
    expect(res.body.total_pages).toBe(0);
    expect(res.body.current_page).toBe(1);
    expect(res.body.elements_per_page).toBe(10);
    expect(res.body.data).toEqual([]);
  });
});
