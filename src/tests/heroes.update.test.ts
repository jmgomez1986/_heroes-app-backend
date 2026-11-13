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
  // Arrange global: mongo en memoria + data sembrada. Cada test que MUTA
  // usa su propio heroe (flash, mujer-maravilla, superman) para no
  // depender del orden de ejecucion dentro del archivo
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Hero.insertMany(seedHeroes);
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
}, 30_000);

describe('PATCH /api/heroes/:slug', () => {
  it('updates only the fields explicitly sent', async () => {
    // Arrange: dos campos de la whitelist sobre flash. El resto del
    // documento NO viaja en el body: la semantica PATCH es parcial
    const flash = catalogHeroes.find((h: IHero) => h.slug === 'flash')!;
    expect(flash).toBeDefined();

    // Act
    const res = await request(app).patch('/api/heroes/flash').send({
      status: 'Retired',
      team: 'Justice League Dark',
    });

    // Assert: lo enviado cambia...
    expect(res.status).toBe(200);
    expect(res.body.msg).toBe('Hero modified correctly');
    expect(res.body.response.status).toBe('Retired');
    expect(res.body.response.team).toBe('Justice League Dark');
    // ...y lo NO enviado queda intacto (el nucleo de la semantica PATCH)
    expect(res.body.response.alias).toBe(flash.alias);
    expect(res.body.response.slug).toBe('flash');
    expect(res.body.response.powers).toEqual(flash.powers);
  });

  it('rejects a name change', async () => {
    // Arrange: `name` es identidad, no un campo editable. El handler lo
    // rechaza ANTES de tocar nada: el request no muta la DB
    const superman = catalogHeroes.find((h: IHero) => h.slug === 'superman')!;
    expect(superman).toBeDefined();

    // Act
    const res = await request(app)
      .patch('/api/heroes/superman')
      .send({ name: 'Kal-El' });

    // Assert: el msg exacto del handler, con sus backticks
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe('Hero`s Name can`t be modified.');
  });

  it('regenerates the slug when the alias changes', async () => {
    // Arrange: alias nuevo, sin colision ('princesa-amazona' no existe
    // en el seed). El slug esperado va LITERAL: documenta la
    // transformacion sin depender de la misma lib que usa el handler
    const ww = catalogHeroes.find((h: IHero) => h.slug === 'mujer-maravilla')!;
    expect(ww).toBeDefined();

    // Act
    const res = await request(app)
      .patch('/api/heroes/mujer-maravilla')
      .send({ alias: 'Princesa Amazona' });

    // Assert: el slug nuevo refleja el alias actual...
    expect(res.status).toBe(200);
    expect(res.body.msg).toBe('Hero modified correctly');
    expect(res.body.response.alias).toBe('Princesa Amazona');
    expect(res.body.response.slug).toBe('princesa-amazona');
    // ...y la URL vieja quedo invalidada: el documento ya no vive en
    // el slug anterior. Un GET/PATCH/DELETE al slug viejo daria 404
    const atOldSlug = await Hero.findOne({ slug: 'mujer-maravilla' });
    expect(atOldSlug).toBeNull();
  });

  it('rejects an alias whose slug belongs to another hero', async () => {
    // Arrange: el experimento de Postman convertido en test. El dueño
    // de 'batman' es OTRO heroe, asi que el $ne self no lo salva
    const superman = catalogHeroes.find((h: IHero) => h.slug === 'superman')!;
    expect(superman).toBeDefined();

    // Act
    const res = await request(app)
      .patch('/api/heroes/superman')
      .send({ alias: 'batman' });

    // Assert: el msg exacto, con el alias sent verbatim
    expect(res.status).toBe(409);
    expect(res.body.msg).toBe(
      'Alias "batman" is already used by another hero.',
    );
  });

  it('keeps the slug when the alias only changes casing', async () => {
    // Arrange: 'SUPERMAN' genera el mismo slug que 'Superman'. El $ne
    // self excluye al propio heroe del chequeo de colision: retomar
    // tu propio slug siempre esta permitido
    const superman = catalogHeroes.find((h: IHero) => h.slug === 'superman')!;
    expect(superman).toBeDefined();

    // Act
    const res = await request(app)
      .patch('/api/heroes/superman')
      .send({ alias: superman.alias.toUpperCase() });

    // Assert: el alias cambia de casing, el slug (y la URL) no se tocan
    expect(res.status).toBe(200);
    expect(res.body.msg).toBe('Hero modified correctly');
    expect(res.body.response.alias).toBe('SUPERMAN');
    expect(res.body.response.slug).toBe('superman');

    const stored = await Hero.findOne({ slug: 'superman' });
    expect(stored?.alias).toBe('SUPERMAN');
  });

  it('returns 404 when the slug does not exist', async () => {
    // Act
    const res = await request(app)
      .patch('/api/heroes/no-existo')
      .send({ status: 'Retired' });

    // Assert: msg exacto del handler -- CON punto final (distinto del DELETE)
    expect(res.status).toBe(404);
    expect(res.body.msg).toBe('Hero not found.');
  });
});
