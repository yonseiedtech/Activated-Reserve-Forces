import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

interface CsvRow {
  name: string;
  username: string;
  password: string;
  role?: string;
  rank?: string;
  serviceNumber?: string;
  phone?: string;
  unit?: string;
  branch?: string;
  warBattalion?: string;
  warCompany?: string;
  warPlatoon?: string;
  warPosition?: string;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  const body = await req.json();
  const rows: CsvRow[] = body.users;

  if (!Array.isArray(rows) || rows.length === 0) {
    return badRequest("사용자 데이터가 필요합니다.");
  }

  // Validate required fields
  const errors: string[] = [];
  const usernames = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.name) errors.push(`${i + 1}행: 이름이 필요합니다.`);
    if (!row.username) errors.push(`${i + 1}행: 아이디가 필요합니다.`);
    if (!row.password) errors.push(`${i + 1}행: 비밀번호가 필요합니다.`);
    if (row.username) {
      if (usernames.has(row.username)) errors.push(`${i + 1}행: 중복 아이디 "${row.username}"`);
      usernames.add(row.username);
    }
  }

  if (errors.length > 0) {
    return badRequest(errors.slice(0, 10).join("\n"));
  }

  // Check for existing usernames
  const existingUsers = await prisma.user.findMany({
    where: { username: { in: Array.from(usernames) } },
    select: { username: true },
  });
  if (existingUsers.length > 0) {
    return badRequest(`이미 존재하는 아이디: ${existingUsers.map((u) => u.username).join(", ")}`);
  }

  // Create all users
  const results = [];
  for (const row of rows) {
    const hashedPassword = await bcrypt.hash(row.password, 10);
    const user = await prisma.user.create({
      data: {
        name: row.name,
        username: row.username,
        password: hashedPassword,
        role: row.role || "RESERVIST",
        rank: row.rank || null,
        serviceNumber: row.serviceNumber || null,
        phone: row.phone || null,
        unit: row.unit || null,
        branch: row.branch || null,
        warBattalion: row.warBattalion || null,
        warCompany: row.warCompany || null,
        warPlatoon: row.warPlatoon || null,
        warPosition: row.warPosition || null,
      },
    });
    results.push({ id: user.id, name: user.name, username: user.username });
  }

  return json({ created: results.length, users: results }, 201);
}
