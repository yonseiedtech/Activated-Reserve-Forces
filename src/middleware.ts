import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/((?!login|api/auth|api/guard-post|guard-post|_next/static|_next/image|favicon.ico|manifest.json|icon-.*|sw.js).*)",
  ],
};
