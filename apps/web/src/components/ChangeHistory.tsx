import {
  HISTORY_ACTION_LABELS,
  STATUS_LABELS,
  FIELD_LABELS,
  PRIORITY_LABELS,
  type FieldChange,
  type TaskStatus,
  type Priority,
} from '@longdo/contracts'
import { useTaskHistory } from '../hooks/useTasks'
import { useLookup } from '../hooks/useCatalog'
import { formatDateTime, formatDate } from './format'
import { ErrorState, Loading, EmptyState } from './LoadingState'

type Lookup = ReturnType<typeof useLookup>

/** Đổi giá trị thô trong lịch sử (id, enum, ngày) thành chữ người đọc được. */
function displayValue(field: string, value: unknown, lookup: Lookup): string {
  if (value === null || value === undefined || value === '') return '(trống)'
  switch (field) {
    case 'nguoiThucHienIds':
    case 'nguoiTheoDoiIds':
      return (value as string[]).map(lookup.employeeName).join(', ') || '(trống)'
    case 'duAnId':
      return lookup.projectName(value as string)
    case 'trangThai':
      return STATUS_LABELS[value as TaskStatus] ?? String(value)
    case 'uuTien':
      return PRIORITY_LABELS[value as Priority] ?? String(value)
    case 'batDau':
    case 'hetHan':
      return formatDate(value as string)
    case 'tienDo':
      return `${value}%`
    case 'deletedAt':
      return formatDateTime(value as string)
    case 'viecCon': {
      const subtask = value as { ten: string; xong: boolean }
      return `${subtask.xong ? '☑' : '☐'} ${subtask.ten}`
    }
    default:
      return String(value)
  }
}

function ChangeLine({ change, lookup }: { change: FieldChange; lookup: Lookup }) {
  return (
    <li>
      <strong>{FIELD_LABELS[change.truong] ?? change.truong}</strong>: <span className="old-value">{displayValue(change.truong, change.tu, lookup)}</span>
      {' → '}
      <span className="new-value">{displayValue(change.truong, change.den, lookup)}</span>
    </li>
  )
}

export function ChangeHistory({ taskId }: { taskId: string }) {
  const historyQuery = useTaskHistory(taskId)
  const lookup = useLookup()

  if (historyQuery.isPending) return <Loading label="Đang tải lịch sử…" />
  if (historyQuery.isError) return <ErrorState error={historyQuery.error} onRetry={() => historyQuery.refetch()} />
  if (historyQuery.data.length === 0) return <EmptyState>Chưa có thay đổi nào.</EmptyState>

  return (
    <ol className="history">
      {historyQuery.data.map((entry) => (
        <li key={entry.id}>
          <div className="entry-header">
            <strong>{lookup.employeeName(entry.nguoiDoiId)}</strong> · {HISTORY_ACTION_LABELS[entry.hanhDong]}
            <time dateTime={entry.luc} className="muted">
              {formatDateTime(entry.luc)}
            </time>
          </div>
          {entry.thayDoi.length > 0 && (
            <ul>
              {entry.thayDoi.map((change) => (
                <ChangeLine key={change.truong} change={change} lookup={lookup} />
              ))}
            </ul>
          )}
          {entry.lyDo && <p className="reason">Lý do: {entry.lyDo}</p>}
        </li>
      ))}
    </ol>
  )
}
