/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Body limit for proxied requests (important for multipart uploads in App Router).
    proxyClientMaxBodySize: 50 * 1024 * 1024,
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
  // ...
};