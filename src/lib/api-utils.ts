import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";

export async function getSession() {
  return getServerSession(authOptions);
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function unauthorized() {
  return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
}

export function notFound(msg = "리소스를 찾을 수 없습니다.") {
  return NextResponse.json({ error: msg }, { status: 404 });
}

export function badRequest(msg = "잘못된 요청입니다.") {
  return NextResponse.json({ error: msg }, { status: 400 });
}
