import { Router } from 'express';
import { body, query } from 'express-validator';
import { addHero, deleteHero, getHeroes, updateHero } from '../handlers';
import { handleInputErrors } from '../middleware/validation';

export const router = Router();

// Ruteo
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
  handleInputErrors,
  getHeroes,
);
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
router.patch(
  '/heroes/:slug',
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
router.delete('/heroes/:slug', deleteHero);
