import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" });
export const db = DynamoDBDocumentClient.from(client);

export const TABLES = {
  users: "tesgate-users",
  passkeys: "tesgate-passkeys",
  challenges: "tesgate-challenges",
} as const;
