import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/http'
import { TaskForm } from '../components/TaskForm'
import { ErrorState, Loading, EmptyState } from '../components/LoadingState'
import { useTaskDetail, useUpdateTask } from '../hooks/useTasks'

export default function EditPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const detail = useTaskDetail(id)
  const updateTask = useUpdateTask(id)

  if (detail.isPending) return <Loading />
  if (detail.isError) {
    // 404: không tồn tại / không liên quan; 400: id sai định dạng — thử lại cũng vô ích.
    if (detail.error instanceof ApiError && (detail.error.status === 404 || detail.error.status === 400)) {
      return (
        <EmptyState>
          Không tìm thấy công việc. <Link to="/cong-viec">Về danh sách</Link>
        </EmptyState>
      )
    }
    return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
  }

  const task = detail.data
  if (!task.quyen.sua) {
    return (
      <EmptyState>
        Bạn không có quyền sửa công việc này (chỉ người giao được sửa, và việc chưa hoàn thành).{' '}
        <Link to={`/cong-viec/${id}`}>Quay lại</Link>
      </EmptyState>
    )
  }

  return (
    <section className="narrow">
      <h1>
        Sửa <span className="code">{task.ma}</span>
      </h1>
      <TaskForm
        initialValues={{
          ten: task.ten,
          moTa: task.moTa ?? '',
          duAnId: task.duAnId ?? '',
          nguoiThucHienIds: task.nguoiThucHienIds,
          nguoiTheoDoiIds: task.nguoiTheoDoiIds,
          uuTien: task.uuTien,
          batDau: task.batDau ?? '',
          hetHan: task.hetHan ?? '',
        }}
        submitLabel="Lưu thay đổi"
        submitting={updateTask.isPending}
        serverError={updateTask.error?.message}
        onSubmit={(values) =>
          // PATCH: gửi null cho ô bỏ trống để xóa giá trị cũ; server chỉ ghi các trường thực sự đổi.
          updateTask.mutate(
            {
              ten: values.ten,
              moTa: values.moTa ?? null,
              duAnId: values.duAnId ?? null,
              uuTien: values.uuTien,
              batDau: values.batDau ?? null,
              hetHan: values.hetHan ?? null,
              nguoiThucHienIds: values.nguoiThucHienIds,
              nguoiTheoDoiIds: values.nguoiTheoDoiIds,
            },
            { onSuccess: () => navigate(`/cong-viec/${id}`) },
          )
        }
        onCancel={() => navigate(`/cong-viec/${id}`)}
      />
    </section>
  )
}
