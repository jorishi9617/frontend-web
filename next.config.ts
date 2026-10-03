import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    auth_api_url: process.env.auth_api_url ?? "https://auth-service-a3w5.onrender.com",
    call_api_url: process.env.call_api_url ?? "https://call-service-niag.onrender.com",
    signaling_url: process.env.signaling_url ?? "wss://video-platform-signaling.onrender.com/ws",
  },
  async rewrites() {
    const authApi = process.env.AUTH_API_INTERNAL_URL ?? "http://localhost:8081";
    const callApi = process.env.CALL_API_INTERNAL_URL ?? "http://localhost:8082";

    return [
      { source: "/api/auth", destination: `${authApi}/api/auth` },
      { source: "/api/auth/:path*", destination: `${authApi}/api/auth/:path*` },
      { source: "/api/calls", destination: `${callApi}/api/calls` },
      { source: "/api/calls/:path*", destination: `${callApi}/api/calls/:path*` },
    ];
  },
};

export default nextConfig;
