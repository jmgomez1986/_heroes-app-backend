import type { Request, Response } from 'express';
import { Hero } from '../models/Hero';
import { IHeroPageResponse } from '../dtos/hero.dto';

export const addHero = async (req: Request, resp: Response) => {
  const { name, alias } = req.body;
  // Se verifica que el heroe ya no exista en la base de datos
  const heroExistsByName = await Hero.findOne({ name });
  const heroExistsByAlias = await Hero.findOne({ alias });

  if (heroExistsByName || heroExistsByAlias) {
    return resp.status(400).json({ msg: 'El heroe ya existe.' });
  }

  const hero = new Hero(req.body);
  await hero.save();
  resp.status(201).json({ msg: 'Registro creado correctamente.' });
};

const DEFAULT_PAGE = 1;
const DEFAULT_ELEMENTS_PER_PAGE = 10;

export const getHeroes = async (req: Request, resp: Response) => {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : DEFAULT_PAGE;
  const elementsPerPage = req.query.elements_per_page
    ? parseInt(req.query.elements_per_page as string, 10)
    : DEFAULT_ELEMENTS_PER_PAGE;

  const totalElements = await Hero.countDocuments();
  const totalPages = Math.ceil(totalElements / elementsPerPage);

  // Edge case: page beyond the last page returns empty data with real
  // metadata, so the front can detect it reached the end.
  const data =
    page > totalPages
      ? []
      : await Hero.find().select('-__v').sort({ _id: 1 }).skip((page - 1) * elementsPerPage).limit(elementsPerPage);

  resp.json({
    total_pages: totalPages,
    current_page: page,
    elements_per_page: elementsPerPage,
    total_elements: totalElements,
    data,
  } satisfies IHeroPageResponse);
};
