import type { ChiTietCongViec } from '@longdo/contracts'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { LoiApi } from '../api/http'
import { dinhDangLuc, dinhDangNgay } from '../components/dinh-dang'
import { LichSuThayDoi } from '../components/LichSuThayDoi'
import { NhanTrangThai, NhanUuTien } from '../components/NhanHieu'
import { CoLoi, DangTai, KhongCoDuLieu } from '../components/TrangThaiTai'
import { useCapNhatTienDo, useChiTietCongViec, useChuyenTrangThai, useXoaCongViec } from '../hooks/useCongViec'
import { useTraCuu } from '../hooks/useDanhMuc'

/** Các nút thao tác. Chỉ hiện nút mà quyen cho phép; API vẫn tự chặn nếu ai đó gọi thẳng. */
function HanhDong({ cv }: { cv: ChiTietCongViec }) {
  const navigate = useNavigate()
  const chuyen = useChuyenTrangThai(cv.id)
  const tienDo = useCapNhatTienDo(cv.id)
  const xoa = useXoaCongViec(cv.id)
  const [giaTriTienDo, setGiaTriTienDo] = useState(cv.tienDo)
  const [lyDo, setLyDo] = useState('')
  const hopThoai = useRef<HTMLDialogElement>(null)

  const { quyen } = cv
  const dangXuLy = chuyen.isPending || tienDo.isPending || xoa.isPending
  const loi = chuyen.error ?? tienDo.error ?? xoa.error
  const coNut = Object.values(quyen).some(Boolean)

  if (!coNut) return <p className="nho">Bạn chỉ có quyền xem công việc này.</p>

  return (
    <div className="hanh-dong">
      <div className="nut-hang">
        {quyen.batDau && (
          <button type="button" disabled={dangXuLy} onClick={() => chuyen.mutate({ trangThai: 'DANG_LAM' })}>
            Bắt đầu làm
          </button>
        )}
        {quyen.guiDuyet && (
          <button type="button" disabled={dangXuLy} onClick={() => chuyen.mutate({ trangThai: 'CHO_DUYET' })}>
            Gửi duyệt
          </button>
        )}
        {quyen.duyet && (
          <button type="button" disabled={dangXuLy} onClick={() => chuyen.mutate({ trangThai: 'HOAN_THANH' })}>
            Duyệt hoàn thành
          </button>
        )}
        {quyen.traLai && (
          <button type="button" className="phu" disabled={dangXuLy} onClick={() => hopThoai.current?.showModal()}>
            Trả lại
          </button>
        )}
        {quyen.sua && (
          <Link to={`/cong-viec/${cv.id}/sua`} className="nut phu">
            Sửa
          </Link>
        )}
        {quyen.xoa && (
          <button
            type="button"
            className="nguy-hiem"
            disabled={dangXuLy}
            onClick={() => {
              if (window.confirm(`Xóa công việc ${cv.ma}?`)) {
                xoa.mutate(undefined, { onSuccess: () => navigate('/cong-viec', { replace: true }) })
              }
            }}
          >
            Xóa
          </button>
        )}
      </div>

      {quyen.capNhatTienDo && (
        <form
          className="tien-do-form"
          onSubmit={(e) => {
            e.preventDefault()
            tienDo.mutate({ tienDo: giaTriTienDo })
          }}
        >
          <label htmlFor="tienDo">Tiến độ</label>
          <input
            id="tienDo"
            type="range"
            min={0}
            max={100}
            step={5}
            value={giaTriTienDo}
            onChange={(e) => setGiaTriTienDo(Number(e.target.value))}
          />
          <output htmlFor="tienDo">{giaTriTienDo}%</output>
          <button type="submit" disabled={dangXuLy || giaTriTienDo === cv.tienDo}>
            Lưu tiến độ
          </button>
        </form>
      )}

      {loi && (
        <p className="loi-khoi" role="alert">
          {loi.message}
        </p>
      )}

      <dialog ref={hopThoai} className="hop-thoai" onClose={() => setLyDo('')}>
        <form
          method="dialog"
          onSubmit={(e) => {
            if (!lyDo.trim()) {
              e.preventDefault()
              return
            }
            chuyen.mutate({ trangThai: 'DANG_LAM', lyDo: lyDo.trim() })
          }}
        >
          <h2>Trả lại công việc {cv.ma}</h2>
          <label htmlFor="lyDo">Lý do trả lại *</label>
          <textarea
            id="lyDo"
            rows={3}
            value={lyDo}
            onChange={(e) => setLyDo(e.target.value)}
            placeholder="Vd. Thiếu biên bản nghiệm thu có chữ ký tư vấn giám sát"
            required
            autoFocus
          />
          {!lyDo.trim() && <p className="nho">Bắt buộc ghi lý do khi trả lại.</p>}
          <div className="nut-hang">
            <button type="submit" disabled={!lyDo.trim()}>
              Trả lại
            </button>
            <button type="button" className="phu" onClick={() => hopThoai.current?.close()}>
              Hủy
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}

export default function ChiTietPage() {
  const { id = '' } = useParams()
  const ct = useChiTietCongViec(id)
  const tra = useTraCuu()

  if (ct.isPending) return <DangTai />
  if (ct.isError) {
    if (ct.error instanceof LoiApi && ct.error.status === 404) {
      return (
        <KhongCoDuLieu>
          Không tìm thấy công việc, hoặc bạn không có liên quan tới công việc này.{' '}
          <Link to="/cong-viec">Về danh sách</Link>
        </KhongCoDuLieu>
      )
    }
    return <CoLoi loi={ct.error} thuLai={() => ct.refetch()} />
  }

  const cv = ct.data
  return (
    <article className="chi-tiet">
      <p>
        <Link to="/cong-viec">‹ Danh sách</Link>
      </p>
      {tra.loi && (
        <p className="loi-khoi" role="alert">
          Không tải được tên nhân viên/dự án: {tra.loi.message}{' '}
          <button type="button" className="lien-ket" onClick={tra.thuLai}>
            Thử lại
          </button>
        </p>
      )}
      <header className="tieu-de-trang">
        <div>
          <span className="ma">{cv.ma}</span>
          <h1>{cv.ten}</h1>
          <NhanTrangThai trangThai={cv.trangThai} quaHan={cv.quaHan} />
        </div>
      </header>

      {/* key: đổi trạng thái/tiến độ từ nơi khác thì form tiến độ lấy lại giá trị mới */}
      <HanhDong key={`${cv.trangThai}-${cv.tienDo}`} cv={cv} />

      <dl className="luoi-thong-tin">
        <dt>Dự án</dt>
        <dd>{tra.tenDuAn(cv.duAnId)}</dd>
        <dt>Người giao</dt>
        <dd>{tra.tenNguoi(cv.nguoiGiaoId)}</dd>
        <dt>Người thực hiện</dt>
        <dd>{cv.nguoiThucHienIds.map(tra.tenNguoi).join(', ')}</dd>
        <dt>Người theo dõi</dt>
        <dd>{cv.nguoiTheoDoiIds.length ? cv.nguoiTheoDoiIds.map(tra.tenNguoi).join(', ') : '—'}</dd>
        <dt>Ưu tiên</dt>
        <dd>
          <NhanUuTien uuTien={cv.uuTien} />
        </dd>
        <dt>Bắt đầu</dt>
        <dd>{dinhDangNgay(cv.batDau)}</dd>
        <dt>Hạn</dt>
        <dd className={cv.quaHan ? 'chu-qua-han' : undefined}>{dinhDangNgay(cv.hetHan)}</dd>
        <dt>Tiến độ</dt>
        <dd>
          <progress max={100} value={cv.tienDo} aria-label="Tiến độ" /> {cv.tienDo}%
        </dd>
        <dt>Tạo lúc</dt>
        <dd>{dinhDangLuc(cv.taoLuc)}</dd>
        <dt>Cập nhật lúc</dt>
        <dd>{dinhDangLuc(cv.capNhatLuc)}</dd>
      </dl>

      {cv.moTa && (
        <section>
          <h2>Mô tả</h2>
          <p className="mo-ta">{cv.moTa}</p>
        </section>
      )}

      <section>
        <h2>Lịch sử thay đổi</h2>
        <LichSuThayDoi congViecId={cv.id} />
      </section>
    </article>
  )
}
