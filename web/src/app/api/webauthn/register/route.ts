import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import { db, TABLES } from "@/db";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { createSession } from "@/lib/session";
import { nanoid } from "nanoid";

const RP_ID = process.env.RP_ID!;
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET() {
  const scan = await db.send(new ScanCommand({ TableName: TABLES.users, Select: "COUNT" }));
  if ((scan.Count ?? 0) > 0) {
    return NextResponse.json({ error: "Setup already complete" }, { status: 403 });
  }

  const userId = nanoid();
  const options = await generateRegistrationOptions({
    rpName: "TesGate",
    rpID: RP_ID,
    userID: userId,
    userName: "owner",
    userDisplayName: "Owner",
    attestationType: "none",
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });

  const ttl = Math.floor(Date.now() / 1000) + 300;
  await db.send(new PutCommand({
    TableName: TABLES.challenges,
    Item: { id: nanoid(), challenge: options.challenge, userId, expiresAt: new Date(ttl * 1000).toISOString(), ttl },
  }));

  return NextResponse.json({ options, userId });
}

export async function POST(req: NextRequest) {
  const { credential, userId } = await req.json();

  const scan = await db.send(new ScanCommand({
    TableName: TABLES.challenges,
    FilterExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": userId },
  }));

  const challenge = scan.Items?.[0];
  if (!challenge || new Date(challenge.expiresAt) < new Date()) {
    return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
  }

  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge: challenge.challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;

  await db.send(new PutCommand({
    TableName: TABLES.users,
    Item: { id: userId, createdAt: new Date().toISOString() },
  }));

  await db.send(new PutCommand({
    TableName: TABLES.passkeys,
    Item: {
      id: nanoid(),
      userId,
      credentialId: Buffer.from(credentialID).toString("base64url"),
      publicKey: Buffer.from(credentialPublicKey).toString("base64"),
      counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: JSON.stringify(credential.response?.transports ?? []),
      createdAt: new Date().toISOString(),
    },
  }));

  await createSession(userId);
  return NextResponse.json({ success: true });
}
