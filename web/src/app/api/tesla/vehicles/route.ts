import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, TABLES } from "@/db";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getVehicles, getVehicleData, refreshAccessToken } from "@/lib/tesla";
import type { User } from "@/db/schema";

async function getValidToken(userId: string): Promise<string | null> {
  const result = await db.send(new GetCommand({ TableName: TABLES.users, Key: { id: userId } }));
  const user = result.Item as User | undefined;
  if (!user?.teslaAccessToken) return null;

  if (user.teslaTokenExpiresAt && new Date(user.teslaTokenExpiresAt) < new Date()) {
    const tokens = await refreshAccessToken(user.teslaRefreshToken!);
    await db.send(new UpdateCommand({
      TableName: TABLES.users,
      Key: { id: userId },
      UpdateExpression: "SET teslaAccessToken = :at, teslaRefreshToken = :rt, teslaTokenExpiresAt = :exp",
      ExpressionAttributeValues: {
        ":at": tokens.access_token,
        ":rt": tokens.refresh_token,
        ":exp": new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      },
    }));
    return tokens.access_token;
  }

  return user.teslaAccessToken;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getValidToken(session.userId);
  if (!token) return NextResponse.json({ error: "Tesla not connected" }, { status: 400 });

  const vehicles = await getVehicles(token);

  const withData = await Promise.allSettled(
    vehicles.map(async (v) => {
      if (v.state !== "online") return { ...v, data: null };
      const data = await getVehicleData(token, String(v.id));
      return { ...v, data };
    })
  );

  return NextResponse.json(
    withData.map((r) => (r.status === "fulfilled" ? r.value : null)).filter(Boolean)
  );
}
