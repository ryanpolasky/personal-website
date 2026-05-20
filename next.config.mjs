/** @type {import('next').NextConfig} */
const nextConfig = {
  // static export for Cloudflare Pages.
  output: "export",
  trailingSlash: true,
  // next/image can't optimize under `output: 'export'`; assets served as-is.
  images: { unoptimized: true },
};

export default nextConfig;
