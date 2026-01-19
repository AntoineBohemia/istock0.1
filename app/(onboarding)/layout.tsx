import OrganizationProvider from "@/components/organization-provider";
import { MeshGradientBg } from "@/components/ui/mesh-gradient-bg";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OrganizationProvider>
      <MeshGradientBg />
      <main className="flex min-h-screen items-center justify-center p-4">
        {children}
      </main>
    </OrganizationProvider>
  );
}
