"use client";

// Klijentski omotač providera — layout ostaje server komponenta (metadata).
import { AuthProvider } from "@/lib/auth";
import { TenantProvider } from "@/lib/tenant";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TenantProvider>{children}</TenantProvider>
    </AuthProvider>
  );
}
