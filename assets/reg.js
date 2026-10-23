/* 日月潭水域活動產業聯盟｜活動報名表（通用）
   用法：<div id="reg" data-event="活動代號" data-api="Apps Script 網址"></div>
   聯盟成員：選俱樂部 → 聯絡資料由後端自動帶入（頁面只顯示遮罩後的資料）
   非聯盟成員：自己填姓名、單位、手機、Email
   網址加 ?test=1 會標記成測試資料（不算名額、不寄提醒）。 */
(function () {
  var root = document.getElementById('reg'); if (!root) return;
  var API = root.getAttribute('data-api') || '';
  var EVENT = root.getAttribute('data-event');
  var TEST = /[?&]test=1/.test(location.search);

  // 與首頁「聯盟夥伴」相同，依業者名稱筆劃排序；後端「聯盟成員」分頁的名單會覆蓋這份
  var members = ['日出立槳', '行舟戶外', '玩立槳', '幸福日月潭', '南投縣日月潭水上觀光遊憩發展協會', '冒險卡達 SUP', '迷鹿 SUP',
    '魚人立槳', '畢瓦客', '控制狂立槳', '滑人立槳', '樂晴 SUP 俱樂部', '霏帆水岸'].map(function (n) { return { name: n, ready: false }; });

  var $ = function (s) { return root.querySelector(s); };
  var $$ = function (s) { return [].slice.call(root.querySelectorAll(s)); };
  var form = $('#regForm'), err = $('.err'), btn = $('button[type=submit]');
  var state = $('#regState'), done = $('#regDone');
  var show = function (sel, on) { $(sel).hidden = !on; };

  /* ---------- 畫面切換 ---------- */
  function isMember() { return form.elements.member.value === '1'; }
  function current() { var v = form.elements.club.value; return members.filter(function (m) { return m.name === v; })[0] || null; }

  function refresh() {
    var mem = isMember(), picked = mem ? current() : null, ready = !!(picked && picked.ready);
    show('#clubBox', mem);
    show('#autoCard', mem && ready);
    show('#autoMiss', mem && picked && !ready);
    show('#countBox', mem && !!picked);
    show('#namesBox', mem && !!picked);
    show('#peopleBox', !mem);
    show('#unitBox', !mem);
    show('#contactNameBox', mem && picked && !ready);
    show('#contactBox', !mem || (picked && !ready));
    if (ready) {
      $('#aContact').textContent = picked.contact;
      $('#aPhone').textContent = picked.phone;
      $('#aEmail').textContent = picked.email;
    }
  }

  $$('.role').forEach(function (b) {
    b.addEventListener('click', function () {
      form.elements.member.value = b.getAttribute('data-m');
      $$('.role').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      $('#regRest').hidden = false;
      refresh();
      (isMember() ? form.elements.club : $('#person1')).focus({ preventScroll: true });
    });
  });

  function renderClubs() {
    var sel = form.elements.club, cur = sel.value;
    sel.innerHTML = '<option value="">請選擇你的俱樂部</option>' + members.map(function (m) {
      var v = m.name.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      return '<option value="' + v + '">' + v + '</option>';
    }).join('');
    if (cur) sel.value = cur;
  }
  renderClubs();
  form.elements.club.addEventListener('change', refresh);

  /* ---------- 聯盟成員：人數 ---------- */
  var count = 1, MAX = 20;
  function setCount(n) {
    count = Math.max(1, Math.min(MAX, n));
    $('#cVal').textContent = count;
    $('#cMinus').disabled = count <= 1; $('#cPlus').disabled = count >= MAX;
  }
  $('#cMinus').addEventListener('click', function () { setCount(count - 1); });
  $('#cPlus').addEventListener('click', function () { setCount(count + 1); });
  setCount(1);

  /* ---------- 非聯盟成員：參加者名單 ---------- */
  var list = $('#people');
  function addPerson(focus) {
    var n = list.children.length + 1; if (n > MAX) return;
    var row = document.createElement('div'); row.className = 'person';
    row.innerHTML = '<span class="no">' + n + '</span><input type="text" name="person" id="person' + n + '" aria-label="第 ' + n + ' 位參加者姓名" placeholder="' + (n === 1 ? '姓名（聯絡人）' : '姓名') + '" autocomplete="' + (n === 1 ? 'name' : 'off') + '">' +
      (n > 1 ? '<button type="button" class="rm" aria-label="移除這一位">移除</button>' : '');
    list.appendChild(row); if (focus) row.querySelector('input').focus(); renumber();
  }
  function renumber() {
    $$('.person').forEach(function (r, i) { r.querySelector('.no').textContent = i + 1; });
    $('#peopleCount').textContent = list.children.length;
  }
  list.addEventListener('click', function (e) { if (e.target.classList.contains('rm')) { e.target.parentNode.remove(); renumber(); } });
  $('#addPerson').addEventListener('click', function () { addPerson(true); });
  addPerson(false);

  /* ---------- 活動狀態與成員資料 ---------- */
  function showState(kind, text) { state.hidden = false; state.className = 'reg-state ' + kind; state.textContent = text; }
  if (!API) {
    showState('wait', '報名系統設定中，即將開放。');
    form.querySelector('fieldset').disabled = true;
  } else {
    fetch(API + '?action=config&event=' + encodeURIComponent(EVENT))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) return;
        if (j.members && j.members.length) { members = j.members; renderClubs(); refresh(); }
        var ev = j.event;
        if (!ev.open) {
          var why = { paused: '目前暫停報名。', deadline: '報名已截止，謝謝大家的支持！', full: '名額已滿，謝謝大家的支持！' }[ev.reason] || '目前沒有開放報名。';
          showState('closed', why); form.hidden = true;
        } else if (ev.remaining != null) {
          showState('open', '剩餘名額 ' + ev.remaining + ' 位');
        }
      })
      .catch(function () { /* 讀不到時仍可報名，聯盟成員會改成手填聯絡資料 */ });
  }

  /* ---------- 送出 ---------- */
  var phoneOk = function (v) { v = v.replace(/[\s-]/g, ''); return /^09\d{8}$/.test(v) || /^\+\d{9,15}$/.test(v); };
  var emailOk = function (v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); };
  var lines = function (t) { return t.split(/\n/).map(function (s) { return s.trim(); }).filter(String); };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var mem = isMember(), picked = mem ? current() : null, needContact = !mem || !(picked && picked.ready);
    var names = mem ? lines(form.elements.names_member.value) : $$('input[name=person]').map(function (i) { return i.value.trim(); }).filter(String);
    var people = mem ? Math.max(count, names.length) : names.length;
    var phone = form.elements.phone.value.trim(), email = form.elements.email.value.trim();
    var contact = mem ? form.elements.contact.value.trim() : names[0] || '';
    var miss = [];
    if (form.elements.member.value === '') miss.push('身分');
    if (mem && !picked) miss.push('所屬俱樂部');
    if (!mem && !names.length) miss.push('參加者姓名');
    if (!mem && !form.elements.unit_other.value.trim()) miss.push('所屬單位');
    if (needContact) {
      if (mem && !contact) miss.push('聯絡人姓名');
      if (!phoneOk(phone)) miss.push('正確的手機號碼');
      if (!emailOk(email)) miss.push('正確的 Email');
    }
    if (!form.elements.agree.checked) miss.push('同意個資使用');
    var seen = {}, dup = names.filter(function (n) { var d = seen[n]; seen[n] = 1; return d; });
    if (dup.length) miss.push('刪掉重複的姓名「' + dup[0] + '」');
    if (miss.length) { err.textContent = '請完成：' + miss.join('、'); err.hidden = false; return; }

    var body = new URLSearchParams({
      action: 'register', event: EVENT, member: mem ? '1' : '0',
      unit: mem ? picked.name : form.elements.unit_other.value.trim(),
      count: String(people), names: names.join('\n'),
      contact: needContact ? contact : '', phone: needContact ? phone : '', email: needContact ? email : '',
      note: form.elements.note.value.trim(), agree: '1', test: TEST ? '1' : '0', website: form.elements.website.value
    });
    err.hidden = true; btn.disabled = true; var label = btn.textContent; btn.textContent = '送出中…';
    fetch(API, { method: 'POST', body: body })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) {
          throw new Error({
            already: '這支手機已經報名過了（報名編號 ' + j.id + '）。要更改名單，請直接回覆報名成功信。',
            closed: '報名已經關閉，沒有完成報名。',
            over: '名額不夠，目前只剩 ' + j.remaining + ' 位，請減少人數後再送出。',
            dup_name: '名單裡「' + j.name + '」重複了，請刪掉一筆再送出。',
            need_contact: '這個俱樂部的聯絡資料還沒建檔，請填寫聯絡人、手機與 Email。',
            invalid: '請完成：' + (j.fields || []).join('、')
          }[j.error] || '送出失敗，沒有完成報名。請稍後再試一次，或透過「聯繫聯盟」告訴我們。');
        }
        form.hidden = true; state.hidden = true;
        $('#doneId').textContent = j.id;
        $('#doneWho').textContent = (mem ? picked.name + '｜' : (form.elements.unit_other.value.trim() + '｜')) +
          (names.length ? names.join('、') + '（共 ' + people + ' 位）' : '共 ' + people + ' 位');
        $('#doneMail').textContent = j.email || email;
        $('#doneTitle').textContent = j.updated ? '我們有收到您更新的報名！' : '我們有收到您的報名！';
        $('#doneMsg').textContent = mem ? '聯盟夥伴直接完成報名，請 11/2（一）13:00 準時出席。' : '報名資訊已送出，後續會再寄出通知給您。';
        done.hidden = false;
        done.scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
      .catch(function (x) {
        err.textContent = x && x.message && x.message !== 'Failed to fetch' ? x.message : '網路連線失敗，沒有完成報名。請稍後再試一次。';
        err.hidden = false; btn.disabled = false; btn.textContent = label;
        if (/還沒建檔/.test(err.textContent) && picked) { picked.ready = false; refresh(); }
      });
  });
})();
