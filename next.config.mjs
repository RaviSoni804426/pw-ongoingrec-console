/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The console never proxies audio; it only ever handles metadata and
  // pre-signed URLs, so no rewrites to object storage are configured here.
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
