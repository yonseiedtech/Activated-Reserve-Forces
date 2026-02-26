import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // mustChangePassword가 true이면 /change-password로 리다이렉트
    if (token?.mustChangePassword) {
      // 예외 경로: 이미 change-password이거나, 관련 API, 인증 API, 로그인, 정적 파일
      const allowed = [
        "/change-password",
        "/api/profile/force-change-password",
        "/api/auth",
        "/login",
      ];
      const isAllowed = allowed.some((p) => pathname.startsWith(p));
      if (!isAllowed) {
        const url = req.nextUrl.clone();
        url.pathname = "/change-password";
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/((?!login|reset-password|api/auth|api/guard-post|guard-post|_next/static|_next/image|favicon.ico|manifest.json|icon-.*|sw.js).*)",
  ],
};
