/** @type {import('next').NextConfig} */
const nextConfig = {
  // Statički export koji servira fiskal Worker kao static assets na /app
  // (backend: wrangler.toml [assets], scripts/build-app.sh). API je na istom
  // originu (/api/v1, kolačić sesije), pa nema CORS-a ni varijabli po okolini.
  // Detalj računa koristi ?id= query param (bez dinamičkih ruta), pa export
  // ostaje čist. trailingSlash ostaje false: Workers assets (auto-trailing-slash)
  // /app/dashboard serviraju iz dashboard.html.
  output: "export",
  basePath: "/app",
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
