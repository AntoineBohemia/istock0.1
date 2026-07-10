import React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import GoogleAnalyticsInit from "@/lib/ga";
import { fontVariables } from "@/lib/fonts";
import NextTopLoader from "nextjs-toploader";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

import { ActiveThemeProvider } from "@/components/active-theme";
import { DEFAULT_THEME } from "@/lib/themes";

export const metadata: Metadata = {
  title: {
    default: "iStock",
    template: "%s | iStock",
  },
  description: "Gestion de stock de peintures et revetements pour les professionnels du BTP.",
  icons: {
    icon: "/icon.svg",
    apple: "/logo/istock-app.svg",
  },
  openGraph: {
    title: "iStock",
    description: "Gestion de stock de peintures et revetements pour les professionnels du BTP.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeSettings = {
    preset: (cookieStore.get("theme_preset")?.value ?? DEFAULT_THEME.preset) as any,
    scale: (cookieStore.get("theme_scale")?.value ?? DEFAULT_THEME.scale) as any,
    radius: (cookieStore.get("theme_radius")?.value ?? DEFAULT_THEME.radius) as any,
    contentLayout: (cookieStore.get("theme_content_layout")?.value ??
      DEFAULT_THEME.contentLayout) as any,
  };

  const bodyAttributes = Object.fromEntries(
    Object.entries(themeSettings)
      .filter(([_, value]) => value)
      .map(([key, value]) => [`data-theme-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`, value])
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={cn("bg-background group/layout font-sans", fontVariables)}
        {...bodyAttributes}
      >
        <NuqsAdapter>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <ActiveThemeProvider initialTheme={themeSettings}>
              {children}
              <NextTopLoader
                color="var(--primary)"
                showSpinner={false}
                height={2}
                shadow-sm="none"
              />
              {process.env.NODE_ENV === "production" ? <GoogleAnalyticsInit /> : null}
            </ActiveThemeProvider>
            <Toaster position="top-center" />
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
