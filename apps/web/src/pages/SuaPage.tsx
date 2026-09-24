import { Link, useNavigate, useParams } from 'react-router'
import { LoiApi } from '../api/http'
import { FormCongViec } from '../components/FormCongViec'
import { CoLoi, DangTai, KhongCoDuLieu } from '../components/TrangThaiTai'
import { useChiTietCongViec, useSuaCongViec } from '../hooks/useCongViec'

export default function SuaPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const ct = useChiTietCongViec(id)
  const sua = useSuaCongViec(id)

  if (ct.isPending) return <DangTai />
  if (ct.isError) {
    if (ct.error instanceof LoiApi && ct.error.status === 404) {
      return (
        <KhongCoDuLieu>
          Không tìm thấy công việc. <Link to="/cong-viec">Về danh sách</Link>
        </KhongCoDuLieu>
      )
    }
    return <CoLoi loi={ct.error} thuLai={() => ct.refetch()} />
  }

  const cv = ct.data
  if (!cv.quyen.sua) {
    return (
      <KhongCoDuLieu>
        Bạn không có quyền sửa công việc này (chỉ người giao được sửa, và việc chưa hoàn thành).{' '}
        <Link to={`/cong-viec/${id}`}>Quay lại</Link>
      </KhongCoDuLieu>
    )
  }

  return (
    <section className="hep">
      <h1>
        Sửa <span className="ma">{cv.ma}</span>
      </h1>
      <FormCongViec
        giaTriDau={{
          ten: cv.ten,
          moTa: cv.moTa ?? '',
          duAnId: cv.duAnId ?? '',
          nguoiThucHienIds: cv.nguoiThucHienIds,
          nguoiTheoDoiIds: cv.nguoiTheoDoiIds,
          uuTien: cv.uuTien,
          batDau: cv.batDau ?? '',
          hetHan: cv.hetHan ?? '',
        }}
        nutLuu="Lưu thay đổi"
        dangGui={sua.isPending}
        loiMayChu={sua.error?.message}
        onGui={(d) =>
          // PATCH: gửi null cho ô bỏ trống để xóa giá trị cũ; server chỉ ghi các trường thực sự đổi.
          sua.mutate(
            {
              ten: d.ten,
              moTa: d.moTa ?? null,
              duAnId: d.duAnId ?? null,
              uuTien: d.uuTien,
              batDau: d.batDau ?? null,
              hetHan: d.hetHan ?? null,
              nguoiThucHienIds: d.nguoiThucHienIds,
              nguoiTheoDoiIds: d.nguoiTheoDoiIds,
            },
            { onSuccess: () => navigate(`/cong-viec/${id}`) },
          )
        }
        onHuy={() => navigate(`/cong-viec/${id}`)}
      />
    </section>
  )
}
