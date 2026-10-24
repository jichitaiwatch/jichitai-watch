import { enDate } from "@/lib/format-en";
import { LOCALE } from "@/lib/locale";
import { t, tf } from "@/lib/i18n";
import type { GikaiChoFukuchoPrevious } from "@/lib/metrics";
import { personName } from "@/components/PersonName";
import { personNameLabel } from "@/lib/person-names";
import { dataTextString } from "@/lib/data-text";

interface GikaiChoFukuchoCardProps {
  /** 団体コード（市区町村は6桁、都道府県は2桁の pref_code）。英語版の氏名を引くのに使う */
  areaCode: string;
  chairName: string | null;
  viceChairName: string | null;
  /** 就任日（YYYY-MM-DD）。null＝確認できず。undefined＝この地域は未収集（行を出さない） */
  chairSince?: string | null;
  viceChairSince?: string | null;
  /** 就任日を確認した日（YYYY-MM-DD）。あるときだけ就任日の行と「○年○月○日現在」を出す */
  sinceAsOf?: string;
  /** 改選後の正副議長が未公表の間の、直前の正副議長（任期つき） */
  previous?: GikaiChoFukuchoPrevious;
}

/** "2026-05-08" → "2026年5月8日"。形式が違う値は推測せずそのまま返す */
function ymd(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m && LOCALE === "en") return enDate(s);
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : s;
}

/**
 * 正副議長カード（議会のすがた §0.10 3-1）。design/mock の person-grid（2枚パネル）を再現。
 * 氏名に加え、就任日を出す（6県分のみ収集。2026-10-21 運営者裁定）。氏名が null は「確認できず」
 * （未発見status時のみ想定・欠損規律）。就任日が null も「確認できず」（推定で埋めない＝D-25）。
 * 任期は出さない：議長・副議長の任期は議会ごとの申合せで、公式の文言を確認できた団体が少ない。
 * 改選後の正副議長が未公表の間は、直前の正副議長を就任日・退任日・退任の理由つきで出す（誤認を避ける）。
 * 事実提示のみ。
 */
export function GikaiChoFukuchoCard({
  areaCode,
  chairName,
  viceChairName,
  chairSince,
  viceChairSince,
  sinceAsOf,
  previous,
}: GikaiChoFukuchoCardProps) {
  const showSince = sinceAsOf !== undefined;
  // [識別子（日本語・React の key）, 画面に出す役職名, 氏名, 就任日]
  const rows: [string, string, string | null, string | null | undefined][] = [
    ["議長", t("gov-chair"), chairName, chairSince],
    ["副議長", t("gov-vice-chair"), viceChairName, viceChairSince],
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {rows.map(([key, role, name, since]) => (
          <div
            key={key}
            className="flex min-w-0 flex-col rounded-[9px] bg-[var(--panel)] p-3.5"
            {...(LOCALE === "en" ? { style: { containerType: "inline-size" } } : {})}
          >
            <small className="fs-label text-[var(--muted)]">{role}</small>
            {/* 英語版は「ローマ字 (漢字)」で長くなるため、1行で切らずに語の切れ目で折り返し、文字の大きさを欄の幅に合わせる
                （上限は日本語版と同じ fs-key。いま最も長い語 Mitsubayashi が 6.6em なので、欄の幅÷6.7 を下限側にする。
                スマホ幅で語の途中で折れないため）。日本語版は従来どおり（style を undefined で渡すとページ移動用のデータが
                変わるため、英語版だけ付ける） */}
            <strong
              className="mt-1.5 truncate fs-key font-bold text-[var(--body)]"
              {...(LOCALE === "en" ? { style: { whiteSpace: "normal", fontSize: "min(var(--fs-key), calc(100cqw / 6.7))" } } : {})}
            >
              {name ? personName(areaCode, name, { stack: true }) : t("val-not-confirmed")}
            </strong>
            {showSince && name ? (
              <span className="mt-1.5 fs-sub text-[var(--muted)]">
                {t("gc-took-office")}{since ? ymd(since) : t("val-not-confirmed")}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {previous ? (
        <div className="rounded-[9px] bg-[var(--panel)] p-3.5 fs-sub leading-snug text-[var(--body)]">
          <p className="m-0 font-bold">{t("gc-previous")}</p>
          <ul className="m-0 mt-1.5 list-none space-y-1 p-0">
            <li>
              {tf("p-gc-prev-chair", { name: personNameLabel(areaCode, previous.議長氏名), start: ymd(previous.就任日), end: ymd(previous.退任日), reason: dataTextString("leaving_reason", previous.退任の理由) })}
            </li>
            <li>
              {tf("p-gc-prev-vice", { name: personNameLabel(areaCode, previous.副議長氏名), start: ymd(previous.就任日), end: ymd(previous.退任日), reason: dataTextString("leaving_reason", previous.退任の理由) })}
            </li>
          </ul>
          <p className="m-0 mt-1.5 text-[var(--muted)]">
            {tf("p-gc-note", { note: dataTextString("chair_note", previous.注記), date: ymd(previous.基準日) })}
          </p>
        </div>
      ) : showSince ? (
        <p className="m-0 fs-note text-[var(--muted)]">{tf("p-gc-asof", { date: ymd(sinceAsOf) })}</p>
      ) : null}
    </div>
  );
}
