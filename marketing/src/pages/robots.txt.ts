import type { APIRoute } from 'astro';
import { siteUrl } from '../lib/links';

// /privacy and /terms are kept out of search with a noindex meta tag, not here: a crawler
// has to be allowed to fetch a page to see its noindex.
export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
