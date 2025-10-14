import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for smaller Docker runtime images
  output: "standalone",
};

export default nextConfig;
