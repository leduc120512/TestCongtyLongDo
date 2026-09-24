import { zodResolver } from '@hookform/resolvers/zod'
import { TaoCongViecSchema, TEN_UU_TIEN, UU_TIEN, type TaoCongViec, type UuTien } from '@longdo/contracts'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { useDuAn, useNhanVien } from '../hooks/useCatalog'
import { ChonNhieuNguoi } from './MultiPersonPicker'
import { CoLoi, DangTai } from './LoadingState'

/** Giá trị trên form: ô trống là chuỗi rỗng như input HTML trả về. */
export type GiaTriForm = {
  ten: string
  moTa: string
  duAnId: string
  nguoiThucHienIds: string[]
  nguoiTheoDoiIds: string[]
  uuTien: UuTien
  batDau: string
  hetHan: string
}

export const FORM_TRONG: GiaTriForm = {
  ten: '',
  moTa: '',
  duAnId: '',
  nguoiThucHienIds: [],
  nguoiTheoDoiIds: [],
  uuTien: 'BINH_THUONG',
  batDau: '',
  hetHan: '',
}

/**
 * Validate bằng đúng TaoCongViecSchema của contracts (cùng schema API dùng), chỉ đổi ô trống thành null
 * trước khi đưa vào schema. Nhờ vậy lỗi trên web và lỗi từ API luôn giống nhau.
 */
const zod = zodResolver(TaoCongViecSchema)
const resolver: Resolver<GiaTriForm, unknown, TaoCongViec> = (values, ctx, opts) =>
  zod(
    {
      ...values,
      moTa: values.moTa || null,
      duAnId: values.duAnId || null,
      batDau: values.batDau || null,
      hetHan: values.hetHan || null,
    },
    ctx,
    opts as never,
  ) as never

export function FormCongViec({
  giaTriDau,
  nutLuu,
  dangGui,
  loiMayChu,
  onGui,
  onHuy,
}: {
  giaTriDau: GiaTriForm
  nutLuu: string
  dangGui: boolean
  loiMayChu?: string
  onGui: (duLieu: TaoCongViec) => void
  onHuy: () => void
}) {
  const nhanVien = useNhanVien()
  const duAn = useDuAn()
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<GiaTriForm, unknown, TaoCongViec>({ defaultValues: giaTriDau, resolver })

  if (nhanVien.isPending || duAn.isPending) return <DangTai />
  if (nhanVien.isError) return <CoLoi loi={nhanVien.error} thuLai={() => nhanVien.refetch()} />
  if (duAn.isError) return <CoLoi loi={duAn.error} thuLai={() => duAn.refetch()} />

  const thucHien = watch('nguoiThucHienIds')
  const batDau = watch('batDau')

  return (
    <form className="form" onSubmit={handleSubmit(onGui)} noValidate>
      <div className="truong">
        <label htmlFor="ten">Tên công việc *</label>
        <input id="ten" {...register('ten')} aria-invalid={!!errors.ten} autoFocus />
        {errors.ten && <p className="loi-nho">{errors.ten.message}</p>}
      </div>

      <div className="truong">
        <label htmlFor="moTa">Mô tả</label>
        <textarea id="moTa" rows={3} {...register('moTa')} aria-invalid={!!errors.moTa} />
        {errors.moTa && <p className="loi-nho">{errors.moTa.message}</p>}
      </div>

      <div className="hang">
        <div className="truong">
          <label htmlFor="duAnId">Dự án</label>
          <select id="duAnId" {...register('duAnId')}>
            <option value="">Việc chung (không thuộc dự án)</option>
            {duAn.data.map((d) => (
              <option key={d.id} value={d.id}>
                {d.ma} · {d.ten}
              </option>
            ))}
          </select>
          {errors.duAnId && <p className="loi-nho">{errors.duAnId.message}</p>}
        </div>
        <div className="truong">
          <label htmlFor="uuTien">Ưu tiên</label>
          <select id="uuTien" {...register('uuTien')}>
            {UU_TIEN.map((u) => (
              <option key={u} value={u}>
                {TEN_UU_TIEN[u]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="hang">
        <div className="truong">
          <label htmlFor="batDau">Bắt đầu</label>
          <input id="batDau" type="date" {...register('batDau', { deps: ['hetHan'] })} aria-invalid={!!errors.batDau} />
          {errors.batDau && <p className="loi-nho">{errors.batDau.message}</p>}
        </div>
        <div className="truong">
          <label htmlFor="hetHan">Hạn</label>
          <input
            id="hetHan"
            type="date"
            min={batDau || undefined}
            {...register('hetHan')}
            aria-invalid={!!errors.hetHan}
          />
          {errors.hetHan && <p className="loi-nho">{errors.hetHan.message}</p>}
        </div>
      </div>

      <div className="truong">
        <span className="nhan-truong" id="nguoiThucHienIds-nhan">
          Người thực hiện * (ít nhất 1 người)
        </span>
        <Controller
          control={control}
          name="nguoiThucHienIds"
          render={({ field }) => (
            <ChonNhieuNguoi
              id="nguoiThucHienIds"
              nhanVien={nhanVien.data}
              giaTri={field.value}
              coLoi={!!errors.nguoiThucHienIds}
              onChange={(ids) => {
                field.onChange(ids)
                // Đã thực hiện thì không cần nằm trong danh sách theo dõi.
                setValue(
                  'nguoiTheoDoiIds',
                  watch('nguoiTheoDoiIds').filter((x) => !ids.includes(x)),
                )
              }}
            />
          )}
        />
        {errors.nguoiThucHienIds && <p className="loi-nho">{errors.nguoiThucHienIds.message}</p>}
      </div>

      <div className="truong">
        <span className="nhan-truong" id="nguoiTheoDoiIds-nhan">
          Người theo dõi
        </span>
        <Controller
          control={control}
          name="nguoiTheoDoiIds"
          render={({ field }) => (
            <ChonNhieuNguoi
              id="nguoiTheoDoiIds"
              nhanVien={nhanVien.data}
              giaTri={field.value}
              loaiTru={thucHien}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      {loiMayChu && (
        <p className="loi-khoi" role="alert">
          {loiMayChu}
        </p>
      )}

      <div className="nut-hang">
        <button type="submit" disabled={dangGui}>
          {dangGui ? 'Đang lưu…' : nutLuu}
        </button>
        <button type="button" className="phu" onClick={onHuy} disabled={dangGui}>
          Hủy
        </button>
      </div>
    </form>
  )
}
