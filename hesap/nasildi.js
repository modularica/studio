/* Nasıldı? — the Lab's feedback sheet. One face (Bayıldım … Sevmedim), quick tags, an optional note.
 *
 * Opened through the account script, which loads this file on first use:
 *   Hesap.nasildi({ oyun: 'fish', yer: 'oyun-sonu' })   -> Promise<{ gonderildi, puan }>
 *   or any element with data-nasildi="<where>" (and data-nasildi-oyun="<slug>" outside a game page).
 *
 * Also used directly by Lab pages to draw faces:
 *   Nasildi.yuz(puan, px)  SVG markup of a face (4 Bayıldım, 3 Beğendim, 2 Eh işte, 1 Sevmedim)
 *   Nasildi.PUANLAR, Nasildi.ETIKETLER
 *
 * The sheet lives in a shadow root so a game's own styles and key handlers can't reach it.
 */
(function () {
  'use strict';
  if (window.Nasildi) return;

  var INK = '#1d2433';
  var PUANLAR = [
    { puan: 4, ad: 'Bayıldım', renk: '#ffb8cb' },
    { puan: 3, ad: 'Beğendim', renk: '#ffd95a' },
    { puan: 2, ad: 'Eh işte', renk: '#d5dde2' },
    { puan: 1, ad: 'Sevmedim', renk: '#a9d1ff' }
  ];
  var ETIKETLER = [
    { k: 'tekrar', ad: 'Tekrar oynarım' },
    { k: 'arkadas', ad: 'Arkadaşımla oynamak isterim' },
    { k: 'zor', ad: 'Çok zordu' },
    { k: 'kolay', ad: 'Çok kolaydı' },
    { k: 'anlamadim', ad: 'Nasıl oynanır anlamadım' },
    { k: 'hata', ad: 'Hata buldum' }
  ];

  function kalp(x, y) {
    return '<path d="M' + x + ' ' + (y + 4.2) + 'c-6.4-4.1-8-8.6-5.3-10.5c1.9-1.3 4.2-.4 5.3 1.5c1.1-1.9 3.4-2.8 5.3-1.5c2.7 1.9 1.1 6.4-5.3 10.5z" fill="#e5383b" stroke="' + INK + '" stroke-width="1.6" stroke-linejoin="round"/>';
  }
  function yuz(puan, px) {
    var p = PUANLAR.filter(function (x) { return x.puan === puan; })[0] || PUANLAR[1];
    var s = px || 48;
    var g = '<svg viewBox="0 0 64 64" width="' + s + '" height="' + s + '" aria-hidden="true" focusable="false">' +
      '<circle cx="32" cy="32" r="28.5" fill="' + p.renk + '" stroke="' + INK + '" stroke-width="2.6"/>' +
      '<ellipse cx="16.5" cy="38" rx="4.6" ry="3" fill="#ff7f9a" opacity=".45"/><ellipse cx="47.5" cy="38" rx="4.6" ry="3" fill="#ff7f9a" opacity=".45"/>';
    if (puan === 4) {
      g += kalp(22.5, 25) + kalp(41.5, 25) +
        '<path d="M20 37.5Q32 52 44 37.5Z" fill="' + INK + '" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"/>' +
        '<path d="M26.5 45.2Q32 41.6 37.5 45.2Q32 48.6 26.5 45.2Z" fill="#ff6f8f"/>';
    } else {
      g += '<circle cx="23" cy="27" r="3.4" fill="' + INK + '"/><circle cx="41" cy="27" r="3.4" fill="' + INK + '"/>';
      if (puan === 3) g += '<path d="M21 38Q32 49 43 38" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>';
      else if (puan === 2) g += '<path d="M23 42.5H41" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>';
      else g += '<path d="M22 46Q32 37 42 46" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M45.5 30.5c1.6 2.6 1.4 4.7-.2 5.4c-1.7.7-3.2-.8-2.6-3.2z" fill="#6fb6ff" stroke="' + INK + '" stroke-width="1.2"/>';
    }
    return g + '</svg>';
  }

  var CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box}',
    '.kok{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;',
    '  --f:ui-rounded,"SF Pro Rounded","Figtree",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-family:var(--f);color:' + INK + ';',
    '  -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}',
    '.perde{position:absolute;inset:0;background:rgba(18,24,36,.42);opacity:0;transition:opacity .2s ease}',
    '.kart{position:relative;width:100%;max-width:460px;max-height:calc(100% - 24px);overflow-y:auto;overscroll-behavior:contain;',
    '  background:#fffdf7;border:2.5px solid ' + INK + ';border-bottom:0;border-radius:24px 24px 0 0;',
    '  padding:22px 20px calc(env(safe-area-inset-bottom,0px) + 22px);box-shadow:0 -10px 40px rgba(18,24,36,.25);',
    '  transform:translateY(105%);transition:transform .26s cubic-bezier(.2,.9,.3,1.1)}',
    '.kok.acik .perde{opacity:1}.kok.acik .kart{transform:none}',
    '@media (min-width:640px) and (min-height:560px){.kok{align-items:center}.kart{border-bottom:2.5px solid ' + INK + ';border-radius:24px;transform:translateY(24px) scale(.97);opacity:0;transition:transform .22s ease,opacity .22s ease}.kok.acik .kart{opacity:1}}',
    '.kapat{position:absolute;top:10px;right:10px;width:40px;height:40px;border-radius:50%;border:0;background:transparent;color:' + INK + ';font:400 26px/1 system-ui;cursor:pointer}',
    '.kapat:hover{background:rgba(29,36,51,.07)}',
    '.ust{margin:0 44px 4px 0;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#6b7385}',
    'h2{margin:0 44px 16px 0;font-size:26px;line-height:1.15;font-weight:800;letter-spacing:-.01em}',
    '.yuzler{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}',
    '.yuz{display:grid;justify-items:center;gap:6px;padding:10px 2px 8px;border-radius:16px;border:2px solid transparent;background:transparent;cursor:pointer;color:' + INK + ';font:700 13.5px/1.15 var(--f);transition:transform .15s ease,opacity .2s ease,background .2s ease}',
    '.yuz svg{width:58px;height:58px;transition:transform .2s cubic-bezier(.2,1.6,.4,1)}',
    '.yuz:hover svg{transform:scale(1.08) rotate(-4deg)}',
    '.yuz[aria-checked="true"]{background:#fff3cc;border-color:' + INK + '}',
    '.yuz[aria-checked="true"] svg{transform:scale(1.14) rotate(-6deg)}',
    '.yuzler.secildi .yuz[aria-checked="false"]{opacity:.45}',
    '.devam{margin-top:16px;display:grid;gap:12px;animation:gel .25s ease both}',
    '@keyframes gel{from{opacity:0;transform:translateY(6px)}}',
    '.soru{margin:0;font-size:15px;font-weight:700}.soru span{font-weight:500;color:#6b7385}',
    '.cipler{display:flex;flex-wrap:wrap;gap:7px}',
    '.cip{border:2px solid rgba(29,36,51,.22);background:#fff;color:' + INK + ';border-radius:999px;padding:8px 13px;min-height:40px;font:600 14.5px/1.1 var(--f);cursor:pointer}',
    '.cip[aria-pressed="true"]{background:' + INK + ';border-color:' + INK + ';color:#fffdf7}',
    '.not{display:grid;gap:6px;font-size:14px;font-weight:600;color:#4a5263}',
    'textarea{width:100%;min-height:84px;resize:vertical;border:2px solid rgba(29,36,51,.22);border-radius:14px;padding:10px 12px;background:#fff;color:' + INK + ';font:500 16px/1.4 var(--f);-webkit-user-select:text;user-select:text}',
    'textarea:focus{outline:none;border-color:' + INK + '}',
    '.gonder{min-height:52px;border:0;border-radius:999px;background:' + INK + ';color:#fffdf7;font:800 17px/1 var(--f);cursor:pointer;box-shadow:0 4px 0 #000}',
    '.gonder:active{transform:translateY(2px);box-shadow:0 2px 0 #000}',
    '.gonder:disabled{opacity:.6;cursor:default}',
    '.hata{margin:0;min-height:1.2em;color:#c2412d;font-size:14px;font-weight:600}',
    '.tesekkur{display:grid;justify-items:center;gap:8px;text-align:center;padding:10px 0 6px;animation:gel .25s ease both}',
    '.tesekkur svg{width:84px;height:84px;animation:zipla .6s cubic-bezier(.2,1.6,.4,1) both}',
    '@keyframes zipla{from{transform:scale(.3) rotate(-30deg)}}',
    '.tesekkur b{font-size:26px;font-weight:800}.tesekkur p{margin:0;font-size:16px;color:#4a5263}',
    'button:focus-visible,textarea:focus-visible{outline:3px solid #f27a32;outline-offset:2px}',
    '[hidden]{display:none!important}',
    '@media (prefers-reduced-motion:reduce){.perde,.kart,.yuz,.yuz svg{transition:none}.devam,.tesekkur,.tesekkur svg{animation:none}}'
  ].join('\n');

  var acik = null;

  function ac(o) {
    if (acik) return acik.soz;
    o = o || {};
    var H = window.Hesap;
    var host = document.createElement('div');
    host.setAttribute('data-nasildi-sayfa', '');
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var oncekiOdak = document.activeElement;
    var durum = { puan: o.puan || 0, etiket: {}, gonderildi: false, gonderiliyor: false };
    var coz;
    var soz = new Promise(function (r) { coz = r; });

    root.innerHTML = '<style>' + CSS + '</style>' +
      '<div class="kok"><div class="perde"></div>' +
      '<section class="kart" role="dialog" aria-modal="true" aria-labelledby="baslik">' +
      '<button class="kapat" type="button" aria-label="Kapat">×</button>' +
      '<div class="soruluk">' +
      '<p class="ust">Uzi Games Lab</p>' +
      '<h2 id="baslik"></h2>' +
      '<div class="yuzler" role="radiogroup" aria-label="Puanın">' +
      PUANLAR.map(function (p) {
        return '<button class="yuz" type="button" role="radio" aria-checked="false" data-p="' + p.puan + '">' + yuz(p.puan, 58) + '<span>' + p.ad + '</span></button>';
      }).join('') +
      '</div>' +
      '<div class="devam" hidden>' +
      '<p class="soru">Ne düşündün? <span>(istersen)</span></p>' +
      '<div class="cipler">' + ETIKETLER.map(function (e) {
        return '<button class="cip" type="button" aria-pressed="false" data-k="' + e.k + '">' + e.ad + '</button>';
      }).join('') + '</div>' +
      '<label class="not"><span>Bir şey eklemek ister misin?</span>' +
      '<textarea maxlength="600" rows="3" placeholder="Neyi sevdin? Ne zordu? Ne eklensin?"></textarea></label>' +
      '<button class="gonder" type="button">Gönder</button>' +
      '<p class="hata" role="alert"></p>' +
      '</div></div>' +
      '<div class="tesekkur" hidden role="status"><span class="ty"></span><b>Teşekkürler!</b><p>Babamla birlikte okuyacağız.</p></div>' +
      '</section></div>';

    var $ = function (s) { return root.querySelector(s); };
    var kok = $('.kok');
    $('#baslik').textContent = (o.ad || 'Bu oyun') + ' nasıldı?';

    // Keep the game from reacting to anything typed or tapped in the sheet.
    ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'wheel', 'click', 'contextmenu'].forEach(function (t) {
      host.addEventListener(t, function (e) {
        e.stopPropagation();
        if (t === 'keydown' && e.key === 'Escape') kapat();
      });
    });

    function puanSec(p) {
      durum.puan = p;
      root.querySelectorAll('.yuz').forEach(function (b) { b.setAttribute('aria-checked', String(+b.dataset.p === p)); });
      $('.yuzler').classList.add('secildi');
      var d = $('.devam');
      if (d.hidden) { d.hidden = false; }
    }
    root.querySelectorAll('.yuz').forEach(function (b) {
      b.addEventListener('click', function () { puanSec(+b.dataset.p); });
    });
    root.querySelectorAll('.cip').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.k, on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        durum.etiket[k] = on;
        var karsi = k === 'zor' ? 'kolay' : k === 'kolay' ? 'zor' : null;
        if (on && karsi && durum.etiket[karsi]) {
          durum.etiket[karsi] = false;
          root.querySelector('.cip[data-k="' + karsi + '"]').setAttribute('aria-pressed', 'false');
        }
      });
    });

    function veri() {
      var not = ($('textarea').value || '').trim().slice(0, 600);
      return {
        oyun: o.oyun, yer: o.yer || null, puan: durum.puan,
        etiketler: ETIKETLER.map(function (e) { return e.k; }).filter(function (k) { return durum.etiket[k]; }),
        not: not || null
      };
    }
    function gonder() {
      if (!durum.puan || durum.gonderiliyor || durum.gonderildi) return;
      if (!H || !H.yorum) { $('.hata').textContent = 'Önce giriş yapmalısın.'; return; }
      durum.gonderiliyor = true;
      var btn = $('.gonder');
      btn.disabled = true; btn.textContent = 'Gönderiliyor…'; $('.hata').textContent = '';
      H.yorum(veri()).then(function () {
        durum.gonderildi = true;
        $('.soruluk').hidden = true;
        $('.ty').innerHTML = yuz(durum.puan, 84);
        $('.tesekkur').hidden = false;
        $('.kapat').focus({ preventScroll: true });
        setTimeout(kapat, 2400);
      }, function () {
        durum.gonderiliyor = false;
        btn.disabled = false; btn.textContent = 'Tekrar dene';
        $('.hata').textContent = 'Gönderilemedi. İnternetini kontrol edip tekrar dene.';
      });
    }
    $('.gonder').addEventListener('click', gonder);
    $('.kapat').addEventListener('click', kapat);
    $('.perde').addEventListener('click', kapat);

    function kapat() {
      if (!acik || acik.host !== host) return;
      // A face was picked but "Gönder" wasn't pressed: keep the face anyway.
      if (durum.puan && !durum.gonderildi && !durum.gonderiliyor && H && H.yorum) {
        durum.gonderildi = true;
        H.yorum(veri()).catch(function () {});
      }
      acik = null;
      kok.classList.remove('acik');
      setTimeout(function () { host.remove(); }, 260);
      try { if (oncekiOdak && oncekiOdak.focus) oncekiOdak.focus({ preventScroll: true }); } catch (e) {}
      coz({ gonderildi: durum.gonderildi, puan: durum.puan });
    }

    document.body.appendChild(host);
    acik = { host: host, soz: soz };
    if (durum.puan) puanSec(durum.puan);
    requestAnimationFrame(function () { requestAnimationFrame(function () { kok.classList.add('acik'); }); });
    setTimeout(function () {
      var hedef = durum.puan ? $('.cip') : $('.yuz');
      try { hedef.focus({ preventScroll: true }); } catch (e) {}
    }, 60);
    return soz;
  }

  window.Nasildi = { ac: ac, yuz: yuz, PUANLAR: PUANLAR, ETIKETLER: ETIKETLER };
})();
