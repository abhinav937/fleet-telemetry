"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSetup() {
    setStatus("loading");
    setError("");

    try {
      const res = await fetch("/api/webauthn/register");
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error === "Setup already complete" ? "Setup is already complete. Go to /login." : error);
      }

      const { options, userId } = await res.json();
      const credential = await startRegistration(options);

      const verify = await fetch("/api/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential, userId }),
      });

      if (!verify.ok) throw new Error("Registration failed");

      setStatus("done");
      setTimeout(() => router.push("/dashboard"), 1000);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
          <div className="mb-8 text-center">
            <div className="w-14 h-14 bg-red-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">TesGate Setup</h1>
            <p className="text-zinc-400 mt-2 text-sm">Create your passkey to secure access</p>
          </div>

          {status === "done" ? (
            <div className="text-center text-green-400 py-4">
              Passkey created. Redirecting to dashboard...
            </div>
          ) : (
            <>
              <div className="bg-zinc-800 rounded-xl p-4 mb-6 text-sm text-zinc-300 space-y-2">
                <p>This creates your owner passkey using biometrics (Touch ID / Face ID / security key).</p>
                <p className="text-zinc-500">This setup page will be disabled after completion.</p>
              </div>

              {error && (
                <div className="bg-red-950 border border-red-800 rounded-lg p-3 mb-4 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleSetup}
                disabled={status === "loading"}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                {status === "loading" ? "Creating passkey..." : "Create passkey"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
