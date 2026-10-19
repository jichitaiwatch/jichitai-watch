// lib/regions.ts
//
// 地方区分と都道府県の一覧（トップ画面の「地域から探す」用。docs/ui-vi-handoff.md §2.6）。
// 地方区分は一般的な8区分（北海道・東北・関東・中部・近畿・中国・四国・九州・沖縄）。
// 注意：三重県は近畿に入る（愛知・岐阜は中部）。東海三県は2つの地方にまたがる。
// どの県のページがあるか（公開中か）は lib/prefectures.ts の PREFECTURES が正本で、ここには持たない。

export interface Region {
  id: string;
  /** タブに出す名前 */
  label: string;
  /** 見出しに出す名前（例「中部地方」） */
  heading: string;
  /** 都道府県名（地方内の並びは全国地方公共団体コード順） */
  prefectures: string[];
}

export const REGIONS: Region[] = [
  { id: "hokkaido", label: "北海道", heading: "北海道地方", prefectures: ["北海道"] },
  { id: "tohoku", label: "東北", heading: "東北地方", prefectures: ["青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"] },
  { id: "kanto", label: "関東", heading: "関東地方", prefectures: ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"] },
  { id: "chubu", label: "中部", heading: "中部地方", prefectures: ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県"] },
  { id: "kinki", label: "近畿", heading: "近畿地方", prefectures: ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"] },
  { id: "chugoku", label: "中国", heading: "中国地方", prefectures: ["鳥取県", "島根県", "岡山県", "広島県", "山口県"] },
  { id: "shikoku", label: "四国", heading: "四国地方", prefectures: ["徳島県", "香川県", "愛媛県", "高知県"] },
  { id: "kyushu", label: "九州・沖縄", heading: "九州・沖縄地方", prefectures: ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"] },
];
