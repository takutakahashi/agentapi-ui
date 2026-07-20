/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApiTokensSection from '../ApiTokensSection'
import ApiTokenResultModal from '../ApiTokenResultModal'
import { ApiToken, CreateApiTokenResponse } from '../../../types/api_token'
import { ToastProvider } from '@/contexts/ToastContext'

// --- Mock the proxy client -------------------------------------------------
const fakeClient = {
  getApiTokens: vi.fn(),
  createApiToken: vi.fn(),
  getApiToken: vi.fn(),
  deleteApiToken: vi.fn(),
}

vi.mock('@/lib/agentapi-proxy-client', () => ({
  createAgentAPIProxyClientFromStorage: () => fakeClient,
  AgentAPIProxyError: class AgentAPIProxyError extends Error {
    status: number
    code: string
    constructor(status: number, code: string, message: string) {
      super(message)
      this.status = status
      this.code = code
      this.name = 'AgentAPIProxyError'
    }
  },
}))

// --- Mock clipboard ---------------------------------------------------------
const clipboardWrite = vi.fn()
beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: clipboardWrite },
    configurable: true,
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Helper: render the section. ToastProvider is required by the section.
function renderSection(props: Partial<React.ComponentProps<typeof ApiTokensSection>> = {}) {
  return render(
    <ToastProvider>
      <ApiTokensSection scope="personal" {...props} />
    </ToastProvider>
  )
}

const sampleToken: ApiToken = {
  id: 'tok_1',
  name: 'CI 用',
  token_prefix: 'ap_user_abc',
  scope: 'personal',
  permissions: ['session:create', 'session:list'],
  created_at: '2024-06-14T00:00:00Z',
  expires_at: '2025-06-14T00:00:00Z',
}

describe('ApiTokensSection', () => {
  it('loads and lists personal tokens', async () => {
    fakeClient.getApiTokens.mockResolvedValue({ items: [sampleToken] })
    renderSection({ scope: 'personal' })

    await waitFor(() => expect(screen.getByText('CI 用')).toBeInTheDocument())
    expect(screen.getByText('ap_user_abc')).toBeInTheDocument()
    expect(screen.getByText(/session:create/)).toBeInTheDocument()
    // Query params: personal scope, no team_id
    expect(fakeClient.getApiTokens).toHaveBeenCalledWith({ scope: 'personal' })
  })

  it('loads team tokens with team_id', async () => {
    fakeClient.getApiTokens.mockResolvedValue({ items: [sampleToken] })
    renderSection({ scope: 'team', teamId: 'org/team' })

    await waitFor(() => expect(screen.getByText('CI 用')).toBeInTheDocument())
    expect(fakeClient.getApiTokens).toHaveBeenCalledWith({ scope: 'team', team_id: 'org/team' })
  })

  it('shows empty state', async () => {
    fakeClient.getApiTokens.mockResolvedValue({ items: [] })
    renderSection()
    await waitFor(() => expect(screen.getByText('API トークンがありません')).toBeInTheDocument())
  })

  it('shows error on load failure', async () => {
    fakeClient.getApiTokens.mockRejectedValue(new Error('boom'))
    renderSection()
    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument())
  })

  it('creates a token and shows the plaintext exactly once, then clears on close', async () => {
    const user = userEvent.setup()
    fakeClient.getApiTokens.mockResolvedValue({ items: [] })
    const created: CreateApiTokenResponse = {
      token: { ...sampleToken, id: 'tok_new', name: 'My Token' },
      plaintext_token: 'ap_secret_plaintext_123',
    }
    fakeClient.createApiToken.mockResolvedValue(created)

    renderSection()
    await waitFor(() => expect(screen.queryByText('API トークンがありません')).toBeInTheDocument())

    // Open create modal
    await user.click(screen.getByText('トークンを作成'))

    // Fill form
    const nameInput = await screen.findByPlaceholderText('例: CI 用トークン')
    await user.type(nameInput, 'My Token')

    // Submit
    await user.click(screen.getByRole('button', { name: '作成' }))

    // Result modal shows plaintext exactly once
    const plaintext = await screen.findByTestId('api-token-plaintext')
    expect(plaintext).toHaveTextContent('ap_secret_plaintext_123')
    expect(screen.getByText(/今度一度だけ/)).toBeInTheDocument()

    // createApiToken was called with personal scope, no team_id
    expect(fakeClient.createApiToken).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My Token', scope: 'personal' })
    )
    expect(fakeClient.createApiToken.mock.calls[0][0].team_id).toBeUndefined()

    // List refreshed
    await waitFor(() => expect(fakeClient.getApiTokens).toHaveBeenCalledTimes(2))

    // Close result modal -> plaintext disappears
    await user.click(screen.getByText('閉じる（トークンを非表示）'))
    await waitFor(() => expect(screen.queryByTestId('api-token-plaintext')).not.toBeInTheDocument())
    expect(screen.queryByText('ap_secret_plaintext_123')).not.toBeInTheDocument()
  })

  it('copies plaintext token to clipboard', async () => {
    const user = userEvent.setup()
    fakeClient.getApiTokens.mockResolvedValue({ items: [] })
    fakeClient.createApiToken.mockResolvedValue({
      token: { ...sampleToken, name: 'C' },
      plaintext_token: 'ap_copy_me',
    })
    clipboardWrite.mockResolvedValue(undefined)
    renderSection()
    await user.click(await screen.findByText('トークンを作成'))
    await user.type(screen.getByPlaceholderText('例: CI 用トークン'), 'C')
    await user.click(screen.getByRole('button', { name: '作成' }))
    await screen.findByTestId('api-token-plaintext')

    await user.click(screen.getByRole('button', { name: /コピー/ }))
    // The copy path executed and the button switched to the "copied" state.
    await waitFor(() => expect(screen.getByText('コピー済み')).toBeInTheDocument())
  })

  it('confirms destructive deletion and refreshes the list', async () => {
    const user = userEvent.setup()
    fakeClient.getApiTokens.mockResolvedValue({ items: [sampleToken] })
    fakeClient.deleteApiToken.mockResolvedValue(undefined)
    renderSection()
    await screen.findByText('CI 用')

    await user.click(screen.getByRole('button', { name: /トークン CI 用 を削除/ }))
    // Confirm modal appears
    expect(screen.getByText(/API トークンを削除します/)).toBeInTheDocument()
    // Confirm
    const dialog = screen.getByText(/API トークンを削除します/).closest('.fixed')!
    await user.click(within(dialog).getByRole('button', { name: '削除' }))

    expect(fakeClient.deleteApiToken).toHaveBeenCalledWith('tok_1')
    // List refreshed after delete
    await waitFor(() => expect(fakeClient.getApiTokens.mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  it('cancels deletion', async () => {
    const user = userEvent.setup()
    fakeClient.getApiTokens.mockResolvedValue({ items: [sampleToken] })
    renderSection()
    await screen.findByText('CI 用')

    await user.click(screen.getByRole('button', { name: /トークン CI 用 を削除/ }))
    const dialog = screen.getByText(/API トークンを削除します/).closest('.fixed')!
    await user.click(within(dialog).getByRole('button', { name: 'キャンセル' }))

    await waitFor(() => expect(screen.queryByText(/API トークンを削除します/)).not.toBeInTheDocument())
    expect(fakeClient.deleteApiToken).not.toHaveBeenCalled()
  })

  it('shows delete error without crashing', async () => {
    const user = userEvent.setup()
    fakeClient.getApiTokens.mockResolvedValue({ items: [sampleToken] })
    fakeClient.deleteApiToken.mockRejectedValue(new Error('forbidden'))
    renderSection()
    await screen.findByText('CI 用')

    await user.click(screen.getByRole('button', { name: /トークン CI 用 を削除/ }))
    const dialog = screen.getByText(/API トークンを削除します/).closest('.fixed')!
    await user.click(within(dialog).getByRole('button', { name: '削除' }))

    await waitFor(() => expect(screen.getByText('forbidden')).toBeInTheDocument())
  })

  it('does not persist plaintext token in localStorage', async () => {
    const user = userEvent.setup()
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    fakeClient.getApiTokens.mockResolvedValue({ items: [] })
    fakeClient.createApiToken.mockResolvedValue({
      token: { ...sampleToken, name: 'X' },
      plaintext_token: 'ap_persist_test',
    })
    renderSection()
    await user.click(await screen.findByText('トークンを作成'))
    await user.type(screen.getByPlaceholderText('例: CI 用トークン'), 'X')
    await user.click(screen.getByRole('button', { name: '作成' }))
    await screen.findByTestId('api-token-plaintext')

    // Ensure no localStorage entry ever contained the plaintext.
    for (const call of setItemSpy.mock.calls) {
      expect(JSON.stringify(call[1])).not.toContain('ap_persist_test')
    }
    setItemSpy.mockRestore()
  })

  it('validates name length (1-64)', async () => {
    const user = userEvent.setup()
    fakeClient.getApiTokens.mockResolvedValue({ items: [] })
    renderSection()
    await user.click(await screen.findByText('トークンを作成'))

    // Submit empty -> button disabled
    expect(screen.getByRole('button', { name: '作成' })).toBeDisabled()

    // Type name -> enabled
    await user.type(screen.getByPlaceholderText('例: CI 用トークン'), 'ab')
    expect(screen.getByRole('button', { name: '作成' })).toBeEnabled()
  })

  it('team section is fixed to selected team and does not allow personal scope switching', async () => {
    fakeClient.getApiTokens.mockResolvedValue({ items: [] })
    renderSection({ scope: 'team', teamId: 'org/team' })
    await waitFor(() => expect(fakeClient.getApiTokens).toHaveBeenCalledWith({ scope: 'team', team_id: 'org/team' }))
    // No scope selector exists
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

describe('ApiTokenResultModal (one-time display)', () => {
  it('renders nothing when response is null', () => {
    const { container } = render(<ApiTokenResultModal response={null} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('clears plaintext state on close', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const response: CreateApiTokenResponse = {
      token: { ...sampleToken, name: 'Z' },
      plaintext_token: 'ap_clear_me',
    }
    const { unmount } = render(<ApiTokenResultModal response={response} onClose={onClose} />)
    expect(screen.getByTestId('api-token-plaintext')).toHaveTextContent('ap_clear_me')
    await user.click(screen.getByText('閉じる（トークンを非表示）'))
    expect(onClose).toHaveBeenCalled()
    // Unmount to simulate parent dropping the response.
    unmount()
  })
})