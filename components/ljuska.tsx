"use client";

// Zajednička ljuska dashboard stranica: AuthGate (prijava) → Header (tenant
// switcher) → sadržaj. Ako korisnik nema nijedan membership, jasna poruka —
// pristup otvara superuser u fiskal adminu (nema samoregistracije u v1).

import { AuthGate } from "@/lib/auth";
import { useTenant } from "@/lib/tenant";
import { Header } from "@/components/header";

export function DashboardLjuska({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <TenantStraza>{children}</TenantStraza>
      </main>
      <footer className="px-6 pb-8 pt-4 text-center text-xs text-muted">
        domovina-fiskal — open-source servis za HR fiskalizirane račune
      </footer>
    </AuthGate>
  );
}

function TenantStraza({ children }: { children: React.ReactNode }) {
  const { tenanti, odabrani, ucitavanje, greska } = useTenant();

  if (ucitavanje) return <p className="py-16 text-center text-muted">Učitavanje tenanata…</p>;
  if (greska) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-rub bg-povrsina p-6 text-sm">
        <p className="font-semibold text-opasnost">Dohvat tenanata nije uspio</p>
        <p className="mt-2 text-muted">{greska}</p>
      </div>
    );
  }
  if (!tenanti.length || !odabrani) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-rub bg-povrsina p-6 text-sm">
        <p className="font-semibold">Nemaš pristup nijednom tenantu.</p>
        <p className="mt-2 text-muted">
          Pristup dashboardu dodjeljuje administrator servisa (po e-mail adresi kojom si
          prijavljen/a). Ako bi ovdje trebao/la vidjeti svoju firmu, javi se administratoru.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
