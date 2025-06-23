import Link from 'next/link'
import StatisticsCharts from '../components/StatisticsCharts'

export default function StatisticsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Statistics</h1>
              <p className="mt-2 text-gray-600">
                Agent usage statistics by user and repository
              </p>
            </div>
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <StatisticsCharts />
      </div>
    </div>
  )
}