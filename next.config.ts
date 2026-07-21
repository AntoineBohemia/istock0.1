import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          // La camera n'est volontairement pas listee : sans directive, la
          // valeur par defaut est deja « self ». L'ecrire explicitement
          // n'ajoutait aucune restriction mais exposait a un refus pur sur
          // les Safari qui analysent mal la syntaxe « (self) » — sans invite
          // d'autorisation, donc sans recours pour l'utilisateur.
          key: "Permissions-Policy",
          value: "microphone=(), geolocation=()",
        },
        { key: "X-DNS-Prefetch-Control", value: "on" },
      ],
    },
  ],
};

export default nextConfig;
