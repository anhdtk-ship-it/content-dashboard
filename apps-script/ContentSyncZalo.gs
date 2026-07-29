/**
 * ContentSyncZalo.gs — Google Apps Script RIÊNG cho Google Sheet ZALO.
 * ------------------------------------------------------------
 * ĐỘC LẬP hoàn toàn với Apps Script Facebook (ContentSync.gs). KHÔNG ảnh hưởng Facebook.
 * Đặt file này trong project Apps Script GẮN VỚI Google Sheet Zalo (2 tab Video/Banner).
 *
 * Nhiệm vụ: mỗi khi Sheet Zalo thay đổi → GỬI TÍN HIỆU (metadata) tới Backend.
 * Backend (/api/zalo-sync) tự đọc Google Sheet, debounce 60s rồi ghi Supabase.
 * Apps Script KHÔNG gửi dữ liệu content, KHÔNG đọc Sheet.
 *
 * CẤU HÌNH — Project Settings ▸ Script properties (KHÔNG hardcode trong code):
 *   WEBHOOK_URL = https://<domain>/api/zalo-sync
 *   SYNC_SECRET = <đúng bằng ZALO_SYNC_SECRET trên Backend/Railway>
 *
 * Chuẩn ES5 · Không thư viện ngoài · Không throw (mọi lỗi đều log, không làm hỏng Sheet).
 */

/** Tên các Script Property. */
var PROP_WEBHOOK_URL = 'WEBHOOK_URL';
var PROP_SYNC_SECRET = 'SYNC_SECRET';
/** Đường dẫn webhook Zalo (dùng để tự bổ sung nếu WEBHOOK_URL chỉ là domain gốc). */
var ZALO_SYNC_PATH = '/api/zalo-sync';

/**
 * Đọc cấu hình từ Script Properties.
 * @return {{webhookUrl: string, secret: string}|null} null nếu thiếu cấu hình (đã log).
 */
function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  var webhookUrl = props.getProperty(PROP_WEBHOOK_URL);
  var secret = props.getProperty(PROP_SYNC_SECRET);

  if (!webhookUrl || !secret) {
    Logger.log('[ContentSyncZalo] THIẾU cấu hình: ' +
      (!webhookUrl ? 'WEBHOOK_URL ' : '') + (!secret ? 'SYNC_SECRET' : '') +
      ' — vào Project Settings ▸ Script properties để đặt.');
    return null;
  }
  return { webhookUrl: resolveWebhookUrl_(webhookUrl), secret: secret };
}

/**
 * Bảo đảm URL trỏ đúng tới /api/zalo-sync.
 * - Nếu URL đã chứa '/api/zalo-sync' → giữ nguyên.
 * - Nếu chỉ là domain gốc → nối thêm '/api/zalo-sync'.
 * @param {string} url
 * @return {string}
 */
function resolveWebhookUrl_(url) {
  var u = ('' + url).replace(/\s+/g, '');
  if (u.indexOf(ZALO_SYNC_PATH) !== -1) return u;
  return u.replace(/\/+$/, '') + ZALO_SYNC_PATH;
}

/**
 * Gửi 1 tín hiệu POST JSON tới webhook Zalo. Log đầy đủ Response Code / Body / Error.
 * @param {string} source Nguồn phát tín hiệu (vd 'apps-script-zalo', 'manual-test').
 * @param {string} changeType Loại thay đổi (vd 'EDIT', 'MANUAL', 'INSERT_ROW').
 * @return {{ok: boolean, code: number, body: string}} Kết quả để hàm test kiểm tra.
 */
function postSignal_(source, changeType) {
  var cfg = getConfig_();
  if (!cfg) return { ok: false, code: 0, body: 'missing-config' };

  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }

  var payload = {
    source: source,
    changeType: changeType || 'MANUAL',
    spreadsheetId: ss ? ss.getId() : '',
    spreadsheetName: ss ? ss.getName() : '',
    timestamp: new Date().toISOString()
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-content-sync-secret': cfg.secret  // header bí mật (Backend Zalo cũng chấp nhận x-zalo-sync-secret)
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true                // để tự đọc code/body thay vì ném exception
  };

  try {
    var res = UrlFetchApp.fetch(cfg.webhookUrl, options);
    var code = res.getResponseCode();
    var body = res.getContentText();
    Logger.log('[ContentSyncZalo] POST ' + cfg.webhookUrl);
    Logger.log('[ContentSyncZalo] Response Code: ' + code);
    Logger.log('[ContentSyncZalo] Response Body: ' + body);
    if (code === 202) {
      Logger.log('[ContentSyncZalo] ✅ OK — Backend đã nhận tín hiệu (sẽ debounce 60s rồi sync).');
    } else if (code === 401) {
      Logger.log('[ContentSyncZalo] ❌ 401 — SYNC_SECRET không khớp ZALO_SYNC_SECRET trên Backend.');
    } else if (code === 503) {
      Logger.log('[ContentSyncZalo] ❌ 503 — Backend chưa đặt ZALO_SYNC_SECRET (webhook đang khoá).');
    } else {
      Logger.log('[ContentSyncZalo] ⚠️ Mã phản hồi bất thường: ' + code);
    }
    return { ok: code === 202, code: code, body: body };
  } catch (err) {
    var msg = (err && err.message) ? err.message : ('' + err);
    Logger.log('[ContentSyncZalo] ❌ Error khi gọi webhook: ' + msg);
    return { ok: false, code: 0, body: msg };
  }
}

/**
 * (1) Handler trigger "On change" (installable). e có thể undefined khi chạy tay.
 * @param {Object=} e Change event (có e.changeType, e.source).
 */
function onChange(e) {
  try {
    var changeType = (e && e.changeType) ? e.changeType : 'MANUAL';
    postSignal_('apps-script-zalo', changeType);
  } catch (err) {
    Logger.log('[ContentSyncZalo] ❌ onChange error: ' + ((err && err.message) ? err.message : err));
  }
}

/**
 * (2) Gọi thử webhook để kiểm tra cấu hình (chạy tay từ menu Run).
 * Xem kết quả ở Executions / Logs. Kỳ vọng Response Code = 202.
 */
function testContentSyncWebhook() {
  Logger.log('[ContentSyncZalo] === TEST webhook Zalo ===');
  var r = postSignal_('manual-test', 'MANUAL');
  if (r.ok) {
    Logger.log('[ContentSyncZalo] ✅ TEST THÀNH CÔNG (202). Webhook + secret OK.');
  } else {
    Logger.log('[ContentSyncZalo] ❌ TEST THẤT BẠI — code=' + r.code + ' · body=' + r.body +
      ' · kiểm tra WEBHOOK_URL / SYNC_SECRET / ZALO_SYNC_SECRET.');
  }
  return r;
}

/**
 * (3) Cài trigger "On change" cho Sheet hiện tại (chạy tay MỘT lần từ menu Run).
 * - Xoá mọi trigger onChange cũ (tránh trùng lặp).
 * - Tạo trigger đúng loại: From spreadsheet ▸ On change.
 */
function createOnChangeTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Xoá trigger onChange cũ nếu tồn tại.
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onChange') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  if (removed > 0) Logger.log('[ContentSyncZalo] Đã xoá ' + removed + ' trigger onChange cũ.');

  // Tạo trigger mới: From spreadsheet ▸ On change.
  ScriptApp.newTrigger('onChange')
    .forSpreadsheet(ss)
    .onChange()
    .create();

  Logger.log('[ContentSyncZalo] ✅ Đã tạo trigger "On change" cho Sheet: ' + ss.getName());
}
