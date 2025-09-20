import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from Angular build
const angularDistPath = path.join(__dirname, '../../web/dist/web/browser');
app.use(express.static(angularDistPath));

// API routes
app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// Catch all handler: send back React's index.html file for client-side routing
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(angularDistPath, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
