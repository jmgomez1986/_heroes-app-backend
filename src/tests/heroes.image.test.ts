import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import type { Writable } from 'stream';
import type { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { app } from '../server';
import { Hero } from '../models/Hero';
import { catalogHeroes, seedHeroes } from '../data/catalog';
import { IHero } from '../dtos/hero.dto';
import cloudinary from '../config/cloudinary';

// Mock del UNICO servicio externo del proyecto. Cloudinary es de pago:
// nunca se golpea en tests. Todo lo demas corre real (Mongo en memoria,
// express.raw, error handler) para que un fallo sea de NUESTRO codigo.
// vi.mock se hoistea al tope del archivo: el factory reemplaza el modulo
// ANTES de que server.ts lo importe
vi.mock('../config/cloudinary', () => ({
  default: {
    uploader: {
      upload_stream: vi.fn(),
    },
  },
}));

let mongo: MongoMemoryServer;

// La firma del handler solo lee secure_url del resultado
const MOCK_SECURE_URL = 'https://res.cloudinary.com/heroes-app/iron-man.png';

// "Magic number" del PNG: la firma que TODO PNG valido arranca segun la
// especificacion del formato (0x89 fija el bit alto contra errores de
// transmision, 0x50 0x4e 0x47 es "PNG" en ASCII, y el resto es CRLF +
// Ctrl-Z + LF). El endpoint NO valida esta firma (lo haria Cloudinary,
// mockeado aca): con el Content-Type y un Buffer no vacio alcanza. Si
// el handler pasara a validar la firma, migrar a un fixture real
const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

beforeAll(async () => {
  // Arrange global: mongo en memoria + data sembrada. El unico test que
  // MUTA (el feliz) usa iron-man: ningun otro lo toca
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Hero.insertMany(seedHeroes);
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
}, 30_000);

describe('POST /api/heroes/:slug/image', () => {
  it('returns 404 when the hero does not exist', async () => {
    // Act: el 404-check corre ANTES que el de content-type, asi que el
    // request es "valido" en todo lo demas y la unica causa posible del
    // 404 es la ausencia del heroe (un eje por test)
    const res = await request(app)
      .post('/api/heroes/no-existo/image')
      .set('Content-Type', 'image/png')
      .send(pngBytes);

    // Assert: msg exacto del handler, CON punto (como el PATCH, no como DELETE)
    expect(res.status).toBe(404);
    expect(res.body.msg).toBe('Hero not found.');
  });

  it('returns 415 for an unsupported content type', async () => {
    // Act: el slug existe, pero text/plain no pasa la whitelist
    // (PNG/JPEG). Con express.raw y type declarado, un content-type no
    // listado llega sin parsear: el handler valida explicitamente
    const res = await request(app)
      .post('/api/heroes/superman/image')
      .set('Content-Type', 'text/plain')
      .send('not an image');

    // Assert
    expect(res.status).toBe(415);
    expect(res.body.msg).toBe(
      "Unsupported content type 'text/plain'. Expected PNG or JPEG.",
    );
  });

  it('returns 400 when the body is empty', async () => {
    // Act: content-type correcto, cero bytes. El parser produce un
    // Buffer vacio y el handler lo rechaza ANTES de llamar a Cloudinary
    const res = await request(app)
      .post('/api/heroes/superman/image')
      .set('Content-Type', 'image/png')
      .send(Buffer.alloc(0));

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe('Request body must be the raw image file.');
  });

  it('returns 413 when the body exceeds the 1mb limit', async () => {
    // Act: 1mb + 1 byte. El limite lo corta el parser mismo
    // (express.raw limit), no el handler: sube por el error handler
    const oversized = Buffer.alloc(1024 * 1024 + 1);
    const res = await request(app)
      .post('/api/heroes/superman/image')
      .set('Content-Type', 'image/png')
      .send(oversized);

    // Assert
    expect(res.status).toBe(413);
  });

  it('returns 500 when the Cloudinary upload fails', async () => {
    // Arrange: el mock RECHAZA la subida, como una caida real del
    // servicio. Es la rama catch del handler, un camino de runtime
    // genuino (Cloudinary es externo: se va a caer)
    const uploadStreamMock = vi.mocked(cloudinary.uploader.upload_stream);
    uploadStreamMock.mockImplementationOnce((options, callback) => {
      return {
        end: () => {
          setImmediate(() =>
            callback(
              new Error('Service unavailable') as UploadApiErrorResponse,
              undefined,
            ),
          );
        },
      } as unknown as Writable;
    });

    // Act
    const res = await request(app)
      .post('/api/heroes/superman/image')
      .set('Content-Type', 'image/png')
      .send(pngBytes);

    // Assert: el 500 y el msg exacto...
    expect(res.status).toBe(500);
    expect(res.body.msg).toBe('Error uploading image to Cloudinary.');
    // ...y el hero queda INTACTO (promesa documentada del handler): sin
    // campo image en el doc, el front puede reintentar sin recrearlo
    const stored = await Hero.findOne({ slug: 'superman' });
    expect(stored?.image).toBe('');
  });

  it('uploads the image and persists its URL on the hero', async () => {
    // Arrange: el mock del stream. El handler llama upload_stream(options,
    // callback) y hace stream.end(buffer): el stream falso resuelve el
    // callback asincronicamente, como I/O real, con el resultado que
    // devolveria Cloudinary
    const uploadStreamMock = vi.mocked(cloudinary.uploader.upload_stream);
    uploadStreamMock.mockImplementationOnce((options, callback) => {
      return {
        end: () => {
          setImmediate(() =>
            callback(null, {
              public_id: 'heroes-app/iron-man',
              secure_url: MOCK_SECURE_URL,
            } as UploadApiResponse),
          );
        },
      } as unknown as Writable; // el handler solo usa .end: el resto del stream real sobra
    });

    const ironMan = catalogHeroes.find((h: IHero) => h.slug === 'iron-man')!;
    expect(ironMan).toBeDefined();

    // Act
    const res = await request(app)
      .post('/api/heroes/iron-man/image')
      .set('Content-Type', 'image/png')
      .send(pngBytes);

    // Assert: el contrato del 200...
    expect(res.status).toBe(200);
    expect(res.body.msg).toBe('Image uploaded correctly.');
    expect(res.body.response.image).toBe(MOCK_SECURE_URL);
    // ...el public_id deterministico ES el diseno: la misma imagen re-subida
    // para el mismo slug SOBREESCRIBE la anterior (sin huerfanos)
    expect(uploadStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'heroes-app',
        public_id: 'iron-man',
      }),
      expect.any(Function),
    );
    // ...y la persistencia, leyendo por el mismo modelo que el handler
    const stored = await Hero.findOne({ slug: 'iron-man' });
    expect(stored?.image).toBe(MOCK_SECURE_URL);
  });
});
