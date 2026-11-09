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
  powers: [{
    type: String,
    trim: true,
  }],
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

export const Hero = mongoose.model<IHero>('Hero', heroSchema);
