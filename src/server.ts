import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import { router } from './routers/router';
import { corsConf } from './config/cors';
import { errorHandler } from './middleware/errors';

export const app = express();

// Cors
app.use(cors(corsConf));

// Leer datos del body de la request
app.use(express.json());

app.use('/api', router);

// Error handler global (debe registrarse ultimo)
app.use(errorHandler);
