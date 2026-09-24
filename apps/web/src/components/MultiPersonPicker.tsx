import type { Employee } from '@longdo/contracts'

/** Chọn nhiều người bằng checkbox — nhẹ, không cần thư viện select. */
export function MultiPersonPicker({
  id,
  employees,
  value,
  onChange,
  excluded = [],
  invalid,
}: {
  id: string
  employees: Employee[]
  value: string[]
  onChange: (ids: string[]) => void
  /** Người không được chọn ở ô này (vd. đã là người thực hiện thì không cần theo dõi). */
  excluded?: string[]
  invalid?: boolean
}) {
  const toggle = (employeeId: string, checked: boolean) =>
    onChange(checked ? [...value, employeeId] : value.filter((x) => x !== employeeId))

  return (
    <div
      id={id}
      className={`multi-picker${invalid ? ' invalid' : ''}`}
      role="group"
      aria-labelledby={`${id}-label`}
      aria-invalid={invalid}
    >
      {employees.map((employee) => {
        const isExcluded = excluded.includes(employee.id)
        return (
          <label key={employee.id} className={isExcluded ? 'dimmed' : undefined}>
            <input
              type="checkbox"
              checked={value.includes(employee.id)}
              disabled={isExcluded}
              onChange={(e) => toggle(employee.id, e.target.checked)}
            />
            {employee.ten} <span className="muted">· {employee.chucVu}</span>
          </label>
        )
      })}
    </div>
  )
}
