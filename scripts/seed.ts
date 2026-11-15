import 'dotenv/config';
import mongoose from 'mongoose';
import { Hero } from '../src/models/Hero';
import { connectDB } from '../src/config/db';
import { seedHeroes } from '../src/data/catalog';
import cloudinary from '../src/config/cloudinary';

// La carpeta heroes-app es el namespace EXCLUSIVO de esta app: tras pisar
// la coleccion, todo asset que quede ahi es huerfano por definicion. El
// prefijo tambien cubre los sufijos numericos (-2, -3) que nacen de las
// colisiones de slug en el upload.
const HEROES_APP_FOLDER_PREFIX = 'heroes-app/';

// La Admin API borra de a tandas (default 100): si quedan mas assets,
// la respuesta trae next_cursor y se itera hasta agotar la carpeta.
const cleanCloudinaryFolder = async (): Promise<void> => {
  let nextCursor: string | undefined;
  do {
    const result = await cloudinary.api.delete_resources_by_prefix(
      HEROES_APP_FOLDER_PREFIX,
      { resource_type: 'image', max_results: 100 },
    );
    nextCursor = result.next_cursor;
  } while (nextCursor);
};

const seed = async () => {
  await connectDB();

  // Best-effort, misma politica que deleteHero: el seed JAMAS depende de
  // Cloudinary. Sin credenciales o con el servicio caido, la DB se siembra
  // igual y el log nombra que quedo sin limpiar; reintentar el seed
  // reintenta la limpieza.
  try {
    const config = cloudinary.config();
    if (!config.cloud_name || !config.api_key || !config.api_secret) {
      console.warn(
        'Cloudinary credentials not configured: skipping asset cleanup (orphan images may remain in heroes-app/).',
      );
    } else {
      await cleanCloudinaryFolder();
      console.log('Cloudinary cleanup: heroes-app/ folder emptied.');
    }
  } catch (error) {
    console.error(
      'Cloudinary cleanup failed (the seed continues; some orphan assets may remain in heroes-app/):',
      error,
    );
  }

  // Pisa el contenido actual de la coleccion: es el comportamiento de
  // "restaurar" acordado. Uno solo y voluntario, nunca accidental.
  await Hero.deleteMany({});

  // insertMany por alto rendimiento; el data del repo viene pre-validado
  // (slugs unicos desde el alias), las violaciones de unique igual las
  // respalda el indice de la DB
  const inserted = await Hero.insertMany(seedHeroes);

  console.log(`Seed complete: ${inserted.length} heroes loaded into 'heroes'.`);
  await mongoose.disconnect();
};

seed().catch(async (error) => {
  console.error('Seed failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
