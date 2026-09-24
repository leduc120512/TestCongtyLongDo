import type { MaLoi, PhanHoiLoi } from '@longdo/contracts'
import { datPhien, layPhien } from '../auth/session'

/** Lỗi từ API, giữ nguyên code và message tiếng Việt server trả về. */
export class LoiApi extends Error {
  readonly code: MaLoi
  readonly status: number

  constructor(code: MaLoi, message: string, status: number) {
    super(message)
    this.name = 'LoiApi'
    this.code = code
    this.status = status
  }
}

type TuyChon = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined>
}

/** Gọi API, gắn token của phiên hiện tại, trả nguyên envelope JSON ({ data } hoặc { data, meta }). */
export async function goiApi<T>(duongDan: string, { method = 'GET', body, query }: TuyChon = {}): Promise<T> {
  const thamSo = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== '') thamSo.set(k, String(v))
  }
  const chuoiQuery = thamSo.toString()
  const url = `/api${duongDan}${chuoiQuery ? `?${chuoiQuery}` : ''}`

  const headers: Record<string, string> = {}
  const phien = layPhien()
  if (phien) headers.authorization = `Bearer ${phien.token}`
  if (body !== undefined) headers['content-type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new LoiApi('LOI_HE_THONG', 'Không kết nối được máy chủ. Kiểm tra API đã chạy chưa.', 0)
  }

  // Proxy của Vite trả 502/503/504 khi API chưa chạy.
  if (res.status >= 502 && res.status <= 504) {
    throw new LoiApi('LOI_HE_THONG', 'Không kết nối được máy chủ API. Kiểm tra API đã chạy chưa.', res.status)
  }
  const json: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const loi = (json as PhanHoiLoi | null)?.error
    // Token hết hạn hoặc không hợp lệ: xóa phiên để người dùng chọn lại.
    if (res.status === 401) datPhien(null)
    throw new LoiApi(loi?.code ?? 'LOI_HE_THONG', loi?.message ?? `Lỗi máy chủ (${res.status})`, res.status)
  }
  return json as T
}
