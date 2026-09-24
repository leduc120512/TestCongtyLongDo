import type { NhanVien } from '@longdo/contracts'

/** Chọn nhiều người bằng checkbox — nhẹ, không cần thư viện select. */
export function ChonNhieuNguoi({
  id,
  nhanVien,
  giaTri,
  onChange,
  loaiTru = [],
  coLoi,
}: {
  id: string
  nhanVien: NhanVien[]
  giaTri: string[]
  onChange: (ids: string[]) => void
  /** Người không được chọn ở ô này (vd. đã là người thực hiện thì không cần theo dõi). */
  loaiTru?: string[]
  coLoi?: boolean
}) {
  const doi = (nvId: string, chon: boolean) =>
    onChange(chon ? [...giaTri, nvId] : giaTri.filter((x) => x !== nvId))

  return (
    <div id={id} className={`chon-nhieu${coLoi ? ' co-loi' : ''}`} role="group" aria-invalid={coLoi}>
      {nhanVien.map((nv) => {
        const biLoai = loaiTru.includes(nv.id)
        return (
          <label key={nv.id} className={biLoai ? 'mo' : undefined}>
            <input
              type="checkbox"
              checked={giaTri.includes(nv.id)}
              disabled={biLoai}
              onChange={(e) => doi(nv.id, e.target.checked)}
            />
            {nv.ten} <span className="nho">· {nv.chucVu}</span>
          </label>
        )
      })}
    </div>
  )
}
