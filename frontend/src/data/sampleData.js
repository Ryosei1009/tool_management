// デモデータは JSON ファイルで管理する（API接続前の仮データ）。
// データを変更したいときは下記の JSON を編集する:
//   - tools.json      … 工具一覧 / 工具検索
//   - rentItems.json  … 借りているものリスト
//   - employee.json   … マイページの社員情報

import tools from './tools.json'
import rentItems from './rentItems.json'
import employee from './employee.json'

export const sampleTools = tools
export const sampleRentItems = rentItems
export const sampleEmployee = employee
