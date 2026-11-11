import { CorsOptions } from 'cors';

const frontendUrl = process.env.FRONTEND_URL;

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
