/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The messaging API authenticates with a shared, KMS-encrypted token sent as the raw
 * `Authorization` header (see chime-messaging-go-api/middleware/auth.go). That token must
 * never be bundled into browser code, so the browser calls a relative `/api` path and this
 * dev/preview proxy attaches the header server-side.
 *
 * MESSAGING_API_URL and MESSAGING_API_TOKEN deliberately have no `VITE_` prefix, so Vite
 * never exposes them to client code.
 */
export default defineConfig(({ mode }) => {
  // '' prefix = load every variable from .env files, but only into this Node process.
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.MESSAGING_API_URL;
  const token = env.MESSAGING_API_TOKEN;

  const proxy: Record<string, ProxyOptions> | undefined = target
    ? {
        '/api': {
          target,
          changeOrigin: true,
          secure: true,
          configure: (proxyServer) => {
            proxyServer.on('proxyReq', (proxyReq) => {
              // Never forward anything the browser may have sent; always use the server-side token.
              proxyReq.removeHeader('authorization');
              proxyReq.removeHeader('cookie');
              if (token) proxyReq.setHeader('Authorization', token);
            });
          },
        },
      }
    : undefined;

  if (!target && mode !== 'test') {
    console.warn('[search-messaging-channels] MESSAGING_API_URL is not set; /api requests will fail. See README.');
  }
  if (target && !token && mode !== 'test') {
    console.warn('[search-messaging-channels] MESSAGING_API_TOKEN is not set; the API will reject requests if ENABLE_AUTH=true.');
  }

  return {
    plugins: [react()],
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  };
});
