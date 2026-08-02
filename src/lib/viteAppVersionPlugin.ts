import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

export type AppVersionPayload = {
  buildId: string;
  builtAt: string;
};

export function createBuildId(): string {
  return (
    process.env.VITE_APP_BUILD_ID?.trim() ||
    process.env.BUILD_ID?.trim() ||
    `dev-${Date.now()}`
  );
}

/** Emits /version.json and injects __APP_BUILD_ID__ for update detection. */
export function appVersionPlugin(buildId: string): Plugin {
  const payload: AppVersionPayload = {
    buildId,
    builtAt: new Date().toISOString(),
  };
  const body = `${JSON.stringify(payload, null, 2)}\n`;

  return {
    name: 'app-version',
    config() {
      return {
        define: {
          __APP_BUILD_ID__: JSON.stringify(buildId),
          'import.meta.env.VITE_APP_BUILD_ID': JSON.stringify(buildId),
        },
      };
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url === '/version.json') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(body);
          return;
        }
        next();
      });
    },
    writeBundle(outputOptions) {
      const dir = outputOptions.dir;
      if (!dir) return;
      fs.writeFileSync(path.join(dir, 'version.json'), body, 'utf8');
    },
  };
}
