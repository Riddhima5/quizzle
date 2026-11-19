import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf / pdfjs ship ESM + workers that should not be bundled into server routes.
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
