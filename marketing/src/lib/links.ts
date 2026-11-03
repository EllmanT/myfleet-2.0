import { wa } from '../content/site';

const env = import.meta.env;
const trim = (s: string) => s.replace(/\/+$/, '');

export const appUrl = trim(env.PUBLIC_APP_URL || 'https://app.example.com');
export const siteUrl = trim(env.PUBLIC_SITE_URL || 'https://myfleet.example.com');
export const whatsappNumber = String(env.PUBLIC_WHATSAPP_NUMBER || '263000000000').replace(/\D/g, '');
export const plausibleDomain: string = env.PUBLIC_PLAUSIBLE_DOMAIN || '';

/** Sign-up is a plain link to the app. */
export const signUpUrl = `${appUrl}/sign-up`;
export const signInUrl = `${appUrl}/login`;

/** wa.me link with a prefilled message. No query-string tracking: WhatsApp drops it. */
export const waLink = (text: string) => `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;

export const waHero = waLink(wa.hero);
export const waQuestion = waLink(wa.question);
export const waPricing = waLink(wa.pricing);
export const waQr = waLink(wa.qr);
