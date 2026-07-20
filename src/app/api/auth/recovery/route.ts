import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    accepted: true,
    message: 'Recovery preparation recorded. Contact the configured recovery administrator.',
  }, { status: 202 });
}
