import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { db, TABLES } from "@/db";
import { PutCommand, ScanCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { createSession } from "@/lib/session";
import { nanoid } from "nanoid";

const RP_ID = process.env.RP_ID!;
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET() {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "required",
  });

  const ttl = Math.floor(Date.now() / 1000) + 300;
  await db.send(new PutCommand({
    TableName: TABLES.challenges,
    Item: { id: nanoid(), challenge: options.challenge, expiresAt: new Date(ttl * 1000).toISOString(), ttl },
  }));

  return NextResponse.json(options);
}

export async function POST(req: NextRequest) {
  const { credential } = await req.json();

  // Find passkey by credentialId via GSI
  const passkeyResult = await db.send(new ScanCommand({
    TableName: TABLES.passkeys,
    FilterExpression: "credentialId = :cid",
    ExpressionAttributeValues: { ":cid": credential.id },
    Limit: 1,
  }));

  const passkey = passkeyResult.Items?.[0];
  if (!passkey) return NextResponse.json({ error: "Passkey not found" }, { status: 400 });

  // Get latest unexpired challenge
  const challengeResult = await db.send(new ScanCommand({
    TableName: TABLES.challenges,
    FilterExpression: "expiresAt > :now",
    ExpressionAttributeValues: { ":now": new Date().toISOString() },
    Limit: 1,
  }));

  const ch = challengeResult.Items?.[0];
  if (!ch) return NextResponse.json({ error: "Challenge expired" }, { status: 400 });

  const verification = await verifyAuthenticationResponse({
    response: credential,
    expectedChallenge: ch.challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    authenticator: {
      credentialID: Buffer.from(passkey.credentialId, "base64url"),
      credentialPublicKey: Buffer.from(passkey.publicKey, "base64"),
      counter: passkey.counter,
      transports: JSON.parse(passkey.transports ?? "[]") as AuthenticatorTransport[],
    },
  });

  if (!verification.verified) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  await db.send(new UpdateCommand({
    TableName: TABLES.passkeys,
    Key: { id: passkey.id },
    UpdateExpression: "SET #c = :counter, lastUsedAt = :now",
    ExpressionAttributeNames: { "#c": "counter" },
    ExpressionAttributeValues: {
      ":counter": verification.authenticationInfo.newCounter,
      ":now": new Date().toISOString(),
    },
  }));

  await db.send(new DeleteCommand({ TableName: TABLES.challenges, Key: { id: ch.id } }));

  await createSession(passkey.userId);
  return NextResponse.json({ success: true });
}
