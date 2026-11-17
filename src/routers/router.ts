import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { raw } from 'express';
import {
  addHero,
  deleteHero,
  getHeroBySlug,
  getHeroes,
  updateHero,
  addHeroImage,
  getHeroesStats,
} from '../handlers';
import { handleInputErrors } from '../middleware/validation';
import {
  HERO_SLUG_PATTERN,
  FILTERABLE_TEXT_FIELDS,
} from '../constants/default.constants';

export const router = Router();

// Contrato de formato del `:slug`, compartido por TODAS las rutas que lo
// usan (GET, PATCH, DELETE, POST image). `values: 'falsy'`: un slug vacio
// ('', null, undefined) cuenta como inexistente, para que el error sea
// "Slug is required" y no el de formato.
const slugParamRules = () =>
  param('slug')
    .exists({ values: 'falsy' })
    .withMessage('Slug is required')
    .matches(HERO_SLUG_PATTERN)
    .withMessage(
      'Slug must be lowercase alphanumeric words separated by single hyphens',
    );

/* -------------------
     Ruteo
-------------------- */
/* GET /api/heroes */
router.get(
  '/heroes',
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be an integer >= 1'),
  query('elements_per_page')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('elements_per_page must be an integer between 1 and 50'),
  // Filtros generados desde la whitelist: agregar un campo a
  // FILTERABLE_TEXT_FIELDS agrega su validacion aca sin tocar el router
  ...FILTERABLE_TEXT_FIELDS.map((field) =>
    query(field).optional().isString().withMessage(`${field} must be a string`),
  ),
  handleInputErrors,
  getHeroes,
);
/* GET /api/heroes/stats */
// Devuelve los stats como Total de heroes, Total de Villanos, Total del catalogo
// Declarada ANTES de /heroes/:slug: Express matchea en orden de registro y
// si la dinamica va primera, capturaria 'stats' como slug (404 Hero not found)
router.get('/heroes/stats', getHeroesStats);
/* GET /api/heroes/:slug */
router.get('/heroes/:slug', slugParamRules(), handleInputErrors, getHeroBySlug);
/* POST /heroes */
router.post(
  '/heroes',
  body('name').notEmpty().withMessage('Name is required'),
  body('alias').notEmpty().withMessage('Alias is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('team').notEmpty().withMessage('Team is required'),
  body('status').notEmpty().withMessage('Status is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('universe').notEmpty().withMessage('Universe is required'),
  handleInputErrors,
  addHero,
);
/* PATCH /api/heroes/:slug */
router.patch(
  '/heroes/:slug',
  slugParamRules(),
  body('description')
    .optional()
    .notEmpty()
    .withMessage('Description cannot be empty'),
  body('team').optional().notEmpty().withMessage('Team cannot be empty'),
  body('status').optional().notEmpty().withMessage('Status cannot be empty'),
  body('category')
    .optional()
    .notEmpty()
    .withMessage('Category cannot be empty'),
  body('universe')
    .optional()
    .notEmpty()
    .withMessage('Universe cannot be empty'),
  body('powers')
    .optional()
    .isArray({ min: 0 })
    .withMessage('Powers must be an array'),
  handleInputErrors,
  updateHero,
);
/* DELETE /api/:slug */
router.delete(
  '/heroes/:slug',
  slugParamRules(),
  // Fix: sin esto, los errores de validacion nunca se chequeaban y el
  // handler corria igual (un slug mal formado devolvia 404 en vez de 400)
  handleInputErrors,
  deleteHero,
);
/* POST /api/heroes/:slug/image */
// Upload de imagen del hero: binario crudo como body (no multipart).
// El límite lo corta el parser mismo: si pasa 1mb, lanza error demasiado grande.
router.post(
  '/heroes/:slug/image',
  slugParamRules(),
  raw({
    type: ['image/png', 'image/jpeg'], // solo acepta ese Content-Type, el resto da 415
    limit: '1mb', // misma regla que muestra el front
  }),
  handleInputErrors,
  addHeroImage,
);
