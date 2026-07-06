/** @type {import('next').NextConfig} */
const nextConfig = {
  // Statički export → Cloudflare Pages (SPA). Svi podaci se čitaju client-side
  // preko fiskal API-ja (Bearer JWT + X-Tenant-Id) — nema server runtimea.
  // Detalj računa koristi ?id= query param (bez dinamičkih SSR ruta),
  // pa export ostaje čist — isti obrazac kao pinka-finance/app.
  output: "export",
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
