import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, TABLES } from "@/db";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { sendCommand, refreshAccessToken } from "@/lib/tesla";
import type { User } from "@/db/schema";

const ALLOWED_COMMANDS = new Set([
  "door_lock", "door_unlock", "honk_horn", "flash_lights",
  "auto_conditioning_start", "auto_conditioning_stop", "set_temps",
  "charge_start", "charge_stop", "set_charge_limit",
  "actuate_trunk", "window_control", "set_sentry_mode",
]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vehicleId, command, body } = await req.json();
  if (!ALLOWED_COMMANDS.has(command)) {
    return NextResponse.json({ error: "Command not allowed" }, { status: 400 });
  }

  const result = await db.send(new GetCommand({ TableName: TABLES.users, Key: { id: session.userId } }));
  const user = result.Item as User | undefined;
  if (!user?.teslaAccessToken) return NextResponse.json({ error: "Tesla not connected" }, { status: 400 });

  let token = user.teslaAccessToken;
  if (user.teslaTokenExpiresAt && new Date(user.teslaTokenExpiresAt) < new Date()) {
    const tokens = await refreshAccessToken(user.teslaRefreshToken!);
    token = tokens.access_token;
    await db.send(new UpdateCommand({
      TableName: TABLES.users,
      Key: { id: session.userId },
      UpdateExpression: "SET teslaAccessToken = :at, teslaRefreshToken = :rt, teslaTokenExpiresAt = :exp",
      ExpressionAttributeValues: {
        ":at": token,
        ":rt": tokens.refresh_token,
        ":exp": new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      },
    }));
  }

  const response = await sendCommand(token, vehicleId, command, body);
  return NextResponse.json(response);
}
