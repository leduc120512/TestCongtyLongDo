import { zodResolver } from '@hookform/resolvers/zod'
import { CreateTaskSchema, PRIORITY_LABELS, PRIORITIES, type CreateTask, type Priority } from '@longdo/contracts'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { useProjects, useEmployees } from '../hooks/useCatalog'
import { MultiPersonPicker } from './MultiPersonPicker'
import { ErrorState, Loading } from './LoadingState'

/** Giá trị trên form: ô trống là chuỗi rỗng như input HTML trả về. */
export type TaskFormValues = {
  ten: string
  moTa: string
  duAnId: string
  nguoiThucHienIds: string[]
  nguoiTheoDoiIds: string[]
  uuTien: Priority
  batDau: string
  hetHan: string
}

export const EMPTY_FORM: TaskFormValues = {
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
 * Validate bằng đúng CreateTaskSchema của contracts (cùng schema API dùng), chỉ đổi ô trống thành null
 * trước khi đưa vào schema. Nhờ vậy lỗi trên web và lỗi từ API luôn giống nhau.
 */
const baseResolver = zodResolver(CreateTaskSchema)
const resolver: Resolver<TaskFormValues, unknown, CreateTask> = (values, ctx, opts) =>
  baseResolver(
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

export function TaskForm({
  initialValues,
  submitLabel,
  submitting,
  serverError,
  onSubmit,
  onCancel,
}: {
  initialValues: TaskFormValues
  submitLabel: string
  submitting: boolean
  serverError?: string
  onSubmit: (data: CreateTask) => void
  onCancel: () => void
}) {
  const employees = useEmployees()
  const projects = useProjects()
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TaskFormValues, unknown, CreateTask>({ defaultValues: initialValues, resolver })

  if (employees.isPending || projects.isPending) return <Loading />
  if (employees.isError) return <ErrorState error={employees.error} onRetry={() => employees.refetch()} />
  if (projects.isError) return <ErrorState error={projects.error} onRetry={() => projects.refetch()} />

  const assigneeIds = watch('nguoiThucHienIds')
  const startDate = watch('batDau')

  return (
    <form className="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="field">
        <label htmlFor="ten">Tên công việc *</label>
        <input id="ten" {...register('ten')} aria-invalid={!!errors.ten} autoFocus />
        {errors.ten && <p className="field-error">{errors.ten.message}</p>}
      </div>

      <div className="field">
        <label htmlFor="moTa">Mô tả</label>
        <textarea id="moTa" rows={3} {...register('moTa')} aria-invalid={!!errors.moTa} />
        {errors.moTa && <p className="field-error">{errors.moTa.message}</p>}
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="duAnId">Dự án</label>
          <select id="duAnId" {...register('duAnId')}>
            <option value="">Việc chung (không thuộc dự án)</option>
            {projects.data.map((d) => (
              <option key={d.id} value={d.id}>
                {d.ma} · {d.ten}
              </option>
            ))}
          </select>
          {errors.duAnId && <p className="field-error">{errors.duAnId.message}</p>}
        </div>
        <div className="field">
          <label htmlFor="uuTien">Ưu tiên</label>
          <select id="uuTien" {...register('uuTien')}>
            {PRIORITIES.map((u) => (
              <option key={u} value={u}>
                {PRIORITY_LABELS[u]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="batDau">Bắt đầu</label>
          <input id="batDau" type="date" {...register('batDau', { deps: ['hetHan'] })} aria-invalid={!!errors.batDau} />
          {errors.batDau && <p className="field-error">{errors.batDau.message}</p>}
        </div>
        <div className="field">
          <label htmlFor="hetHan">Hạn</label>
          <input
            id="hetHan"
            type="date"
            min={startDate || undefined}
            {...register('hetHan')}
            aria-invalid={!!errors.hetHan}
          />
          {errors.hetHan && <p className="field-error">{errors.hetHan.message}</p>}
        </div>
      </div>

      <div className="field">
        <span className="field-label" id="nguoiThucHienIds-label">
          Người thực hiện * (ít nhất 1 người)
        </span>
        <Controller
          control={control}
          name="nguoiThucHienIds"
          render={({ field }) => (
            <MultiPersonPicker
              id="nguoiThucHienIds"
              employees={employees.data}
              value={field.value}
              invalid={!!errors.nguoiThucHienIds}
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
        {errors.nguoiThucHienIds && <p className="field-error">{errors.nguoiThucHienIds.message}</p>}
      </div>

      <div className="field">
        <span className="field-label" id="nguoiTheoDoiIds-label">
          Người theo dõi
        </span>
        <Controller
          control={control}
          name="nguoiTheoDoiIds"
          render={({ field }) => (
            <MultiPersonPicker
              id="nguoiTheoDoiIds"
              employees={employees.data}
              value={field.value}
              excluded={assigneeIds}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      {serverError && (
        <p className="error-block" role="alert">
          {serverError}
        </p>
      )}

      <div className="button-row">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Đang lưu…' : submitLabel}
        </button>
        <button type="button" className="secondary" onClick={onCancel} disabled={submitting}>
          Hủy
        </button>
      </div>
    </form>
  )
}
