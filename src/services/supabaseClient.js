/**
 * Cliente Supabase oficial com suporte a variáveis de ambiente e fallback gracioso.
 */

import { createClient } from '@supabase/supabase-js';

function normalizeUrl(url) {
  if (!url) return '';
  return url.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseUrl = normalizeUrl(rawUrl);
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(
  supabaseUrl &&
  supabasePublishableKey &&
  !supabaseUrl.includes('sua-url-aqui') &&
  !supabasePublishableKey.includes('sua-chave')
);

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export function isSupabaseReady() {
  return isConfigured && supabase !== null;
}
