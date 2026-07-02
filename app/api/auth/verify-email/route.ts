import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken } from '@/lib/users';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

  if (!token) {
    return NextResponse.redirect(`${appUrl}/dashboard?verified=invalid`);
  }

  const userId = await verifyEmailToken(token).catch(() => null);
  if (!userId) {
    return NextResponse.redirect(`${appUrl}/dashboard?verified=invalid`);
  }

  return NextResponse.redirect(`${appUrl}/dashboard?verified=1`);
}
