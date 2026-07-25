import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';
import v1Router from './src/routes/index.js';
import errorHandler from './src/middleware/errorHandler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(express.static(join(__dirname, 'public')));

app.use(express.json());

app.use('/', v1Router);

app.use(errorHandler);

export default app;
