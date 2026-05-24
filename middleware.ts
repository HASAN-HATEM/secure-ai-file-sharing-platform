import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const AUTH_ROUTES = ['/login', '/register', '/reset-password'];
const PUBLIC_PATHS = ['/api/auth', '/_next', '/favicon.ico'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET
  });

  if (!token && !isAuthRoute) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};
