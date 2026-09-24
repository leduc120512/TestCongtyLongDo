import { SO_VIEC_CON_TOI_DA, ThemViecConSchema, type ChiTietCongViec } from '@longdo/contracts'
import { useState, type FormEvent } from 'react'
import { useDanhDauViecCon, useThemViecCon, useXoaViecCon } from '../hooks/useCongViec'
import { KhongCoDuLieu } from './TrangThaiTai'

/**
 * Việc con: người giao thêm/xóa (khi chưa bắt đầu hoặc đang làm), người thực hiện tích xong (khi đang làm).
 * Có việc con thì tiến độ do server tính theo tỉ lệ đã xong.
 */
export function ViecConPanel({ cv }: { cv: ChiTietCongViec }) {
  const them = useThemViecCon(cv.id)
  const danhDau = useDanhDauViecCon(cv.id)
  const xoa = useXoaViecCon(cv.id)
  const [ten, setTen] = useState('')
  const [loiNhap, setLoiNhap] = useState<string>()

  const { quanLyViecCon, danhDauViecCon } = cv.quyen
  const dangXuLy = them.isPending || danhDau.isPending || xoa.isPending
  const loi = them.error ?? danhDau.error ?? xoa.error
  const soXong = cv.viecCon.filter((v) => v.xong).length

  const guiThem = (e: FormEvent) => {
    e.preventDefault()
    // Dùng chính schema của API để báo lỗi ngay trên web.
    const kq = ThemViecConSchema.safeParse({ ten })
    if (!kq.success) {
      setLoiNhap(kq.error.issues[0]?.message)
      return
    }
    setLoiNhap(undefined)
    them.mutate(kq.data.ten, { onSuccess: () => setTen('') })
  }

  return (
    <section className="khoi">
      <h2>
        Việc con{' '}
        {cv.viecCon.length > 0 && (
          <span className="nho">
            ({soXong}/{cv.viecCon.length} xong — tiến độ tự tính)
          </span>
        )}
      </h2>

      {cv.viecCon.length === 0 ? (
        <KhongCoDuLieu>
          Chưa có việc con.{quanLyViecCon ? ' Thêm đầu việc bên dưới để tiến độ tự tính theo việc con.' : ''}
        </KhongCoDuLieu>
      ) : (
        <ul className="viec-con">
          {cv.viecCon.map((v) => (
            <li key={v.id}>
              <label className={v.xong ? 'da-xong' : undefined}>
                <input
                  type="checkbox"
                  checked={v.xong}
                  disabled={!danhDauViecCon || dangXuLy}
                  onChange={(e) => danhDau.mutate({ viecConId: v.id, xong: e.target.checked })}
                />
                {v.ten}
              </label>
              {quanLyViecCon && (
                <button
                  type="button"
                  className="lien-ket"
                  disabled={dangXuLy}
                  aria-label={`Xóa việc con ${v.ten}`}
                  onClick={() => xoa.mutate(v.id)}
                >
                  Xóa
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {quanLyViecCon && cv.viecCon.length < SO_VIEC_CON_TOI_DA && (
        <form className="them-dong" onSubmit={guiThem}>
          <input
            aria-label="Tên việc con mới"
            placeholder="Thêm việc con, vd. Nghiệm thu cốt thép"
            value={ten}
            maxLength={200}
            onChange={(e) => setTen(e.target.value)}
            aria-invalid={!!loiNhap}
          />
          <button type="submit" disabled={dangXuLy}>
            Thêm
          </button>
        </form>
      )}
      {loiNhap && <p className="loi-nho">{loiNhap}</p>}
      {loi && (
        <p className="loi-khoi" role="alert">
          {loi.message}
        </p>
      )}
    </section>
  )
}
