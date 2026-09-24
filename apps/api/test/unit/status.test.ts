import { TASK_STATUSES, type TaskStatus } from '@longdo/contracts'
import { describe, expect, it } from 'vitest'
import { checkStatusTransition } from '../../src/services/domain/status.ts'

const ASSIGNER = 'nguoi-giao'
const ASSIGNEE = 'nguoi-lam'
const FOLLOWER = 'nguoi-xem'
const OUTSIDER = 'nguoi-ngoai'

const makeTask = (trangThai: TaskStatus, tienDo = 30) => ({
  nguoiGiaoId: ASSIGNER,
  nguoiThucHienIds: [ASSIGNEE],
  nguoiTheoDoiIds: [FOLLOWER],
  trangThai,
  tienDo,
})

/** Mọi bước chuyển hợp lệ và ai được làm. Những cặp (từ, đến) không có ở đây đều bị cấm. */
const VALID_TRANSITIONS: Array<{ from: TaskStatus; to: TaskStatus; actor: string }> = [
  { from: 'CHUA_BAT_DAU', to: 'DANG_LAM', actor: ASSIGNEE },
  { from: 'DANG_LAM', to: 'CHO_DUYET', actor: ASSIGNEE },
  { from: 'CHO_DUYET', to: 'HOAN_THANH', actor: ASSIGNER },
  { from: 'CHO_DUYET', to: 'DANG_LAM', actor: ASSIGNER },
]

describe('luồng chuyển trạng thái', () => {
  for (const { from, to, actor } of VALID_TRANSITIONS) {
    it(`${from} → ${to}: đúng người thì được`, () => {
      const result = checkStatusTransition(makeTask(from), actor, to, 'lý do')
      expect(result.ok).toBe(true)
    })

    for (const other of [ASSIGNER, ASSIGNEE, FOLLOWER, OUTSIDER].filter((x) => x !== actor)) {
      it(`${from} → ${to}: ${other} bị chặn KHONG_CO_QUYEN`, () => {
        const result = checkStatusTransition(makeTask(from), other, to, 'lý do')
        expect(result).toMatchObject({ ok: false, code: 'KHONG_CO_QUYEN' })
      })
    }
  }

  describe('mọi cặp (từ, đến) ngoài luồng đều bị chặn, kể cả với người giao kiêm thực hiện', () => {
    for (const from of TASK_STATUSES) {
      for (const to of TASK_STATUSES) {
        if (VALID_TRANSITIONS.some((b) => b.from === from && b.to === to)) continue
        it(`${from} → ${to}`, () => {
          const both = { ...makeTask(from), nguoiThucHienIds: [ASSIGNER] }
          const result = checkStatusTransition(both, ASSIGNER, to, 'lý do')
          expect(result).toMatchObject({ ok: false, code: 'TRANG_THAI_KHONG_HOP_LE' })
        })
      }
    }
  })

  it('không nhảy cóc: CHUA_BAT_DAU không sang thẳng CHO_DUYET hay HOAN_THANH', () => {
    expect(checkStatusTransition(makeTask('CHUA_BAT_DAU'), ASSIGNEE, 'CHO_DUYET').ok).toBe(false)
    expect(checkStatusTransition(makeTask('CHUA_BAT_DAU'), ASSIGNER, 'HOAN_THANH').ok).toBe(false)
  })

  it('gửi duyệt thì tiến độ tự thành 100%', () => {
    const result = checkStatusTransition(makeTask('DANG_LAM', 35), ASSIGNEE, 'CHO_DUYET')
    expect(result).toEqual({ ok: true, update: { trangThai: 'CHO_DUYET', tienDo: 100 } })
  })

  it('các bước khác không đụng tới tiến độ', () => {
    expect(checkStatusTransition(makeTask('CHUA_BAT_DAU', 0), ASSIGNEE, 'DANG_LAM')).toEqual({
      ok: true,
      update: { trangThai: 'DANG_LAM' },
    })
    expect(checkStatusTransition(makeTask('CHO_DUYET', 100), ASSIGNER, 'HOAN_THANH')).toEqual({
      ok: true,
      update: { trangThai: 'HOAN_THANH' },
    })
  })

  describe('trả lại (CHO_DUYET → DANG_LAM) bắt buộc có lý do', () => {
    for (const lyDo of [undefined, null, '', '   ']) {
      it(`lý do = ${JSON.stringify(lyDo)} → VALIDATION`, () => {
        const result = checkStatusTransition(makeTask('CHO_DUYET'), ASSIGNER, 'DANG_LAM', lyDo)
        expect(result).toMatchObject({ ok: false, code: 'VALIDATION' })
      })
    }
    it('có lý do thì được', () => {
      expect(checkStatusTransition(makeTask('CHO_DUYET'), ASSIGNER, 'DANG_LAM', 'Thiếu biên bản').ok).toBe(true)
    })
  })

  it('HOAN_THANH là trạng thái cuối: không ai chuyển đi đâu được', () => {
    for (const to of TASK_STATUSES) {
      for (const actor of [ASSIGNER, ASSIGNEE]) {
        expect(checkStatusTransition(makeTask('HOAN_THANH', 100), actor, to, 'x')).toMatchObject({
          ok: false,
          code: 'TRANG_THAI_KHONG_HOP_LE',
        })
      }
    }
  })

  it('người giao đồng thời là người thực hiện: tự làm và tự duyệt được (việc cá nhân)', () => {
    const personal = { nguoiGiaoId: ASSIGNER, nguoiThucHienIds: [ASSIGNER], nguoiTheoDoiIds: [], tienDo: 0 }
    expect(checkStatusTransition({ ...personal, trangThai: 'CHUA_BAT_DAU' }, ASSIGNER, 'DANG_LAM').ok).toBe(true)
    expect(checkStatusTransition({ ...personal, trangThai: 'DANG_LAM' }, ASSIGNER, 'CHO_DUYET').ok).toBe(true)
    expect(checkStatusTransition({ ...personal, trangThai: 'CHO_DUYET' }, ASSIGNER, 'HOAN_THANH').ok).toBe(true)
  })

  it('người thực hiện không tự duyệt được việc do người khác giao', () => {
    expect(checkStatusTransition(makeTask('CHO_DUYET'), ASSIGNEE, 'HOAN_THANH')).toMatchObject({
      ok: false,
      code: 'KHONG_CO_QUYEN',
    })
  })
})
