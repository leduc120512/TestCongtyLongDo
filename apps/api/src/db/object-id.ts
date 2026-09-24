import { ObjectId } from 'mongodb'

/** Chuỗi có phải ObjectId hợp lệ (24 ký tự hex) không. */
export function isObjectId(id: string): boolean {
  return /^[0-9a-f]{24}$/i.test(id)
}

/** Đổi chuỗi sang ObjectId; không hợp lệ thì trả null để tầng trên quyết định lỗi gì. */
export function toObjectId(id: string): ObjectId | null {
  return isObjectId(id) ? new ObjectId(id) : null
}

/** Đổi danh sách chuỗi sang ObjectId, bỏ các chuỗi không hợp lệ. */
export function toObjectIds(ids: readonly string[]): ObjectId[] {
  return ids.filter(isObjectId).map((id) => new ObjectId(id))
}
