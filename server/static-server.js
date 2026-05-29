import express from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || 8080);
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectoryPath = path.dirname(currentFilePath);
const distDirectoryPath = path.resolve(currentDirectoryPath, '../dist');
const indexFilePath = path.join(distDirectoryPath, 'index.html');
let indexFileContent;

try {
  indexFileContent = await readFile(indexFilePath, 'utf8');
} catch (error) {
  console.error(`Failed to load ${indexFilePath}`, error);
  process.exit(1);
}

const app = express();

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'SearchSomething UI' });
});

app.use(express.static(distDirectoryPath));

app.get('*', (_request, response) => {
  response.type('html').send(indexFileContent);
});

app.listen(port, () => {
  console.log(`SearchSomething UI running on http://localhost:${port}`);
});
