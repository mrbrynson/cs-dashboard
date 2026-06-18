const ALLOWED_ORIGIN = 'https://mrbrynson.github.io';

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
    const hsResponse = await fetch(hsUrl, {
      method: request.method,
      headers: {
        'Authorization': 'Bearer ' + env.HS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: (request.method !== 'GET' && request.method !== 'HEAD') ? await request.text() : undefined,
    });
    const body = await hsResponse.text();
    return new Response(body, {
      status: hsResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
