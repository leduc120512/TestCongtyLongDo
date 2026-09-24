import type { ErrorCode, ApiErrorResponse } from '@longdo/contracts'
import { setSession, getSession } from '../auth/session'

/** Lỗi từ API, giữ nguyên code và message tiếng Việt server trả về. */
export class ApiError extends Error {
  readonly code: ErrorCode
  readonly status: number

  constructor(code: ErrorCode, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined>
}

/** Gọi API, gắn token của phiên hiện tại, trả nguyên envelope JSON ({ data } hoặc { data, meta }). */
export async function callApi<T>(path: string, { method = 'GET', body, query }: RequestOptions = {}): Promise<T> {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== '') params.set(k, String(v))
  }
  const queryString = params.toString()
  const url = `/api${path}${queryString ? `?${queryString}` : ''}`

  const headers: Record<string, string> = {}
  const session = getSession()
  if (session) headers.authorization = `Bearer ${session.token}`
  if (body !== undefined) headers['content-type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError('LOI_HE_THONG', 'Không kết nối được máy chủ. Kiểm tra API đã chạy chưa.', 0)
  }

  // Proxy của Vite trả 502/503/504 khi API chưa chạy.
  if (res.status >= 502 && res.status <= 504) {
    throw new ApiError('LOI_HE_THONG', 'Không kết nối được máy chủ API. Kiểm tra API đã chạy chưa.', res.status)
  }
  const json: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const error = (json as ApiErrorResponse | null)?.error
    // Token hết hạn hoặc không hợp lệ: xóa phiên để người dùng chọn lại.
    if (res.status === 401) setSession(null)
    throw new ApiError(error?.code ?? 'LOI_HE_THONG', error?.message ?? `Lỗi máy chủ (${res.status})`, res.status)
  }
  return json as T
}
