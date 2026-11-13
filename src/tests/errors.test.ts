import { describe, it, expect, vi, afterAll } from 'vitest';
import { MongoServerError } from 'mongodb';
import type { Request, Response } from 'express';
import { errorHandler } from '../middleware/errors';

// Por que este SI es un test unitario legítimo (a diferencia de las ramas
// Array.isArray del addHeroImage): el CONTRATO del errorHandler es la
// entrada err -> respuesta. Un MongoServerError con code 11000 es el
// objeto real que Mongo emite al violar el indice unico: fabricarlo es
// probar su dominio real, no una ficcion HTTP-imposible
describe('errorHandler (middleware global)', () => {
  // El fallback hace console.error(err): silenciado para no ensuciar la
  // salida del suite con el "boom" esperado del test
  const consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation(() => {});

  // El handler ENCADENA resp.status(...).json(...): el mock de status
  // tiene que devolver el propio resp para que la cadena no rompa
  const makeResp = () => {
    const resp = {
      status: vi.fn(),
      json: vi.fn(),
    } as unknown as Response;
    (resp.status as ReturnType<typeof vi.fn>).mockReturnValue(resp);
    return resp;
  };

  const next = vi.fn();

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('maps an E11000 duplicate key error to a 409 naming the fields', () => {
    // Arrange: el backstop real de la unicidad. Los checks de app
    // (findOne previo al save) pueden perder una carrera con requests
    // concurrentes: el indice unico es la ultima linea de defensa y
    // este handler convierte su violacion en 409
    const err = new MongoServerError({
      code: 11000,
      keyValue: { slug: 'superman' },
    });
    const resp = makeResp();

    // Act
    errorHandler(err, {} as Request, resp, next);

    // Assert: los campos del keyValue viajan en el msg, como los devuelve
    // Object.keys(...).join(', ')
    expect(resp.status).toHaveBeenCalledWith(409);
    expect(resp.json).toHaveBeenCalledWith({
      msg: 'Duplicated value for: slug',
    });
    // Terminal: un error handler nunca delega
    expect(next).not.toHaveBeenCalled();
  });

  it('maps a CORS-rejected error to a dedicated 403', () => {
    // El error viaja con el status adjunto (convencion de Express)
    const err = Object.assign(new Error('Error de CORS'), { status: 403 });
    const resp = makeResp();

    errorHandler(err, {} as Request, resp, next);

    expect(resp.status).toHaveBeenCalledWith(403);
    expect(resp.json).toHaveBeenCalledWith({
      msg: 'Origin not allowed by CORS.',
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('maps any unexpected error to a 500', () => {
    // Arrange: lo impredecible (DB caida, bug, cast). La promesa del
    // middleware: NINGUN error escapa como HTML de Express, todo error
    // sale JSON
    const err = new Error('boom');
    const resp = makeResp();

    // Act
    errorHandler(err, {} as Request, resp, next);

    // Assert
    expect(resp.status).toHaveBeenCalledWith(500);
    expect(resp.json).toHaveBeenCalledWith({ msg: 'Internal server error.' });
    // El log queda: es para el dev que mira los logs de produccion
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
