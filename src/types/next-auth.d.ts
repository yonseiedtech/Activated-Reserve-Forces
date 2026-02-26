import "next-auth";

declare module "next-auth" {
  interface User {
    role: string;
    username: string;
    rank?: string | null;
    serviceNumber?: string | null;
    phone?: string | null;
    unit?: string | null;
    position?: string | null;
    birthDate?: string | null;
    mustChangePassword?: boolean;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      username: string;
      role: string;
      rank?: string | null;
      serviceNumber?: string | null;
      phone?: string | null;
      unit?: string | null;
      position?: string | null;
      birthDate?: string | null;
      mustChangePassword?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    id: string;
    username: string;
    rank?: string | null;
    serviceNumber?: string | null;
    phone?: string | null;
    unit?: string | null;
    position?: string | null;
    birthDate?: string | null;
    mustChangePassword?: boolean;
  }
}
