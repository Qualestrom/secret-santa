import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';

function vercelApiDevPlugin(): Plugin {
  const apiUrl = pathToFileURL(path.resolve(__dirname, 'api/event.js')).href;

  const attachMiddleware = (middlewares: {
    use: (
      fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void
    ) => void;
  }) => {
    middlewares.use(async (req, res, next) => {
      const urlPath = (req.url || '/').split('?')[0];
      if (urlPath !== '/api/event') {
        next();
        return;
      }
      try {
        const mod = (await import(/* @vite-ignore */ apiUrl)) as {
          default: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
        };
        await mod.default(req, res);
      } catch (err) {
        console.error('[vite-api-dev] Failed to execute /api/event:', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Local API middleware error.' }));
      }
    });
  };

  return {
    name: 'vercel-api-dev',
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), vercelApiDevPlugin()],
});
