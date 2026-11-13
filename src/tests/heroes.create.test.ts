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
    // El schema ahora da default '' a image: la key SIEMPRE existe
    // (shape uniforme para el front); POST /:slug/image la reemplaza
    // con la URL de Cloudinary cuando se sube
    expect(res.body.response.image).toBe('');
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

  it('rejects a hero with a duplicate name', async () => {
    // Arrange: el nombre de un heroe sembrado, pero con alias nuevo.
    // El unico eje de conflicto es name: el 409 solo puede venir de
    // heroExistsByName
    const seeded = catalogHeroes.find((h: IHero) => h.slug === 'superman')!;
    // El `!` (non-null assertion) le dice al compilador que el seed SI
    // contiene ese slug: es un dato propio del proyecto, no una entrada
    // del usuario. El expect de abajo lo prueba en tiempo de ejecucion
    expect(seeded).toBeDefined();

    const newHero = {
      name: seeded.name,
      alias: 'Steel Prime',
      description: 'The Man of Steel, prime version.',
      team: 'Liga de la Justicia',
      status: 'Active',
      category: 'Hero',
      universe: 'DC',
    };

    // Act
    const res = await request(app).post('/api/heroes').send(newHero);

    // Assert
    expect(res.status).toBe(409);
    expect(res.body.msg).toBe('Hero already exists.');
  });

  it('rejects a hero with a duplicate alias', async () => {
    // Arrange: el alias de un heroe sembrado, pero con name nuevo.
    // Ahora el eje de conflicto es alias
    const seeded = catalogHeroes.find((h: IHero) => h.slug === 'superman')!;
    expect(seeded).toBeDefined();

    const newHero = {
      name: 'John Henry Irons Prime',
      alias: seeded.alias,
      description: 'The Man of Steel, prime version.',
      team: 'Liga de la Justicia',
      status: 'Active',
      category: 'Hero',
      universe: 'DC',
    };

    // Act
    const res = await request(app).post('/api/heroes').send(newHero);

    // Assert
    expect(res.status).toBe(409);
    expect(res.body.msg).toBe('Hero already exists.');
  });

  it('rejects an alias whose slug collides with an existing hero', async () => {
    // Arrange: alias en mayusculas. `Hero.findOne({ alias: 'SUPERMAN' })`
    // NO lo encuentra (Mongo compara strings case-sensitive), pero
    // slug('SUPERMAN') genera 'superman', que SI existe: el 409 tiene
    // que venir del chequeo de slug. Este test prueba por que existe
    // la tercera capa del addHero
    const seeded = catalogHeroes.find((h: IHero) => h.slug === 'superman')!;
    expect(seeded).toBeDefined();

    const newHero = {
      name: 'John Henry Irons Prime',
      alias: seeded.alias.toUpperCase(),
      description: 'The Man of Steel, prime version.',
      team: 'Liga de la Justicia',
      status: 'Active',
      category: 'Hero',
      universe: 'DC',
    };

    // El conflicto NO deja basura: comparo contra el total ANTES de este
    // request (medido aca, no asumido): los tests felices del archivo ya
    // crearon los suyos en esta misma DB compartida, asi que el baseline
    // no es seedHeroes.length -- lo que afirmo es que ESTE request no
    // cambio nada. Orden-independiente: corre solo o ultimo y pasa igual
    const totalBefore = await Hero.countDocuments();

    // Act
    const res = await request(app).post('/api/heroes').send(newHero);

    // Assert
    expect(res.status).toBe(409);
    expect(res.body.msg).toBe('Hero already exists.');

    const totalAfter = await Hero.countDocuments();
    expect(totalAfter).toBe(totalBefore);
  });
});
