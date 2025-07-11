import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    singleProfileMode: process.env.SINGLE_PROFILE_MODE === 'true' || process.env.NEXT_PUBLIC_SINGLE_PROFILE_MODE === 'true',
  })
}