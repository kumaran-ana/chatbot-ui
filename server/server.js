import dotenv from 'dotenv';
import { createApp, initAppDb } from './app.js';

dotenv.config();

const port = Number(process.env.PORT || 5050);
const app = createApp();

await initAppDb();

app.listen(port, () => {
  console.log(`SearchSomething API running on http://localhost:${port}`);
});
