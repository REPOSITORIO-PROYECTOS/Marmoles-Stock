import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { get, post } from '../../api'

function setupFetchSequence(sequence: Array<{ urlIncludes: string; response: any }>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input)
    const idx = sequence.findIndex(s => url.includes(s.urlIncludes))
    if (idx === -1) {
      return { ok: false, status: 404, statusText: 'Not Found', text: async () => '' } as any
    }
    const { response: res } = sequence.splice(idx, 1)[0]
    return {
      ok: res.ok ?? true,
      status: res.status ?? 200,
      statusText: res.statusText ?? 'OK',
      headers: new Headers({ 'content-type': res.contentType ?? 'application/json' }),
      json: async () => res.json,
      text: async () => (typeof res.json === 'string' ? res.json : JSON.stringify(res.json)),
    } as any
  })
  vi.stubGlobal('fetch', fetchMock as any)
  return fetchMock
}

describe('api helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {} as any)
    vi.stubGlobal('localStorage', {
      _data: new Map<string, string>(),
      getItem(key: string) { return (this._data.get(key) ?? null) },
      setItem(key: string, val: string) { this._data.set(key, String(val)) },
      removeItem(key: string) { this._data.delete(key) },
      clear() { this._data.clear() },
      key: (_: number) => null,
      length: 0,
    } as any)
    ;(globalThis.window as any).localStorage = globalThis.localStorage
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('construye URL correctamente con y sin slash inicial', async () => {
    const fetchMock = setupFetchSequence([
      { urlIncludes: '/api/health', response: { json: { status: 'ok' } } },
    ])
    const res: any = await get('api/health')
    expect(res.status).toBe('ok')
    expect(fetchMock).toHaveBeenCalled()
    const url = (fetchMock.mock.calls[0]![0] as string)
    expect(url.endsWith('/api/health')).toBe(true)
  })

  it('envía headers y body en POST y reintenta tras 401 con autoLogin', async () => {
    const fetchMock = setupFetchSequence([
      { urlIncludes: '/api/test', response: { ok: false, status: 401, statusText: 'Unauthorized', json: { msg: 'unauth' } } },
      { urlIncludes: '/api/auth/login', response: { json: { token: 'T123' } } },
      { urlIncludes: '/api/test', response: { json: { ok: true } } },
    ])
    const r: any = await post('/api/test', { a: 1 })
    expect(r.ok).toBe(true)
    const calls = fetchMock.mock.calls.map(c => String(c[0]))
    expect(calls.filter(u => u.includes('/api/auth/login')).length).toBeGreaterThanOrEqual(1)
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]
    const lastHeaders: any = lastCall && lastCall[1] && (lastCall[1] as any).headers
    if (lastHeaders instanceof Headers) {
      expect(lastHeaders.get('content-type') || lastHeaders.get('Content-Type')).toBe('application/json')
      expect(lastHeaders.get('authorization') || lastHeaders.get('Authorization')).toBe('Bearer T123')
    } else {
      expect(lastHeaders['Content-Type']).toBe('application/json')
      expect(lastHeaders['Authorization']).toBe('Bearer T123')
    }
  })
})
