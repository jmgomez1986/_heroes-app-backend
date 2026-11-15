import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { Hero } from '../models/Hero';
import { IHero } from '../dtos/hero.dto';
import { catalogHeroes, seedHeroes } from '../data/catalog';
import { app } from '../server';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  // Arrange global: mongo en memoria + data sembrada.
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Hero.insertMany(seedHeroes);
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
}, 30_000);

describe('DELETE /api/heroes/:slug', () => {
  it('deletes a hero and removes it from the collection', async () => {
    // Arrange
    const heroFlash = catalogHeroes.find(
      (hero: IHero) => hero.slug === 'flash',
    );
    const totalHeroesBeforeDelete = await Hero.countDocuments();

    // Act
    const res = await request(app).delete('/api/heroes/flash');
    const totalHeroesAfterDelete = await Hero.countDocuments();
    const heroFlashDeleted = await Hero.findOne({ slug: 'flash' });

    // Asserts
    expect(heroFlash).toBeDefined();
    expect(res.status).toBe(200);
    expect(res.body.msg).toBe('Hero deleted correctly.');
    expect(totalHeroesAfterDelete).toEqual(totalHeroesBeforeDelete - 1);
    expect(heroFlashDeleted).toBeNull();
  });
  it('returns 404 when the slug does not exist', async () => {
    // Act
    const res = await request(app).delete('/api/heroes/test-delete');
    // Asserts
    expect(res.status).toBe(404);
    expect(res.body.msg).toBe('Hero not found');
  });

  it('returns 400 when the slug format is invalid', async () => {
    // Arrange & Act: 'Batman' no cumple el patron (mayusculas). El formato
    // se valida en la ruta como en las demas rutas con :slug, ANTES de
    // llegar al handler: 400, no el 404 de "no existe"
    const res = await request(app).delete('/api/heroes/Batman');

    // Asserts
    expect(res.status).toBe(400);
    expect(res.body.errors[0].msg).toBe(
      'Slug must be lowercase alphanumeric words separated by single hyphens',
    );
  });
});
