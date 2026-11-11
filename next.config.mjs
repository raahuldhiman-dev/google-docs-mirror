/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a second server (e.g. a production build check) run without clobbering the dev server's .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // libSQL ships native binaries; keep it external so Vercel's file tracing includes the right ones.
  experimental: { serverComponentsExternalPackages: ["@libsql/client", "libsql"] },
};

export default nextConfig;
