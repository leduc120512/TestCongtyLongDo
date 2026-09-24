import { useNavigate } from 'react-router'
import { EMPTY_FORM, TaskForm } from '../components/TaskForm'
import { useCreateTask } from '../hooks/useTasks'

export default function CreatePage() {
  const navigate = useNavigate()
  const createTask = useCreateTask()

  return (
    <section className="narrow">
      <h1>Tạo công việc</h1>
      <TaskForm
        initialValues={EMPTY_FORM}
        submitLabel="Tạo công việc"
        submitting={createTask.isPending}
        serverError={createTask.error?.message}
        onSubmit={(data) => createTask.mutate(data, { onSuccess: (task) => navigate(`/cong-viec/${task.id}`) })}
        onCancel={() => navigate('/cong-viec')}
      />
    </section>
  )
}
