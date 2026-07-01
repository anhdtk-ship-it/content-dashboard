/**
 * ContentSync.gs — Google Apps Script (PHASE 12)
 * ------------------------------------------------------------
 * Báo hiệu cho Dashboard Content mỗi khi Google Sheet Content thay đổi.
 * Chỉ GỬI TÍN HIỆU (không gửi dữ liệu Content). Debounce/Sync nằm ở Backend.
 *
 * Cấu hình (Project Settings > Script properties) — KHÔNG hardcode:
 *   WEBHOOK_URL  = https://content-dashboard-production-4e96.up.railway.app/api/content-sync
 *   SYNC_SECRET  = <đúng bằng CONTENT_SYNC_SECRET trên Railway>
 *
 * Chuẩn ES5 · Không thư viện ngoài · Không throw exception.
 */

/**
 * Handler cho trigger "On change" (installable).
 * @param {Object} e - Change event object (có e.changeType). Có thể undefined khi chạy tay.
 */
function onChange(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var webhookUrl = props.getProperty('WEBHOOK_URL');
    var secret = props.getProperty('SYNC_SECRET');

    // Thiếu cấu hình → log và dừng (không throw).
    if (!webhookUrl || !secret) {
      Logger.log('[ContentSync] THIẾU cấu hình: ' +
        (!webhookUrl ? 'WEBHOOK_URL ' : '') + (!secret ? 'SYNC_SECRET' : '') +
        ' — kiểm tra Script properties.');
      return;
    }

    // Lấy thông tin spreadsheet (an toàn: ưu tiên e.source, fallback active).
    var ss = (e && e.source) ? e.source : SpreadsheetApp.getActiveSpreadsheet();
    var spreadsheetId = ss ? ss.getId() : '';
    var spreadsheetName = ss ? ss.getName() : '';
    var changeType = (e && e.changeType) ? e.changeType : 'MANUAL';

    // Body: CHỈ metadata báo hiệu — KHÔNG chứa dữ liệu Content.
    var body = {
      source: 'apps-script',
      spreadsheetId: spreadsheetId,
      spreadsheetName: spreadsheetName,
      changeType: changeType,
      timestamp: new Date().toISOString()
    };

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-content-sync-secret': secret },
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    };

    var res = UrlFetchApp.fetch(webhookUrl, options);
    var code = res.getResponseCode();
    var text = res.getContentText();

    if (code === 202) {
      Logger.log('[ContentSync] OK ' + code + ' · changeType=' + changeType + ' · ' + text);
    } else {
      // Không throw — chỉ log để không làm hỏng thao tác trên Sheet.
      Logger.log('[ContentSync] Webhook trả ' + code + ' · ' + text +
        (code === 401 ? ' (SYNC_SECRET sai/thiếu?)' :
         code === 503 ? ' (Backend chưa đặt CONTENT_SYNC_SECRET?)' :
         code === 404 ? ' (Webhook chưa deploy?)' : ''));
    }
  } catch (err) {
    // Bắt mọi lỗi (mạng/timeout/…) — không throw.
    Logger.log('[ContentSync] LỖI: ' + (err && err.message ? err.message : err));
  }
}

/**
 * Chạy TAY để kiểm tra nhanh webhook (không cần chờ Sheet thay đổi).
 * Chọn hàm này trong editor rồi bấm Run, sau đó xem Executions/Logs.
 */
function testContentSyncWebhook() {
  onChange({ changeType: 'MANUAL_TEST' });
  Logger.log('[ContentSync] Đã chạy test — xem log phía trên để biết kết quả.');
}

/**
 * (Tuỳ chọn) Tạo trigger "On change" bằng code thay vì thao tác UI.
 * Chạy 1 LẦN. Tự xoá trigger onChange cũ (nếu có) để tránh trùng.
 */
function createOnChangeTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === 'onChange') {
      ScriptApp.deleteTrigger(existing[i]);
    }
  }
  ScriptApp.newTrigger('onChange')
    .forSpreadsheet(ss)
    .onChange()
    .create();
  Logger.log('[ContentSync] Đã tạo trigger On change cho: ' + ss.getName());
}
