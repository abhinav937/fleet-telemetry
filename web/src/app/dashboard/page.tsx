export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db, TABLES } from "@/db";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { User } from "@/db/schema";
import VehicleDashboard from "@/components/VehicleDashboard";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const result = await db.send(new GetCommand({ TableName: TABLES.users, Key: { id: session.userId } }));
  const user = result.Item as User | undefined;

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-white font-semibold text-lg">TesGate</span>
        </div>
        <div className="flex items-center gap-3">
          {!user?.teslaAccessToken && (
            <a href="/api/tesla/connect" className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Connect Tesla
            </a>
          )}
          <form action="/api/auth/logout" method="POST">
            <button className="text-zinc-400 hover:text-white text-sm transition-colors">Sign out</button>
          </form>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {!user?.teslaAccessToken ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-zinc-800">
              <svg className="w-10 h-10 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M5 17H3v-4M15 6H5l-2 7h14V6M15 6l2 4h4l-2-4h-4"/>
              </svg>
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">No Tesla connected</h2>
            <p className="text-zinc-400 text-sm mb-6">Connect your Tesla account to see and control your vehicles</p>
            <a href="/api/tesla/connect" className="bg-red-600 hover:bg-red-700 text-white font-medium px-6 py-3 rounded-xl transition-colors inline-block">
              Connect Tesla account
            </a>
          </div>
        ) : (
          <VehicleDashboard />
        )}
      </main>
    </div>
  );
}
