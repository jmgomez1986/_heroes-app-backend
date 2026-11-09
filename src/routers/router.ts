import { Router } from 'express';
import { body, query } from 'express-validator';
import { addHero, getHeroes } from '../handlers';
import { handleInputErrors } from '../middleware/validation';

export const router = Router();

// Routing
router.get(
  '/heroes',
  query('page').optional().isInt({ min: 1 }).withMessage('page must be an integer >= 1'),
  query('elements_per_page').optional().isInt({ min: 1, max: 50 }).withMessage('elements_per_page must be an integer between 1 and 50'),
  handleInputErrors,
  getHeroes,
);
router.post(
  '/hero',
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
