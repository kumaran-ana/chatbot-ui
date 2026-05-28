import dotenv from 'dotenv';
import { createApp } from '../server/app.js';

dotenv.config();

const app = createApp();

export default app;
