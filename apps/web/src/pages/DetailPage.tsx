import type { TaskDetail } from '@longdo/contracts'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/http'
import { formatDateTime, formatDate } from '../components/format'
import { CommentPanel } from '../components/CommentPanel'
import { ChangeHistory } from '../components/ChangeHistory'
import { StatusBadge, PriorityBadge } from '../components/Badges'
import { ErrorState, Loading, EmptyState } from '../components/LoadingState'
import { SubtaskPanel } from '../components/SubtaskPanel'
import { useUpdateProgress, useTaskDetail, useChangeStatus, useDeleteTask } from '../hooks/useTasks'
import { useLookup } from '../hooks/useCatalog'
import { listHref } from '../hooks/useUrlFilters'

/** Các nút thao tác. Chỉ hiện nút mà quyen cho phép; API vẫn tự chặn nếu ai đó gọi thẳng. */
function TaskActions({
  task,
  error,
  setError,
}: {
  task: TaskDetail
  /** Lỗi của thao tác gần nhất. Giữ ở trang cha để không mất khi khối này dựng lại sau khi tải lại dữ liệu. */
  error: Error | null
  setError: (error: Error | null) => void
}) {
  const navigate = useNavigate()
  const changeStatus = useChangeStatus(task.id)
  const updateProgress = useUpdateProgress(task.id)
  const deleteTask = useDeleteTask(task.id)
  const [progress, setProgress] = useState(task.tienDo)
  const [reason, setReason] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  // Mỗi mutation giữ error riêng nên không gộp bằng ??; chỉ hiện lỗi của thao tác gần nhất.
  const trackError = { onError: (e: Error) => setError(e), onSuccess: () => setError(null) }

  const { quyen: permissions } = task
  const busy = changeStatus.isPending || updateProgress.isPending || deleteTask.isPending
  const hasActions = Object.values(permissions).some(Boolean)
  // Người thực hiện đang làm nhưng chưa gửi duyệt được vì còn việc con chưa xong.
  const remainingSubtasks = permissions.danhDauViecCon && !permissions.guiDuyet ? task.viecCon.filter((v) => !v.xong).length : 0

  if (!hasActions) return <p className="muted">Bạn chỉ có quyền xem công việc này.</p>

  return (
    <div className="actions">
      <div className="button-row">
        {permissions.batDau && (
          <button type="button" disabled={busy} onClick={() => changeStatus.mutate({ trangThai: 'DANG_LAM' }, trackError)}>
            Bắt đầu làm
          </button>
        )}
        {permissions.guiDuyet && (
          <button type="button" disabled={busy} onClick={() => changeStatus.mutate({ trangThai: 'CHO_DUYET' }, trackError)}>
            Gửi duyệt
          </button>
        )}
        {permissions.duyet && (
          <button type="button" disabled={busy} onClick={() => changeStatus.mutate({ trangThai: 'HOAN_THANH' }, trackError)}>
            Duyệt hoàn thành
          </button>
        )}
        {permissions.traLai && (
          <button type="button" className="secondary" disabled={busy} onClick={() => dialogRef.current?.showModal()}>
            Trả lại
          </button>
        )}
        {permissions.sua && (
          <Link to={`/cong-viec/${task.id}/sua`} className="button secondary">
            Sửa
          </Link>
        )}
        {permissions.xoa && (
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Xóa công việc ${task.ma}?`)) {
                deleteTask.mutate(undefined, { onError: trackError.onError, onSuccess: () => navigate(listHref(), { replace: true }) })
              }
            }}
          >
            Xóa
          </button>
        )}
      </div>

      {remainingSubtasks > 0 && (
        <p className="muted">Còn {remainingSubtasks} việc con chưa xong — hoàn thành hết để gửi duyệt.</p>
      )}

      {permissions.capNhatTienDo && (
        <form
          className="progress-form"
          onSubmit={(e) => {
            e.preventDefault()
            updateProgress.mutate({ tienDo: progress }, trackError)
          }}
        >
          <label htmlFor="progress">Tiến độ</label>
          <input
            id="progress"
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
          />
          <output htmlFor="progress">{progress}%</output>
          <button type="submit" disabled={busy || progress === task.tienDo}>
            Lưu tiến độ
          </button>
        </form>
      )}

      {error && (
        <p className="error-block" role="alert">
          {error.message}
        </p>
      )}

      {/* Chỉ xóa lý do khi trả lại thành công hoặc bấm Hủy: API lỗi thì mở lại vẫn còn chữ đã gõ. */}
      <dialog ref={dialogRef} className="dialog">
        <form
          method="dialog"
          onSubmit={(e) => {
            if (!reason.trim()) {
              e.preventDefault()
              return
            }
            changeStatus.mutate(
              { trangThai: 'DANG_LAM', lyDo: reason.trim() },
              { onError: trackError.onError, onSuccess: () => { trackError.onSuccess(); setReason('') } },
            )
          }}
        >
          <h2>Trả lại công việc {task.ma}</h2>
          <label htmlFor="return-reason">Lý do trả lại *</label>
          <textarea
            id="return-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Vd. Thiếu biên bản nghiệm thu có chữ ký tư vấn giám sát"
            maxLength={1000}
            required
            autoFocus
          />
          {!reason.trim() && <p className="muted">Bắt buộc ghi lý do khi trả lại.</p>}
          <div className="button-row">
            <button type="submit" disabled={!reason.trim()}>
              Trả lại
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setReason('')
                dialogRef.current?.close()
              }}
            >
              Hủy
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}

export default function DetailPage() {
  const { id = '' } = useParams()
  const detail = useTaskDetail(id)
  const lookup = useLookup()
  const [actionError, setActionError] = useState<Error | null>(null)

  if (detail.isPending) return <Loading />
  // 404: không tồn tại / không liên quan / vừa bị xóa; 400: id sai định dạng — thử lại cũng vô ích.
  const notFound = detail.error instanceof ApiError && (detail.error.status === 404 || detail.error.status === 400)
  // Tải lại nền bị lỗi mà đã có dữ liệu thì giữ trang, chỉ báo lỗi phía trên.
  if (detail.isError && (notFound || !detail.data)) {
    if (notFound) {
      return (
        <EmptyState>
          Không tìm thấy công việc, hoặc bạn không có liên quan tới công việc này.{' '}
          <Link to={listHref()}>Về danh sách</Link>
        </EmptyState>
      )
    }
    return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
  }

  const task = detail.data
  return (
    <article className="detail">
      <p>
        <Link to={listHref()}>‹ Danh sách</Link>
      </p>
      {detail.isError && (
        <p className="error-block" role="alert">
          Không tải lại được dữ liệu mới nhất: {detail.error.message}{' '}
          <button type="button" className="link-button" onClick={() => detail.refetch()}>
            Thử lại
          </button>
        </p>
      )}
      {lookup.error && (
        <p className="error-block" role="alert">
          Không tải được tên nhân viên/dự án: {lookup.error.message}{' '}
          <button type="button" className="link-button" onClick={lookup.retry}>
            Thử lại
          </button>
        </p>
      )}
      <header className="page-header">
        <div>
          <span className="code">{task.ma}</span>
          <h1>{task.ten}</h1>
          <StatusBadge status={task.trangThai} overdue={task.quaHan} />
        </div>
      </header>

      {/* key: đổi trạng thái/tiến độ từ nơi khác thì form tiến độ lấy lại giá trị mới */}
      <TaskActions key={`${task.trangThai}-${task.tienDo}`} task={task} error={actionError} setError={setActionError} />

      <dl className="info-grid">
        <dt>Dự án</dt>
        <dd>{lookup.projectName(task.duAnId)}</dd>
        <dt>Người giao</dt>
        <dd>{lookup.employeeName(task.nguoiGiaoId)}</dd>
        <dt>Người thực hiện</dt>
        <dd>{task.nguoiThucHienIds.map(lookup.employeeName).join(', ')}</dd>
        <dt>Người theo dõi</dt>
        <dd>{task.nguoiTheoDoiIds.length ? task.nguoiTheoDoiIds.map(lookup.employeeName).join(', ') : '—'}</dd>
        <dt>Ưu tiên</dt>
        <dd>
          <PriorityBadge priority={task.uuTien} />
        </dd>
        <dt>Bắt đầu</dt>
        <dd>{formatDate(task.batDau)}</dd>
        <dt>Hạn</dt>
        <dd className={task.quaHan ? 'overdue-text' : undefined}>{formatDate(task.hetHan)}</dd>
        <dt>Tiến độ</dt>
        <dd>
          <progress max={100} value={task.tienDo} aria-label="Tiến độ" /> {task.tienDo}%
        </dd>
        <dt>Tạo lúc</dt>
        <dd>{formatDateTime(task.taoLuc)}</dd>
        <dt>Cập nhật lúc</dt>
        <dd>{formatDateTime(task.capNhatLuc)}</dd>
      </dl>

      {task.moTa && (
        <section>
          <h2>Mô tả</h2>
          <p className="description">{task.moTa}</p>
        </section>
      )}

      <SubtaskPanel task={task} />

      <CommentPanel taskId={task.id} />

      <section>
        <h2>Lịch sử thay đổi</h2>
        <ChangeHistory taskId={task.id} />
      </section>
    </article>
  )
}
