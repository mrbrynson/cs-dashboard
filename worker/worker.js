const ALLOWED_ORIGIN = 'https://mrbrynson.github.io';
const CACHE_TTL = 3600; // 1 hour

// Simple hash for POST body -> short cache key suffix
function hashStr(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h, 33) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);
    const hsUrl = 'https://api.hubapi.com' + url.pathname + url.search;

    // Read body once (needed for both cache key and HubSpot fetch)
    let bodyText = '';
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      bodyText = await request.text();
    }

    // Build a stable GET-style cache key (cache API requires GET)
    const cacheKeyUrl = hsUrl + (bodyText ? '?_h=' + hashStr(bodyText) : '');
    const cacheKey = new Request(cacheKeyUrl, { method: 'GET' });
    const cache = caches.default;

    // Check Cloudflare edge cache
    const cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
      headers.set('X-Cache', 'HIT');
      return new Response(cached.body, { status: cached.status, headers });
    }

    // Cache miss — call HubSpot
    const hsResponse = await fetch(hsUrl, {
      method: request.method,
      headers: {
        'Authorization': 'Bearer ' + env.HS_TOKEN,
        'Content-Type': 'application/json',
      },
      body: bodyText || undefined,
    });

    const body = await hsResponse.text();

    // Cache successful responses for CACHE_TTL seconds
    if (hsResponse.ok) {
      const toCache = new Response(body, {
        status: hsResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=' + CACHE_TTL,
        },
      });
      ctx.waitUntil(cache.put(cacheKey, toCache));
    }

    return new Response(body, {
      status: hsResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    });
  },
};
