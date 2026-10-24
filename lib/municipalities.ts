import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import municipalityMasterRaw from "@/data/municipality_master.json";
import { TRIAL_PREF_CODES } from "@/lib/trial";
import { muniLabel, prefLabel, wardShortLabel } from "@/lib/place-names";

export interface MunicipalityConfig {
  /** 都道府県のURLセグメント（/{prefSlug}/）。gifu-pref固定リテラルをページ側へ増やさないための導出元（D-17） */
  prefSlug: string;
  /** URLセグメント（/{prefSlug}/{slug}/） */
  slug: string;
  /** 都道府県の表示名 */
  prefectureName: string;
  /** 自治体名。ページ見出しに使用 */
  cityName: string;
  /** 画面に出す自治体名（日本語版は cityName と同じ。英語版は Gifu City など。lib/place-names.ts）。照合には使わない */
  label: string;
  /** 画面に出す都道府県名（日本語版は prefectureName と同じ。英語版は Gifu Prefecture など）。照合には使わない */
  prefectureLabel: string;
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
  /** "ward"＝政令指定都市の区（scripts/gen_ward_master.py。試作マスタのみ）。市区町村の行にはキーが無い */
  kind?: "ward";
  /** 区の親の市の6桁コード（kind="ward" のときだけ） */
  parentAreaCode?: string;
  /** 区の短い名前（親の市の名前を除く。日本語「熱田区」・英語「Atsuta Ward」。kind="ward" のときだけ） */
  shortLabel?: string;
  /** 区の親の市の画面に出す名前（kind="ward" のときだけ） */
  parentLabel?: string;
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
  kind?: "ward";
  parent_area_code?: string;
}

const municipalityMaster = municipalityMasterRaw as {
  data: MunicipalityMasterRecord[];
};

/**
 * 自治体ごとの差分データ。生成元は data/municipality_master.json（手書き禁止）。
 * 新しい自治体を追加する際は scripts/gen_municipality_master.py を再実行して
 * 生成物をコミットするだけでよく、page.tsx やコンポーネントを個別に作る必要はない
 * （app/[pref]/[gov]/page.tsx 等が generateStaticParams でこの配列を読む）。
 *
 * 都道府県レコード（city_name 空）は県レイヤー（lib/prefectures.ts）の対象なので除外する。
 * status が active でない履歴行は V1 では出さない（C-8 リダイレクトは据え置き）。
 */
/**
 * 試作県（D-24・lib/trial.ts）のマスタを読む。ファイルが無ければ空（公開用ビルドは岐阜のみ）。
 * 試作マスタは data/municipality_master_{県コード}.json（scripts/gen_municipality_master.py --pref）。
 * ビルド時（サーバー側）だけで動く。クライアントコンポーネントからこのモジュールを値として読まないこと。
 */
function loadTrialRecords(): MunicipalityMasterRecord[] {
  return TRIAL_PREF_CODES.flatMap((code) => {
    const path = join(process.cwd(), "data", `municipality_master_${code}.json`);
    if (!existsSync(path)) return [];
    return (JSON.parse(readFileSync(path, "utf-8")) as { data: MunicipalityMasterRecord[] }).data;
  });
}

const RECORDS = [...municipalityMaster.data, ...loadTrialRecords()].filter(
  (r) => r.status === "active" && r.city_name !== "",
);

const ALL_UNITS: MunicipalityConfig[] = RECORDS.map((r) => {
  const parent = r.kind === "ward" ? RECORDS.find((x) => x.area_code === r.parent_area_code) : undefined;
  if (r.kind === "ward" && !parent) throw new Error(`[municipalities] 区の親の市が無い：${r.area_code} ${r.city_name}`);
  return {
    prefSlug: r.pref_slug,
    slug: r.city_slug,
    prefectureName: r.pref_name,
    cityName: r.city_name,
    label: muniLabel(r.area_code, r.city_name),
    prefectureLabel: prefLabel(r.pref_name),
    areaCode: r.area_code,
    kaigoInsurerName: r.kaigo_insurer_name,
    status: r.status,
    effectiveFrom: r.effective_from,
    effectiveTo: r.effective_to,
    successorAreaCode: r.successor_area_code,
    ...(r.kind === "ward" && parent
      ? {
          kind: "ward" as const,
          parentAreaCode: r.parent_area_code,
          shortLabel: wardShortLabel(r.area_code, r.city_name, parent.city_name),
          parentLabel: muniLabel(parent.area_code, parent.city_name),
        }
      : {}),
  };
});

/** 市区町村（政令市の区を除く）。従来どおりのページ・一覧・検索の対象 */
export const MUNICIPALITIES: MunicipalityConfig[] = ALL_UNITS.filter((m) => m.kind !== "ward");

/** 政令指定都市の区（試作マスタのみ）。区のページの対象 */
export const WARDS: MunicipalityConfig[] = ALL_UNITS.filter((m) => m.kind === "ward");

/** 区の親の市（政令指定都市）。区でなければ undefined */
export function getWardParent(ward: MunicipalityConfig): MunicipalityConfig | undefined {
  if (ward.kind !== "ward") return undefined;
  return MUNICIPALITIES.find((m) => m.areaCode === ward.parentAreaCode);
}

/** 市に属する区（試作マスタのみ。無ければ空） */
export function getWardsOf(city: MunicipalityConfig): MunicipalityConfig[] {
  return WARDS.filter((w) => w.parentAreaCode === city.areaCode);
}

/**
 * URLの slug から市区町村を引く。slug は県をまたぐと重複しうる（例：愛知県の美浜町と三重県の御浜町はどちらも mihama-cho）ため、
 * 県の slug（/{prefSlug}/{slug}/ の前半）も渡して照合する。省略時は slug だけで引く（従来の挙動）。
 */
export function getMunicipalityBySlug(slug: string, prefSlug?: string): MunicipalityConfig | undefined {
  return (
    MUNICIPALITIES.find((m) => m.slug === slug && (prefSlug === undefined || m.prefSlug === prefSlug)) ??
    WARDS.find((m) => m.slug === slug && (prefSlug === undefined || m.prefSlug === prefSlug))
  );
}
