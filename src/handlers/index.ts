import type { Request, Response } from 'express';
import { Hero } from '../models/Hero';
import { IHeroPageResponse } from '../dtos/hero.dto';
import cloudinary from '../config/cloudinary';
import type { UploadApiResponse } from 'cloudinary';
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
  // Se devuelve el documento creado: el front necesita el slug y el _id para
  // navegar al recurso sin hacer un segundo GET.
  resp.status(201).json({ msg: 'Hero created correctly.', response: hero });
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

// Content-Types aceptados y su extension para el mensaje de error
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
};

// Promesifica el upload_stream de Cloudinary: el buffer se escribe en el
// stream y la promesa se resuelve con la respuesta (o rechaza con el error).
// Esto evita el callback anidado y hace que el handler sea async/await
// lineal con un unico punto de manejo de errores.
// `publicId` es el identificador COMPLETO del asset (incluye la carpeta:
// heroes-app/<...>): en la primera subida lo deriva el caller del slug;
// en las re-subidas viaja el guardado en el schema, que ya la trae. Por
// eso no se usa el campo `folder` del config: Cloudinary CONCATENA
// folder + public_id cuando ambos viajan, y prefijaria dos veces
const uploadToCloudinary = (buffer: Buffer, publicId: string) =>
  new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        // Identidad estable: re-subir el mismo public_id SOBREESCRIBE
        // el asset anterior, sin importar cuantas veces cambio el slug
        public_id: publicId,
        resource_type: 'image',
      },
      (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error('Cloudinary upload failed'));
        }
        resolve(result);
      },
    );
    stream.end(buffer);
  });

export const addHeroImage = async (req: Request, resp: Response) => {
  // En los tipos de Express 5 un param puede venir como string[], se
  // normaliza al primer valor
  const rawSlug = req.params.slug;
  const slugParam = (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug) ?? '';

  // 404: el hero tiene que existir, si no, no hay imagen a la que colgar
  const hero = await Hero.findOne({ slug: slugParam }).select('-__v');
  if (!hero) {
    return resp.status(404).json({ msg: 'Hero not found.' });
  }

  const rawContentType = req.headers['content-type'];
  const contentType =
    (Array.isArray(rawContentType) ? rawContentType[0] : rawContentType) ?? '';

  // 415: el Content-Type no es una imagen aceptada. Con express.raw y un
  // `type` declarado, requests de otros tipos llegan sin parsear, asi que
  // se valida explicitamente contra la whitelist
  if (!(contentType in ALLOWED_IMAGE_TYPES)) {
    return resp.status(415).json({
      msg: `Unsupported content type '${contentType}'. Expected PNG or JPEG.`,
    });
  }

  // 400: el body debe ser la imagen binaria como Buffer no vacio
  const buffer = req.body;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return resp.status(400).json({
      msg: 'Request body must be the raw image file.',
    });
  }

  try {
    // Identidad del asset ESTABLE e independiente del slug: si el heroe
    // ya tiene public_id guardado, las re-subidas lo reutilizan sin
    // importar cuantas veces haya cambiado el alias (la URL vieja muere,
    // el asset en Cloudinary no)
    let publicId = hero.imagePublicId;
    if (!publicId) {
      // Primera subida: el candidato derivado del slug se valida contra
      // los ids guardados de OTROS heroes. El namespace de Cloudinary es
      // global y un slug liberado por un rename puede ser reclamado por
      // otro heroe (superman -> Superman Prime, luego flash -> Superman):
      // sin el check, la subida del nuevo PISARIA el asset del anterior
      // (dos heroes con la misma imagen, corrupcion silenciosa). Sufijo
      // numerico acotado: nombres legibles en el dashboard
      const base = `heroes-app/${slugParam}`;
      publicId = base;
      for (let suffix = 2; ; suffix += 1) {
        // $ne ownerId: excluye al propio heroe, como en updateHero
        const taken = await Hero.exists({
          imagePublicId: publicId,
          _id: { $ne: hero._id },
        });
        if (!taken) break;
        publicId = `${base}-${suffix}`;
      }
    }

    const result = await uploadToCloudinary(buffer, publicId);

    // El formato lo agrega Cloudinary al public_id, por eso no va en el id.
    // Se guarda el public_id devuelto: es la identidad que las re-subidas
    // van a reutilizar
    hero.set('image', result.secure_url);
    hero.set('imagePublicId', result.public_id);
    await hero.save();

    return resp.json({
      msg: 'Image uploaded correctly.',
      response: hero,
    });
  } catch (error) {
    // El hero queda intacto: solo fallo la subida a Cloudinary. El front
    // puede reintentar la subida sin volver a crear el hero.
    console.error('Cloudinary upload failed:', error);
    return resp
      .status(500)
      .json({ msg: 'Error uploading image to Cloudinary.' });
  }
};
