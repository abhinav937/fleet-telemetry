"use client";

import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleLogin() {
    setStatus("loading");
    setError("");

    try {
      const optRes = await fetch("/api/webauthn/authenticate");
      const options = await optRes.json();

      const credential = await startAuthentication(options);

      const verify = await fetch("/api/webauthn/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });

      if (!verify.ok) {
        const { error } = await verify.json();
        throw new Error(error ?? "Authentication failed");
      }

      router.push("/dashboard");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Authentication failed");
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
          <div className="mb-8 text-center">
            <div className="w-14 h-14 bg-red-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">TesGate</h1>
            <p className="text-zinc-400 mt-2 text-sm">Authenticate with your passkey</p>
          </div>

          {error && (
            <div className="bg-red-950 border border-red-800 rounded-lg p-3 mb-4 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={status === "loading"}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            {status === "loading" ? "Authenticating..." : "Sign in with passkey"}
          </button>
        </div>
      </div>
    </div>
  );
}
