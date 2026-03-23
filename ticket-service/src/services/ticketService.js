'use strict';

const { v4: uuidv4 } = require('uuid');
const TicketModel = require('../models/ticketModel');
const CommentModel = require('../models/commentModel');
const { withLock, getRedisClient, createServiceLogger, NotFoundError, ForbiddenError, ConflictError } = require('@ticketing/shared');

const logger = createServiceLogger('ticket-service');

// Redis cache TTL for individual ticket reads (seconds)
const TICKET_CACHE_TTL = 60;

const ticketService = {
  // ─── List ──────────────────────────────────────────────────────────────────

  async listTickets({ page, limit, status, priority, userId, role }) {
    const offset = (page - 1) * limit;
    // Non-admin users only see their own tickets
    const ownerId = role === 'admin' || role === 'agent' ? null : userId;
    const { tickets, total } = await TicketModel.findAll({ offset, limit, status, priority, ownerId });
    return {
      tickets,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  },

  // ─── Get single ticket (cached) ────────────────────────────────────────────

  async getTicket(id) {
    const cacheKey = `ticket:${id}`;
    const cached = await getRedisClient().get(cacheKey);
    if (cached) {
      logger.debug('Cache HIT', { ticketId: id });
      return JSON.parse(cached);
    }

    const ticket = await TicketModel.findById(id);
    if (!ticket) throw new NotFoundError('Ticket');

    await getRedisClient().setex(cacheKey, TICKET_CACHE_TTL, JSON.stringify(ticket));
    return ticket;
  },

  // ─── Create ────────────────────────────────────────────────────────────────

  async createTicket({ title, description, priority = 'medium', category, createdBy }) {
    const id = uuidv4();
    const ticketNumber = await this._nextTicketNumber();

    const ticket = await TicketModel.create({
      id,
      ticketNumber,
      title,
      description,
      priority,
      category: category || null,
      status: 'open',
      createdBy,
    });

    logger.info('Ticket created', { id, ticketNumber });
    return ticket;
  },

  // ─── Update ────────────────────────────────────────────────────────────────

  async updateTicket(id, updates, { userId, role }) {
    // Acquire a distributed lock so concurrent updates don't clobber each other
    return withLock(`lock:ticket:${id}`, 5_000, async () => {
      const ticket = await TicketModel.findById(id);
      if (!ticket) throw new NotFoundError('Ticket');

      // Only owner or admin/agent can update
      if (ticket.created_by !== userId && role !== 'admin' && role !== 'agent') {
        throw new ForbiddenError('You do not have permission to update this ticket');
      }

      const allowed = ['title', 'description', 'priority', 'status', 'category'];
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([k]) => allowed.includes(k)),
      );

      const updated = await TicketModel.update(id, filteredUpdates);
      await getRedisClient().del(`ticket:${id}`);  // invalidate cache
      return updated;
    });
  },

  // ─── Assign ────────────────────────────────────────────────────────────────
  /**
   * Assign a ticket to a specific agent.
   * Protected by Redlock to prevent two supervisors simultaneously assigning
   * the same ticket to different agents.
   */
  async assignTicket(id, agentId, { requestedBy, role }) {
    if (role !== 'admin' && role !== 'agent') {
      throw new ForbiddenError('Only admins or senior agents can assign tickets');
    }

    return withLock(`lock:ticket:${id}`, 8_000, async () => {
      const ticket = await TicketModel.findById(id);
      if (!ticket) throw new NotFoundError('Ticket');

      if (ticket.status === 'closed' || ticket.status === 'resolved') {
        throw new ConflictError(`Cannot assign a ${ticket.status} ticket`);
      }

      const updated = await TicketModel.update(id, {
        assigned_to: agentId,
        status: 'in_progress',
      });

      await getRedisClient().del(`ticket:${id}`);
      logger.info('Ticket assigned', { ticketId: id, agentId, requestedBy });
      return updated;
    });
  },

  // ─── Claim ─────────────────────────────────────────────────────────────────
  /**
   * Agent self-assigns an open, unassigned ticket.
   * Critical section protected by Redlock — prevents two agents from
   * simultaneously claiming the same ticket under high load.
   */
  async claimTicket(id, agentId) {
    return withLock(`lock:ticket:${id}`, 8_000, async () => {
      const ticket = await TicketModel.findById(id);
      if (!ticket) throw new NotFoundError('Ticket');

      if (ticket.assigned_to) {
        throw new ConflictError('Ticket is already assigned to another agent');
      }

      if (ticket.status !== 'open') {
        throw new ConflictError(`Cannot claim a ticket with status "${ticket.status}"`);
      }

      const updated = await TicketModel.update(id, {
        assigned_to: agentId,
        status: 'in_progress',
      });

      await getRedisClient().del(`ticket:${id}`);
      logger.info('Ticket claimed', { ticketId: id, agentId });
      return updated;
    });
  },

  // ─── Close ─────────────────────────────────────────────────────────────────

  async closeTicket(id, { userId, resolution }) {
    return withLock(`lock:ticket:${id}`, 5_000, async () => {
      const ticket = await TicketModel.findById(id);
      if (!ticket) throw new NotFoundError('Ticket');

      if (ticket.status === 'closed') {
        throw new ConflictError('Ticket is already closed');
      }

      const updated = await TicketModel.update(id, {
        status: 'closed',
        resolution: resolution || null,
        resolved_at: new Date(),
        resolved_by: userId,
      });

      await getRedisClient().del(`ticket:${id}`);
      logger.info('Ticket closed', { ticketId: id, userId });
      return updated;
    });
  },

  // ─── Delete ────────────────────────────────────────────────────────────────

  async deleteTicket(id, { userId, role }) {
    if (role !== 'admin') throw new ForbiddenError('Only admins can delete tickets');

    const ticket = await TicketModel.findById(id);
    if (!ticket) throw new NotFoundError('Ticket');

    await TicketModel.remove(id);
    await getRedisClient().del(`ticket:${id}`);
    logger.info('Ticket deleted', { ticketId: id, userId });
  },

  // ─── Comments ──────────────────────────────────────────────────────────────

  async addComment(ticketId, { body, isInternal, authorId }) {
    const ticket = await TicketModel.findById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');

    const comment = await CommentModel.create({
      id: uuidv4(),
      ticketId,
      body,
      isInternal,
      authorId,
    });
    return comment;
  },

  async getComments(ticketId) {
    const ticket = await TicketModel.findById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');
    return CommentModel.findByTicketId(ticketId);
  },

  // ─── Private ───────────────────────────────────────────────────────────────

  async _nextTicketNumber() {
    // Atomic increment in Redis → globally unique sequential ticket numbers
    // Safe in a cluster because Redis is single-threaded and INCR is atomic.
    const num = await getRedisClient().incr('counter:ticket_number');
    return `TKT-${String(num).padStart(6, '0')}`;
  },
};

module.exports = ticketService;
