import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for smaller Docker runtime images
  output: "standalone",
  // basePath: "/project",
};

export default nextConfig;
