"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackFromQuery = searchParams.get("callbackUrl") || "/dashboard";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      const form = new FormData(e.currentTarget);
      const email = String(form.get("email") || "").toLowerCase().trim();
      const password = String(form.get("password") || "");
      const callbackUrl = String(form.get("callbackUrl") || callbackFromQuery);

      const authResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (!authResult || authResult.error) {
        setError("Invalid email or password");
        return;
      }

      const profileRes = await fetch("/api/auth/me", { cache: "no-store" });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        if (profile?.user?.keySalt) {
          localStorage.setItem("keySalt", profile.user.keySalt);
        }
      }

      router.push(authResult.url || callbackUrl);
      router.refresh();
    } catch (err: any) {
      console.error("Login request failed", err);
      setError("Login failed: network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-orbit">
      <div className="login-orbit__backdrop" aria-hidden="true" />
      <div className="login-orbit__card">
        <div className="login-orbit__header">
          <p className="login-kicker">SecureShare Access</p>
          <h1>Neural Vault Login</h1>
          <p className="login-subtitle">
            Authenticate to access encrypted workspaces and AI malware analysis.
          </p>
        </div>
        {error && <div className="login-alert">{error}</div>}
        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="input login-input"
            name="email"
            placeholder="you@secure.local"
            type="email"
            autoComplete="email"
            required
          />
          <input
            className="input login-input"
            name="password"
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            required
          />
          <input type="hidden" name="callbackUrl" value={callbackFromQuery} />
          <button className="button login-cta" type="submit" disabled={loading}>
            {loading ? "Authorizing..." : "Enter SecureShare"}
          </button>
        </form>
        <div className="login-links">
          <Link className="navlink" href="/register">
            Create account
          </Link>
          <Link className="navlink" href="/reset-password">
            Forgot password
          </Link>
        </div>
        <div className="login-chips-row" aria-hidden="true">
          <span className="login-chip">E2E Encryption</span>
          <span className="login-chip">Zero Trust</span>
          <span className="login-chip">AI Threat Scan</span>
        </div>
      </div>
    </section>
  );
}