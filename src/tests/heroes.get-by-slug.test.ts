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
  await Hero.insertMany(seedHeroes);
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
}, 30_000);

describe('GET /api/heroes/:slug', () => {
  it('returns the hero matching the slug', async () => {
    // Arrange: el primer heroe del catalogo ya esta sembrado en el beforeAll
    const expected = catalogHeroes[0];

    // Act
    const res = await request(app).get(`/api/heroes/${expected.slug}`);

    // Assert: 200 con el documento completo (sin __v, igual que el listado)
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(expected.name);
    expect(res.body.slug).toBe(expected.slug);
    expect(res.body.alias).toBe(expected.alias);
    expect(res.body).not.toHaveProperty('__v');
  });

  it('returns 404 when no hero matches a well-formed slug', async () => {
    // Arrange: slug con formato valido pero inexistente en la DB
    const nonExistentSlug = 'does-not-exist';

    // Act
    const res = await request(app).get(`/api/heroes/${nonExistentSlug}`);

    // Assert
    expect(res.status).toBe(404);
    expect(res.body.msg).toBe('Hero not found.');
  });

  it('returns 400 when the slug param is missing', async () => {
    // Un path vacio no matchea la ruta (caeria en 404 de Express), por eso
    // el caso requerido se prueba con un param que express-validator vea
    // vacio via URL codificada
    const res = await request(app).get('/api/heroes/%20');

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it.each([
    'Super Man', // espacios
    'SUPERMAN', // mayusculas
    'super_man', // underscore
    '-superman-', // guiones en los bordes
    'super--man', // guion doble
    'superman!', // simbolos
    'café-con-leche', // no ascii
  ])('returns 400 for invalid slug format: %s', async (invalidSlug) => {
    // Act
    const res = await request(app).get(`/api/heroes/${invalidSlug}`);

    // Assert: el formato invalido se rechaza ANTES de tocar la DB,
    // con el mismo shape de errores del handleInputErrors
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});
