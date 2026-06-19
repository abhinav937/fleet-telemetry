import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db, TABLES } from "@/db";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";

export default async function RootPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const result = await db.send(new ScanCommand({ TableName: TABLES.users, Select: "COUNT" }));
  if ((result.Count ?? 0) === 0) redirect("/setup");

  redirect("/login");
}
