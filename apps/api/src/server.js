import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { archiveRouter } from './routes/archive.js';
import { interviewsRouter } from './routes/interviews.js';

const app = express();
const port = process.env.PORT || 7071;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ghost-api' });
});

app.use('/api/archive', archiveRouter);
app.use('/api/interviews', interviewsRouter);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Ghost API listening on http://localhost:${port}`);
});
