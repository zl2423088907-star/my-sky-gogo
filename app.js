/* =====================================================================
   app.js —— 聚合页渲染逻辑（模块化版）
   所有页面内容都来自 index.html 里的 config(modules 数组)。
   想改内容 / 增删模块，只改配置区，不用动本文件。
   安全要点：
   1. 全程 textContent 注入文本，绝不用 innerHTML 拼数据 → 防 XSS
   2. 链接 URL 做协议白名单校验(仅 http/https/mailto/tel) → 防伪协议注入
   3. 外链统一 rel="noopener noreferrer nofollow" → 防钓鱼/opener 劫持
   4. 配置用 JSON.parse 解析(并非 eval) → 无代码注入风险
   ===================================================================== */

(function () {
  'use strict';

  /* ---------- 1. 读取配置 ---------- */
  var cfg = { modules: [] };
  try {
    cfg = JSON.parse(document.getElementById('config').textContent);
  } catch (e) {
    console.error('配置解析失败：', e);
  }

  /* ---------- 2. 安全工具 ---------- */

  // 只允许 http / https / mailto / tel，其余(javascript: 等)一律拦截
  function safeUrl(url) {
    if (typeof url !== 'string') return null;
    var t = url.trim();
    if (t === '') return null;
    try {
      var u = new URL(t, window.location.href);
      if (['http:', 'https:', 'mailto:', 'tel:'].indexOf(u.protocol) === -1) return null;
      return u.href;
    } catch (e) { return null; }
  }

  // 纯文本注入，防 XSS
  function setText(el, text) {
    el.textContent = (text == null) ? '' : String(text);
  }

  /* ---------- 3. 各模块渲染器 ---------- */

  // 头像
  function renderAvatar(el, m, idx) {
    el.className = 'avatar fade';
    el.style.animationDelay = (0.05 * idx) + 's';
    var img = document.createElement('img');
    img.alt = '头像';
    img.onerror = function () {
      img.style.display = 'none';
      el.style.background = 'linear-gradient(135deg,#00e5ff,#a855f7)';
    };
    img.src = m.src || 'avatar.png';   // img.src 赋值是安全的，不会执行脚本
    el.appendChild(img);
  }

  // 昵称
  function renderNickname(el, m, idx) {
    el.className = 'nickname fade';
    el.style.animationDelay = (0.05 * idx) + 's';
    setText(el, m.text || '');
    if (m.text) document.title = String(m.text);
  }

  // 自定义简介（支持 \n 换行）
  function renderBio(el, m, idx) {
    el.className = 'bio fade';
    el.style.animationDelay = (0.05 * idx) + 's';
    var text = (m.text == null) ? '' : String(m.text);
    var lines = text.split(/\r?\n/);
    lines.forEach(function (line, i) {
      if (i > 0) el.appendChild(document.createElement('br'));
      el.appendChild(document.createTextNode(line));   // 文本节点，安全
    });
  }

  // 链接列表
  function renderLinks(el, m, idx) {
    el.className = 'links';
    var items = Array.isArray(m.items) ? m.items : [];
    items.forEach(function (item) {
      if (!item || typeof item !== 'object') return;

      var href  = safeUrl(item.url);
      var label = item.label || '未命名链接';
      var icon  = item.icon || '🔗';
      var a = document.createElement('a');
      a.className = 'link-btn fade';

      if (href) {
        a.href = href;
        if (/^https?:/i.test(href)) {
          a.target = '_blank';
          a.rel = 'noopener noreferrer nofollow';
        }
      } else {
        a.setAttribute('role', 'button');
        a.setAttribute('aria-disabled', 'true');
        a.style.opacity = '0.5';
        a.style.cursor = 'not-allowed';
        a.title = '该链接无效或非 http/https，已禁用';
        a.addEventListener('click', function (ev) { ev.preventDefault(); });
      }

      // ---- QQ 加好友：优先唤起 App，失败再跳网页 ----
      if (item.qq && href) {
        a.removeAttribute('target');
        a.removeAttribute('rel');
        a.setAttribute('data-qq', String(item.qq));
        a.addEventListener('click', function (ev) {
          ev.preventDefault();
          var qq = a.getAttribute('data-qq');
          var appUrl = 'mqqapi://card/show_pslcard?src_type=internal&version=1&uin=' + encodeURIComponent(qq) + '&card_type=person&source=qrcode';
          var webUrl = 'https://qm.qq.com/cgi-bin/qm/qr?k=' + encodeURIComponent(qq) + '&jump_from=webapi';
          var t = Date.now();
          var hidden = false;
          function onVis() { hidden = true; }
          document.addEventListener('visibilitychange', onVis);
          // 尝试唤起 App
          window.location.href = appUrl;
          // 兜底：1.2s 后仍没切走，就跳网页版加好友
          setTimeout(function () {
            document.removeEventListener('visibilitychange', onVis);
            if (hidden || document.hidden || Date.now() - t > 2500) return;
            window.open(webUrl, '_blank', 'noopener');
          }, 1200);
        });
      }


      var ico = document.createElement('span');
      ico.className = 'ico'; setText(ico, icon);

      var lab = document.createElement('span');
      lab.className = 'label'; setText(lab, label);

      var arrow = document.createElement('span');
      arrow.className = 'arrow'; setText(arrow, '›');

      a.appendChild(ico);
      a.appendChild(lab);
      a.appendChild(arrow);
      el.appendChild(a);
    });
  }

  // 底部文字
  function renderFooter(el, m, idx) {
    el.className = 'footer fade';
    el.style.animationDelay = (0.05 * idx) + 's';
    setText(el, m.text || '');
  }

  var RENDERERS = {
    avatar:   renderAvatar,
    nickname: renderNickname,
    bio:      renderBio,
    links:    renderLinks,
    footer:   renderFooter
  };

  /* ---------- 4. 按顺序渲染所有模块 ---------- */
  var app = document.getElementById('app');
  var modules = Array.isArray(cfg.modules) ? cfg.modules : [];

  modules.forEach(function (m, idx) {
    if (!m || typeof m !== 'object') return;
    var fn = RENDERERS[m.type];
    if (!fn) return;                        // 未知类型直接跳过
    var el = document.createElement(
      m.type === 'nickname' ? 'h1' :
      m.type === 'links'    ? 'nav' :
      m.type === 'bio'      ? 'p' : 'div'
    );
    if (m.type === 'links') el.id = 'links';
    fn(el, m, idx);
    app.appendChild(el);
  });

  /* ---------- 5. 背景音乐 ---------- */
  // 说明：浏览器(尤其iOS/微信)默认禁止“自动播放有声音乐”。
  // 策略：先尝试自动播放；若被拦截，则给按钮加提示动效，等用户点一下再播。
  (function initBgm() {
    var btn = document.getElementById('bgmBtn');
    var music = (cfg && typeof cfg.music === 'object' && cfg.music) ? cfg.music : null;
    var src = music && typeof music.src === 'string' ? music.src.trim() : '';

    // 没配置音乐，或配置为空 → 隐藏按钮，不加载任何东西
    if (!btn || !src) {
      if (btn) btn.style.display = 'none';
      return;
    }

    var audio = new Audio();
    audio.src = src;
    audio.loop = music.loop !== false;                 // 默认循环
    audio.volume = (typeof music.volume === 'number')
      ? Math.max(0, Math.min(1, music.volume)) : 0.5;  // 默认 0.5
    audio.preload = 'auto';

    function setPlaying(on) {
      btn.classList.toggle('playing', on);
      btn.title = on ? '点击暂停背景音乐' : '点击播放背景音乐';
    }

    function tryPlay() {
      var p = audio.play();
      // 现代浏览器 play() 返回 Promise，被拦截会 reject
      if (p && typeof p.then === 'function') {
        p.then(function () {
          btn.classList.remove('blocked');
          setPlaying(true);
        }).catch(function () {
          // 被浏览器拦截：显示提示动效，等用户点击
          setPlaying(false);
          btn.classList.add('blocked');
        });
      } else {
        setPlaying(true);
      }
    }

    // 用户点击按钮：播放 / 暂停
    btn.addEventListener('click', function () {
      if (audio.paused) {
        tryPlay();
      } else {
        audio.pause();
        setPlaying(false);
        btn.classList.remove('blocked');
      }
    });

    audio.addEventListener('play',  function () { setPlaying(true);  });
    audio.addEventListener('pause', function () { setPlaying(false); });

    // 加载失败（路径不对/文件没传）→ 隐藏按钮，避免死按钮
    audio.addEventListener('error', function () {
      btn.style.display = 'none';
      console.warn('背景音乐加载失败，请检查 music.src 路径或文件是否存在：', src);
    });

    // 先尝试自动播放
    tryPlay();

    // 兜底：若首次被拦截，用户第一次任意触摸/点击页面时再自动试一次
    document.addEventListener('touchstart', function onceA() {
      document.removeEventListener('touchstart', onceA);
      if (audio.paused) tryPlay();
    }, { once: true, passive: true });
    document.addEventListener('click', function onceC() {
      document.removeEventListener('click', onceC);
      if (audio.paused) tryPlay();
    }, { once: true });
  })();

  /* ---------- 6. 背景视频（置底 · 防嗅探 · 禁小窗） ---------- */
  (function initVideoBg() {
    var v = document.getElementById('bgVideo');
    if (!v) return;

    // 让 body 知道"有视频背景"，从而隐藏原来的光斑背景
    document.body.classList.add('has-video');

    /* --- 6.1 播放属性：静音 + 内联，保证能自动播放 --- */
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.autoplay = true;
    v.loop = true;

    /* --- 6.2 关掉一切"可下载 / 可小窗 / 可投屏"的入口 --- */
    v.controls = false;                       // 不要原生控件
    v.removeAttribute('controls');
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.setAttribute('disablepictureinpicture', '');   // 禁 PiP（小窗）
    v.setAttribute('disableremoteplayback', '');     // 禁投屏
    v.setAttribute('x-webkit-airplay', 'deny');
    v.setAttribute('controlslist', 'nodownload nofullscreen noplaybackrate noremoteplayback');
    try { v.disablePictureInPicture = true; } catch (e) {}
    try { v.disableRemotePlayback = true; } catch (e) {}

    // 万一某些浏览器仍然进了小窗，立刻踢回内联播放
    function kickOutOfPip() {
      try {
        if (document.pictureInPictureElement &&
            typeof document.exitPictureInPicture === 'function') {
          document.exitPictureInPicture().catch(function () {});
        }
      } catch (e) {}
      try {
        if (v.webkitPresentationMode === 'picture-in-picture' &&
            typeof v.webkitSetPresentationMode === 'function') {
          v.webkitSetPresentationMode('inline');   // 旧版 Safari/部分安卓内核
        }
      } catch (e) {}
    }
    v.addEventListener('enterpictureinpicture', kickOutOfPip);
    document.addEventListener('enterpictureinpicture', kickOutOfPip);
    v.addEventListener('webkitpresentationmodechanged', kickOutOfPip);

    /* --- 6.3 长按 / 右键不给"下载视频"、"画中画"菜单 --- */
    function block(ev) { ev.preventDefault(); }
    v.addEventListener('contextmenu', block);
    v.addEventListener('dragstart', block);
    document.addEventListener('contextmenu', function (ev) {
      if (ev.target === v) ev.preventDefault();
    });

    /* --- 6.4 播放控制 --- */
    function tryPlayVideo() {
      var p = v.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () {
          // 极少数浏览器仍拦截 → 用户首次交互时再试
          var once = function () {
            v.play();
            document.removeEventListener('touchstart', once);
            document.removeEventListener('click', once);
          };
          document.addEventListener('touchstart', once, { once: true, passive: true });
          document.addEventListener('click', once, { once: true });
        });
      }
    }

    function attach(src) {
      v.src = src;
      if (v.readyState >= 2) tryPlayVideo();
      else v.addEventListener('loadeddata', tryPlayVideo, { once: true });
      tryPlayVideo();
    }

    // 视频加载失败（文件没传/路径不对）→ 回退到普通背景
    v.addEventListener('error', function () {
      console.warn('视频背景加载失败，请检查 bg.mp4 是否已上传到同目录');
      document.body.classList.remove('has-video');
    });

    /* --- 6.5 防嗅探：先 fetch 成二进制，再用 Blob URL 播放 ---
       <video> 的 src 变成 blob:xxx，DOM 里不再出现 .mp4 直链，
       浏览器插件（猫抓/IDM 等）扫描媒体元素时抓不到可下载地址。
       file:// 等 fetch 不可用的场景，自动回退到直链，保证照常显示。 */
    var FALLBACK_SRC = 'bg.mp4';

    if (typeof fetch === 'function') {
      fetch(FALLBACK_SRC, { cache: 'force-cache', credentials: 'same-origin' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.blob();
        })
        .then(function (blob) {
          if (!/^video\//.test(blob.type) && blob.type !== '') {
            throw new Error('unexpected type: ' + blob.type);
          }
          attach(URL.createObjectURL(blob));
        })
        .catch(function (err) {
          console.warn('Blob 方式加载背景视频失败，回退直链：', err && err.message);
          attach(FALLBACK_SRC);
        });
    } else {
      attach(FALLBACK_SRC);
    }
  })();

})();
