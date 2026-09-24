import { describe, expect, it } from 'vitest'
import { isMockLoginEnabled } from '../../src/config.ts'

describe('isMockLoginEnabled — đăng nhập giả lập theo môi trường', () => {
  it('dev: bật', () => {
    expect(isMockLoginEnabled({})).toBe(true)
  })

  it('production: tắt mặc định', () => {
    expect(isMockLoginEnabled({ NODE_ENV: 'production' })).toBe(false)
  })

  it('production + ALLOW_MOCK_LOGIN=true (bản demo deploy): bật', () => {
    expect(isMockLoginEnabled({ NODE_ENV: 'production', ALLOW_MOCK_LOGIN: 'true' })).toBe(true)
  })

  it('chỉ nhận đúng chuỗi "true"', () => {
    expect(isMockLoginEnabled({ NODE_ENV: 'production', ALLOW_MOCK_LOGIN: '1' })).toBe(false)
    expect(isMockLoginEnabled({ NODE_ENV: 'production', ALLOW_MOCK_LOGIN: 'TRUE' })).toBe(false)
  })
})
