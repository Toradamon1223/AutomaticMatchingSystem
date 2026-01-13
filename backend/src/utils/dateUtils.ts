// JST（日本標準時）での日時処理ユーティリティ

/**
 * JSTのISO文字列をDateオブジェクトに変換（UTCとして扱う）
 * 例: "2026-01-03T09:00:00+09:00" -> Date (UTCとして扱う)
 * 
 * フロントエンドから送られてきたJSTのISO文字列（+09:00付き）を、
 * UTCのDateオブジェクトに変換してデータベースに保存します。
 * new Date()は自動的にUTCに変換します。
 */
export function parseJSTISOString(isoString: string): Date {
  // new Date()は+09:00付きのISO文字列を自動的にUTCに変換する
  return new Date(isoString)
}

/**
 * 現在のJST時刻を取得（比較用）
 * new Date()は既にローカルタイムゾーン（JST）で動作するため、そのまま返す
 * 
 * 注意: データベースに保存する際は、Prismaが自動的にUTCとして扱います。
 * 比較の際は、この関数で取得した時刻と、データベースから取得した時刻（UTC）を比較する必要があります。
 */
export function getJSTNow(): Date {
  return new Date()
}


