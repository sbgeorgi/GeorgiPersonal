const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response = await env.ASSETS.fetch(request);

    if (response.status !== 404 || request.method !== "GET") {
      return response;
    }

    const fallbackPath = url.pathname.endsWith("/")
      ? `${url.pathname}index.html`
      : `${url.pathname}.html`;
    const fallbackUrl = new URL(fallbackPath, request.url);
    response = await env.ASSETS.fetch(new Request(fallbackUrl, request));
    return response;
  },
};

export default worker;
