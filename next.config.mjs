/** @type {import('next').NextConfig} */

/**
 * Where the API actually lives. Server-side only — the browser never sees it.
 *
 * Falls back to localhost so `npm run dev` works against a local backend with
 * no configuration.
 */
const API_ORIGIN = process.env.API_PROXY_TARGET ?? 'http://localhost:3000/api/v1';

const nextConfig = {
  reactStrictMode: true,

  // The console never proxies audio; it only ever handles metadata and
  // pre-signed URLs. Playback goes straight from the browser to object storage.
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },

  /**
   * The API is served from the console's own origin.
   *
   * The browser calls `/api/backend/...` on the console host, and Next forwards
   * it to the API server. Same origin, so there is no preflight and no CORS at
   * all.
   *
   * This exists because the alternative — the browser calling the API host
   * directly — made the whole console depend on one environment variable being
   * correct on the API server. When it drifted (a redeploy changes the Vercel
   * URL) the only symptom was "Failed to fetch" on the login form, which reads
   * as a broken login rather than a stale allow-list. That cost several rounds
   * to diagnose more than once.
   *
   * The cost is that metadata requests hop through Vercel. Audio does not: the
   * stream endpoint returns a pre-signed URL and the browser fetches the bytes
   * from object storage directly, which is the traffic that actually matters.
   */
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${API_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;
