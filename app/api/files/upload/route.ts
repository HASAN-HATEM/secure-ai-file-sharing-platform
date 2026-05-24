import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Use /api/uploads/create and /api/uploads/finalize.' },
    { status: 410 }
  );
}
