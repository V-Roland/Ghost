import express from 'express';
import { container } from '../services/cosmosClient.js';

export const archiveRouter = express.Router();

function userIdFromRequest(req) {
  return req.header('x-ghost-user-id') || process.env.DEMO_USER_ID || 'user-demo-nick';
}

archiveRouter.get('/interviews', async (req, res, next) => {
  try {
    const userId = userIdFromRequest(req);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.updatedAt DESC',
      parameters: [{ name: '@userId', value: userId }]
    };
    const { resources } = await container('Interviews').items.query(querySpec, { partitionKey: userId }).fetchAll();
    res.json({ interviews: resources });
  } catch (error) {
    next(error);
  }
});

archiveRouter.get('/interviews/:interviewId/files', async (req, res, next) => {
  try {
    const userId = userIdFromRequest(req);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.userId = @userId AND c.interviewId = @interviewId ORDER BY c.name ASC',
      parameters: [
        { name: '@userId', value: userId },
        { name: '@interviewId', value: req.params.interviewId }
      ]
    };
    const { resources } = await container('InterviewFiles').items.query(querySpec, { partitionKey: userId }).fetchAll();
    res.json({ files: resources });
  } catch (error) {
    next(error);
  }
});
