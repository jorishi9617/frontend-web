export async function proxyTokenRequest(request: Request, path: string[]) {
  if (path.some((segment) => segment !== "validate")) {
    return Response.json({ error: "Token API route not found" }, { status: 404 });
  }

  const tokenApiUrl = process.env.TOKEN_API_URL;
  const tokenApiKey = process.env.TOKEN_API_KEY;

  if (!tokenApiUrl || !tokenApiKey) {
    return Response.json({ error: "Token API proxy is not configured" }, { status: 503 });
  }

  const encodedPath = path.map(encodeURIComponent).join("/");
  const target = new URL(
    `/api/tokens${encodedPath ? `/${encodedPath}` : ""}`,
    tokenApiUrl,
  );
  target.search = new URL(request.url).search;

  const body = await request.arrayBuffer();
  const upstream = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
      "X-API-Key": tokenApiKey,
    },
    body: body.byteLength > 0 ? body : undefined,
    cache: "no-store",
  });

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}
