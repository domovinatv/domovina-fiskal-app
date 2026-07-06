"use client";

// Zaglavlje dashboarda: brand + navigacija + TENANT DROPDOWN + odjava.
// Trobojnica i logo prate fiskal /admin (isti DOMOVINA shell).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenant";

const NAV = [
  { put: "/dashboard", naziv: "Računi" },
  { put: "/dashboard/novi", naziv: "Novi dokument" },
  { put: "/dashboard/proizvodi", naziv: "Proizvodi" },
  { put: "/dashboard/postavke", naziv: "Postavke" },
];

export function Header() {
  const { user, signOut } = useAuth();
  const { tenanti, odabrani, odaberi } = useTenant();
  const pathname = usePathname();

  return (
    <>
      <div className="flex h-1.5">
        <span className="flex-1 bg-crvena" />
        <span className="flex-1 bg-white" />
        <span className="flex-1 bg-navy" />
      </div>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rub px-6 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-extrabold tracking-wide">
            DOMOVINA<span className="text-crvena">.FISKAL</span>
          </span>
        </Link>

        <nav className="flex gap-4 text-sm font-semibold">
          {NAV.map((n) => (
            <Link
              key={n.put}
              href={n.put}
              className={pathname === n.put ? "text-crvena" : "text-navy hover:text-crvena"}
            >
              {n.naziv}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {tenanti.length > 0 ? (
            <label className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted" aria-hidden />
              <select
                value={odabrani?.tenantId ?? ""}
                onChange={(e) => odaberi(Number(e.target.value))}
                className="rounded-lg border border-rub bg-white px-2 py-1.5 text-sm font-semibold text-navy focus:border-navy/40 focus:outline-none"
                aria-label="Odabir tenanta"
              >
                {tenanti.map((t) => (
                  <option key={t.tenantId} value={t.tenantId}>
                    {t.naziv} ({t.uloga})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {user ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex items-center gap-1.5 text-sm text-muted hover:text-navy"
              title={user.email ?? undefined}
            >
              <LogOut className="h-4 w-4" aria-hidden /> Odjava
            </button>
          ) : null}
        </div>
      </header>
    </>
  );
}
