import { AddCommentSchema } from '@longdo/contracts'
import { useState, type FormEvent } from 'react'
import { useComments, useAddComment } from '../hooks/useTasks'
import { useLookup } from '../hooks/useCatalog'
import { formatDateTime } from './format'
import { ErrorState, Loading, EmptyState } from './LoadingState'

/** Bình luận: ai liên quan tới công việc (giao, thực hiện, theo dõi) đều đọc và viết được. */
export function CommentPanel({ taskId }: { taskId: string }) {
  const comments = useComments(taskId)
  const addComment = useAddComment(taskId)
  const lookup = useLookup()
  const [content, setContent] = useState('')
  const [inputError, setInputError] = useState<string>()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const result = AddCommentSchema.safeParse({ noiDung: content })
    if (!result.success) {
      setInputError(result.error.issues[0]?.message)
      return
    }
    setInputError(undefined)
    const sent = result.data.noiDung
    // Chỉ xóa ô nếu người dùng chưa gõ thêm gì trong lúc chờ gửi.
    addComment.mutate(sent, { onSuccess: () => setContent((prev) => (prev.trim() === sent ? '' : prev)) })
  }

  return (
    <section className="panel">
      <h2>Bình luận</h2>
      {comments.isPending ? (
        <Loading label="Đang tải bình luận…" />
      ) : comments.isError ? (
        <ErrorState error={comments.error} onRetry={() => comments.refetch()} />
      ) : comments.data.length === 0 ? (
        <EmptyState>Chưa có bình luận nào.</EmptyState>
      ) : (
        <ol className="comments">
          {comments.data.map((comment) => (
            <li key={comment.id}>
              <div className="entry-header">
                <strong>{lookup.employeeName(comment.nguoiVietId)}</strong>
                <time dateTime={comment.taoLuc} className="muted">
                  {formatDateTime(comment.taoLuc)}
                </time>
              </div>
              <p className="comment-body">{comment.noiDung}</p>
            </li>
          ))}
        </ol>
      )}

      <form className="comment-form" onSubmit={submit}>
        <label htmlFor="comment-content" className="sr-only">
          Viết bình luận
        </label>
        <textarea
          id="comment-content"
          rows={2}
          maxLength={2000}
          placeholder="Viết bình luận…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          aria-invalid={!!inputError}
        />
        <button type="submit" disabled={addComment.isPending}>
          {addComment.isPending ? 'Đang gửi…' : 'Gửi'}
        </button>
      </form>
      {inputError && <p className="field-error">{inputError}</p>}
      {addComment.error && (
        <p className="error-block" role="alert">
          {addComment.error.message}
        </p>
      )}
    </section>
  )
}
