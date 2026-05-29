import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || 8080);
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectoryPath = path.dirname(currentFilePath);
const distDirectoryPath = path.resolve(currentDirectoryPath, '../dist');
const indexFilePath = path.join(distDirectoryPath, 'index.html');

const app = express();

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'SearchSomething UI' });
});

app.use(express.static(distDirectoryPath));

app.get('*', (_request, response) => {
  response.sendFile(indexFilePath);
});

app.listen(port, () => {
  console.log(`SearchSomething UI running on http://localhost:${port}`);
});
