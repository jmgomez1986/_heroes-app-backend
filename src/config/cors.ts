import { CorsOptions } from 'cors';

const frontendUrl = process.env.FRONTEND_URL;

export const corsConf: CorsOptions = {
  origin: function (origin, callback) {
    const whitelist = [];
    whitelist.push(frontendUrl);

    if (process.argv[2] === '--api') {
      whitelist.push(undefined);
    }

    if (whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Error de CORS'));
    }
  },
};
