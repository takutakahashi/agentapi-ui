import { NextResponse } from 'next/server'
import statisticsData from '../../../data/statistics.json'

export async function GET() {
  try {
    return NextResponse.json(statisticsData)
  } catch (error) {
    console.error('Statistics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}