import { proxyTokenRequest } from "@/lib/server/token-proxy";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { path = [] } = await context.params;
  return proxyTokenRequest(request, path);
}
