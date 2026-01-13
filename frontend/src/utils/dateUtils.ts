// JST（日本標準時）での日時処理ユーティリティ

/**
 * JSTのオフセット（9時間）をミリ秒で取得
 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * ローカル時間（JST）をUTCとして扱うDateオブジェクトを作成
 * 例: "2026-01-03T09:00:00" (JST) -> UTCとして扱うDateオブジェクト
 * 
 * 注意: この関数は、データベースにUTCとして保存する際に使用します。
 * 通常の表示や比較には使用しないでください。
 */
export function createJSTDate(dateString: string): Date {
  // 日時文字列をパース（ローカル時刻として扱う）
  const date = new Date(dateString)
  // JSTのオフセットを考慮してUTCに変換（データベース保存用）
  return new Date(date.getTime() - JST_OFFSET_MS)
}

/**
 * DateオブジェクトをJSTのISO文字列に変換
 * 例: Date -> "2026-01-03T09:00:00+09:00"
 */
export function toJSTISOString(date: Date): string {
  // JSTのオフセットを加算
  const jstTime = new Date(date.getTime() + JST_OFFSET_MS)
  const year = jstTime.getUTCFullYear()
  const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(jstTime.getUTCDate()).padStart(2, '0')
  const hours = String(jstTime.getUTCHours()).padStart(2, '0')
  const minutes = String(jstTime.getUTCMinutes()).padStart(2, '0')
  const seconds = String(jstTime.getUTCSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`
}

/**
 * ISO文字列をDateオブジェクトに変換（ローカル時刻として扱う）
 * 例: "2026-01-03T00:00:00.000Z" (UTC) -> Date (ローカル時刻として扱う)
 * 
 * データベースから取得したUTCのISO文字列を、
 * ローカル時刻として扱うDateオブジェクトに変換します。
 * new Date()は自動的にローカルタイムゾーンに変換します。
 */
export function parseJSTISOString(isoString: string): Date {
  // new Date()はUTCのISO文字列を自動的にローカル時刻に変換する
  return new Date(isoString)
}

/**
 * 現在のJST時刻を取得
 * new Date()は既にローカルタイムゾーン（JST）で動作するため、そのまま返す
 */
export function getJSTNow(): Date {
  return new Date()
}

/**
 * 日付文字列（YYYY-MM-DD）と時刻文字列（HH:mm）を結合してJSTのISO文字列を作成
 */
export function combineDateAndTime(dateStr: string, timeStr: string): string {
  if (!dateStr || !timeStr) return ''
  return `${dateStr}T${timeStr}:00+09:00`
}

/**
 * JSTのISO文字列から日付部分（YYYY-MM-DD）を取得
 */
export function getDatePart(isoString: string): string {
  if (!isoString) return ''
  return isoString.split('T')[0]
}

/**
 * JSTのISO文字列から時刻部分（HH:mm）を取得
 */
export function getTimePart(isoString: string): string {
  if (!isoString) return ''
  const timePart = isoString.split('T')[1]
  if (!timePart) return ''
  return timePart.substring(0, 5) // HH:mm
}


