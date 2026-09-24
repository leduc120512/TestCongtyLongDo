import { MAX_SUBTASKS, AddSubtaskSchema, type TaskDetail } from '@longdo/contracts'
import { useState, type FormEvent } from 'react'
import { useMarkSubtask, useAddSubtask, useRemoveSubtask } from '../hooks/useTasks'
import { EmptyState } from './LoadingState'

/**
 * Việc con: người giao thêm/xóa (khi chưa bắt đầu hoặc đang làm), người thực hiện tích xong (khi đang làm).
 * Có việc con thì tiến độ do server tính theo tỉ lệ đã xong.
 */
export function SubtaskPanel({ task }: { task: TaskDetail }) {
  const addSubtask = useAddSubtask(task.id)
  const markSubtask = useMarkSubtask(task.id)
  const removeSubtask = useRemoveSubtask(task.id)
  const [name, setName] = useState('')
  const [inputError, setInputError] = useState<string>()
  // Lỗi của thao tác GẦN NHẤT (mỗi mutation giữ error riêng tới khi gọi lại, nên không gộp bằng ??).
  const [error, setError] = useState<Error | null>(null)
  const trackError = { onError: (e: Error) => setError(e), onSuccess: () => setError(null) }

  const { quanLyViecCon: canManage, danhDauViecCon: canMark } = task.quyen
  const busy = addSubtask.isPending || markSubtask.isPending || removeSubtask.isPending
  const doneCount = task.viecCon.filter((v) => v.xong).length

  const submitAdd = (e: FormEvent) => {
    e.preventDefault()
    // Dùng chính schema của API để báo lỗi ngay trên web.
    const result = AddSubtaskSchema.safeParse({ ten: name })
    if (!result.success) {
      setInputError(result.error.issues[0]?.message)
      return
    }
    setInputError(undefined)
    const sent = result.data.ten
    addSubtask.mutate(sent, {
      onError: trackError.onError,
      // Chỉ xóa ô nếu người dùng chưa gõ gì thêm trong lúc chờ.
      onSuccess: () => {
        setError(null)
        setName((prev) => (prev.trim() === sent ? '' : prev))
      },
    })
  }

  return (
    <section className="panel">
      <h2>
        Việc con{' '}
        {task.viecCon.length > 0 && (
          <span className="muted">
            ({doneCount}/{task.viecCon.length} xong — tiến độ tự tính)
          </span>
        )}
      </h2>

      {task.viecCon.length === 0 ? (
        <EmptyState>
          Chưa có việc con.{canManage ? ' Thêm đầu việc bên dưới để tiến độ tự tính theo việc con.' : ''}
        </EmptyState>
      ) : (
        <ul className="subtasks">
          {task.viecCon.map((v) => (
            <li key={v.id}>
              <label className={v.xong ? 'done' : undefined}>
                <input
                  type="checkbox"
                  checked={v.xong}
                  disabled={!canMark || busy}
                  onChange={(e) => markSubtask.mutate({ subtaskId: v.id, done: e.target.checked }, trackError)}
                />
                {v.ten}
              </label>
              {canManage && (
                <button
                  type="button"
                  className="link-button"
                  disabled={busy}
                  aria-label={`Xóa việc con ${v.ten}`}
                  onClick={() => removeSubtask.mutate(v.id, trackError)}
                >
                  Xóa
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && task.viecCon.length < MAX_SUBTASKS && (
        <form className="add-row" onSubmit={submitAdd}>
          <input
            aria-label="Tên việc con mới"
            placeholder="Thêm việc con, vd. Nghiệm thu cốt thép"
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!inputError}
          />
          <button type="submit" disabled={busy}>
            Thêm
          </button>
        </form>
      )}
      {inputError && <p className="field-error">{inputError}</p>}
      {error && (
        <p className="error-block" role="alert">
          {error.message}
        </p>
      )}
    </section>
  )
}
