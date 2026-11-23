"use client";

// WebAuthn u pregledniku (@simplewebauthn/browser) za prijavu, pozivnicu i dodavanje
// passkeya. Opcije i provjera su na fiskal Workeru (src/app-auth/passkey.ts); ovdje
// samo pozivamo preglednik i greške pretvaramo u poruke za korisnika.

import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  WebAuthnError,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { api, FiskalGreska } from "@/lib/fiskal";

export const podrzan = () => typeof window !== "undefined" && browserSupportsWebAuthn();

/// Prijava postojećim passkeyem. Uspjeh = kolačić sesije je postavljen.
export async function prijaviPasskeyem(): Promise<void> {
  const opcije = await api<PublicKeyCredentialRequestOptionsJSON>("/prijava/opcije", { metoda: "POST", tijelo: {} });
  const odgovor: AuthenticationResponseJSON = await startAuthentication({ optionsJSON: opcije });
  await api("/prijava/potvrdi", { metoda: "POST", tijelo: { odgovor } });
}

/// Novi passkey iz opcija koje je dao server (pozivnica ili „dodaj passkey”).
export function izradiPasskey(opcije: PublicKeyCredentialCreationOptionsJSON): Promise<RegistrationResponseJSON> {
  return startRegistration({ optionsJSON: opcije });
}

/// Dodaj još jedan passkey prijavljenom korisniku (moji passkeyi).
export async function dodajPasskey(oznaka: string): Promise<void> {
  const opcije = await api<PublicKeyCredentialCreationOptionsJSON>("/passkeyi/opcije", { metoda: "POST", tijelo: {} });
  const odgovor = await izradiPasskey(opcije);
  await api("/passkeyi/potvrdi", { metoda: "POST", tijelo: { odgovor, oznaka } });
}

/// Poruka za korisnika iz greške preglednika ili API-ja.
export function porukaGreske(e: unknown, radnja: "prijava" | "izrada"): string {
  if (e instanceof FiskalGreska) return e.message;
  const ime = e instanceof WebAuthnError ? (e.cause as Error | undefined)?.name : (e as Error | undefined)?.name;
  if (e instanceof WebAuthnError && e.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
    return "Ovaj uređaj već ima passkey za tvoj račun. Odaberi drugi uređaj ili upravitelj lozinki.";
  }
  if (ime === "NotAllowedError" || ime === "AbortError") {
    return radnja === "prijava"
      ? "Prijava je prekinuta ili na ovom uređaju nema passkeya za ovu stranicu."
      : "Izrada passkeya je prekinuta. Pozivnica nije potrošena — pokušaj ponovno.";
  }
  return (e as Error | undefined)?.message || "Nešto nije uspjelo — pokušaj ponovno.";
}
