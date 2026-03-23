'use strict';

const ticketService = require('../services/ticketService');
const { createServiceLogger } = require('@ticketing/shared');

const logger = createServiceLogger('ticket-controller');

const ticketController = {
  async list(req, res, next) {
    try {
      const { page = 1, limit = 20, status, priority } = req.query;
      const userId = req.headers['x-user-id'];
      const role = req.headers['x-user-role'];
      const result = await ticketService.listTickets({ page, limit, status, priority, userId, role });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async get(req, res, next) {
    try {
      const ticket = await ticketService.getTicket(req.params.id);
      res.json({ success: true, data: { ticket } });
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const userId = req.headers['x-user-id'];
      const ticket = await ticketService.createTicket({ ...req.body, createdBy: userId });
      logger.info('Ticket created', { ticketId: ticket.id, userId });
      res.status(201).json({ success: true, data: { ticket } });
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const userId = req.headers['x-user-id'];
      const role = req.headers['x-user-role'];
      const ticket = await ticketService.updateTicket(req.params.id, req.body, { userId, role });
      res.json({ success: true, data: { ticket } });
    } catch (err) { next(err); }
  },

  async assign(req, res, next) {
    try {
      const requestedBy = req.headers['x-user-id'];
      const role = req.headers['x-user-role'];
      const ticket = await ticketService.assignTicket(req.params.id, req.body.agentId, { requestedBy, role });
      res.json({ success: true, data: { ticket } });
    } catch (err) { next(err); }
  },

  async claim(req, res, next) {
    try {
      const agentId = req.headers['x-user-id'];
      const ticket = await ticketService.claimTicket(req.params.id, agentId);
      res.json({ success: true, data: { ticket } });
    } catch (err) { next(err); }
  },

  async addComment(req, res, next) {
    try {
      const userId = req.headers['x-user-id'];
      const comment = await ticketService.addComment(req.params.id, {
        body: req.body.body,
        isInternal: req.body.isInternal || false,
        authorId: userId,
      });
      res.status(201).json({ success: true, data: { comment } });
    } catch (err) { next(err); }
  },

  async getComments(req, res, next) {
    try {
      const comments = await ticketService.getComments(req.params.id);
      res.json({ success: true, data: { comments } });
    } catch (err) { next(err); }
  },

  async close(req, res, next) {
    try {
      const userId = req.headers['x-user-id'];
      const ticket = await ticketService.closeTicket(req.params.id, {
        userId,
        resolution: req.body.resolution,
      });
      res.json({ success: true, data: { ticket } });
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      const userId = req.headers['x-user-id'];
      const role = req.headers['x-user-role'];
      await ticketService.deleteTicket(req.params.id, { userId, role });
      res.status(204).end();
    } catch (err) { next(err); }
  },
};

module.exports = ticketController;
