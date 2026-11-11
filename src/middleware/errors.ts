import type { NextFunction, Request, Response } from 'express';
import { MongoServerError } from 'mongodb';

// Error handler global: mantiene toda respuesta de error en JSON, incluidas
// las impredecibles (DB caida, errores de cast) que Express 5 le delega desde
// handlers async. Express lo identifica por tener 4 parametros.
export const errorHandler = (
  err: unknown,
  req: Request,
  resp: Response,
  next: NextFunction,
) => {
  // Body-parser (via express.raw en el upload de imagen, pero tambien express
  // .json en el resto de las rutas): el body supera el limite declarado.
  // Se mapea a 413 con mensaje generico (aplica a cualquier ruta) en lugar de
  // caer como error generico de servidor. `type` no existe en Error estandar,
  // se lee con un cast local.
  if ((err as { type?: string })?.type === 'entity.too.large') {
    return resp.status(413).json({ msg: 'Request body too large.' });
  }

  // Violacion de indice unico (E11000): los checks de existencia a nivel app
  // pueden perder una carrera con requests concurrentes, asi que el indice
  // unico de la DB es la ultima linea de defensa de la unicidad slug/alias.
  if (err instanceof MongoServerError && err.code === 11000) {
    const fields = Object.keys(err.keyValue ?? {}).join(', ');
    return resp.status(409).json({ msg: `Duplicated value for: ${fields}` });
  }

  console.error(err);
  resp.status(500).json({ msg: 'Internal server error.' });
};
