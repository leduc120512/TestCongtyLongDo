import {
  NO_PROJECT,
  QUICK_FILTERS,
  QUICK_FILTER_LABELS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  TASK_STATUSES,
  PRIORITIES,
  type StatusFilter,
  type Priority,
} from '@longdo/contracts'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { formatDate } from '../components/format'
import { StatusBadge, PriorityBadge } from '../components/Badges'
import { Pagination } from '../components/Pagination'
import { ErrorState, Loading, EmptyState } from '../components/LoadingState'
import { useUrlFilters, useDebouncedValue } from '../hooks/useUrlFilters'
import { useTaskList, useQuickFilterCounts } from '../hooks/useTasks'
import { useProjects, useLookup } from '../hooks/useCatalog'

export default function ListPage() {
  const navigate = useNavigate()
  const { filters, setFilters } = useUrlFilters()
  const list = useTaskList(filters)
  const counts = useQuickFilterCounts({ duAnId: filters.duAnId, trangThai: filters.trangThai, uuTien: filters.uuTien, q: filters.q })
  const projects = useProjects()
  const lookup = useLookup()

  // Ô tìm kiếm: gõ tới đâu hiện tới đó, nhưng chỉ đưa lên URL (và gọi API) sau khi ngừng gõ 300ms.
  // lastSent nhớ giá trị đã đưa lên gần nhất, để chỉ đồng bộ khi giá trị đã trễ thật sự đổi — tránh
  // gắn lại từ khóa cũ khi vừa bấm "Xóa bộ lọc".
  const [keyword, setKeyword] = useState(filters.q ?? '')
  const debouncedKeyword = useDebouncedValue(keyword)
  const lastSent = useRef(filters.q)
  useEffect(() => {
    const q = debouncedKeyword.trim() || undefined
    if (q !== lastSent.current) {
      lastSent.current = q
      setFilters({ q })
    }
  }, [debouncedKeyword, setFilters])
  // URL đổi từ bên ngoài (bấm logo, Back/Forward) thì ô tìm lấy theo URL.
  useEffect(() => {
    if (filters.q !== lastSent.current) {
      lastSent.current = filters.q
      setKeyword(filters.q ?? '')
    }
  }, [filters.q])

  const hasExtraFilters = !!(filters.duAnId || filters.trangThai || filters.uuTien || filters.q)
  const clearFilters = () => {
    setKeyword('')
    lastSent.current = undefined
    setFilters({ duAnId: undefined, trangThai: undefined, uuTien: undefined, q: undefined })
  }
  const retryAll = () => {
    void list.refetch()
    void counts.refetch()
  }

  return (
    <section>
      <div className="page-header">
        <h1>Công việc</h1>
        <Link to="/cong-viec/tao" className="button">
          + Tạo công việc
        </Link>
      </div>

      <div className="tabs" role="tablist" aria-label="Lọc nhanh">
        {QUICK_FILTERS.map((n) => (
          <button
            key={n}
            type="button"
            role="tab"
            aria-selected={filters.nhanh === n}
            className={filters.nhanh === n ? 'tab selected' : 'tab'}
            onClick={() => setFilters({ nhanh: n })}
          >
            {QUICK_FILTER_LABELS[n]}
            <span className="count">{counts.data ? counts.data[n] : counts.isError ? '!' : '…'}</span>
          </button>
        ))}
      </div>

      {counts.isError && !list.isError && (
        <p className="error-block" role="alert">
          Không tải được số lượng việc: {counts.error.message}{' '}
          <button type="button" className="link-button" onClick={() => counts.refetch()}>
            Thử lại
          </button>
        </p>
      )}
      {lookup.error && (
        <p className="error-block" role="alert">
          Không tải được danh sách nhân viên/dự án: {lookup.error.message}{' '}
          <button type="button" className="link-button" onClick={lookup.retry}>
            Thử lại
          </button>
        </p>
      )}

      <div className="filter-bar">
        <input
          type="search"
          maxLength={100}
          placeholder="Tìm theo tên hoặc mã (vd. CV-0012, nghiem thu)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          aria-label="Tìm theo tên hoặc mã"
        />
        <select
          aria-label="Lọc theo dự án"
          value={filters.duAnId ?? ''}
          onChange={(e) => setFilters({ duAnId: e.target.value || undefined })}
        >
          <option value="">Tất cả dự án</option>
          <option value={NO_PROJECT}>Việc chung</option>
          {projects.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.ten}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc theo trạng thái"
          value={filters.trangThai ?? ''}
          onChange={(e) => setFilters({ trangThai: (e.target.value || undefined) as StatusFilter | undefined })}
        >
          <option value="">Mọi trạng thái</option>
          {TASK_STATUSES.map((t) => (
            <option key={t} value={t}>
              {STATUS_LABELS[t]}
            </option>
          ))}
          <option value="QUA_HAN">Quá hạn</option>
        </select>
        <select
          aria-label="Lọc theo ưu tiên"
          value={filters.uuTien ?? ''}
          onChange={(e) => setFilters({ uuTien: (e.target.value || undefined) as Priority | undefined })}
        >
          <option value="">Mọi ưu tiên</option>
          {PRIORITIES.map((u) => (
            <option key={u} value={u}>
              {PRIORITY_LABELS[u]}
            </option>
          ))}
        </select>
        {hasExtraFilters && (
          <button type="button" className="secondary" onClick={clearFilters}>
            Xóa bộ lọc
          </button>
        )}
      </div>

      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={retryAll} />
      ) : list.data.data.length === 0 ? (
        <EmptyState>
          {list.data.meta.total > 0 ? (
            // Trang đang xem vượt quá trang cuối (vd. việc vừa bị xóa, hoặc sửa tay ?page= trên URL).
            <>
              Trang {list.data.meta.page} không còn công việc nào.{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => setFilters({ page: Math.ceil(list.data.meta.total / list.data.meta.limit) })}
              >
                Về trang cuối
              </button>
            </>
          ) : hasExtraFilters ? (
            <>
              Không có công việc nào khớp bộ lọc.{' '}
              <button type="button" className="link-button" onClick={clearFilters}>
                Xóa bộ lọc
              </button>
            </>
          ) : (
            <>
              Chưa có công việc nào ở mục “{QUICK_FILTER_LABELS[filters.nhanh]}”.{' '}
              <Link to="/cong-viec/tao">Tạo công việc mới</Link>
            </>
          )}
        </EmptyState>
      ) : (
        <>
          <div className={`table-scroll${list.isPlaceholderData ? ' refreshing' : ''}`}>
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên</th>
                  <th>Dự án</th>
                  <th>Người thực hiện</th>
                  <th>Ưu tiên</th>
                  <th aria-sort={filters.sapXep === 'hetHan_asc' ? 'ascending' : 'descending'}>
                    <button
                      type="button"
                      className="link-button"
                      title="Đổi chiều sắp xếp theo hạn"
                      onClick={() => setFilters({ sapXep: filters.sapXep === 'hetHan_asc' ? 'hetHan_desc' : 'hetHan_asc' })}
                    >
                      Hạn {filters.sapXep === 'hetHan_asc' ? '▲' : '▼'}
                    </button>
                  </th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {list.data.data.map((task) => (
                  <tr
                    key={task.id}
                    className={`clickable-row${task.quaHan ? ' overdue-row' : ''}`}
                    onClick={(event) => {
                      if (!(event.target instanceof Element) || !event.target.closest('a')) {
                        navigate(`/cong-viec/${task.id}`)
                      }
                    }}
                    title={`Mở công việc ${task.ma}`}
                  >
                    <td className="code">
                      <Link to={`/cong-viec/${task.id}`}>{task.ma}</Link>
                    </td>
                    <td>
                      <Link to={`/cong-viec/${task.id}`}>{task.ten}</Link>
                    </td>
                    <td>{lookup.projectName(task.duAnId)}</td>
                    <td>{task.nguoiThucHienIds.map(lookup.employeeName).join(', ')}</td>
                    <td>
                      <PriorityBadge priority={task.uuTien} />
                    </td>
                    <td className="date">{formatDate(task.hetHan)}</td>
                    <td>
                      <StatusBadge status={task.trangThai} overdue={task.quaHan} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={list.data.meta.page}
            limit={list.data.meta.limit}
            total={list.data.meta.total}
            onPageChange={(page) => setFilters({ page })}
          />
        </>
      )}
    </section>
  )
}
