(function () {
  if (window.__dshPhoebeWidget) return
  window.__dshPhoebeWidget = true

  var MIN_SCALE = 0.6
  var MAX_SCALE = 2.5
  var IMG_URL = '/dsh-phoebe/image.png'
  var BALANCE_URL = '/dsh-phoebe/balance.json'
  var SOUND_URL = '/dsh-phoebe/sound.mp3'
  var BALANCE_BUBBLE_MS = 5000
  var BALANCE_REFRESH_MS = 60000
  var BUBBLE_RESERVED_SPACE = 100

  var css = [
    '.dshpw-root{position:fixed;right:0;bottom:0;--dshpw-scale:1;--dshpw-base:clamp(120px,calc(min(240px,min(100vw,100vh) * 0.25) * var(--dshpw-scale)),600px);width:var(--dshpw-base);height:var(--dshpw-base);pointer-events:none;user-select:none;-webkit-user-select:none;z-index:9999;font-family:inherit;transition:left .16s ease,top .16s ease,transform .3s ease}',
    '.dshpw-root.dshpw-left{transform:scaleX(-1)}',
    '.dshpw-root.dshpw-dragging{cursor:grabbing;transition:none}',
    '.dshpw-root.dshpw-squished .dshpw-body{transform:scaleY(0.92) scaleX(1.04)}',
    '.dshpw-body{position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:50% 100%;transition:transform .22s cubic-bezier(.34,1.56,.64,1)}',
    '.dshpw-img{position:absolute;right:0;bottom:0;width:100%;height:100%;display:block;pointer-events:auto;-webkit-user-drag:none;user-select:none;cursor:grab}',
    '.dshpw-bubble{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:1}',
    '.dshpw-bubble-inner{position:absolute;bottom:calc(100% + 10px);left:10%;right:auto;background:#fff;border:2px solid #e0c0e0;border-radius:14px;padding:8px 12px;font-size:13px;color:#5a3d6e;white-space:nowrap;pointer-events:none;opacity:0;transform:translateY(6px) scale(.92);transition:opacity .2s ease,transform .2s ease;box-shadow:0 2px 12px rgba(180,140,200,.18);z-index:10000;max-width:200px;white-space:normal;text-align:center}',
    '.dshpw-bubble.dshpw-show .dshpw-bubble-inner{opacity:1;transform:translateY(0) scale(1)}',
    '.dshpw-root.dshpw-left .dshpw-bubble-inner{transform:translateY(6px) scale(.92) scaleX(-1);transform-origin:center center}',
    '.dshpw-root.dshpw-left .dshpw-bubble.dshpw-show .dshpw-bubble-inner{transform:translateY(0) scale(1) scaleX(-1)}',
    '.dshpw-bubble-inner:after{content:"";position:absolute;bottom:-8px;left:22%;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:8px solid #fff}',
    '.dshpw-bubble.dshpw-below .dshpw-bubble-inner{bottom:auto;top:calc(100% + 10px);transform:translateY(-6px) scale(.92)}',
    '.dshpw-bubble.dshpw-show.dshpw-below .dshpw-bubble-inner{transform:translateY(0) scale(1)}',
    '.dshpw-bubble.dshpw-below .dshpw-bubble-inner:after{bottom:auto;top:-8px;border-top:none;border-bottom:8px solid #fff}',
    '.dshpw-root.dshpw-left .dshpw-bubble.dshpw-below .dshpw-bubble-inner{transform:translateY(-6px) scale(.92) scaleX(-1)}',
    '.dshpw-root.dshpw-left .dshpw-bubble.dshpw-show.dshpw-below .dshpw-bubble-inner{transform:translateY(0) scale(1) scaleX(-1)}',
    '.dshpw-balance-label{font-size:11px;color:#9b7bab;margin-bottom:2px}',
    '.dshpw-balance-amount{font-size:18px;font-weight:700;color:#5a3d6e;line-height:1.2}',
    '.dshpw-balance-hint{font-size:10px;color:#b89cc4;margin-top:2px}',
    '.dshpw-hint{position:fixed;bottom:4px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,.85);color:#9b7bab;font-size:11px;padding:2px 8px;border-radius:8px;pointer-events:none;opacity:0;transition:opacity .3s ease;z-index:10000}',
    '.dshpw-hint.dshpw-show{opacity:1}',
  ].join('\n')

  var styleEl = document.createElement('style')
  styleEl.textContent = css
  document.head.appendChild(styleEl)

  var root = document.createElement('div')
  root.className = 'dshpw-root'

  var bodyEl = document.createElement('div')
  bodyEl.className = 'dshpw-body'

  var img = document.createElement('img')
  img.className = 'dshpw-img'
  img.src = IMG_URL
  img.alt = '菲比'
  img.draggable = false

  var bubble = document.createElement('div')
  bubble.className = 'dshpw-bubble'
  var bubbleInner = document.createElement('div')
  bubbleInner.className = 'dshpw-bubble-inner'
  bubble.appendChild(bubbleInner)

  bodyEl.appendChild(img)
  root.appendChild(bodyEl)
  root.appendChild(bubble)
  document.body.appendChild(root)

  var hint = document.createElement('div')
  hint.className = 'dshpw-hint'
  document.body.appendChild(hint)

  var state = {
    scale: loadScale(),
    h: 'right',
    hOff: 0,
    v: 'bottom',
    vOff: 0,
    left: 0,
    top: 0,
  }
  root.style.setProperty('--dshpw-scale', String(state.scale))

  var drag = null
  var audio = null
  var showingBalance = false
  var bubbleTimer = null
  var hintTimer = null

  function loadScale() {
    try { var s = parseFloat(localStorage.getItem('dshpw-scale')); if (isFinite(s)) return Math.min(2.5, Math.max(0.6, s)) } catch (err) {}
    return 1
  }

  function saveScale() {
    try { localStorage.setItem('dshpw-scale', String(state.scale)) } catch (err) {}
  }

  function savePosition() {
    try { localStorage.setItem('dshpw-pos', JSON.stringify({ left: state.left, top: state.top, h: state.h, v: state.v, hOff: state.hOff, vOff: state.vOff })) } catch (err) {}
  }

  function loadPosition() {
    try {
      var pos = JSON.parse(localStorage.getItem('dshpw-pos'))
      if (!pos || typeof pos !== 'object') return false
      var vp = viewport()
      var w = root.offsetWidth || root.getBoundingClientRect().width || 0
      var h = root.offsetHeight || root.getBoundingClientRect().height || 0
      state.left = clamp(Number(pos.left) || 0, 0, Math.max(0, vp.w - w))
      state.top = clamp(Number(pos.top) || 0, BUBBLE_RESERVED_SPACE, Math.max(0, vp.h - h))
      state.h = pos.h === 'left' || pos.h === 'right' ? pos.h : null
      state.v = pos.v === 'top' || pos.v === 'bottom' ? pos.v : null
      state.hOff = Number(pos.hOff) || 0
      state.vOff = Number(pos.vOff) || 0
      return true
    } catch (err) { return false }
  }

  function showHint(text) {
    hint.textContent = text
    hint.classList.add('dshpw-show')
    if (hintTimer) clearTimeout(hintTimer)
    hintTimer = setTimeout(function () { hint.classList.remove('dshpw-show'); hintTimer = null }, 1500)
  }

  function setScale(next) {
    next = Math.round(Math.min(2.5, Math.max(0.6, next)) * 10) / 10
    var prevTrans = root.style.transition
    root.style.transition = 'none'
    var rect = root.getBoundingClientRect()
    var fx = state.h === 'left' ? rect.left : rect.right
    var fy = rect.bottom
    state.scale = next
    root.style.setProperty('--dshpw-scale', String(next))
    saveScale()
    var r2 = root.getBoundingClientRect()
    var vp = viewport()
    if (state.h === 'left') {
      state.left = Math.min(Math.max(fx, 0), Math.max(0, vp.w - r2.width))
    } else {
      state.left = Math.min(Math.max(fx - r2.width, 0), Math.max(0, vp.w - r2.width))
    }
    state.top = Math.min(Math.max(fy - r2.height, BUBBLE_RESERVED_SPACE), Math.max(0, vp.h - r2.height))
    express()
    requestAnimationFrame(function () { root.style.transition = prevTrans })
    showHint(Math.round(next * 100) + '%')
    savePosition()
  }

  function playSound() {
    try {
      if (!audio) audio = new Audio(SOUND_URL)
      audio.preload = 'auto'
      audio.volume = 0.9
      audio.currentTime = 0
      var p = audio.play()
      if (p && typeof p.catch === 'function') p.catch(function () {})
    } catch (err) {}
  }

  function fmtTokens(n) {
    var num = Number(n)
    if (!isFinite(num)) return '--'
    if (num >= 10000) return (num / 10000).toFixed(1) + '万'
    return num.toLocaleString()
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  }

  function showBubble(html) {
    bubbleInner.innerHTML = html
    bubble.classList.add('dshpw-show')
    requestAnimationFrame(function () {
      var bubbleRect = bubbleInner.getBoundingClientRect()
      var spaceAbove = root.getBoundingClientRect().top
      if (spaceAbove < bubbleRect.height + 16) {
        bubble.classList.add('dshpw-below')
      } else {
        bubble.classList.remove('dshpw-below')
      }
    })
  }

  function hideBubble() {
    bubble.classList.remove('dshpw-show')
    bubble.classList.remove('dshpw-below')
    showingBalance = false
  }

  function showBalance(data) {
    showingBalance = true
    if (data && data.ok) {
      var pct = (data.consumedRatio * 100).toFixed(1)
      var days = data.exhaustedAfterDays
      var hint = '已用 ' + pct + '%'
      if (days > 0) hint += ' · ' + days + '天后用完'
      hint += ' · ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      showBubble('<div class="dshpw-balance-label">LongCat 余量</div><div class="dshpw-balance-amount">' + escapeHtml(fmtTokens(data.remainingToken)) + ' tokens</div><div class="dshpw-balance-hint">' + escapeHtml(hint) + '</div>')
    } else {
      showBubble('<div class="dshpw-balance-amount">--</div><div class="dshpw-balance-hint">' + escapeHtml((data && data.error) ? String(data.error).slice(0, 30) : '未配置 Token') + '</div>')
    }
    if (bubbleTimer) clearTimeout(bubbleTimer)
    bubbleTimer = setTimeout(hideBubble, BALANCE_BUBBLE_MS)
  }

  function fetchBalance() {
    fetch(BALANCE_URL, { cache: 'no-store' })
      .then(function (r) { return r.json() })
      .then(function (data) { if (showingBalance) showBalance(data) })
      .catch(function () {})
  }

  function triggerChat() {
    fetch(BALANCE_URL, { cache: 'no-store' })
      .then(function (r) { return r.json() })
      .then(function (data) { showBalance(data) })
      .catch(function () { showBalance({ ok: false, error: '请求失败' }) })
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }
  function viewport() {
    return {
      w: window.innerWidth || document.documentElement.clientWidth || 1280,
      h: window.innerHeight || document.documentElement.clientHeight || 800,
    }
  }

  function express() {
    root.style.right = 'auto'
    root.style.bottom = 'auto'
    root.style.left = state.left + 'px'
    root.style.top = state.top + 'px'
    root.classList.toggle('dshpw-left', state.h === 'left')
  }

  function settle() {
    var vp = viewport()
    var w = root.offsetWidth || root.getBoundingClientRect().width || 0
    var h = root.offsetHeight || root.getBoundingClientRect().height || 0
    if (drag && drag.active) {
      state.left = clamp(state.left, 0, Math.max(0, vp.w - w))
      state.top = clamp(state.top, BUBBLE_RESERVED_SPACE, Math.max(0, vp.h - h))
      express()
      return
    }
    if (state.h === 'right') {
      state.left = Math.max(0, vp.w - w - state.hOff)
    } else if (state.h === 'left') {
      state.left = state.hOff
    }
    if (state.v === 'bottom') {
      state.top = Math.max(0, vp.h - h - state.vOff)
    } else if (state.v === 'top') {
      state.top = Math.max(BUBBLE_RESERVED_SPACE, state.vOff)
    }
    express()
    if (!drag || !drag.active) savePosition()
  }

  function onWheel(e) {
    if (!isOverWidget(e)) return
    e.preventDefault()
    var delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale(state.scale + delta)
  }

  function isOverWidget(e) {
    var r = root.getBoundingClientRect()
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
  }

  function onDocPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    try { e.preventDefault(); e.stopPropagation() } catch (err) {}
    var vp = viewport()
    var rect = root.getBoundingClientRect()
    drag = { active: true, startX: e.clientX, startY: e.clientY, origLeft: rect.left, origTop: rect.top, w: rect.width, h: rect.height, moved: false, vp: vp }
    root.classList.add('dshpw-dragging')
    root.classList.add('dshpw-squished')
    playSound()
    document.addEventListener('pointermove', onDocPointerMove, true)
    document.addEventListener('pointerup', onDocPointerUp, true)
    document.addEventListener('pointerleave', onDocPointerLeave, true)
  }

  function onDocPointerMove(e) {
    if (!drag || !drag.active) return
    var dx = e.clientX - drag.startX
    var dy = e.clientY - drag.startY
    if (dx * dx + dy * dy >= 9) drag.moved = true
    state.left = clamp(drag.origLeft + dx, 0, Math.max(0, drag.vp.w - drag.w))
    state.top = clamp(drag.origTop + dy, BUBBLE_RESERVED_SPACE, Math.max(0, drag.vp.h - drag.h))
    express()
  }

  function onDocPointerUp(e) {
    if (!drag || !drag.active) return
    drag.active = false
    document.removeEventListener('pointermove', onDocPointerMove, true)
    document.removeEventListener('pointerup', onDocPointerUp, true)
    document.removeEventListener('pointerleave', onDocPointerLeave, true)
    root.classList.remove('dshpw-dragging')
    bodyEl.style.transition = 'none'
    root.classList.remove('dshpw-squished')
    requestAnimationFrame(function () { bodyEl.style.transition = '' })
    if (!drag.moved) {
      triggerChat()
      return
    }
    var rect = root.getBoundingClientRect()
    var vp = viewport()
    var centerX = rect.left + rect.width / 2
    var centerY = rect.top + rect.height / 2
    if (centerX < vp.w / 4) { state.h = 'left'; state.hOff = 0 }
    else if (centerX > vp.w * 3 / 4) { state.h = 'right'; state.hOff = 0 }
    else { state.h = null; state.hOff = rect.left }
    if (centerY < vp.h / 4) { state.v = 'top'; state.vOff = 0 }
    else { state.v = 'bottom'; state.vOff = Math.max(0, vp.h - rect.top - rect.height) }
    state.left = rect.left
    state.top = rect.top
    settle()
    savePosition()
  }

  function onDocPointerLeave(e) {
    if (!drag || !drag.active) return
    root.classList.remove('dshpw-squished')
  }

  img.addEventListener('pointerdown', onDocPointerDown, true)
  root.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('resize', settle)
  setInterval(fetchBalance, BALANCE_REFRESH_MS)

  if (!loadPosition()) {
    var rect0 = root.getBoundingClientRect()
    state.left = rect0.left
    state.top = rect0.top
  }
  express()
  settle()
})()
