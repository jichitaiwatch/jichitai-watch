/**
 * 問い合わせの自動削除（launch-backlog.md D-14）。
 * 公開文の約束：「対応が完了したメールとフォームの回答は、完了から1年を目安に削除します。」
 *
 * 置き場所：フォームの回答スプレッドシート → 拡張機能 → Apps Script に貼り付ける。
 * 運用：対応が済んだ回答は、スプレッドシートの「対応完了日」列に日付を入れる。
 *       対応が済んだメールには、Gmail で「対応完了」ラベルを付ける。
 * 毎日1回、deleteExpired を自動実行する（setupDailyTrigger を1回だけ実行して登録する）。
 */

const RETENTION_DAYS = 365;           // 完了から何日で削除するか
const DONE_HEADER = '対応完了日';      // 回答シートの列見出し
const DONE_LABEL = '対応完了';         // Gmail のラベル名

/** 毎日の自動実行を登録する（1回だけ手動で実行する）。 */
function setupDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('deleteExpired').timeBased().everyDays(1).atHour(4).create();
}

/** 期限を過ぎた回答の行とメールを削除する。 */
function deleteExpired() {
  var rows = deleteExpiredRows_(SpreadsheetApp.getActiveSpreadsheet().getSheets()[0], new Date());
  var mails = deleteExpiredMails_();
  console.log('削除した回答の行数: ' + rows + ' / ごみ箱へ移したメールのスレッド数: ' + mails);
}

function deleteExpiredRows_(sheet, now) {
  var values = sheet.getDataRange().getValues();
  var col = values[0].indexOf(DONE_HEADER);
  if (col < 0) throw new Error('「' + DONE_HEADER + '」列が見つかりません。1行目に見出しを追加してください。');
  var limit = now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  var deleted = 0;
  // 下から削除する（上から消すと行番号がずれるため）。
  for (var i = values.length - 1; i >= 1; i--) {
    var d = values[i][col];
    if (d instanceof Date && d.getTime() < limit) {
      sheet.deleteRow(i + 1);
      deleted++;
    }
  }
  return deleted;
}

function deleteExpiredMails_() {
  var label = GmailApp.getUserLabelByName(DONE_LABEL);
  if (!label) return 0;
  var n = 0;
  var threads;
  // メールの日付が基準。ごみ箱に入れたものは Gmail が30日後に完全に削除する。
  for (var round = 0; round < 20; round++) { // 念のため回数に上限を置く（無限ループ防止）
    threads = GmailApp.search('label:' + DONE_LABEL + ' older_than:' + RETENTION_DAYS + 'd', 0, 100);
    if (threads.length === 0) break;
    threads.forEach(function (t) { t.moveToTrash(); });
    n += threads.length;
  }
  return n;
}
