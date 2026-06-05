/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Build "standalone": gera .next/standalone/server.js com deps mínimas,
  // ideal para a imagem Docker self-hosted (runner slim).
  output: "standalone",
  // Pacotes do workspace (.ts cru) precisam ser transpilados pelo Next.
  transpilePackages: ["@previa/contracts"],
  // pdfkit usa arquivos .afm de fontes (Adobe Font Metrics) lidos do disco em
  // runtime. Externalizar evita que o webpack tente bundlar (e perca os assets).
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
  },
};

export default nextConfig;
