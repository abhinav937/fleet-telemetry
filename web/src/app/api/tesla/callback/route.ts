import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { exchangeCode } from "@/lib/tesla";
import { db, TABLES } from "@/db";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/dashboard?error=no_code", req.url));

  const tokens = await exchangeCode(code);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await db.send(new UpdateCommand({
    TableName: TABLES.users,
    Key: { id: session.userId },
    UpdateExpression: "SET teslaAccessToken = :at, teslaRefreshToken = :rt, teslaTokenExpiresAt = :exp",
    ExpressionAttributeValues: {
      ":at": tokens.access_token,
      ":rt": tokens.refresh_token,
      ":exp": expiresAt,
    },
  }));

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
