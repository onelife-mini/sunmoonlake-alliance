/* 日月潭水域活動產業聯盟｜活動報名表（通用）
   用法：<div id="reg" data-event="活動代號" data-api="Apps Script 網址"></div>
   網址加 ?test=1 會標記成測試資料（不算名額、不寄提醒）。 */
(function () {
  var root = document.getElementById('reg'); if (!root) return;
  var API = root.getAttribute('data-api') || '';
  var EVENT = root.getAttribute('data-event');
  var TEST = /[?&]test=1/.test(location.search);

  // 與首頁「聯盟夥伴」相同，依業者名稱筆劃排序；試算表「設定」分頁的名單會覆蓋這份
  var CLUBS = [
    ['日出立槳', 'sunrise'], ['行舟戶外', 'gosup'], ['玩立槳', 'playsup'], ['幸福日月潭', 'xingfu'],
    ['南投縣日月潭水上觀光遊憩發展協會', 'shuixie'], ['冒險卡達 SUP', 'kadasup'], ['迷鹿 SUP', 'milu'],
    ['魚人立槳', 'onelife'], ['畢瓦客', 'biwak'], ['控制狂立槳', 'comechill'], ['滑人立槳', 'huaren'],
    ['樂晴 SUP 俱樂部', 'leqing'], ['霏帆水岸', 'feifan']
  ];
  var SHORT = { '南投縣日月潭水上觀光遊憩發展協會': '日月潭水協' };
  var logoOf = {}; CLUBS.forEach(function (c) { logoOf[c[0]] = c[1]; });

  var $ = function (s, el) { return (el || root).querySelector(s); };
  var $$ = function (s, el) { return [].slice.call((el || root).querySelectorAll(s)); };
  var form = $('#regForm'), err = $('.err', form), btn = $('button[type=submit]', form);
  var state = $('#regState'), done = $('#regDone');

  /* ---------- 身分切換 ---------- */
  function setRole(member) {
    form.elements.member.value = member ? '1' : '0';
    $$('.role', form).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-m') === (member ? '1' : '0'))); });
    $('#clubBox').hidden = !member;
    $('#unitBox').hidden = member;
    form.hidden = false; $('#regRest').hidden = false;
    if (!member) form.elements.unit_other.focus({ preventScroll: true });
  }
  $$('.role', form).forEach(function (b) { b.addEventListener('click', function () { setRole(b.getAttribute('data-m') === '1'); }); });

  /* ---------- 俱樂部 logo 選擇 ---------- */
  function renderClubs(names) {
    var box = $('#clubs');
    box.innerHTML = names.map(function (n, i) {
      var lg = logoOf[n];
      return '<label class="club"><input type="radio" name="club" value="' + n.replace(/"/g, '&quot;') + '" id="club' + i + '">' +
        '<span class="lg">' + (lg ? '<img src="/assets/logos/' + lg + '.jpg" alt="" loading="lazy">' : '<b>' + n.charAt(0) + '</b>') + '</span>' +
        '<span class="nm">' + (SHORT[n] || n) + '</span></label>';
    }).join('');
  }
  renderClubs(CLUBS.map(function (c) { return c[0]; }));

  /* ---------- 參加者名單 ---------- */
  var list = $('#people');
  function addPerson(focus) {
    var n = list.children.length + 1;
    if (n > 20) return;
    var row = document.createElement('div'); row.className = 'person';
    row.innerHTML = '<span class="no">' + n + '</span><input type="text" name="person" id="person' + n + '" aria-label="第 ' + n + ' 位參加者姓名" placeholder="' + (n === 1 ? '姓名（聯絡人）' : '姓名') + '" autocomplete="' + (n === 1 ? 'name' : 'off') + '">' +
      (n > 1 ? '<button type="button" class="rm" aria-label="移除第 ' + n + ' 位">移除</button>' : '');
    list.appendChild(row);
    if (focus) row.querySelector('input').focus();
    renumber();
  }
  function renumber() {
    $$('.person', list).forEach(function (r, i) { r.querySelector('.no').textContent = i + 1; });
    $('#peopleCount').textContent = list.children.length;
  }
  list.addEventListener('click', function (e) { if (e.target.classList.contains('rm')) { e.target.parentNode.remove(); renumber(); } });
  $('#addPerson').addEventListener('click', function () { addPerson(true); });
  addPerson(false);

  /* ---------- 讀取活動狀態 ---------- */
  function showState(kind, text) {
    state.hidden = false; state.className = 'reg-state ' + kind; state.textContent = text;
  }
  if (!API) {
    showState('wait', '報名系統設定中，即將開放。');
    form.querySelector('fieldset').disabled = true;
  } else {
    fetch(API + '?action=config&event=' + encodeURIComponent(EVENT))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) return;
        if (j.members && j.members.length) renderClubs(j.members);
        var ev = j.event;
        if (!ev.open) {
          var why = { paused: '目前暫停報名。', deadline: '報名已截止，謝謝大家的支持！', full: '名額已滿，謝謝大家的支持！' }[ev.reason] || '目前沒有開放報名。';
          showState('closed', why); form.hidden = true;
        } else if (ev.remaining != null) {
          showState('open', '剩餘名額 ' + ev.remaining + ' 位');
        }
      })
      .catch(function () { /* 讀不到狀態時仍可報名，送出時伺服器會再檢查 */ });
  }

  /* ---------- 送出 ---------- */
  var phoneOk = function (v) { return /^09\d{8}$/.test(v.replace(/[\s-]/g, '')) || /^\+\d{9,15}$/.test(v.replace(/[\s-]/g, '')); };
  var emailOk = function (v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var member = form.elements.member.value === '1';
    var club = (form.querySelector('input[name=club]:checked') || {}).value || '';
    var names = $$('input[name=person]', list).map(function (i) { return i.value.trim(); }).filter(String);
    var phone = form.elements.phone.value.trim(), email = form.elements.email.value.trim();
    var miss = [];
    if (form.elements.member.value === '') miss.push('身分');
    if (member && !club) miss.push('所屬俱樂部');
    if (!names.length) miss.push('參加者姓名');
    if (!phoneOk(phone)) miss.push('正確的手機號碼');
    if (!emailOk(email)) miss.push('正確的 Email');
    if (!form.elements.agree.checked) miss.push('同意個資使用');
    var seen = {}, dup = names.filter(function (n) { var d = seen[n]; seen[n] = 1; return d; });
    if (dup.length) miss.push('重複的姓名「' + dup[0] + '」');
    if (miss.length) { err.textContent = '請完成：' + miss.join('、'); err.hidden = false; return; }

    var body = new URLSearchParams({
      action: 'register', event: EVENT, member: member ? '1' : '0',
      unit: member ? club : form.elements.unit_other.value.trim(),
      names: names.join('\n'), phone: phone, email: email,
      note: form.elements.note.value.trim(), agree: '1', test: TEST ? '1' : '0',
      website: form.elements.website.value
    });
    err.hidden = true; btn.disabled = true; var label = btn.textContent; btn.textContent = '送出中…';
    fetch(API, { method: 'POST', body: body })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) {
          var msg = {
            already: '這支手機已經報名過了（報名編號 ' + j.id + '）。要更改名單，請直接回覆報名成功信。',
            closed: '報名已經關閉，沒有完成報名。',
            over: '名額不夠，目前只剩 ' + j.remaining + ' 位，請減少人數後再送出。',
            dup_name: '名單裡「' + j.name + '」重複了，請刪掉一筆再送出。',
            invalid: '請完成：' + (j.fields || []).join('、')
          }[j.error] || '送出失敗，沒有完成報名。請稍後再試一次，或透過「聯繫聯盟」告訴我們。';
          throw new Error(msg);
        }
        form.hidden = true; state.hidden = true;
        $('#doneId').textContent = j.id;
        $('#doneWho').textContent = (member ? club + '｜' : '') + names.join('、') + '（共 ' + names.length + ' 位）';
        $('#doneMail').textContent = email;
        $('#doneMember').hidden = !member;
        done.hidden = false;
        done.scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
      .catch(function (x) {
        err.textContent = x && x.message && x.message !== 'Failed to fetch' ? x.message : '網路連線失敗，沒有完成報名。請稍後再試一次。';
        err.hidden = false; btn.disabled = false; btn.textContent = label;
      });
  });
})();
