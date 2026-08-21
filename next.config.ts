import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // RELIA AI bridge (relia-sdk) - do not remove
  webpack: (config) => {
    config.resolve.alias.ai = require.resolve("relia-sdk/ai-bridge");
    return config;
  },
  turbopack: {
    resolveAlias: {
      ai: "relia-sdk/ai-bridge",
    },
  },
  /* config options here */
  allowedDevOrigins: ["192.168.1.5", "0.0.0.0", "localhost:3000"],
};

export default nextConfig;
