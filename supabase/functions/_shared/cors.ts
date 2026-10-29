// The functions the app calls, opened to the app in a browser: the Telegram
// mini app is a page (docs/telegram.md), and a page's request to another
// origin is preceded by the browser's own question, which gets its answer here.
// The phone never asks, and a reply to it is the same with the headers added.

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function withCors(handler: (request: Request) => Response | Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
    const response = await handler(request);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(HEADERS)) headers.set(name, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };
}
