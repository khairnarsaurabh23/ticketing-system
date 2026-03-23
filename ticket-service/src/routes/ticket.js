'use strict';

const { Router } = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const ticketController = require('../controllers/ticketController');

const router = Router();

// ─── List tickets ─────────────────────────────────────────────────────────────
// GET /tickets?page=1&limit=20&status=open&priority=high
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']),
    query('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  ],
  validate,
  ticketController.list,
);

// ─── Get single ticket ────────────────────────────────────────────────────────
router.get(
  '/:id',
  [param('id').isUUID().withMessage('Invalid ticket ID')],
  validate,
  ticketController.get,
);

// ─── Create ticket ────────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('title').trim().notEmpty().isLength({ max: 255 }).withMessage('Title required (max 255 chars)'),
    body('description').trim().notEmpty().withMessage('Description required'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
    body('category').optional().trim().isLength({ max: 100 }),
  ],
  validate,
  ticketController.create,
);

// ─── Update ticket ────────────────────────────────────────────────────────────
router.patch(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid ticket ID'),
    body('title').optional().trim().isLength({ max: 255 }),
    body('description').optional().trim().notEmpty(),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
    body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']),
    body('category').optional().trim().isLength({ max: 100 }),
  ],
  validate,
  ticketController.update,
);

// ─── Assign ticket to agent ───────────────────────────────────────────────────
// Uses Redlock to prevent double-assignment in concurrent scenarios
router.post(
  '/:id/assign',
  [
    param('id').isUUID().withMessage('Invalid ticket ID'),
    body('agentId').notEmpty().withMessage('agentId required'),
  ],
  validate,
  ticketController.assign,
);

// ─── Claim ticket (self-assign) ───────────────────────────────────────────────
// Agent claims an unassigned ticket atomically via Redlock
router.post(
  '/:id/claim',
  [param('id').isUUID().withMessage('Invalid ticket ID')],
  validate,
  ticketController.claim,
);

// ─── Add comment ─────────────────────────────────────────────────────────────
router.post(
  '/:id/comments',
  [
    param('id').isUUID().withMessage('Invalid ticket ID'),
    body('body').trim().notEmpty().withMessage('Comment body required'),
    body('isInternal').optional().isBoolean().toBoolean(),
  ],
  validate,
  ticketController.addComment,
);

// ─── Get comments ─────────────────────────────────────────────────────────────
router.get(
  '/:id/comments',
  [param('id').isUUID().withMessage('Invalid ticket ID')],
  validate,
  ticketController.getComments,
);

// ─── Close ticket ─────────────────────────────────────────────────────────────
router.post(
  '/:id/close',
  [
    param('id').isUUID().withMessage('Invalid ticket ID'),
    body('resolution').optional().trim(),
  ],
  validate,
  ticketController.close,
);

// ─── Delete ticket ────────────────────────────────────────────────────────────
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Invalid ticket ID')],
  validate,
  ticketController.remove,
);

module.exports = router;
