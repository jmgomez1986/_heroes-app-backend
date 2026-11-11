import 'dotenv/config';
import mongoose from 'mongoose';
import { Hero } from '../src/models/Hero';
import { connectDB } from '../src/config/db';
import { seedHeroes } from '../src/data/catalog';

const seed = async () => {
  await connectDB();

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
