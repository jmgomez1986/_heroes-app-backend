import mongoose, { Schema } from 'mongoose';
import { IHero } from '../dtos/hero.dto';

const heroSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  alias: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    // La unicidad la impone la DB, no los checks a nivel app: estos pueden
    // perder una carrera con requests concurrentes. Las violaciones se
    // manifiestan como E11000 y el error handler las mapea a 409.
    unique: true,
  },
  powers: [
    {
      type: String,
      trim: true,
    },
  ],
  description: {
    type: String,
    required: true,
    trim: true,
  },
  team: {
    type: String,
    required: true,
    trim: true,
  },
  image: {
    type: String,
    trim: true,
    // Default '': la key SIEMPRE existe, el shape es uniforme para el
    // front (nunca hero.image ?? ''). El POST /:slug/image la reemplaza
    // con la URL de Cloudinary cuando se sube la imagen
    default: '',
  },
  // Identidad del asset en Cloudinary, INDEPENDIENTE del slug: se fija
  // en la primera subida (heroes-app/<slug>) y se REUTILIZA en las
  // re-subidas. Si el slug se regenera por un cambio de alias, el asset
  // NO se mueve: re-subir sobreescribe el mismo public_id (cero
  // huerfanos). Interno del backend: el front no lo consume
  imagePublicId: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  universe: {
    type: String,
    required: true,
    trim: true,
  },
});

export const Hero = mongoose.model<IHero>('Hero', heroSchema, 'heroes');
