import 'dotenv/config';
import mongoose from 'mongoose';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Hero } from '../src/models/Hero';
import { connectDB } from '../src/config/db';

// Shape del JSON del repo: coincide exactamente con los campos del schema
// (name, alias, slug, powers, description, team, image, status, category,
// universe). Si se agregan campos nuevos al JSON, hay que agregarlos al
// schema o mongoose los descarta silenciosamente en strict mode.
interface SeedHero {
  name: string;
  alias: string;
  slug: string;
  powers: string[];
  description: string;
  team: string;
  image: string;
  status: string;
  category: string;
  universe: string;
}

const seed = async () => {
  // El JSON vive junto al script: cualquier checkout del repo puede
  // restaurar el catalogo sin dependencias externas
  const dataPath = path.join(__dirname, 'data', 'heroes-full-alias.json');
  const heroes = JSON.parse(readFileSync(dataPath, 'utf8')) as SeedHero[];

  await connectDB();

  // Pisa el contenido actual de la coleccion: es el comportamiento de
  // "restaurar" acordado. Uno solo y voluntario, nunca accidental.
  await Hero.deleteMany({});

  // insertMany por alto rendimiento; el data del repo viene pre-validado
  // (slugs unicos desde el alias), las violaciones de unique igual las
  // respalda el indice de la DB
  const inserted = await Hero.insertMany(heroes);

  console.log(`Seed complete: ${inserted.length} heroes loaded into 'heroes'.`);
  await mongoose.disconnect();
};

seed().catch(async (error) => {
  console.error('Seed failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
