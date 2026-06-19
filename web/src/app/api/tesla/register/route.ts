import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { registerPartner } from "@/lib/tesla";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await registerPartner();
  return NextResponse.json(result);
}
