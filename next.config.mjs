/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export so this can keep deploying to Cloudflare Pages as a static
  // bundle. If we later want server-side features, switch to the
  // `@cloudflare/next-on-pages` adapter.
  output: "export",
  // Cloudflare Pages serves trailing-slash directories. Avoid surprise 404s
  // when the user types /gallery without a trailing slash.
  trailingSlash: true,
  images: {
    // next/image's loader doesn't work with `output: 'export'` unless we
    // disable optimisation — we serve assets directly.
    unoptimized: true,
  },
  // The variant HTML files are checked in as static assets under
  // public/variants and must not be processed by webpack.
  webpack(config) {
    return config;
  },
};

export default nextConfig;
