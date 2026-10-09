(function () {
  var API = 'https://script.google.com/macros/s/AKfycbyygHO-kiDStOacPPbaUByuRvPyVKoX8fwimldKj_Cd9QnopsN8EkY8Fq-PNqzoUbIgFg/exec';

  // 手機選單
  var nav = document.getElementById('nav'), burger = document.getElementById('burger');
  if (nav && burger) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.textContent = open ? '關閉' : '選單';
    });
  }

  // 底部固定按鈕：在主視覺或申請表單可見時隱藏
  var sticky = document.getElementById('sticky');
  if (sticky && 'IntersectionObserver' in window) {
    var hide = {};
    var update = function () { sticky.classList.toggle('off', Object.keys(hide).some(function (k) { return hide[k]; })); };
    document.querySelectorAll('[data-hide-sticky]').forEach(function (el, i) {
      new IntersectionObserver(function (e) { hide[i] = e[0].isIntersecting; update(); }).observe(el);
    });
  }

  // 最新消息分類
  var filter = document.getElementById('newsFilter');
  if (filter) {
    filter.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      filter.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      var f = b.getAttribute('data-f');
      document.querySelectorAll('#newsList .news').forEach(function (n) { n.hidden = !(f === 'all' || n.getAttribute('data-c') === f); });
    });
  }

  // 表單送出
  function bind(formId, check, doneId) {
    var f = document.getElementById(formId); if (!f) return;
    var err = f.querySelector('.err'), btn = f.querySelector('button[type=submit]'), label = btn.textContent;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var miss = check(f);
      if (miss.length) { err.textContent = '請完成：' + miss.join('、'); err.hidden = false; return; }
      err.hidden = true; btn.disabled = true; btn.textContent = '送出中…';
      fetch(API, { method: 'POST', body: new URLSearchParams(new FormData(f)) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j.ok) throw new Error('fail');
          f.hidden = true;
          var d = document.getElementById(doneId); d.hidden = false;
          d.scrollIntoView({ behavior: 'smooth', block: 'center' });
        })
        .catch(function () {
          err.textContent = '送出失敗，請稍後再試一次。'; err.hidden = false;
          btn.disabled = false; btn.textContent = label;
        });
    });
  }
  var emailOk = function (v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); };
  var val = function (f, n) { return (f.elements[n] && f.elements[n].value || '').trim(); };

  bind('joinForm', function (f) {
    var m = [];
    if (!val(f, 'business_name')) m.push('業者名稱');
    if (!val(f, 'owner')) m.push('負責人');
    if (!val(f, 'phone')) m.push('聯絡電話');
    if (!val(f, 'email')) m.push('Email'); else if (!emailOk(val(f, 'email'))) m.push('正確的 Email');
    if (!f.querySelector('input[name=business_type]:checked')) m.push('業者類型');
    if (!f.elements.qualified.checked) m.push('確認合格水域業者');
    if (!f.elements.agree.checked) m.push('同意聯盟公約');
    return m;
  }, 'joinDone');

  bind('contactForm', function (f) {
    var m = [];
    if (!val(f, 'name')) m.push('姓名');
    if (!val(f, 'email')) m.push('Email'); else if (!emailOk(val(f, 'email'))) m.push('正確的 Email');
    if (!val(f, 'message')) m.push('洽詢內容');
    return m;
  }, 'contactDone');
})();
