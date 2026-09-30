import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const authApi = process.env.AUTH_API_INTERNAL_URL ?? "http://localhost:8081";
    const callApi = process.env.CALL_API_INTERNAL_URL ?? "http://localhost:8082";

    return [
      { source: "/api/auth/:path*", destination: `${authApi}/api/auth/:path*` },
      { source: "/api/calls/:path*", destination: `${callApi}/api/calls/:path*` },
    ];
  },
};

export default nextConfig;
