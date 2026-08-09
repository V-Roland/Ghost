import 'dotenv/config';
import { createGhostApiApp } from './app.js';

const port = process.env.PORT || 7071;
const app = createGhostApiApp();

app.listen(port, () => {
  console.log(`Ghost API listening on http://localhost:${port}`);
});
