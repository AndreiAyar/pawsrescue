import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";

const maplibreCompat = fileURLToPath(
  new URL("./app/components/Map/maplibre-compat.ts", import.meta.url),
);

const withNextIntl = createNextIntlPlugin("./i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  agentRules: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  webpack(config) {
    config.resolve.alias["maplibre-gl$"] = maplibreCompat;
    return config;
  },
};

export default withNextIntl(nextConfig);
