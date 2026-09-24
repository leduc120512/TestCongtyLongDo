import {
  TEN_HANH_DONG,
  TEN_TRANG_THAI,
  TEN_TRUONG,
  TEN_UU_TIEN,
  type ThayDoiTruong,
  type TrangThai,
  type UuTien,
} from '@longdo/contracts'
import { useLichSuCongViec } from '../hooks/useCongViec'
import { useTraCuu } from '../hooks/useDanhMuc'
import { dinhDangLuc, dinhDangNgay } from './dinh-dang'
import { CoLoi, DangTai, KhongCoDuLieu } from './TrangThaiTai'

type TraCuu = ReturnType<typeof useTraCuu>

/** Đổi giá trị thô trong lịch sử (id, enum, ngày) thành chữ người đọc được. */
function hienGiaTri(truong: string, giaTri: unknown, tra: TraCuu): string {
  if (giaTri === null || giaTri === undefined || giaTri === '') return '(trống)'
  switch (truong) {
    case 'nguoiThucHienIds':
    case 'nguoiTheoDoiIds':
      return (giaTri as string[]).map(tra.tenNguoi).join(', ') || '(trống)'
    case 'duAnId':
      return tra.tenDuAn(giaTri as string)
    case 'trangThai':
      return TEN_TRANG_THAI[giaTri as TrangThai] ?? String(giaTri)
    case 'uuTien':
      return TEN_UU_TIEN[giaTri as UuTien] ?? String(giaTri)
    case 'batDau':
    case 'hetHan':
      return dinhDangNgay(giaTri as string)
    case 'tienDo':
      return `${giaTri}%`
    case 'deletedAt':
      return dinhDangLuc(giaTri as string)
    case 'viecCon': {
      const vc = giaTri as { ten: string; xong: boolean }
      return `${vc.xong ? '☑' : '☐'} ${vc.ten}`
    }
    default:
      return String(giaTri)
  }
}

function DongThayDoi({ td, tra }: { td: ThayDoiTruong; tra: TraCuu }) {
  return (
    <li>
      <strong>{TEN_TRUONG[td.truong] ?? td.truong}</strong>: <span className="cu">{hienGiaTri(td.truong, td.tu, tra)}</span>
      {' → '}
      <span className="moi">{hienGiaTri(td.truong, td.den, tra)}</span>
    </li>
  )
}

export function LichSuThayDoi({ congViecId }: { congViecId: string }) {
  const ls = useLichSuCongViec(congViecId)
  const tra = useTraCuu()

  if (ls.isPending) return <DangTai noiDung="Đang tải lịch sử…" />
  if (ls.isError) return <CoLoi loi={ls.error} thuLai={() => ls.refetch()} />
  if (ls.data.length === 0) return <KhongCoDuLieu>Chưa có thay đổi nào.</KhongCoDuLieu>

  return (
    <ol className="lich-su">
      {ls.data.map((dong) => (
        <li key={dong.id}>
          <div className="lich-su-dau">
            <strong>{tra.tenNguoi(dong.nguoiDoiId)}</strong> · {TEN_HANH_DONG[dong.hanhDong]}
            <time dateTime={dong.luc} className="nho">
              {dinhDangLuc(dong.luc)}
            </time>
          </div>
          {dong.thayDoi.length > 0 && (
            <ul>
              {dong.thayDoi.map((td) => (
                <DongThayDoi key={td.truong} td={td} tra={tra} />
              ))}
            </ul>
          )}
          {dong.lyDo && <p className="ly-do">Lý do: {dong.lyDo}</p>}
        </li>
      ))}
    </ol>
  )
}
