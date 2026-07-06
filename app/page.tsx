"use client";

// Ulazna stranica — samo preusmjeri na dashboard (AuthGate tamo traži prijavu).
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Pocetna() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return <p className="py-24 text-center text-muted">Preusmjeravanje…</p>;
}
