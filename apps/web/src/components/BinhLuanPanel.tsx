import { VietBinhLuanSchema } from '@longdo/contracts'
import { useState, type FormEvent } from 'react'
import { useBinhLuan, useVietBinhLuan } from '../hooks/useCongViec'
import { useTraCuu } from '../hooks/useDanhMuc'
import { dinhDangLuc } from './dinh-dang'
import { CoLoi, DangTai, KhongCoDuLieu } from './TrangThaiTai'

/** Bình luận: ai liên quan tới công việc (giao, thực hiện, theo dõi) đều đọc và viết được. */
export function BinhLuanPanel({ congViecId }: { congViecId: string }) {
  const ds = useBinhLuan(congViecId)
  const viet = useVietBinhLuan(congViecId)
  const tra = useTraCuu()
  const [noiDung, setNoiDung] = useState('')
  const [loiNhap, setLoiNhap] = useState<string>()

  const gui = (e: FormEvent) => {
    e.preventDefault()
    const kq = VietBinhLuanSchema.safeParse({ noiDung })
    if (!kq.success) {
      setLoiNhap(kq.error.issues[0]?.message)
      return
    }
    setLoiNhap(undefined)
    const daGui = kq.data.noiDung
    // Chỉ xóa ô nếu người dùng chưa gõ thêm gì trong lúc chờ gửi.
    viet.mutate(daGui, { onSuccess: () => setNoiDung((cu) => (cu.trim() === daGui ? '' : cu)) })
  }

  return (
    <section className="khoi">
      <h2>Bình luận</h2>
      {ds.isPending ? (
        <DangTai noiDung="Đang tải bình luận…" />
      ) : ds.isError ? (
        <CoLoi loi={ds.error} thuLai={() => ds.refetch()} />
      ) : ds.data.length === 0 ? (
        <KhongCoDuLieu>Chưa có bình luận nào.</KhongCoDuLieu>
      ) : (
        <ol className="binh-luan">
          {ds.data.map((b) => (
            <li key={b.id}>
              <div className="lich-su-dau">
                <strong>{tra.tenNguoi(b.nguoiVietId)}</strong>
                <time dateTime={b.taoLuc} className="nho">
                  {dinhDangLuc(b.taoLuc)}
                </time>
              </div>
              <p className="mo-ta-bl">{b.noiDung}</p>
            </li>
          ))}
        </ol>
      )}

      <form className="viet-bl" onSubmit={gui}>
        <label htmlFor="noiDungBl" className="an">
          Viết bình luận
        </label>
        <textarea
          id="noiDungBl"
          rows={2}
          maxLength={2000}
          placeholder="Viết bình luận…"
          value={noiDung}
          onChange={(e) => setNoiDung(e.target.value)}
          aria-invalid={!!loiNhap}
        />
        <button type="submit" disabled={viet.isPending}>
          {viet.isPending ? 'Đang gửi…' : 'Gửi'}
        </button>
      </form>
      {loiNhap && <p className="loi-nho">{loiNhap}</p>}
      {viet.error && (
        <p className="loi-khoi" role="alert">
          {viet.error.message}
        </p>
      )}
    </section>
  )
}
