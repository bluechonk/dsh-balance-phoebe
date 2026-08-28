import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')

const IMAGE_CANDIDATES = [
  path.join(PACKAGE_ROOT, 'assets', 'image', 'phoebe_02.png'),
  path.join(PACKAGE_ROOT, 'assets', 'image', 'phoebe_01 .png'),
  path.join(PACKAGE_ROOT, 'assets', 'image', 'phoebe_03.png'),
  path.join(PACKAGE_ROOT, 'assets', 'image', 'phoebe_04.png'),
]

const WIDGET_JS = `(function () {
  if (window.__dshPhoebeWidget) return
  window.__dshPhoebeWidget = true

  var IMG_URL = '/dsh-phoebe/image.png'

  var css = [
    '.dshpw-root{position:fixed;right:0;bottom:0;--dshpw-scale:1;--dshpw-base:clamp(120px,calc(min(240px,min(100vw,100vh) * 0.25) * var(--dshpw-scale)),600px);width:var(--dshpw-base);height:var(--dshpw-base);pointer-events:none;user-select:none;-webkit-user-select:none;z-index:9999;font-family:inherit;transition:left .16s ease,top .16s ease,transform .3s ease}',
    '.dshpw-root.dshpw-left{transform:scaleX(-1)}',
    '.dshpw-root.dshpw-dragging{cursor:grabbing;transition:none}',
    '.dshpw-img{position:absolute;right:0;bottom:0;width:100%;height:100%;display:block;pointer-events:auto;-webkit-user-drag:none;user-select:none;cursor:grab}',
  ].join('\\n')

  var styleEl = document.createElement('style')
  styleEl.textContent = css
  document.head.appendChild(styleEl)

  var root = document.createElement('div')
  root.className = 'dshpw-root'

  var img = document.createElement('img')
  img.className = 'dshpw-img'
  img.src = IMG_URL
  img.alt = '菲比'
  img.draggable = false

  root.appendChild(img)
  document.body.appendChild(root)

  var state = {
    scale: 1,
    h: 'right',
    hOff: 0,
    v: 'bottom',
    vOff: 0,
    left: 0,
    top: 0,
  }
  var drag = null

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
      state.top = clamp(state.top, 0, Math.max(0, vp.h - h))
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
      state.top = state.vOff
    }
    express()
  }

  function onDocPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    try { e.preventDefault(); e.stopPropagation() } catch (err) {}
    var vp = viewport()
    var rect = root.getBoundingClientRect()
    drag = { active: true, startX: e.clientX, startY: e.clientY, origLeft: rect.left, origTop: rect.top, w: rect.width, h: rect.height, moved: false, vp: vp }
    root.classList.add('dshpw-dragging')
    document.body.style.cursor = 'grabbing'
    document.addEventListener('pointermove', onDocPointerMove, true)
    document.addEventListener('pointerup', onDocPointerUp, true)
  }

  function onDocPointerMove(e) {
    if (!drag || !drag.active) return
    var dx = e.clientX - drag.startX
    var dy = e.clientY - drag.startY
    if (dx * dx + dy * dy >= 9) drag.moved = true
    state.left = clamp(drag.origLeft + dx, 0, Math.max(0, drag.vp.w - drag.w))
    state.top = clamp(drag.origTop + dy, 0, Math.max(0, drag.vp.h - drag.h))
    express()
  }

  function onDocPointerUp(e) {
    if (!drag || !drag.active) return
    drag.active = false
    document.removeEventListener('pointermove', onDocPointerMove, true)
    document.removeEventListener('pointerup', onDocPointerUp, true)
    root.classList.remove('dshpw-dragging')
    document.body.style.cursor = ''
    if (!drag.moved) {
      // click: do nothing for now, will add bubble later
      return
    }
    var rect = root.getBoundingClientRect()
    var vp = viewport()
    var centerX = rect.left + rect.width / 2
    var centerY = rect.top + rect.height / 2
    if (centerX < vp.w / 4) {
      state.h = 'left'; state.hOff = 0
    } else if (centerX > vp.w * 3 / 4) {
      state.h = 'right'; state.hOff = 0
    } else {
      state.h = null; state.hOff = rect.left
    }
    if (centerY < vp.h / 4) {
      state.v = 'top'; state.vOff = 0
    } else {
      state.v = 'bottom'; state.vOff = Math.max(0, vp.h - rect.top - rect.height)
    }
    state.left = rect.left
    state.top = rect.top
    settle()
  }

  img.addEventListener('pointerdown', onDocPointerDown, true)

  window.addEventListener('resize', settle)

  var rect0 = root.getBoundingClientRect()
  state.left = rect0.left
  state.top = rect0.top
  express()
  settle()
})()`

const name = '@BlueChonk/dsh-balance-phoebe'
const inject = ['webServer']

function apply(ctx) {
  let imageBytes = null

  function loadImage() {
    if (imageBytes) return imageBytes
    for (const p of IMAGE_CANDIDATES) {
      try {
        const bytes = fs.readFileSync(p)
        if (bytes && bytes.length > 0) {
          imageBytes = bytes
          return bytes
        }
      } catch (err) {}
    }
    throw new Error('phoebe image not found')
  }

  const disposers = []

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-phoebe/image.png',
    handler: (req, res) => {
      try {
        const bytes = loadImage()
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-store',
          'Content-Length': String(bytes.length),
        })
        res.end(bytes)
      } catch (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('phoebe image unavailable')
      }
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-phoebe/widget.js',
    handler: (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      res.end(WIDGET_JS)
    },
  }))

  disposers.push(ctx.webServer.tapIndex((html) => {
    if (html.indexOf('/dsh-phoebe/widget.js') !== -1) return html
    const tag = '<script defer src="/dsh-phoebe/widget.js"></script>'
    if (html.indexOf('</body>') !== -1) return html.replace('</body>', tag + '</body>')
    return html + tag
  }))

  ctx.effect(() => () => {
    for (const d of disposers) {
      try { d() } catch (err) {}
    }
  })
}

export { name, inject, apply }
