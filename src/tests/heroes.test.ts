import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { Hero } from '../models/Hero';

describe('GET /api/heroes', () => {
  it.each(['0', '-1', 'abc'])('returns 400 when page is %s', async (page) => {
    const res = await request(app).get(`/api/heroes?page=${page}`);
    expect(res.status).toBe(400);
    expect(res.body.errors[0].msg).toBe('page must be an integer >= 1');
  });

  it('returns 400 when elements_per_page is greater than 50', async () => {
    // Arrange & Act: pedido con un input inválido
    const res = await request(app).get('/api/heroes?elements_per_page=51');

    // Assert: código de respuesta prometido y cuerpo con los errores
    expect(res.status).toBe(400);
    expect(res.body.errors[0].msg).toBe(
      'elements_per_page must be an integer between 1 and 50',
    );
  });

  it('returns 400 when page is not an integer >= 1 and elements_per_page is greater than 50', async () => {
    // Arrange & Act: pedido con un input inválido
    const res = await request(app).get(
      '/api/heroes?page=0&elements_per_page=51',
    );

    // Assert: código de respuesta prometido y cuerpo con los errores
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toEqual(2);
  });
});

describe('POST /api/heroes', () => {
  it.each([
    ['name', 'Name is required'],
    ['alias', 'Alias is required'],
    ['description', 'Description is required'],
    ['team', 'Team is required'],
    ['status', 'Status is required'],
    ['category', 'Category is required'],
    ['universe', 'Universe is required'],
  ])(
    'returns 400 when $0 field is missing within the request body',
    async (field, message) => {
      const hero = {
        name: 'Clark Kent',
        alias: 'Superman',
        description: '...',
        team: '...',
        status: 'Active',
        category: 'Hero',
        universe: 'DC',
      };
      delete hero[field as keyof typeof hero];

      const res = await request(app).post('/api/heroes').send(hero);

      expect(res.status).toBe(400);
      expect(res.body.errors[0].msg).toBe(message);
    },
  );
});

describe('status enum', () => {
  // El status es un dominio cerrado: Active | Inactive | Deceased. La
  // validacion de la ruta devuelve 400 (no un 500 de ValidationError de
  // mongoose) y el modelo es la ultima linea de defensa para escrituras que
  // no pasan por el router.
  const invalidMessage = 'Status must be one of: Active, Inactive, Deceased';

  it('returns 400 when POST status is outside the allowed values', async () => {
    const res = await request(app).post('/api/heroes').send({
      name: 'Clark Kent',
      alias: 'Superman',
      description: '...',
      team: '...',
      status: 'Retired',
      category: 'Hero',
      universe: 'DC',
    });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].msg).toBe(invalidMessage);
  });

  it('returns 400 when PATCH status is outside the allowed values', async () => {
    const res = await request(app)
      .patch('/api/heroes/superman')
      .send({ status: 'Retired' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].msg).toBe(invalidMessage);
  });

  it('rejects an invalid status at the model level', () => {
    const error = new Hero({
      name: 'Clark Kent',
      alias: 'Superman',
      slug: 'superman',
      description: '...',
      team: '...',
      status: 'Retired',
      category: 'Hero',
      universe: 'DC',
    }).validateSync();

    expect(error?.errors['status']).toBeDefined();
  });
});
