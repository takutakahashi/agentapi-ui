import '@testing-library/jest-dom'
import { beforeEach, vi } from 'vitest'

// Mock Next.js router hooks
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  useParams: () => ({}),
}))

// Global test setup
beforeEach(() => {
  // Reset any mocks or test state if needed
})