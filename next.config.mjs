/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pg', '@vercel/functions'],
    outputFileTracingIncludes: {
      '/private/regime': [
        './research/regime-validation/results.json',
        './research/regime-validation/replay-results.json',
      ],
    },
  },
};

export default nextConfig;
