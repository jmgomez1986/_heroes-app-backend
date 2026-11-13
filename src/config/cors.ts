import { CorsOptions } from 'cors';

const frontendUrl = process.env.FRONTEND_URL;

// Fail fast: sin FRONTEND_URL la whitelist quedaria con un undefined
// "accidental" y los clientes sin Origin pasarian SIEMPRE (bug latente
// que el suite destapo). Espeja el patron de config/db.ts para
// MONGODB_URI: la app se niega a arrancar con config indispensable
// ausente, el problema se detecta en el deploy y no a las 2 AM
if (!frontendUrl) {
  throw new Error(
    'FRONTEND_URL no definida: revisá tu archivo .env y que dotenv esté cargado',
  );
}

const allowNoOrigin =
  process.argv.includes('--api') || process.env.NODE_ENV === 'test';

export const corsConf: CorsOptions = {
  origin: function (origin, callback) {
    const whitelist = [frontendUrl];
    if (allowNoOrigin) {
      whitelist.push(undefined);
    }
    if (whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Error de CORS'));
    }
  },
};
