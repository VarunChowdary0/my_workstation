import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for smaller Docker runtime images
  output: "standalone",
  // basePath: "/project",
  async rewrites() {
    return [
      {
        source: "/dev-preview/:port/:path*",
        destination: "http://localhost::port/:path*",
      },
    ];
  },
};

export default nextConfig;
