import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import { router } from './routers/router';
import { connectDB } from './config/db';
import { corsConf } from './config/cors';

connectDB();

export const app = express();

// Cors
app.use(cors(corsConf));

// Leer datos del body de la request
app.use(express.json());

app.use('/api', router);
