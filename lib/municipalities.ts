import municipalityMasterRaw from "@/data/municipality_master.json";

export interface MunicipalityConfig {
  /** 都道府県のURLセグメント（/{prefSlug}/）。gifu-pref固定リテラルをページ側へ増やさないための導出元（D-17） */
  prefSlug: string;
  /** URLセグメント（/{prefSlug}/{slug}/） */
  slug: string;
  /** 都道府県の表示名 */
  prefectureName: string;
  /** 自治体名。ページ見出しに使用 */
  cityName: string;
  /** 全国地方公共団体コード（6桁）。全getterの照合キー */
  areaCode: string;
  /**
   * 介護保険者名。単独市町村なら cityName と同一。広域連合なら連合名。
   * 出典は municipality_master.kaigo_insurer_name（ページ側ハードコード禁止）。
   */
  kaigoInsurerName: string;
  status: "active" | "merged" | "abolished";
  effectiveFrom: string;
  effectiveTo: string | null;
  successorAreaCode: string | null;
}

interface MunicipalityMasterRecord {
  area_code: string;
  pref_name: string;
  pref_slug: string;
  city_name: string;
  city_slug: string;
  kaigo_insurer_name: string;
  status: "active" | "merged" | "abolished";
  effective_from: string;
  effective_to: string | null;
  successor_area_code: string | null;
}

const municipalityMaster = municipalityMasterRaw as {
  data: MunicipalityMasterRecord[];
};

/**
 * 自治体ごとの差分データ。生成元は data/municipality_master.json（手書き禁止）。
 * 新しい自治体を追加する際は scripts/gen_municipality_master.py を再実行して
 * 生成物をコミットするだけでよく、page.tsx やコンポーネントを個別に作る必要はない
 * （app/gifu-pref/[gov]/page.tsx 等が generateStaticParams でこの配列を読む）。
 *
 * 都道府県レコード（city_name 空）は県レイヤー（lib/prefectures.ts）の対象なので除外する。
 * status が active でない履歴行は V1 では出さない（C-8 リダイレクトは据え置き）。
 */
export const MUNICIPALITIES: MunicipalityConfig[] = municipalityMaster.data
  .filter((r) => r.status === "active" && r.city_name !== "")
  .map((r) => ({
    prefSlug: r.pref_slug,
    slug: r.city_slug,
    prefectureName: r.pref_name,
    cityName: r.city_name,
    areaCode: r.area_code,
    kaigoInsurerName: r.kaigo_insurer_name,
    status: r.status,
    effectiveFrom: r.effective_from,
    effectiveTo: r.effective_to,
    successorAreaCode: r.successor_area_code,
  }));

export function getMunicipalityBySlug(slug: string): MunicipalityConfig | undefined {
  return MUNICIPALITIES.find((m) => m.slug === slug);
}
