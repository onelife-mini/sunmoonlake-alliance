/**
 * 日月潭水域活動產業聯盟｜活動報名系統（通用版）後端
 * ------------------------------------------------------------
 * 部署帳號：2026sunmoonlake@gmail.com（試算表擁有者、寄信帳號都是它）
 * 網頁全部在 sunmoonlake.xyz；這支程式只接資料、回 JSON、寄信。
 *
 * 分頁：
 *   活動設定  一列一個活動（活動代號、名稱、日期、名額、報名開關…）
 *   設定      主辦信箱等基本設定（A:B），聯盟成員名單（D 欄）
 *   報名      一列一筆報名
 *   紀錄      每次送出、寄信、錯誤都記一筆
 *
 * 第一次使用：在試算表選單「報名管理 → 初始化試算表」，再「安裝每日排程」。
 */

var TZ = 'Asia/Taipei';
var SH = { EVENTS: '活動設定', SETTINGS: '設定', REG: '報名', LOG: '紀錄' };

var EVENT_COLS = ['活動代號', '活動名稱', '日期', '時間', '地點', '名額（人，空白＝不限）', '報名截止（空白＝活動前一天）', '報名開關', '前一天提醒', '活動頁網址', '備註'];
var REG_COLS = ['報名編號', '送出時間', '活動代號', '身分', '單位', '參加者', '人數', '聯絡人', '手機', 'Email', '備註', '測試', '報名狀態', '報名成功信', '前一天提醒', '報到'];
var LOG_COLS = ['時間', '動作', '活動代號', '報名編號', '內容', '結果'];

var DEFAULT_SETTINGS = [
  ['主辦信箱', '2026sunmoonlake@gmail.com', '新報名通知、每日待處理清單寄到這裡'],
  ['回信信箱', '2026sunmoonlake@gmail.com', '參加者回信會回到這裡'],
  ['寄件名稱', '日月潭水域活動產業聯盟', ''],
  ['聯絡電話', '', '顯示在信件底部（可空白）'],
  ['每日待處理清單', '開', '開／關：每天早上寄報名統計給主辦'],
  ['寄信帳號', '2026sunmoonlake@gmail.com', '不是這個帳號操作時會跳提醒']
];

var DEFAULT_MEMBERS = ['日出立槳', '行舟戶外', '玩立槳', '幸福日月潭', '南投縣日月潭水上觀光遊憩發展協會', '冒險卡達 SUP', '迷鹿 SUP', '魚人立槳', '畢瓦客', '控制狂立槳', '滑人立槳', '樂晴 SUP 俱樂部', '霏帆水岸'];

/* ============================ 對外 API ============================ */

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'config') return json_(getConfig_(p.event));
    return json_({ ok: true, service: 'sunmoonlake-registration' });
  } catch (err) {
    log_('錯誤', p.event, '', 'doGet ' + err, '失敗');
    return json_({ ok: false, error: 'server' });
  }
}

function doPost(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.website) return json_({ ok: true, id: 'X' });            // 機器人欄位
    if (p.action === 'register') return json_(register_(p));
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    log_('錯誤', p.event, '', 'doPost ' + err, '失敗');
    return json_({ ok: false, error: 'server' });
  }
}

/* ============================ 活動設定 ============================ */

function getConfig_(code) {
  var ev = findEvent_(code);
  if (!ev) return { ok: false, error: 'no_event' };
  var used = countPeople_(code);
  var st = eventState_(ev, used);
  return {
    ok: true,
    event: {
      code: ev.code, name: ev.name, date: ev.dateText, time: ev.time, place: ev.place,
      open: st.open, reason: st.reason,
      capacity: ev.capacity || null, remaining: ev.capacity ? Math.max(0, ev.capacity - used) : null
    },
    members: getMembers_()
  };
}

function findEvent_(code) {
  if (!code) return null;
  var rows = sheet_(SH.EVENTS).getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(code).trim()) {
      var r = rows[i];
      var date = toDate_(r[2]);
      return {
        row: i + 1, code: String(r[0]).trim(), name: String(r[1]).trim(),
        date: date, dateText: date ? Utilities.formatDate(date, TZ, 'yyyy/M/d') + '（' + '日一二三四五六'.charAt(date.getDay()) + '）' : String(r[2]),
        time: String(r[3] || '').trim(), place: String(r[4] || '').trim(),
        capacity: Number(r[5]) || 0, deadline: toDate_(r[6]),
        switchOn: String(r[7]).trim() !== '暫停', remind: String(r[8]).trim() !== '關',
        url: String(r[9] || '').trim()
      };
    }
  }
  return null;
}

function eventState_(ev, used) {
  if (!ev.switchOn) return { open: false, reason: 'paused' };
  var now = new Date();
  var deadline = ev.deadline;
  if (!deadline && ev.date) { deadline = new Date(ev.date.getTime()); deadline.setHours(23, 59, 59); deadline.setDate(deadline.getDate() - 1); }
  if (deadline && now > deadline) return { open: false, reason: 'deadline' };
  if (ev.capacity && used >= ev.capacity) return { open: false, reason: 'full' };
  return { open: true, reason: '' };
}

function getMembers_() {
  var s = sheet_(SH.SETTINGS);
  var last = s.getLastRow();
  if (last < 2) return DEFAULT_MEMBERS;
  var v = s.getRange(2, 4, last - 1, 1).getValues().map(function (r) { return String(r[0]).trim(); }).filter(String);
  return v.length ? v : DEFAULT_MEMBERS;
}

function setting_(key) {
  var rows = sheet_(SH.SETTINGS).getRange('A:B').getValues();
  for (var i = 1; i < rows.length; i++) if (String(rows[i][0]).trim() === key) return String(rows[i][1]).trim();
  for (var j = 0; j < DEFAULT_SETTINGS.length; j++) if (DEFAULT_SETTINGS[j][0] === key) return DEFAULT_SETTINGS[j][1];
  return '';
}

/* ============================ 報名 ============================ */

function register_(p) {
  var code = clean_(p.event, 40);
  var isMember = p.member === '1';
  var unit = clean_(p.unit, 60);
  var names = String(p.names || '').split(/\n/).map(function (n) { return clean_(n, 30); }).filter(String);
  var phone = String(p.phone || '').replace(/[^\d+]/g, '');
  var email = clean_(p.email, 100).toLowerCase();
  var note = clean_(p.note, 500);
  var test = p.test === '1' || /測試|test/i.test(names.join(' '));

  // 伺服器端再檢查一次
  var miss = [];
  if (!names.length) miss.push('參加者姓名');
  if (isMember && !unit) miss.push('所屬俱樂部');
  if (!/^(09\d{8}|\+?\d{9,15})$/.test(phone)) miss.push('手機');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) miss.push('Email');
  if (p.agree !== '1') miss.push('同意個資使用');
  if (names.length > 20) miss.push('一次最多 20 位');
  if (miss.length) return { ok: false, error: 'invalid', fields: miss };
  if (isMember && getMembers_().indexOf(unit) < 0) return { ok: false, error: 'invalid', fields: ['所屬俱樂部'] };

  var dup = {};
  for (var k = 0; k < names.length; k++) { if (dup[names[k]]) return { ok: false, error: 'dup_name', name: names[k] }; dup[names[k]] = 1; }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ev = findEvent_(code);
    if (!ev) return { ok: false, error: 'no_event' };
    var used = countPeople_(code);
    var st = eventState_(ev, used);
    if (!st.open) return { ok: false, error: 'closed', reason: st.reason };
    if (ev.capacity && used + names.length > ev.capacity) return { ok: false, error: 'over', remaining: ev.capacity - used };

    var existing = findByPhone_(code, phone);
    if (existing && !test) return { ok: false, error: 'already', id: existing };

    var id = newId_();
    var now = Utilities.formatDate(new Date(), TZ, 'yyyy/MM/dd HH:mm:ss');
    var s = sheet_(SH.REG);
    s.appendRow([id, now, code, isMember ? '聯盟成員' : '非聯盟成員', unit, names.join('、'), names.length,
      names[0], "'" + phone, email, note, test, '報名成功 ' + now.slice(5, 16), '', '', '']);
    SpreadsheetApp.flush();

    // 寫入後讀回確認
    var row = findRowById_(id);
    if (!row || String(row.values[8]).replace(/^'/, '') !== phone) {
      log_('報名', code, id, '讀回驗證失敗', '失敗');
      return { ok: false, error: 'server' };
    }
    log_('報名', code, id, (isMember ? '聯盟成員 ' : '') + (unit || '個人') + '｜' + names.join('、') + (test ? '（測試）' : ''), '成功');
  } finally {
    lock.releaseLock();
  }

  // 寄信放在鎖外面
  var reg = { id: id, names: names, unit: unit, isMember: isMember, phone: phone, email: email, note: note, test: test };
  try {
    sendConfirm_(ev, reg);
    sheet_(SH.REG).getRange(findRowById_(id).row, REG_COLS.indexOf('報名成功信') + 1).setValue('已寄 ' + stamp_());
    log_('寄信', code, id, '報名成功信 → ' + email, '成功');
  } catch (err) { log_('寄信', code, id, '報名成功信 ' + err, '失敗'); }
  try { notifyOrganizer_(ev, reg); } catch (err2) { log_('寄信', code, id, '主辦通知 ' + err2, '失敗'); }

  return { ok: true, id: id, count: names.length, event: { name: ev.name, date: ev.dateText, time: ev.time, place: ev.place } };
}

function countPeople_(code) {
  var rows = sheet_(SH.REG).getDataRange().getValues(), n = 0;
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[2]) === code && r[11] !== true && String(r[12]).indexOf('取消') < 0) n += Number(r[6]) || 0;
  }
  return n;
}

function findByPhone_(code, phone) {
  var rows = sheet_(SH.REG).getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[2]) === code && String(r[8]).replace(/^'/, '') === phone && r[11] !== true && String(r[12]).indexOf('取消') < 0) return r[0];
  }
  return '';
}

function findRowById_(id) {
  var rows = sheet_(SH.REG).getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) if (rows[i][0] === id) return { row: i + 1, values: rows[i] };
  return null;
}

function newId_() {
  var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
  for (var i = 0; i < 6; i++) s += c.charAt(Math.floor(Math.random() * c.length));
  return 'R-' + s;
}

/* ============================ 信件 ============================ */

// Gmail 手機版會濾掉半透明背景，所以全部用表格＋固定背景色
function mailHtml_(title, intro, rows, foot) {
  var tr = rows.map(function (r) {
    return '<tr><td style="padding:8px 12px;background:#F3F5F2;color:#46595E;font-size:14px;width:84px;vertical-align:top">' + esc_(r[0]) +
      '</td><td style="padding:8px 12px;background:#FFFFFF;color:#13323A;font-size:15px">' + esc_(r[1]).replace(/\n/g, '<br>') + '</td></tr>';
  }).join('');
  var tel = setting_('聯絡電話');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5F2"><tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #D6DFDC">' +
    '<tr><td style="background:#0F2E35;padding:18px 22px;color:#FFFFFF;font-size:16px;font-weight:bold">日月潭水域活動產業聯盟</td></tr>' +
    '<tr><td style="padding:22px;color:#13323A;font-size:15px;line-height:1.7"><div style="font-size:20px;font-weight:bold;margin-bottom:10px">' + esc_(title) + '</div>' + intro + '</td></tr>' +
    '<tr><td style="padding:0 22px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #D6DFDC">' + tr + '</table></td></tr>' +
    '<tr><td style="padding:16px 22px 22px;color:#46595E;font-size:13px;line-height:1.7">' + (foot || '') +
    '有任何問題，直接回覆這封信即可' + (tel ? '，或來電 ' + esc_(tel) : '') + '。<br>sunmoonlake.xyz</td></tr>' +
    '</table></td></tr></table>';
}

function eventRows_(ev, reg) {
  var rows = [['報名編號', reg.id], ['活動', ev.name], ['時間', ev.dateText + ' ' + ev.time], ['地點', ev.place]];
  rows.push(['身分', reg.isMember ? '聯盟成員｜' + reg.unit : '非聯盟成員' + (reg.unit ? '｜' + reg.unit : '')]);
  rows.push(['參加者', reg.names.join('、') + '（共 ' + reg.names.length + ' 位）']);
  return rows;
}

function sendConfirm_(ev, reg) {
  var subject = (reg.test ? '【測試】' : '') + '報名成功｜' + ev.name;
  var intro = esc_(reg.names[0]) + ' 您好，<br>已收到您的報名，以下是報名資料，活動當天見！' + (ev.remind ? '<br>活動前一天會再寄一封提醒信。' : '');
  MailApp.sendEmail({
    to: reg.email, subject: subject, name: setting_('寄件名稱'), replyTo: setting_('回信信箱'),
    htmlBody: mailHtml_('報名成功', intro, eventRows_(ev, reg), ev.url ? '活動資訊：' + esc_(ev.url) + '<br>' : ''),
    body: '報名成功｜' + ev.name + '\n報名編號 ' + reg.id + '\n時間 ' + ev.dateText + ' ' + ev.time + '\n地點 ' + ev.place
  });
}

function notifyOrganizer_(ev, reg) {
  var to = setting_('主辦信箱'); if (!to) return;
  var used = countPeople_(ev.code);
  var rows = eventRows_(ev, reg).concat([['手機', reg.phone], ['Email', reg.email], ['備註', reg.note || '—'], ['目前人數', used + (ev.capacity ? ' / ' + ev.capacity : '') + ' 人']]);
  MailApp.sendEmail({
    to: to, subject: (reg.test ? '【測試】' : '') + '新報名｜' + ev.name + '｜' + (reg.unit || reg.names[0]),
    name: setting_('寄件名稱'), htmlBody: mailHtml_('有一筆新報名', '', rows, '')
  });
}

/* ============================ 每日排程 ============================ */

// 每天早上 8 點：活動前一天提醒＋寄待處理清單給主辦
function dailyJob() {
  sendReminders_(false);
  if (setting_('每日待處理清單') !== '關') sendDigest_();
}

function sendReminders_(manual, onlyCode) {
  var tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  var key = Utilities.formatDate(tomorrow, TZ, 'yyyyMMdd');
  var evRows = sheet_(SH.EVENTS).getDataRange().getValues(), sent = 0, skipped = 0;
  for (var i = 1; i < evRows.length; i++) {
    var ev = findEvent_(evRows[i][0]);
    if (!ev || !ev.date || !ev.remind) continue;
    if (onlyCode ? ev.code !== onlyCode : Utilities.formatDate(ev.date, TZ, 'yyyyMMdd') !== key) continue;
    var s = sheet_(SH.REG), rows = s.getDataRange().getValues(), col = REG_COLS.indexOf('前一天提醒') + 1;
    for (var r = 1; r < rows.length; r++) {
      var v = rows[r];
      if (String(v[2]) !== ev.code || v[11] === true || String(v[12]).indexOf('取消') >= 0 || v[14]) continue;
      if (MailApp.getRemainingDailyQuota() < 5) { skipped++; continue; }
      var reg = { id: v[0], names: String(v[5]).split('、'), unit: v[4], isMember: v[3] === '聯盟成員', email: v[9] };
      try {
        MailApp.sendEmail({
          to: reg.email, subject: '明天見｜' + ev.name, name: setting_('寄件名稱'), replyTo: setting_('回信信箱'),
          htmlBody: mailHtml_('明天見！', esc_(reg.names[0]) + ' 您好，提醒您明天的活動，期待見面。', eventRows_(ev, reg), '')
        });
        s.getRange(r + 1, col).setValue('已寄 ' + stamp_()); sent++;
        log_('寄信', ev.code, reg.id, '前一天提醒', '成功');
      } catch (err) { log_('寄信', ev.code, reg.id, '前一天提醒 ' + err, '失敗'); }
    }
  }
  if (manual) SpreadsheetApp.getUi().alert('已寄出 ' + sent + ' 封提醒信。' + (skipped ? '\n今天寄信額度不夠，還有 ' + skipped + ' 封沒寄，明天再按一次（已寄的不會重寄）。' : ''));
}

function sendDigest_() {
  var to = setting_('主辦信箱'); if (!to) return;
  var since = new Date(Date.now() - 24 * 3600 * 1000);
  var rows = sheet_(SH.REG).getDataRange().getValues(), evRows = sheet_(SH.EVENTS).getDataRange().getValues();
  var lines = [], today = new Date(); today.setHours(0, 0, 0, 0);
  for (var i = 1; i < evRows.length; i++) {
    var ev = findEvent_(evRows[i][0]);
    if (!ev || (ev.date && ev.date < today)) continue;
    var total = 0, groups = 0, fresh = 0, noMail = 0;
    for (var r = 1; r < rows.length; r++) {
      var v = rows[r];
      if (String(v[2]) !== ev.code || v[11] === true || String(v[12]).indexOf('取消') >= 0) continue;
      groups++; total += Number(v[6]) || 0;
      if (new Date(String(v[1]).replace(/\//g, '-').replace(' ', 'T') + '+08:00') > since) fresh++;
      if (!v[13]) noMail++;
    }
    lines.push([ev.name, ev.dateText + '｜' + groups + ' 組 ' + total + ' 人' + (ev.capacity ? ' / 名額 ' + ev.capacity : '') +
      '\n過去 24 小時新增 ' + fresh + ' 組' + (noMail ? '\n⚠ 有 ' + noMail + ' 組沒寄出報名成功信' : '') + (ev.switchOn ? '' : '\n（報名已暫停）')]);
  }
  if (!lines.length) return;
  MailApp.sendEmail({ to: to, subject: '報名待處理清單｜' + Utilities.formatDate(new Date(), TZ, 'M/d'), name: setting_('寄件名稱'), htmlBody: mailHtml_('今日報名狀況', '', lines, '') });
}

/* ============================ 試算表選單 ============================ */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('報名管理')
    .addItem('初始化試算表', 'setupSheets')
    .addItem('安裝每日排程（每天 8 點）', 'installTrigger')
    .addSeparator()
    .addItem('手動寄出某活動的提醒信', 'menuRemind')
    .addItem('寄一封測試信給自己', 'menuTestMail')
    .addItem('資料健檢', 'menuHealth')
    .addToUi();
}

function setupSheets() {
  var ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);
  ensure_(ss, SH.EVENTS, EVENT_COLS, [['coach-talk-2026', '從一次體驗到玩家：教練的陪伴力', '2026/11/02', '13:00–15:00', '魚光窯烤 埔里門市（南投縣埔里鎮中山路四段 106 號）', '', '', '開放', '開', 'https://sunmoonlake.xyz/events/coach-talk-2026/', '講者 Yellow 教練；不審核、不收費']]);
  var st = ensure_(ss, SH.SETTINGS, ['項目', '內容', '說明', '聯盟成員（一列一個，報名表下拉選單會跟著更新）'], []);
  if (st.getLastRow() < 2) {
    st.getRange(2, 1, DEFAULT_SETTINGS.length, 3).setValues(DEFAULT_SETTINGS);
    st.getRange(2, 4, DEFAULT_MEMBERS.length, 1).setValues(DEFAULT_MEMBERS.map(function (m) { return [m]; }));
  }
  var rs = ensure_(ss, SH.REG, REG_COLS, []);
  rs.getRange(2, REG_COLS.indexOf('測試') + 1, 1000, 1).insertCheckboxes();
  ensure_(ss, SH.LOG, LOG_COLS, []);
  var ev = ss.getSheetByName(SH.EVENTS);
  ev.getRange('H2:H').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['開放', '暫停']).build());
  ev.getRange('I2:I').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['開', '關']).build());
  SpreadsheetApp.getUi().alert('完成！已建立「活動設定」「設定」「報名」「紀錄」四個分頁。');
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'dailyJob') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailyJob').timeBased().atHour(8).everyDays(1).inTimezone(TZ).create();
  SpreadsheetApp.getUi().alert('已設定：每天早上 8 點自動寄「活動前一天提醒」與「待處理清單」。');
}

function menuRemind() {
  var ui = SpreadsheetApp.getUi();
  if (!checkAccount_()) return;
  var r = ui.prompt('手動寄提醒信', '輸入活動代號（例如 coach-talk-2026）。只會寄給還沒收過提醒、非測試的報名。', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) { ui.alert('沒有寄出任何信。'); return; }
  var code = r.getResponseText().trim();
  if (!findEvent_(code)) { ui.alert('找不到活動代號「' + code + '」，沒有寄出任何信。'); return; }
  var ok = ui.alert('確認寄出', '要寄提醒信給「' + code + '」還沒收過提醒的報名嗎？\n今天剩餘寄信額度：' + MailApp.getRemainingDailyQuota() + ' 封', ui.ButtonSet.OK_CANCEL);
  if (ok !== ui.Button.OK) { ui.alert('已取消，沒有寄出任何信。'); return; }
  sendReminders_(true, code);
}

function menuTestMail() {
  var me = Session.getActiveUser().getEmail();
  var ev = findEvent_('coach-talk-2026') || { name: '測試活動', dateText: '2026/11/2（一）', time: '13:00–15:00', place: '測試地點', remind: true };
  MailApp.sendEmail({ to: me, subject: '【測試】報名成功信版型', name: setting_('寄件名稱'),
    htmlBody: mailHtml_('報名成功', '這是一封測試信，請用手機 Gmail 打開確認版面正常。', eventRows_(ev, { id: 'R-TEST01', names: ['王小明', '李小華'], unit: '魚人立槳', isMember: true }), '') });
  SpreadsheetApp.getUi().alert('已寄到 ' + me + '，請用手機打開看看。');
}

function menuHealth() {
  var rows = sheet_(SH.REG).getDataRange().getValues(), issues = [], seen = {};
  for (var i = 1; i < rows.length; i++) {
    var v = rows[i], n = i + 1;
    if (!v[0]) continue;
    if (v[11] === true) continue;
    var k = v[2] + '|' + String(v[8]).replace(/^'/, '');
    if (seen[k]) issues.push('第 ' + n + ' 列：手機與第 ' + seen[k] + ' 列重複（' + v[7] + '）'); else seen[k] = n;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v[9])) issues.push('第 ' + n + ' 列：Email 格式不對');
    if (!v[13]) issues.push('第 ' + n + ' 列：報名成功信沒有寄出（' + v[7] + '）');
    if ((Number(v[6]) || 0) !== String(v[5]).split('、').filter(String).length) issues.push('第 ' + n + ' 列：人數與參加者名單對不上');
  }
  SpreadsheetApp.getUi().alert(issues.length ? '發現 ' + issues.length + ' 個問題：\n\n' + issues.slice(0, 30).join('\n') : '資料健檢完成，沒有發現問題。');
}

function checkAccount_() {
  var me = Session.getActiveUser().getEmail(), want = setting_('寄信帳號');
  if (want && me && me !== want) {
    SpreadsheetApp.getUi().alert('目前登入的是 ' + me + '，寄信帳號應該是 ' + want + '。\n請切換帳號後再操作，這次沒有寄出任何信。');
    return false;
  }
  return true;
}

/* ============================ 工具 ============================ */

function sheet_(name) {
  var s = SpreadsheetApp.getActive().getSheetByName(name);
  if (!s) throw new Error('缺少分頁：' + name + '（請先執行「初始化試算表」）');
  return s;
}
function ensure_(ss, name, header, seed) {
  var s = ss.getSheetByName(name) || ss.insertSheet(name);
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#E3EEEC');
    s.setFrozenRows(1);
    if (seed.length) s.getRange(2, 1, seed.length, seed[0].length).setValues(seed);
  }
  return s;
}
function log_(action, code, id, detail, result) {
  try { sheet_(SH.LOG).appendRow([stamp_(true), action, code || '', id || '', String(detail).slice(0, 500), result]); } catch (e) {}
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function clean_(v, max) { return String(v || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max); }
function esc_(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function stamp_(full) { return Utilities.formatDate(new Date(), TZ, full ? 'yyyy/MM/dd HH:mm:ss' : 'MM/dd HH:mm'); }
function toDate_(v) {
  if (v instanceof Date && !isNaN(v)) return v;
  var m = String(v || '').match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
