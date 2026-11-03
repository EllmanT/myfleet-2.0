import type { APIRoute } from 'astro';
import { siteUrl } from '../lib/links';

// Only indexable pages. /privacy and /terms are drafts and are noindex.
export const GET: APIRoute = () =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteUrl}/</loc></url></urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
