// Step8 画面確認: 主要 Story を portal x theme で撮影し、はみ出し / 未解決 CSS 変数 / カーソルを機械チェックする
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const base = process.env.SB_URL ?? 'http://localhost:6006'
const outDir = process.argv[2] ?? 'screenshots'
fs.mkdirSync(outDir, { recursive: true })

const stories = [
  'ui-portalshell--patron',
  'ui-portalshell--staff',
  'ui-button--variants',
  'ui-badge--all-variants',
  'ui-feedback--alerts',
  'ui-modal--destructive-confirm',
  'domain-status--queue-tracker',
  'domain-status--due-date',
  'domain-books--search-filter-staff',
  'domain-books--card-detail',
  'domain-books--table-manage',
  'domain-books--form-edit-with-errors',
  'domain-users--table',
  'domain-loans--overdue',
  'domain-loans--loan-register-denied',
  'domain-loans--return-register-with-reservation',
  'domain-loans--confirm-blocked',
  'domain-reports--stat-cards',
  'domain-reports--ranking',
  'domain-reports--chart',
  'brand-icons--all-icons',
]
const combos = [
  ['patron', 'light'],
  ['staff', 'light'],
  ['patron', 'dark'],
  ['staff', 'dark'],
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', deviceScaleFactor: 1 })
const page = await ctx.newPage()
const issues = []

for (const id of stories) {
  for (const [portal, theme] of combos) {
    const url = `${base}/iframe.html?id=${id}&viewMode=story&globals=portal:${portal};theme:${theme}`
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForSelector('#storybook-root > *', { timeout: 20000 })
    await page.waitForTimeout(300)
    const report = await page.evaluate(() => {
      const out = { overflow: [], badColor: [], noPointer: [], unresolved: [] }
      const root = document.getElementById('storybook-root')
      const rootRect = root.getBoundingClientRect()
      const all = root.querySelectorAll('*')
      for (const el of all) {
        const cs = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        // はみ出し: 親の overflow が visible なのに子が親の右端 / 下端を 2px 超えて越える
        const p = el.parentElement
        if (p && p !== root) {
          const pr = p.getBoundingClientRect()
          const pcs = getComputedStyle(p)
          if (pcs.overflowX === 'visible' && pcs.display !== 'inline' && r.right > pr.right + 2 && r.width > 8 && cs.position === 'static') {
            out.overflow.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 40)} right=${Math.round(r.right)} > parent ${Math.round(pr.right)}`)
          }
        }
        // 文字切れ: text-overflow が clip かつ scrollWidth が clientWidth を超える
        if (!el.classList.contains('sr-only') && el.scrollWidth > el.clientWidth + 2 && cs.overflowX === 'hidden' && cs.textOverflow !== 'ellipsis' && cs.whiteSpace === 'nowrap') {
          out.overflow.push(`clipped text: ${el.textContent.trim().slice(0, 30)}`)
        }
        // 色の未解決: 透明文字・純黒背景の疑い
        if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
          if (cs.color === 'rgba(0, 0, 0, 0)') out.badColor.push(`transparent text: ${el.textContent.trim().slice(0, 30)}`)
        }
        // クリッカブル: button / a に pointer
        if ((el.tagName === 'BUTTON' || el.tagName === 'A') && !el.disabled && cs.cursor !== 'pointer') {
          out.noPointer.push(`${el.tagName.toLowerCase()}: ${el.textContent.trim().slice(0, 20) || el.getAttribute('aria-label')}`)
        }
      }
      if (r0(rootRect)) out.overflow.push(`root width ${Math.round(rootRect.width)} > viewport`)
      function r0(rr) {
        return rr.width > window.innerWidth + 2
      }
      // 未解決 var(): 直接 style 属性に var(--x) を使う要素の計算値をサンプリング
      const sample = root.querySelectorAll('[style*="var(--"]')
      for (const el of sample) {
        const st = el.getAttribute('style') || ''
        const vars = [...st.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1])
        for (const v of vars) {
          const val = getComputedStyle(document.documentElement).getPropertyValue(v).trim() || getComputedStyle(el).getPropertyValue(v).trim()
          if (!val) out.unresolved.push(v)
        }
      }
      out.unresolved = [...new Set(out.unresolved)]
      return out
    })
    const file = path.join(outDir, `${id}__${portal}-${theme}.png`)
    await page.screenshot({ path: file, fullPage: true })
    const bad = report.overflow.length + report.badColor.length + report.noPointer.length + report.unresolved.length
    if (bad) issues.push({ id, portal, theme, ...report })
    console.log(`${bad ? 'WARN' : 'OK  '} ${id} ${portal}/${theme}`)
  }
}
await browser.close()
fs.writeFileSync(path.join(outDir, '_issues.json'), JSON.stringify(issues, null, 2))
console.log(`\n${issues.length} story/combos with findings -> ${path.join(outDir, '_issues.json')}`)
