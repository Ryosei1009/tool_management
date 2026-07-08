// 画面表示確認用のサンプルデータ（API接続前の仮データ）

export const sampleTools = [
  { id: 'RN-0001-A', name: 'レンチA', startDate: '1月1日', endDate: '1月2日', user: '山田 太郎', place: 'A棟 1F', photoUrl: '/img/tmp/1.jpg' },
  { id: 'DR-0002-B', name: '電動ドリル', startDate: '1月1日', endDate: '1月2日', user: '佐藤 花子', place: 'B棟 2F', photoUrl: '/img/tmp/1.jpg' },
  { id: 'HM-0003-C', name: 'ハンマー', startDate: '1月1日', endDate: '1月2日', user: '鈴木 一郎', place: 'C棟 倉庫', photoUrl: '/img/tmp/1.jpg' },
  { id: 'TL-0004-D', name: 'トルクレンチ', startDate: '1月1日', endDate: '1月2日', user: '田中 次郎', place: 'A棟 3F', photoUrl: '/img/tmp/1.jpg' },
]

export const sampleRentItems = [
  { id: 'RN-0001-A', name: 'レンチA', startDate: '6月20日', endDate: '7月5日', place: 'A棟 1F', photoUrl: '/img/tmp/1.jpg' },
  { id: 'DR-0002-B', name: '電動ドリル', startDate: '6月25日', endDate: '7月8日', place: 'B棟 2F', photoUrl: '/img/tmp/1.jpg' },
  { id: 'HM-0003-C', name: 'ハンマー', startDate: '6月28日', endDate: '7月10日', place: 'C棟 倉庫', photoUrl: '/img/tmp/1.jpg' },
]

export const sampleEmployee = {
  permission: '管理者',
  name: '山田 太郎',
  id: 'E-12345',
  team: '第一製造班',
  bloodType: 'A型',
  photoUrl: '/img/tmp/1.jpg',
  histories: [
    '2026/06/30　電動ドリル（A棟 1F）',
    '2026/06/28　トルクレンチ（A棟 3F）',
    '2026/06/25　ハンマー（C棟 倉庫）',
    '2026/06/20　レンチA（B棟 2F）',
  ],
}
