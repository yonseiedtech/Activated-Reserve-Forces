import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const body = await req.json();
  const { identifier, loginType } = body;

  if (!identifier || !loginType) {
    return NextResponse.json(
      { error: "identifier와 loginType이 필요합니다." },
      { status: 400 }
    );
  }

  const result = await checkRateLimit(identifier, loginType);

  if (!result.allowed) {
    const remainingMs = result.lockedUntil!.getTime() - Date.now();
    const remainingMinutes = Math.ceil(remainingMs / 60000);

    return NextResponse.json(
      {
        allowed: false,
        remainingAttempts: 0,
        remainingMinutes,
      },
      { status: 429 }
    );
  }

  return NextResponse.json({
    allowed: true,
    remainingAttempts: result.remainingAttempts,
  });
}
