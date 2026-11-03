import { defineConfig } from 'astro/config';

// Fully static output. No UI framework, no client JavaScript.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://myfleet.example.com',
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'always', // one fewer blocking request on slow networks
  },
  compressHTML: true,
});
