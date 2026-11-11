/* 日月潭水域活動產業聯盟｜以「俱樂部」為單位的活動報名表
   用法：<div id="reg" data-event="活動代號" data-api="Apps Script 網址"></div>
         已參與名單放在 <ul id="joinedList">，數字放在 #joinedCount
   一家俱樂部報一筆：俱樂部名稱、參加者 1～2 位、聯絡手機、Email。
   後端「活動設定」的「公開已報名單位」設成「開」，頁面才會顯示已參與俱樂部。
   網址加 ?test=1 會標記成測試資料（不算名單、不寄提醒）。 */
(function () {
  var root = document.getElementById('reg'); if (!root) return;
  var API = root.getAttribute('data-api') || '';
  var EVENT = root.getAttribute('data-event');
  var TEST = /[?&]test=1/.test(location.search);

  var $ = function (s) { return root.querySelector(s); };
  var form = $('#regForm'), err = $('.err'), btn = $('button[type=submit]');
  var state = $('#regState'), done = $('#regDone'), fee = $('#feeLine');
  var joined = document.getElementById('joinedList'), joinedCount = document.getElementById('joinedCount');
  var units = null;   // 後端回傳的已參與俱樂部；null＝後端還沒提供名單
  var PRESET = ['樂晴', '行舟戶外', '魚人立槳'];   // 已確認參加的俱樂部（Leo 提供），與報名名單合併去重
  var EV = null;      // 後端回傳的活動設定

  function showState(kind, text) { state.hidden = false; state.className = 'reg-state ' + kind; state.textContent = text; }

  /* ---------- 已參與俱樂部 ---------- */
  function renderJoined() {
    if (!joined) return;
    joined.innerHTML = '';
    var list = PRESET.slice();
    (units || []).forEach(function (u) { u = String(u).trim(); if (u && list.indexOf(u) < 0) list.push(u); });
    if (!list.length) joined.innerHTML = '<li class="empty">還沒有俱樂部報名，歡迎成為第一家！</li>';
    list.forEach(function (u) { var li = document.createElement('li'); li.textContent = u; joined.appendChild(li); });
    if (joinedCount) joinedCount.textContent = list.length;
  }

  function load() {
    if (!API) return Promise.reject();
    return fetch(API + '?action=config&event=' + encodeURIComponent(EVENT)).then(function (r) { return r.json(); });
  }

  if (!API) {
    showState('wait', '報名系統設定中，即將開放。');
    form.querySelector('fieldset').disabled = true;
    renderJoined();
  } else {
    load().then(function (j) {
      if (!j.ok) { showState('wait', '報名系統設定中，即將開放。'); form.querySelector('fieldset').disabled = true; renderJoined(); return; }
      units = j.units || null; renderJoined();
      var ev = j.event; EV = ev;
      // 後端還沒更新成「每家俱樂部計費」時先不開放，避免照人頭算錢
      if (!ev.perUnit) { showState('wait', '報名系統設定中，即將開放。'); form.querySelector('fieldset').disabled = true; return; }
      if (!ev.open) {
        var why = { paused: '目前暫停報名。', deadline: '報名已截止，謝謝大家的支持！', full: '名額已滿，謝謝大家的支持！' }[ev.reason] || '目前沒有開放報名。';
        showState('closed', why); form.hidden = true; return;
      }
      if (ev.fee && ev.perUnit) {
        fee.hidden = false;
        fee.innerHTML = '<b>費用</b> 每家俱樂部 <strong>' + ev.fee.toLocaleString('en-US') + ' 元</strong><small>' + (ev.pay === '匯款' ? '送出後確認信會附上匯款資訊' : '活動當天現場繳交，用來分攤餐費') + '</small>';
      }
    }).catch(function () { renderJoined(); /* 讀不到時仍可報名 */ });
  }

  /* ---------- 送出 ---------- */
  var phoneOk = function (v) { v = v.replace(/[\s-]/g, ''); return /^09\d{8}$/.test(v) || /^\+\d{9,15}$/.test(v); };
  var emailOk = function (v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); };
  var val = function (n) { return form.elements[n].value.trim(); };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var club = val('club').replace(/[<>]/g, '').slice(0, 60).trim(), p1 = val('person1'), p2 = val('person2'), phone = val('phone'), email = val('email');
    var names = [p1, p2].filter(String), miss = [];
    if (!club) miss.push('俱樂部名稱');
    if (!p1) miss.push('參加者 1 姓名');
    if (!phoneOk(phone)) miss.push('正確的手機號碼');
    if (!emailOk(email)) miss.push('正確的 Email');
    if (!form.elements.agree.checked) miss.push('同意個資使用');
    if (p1 && p1 === p2) miss.push('兩位參加者姓名不能一樣');
    if (miss.length) { err.textContent = '請完成：' + miss.join('、'); err.hidden = false; return; }

    var body = new URLSearchParams({
      action: 'register', event: EVENT, member: '0', unit: club,
      count: String(names.length), names: names.join('\n'),
      contact: p1, phone: phone, email: email, note: '',
      agree: '1', test: TEST ? '1' : '0', website: form.elements.website.value
    });
    err.hidden = true; btn.disabled = true; var label = btn.textContent; btn.textContent = '送出中…';
    fetch(API, { method: 'POST', body: body })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) {
          throw new Error({
            unit_taken: '「' + club + '」已經報名過了。要更改參加者，請回覆報名成功信；如果不是你們報的，請透過「聯繫聯盟」告訴我們。',
            already: '這支手機已經報名過了（報名編號 ' + j.id + '）。要更改參加者，請直接回覆報名成功信。',
            closed: '報名已經關閉，沒有完成報名。',
            dup_name: '名單裡「' + j.name + '」重複了，請修改後再送出。',
            invalid: '請完成：' + (j.fields || []).join('、')
          }[j.error] || '送出失敗，沒有完成報名。請稍後再試一次，或透過「聯繫聯盟」告訴我們。');
        }
        form.hidden = true; state.hidden = true;
        $('#doneId').textContent = j.id;
        $('#doneWho').textContent = club + '｜' + names.join('、');
        $('#doneMail').textContent = j.email || email;
        $('#doneMsg').textContent = j.status === 'review' ? '報名資訊已送出，審核後會再寄出通知給您。'
          : '報名完成，請 ' + (EV ? EV.date + ' ' + EV.time.split(/[–-]/)[0] : '活動當天') + ' 準時出席。' + (j.amount ? '費用 ' + Number(j.amount).toLocaleString('en-US') + ' 元，' + (j.pay === '匯款' ? '匯款資訊在確認信裡。' : '請活動當天現場繳交。') : '');
        done.hidden = false;
        done.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // 名單馬上加上這家，再跟後端同步一次
        if (units && !TEST && j.status !== 'review' && units.indexOf(club) < 0) { units.push(club); renderJoined(); }
        load().then(function (c) { if (c.ok && c.units) { units = c.units; renderJoined(); } }).catch(function () {});
      })
      .catch(function (x) {
        err.textContent = x && x.message && x.message !== 'Failed to fetch' ? x.message : '網路連線失敗，沒有完成報名。請稍後再試一次。';
        err.hidden = false; btn.disabled = false; btn.textContent = label;
      });
  });
})();
