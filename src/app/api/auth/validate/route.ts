import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { key } = await req.json();
  const adminKey = process.env.ARK_ADMIN_KEY;

  if (!adminKey || !key || key !== adminKey) {
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  return NextResponse.json({ role: "admin" });
}
