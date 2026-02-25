import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        identifier: { label: "아이디/군번", type: "text" },
        password: { label: "비밀번호", type: "password" },
        loginType: { label: "로그인 유형", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) return null;

        const { identifier, password, loginType } = credentials;

        let user;
        if (loginType === "reservist") {
          user = await prisma.user.findFirst({
            where: { serviceNumber: identifier, role: "RESERVIST" },
          });
        } else {
          user = await prisma.user.findFirst({
            where: { username: identifier, role: { not: "RESERVIST" } },
          });
        }

        if (!user) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email || "",
          username: user.username,
          role: user.role,
          rank: user.rank,
          serviceNumber: user.serviceNumber,
          phone: user.phone,
          unit: user.unit,
          position: user.position,
          birthDate: user.birthDate?.toISOString() || null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.username = (user as { username: string }).username;
        token.rank = (user as { rank?: string | null }).rank || null;
        token.serviceNumber = (user as { serviceNumber?: string | null }).serviceNumber || null;
        token.phone = (user as { phone?: string | null }).phone || null;
        token.unit = (user as { unit?: string | null }).unit || null;
        token.position = (user as { position?: string | null }).position || null;
        token.birthDate = (user as { birthDate?: string | null }).birthDate || null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.rank = (token.rank as string) || null;
        session.user.serviceNumber = (token.serviceNumber as string) || null;
        session.user.phone = (token.phone as string) || null;
        session.user.unit = (token.unit as string) || null;
        session.user.position = (token.position as string) || null;
        session.user.birthDate = (token.birthDate as string) || null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
