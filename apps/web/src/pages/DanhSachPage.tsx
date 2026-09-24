import {
  DU_AN_CHUNG,
  LOC_NHANH,
  TEN_LOC_NHANH,
  TEN_TRANG_THAI,
  TEN_UU_TIEN,
  TRANG_THAI,
  UU_TIEN,
  type LocTrangThai,
  type UuTien,
} from '@longdo/contracts'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { dinhDangNgay } from '../components/dinh-dang'
import { NhanTrangThai, NhanUuTien } from '../components/NhanHieu'
import { PhanTrang } from '../components/PhanTrang'
import { CoLoi, DangTai, KhongCoDuLieu } from '../components/TrangThaiTai'
import { useBoLocUrl, useTreGiaTri } from '../hooks/useBoLocUrl'
import { useDanhSachCongViec, useDemLocNhanh } from '../hooks/useCongViec'
import { useDuAn, useTraCuu } from '../hooks/useDanhMuc'

export default function DanhSachPage() {
  const { boLoc, doiBoLoc } = useBoLocUrl()
  const ds = useDanhSachCongViec(boLoc)
  const dem = useDemLocNhanh({ duAnId: boLoc.duAnId, trangThai: boLoc.trangThai, uuTien: boLoc.uuTien, q: boLoc.q })
  const duAn = useDuAn()
  const tra = useTraCuu()

  // Ô tìm kiếm: gõ tới đâu hiện tới đó, nhưng chỉ gọi API sau khi ngừng gõ 300ms.
  const [tuKhoa, setTuKhoa] = useState(boLoc.q ?? '')
  const tuKhoaTre = useTreGiaTri(tuKhoa)
  useEffect(() => {
    const q = tuKhoaTre.trim() || undefined
    if (q !== boLoc.q) doiBoLoc({ q })
  }, [tuKhoaTre, boLoc.q, doiBoLoc])

  const coLocPhu = !!(boLoc.duAnId || boLoc.trangThai || boLoc.uuTien || boLoc.q)
  const xoaLoc = () => {
    setTuKhoa('')
    doiBoLoc({ duAnId: undefined, trangThai: undefined, uuTien: undefined, q: undefined })
  }

  return (
    <section>
      <div className="tieu-de-trang">
        <h1>Công việc</h1>
        <Link to="/cong-viec/tao" className="nut">
          + Tạo công việc
        </Link>
      </div>

      <div className="the-loc" role="tablist" aria-label="Lọc nhanh">
        {LOC_NHANH.map((n) => (
          <button
            key={n}
            type="button"
            role="tab"
            aria-selected={boLoc.nhanh === n}
            className={boLoc.nhanh === n ? 'the dang-chon' : 'the'}
            onClick={() => doiBoLoc({ nhanh: n })}
          >
            {TEN_LOC_NHANH[n]}
            <span className="dem">{dem.data ? dem.data[n] : '…'}</span>
          </button>
        ))}
      </div>

      <div className="thanh-loc">
        <input
          type="search"
          placeholder="Tìm theo tên hoặc mã (vd. CV-0012, nghiem thu)"
          value={tuKhoa}
          onChange={(e) => setTuKhoa(e.target.value)}
          aria-label="Tìm theo tên hoặc mã"
        />
        <select
          aria-label="Lọc theo dự án"
          value={boLoc.duAnId ?? ''}
          onChange={(e) => doiBoLoc({ duAnId: e.target.value || undefined })}
        >
          <option value="">Tất cả dự án</option>
          <option value={DU_AN_CHUNG}>Việc chung</option>
          {duAn.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.ten}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc theo trạng thái"
          value={boLoc.trangThai ?? ''}
          onChange={(e) => doiBoLoc({ trangThai: (e.target.value || undefined) as LocTrangThai | undefined })}
        >
          <option value="">Mọi trạng thái</option>
          {TRANG_THAI.map((t) => (
            <option key={t} value={t}>
              {TEN_TRANG_THAI[t]}
            </option>
          ))}
          <option value="QUA_HAN">Quá hạn</option>
        </select>
        <select
          aria-label="Lọc theo ưu tiên"
          value={boLoc.uuTien ?? ''}
          onChange={(e) => doiBoLoc({ uuTien: (e.target.value || undefined) as UuTien | undefined })}
        >
          <option value="">Mọi ưu tiên</option>
          {UU_TIEN.map((u) => (
            <option key={u} value={u}>
              {TEN_UU_TIEN[u]}
            </option>
          ))}
        </select>
        {coLocPhu && (
          <button type="button" className="phu" onClick={xoaLoc}>
            Xóa bộ lọc
          </button>
        )}
      </div>

      {ds.isPending ? (
        <DangTai />
      ) : ds.isError ? (
        <CoLoi loi={ds.error} thuLai={() => ds.refetch()} />
      ) : ds.data.data.length === 0 ? (
        <KhongCoDuLieu>
          {coLocPhu || boLoc.page > 1 ? (
            <>
              Không có công việc nào khớp bộ lọc.{' '}
              <button type="button" className="lien-ket" onClick={xoaLoc}>
                Xóa bộ lọc
              </button>
            </>
          ) : (
            <>
              Chưa có công việc nào ở mục “{TEN_LOC_NHANH[boLoc.nhanh]}”.{' '}
              <Link to="/cong-viec/tao">Tạo công việc mới</Link>
            </>
          )}
        </KhongCoDuLieu>
      ) : (
        <>
          <div className={`bang-cuon${ds.isPlaceholderData ? ' dang-lam-moi' : ''}`}>
            <table className="bang">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên</th>
                  <th>Dự án</th>
                  <th>Người thực hiện</th>
                  <th>Ưu tiên</th>
                  <th aria-sort={boLoc.sapXep === 'hetHan_asc' ? 'ascending' : 'descending'}>
                    <button
                      type="button"
                      className="lien-ket"
                      title="Đổi chiều sắp xếp theo hạn"
                      onClick={() => doiBoLoc({ sapXep: boLoc.sapXep === 'hetHan_asc' ? 'hetHan_desc' : 'hetHan_asc' })}
                    >
                      Hạn {boLoc.sapXep === 'hetHan_asc' ? '▲' : '▼'}
                    </button>
                  </th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {ds.data.data.map((cv) => (
                  <tr key={cv.id} className={cv.quaHan ? 'dong-qua-han' : undefined}>
                    <td className="ma">
                      <Link to={`/cong-viec/${cv.id}`}>{cv.ma}</Link>
                    </td>
                    <td>
                      <Link to={`/cong-viec/${cv.id}`}>{cv.ten}</Link>
                    </td>
                    <td>{tra.tenDuAn(cv.duAnId)}</td>
                    <td>{cv.nguoiThucHienIds.map(tra.tenNguoi).join(', ')}</td>
                    <td>
                      <NhanUuTien uuTien={cv.uuTien} />
                    </td>
                    <td className="ngay">{dinhDangNgay(cv.hetHan)}</td>
                    <td>
                      <NhanTrangThai trangThai={cv.trangThai} quaHan={cv.quaHan} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PhanTrang
            page={ds.data.meta.page}
            limit={ds.data.meta.limit}
            total={ds.data.meta.total}
            doiTrang={(page) => doiBoLoc({ page })}
          />
        </>
      )}
    </section>
  )
}
