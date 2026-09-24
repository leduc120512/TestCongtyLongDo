import { STATUS_LABELS, PRIORITY_LABELS, type TaskStatus, type Priority } from '@longdo/contracts'

export function StatusBadge({ status, overdue }: { status: TaskStatus; overdue?: boolean }) {
  return (
    <span className="badge-group">
      <span className={`badge status-${status}`}>{STATUS_LABELS[status]}</span>
      {overdue && <span className="badge overdue">Quá hạn</span>}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge priority-${priority}`}>{PRIORITY_LABELS[priority]}</span>
}
