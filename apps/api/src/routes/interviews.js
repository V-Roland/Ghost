import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { container } from '../services/cosmosClient.js';

export const interviewsRouter = express.Router();

function userIdFromRequest(req) {
  return req.header('x-ghost-user-id') || process.env.DEMO_USER_ID || 'user-demo-nick';
}

interviewsRouter.post('/', async (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const userId = userIdFromRequest(req);
    const tenantId = req.header('x-ghost-tenant-id') || process.env.DEMO_TENANT_ID || 'tenant-demo';
    const body = req.body || {};

    const item = {
      id: uuidv4(),
      tenantId,
      userId,
      jobPostingTitle: body.jobPostingTitle || 'Untitled Job Posting',
      candidateName: body.candidateName || 'Unnamed Candidate',
      interviewDate: body.interviewDate || now.slice(0, 10),
      status: 'Draft',
      archivePath: `${body.jobPostingTitle || 'Untitled Job Posting'}/${body.candidateName || 'Unnamed Candidate'} - ${body.interviewDate || now.slice(0, 10)}`,
      tags: body.tags || [],
      signalLevel: 'None',
      createdAt: now,
      updatedAt: now
    };

    const { resource } = await container('Interviews').items.create(item);
    res.status(201).json({ interview: resource });
  } catch (error) {
    next(error);
  }
});
