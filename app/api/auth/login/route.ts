import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Use NextAuth credentials via /api/auth/signin' },
    { status: 410 }
  );
}
