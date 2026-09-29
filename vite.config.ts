import { cloudflare } from '@cloudflare/vite-plugin';
import { fileURLToPath } from 'node:url';
import vinext from 'vinext';
import { defineConfig } from 'vite';

const cloudflareBuild = process.env.TACHYON_CLOUDFLARE_BUILD === '1';

export default defineConfig({
  plugins: [
    vinext(),
    ...(cloudflareBuild
      ? [
          cloudflare({
            viteEnvironment: {
              name: 'rsc',
              childEnvironments: ['ssr'],
            },
          }),
        ]
      : []),
  ],
  resolve: cloudflareBuild
    ? undefined
    : {
        alias: {
          'cloudflare:workers': fileURLToPath(new URL('./lib/cloudflare-workers-local.ts', import.meta.url)),
        },
      },
});
