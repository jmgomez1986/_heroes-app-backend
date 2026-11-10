import type { Request, Response } from 'express';
import { Hero } from '../models/Hero';
import { IHeroPageResponse } from '../dtos/hero.dto';
import {
  DEFAULT_ELEMENTS_PER_PAGE,
  DEFAULT_PAGE,
  EDITABLE_FIELDS,
} from '../constants/default.constants';
import slug from 'slug';

export const addHero = async (req: Request, resp: Response) => {
  const { name, alias } = req.body;
  const heroSlug = slug(alias);
  // Se verifica que el heroe ya no exista en la base de datos. La garantia
  // real es el indice unico de la DB (via error handler); estos checks solo
  // dan un mensaje amigable, incluida la colision de slug que se da con
  // aliases distintos que generan el mismo slug (ej: "Super man"/"Superman").
  const heroExistsByName = await Hero.findOne({ name });
  const heroExistsByAlias = await Hero.findOne({ alias });
  const heroExistsBySlug = await Hero.findOne({ slug: heroSlug });

  if (heroExistsByName || heroExistsByAlias || heroExistsBySlug) {
    return resp.status(409).json({ msg: 'Hero already exists.' });
  }

  const hero = new Hero(req.body);
  hero.slug = heroSlug;
  await hero.save();
  resp.status(201).json({ msg: 'Hero created correctly.' });
};

export const getHeroes = async (req: Request, resp: Response) => {
  const page = req.query.page
    ? parseInt(req.query.page as string, 10)
    : DEFAULT_PAGE;
  const elementsPerPage = req.query.elements_per_page
    ? parseInt(req.query.elements_per_page as string, 10)
    : DEFAULT_ELEMENTS_PER_PAGE;

  const totalElements = await Hero.countDocuments();
  const totalPages = Math.ceil(totalElements / elementsPerPage);

  // Edge case: una pagina mas alla de la ultima devuelve data vacia con la
  // metadata real, para que el front detecte que llego al final.
  const data =
    page > totalPages
      ? []
      : await Hero.find()
          .select('-__v')
          .sort({ _id: 1 })
          .skip((page - 1) * elementsPerPage)
          .limit(elementsPerPage);

  resp.json({
    total_pages: totalPages,
    current_page: page,
    elements_per_page: elementsPerPage,
    total_elements: totalElements,
    data,
  } satisfies IHeroPageResponse);
};

export const updateHero = async (req: Request, resp: Response) => {
  // `slugParam` para no pisar la libreria `slug` importada.
  const { slug: slugParam } = req.params;
  const { name, alias } = req.body;

  // Se verifica que el heroe exista en la base de datos
  const hero = await Hero.findOne({ slug: slugParam });
  if (!hero) {
    return resp.status(404).json({ msg: 'Hero not found.' });
  }

  // `name` no es editable. El `slug` tampoco: se congela al crearse porque es
  // la URL publica del heroe y las URLs son promesas que no se rompen.
  if (name && name !== hero.name) {
    return resp.status(400).json({ msg: 'Hero`s Name can`t be modified.' });
  }

  // El alias SI es editable (un heroe evoluciona: "Supermann" -> "Superman
  // Prime"). Al cambiarlo, el slug se REGENERA para que la URL refleje siempre
  // el alias actual ("Superman Prime" -> superman-prime), pero el slug nuevo
  // no puede colisionar con el de otro heroe, para que la busqueda por slug
  // siga siendo inequivoca. Nota: editar un alias invalida la URL anterior.
  if (alias && alias !== hero.alias) {
    const candidateSlug = slug(alias);
    // $ne significa "not equal". La query se lee: "buscá un héroe cuyo slug sea candidateSlug Y cuyo _id NO sea el del héroe que estoy editando".
    // Lo que hace $ne es excluirte a vos mismo del chequeo de colisión.
    const slugOwner = await Hero.findOne({
      slug: candidateSlug,
      _id: { $ne: hero._id },
    });
    if (slugOwner) {
      return resp.status(409).json({
        msg: `Alias "${alias}" is already used by another hero.`,
      });
    }
    hero.set('alias', alias);
    hero.set('slug', candidateSlug);
  }

  // Semantica PATCH: solo se aplican los campos explicitamente enviados.
  // Whitelist contra mass assignment: nunca copiar req.body completo.
  for (const field of EDITABLE_FIELDS) {
    const value = req.body[field];
    if (value !== undefined) {
      hero.set(field, value);
    }
  }

  await hero.save();
  resp.json({ msg: 'Hero modified correctly', response: hero });
};

export const deleteHero = async (req: Request, resp: Response) => {
  const { slug } = req.params;

  // findOneAndDelete hace el 404-check y el borrado en un solo viaje a la DB
  const hero = await Hero.findOneAndDelete({ slug });
  if (!hero) {
    return resp.status(404).json({ msg: 'Hero not found' });
  }

  resp.json({ msg: 'Hero deleted correctly.' });
};
