// app.js — 站点渲染逻辑（自 index.html 内联脚本提取，2026-07）


        // 咔言咔语页面的9宫格内容数据 - 从JSON文件读取后转换
        let sayContentData = {};

        // 缓存：详情弹窗按 id 查找内容
        let quartersData = { quarters: [] };
        let cookingData = { essays: [], recipes: {}, philosophy: '' };
        let columnsData = { columns: [] };
        // 当前打开的专栏 id（在 column 视图时不为空）
        let currentColumnId = null;

        // 转义数据内容后再拼 innerHTML，防止 JSON 里的 HTML 注入
        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        // 统一的 JSON fetch：非 2xx 一律抛错，避免 404 页被当 JSON 解析
        function fetchJSON(url) {
            return fetch(url).then(r => {
                if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
                return r.json();
            });
        }

        // 导航令牌：每次切页 +1。慢的 in-flight 渲染在写 DOM 前校验令牌，
        // 防止快速切页时旧页面覆盖新页面
        let navToken = 0;

        // 忽略年份的"日历距离"（带跨年回绕）：12/28 与 1/3 距离是 6 天
        function dayOfYearDistance(a, b) {
            const MS_DAY = 86400000;
            const doy = d => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / MS_DAY);
            const diff = Math.abs(doy(a) - doy(b));
            return Math.min(diff, 365 - diff);
        }


        // 修改这两个函数，直接使用传入的data
        function getLastYearTodayWeibo(data) {
            const today = new Date();
            const lastYear = today.getFullYear() - 1;
            const targetMonth = today.getMonth() + 1;
            const targetDay = today.getDate();

            const matchingWeibos = data.weibo.filter(weibo => {
                const weiboDate = parseWeiboDate(weibo.createdAt);
                return weiboDate.getFullYear() === lastYear &&
                    weiboDate.getMonth() + 1 === targetMonth &&
                    weiboDate.getDate() === targetDay;
            });

            if (matchingWeibos.length > 0) {
                return matchingWeibos[Math.floor(Math.random() * matchingWeibos.length)];
            }

            // 如果没有找到，返回最接近的
            const sortedWeibos = data.weibo
                .map(weibo => ({
                    ...weibo,
                    date: parseWeiboDate(weibo.createdAt)
                }))
                .sort((a, b) => dayOfYearDistance(a.date, today) - dayOfYearDistance(b.date, today));

            return sortedWeibos[0];
        }


        function getDailyRandomIndices(totalCount, dailyCount = 200) {
            const today = new Date();
            const dateStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
            
            // 使用日期作为种子生成伪随机数
            function seededRandom(seed) {
                const x = Math.sin(seed) * 10000;
                return x - Math.floor(x);
            }
            
            // 将日期字符串转换为数字种子
            let seed = 0;
            for (let i = 0; i < dateStr.length; i++) {
                seed = ((seed << 5) - seed) + dateStr.charCodeAt(i);
                seed = seed & seed; // 转换为32位整数
            }
            
            // 生成今日的随机索引数组
            const indices = [];
            const actualCount = Math.min(dailyCount, totalCount); // 确保不超过总数
            
            // 生成不重复的随机索引
            const usedIndices = new Set();
            let currentSeed = seed;
            
            while (indices.length < actualCount) {
                currentSeed = ((currentSeed * 9301 + 49297) % 233280);
                const randomIndex = Math.floor(seededRandom(currentSeed) * totalCount);
                
                if (!usedIndices.has(randomIndex)) {
                    usedIndices.add(randomIndex);
                    indices.push(randomIndex);
                }
            }
            
            return indices;
        }

        // 修改后的获取随机微博函数
        function getRandomWeiboFromDaily(data) {
            const dailyIndices = getDailyRandomIndices(data.weibo.length, 100);
            
            // 从当前会话的访问次数中选择索引
            const visitCount = parseInt(sessionStorage.getItem('visitCount') || '1');
            const indexPosition = (visitCount - 1) % dailyIndices.length;
            const selectedIndex = dailyIndices[indexPosition];
            
            return data.weibo[selectedIndex];
        }

        function getWeiboKey(weibo) {
            if (!weibo) return '';
            const raw = `${weibo.createdAt || ''}::${weibo.text || ''}`;
            let hash = 0;
            for (let i = 0; i < raw.length; i++) {
                hash = ((hash << 5) - hash) + raw.charCodeAt(i);
                hash |= 0;
            }
            return `${weibo.createdAt || ''}::${Math.abs(hash)}`;
        }

        function getRandomWeiboFromDailyExcept(data, excludedKey) {
            const dailyIndices = getDailyRandomIndices(data.weibo.length, 100);
            const candidates = dailyIndices
                .map(index => data.weibo[index])
                .filter(Boolean)
                .filter(weibo => getWeiboKey(weibo) !== excludedKey);

            const pool = candidates.length > 0 ? candidates : data.weibo;
            return pool[Math.floor(Math.random() * pool.length)];
        }


        // 解析日期字符串
        function parseWeiboDate(dateStr) {
            return new Date(dateStr);
        }

        // 格式化微博文本，去掉多余的符号和换行
        function formatWeiboText(text) {
            return text
                .replace(/\n/g, ' ')
                .replace(/[​\u200B-\u200D\uFEFF]/g, '') // 移除零宽字符
                .replace(/\s+/g, ' ') // 合并多个空格
                .trim()
                .substring(0, 520) + (text.length > 520 ? '...' : ''); // 限制长度
        }

        // 格式化日期显示
        function formatDate(dateStr) {
            const date = parseWeiboDate(dateStr);
            return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
        }

        // 渲染咔滋页面 - 纯文字版本，不使用图片
        function renderKazhi(data) {
            const content = document.getElementById('content');

            if (!data || !Array.isArray(data.weibo) || data.weibo.length === 0) {
                content.innerHTML = '<div class="kazhi-container text-only"><p class="kazhi-text">暂无回忆</p></div>';
                return;
            }

            // 检查是否是今天第一次访问
            const today = new Date().toDateString();
            const lastVisit = sessionStorage.getItem('lastVisitDate');
            const visitCount = parseInt(sessionStorage.getItem('visitCount') || '0');
            const isFirstVisitToday = lastVisit !== today;
            
            // 更新访问记录
            if (isFirstVisitToday) {
                sessionStorage.setItem('lastVisitDate', today);
                sessionStorage.setItem('visitCount', '1');
            } else {
                sessionStorage.setItem('visitCount', (visitCount + 1).toString());
            }
            
            // 根据访问次数选择微博
            let selectedWeibo;
            let isLastYearToday = false;
            const currentVisitCount = parseInt(sessionStorage.getItem('visitCount'));
            
            if (currentVisitCount === 1) {
                selectedWeibo = getLastYearTodayWeibo(data);
                isLastYearToday = true;
            } else {
                selectedWeibo = getRandomWeiboFromDaily(data);
            }
            
            const weiboText = formatWeiboText(selectedWeibo.text);
            const weiboDate = formatDate(selectedWeibo.createdAt);
            
            // 创建容器 - 纯文字版本
            content.innerHTML = `
                <div class="kazhi-container text-only">
                    <div class="weibo-date">
                        ${isLastYearToday ? '去年今日' : '随机回忆'} · ${weiboDate}
                    </div>
                    <p class="kazhi-text">${escapeHtml(weiboText)}</p>
                </div>
            `;
        }

        /* =====================================================================
           Field Guide Home (Plan 3)
           Hero (eyebrow + title + intro + Timeline/Random buttons + slip zone)
           + reverse-chronological S-curve PhD timeline + side memory shards.
           Reuses: getRandomWeiboFromDaily / formatWeiboText / formatDate
                   showEssayDetail (via 'quarters' source)
           Does NOT touch: any other render*(), enhance.js, JSON shape.
           ===================================================================== */

        // Cache the Field Guide payload so detail-overlay (showEssayDetail) can
        // resolve quarter ids regardless of which view is currently mounted.
        let fieldGuideQuarters = null;
        // Local RAF token for Field Guide motion (timeline progress + shard
        // tilt). Cancelled when navigating away from kazhi page.
        let fieldGuideRAF = null;
        // 首页 scroll/mousemove 监听的清理句柄——重新渲染或离开首页时 abort，
        // 防止每次回首页都叠加一层引用旧 DOM 的监听器
        let fieldGuideAbort = null;

        // Stable string hash → seed (mulberry32). Same as enhance.js's
        // hover-preview generator so visual identity is consistent.
        function _fgHash(str) {
            let h = 5381;
            for (let i = 0; i < (str || '').length; i++) {
                h = ((h << 5) + h) + str.charCodeAt(i);
                h = h & h;
            }
            return Math.abs(h) >>> 0;
        }
        function _fgRng(seed) {
            let t = seed >>> 0;
            return function () {
                t = (t + 0x6D2B79F5) | 0;
                let x = Math.imul(t ^ (t >>> 15), 1 | t);
                x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
                return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
            };
        }

        function _fgQuarterMonth(q) {
            const seasonMonth = { winter: 1, spring: 3, summer: 6, fall: 9 };
            const month = seasonMonth[String(q.season || '').toLowerCase()] || 1;
            return { month, monthIndex: q.year * 12 + (month - 1), label: `${q.year}.${month}` };
        }

        // S-curve geometry: build cubic-bezier path that snakes left/right
        // through calendar-scaled quarter stops. Display order is preserved
        // (newest at top), while vertical distance reflects real month gaps.
        function _fgSCurveGeometry(quarters, width, padTop, monthPx) {
            const count = quarters.length;
            const amp  = width * 0.24;          // narrower swing: keep dots away from article copy
            // With odd count and i=0 starting on the right, there's one more
            // right-side stop than left → the path's centroid drifts right by
            // (amp / count). Offset x0 leftward by exactly that amount so the
            // curve's visual center lands on the SVG horizontal center line.
            const rightCount = Math.ceil(count / 2);
            const leftCount  = Math.floor(count / 2);
            const x0 = width * 0.5 - ((rightCount - leftCount) * amp) / count;
            const months = quarters.map(_fgQuarterMonth);
            const maxMonth = Math.max(...months.map(m => m.monthIndex));
            const stops = [];                   // {x, y, side}
            for (let i = 0; i < count; i++) {
                const date = months[i];
                const y = padTop + (maxMonth - date.monthIndex) * monthPx;
                // alternating sides: 0=right, 1=left, 2=right, ...
                const side = i % 2 === 0 ? 1 : -1; // +1 right, -1 left
                stops.push({
                    x: x0 + side * amp,
                    y: y,
                    side: side > 0 ? 'right' : 'left',
                    dateLabel: date.label
                });
            }
            // Start path AT first stop — no pre-swing from center. Each segment
            // uses vertical-tangent bezier handles based on its actual y gap.
            let d = `M ${stops[0].x.toFixed(2)} ${stops[0].y.toFixed(2)}`;
            for (let i = 1; i < stops.length; i++) {
                const a = stops[i - 1], b = stops[i];
                const handle = Math.abs(b.y - a.y) * 0.55;
                d += ` C ${a.x.toFixed(2)} ${(a.y + handle).toFixed(2)}, ` +
                     `${b.x.toFixed(2)} ${(b.y - handle).toFixed(2)}, ` +
                     `${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
            }
            return { d, stops };
        }

        // Memory shard inline SVG generator. Stable per id. 3:4 portrait.
        // Layered hairline contours + grid + faint noise. Same slot dims as
        // future <img loading="lazy" src="..."> swap; no layout change needed.
        function _fgShardArt(idStr) {
            const seed = _fgHash(idStr);
            const rng  = _fgRng(seed);
            const palette = [
                'rgba(26,26,20,0.20)',
                'rgba(168,90,58,0.22)',
                'rgba(91,107,74,0.20)'
            ];
            const stroke = palette[seed % palette.length];
            const VBW = 90, VBH = 120; // 3:4
            let out = '';
            // 1. soft paper tint base block (so the shard isn't pure transparent)
            out += `<rect x="0" y="0" width="${VBW}" height="${VBH}" fill="rgba(251,247,238,0.92)"/>`;
            // 2. corner crop ticks (editorial)
            const tick = 4;
            out += `<path d="M0 ${tick} L0 0 L${tick} 0" stroke="${stroke}" stroke-width="0.6" fill="none"/>`;
            out += `<path d="M${VBW - tick} 0 L${VBW} 0 L${VBW} ${tick}" stroke="${stroke}" stroke-width="0.6" fill="none"/>`;
            out += `<path d="M0 ${VBH - tick} L0 ${VBH} L${tick} ${VBH}" stroke="${stroke}" stroke-width="0.6" fill="none"/>`;
            out += `<path d="M${VBW - tick} ${VBH} L${VBW} ${VBH} L${VBW} ${VBH - tick}" stroke="${stroke}" stroke-width="0.6" fill="none"/>`;
            // 3. one of three contour styles (rng-picked)
            const style = Math.floor(rng() * 3);
            if (style === 0) {
                // contour rings off-center
                const cx = 18 + rng() * 54;
                const cy = 30 + rng() * 60;
                for (let i = 0; i < 7; i++) {
                    const r = 6 + i * (5 + rng() * 2.5);
                    out += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" stroke="${stroke}" fill="none" stroke-width="0.5"/>`;
                }
            } else if (style === 1) {
                // sine-wave field
                for (let i = 0; i < 6; i++) {
                    const baseY = 14 + i * 17 + rng() * 3;
                    const amp = 3 + rng() * 4;
                    const phase = rng() * 6.28;
                    let p = `M 0 ${baseY.toFixed(2)}`;
                    for (let x = 4; x <= VBW; x += 4) {
                        const y = baseY + Math.sin(x * 0.07 + phase) * amp;
                        p += ` L ${x} ${y.toFixed(2)}`;
                    }
                    out += `<path d="${p}" stroke="${stroke}" fill="none" stroke-width="0.55"/>`;
                }
            } else {
                // diagonal hatch
                for (let i = 0; i < 14; i++) {
                    const offset = i * 9 + rng() * 4;
                    out += `<line x1="${offset.toFixed(1)}" y1="0" x2="${(offset - VBH).toFixed(1)}" y2="${VBH}" stroke="${stroke}" stroke-width="0.5"/>`;
                }
            }
            // 4. soft hairline grid overlay (very faint, always present)
            for (let i = 1; i < 6; i++) {
                const y = (i / 6) * VBH;
                out += `<line x1="0" y1="${y.toFixed(2)}" x2="${VBW}" y2="${y.toFixed(2)}" stroke="rgba(26,26,20,0.05)" stroke-width="0.3"/>`;
            }
            return `<svg viewBox="0 0 ${VBW} ${VBH}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">${out}</svg>`;
        }

        // Random Memory Slip — reuses formatWeiboText / formatDate / getRandomWeiboFromDaily.
        // Replace mode: old slip fades out (160ms), then new one slides in (280ms).
        function renderRandomSlip(zone, weiboData) {
            if (!zone || !weiboData || !Array.isArray(weiboData.weibo) || weiboData.weibo.length === 0) return;
            if (zone._randomSlipTimer) {
                clearTimeout(zone._randomSlipTimer);
                zone._randomSlipTimer = null;
            }
            const pick = getRandomWeiboFromDailyExcept(weiboData, zone.dataset.activeWeiboKey || '');
            zone.dataset.activeWeiboKey = getWeiboKey(pick);
            const slipText = formatWeiboText(pick.text);
            const slipDate = formatDate(pick.createdAt);

            const old = zone.querySelector('.memory-slip');
            const mountNew = () => {
                const slip = document.createElement('article');
                const textLength = slipText.length;
                const densityClass = textLength > 360
                    ? ' memory-slip--dense'
                    : (textLength > 220 ? ' memory-slip--long' : '');
                slip.className = `memory-slip${densityClass} is-entering`;
                slip.innerHTML =
                    `<header class="slip-meta">随机回忆 · ${slipDate}</header>` +
                    `<p class="slip-text">${escapeHtml(slipText)}</p>`;
                zone.appendChild(slip);
                // next frame: drop is-entering so the CSS transition fires
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => slip.classList.remove('is-entering'));
                });
            };
            if (old) {
                old.classList.add('is-leaving');
                zone._randomSlipTimer = setTimeout(() => {
                    zone.querySelectorAll('.memory-slip').forEach(slip => slip.remove());
                    mountNew();
                    zone._randomSlipTimer = null;
                }, 180);
            } else {
                mountNew();
            }
        }

        // Smooth scroll to #timeline. Prefer Lenis when present; fallback to
        // scrollIntoView. Adds body.is-entering-timeline for ~1.6s so CSS can
        // subtly fade/scale the hero during the journey.
        function _fgScrollToTimeline() {
            const target = document.getElementById('timeline');
            if (!target) return;
            document.body.classList.add('is-entering-timeline');
            const cleanup = () => document.body.classList.remove('is-entering-timeline');
            if (window.lenis && typeof window.lenis.scrollTo === 'function') {
                window.lenis.scrollTo(target, {
                    duration: 1.6,
                    easing: t => 1 - Math.pow(1 - t, 4),
                    onComplete: cleanup
                });
                // Failsafe in case lenis onComplete doesn't fire
                setTimeout(cleanup, 2200);
            } else {
                const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
                setTimeout(cleanup, reduce ? 100 : 1800);
            }
        }

        // Local motion runtime for the Field Guide: scroll progress + shard
        // mouse-tilt. Cancels itself when the timeline element leaves the DOM
        // (i.e. user navigated to another page). All work behind reduced-motion
        // and pointer-coarse gates.
        //
        // Progress anchor: viewport center against actual first/last node rects.
        //   p = 0  when viewport center hits the FIRST quarter node
        //   p = 1  when viewport center hits the LAST quarter node
        // This guarantees the accent stroke reaches the bottom right when the
        // user reads the last quarter — no over-shoot into footer padding.
        function _fgInitMotion() {
            if (fieldGuideRAF) cancelAnimationFrame(fieldGuideRAF), fieldGuideRAF = null;
            if (fieldGuideAbort) fieldGuideAbort.abort();
            const abortCtrl = new AbortController();
            fieldGuideAbort = abortCtrl;
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const finePointer  = window.matchMedia('(pointer: fine)').matches;
            const tlEl  = document.getElementById('timeline');
            const shell = document.querySelector('.field-guide-shell');
            if (!tlEl) return;

            // Cache shards from shell (rails now span hero + timeline) with
            // fallback to tlEl for resilience.
            const shardScope = shell || tlEl;
            const shards = Array.from(shardScope.querySelectorAll('.memory-shard'));
            const sCurveBase   = tlEl.querySelector('.s-curve-base');
            const sCurveAccent = tlEl.querySelector('.s-curve-accent');
            const sCurveLen    = sCurveAccent ? sCurveAccent.getTotalLength() : 0;
            if (sCurveLen > 0) {
                if (sCurveBase) {
                    sCurveBase.style.strokeDasharray  = `${sCurveLen}`;
                    sCurveBase.style.strokeDashoffset = `${sCurveLen}`;
                }
                if (sCurveAccent) {
                    sCurveAccent.style.strokeDasharray  = `${sCurveLen}`;
                    sCurveAccent.style.strokeDashoffset = `${sCurveLen}`;
                }
            }

            // Cache first/last node refs for scroll-progress anchoring.
            const nodes = tlEl.querySelectorAll('.tl-node');
            const firstNode = nodes[0] || null;
            const lastNode  = nodes[nodes.length - 1] || null;

            // Compute scroll progress 0..1 from first-node center → last-node center.
            // Reading getBoundingClientRect each frame is fine — these are leaf-ish
            // elements and the read happens once per RAF.
            function computeProgress() {
                if (!firstNode || !lastNode) return 0;
                const fr = firstNode.getBoundingClientRect();
                const lr = lastNode.getBoundingClientRect();
                const firstY = fr.top + fr.height * 0.5;
                const lastY  = lr.top + lr.height * 0.5;
                if (lastY === firstY) return 0;
                const center = (window.innerHeight || 800) * 0.5;
                const p = (center - firstY) / (lastY - firstY);
                return p < 0 ? 0 : (p > 1 ? 1 : p);
            }

            // Reveal observer: fade shards & nodes in once, then unobserve.
            if ('IntersectionObserver' in window) {
                const io = new IntersectionObserver((entries) => {
                    entries.forEach(e => {
                        if (e.isIntersecting) {
                            e.target.classList.add('is-visible');
                            io.unobserve(e.target);
                        }
                    });
                }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
                tlEl.querySelectorAll('.tl-node').forEach(el => io.observe(el));
                shardScope.querySelectorAll('.memory-shard').forEach(el => io.observe(el));
                // S curve "draws in" once it enters viewport
                const sCurveSvg = tlEl.querySelector('.s-curve-svg');
                if (sCurveSvg) {
                    const ioSvg = new IntersectionObserver((entries) => {
                        entries.forEach(e => {
                            if (e.isIntersecting) {
                                sCurveSvg.classList.add('is-drawn');
                                ioSvg.unobserve(e.target);
                            }
                        });
                    }, { threshold: 0.04 });
                    ioSvg.observe(sCurveSvg);
                }
            } else {
                // Old browsers: just show everything
                tlEl.querySelectorAll('.tl-node').forEach(el => el.classList.add('is-visible'));
                shardScope.querySelectorAll('.memory-shard').forEach(el => el.classList.add('is-visible'));
                const sCurveSvg = tlEl.querySelector('.s-curve-svg');
                if (sCurveSvg) sCurveSvg.classList.add('is-drawn');
            }

            // Helper: write accent dashoffset from progress (no transition; CSS
            // transition was removed — was creating perpetual scroll lag).
            function writeAccent(p) {
                if (sCurveAccent && sCurveLen > 0) {
                    sCurveAccent.style.strokeDashoffset = `${(sCurveLen * (1 - p)).toFixed(2)}`;
                }
            }

            // Reduced motion / no shards / coarse pointer → skip RAF; still
            // drive accent on scroll events with the same node-anchored progress.
            if (reduceMotion || !finePointer || shards.length === 0) {
                if (sCurveAccent && sCurveLen > 0) {
                    const updateAccent = () => {
                        if (!document.body.contains(tlEl)) { abortCtrl.abort(); return; }
                        writeAccent(computeProgress());
                    };
                    updateAccent();
                    window.addEventListener('scroll', updateAccent, { passive: true, signal: abortCtrl.signal });
                }
                return;
            }

            // Track mouse position + velocity for shard tilt
            const mouse = { x: -9999, y: -9999, vx: 0, vy: 0, lx: 0, ly: 0 };
            window.addEventListener('mousemove', (e) => {
                mouse.x = e.clientX;
                mouse.y = e.clientY;
            }, { signal: abortCtrl.signal });

            // Per-shard tilt state (lerped)
            const shardState = shards.map(() => ({ rx: 0, ry: 0 }));

            function tick() {
                // bail out if user navigated away
                if (!document.body.contains(tlEl)) {
                    fieldGuideRAF = null;
                    abortCtrl.abort();
                    return;
                }
                // pointer velocity
                mouse.vx = mouse.x - mouse.lx;
                mouse.vy = mouse.y - mouse.ly;
                mouse.lx = mouse.x;
                mouse.ly = mouse.y;

                // S-curve accent stroke from scroll progress (node-anchored)
                writeAccent(computeProgress());

                // Shard tilt: rotate gently when mouse is nearby; lerp back to 0 otherwise.
                // 先批量读 rect 再批量写 transform，避免读写交错造成的强制重排
                const shardRects = shards.map(sh => sh.getBoundingClientRect());
                for (let i = 0; i < shards.length; i++) {
                    const sh = shards[i];
                    const st = shardState[i];
                    const r = shardRects[i];
                    const cx = r.left + r.width  * 0.5;
                    const cy = r.top  + r.height * 0.5;
                    const dx = mouse.x - cx;
                    const dy = mouse.y - cy;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const NEAR = 280;
                    let targetRy = 0, targetRx = 0;
                    if (dist < NEAR) {
                        const f = 1 - (dist / NEAR);     // 0..1, closer = stronger
                        const gain = 0.35;
                        targetRy = Math.max(-7, Math.min(7,  mouse.vx * gain * f));
                        targetRx = Math.max(-7, Math.min(7, -mouse.vy * gain * f));
                    }
                    st.ry += (targetRy - st.ry) * 0.12;
                    st.rx += (targetRx - st.rx) * 0.12;
                    sh.style.setProperty('--tx', st.ry.toFixed(2) + 'deg');
                    sh.style.setProperty('--ty', st.rx.toFixed(2) + 'deg');
                }
                fieldGuideRAF = requestAnimationFrame(tick);
            }
            fieldGuideRAF = requestAnimationFrame(tick);
        }

        // Main render. wbData = { weibo: [...] }; qData = { intro, quarters: [...] }.
        // Param names intentionally avoid shadowing the top-level `weiboData` /
        // `quartersData` caches that showEssayDetail / renderKazhi read from.
        function renderFieldGuideHome(wbData, qData) {
            const content = document.getElementById('content');
            fieldGuideQuarters = qData;
            // Sync the top-level quartersData cache so showEssayDetail('quarters', id)
            // can resolve quarter ids when the user clicks "Read more" from the home
            // timeline (it normally only gets populated when /quarters route is hit).
            quartersData = qData;
            // Cancel previous RAF if user re-navigated to kazhi quickly
            if (fieldGuideRAF) { cancelAnimationFrame(fieldGuideRAF); fieldGuideRAF = null; }

            // Reverse chronological: newest at top
            const quarters = (qData.quarters || []).slice().reverse();

            // Geometry
            const N = quarters.length;
            const SVG_W   = 720;     // intrinsic; scales via CSS
            const PAD_TOP = 140;
            const PAD_BOT = 200;
            const quarterMonths = quarters.map(_fgQuarterMonth);
            const topMonth = Math.max(...quarterMonths.map(d => d.monthIndex));
            const bottomMonth = Math.min(...quarterMonths.map(d => d.monthIndex));
            const MONTH_PX = 126;    // 2026.3 → 2023.9 spans 30 months ≈ previous total height
            const SVG_H   = PAD_TOP + (topMonth - bottomMonth) * MONTH_PX + PAD_BOT;
            const geom    = _fgSCurveGeometry(quarters, SVG_W, PAD_TOP, MONTH_PX);

            // Memory shards — 20 total (10 per side), placed semi-randomly in
            // their .memory-column with varied sizes (small ↔ large) so the
            // sides feel scattered rather than gridded. Each column's height
            // matches the SVG curve, so `top%` maps to vertical scroll position.
            const SHARD_COUNT = 20;
            const shardSeeds = [];
            const captionPool = [
                'a kitchen on monday', 'fog over the bay', 'cat on the windowsill',
                'late jasmine tea', 'the long walk back', 'a borrowed afternoon',
                'wet sequoia bark', 'small print in chinese', 'unfinished postcard',
                'the bright noise of summer', 'rain on the cycle path', 'a folded receipt',
                'midwinter aircon hum', 'tide pool, low light', 'second cup of the day',
                'a sticker on a window', 'noon shadow on rice', 'unsent draft #4',
                'cyclamen, february', 'salt on the lower lip'
            ];
            // Track per-side index to spread evenly within each column
            const sideCounts = { left: 0, right: 0 };
            for (let i = 0; i < SHARD_COUNT; i++) {
                const side = i % 2 === 0 ? 'left' : 'right';
                const id = 'shard-' + i;
                const rng = _fgRng(_fgHash(id) ^ (i * 73));
                const sideIdx = sideCounts[side]++;
                const perSide = Math.ceil(SHARD_COUNT / 2); // 10
                // Even per-side spacing baseline + ±half-slot random jitter
                // so positions look scattered but never bunch up.
                const slot = sideIdx / Math.max(1, perSide - 1);   // 0..1
                const slotSize = 100 / perSide;                    // % per slot
                const jitter = (rng() - 0.5) * slotSize * 0.85;
                const top = 2 + slot * 96 + jitter;
                // Wider variety of widths: 90-240px
                const width = 90 + Math.floor(rng() * 150);
                // Slight horizontal jitter within column (in addition to base offset)
                const xOffset = Math.floor(rng() * 28);            // 0-28px
                shardSeeds.push({
                    id,
                    side,
                    top: Math.max(1, Math.min(98, top)),
                    rotate: (rng() - 0.5) * 8,        // -4..4 deg
                    width,
                    xOffset,
                    caption: captionPool[i % captionPool.length]
                });
            }

            // Nodes HTML (absolutely positioned over SVG via inline style top/left)
            let nodesHtml = '';
            quarters.forEach((q, i) => {
                const stop = geom.stops[i];
                const sideClass = stop.side; // 'left' or 'right'
                // Convert SVG coords (intrinsic 720 wide) → percentages of the SVG box
                const leftPct = (stop.x / SVG_W) * 100;
                const topPx   = stop.y;
                const kw = (q.keywords || []).join(' · ');
                nodesHtml += `
                    <article class="tl-node tl-node--${sideClass}" data-id="${escapeHtml(q.id)}"
                             style="--node-left: ${leftPct.toFixed(3)}%; --node-top: ${topPx}px;">
                        <span class="tl-dot" aria-hidden="true"></span>
                        <div class="tl-node__body">
                            <header class="tl-node__head">
                                <span class="tl-label">${escapeHtml(q.label)}</span>
                                <span class="tl-meta">${stop.dateLabel} · ${escapeHtml(q.season)}</span>
                            </header>
                            ${kw ? `<p class="tl-keywords">${escapeHtml(kw)}</p>` : ''}
                            <p class="tl-summary">${escapeHtml(q.summary || '')}</p>
                            <button class="tl-read" type="button"
                                    data-quarter-id="${escapeHtml(q.id)}"
                                    data-cursor-label="Read"
                                    data-cursor-mode="link">
                                Read more →
                            </button>
                        </div>
                    </article>
                `;
            });

            // Shards HTML — left + right column children. xOffset adds horizontal
            // jitter on top of the base alignment (right-aligned in left col,
            // left-aligned in right col) so shards feel scattered.
            const renderShard = (s) => `
                <figure class="memory-shard memory-shard--${s.side}" data-id="${s.id}"
                        style="--shard-top: ${s.top.toFixed(2)}%; --shard-rot: ${s.rotate.toFixed(2)}deg; --shard-w: ${s.width}px; --shard-xoff: ${s.xOffset}px;">
                    <div class="shard-frame">${_fgShardArt(s.id)}</div>
                    <figcaption class="shard-caption">${s.caption}</figcaption>
                </figure>
            `;
            const leftShards  = shardSeeds.filter(s => s.side === 'left').map(renderShard).join('');
            const rightShards = shardSeeds.filter(s => s.side === 'right').map(renderShard).join('');

            content.innerHTML = `
                <section class="field-guide-hero">
                    <div class="fg-hero-inner">
                        <header class="fg-hero-top">
                            <p class="fg-eyebrow">咔滋的森林 / Field Notes</p>
                            <p class="fg-index">${quarters.length} quarters · ${wbData.weibo.length} memories</p>
                        </header>

                        <h1 class="fg-title">Katz Radio</h1>

                        <footer class="fg-hero-bottom">
                            <p class="fg-intro">
                                A personal archive of memory, research quarters,
                                cooking notes, and repeated listening.
                            </p>
                            <div class="fg-control-stack">
                                <div class="random-memory-zone" aria-live="polite"></div>
                                <div class="fg-actions">
                                    <button class="fg-btn fg-btn--primary" type="button"
                                            data-action="timeline" data-cursor-label="Enter" data-cursor-mode="link">
                                        <span class="fg-btn__num">01</span>
                                        <span class="fg-btn__label">Timeline</span>
                                        <span class="fg-btn__arrow" aria-hidden="true">↓</span>
                                    </button>
                                    <button class="fg-btn fg-btn--ghost" type="button"
                                            data-action="random" data-cursor-label="Pick" data-cursor-mode="link">
                                        <span class="fg-btn__num">02</span>
                                        <span class="fg-btn__label">Random</span>
                                        <span class="fg-btn__arrow" aria-hidden="true">↻</span>
                                    </button>
                                </div>
                            </div>
                        </footer>
                    </div>
                    <p class="fg-scroll-hint" aria-hidden="true">scroll · 时间倒流</p>
                </section>

                <section id="timeline" class="timeline-world" style="--svg-h: ${SVG_H}px;">
                    <header class="timeline-header">
                        <p class="tl-eyebrow">PhD Quarters · ${quarters.length} entries</p>
                        <h2 class="tl-title">The Long Walk Back</h2>
                        <p class="tl-intro">From 2026.3 to 2023.9. The curve keeps the newest-to-oldest order, but its vertical spacing follows real calendar time.</p>
                    </header>

                    <div class="timeline-stage-grid">
                        <div class="memory-column memory-column--left" aria-hidden="true">${leftShards}</div>

                        <div class="s-curve-stage">
                            <svg class="s-curve-svg" viewBox="0 0 ${SVG_W} ${SVG_H}"
                                 preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                                <path class="s-curve-base"   d="${geom.d}" fill="none"
                                      stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
                                <path class="s-curve-accent" d="${geom.d}" fill="none"
                                      stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                            </svg>
                            <div class="tl-nodes">${nodesHtml}</div>
                        </div>

                        <div class="memory-column memory-column--right" aria-hidden="true">${rightShards}</div>
                    </div>

                    <footer class="timeline-foot">
                        <span class="tl-foot-rule" aria-hidden="true"></span>
                        <p class="tl-foot-text">— end of trail —</p>
                    </footer>
                </section>
            `;

            // Wire actions
            const heroSection = content.querySelector('.field-guide-hero');
            const zone        = content.querySelector('.random-memory-zone');
            const tlBtn       = content.querySelector('[data-action="timeline"]');
            const rdBtn       = content.querySelector('[data-action="random"]');

            if (tlBtn) tlBtn.addEventListener('click', _fgScrollToTimeline);
            if (rdBtn) rdBtn.addEventListener('click', () => renderRandomSlip(zone, wbData));

            // Quarter "Read more" → reuse showEssayDetail with 'quarters' source.
            // (cache assignment to top-level quartersData done at function head.)
            content.querySelectorAll('.tl-read').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const qid = btn.getAttribute('data-quarter-id');
                    if (qid) showEssayDetail('quarters', qid);
                });
            });

            // Defer motion init until layout settled (SVG getTotalLength needs DOM).
            requestAnimationFrame(() => requestAnimationFrame(_fgInitMotion));
        }

        // 渲染咔言咔语 = 专栏 hub（9 宫格）
        function renderSayGrid(jsonData) {
            const content = document.getElementById('content');
            columnsData = jsonData;
            currentColumnId = null;

            const cols = jsonData.columns || [];
            // 补齐到 9 格（不够就补 blank）
            while (cols.length < 9) {
                cols.push({ id: 'blank-' + cols.length, title: '·', subtitle: '留白也是一种表达', blank: true });
            }

            let html = '<div class="grid-container">';
            cols.slice(0, 9).forEach(col => {
                const isBlank = !!col.blank;
                const cardClass = isBlank ? 'card empty-card' : 'card';
                const focusAttrs = isBlank ? '' : ' tabindex="0" role="button"';
                html += `
                    <div class="${cardClass}" data-column="${escapeHtml(col.id)}"${focusAttrs}>
                        <div class="card-face card-front"></div>
                        <div class="card-face card-back">
                            <h3 class="card-title">${escapeHtml(col.title || '')}</h3>
                            <p class="card-description">${escapeHtml(col.subtitle || '')}</p>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            content.innerHTML = html;

            // 卡片点击：进入对应专栏页（innerHTML 同步生效，直接绑定即可）
            content.querySelectorAll('.card:not(.empty-card)').forEach(card => {
                card.addEventListener('click', function () {
                    this.classList.add('clicked');
                    const colId = this.getAttribute('data-column');
                    setTimeout(() => {
                        this.classList.remove('clicked');
                        loadColumn(colId);
                    }, 580);
                });
            });
        }

        // 进入某个专栏页（第二层：标题列表）
        function loadColumn(columnId) {
            const col = (columnsData.columns || []).find(c => c.id === columnId);
            if (!col || col.blank) return;

            const myToken = navToken;
            const content = document.getElementById('content');
            content.style.opacity = '0';

            // 准备 items：要么 inline，要么从外部 JSON 拉
            const finish = (items) => {
                if (myToken !== navToken) return; // 期间用户已切到其他页
                renderColumnView(col, items);
                setTimeout(() => { if (myToken === navToken) content.style.opacity = '1'; }, 50);
            };
            const fail = (error) => {
                if (myToken !== navToken) return;
                console.error('Error loading column:', error);
                content.innerHTML = '<p class="error">加载失败，请稍后重试</p>';
                content.style.opacity = '1';
            };

            if (col.ref === 'quarters') {
                ensureQuartersLoaded().then(() => {
                    const items = (quartersData.quarters || []).map(q => ({
                        id: q.id,
                        title: q.label,
                        tag: (q.keywords || []).join(' · '),
                        summary: q.summary,
                        content: q.content
                    }));
                    finish(items);
                }).catch(fail);
            } else if (col.ref === 'cooking') {
                ensureCookingLoaded()
                    .then(() => finish(cookingData.essays || []))
                    .catch(fail);
            } else {
                finish(col.items || []);
            }
        }

        // 渲染专栏视图（第二层）：面包屑 + 手风琴列表
        function renderColumnView(col, items) {
            currentColumnId = col.id;
            const content = document.getElementById('content');

            let html = '<div class="column-view">';
            html += `<button class="breadcrumb" type="button" onclick="backToHub()">← 咔言咔语</button>`;
            html += `<header class="column-header">`;
            html += `<h2 class="column-title">${escapeHtml(col.title)}</h2>`;
            if (col.subtitle) html += `<div class="column-subtitle">${escapeHtml(col.subtitle)}</div>`;
            html += `</header>`;

            if (!items || items.length === 0) {
                html += `<div class="column-empty">敬请期待 / coming soon</div>`;
            } else {
                html += '<div class="essay-list column-list">';
                items.forEach(item => {
                    // 把 col.id 编码到 source 上，方便详情弹窗回查
                    html += renderEssayEntryInline(item, 'column:' + col.id);
                });
                html += '</div>';
            }
            html += '</div>';
            content.innerHTML = html;

            // 缓存当前 column 的 items 以便详情弹窗可以查找
            columnItemsCache[col.id] = items;

            attachEssayHandlers(content);
        }

        // 返回 hub
        function backToHub() {
            const myToken = navToken;
            const content = document.getElementById('content');
            content.style.opacity = '0';
            setTimeout(() => {
                if (myToken !== navToken) return;
                renderSayGrid(columnsData);
                content.style.opacity = '1';
            }, 250);
        }

        // 给 column 视图用的 entry 渲染（与 cooking/quarters 共用 markup，source 字段不同）
        function renderEssayEntryInline(item, source) {
            const buttonLabel = source === 'recipe' ? '查看做法 →' : '阅读全文 →';
            return `
                <article class="essay-entry" data-source="${escapeHtml(source)}" data-id="${escapeHtml(item.id)}">
                    <header class="essay-header" role="button" tabindex="0" aria-expanded="false">
                        <span class="essay-title">${escapeHtml(item.title)}</span>
                        ${item.tag ? `<span class="essay-tag">${escapeHtml(item.tag)}</span>` : ''}
                        <span class="essay-toggle" aria-hidden="true">+</span>
                    </header>
                    <div class="essay-body">
                        <p class="essay-summary">${escapeHtml(item.summary || '')}</p>
                        <button class="read-full" type="button">${buttonLabel}</button>
                    </div>
                </article>
            `;
        }

        // 缓存：column id → items
        let columnItemsCache = {};

        // 懒加载 quarters/cooking JSON（如果还没加载过）
        function ensureQuartersLoaded() {
            if ((quartersData.quarters || []).length > 0) return Promise.resolve();
            return fetchJSON('data/quarters.json').then(d => { quartersData = d; });
        }
        function ensureCookingLoaded() {
            if ((cookingData.essays || []).length > 0) return Promise.resolve();
            return fetchJSON('data/cooking.json').then(d => { cookingData = d; });
        }

        // 弹窗打开前持有焦点的元素，关闭时归还焦点
        let detailReturnFocus = null;

        // 关闭详情弹窗
        function closeDetail() {
            const overlay = document.getElementById('detailOverlay');
            if (!overlay.classList.contains('active')) return;
            overlay.classList.remove('active');

            // 恢复背景滚动
            document.body.style.overflow = '';
            if (window.lenis && typeof window.lenis.start === 'function') {
                window.lenis.start();
            }
            if (detailReturnFocus && document.body.contains(detailReturnFocus)) {
                detailReturnFocus.focus();
            }
            detailReturnFocus = null;
        }

        // 渲染Deep Cooking页面 - 包含 philosophy + essays（迷思） + recipes
        function renderCooking(data) {
            const content = document.getElementById('content');
            cookingData = data; // 缓存用于详情弹窗

            let html = '<div class="cooking-container">';

            html += `<p class="philosophy">${escapeHtml(data.philosophy)}</p>`;

            // 迷思 / Essays 区块（默认折叠）
            if (Array.isArray(data.essays) && data.essays.length > 0) {
                html += '<section class="essays-section collapsible-section">';
                html += '<h3 class="section-heading toggle-section" role="button" tabindex="0" aria-expanded="false" onclick="toggleSection(this)">迷思<span class="toggle-icon" aria-hidden="true">+</span></h3>';
                html += '<div class="section-body"><div class="essay-list">';
                data.essays.forEach(essay => {
                    html += renderEssayEntry(essay, 'cooking');
                });
                html += '</div></div></section>';
            }

            // Recipes 区块（默认折叠）
            if (data.recipes) {
                html += '<section class="recipes-section collapsible-section">';
                html += '<h3 class="section-heading toggle-section" role="button" tabindex="0" aria-expanded="false" onclick="toggleSection(this)">菜谱<span class="toggle-icon" aria-hidden="true">+</span></h3>';
                html += '<div class="section-body">';
                Object.keys(data.recipes).forEach(category => {
                    const items = data.recipes[category] || [];
                    if (items.length === 0) return;
                    html += `<div class="recipe-category">`;
                    html += `<h4 class="recipe-category-title">${escapeHtml(category)}</h4>`;
                    html += `<div class="essay-list recipe-list-v2">`;
                    items.forEach(r => {
                        html += renderEssayEntryInline({
                            id: r.id,
                            title: r.title,
                            tag: r.tag || '',
                            summary: r.summary || '',
                            content: r.content || ''
                        }, 'recipe');
                    });
                    html += `</div></div>`;
                });
                html += '</div></section>';
            }

            // Wishlist 待做菜谱
            if (Array.isArray(data.wishlist) && data.wishlist.length > 0) {
                html += '<section class="wishlist-section">';
                html += '<h3 class="section-heading">待做 / Wishlist</h3>';
                html += '<ul class="wishlist">';
                data.wishlist.forEach(name => {
                    html += `<li>${escapeHtml(name)}</li>`;
                });
                html += '</ul></section>';
            }

            html += '</div>';
            content.innerHTML = html;

            attachEssayHandlers(content);
        }

        // 渲染 PhD Quarters 页面
        function renderQuarters(data) {
            const content = document.getElementById('content');
            quartersData = data; // 缓存

            let html = '<div class="quarters-container">';
            if (data.intro) {
                html += `<p class="philosophy">${escapeHtml(data.intro)}</p>`;
            }
            html += '<div class="essay-list quarter-list">';
            (data.quarters || []).forEach(q => {
                html += renderEssayEntry({
                    id: q.id,
                    title: q.label,
                    tag: (q.keywords || []).join(' · '),
                    summary: q.summary,
                    content: q.content
                }, 'quarters');
            });
            html += '</div></div>';

            content.innerHTML = html;
            attachEssayHandlers(content);
        }

        // 共享：渲染一个可展开的条目（标题 → 摘要 + 阅读全文）
        function renderEssayEntry(item, source) {
            return `
                <article class="essay-entry" data-source="${escapeHtml(source)}" data-id="${escapeHtml(item.id)}">
                    <header class="essay-header" role="button" tabindex="0" aria-expanded="false">
                        <span class="essay-title">${escapeHtml(item.title)}</span>
                        ${item.tag ? `<span class="essay-tag">${escapeHtml(item.tag)}</span>` : ''}
                        <span class="essay-toggle" aria-hidden="true">+</span>
                    </header>
                    <div class="essay-body">
                        <p class="essay-summary">${escapeHtml(item.summary || '')}</p>
                        <button class="read-full" type="button">阅读全文 →</button>
                    </div>
                </article>
            `;
        }

        // 给所有 essay-entry 绑定点击事件
        function attachEssayHandlers(scope) {
            scope.querySelectorAll('.essay-entry').forEach(entry => {
                const header = entry.querySelector('.essay-header');
                const readBtn = entry.querySelector('.read-full');
                if (header) {
                    header.addEventListener('click', () => {
                        const open = entry.classList.toggle('open');
                        header.setAttribute('aria-expanded', String(open));
                    });
                }
                if (readBtn) {
                    readBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const source = entry.getAttribute('data-source');
                        const id = entry.getAttribute('data-id');
                        showEssayDetail(source, id);
                    });
                }
            });
        }

        // 打开详情弹窗（复用 #detailOverlay）
        function showEssayDetail(source, id) {
            let item = null;
            if (source === 'quarters') {
                const q = (quartersData.quarters || []).find(x => x.id === id);
                if (q) {
                    item = {
                        title: q.label,
                        subtitle: (q.keywords || []).join(' · '),
                        content: q.content
                    };
                }
            } else if (source === 'cooking') {
                const e = (cookingData.essays || []).find(x => x.id === id);
                if (e) {
                    item = {
                        title: e.title,
                        subtitle: e.tag || '',
                        content: e.content
                    };
                }
            } else if (source && source.startsWith('column:')) {
                const colId = source.slice('column:'.length);
                const items = columnItemsCache[colId] || [];
                const it = items.find(x => x.id === id);
                if (it) {
                    item = {
                        title: it.title,
                        subtitle: it.tag || '',
                        content: it.content
                    };
                }
            } else if (source === 'recipe') {
                const cats = (cookingData.recipes || {});
                for (const cat of Object.keys(cats)) {
                    const r = (cats[cat] || []).find(x => x.id === id);
                    if (r) {
                        item = {
                            title: r.title,
                            subtitle: cat + (r.tag ? ' · ' + r.tag : ''),
                            content: r.content
                        };
                        break;
                    }
                }
            }
            if (!item) return;

            const overlay = document.getElementById('detailOverlay');
            const title = document.getElementById('detailTitle');
            const body = document.getElementById('detailBody');

            title.textContent = item.title;
            let bodyHTML = '';
            if (item.subtitle) {
                bodyHTML += `<div class="detail-subtitle">${escapeHtml(item.subtitle)}</div>`;
            }
            bodyHTML += `<div class="detail-article">${renderMarkdown(item.content)}</div>`;
            body.innerHTML = bodyHTML;

            detailReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            overlay.classList.add('active');
            overlay.scrollTop = 0;
            const scroller = overlay.querySelector('.detail-content');
            if (scroller) scroller.scrollTop = 0;
            const closeBtn = overlay.querySelector('.close-btn');
            if (closeBtn) closeBtn.focus();
            document.body.style.overflow = 'hidden';
            if (window.lenis && typeof window.lenis.stop === 'function') {
                window.lenis.stop();
            }
        }

        // 极简 markdown 渲染：## 标题、> 引用、**加粗**、段落
        function renderMarkdown(text) {
            if (!text) return '';
            const escape = (s) => s
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            const blocks = text.split(/\n\n+/);
            const htmlBlocks = blocks.map(raw => {
                const block = raw.trim();
                if (!block) return '';

                // 标题 ## / ###
                if (block.startsWith('### ')) {
                    return `<h4>${inline(escape(block.slice(4)))}</h4>`;
                }
                if (block.startsWith('## ')) {
                    return `<h3>${inline(escape(block.slice(3)))}</h3>`;
                }
                if (block.startsWith('# ')) {
                    return `<h2>${inline(escape(block.slice(2)))}</h2>`;
                }
                // 水平分割线
                if (/^---+$/.test(block)) {
                    return '<hr/>';
                }
                // 引用块（每行以 > 开头）
                if (block.split('\n').every(l => l.startsWith('>'))) {
                    const inner = block
                        .split('\n')
                        .map(l => l.replace(/^>\s?/, ''))
                        .join('<br/>');
                    return `<blockquote>${inline(escape(inner))}</blockquote>`;
                }
                // 有序列表（每行以 N. 开头）
                const lines = block.split('\n');
                if (lines.length > 0 && lines.every(l => /^\d+\.\s/.test(l))) {
                    const items = lines
                        .map(l => l.replace(/^\d+\.\s/, ''))
                        .map(t => `<li>${inline(escape(t))}</li>`);
                    return `<ol>${items.join('')}</ol>`;
                }
                // 无序列表（每行以 - 或 * 开头）
                if (lines.length > 0 && lines.every(l => /^[-*]\s/.test(l))) {
                    const items = lines
                        .map(l => l.replace(/^[-*]\s/, ''))
                        .map(t => `<li>${inline(escape(t))}</li>`);
                    return `<ul>${items.join('')}</ul>`;
                }
                // 表格：第 1 行表头 / 第 2 行分割 / 其余数据
                if (lines.length >= 3
                        && lines.every(l => /^\|.*\|$/.test(l.trim()))
                        && /^\|[\s\-:|]+\|$/.test(lines[1].trim())) {
                    const splitCells = (l) => {
                        const inner = l.trim().slice(1, -1);
                        return inner.split('|').map(c => c.trim());
                    };
                    const headers = splitCells(lines[0]);
                    const rows = lines.slice(2).map(splitCells);
                    let table = '<table><thead><tr>';
                    headers.forEach(h => { table += `<th>${inline(escape(h))}</th>`; });
                    table += '</tr></thead><tbody>';
                    rows.forEach(row => {
                        table += '<tr>';
                        row.forEach(c => { table += `<td>${inline(escape(c))}</td>`; });
                        table += '</tr>';
                    });
                    table += '</tbody></table>';
                    return table;
                }
                // 普通段落（段内单换行 → <br>）
                const escaped = escape(block).replace(/\n/g, '<br/>');
                return `<p>${inline(escaped)}</p>`;
            });

            return htmlBlocks.join('\n');

            function inline(s) {
                // **bold**
                return s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            }
        }
        
        // === Deep Listening：四个 tab ===
        // playlists (默认) / profile (听歌画像) / by-year / by-artist
        let listeningPlaylistsCache = null; // 12 个精选
        let likedStatsCache = null;          // liked-stats.json
        let likedSongsCache = null;          // liked.json (3667 首)

        function renderListening(data) {
            // data 是精选 12 个歌单（数组）— 默认 tab 用
            listeningPlaylistsCache = Array.isArray(data)
                ? data
                : Object.keys(data || {}).map(name => ({ name, tracks: data[name] }));

            const content = document.getElementById('content');
            content.innerHTML = `
                <div class="listening-container">
                    <nav class="listening-tabs" role="tablist">
                        <button type="button" class="lt-tab active" role="tab" aria-selected="true" data-tab="playlists">歌单</button>
                        <button type="button" class="lt-tab" role="tab" aria-selected="false" data-tab="profile">听歌画像</button>
                        <button type="button" class="lt-tab" role="tab" aria-selected="false" data-tab="by-year">按年份</button>
                        <button type="button" class="lt-tab" role="tab" aria-selected="false" data-tab="by-artist">按艺人</button>
                    </nav>
                    <div class="listening-body" id="listeningBody"></div>
                </div>
            `;

            // 绑定 tab 切换
            content.querySelectorAll('.lt-tab').forEach(tab => {
                tab.addEventListener('click', () => switchListeningTab(tab.getAttribute('data-tab')));
            });

            // 默认显示精选歌单
            switchListeningTab('playlists');
        }

        // tab 切换令牌：快速点 tab 时，慢的那次 await 回来后直接丢弃
        let listeningTabToken = 0;

        async function switchListeningTab(tabName) {
            const myTab = ++listeningTabToken;
            const myNav = navToken;
            const stale = () => myTab !== listeningTabToken || myNav !== navToken;

            // 切 active 状态
            document.querySelectorAll('.lt-tab').forEach(t => {
                const active = t.getAttribute('data-tab') === tabName;
                t.classList.toggle('active', active);
                t.setAttribute('aria-selected', String(active));
            });
            const body = document.getElementById('listeningBody');
            body.style.opacity = '0';

            try {
                if (tabName === 'playlists') {
                    renderListeningPlaylists(body, listeningPlaylistsCache || []);
                } else if (tabName === 'profile') {
                    if (!likedStatsCache) {
                        likedStatsCache = await fetchJSON('data/liked-stats.json');
                    }
                    if (stale()) return;
                    renderListeningProfile(body, likedStatsCache);
                } else if (tabName === 'by-year') {
                    if (!likedSongsCache) {
                        body.innerHTML = '<p class="loading">读取 3667 首歌中…</p>';
                        body.style.opacity = '1';
                        likedSongsCache = await fetchJSON('data/liked.json');
                        if (stale()) return;
                        body.style.opacity = '0';
                    }
                    renderListeningByYear(body, likedSongsCache);
                } else if (tabName === 'by-artist') {
                    if (!likedSongsCache) {
                        body.innerHTML = '<p class="loading">读取 3667 首歌中…</p>';
                        body.style.opacity = '1';
                        likedSongsCache = await fetchJSON('data/liked.json');
                        body.style.opacity = '0';
                    }
                    if (!likedStatsCache) {
                        likedStatsCache = await fetchJSON('data/liked-stats.json');
                    }
                    if (stale()) return;
                    renderListeningByArtist(body, likedSongsCache, likedStatsCache);
                }
            } catch (e) {
                if (stale()) return;
                body.innerHTML = '<p class="error">加载失败：' + escapeHtml(e.message) + '</p>';
            }

            setTimeout(() => { if (!stale()) body.style.opacity = '1'; }, 60);
        }

        // —— Tab 1: 精选歌单 ——
        function renderListeningPlaylists(body, playlists) {
            let html = '';
            playlists.forEach(p => {
                const tracks = p.tracks || [];
                // 网易云官方 iframe；data-src 等到 accordion 第一次打开再注入，
                // 避免 12 个 iframe 同时开 12 路 NetEase 连接
                const playerHTML = p.id ? `
                    <div class="playlist-player">
                        <iframe class="ne-iframe" title="网易云音乐歌单播放器"
                                frameborder="no" border="0"
                                marginwidth="0" marginheight="0"
                                width="100%" height="86"
                                data-src="//music.163.com/outchain/player?type=0&id=${encodeURIComponent(p.id)}&auto=0&height=66"></iframe>
                        <a class="ne-fallback" href="https://music.163.com/#/playlist?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">如未加载，到网易云打开 →</a>
                    </div>
                ` : '';
                html += `
                    <div class="playlist-section">
                        <h3 class="playlist-title" role="button" tabindex="0" aria-expanded="false" onclick="togglePlaylist(this)">
                            ${escapeHtml(p.name)}
                            <span class="playlist-count">${tracks.length}</span>
                        </h3>
                        <div class="playlist-content">
                            ${playerHTML}
                            <ul class="song-list">
                `;
                tracks.forEach(song => {
                    html += `
                        <li class="song-item">
                            <span class="song-title">${escapeHtml(song.title)}</span>
                            <span class="song-artist">${escapeHtml(song.artist)}</span>
                        </li>
                    `;
                });
                html += '</ul></div></div>';
            });
            body.innerHTML = html;
        }

        // —— Tab 2: 听歌画像 ——
        function renderListeningProfile(body, stats) {
            const total = stats.total || 0;
            const hours = stats.totalDurationHours || 0;
            const avg = stats.avgDurationSec || 0;
            const topArtists = (stats.topArtists || []).slice(0, 20);
            const maxArtist = topArtists.length ? topArtists[0].count : 1;

            const yearEntries = Object.entries(stats.byYear || {})
                .map(([y, c]) => [+y, c])
                .filter(([y]) => y >= 2008 && y <= 2030)
                .sort((a, b) => a[0] - b[0]);
            const maxYear = yearEntries.length ? Math.max(...yearEntries.map(e => e[1])) : 1;

            let html = `
                <section class="profile-overview">
                    <div class="profile-stat">
                        <div class="profile-num">${total.toLocaleString()}</div>
                        <div class="profile-label">首</div>
                    </div>
                    <div class="profile-stat">
                        <div class="profile-num">${hours}</div>
                        <div class="profile-label">小时</div>
                    </div>
                    <div class="profile-stat">
                        <div class="profile-num">${(avg / 60).toFixed(1)}</div>
                        <div class="profile-label">分钟 / 首均</div>
                    </div>
                </section>

                <section class="profile-block">
                    <h3 class="profile-heading">Top 艺人</h3>
                    <div class="chart-rows">`;
            topArtists.forEach(a => {
                const pct = (a.count / maxArtist * 100).toFixed(1);
                html += `
                        <div class="chart-row">
                            <span class="chart-label">${escapeHtml(a.name)}</span>
                            <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
                            <span class="chart-value">${a.count}</span>
                        </div>`;
            });
            html += `
                    </div>
                </section>

                <section class="profile-block">
                    <h3 class="profile-heading">按年份分布</h3>
                    <div class="chart-rows year-rows">`;
            yearEntries.reverse().forEach(([y, c]) => {
                const pct = (c / maxYear * 100).toFixed(1);
                html += `
                        <div class="chart-row">
                            <span class="chart-label year-label">${y}</span>
                            <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
                            <span class="chart-value">${c}</span>
                        </div>`;
            });
            html += `
                    </div>
                </section>
            `;
            body.innerHTML = html;
        }

        // —— Tab 3/4 共用：歌曲列表懒渲染 ——
        // 3667 首歌一次性注入 ~1.1 万个 DOM 节点会卡住低端设备；
        // 这里先只渲染标题行，首次展开 accordion 时才注入 <li>。
        let lazySongGroups = {};

        function songListItemsHTML(list, cap) {
            const shown = cap ? list.slice(0, cap) : list;
            let html = shown.map(s => `
                            <li class="song-item">
                                <span class="song-title">${escapeHtml(s.t)}</span>
                                <span class="song-artist">${escapeHtml(s.a)}</span>
                            </li>`).join('');
            if (cap && list.length > cap) {
                html += `<li class="song-item more-note">…还有 ${list.length - cap} 首</li>`;
            }
            return html;
        }

        function lazyPlaylistSectionHTML(titleHTML, list, key, cap, countDisplay) {
            lazySongGroups[key] = { list, cap };
            return `
                    <div class="playlist-section">
                        <h3 class="playlist-title" role="button" tabindex="0" aria-expanded="false" onclick="togglePlaylist(this)">
                            ${titleHTML}
                            <span class="playlist-count">${countDisplay != null ? countDisplay : list.length}</span>
                        </h3>
                        <div class="playlist-content">
                            <ul class="song-list" data-lazy-key="${escapeHtml(key)}"></ul>
                        </div>
                    </div>`;
        }

        // —— Tab 3: 按年份 ——
        function renderListeningByYear(body, songs) {
            const grouped = {};
            songs.forEach(s => {
                const y = s.y || 0;
                if (!grouped[y]) grouped[y] = [];
                grouped[y].push(s);
            });
            const years = Object.keys(grouped).map(Number)
                .filter(y => y >= 1900 && y <= 2030)
                .sort((a, b) => b - a);

            lazySongGroups = {};
            let html = '';
            years.forEach(y => {
                html += lazyPlaylistSectionHTML(String(y), grouped[y], 'year:' + y);
            });

            // 未知年份归到末尾（超长，截断展示前 200 首）
            if (grouped[0]) {
                html += lazyPlaylistSectionHTML('未知年份', grouped[0], 'year:unknown', 200);
            }

            body.innerHTML = html;
        }

        // —— Tab 4: 按艺人 ——
        function renderListeningByArtist(body, songs, stats) {
            // 用 stats.topArtists 决定显示顺序，扩展到前 50
            const top = (stats.topArtists || []).slice(0, 50);
            // 给每个艺人匹配歌曲（出现在 artist 字段中即算）
            const grouped = {};
            top.forEach(a => { grouped[a.name] = []; });
            songs.forEach(s => {
                (s.a || '').split(' / ').forEach(artist => {
                    if (grouped[artist]) grouped[artist].push(s);
                });
            });

            lazySongGroups = {};
            let html = '';
            top.forEach(({ name, count }) => {
                html += lazyPlaylistSectionHTML(escapeHtml(name), grouped[name] || [], 'artist:' + name, 0, count);
            });
            body.innerHTML = html;
        }

        // 折叠 / 展开整个 section（用于 Deep Cooking 的 迷思 / 菜谱）
        function toggleSection(headingEl) {
            const section = headingEl.closest('.collapsible-section');
            if (!section) return;
            const open = section.classList.toggle('open');
            headingEl.setAttribute('aria-expanded', String(open));
        }

        // 切换歌单显示/隐藏
        function togglePlaylist(element) {
            const content = element.nextElementSibling;
            const isOpen = content.classList.contains('open');

            // 关闭所有其他歌单
            document.querySelectorAll('.playlist-content').forEach(el => {
                el.classList.remove('open');
            });
            document.querySelectorAll('.playlist-title[aria-expanded="true"]').forEach(t => {
                t.setAttribute('aria-expanded', 'false');
            });

            // 切换当前歌单
            if (!isOpen) {
                content.classList.add('open');
                element.setAttribute('aria-expanded', 'true');
                // 懒加载 iframe：第一次打开时把 data-src 写入 src
                const ifr = content.querySelector('iframe[data-src]');
                if (ifr) {
                    ifr.src = ifr.getAttribute('data-src');
                    ifr.removeAttribute('data-src');
                }
                // 懒渲染歌曲列表：第一次打开时才注入 <li>
                const lazyUl = content.querySelector('ul[data-lazy-key]');
                if (lazyUl) {
                    const group = lazySongGroups[lazyUl.dataset.lazyKey];
                    if (group) lazyUl.innerHTML = songListItemsHTML(group.list, group.cap);
                    lazyUl.removeAttribute('data-lazy-key');
                }
            }
        }

        // 每页对应的文档标题
        const pageTitles = {
            kazhi: '咔滋的森林',
            say: '咔言咔语 · 咔滋的森林',
            cooking: 'Deep Cooking · 咔滋的森林',
            listening: 'Deep Listening · 咔滋的森林',
            quarters: 'PhD Quarters · 咔滋的森林'
        };

        // 首页微博数据：优先取瘦身版（约 300KB，只含 createdAt/text），
        // 缺失时回退到两个全量文件（约 2MB）
        function fetchHomeWeibo() {
            return fetchJSON('data/weibo-slim.json').catch(() =>
                Promise.all([
                    fetchJSON('data/weibo.json'),
                    fetchJSON('data/weibo2.json')
                ]).then(([d1, d2]) => ({ weibo: [...(d1.weibo || []), ...(d2.weibo || [])] }))
            );
        }

        // 实际部署时使用的fetch函数 - 支持从JSON文件读取
        function loadPageWithFetch(pageName) {
            const myToken = ++navToken;
            const content = document.getElementById('content');

            // 更新导航激活状态
            document.querySelectorAll('#navbar button').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-page') === pageName);
            });
            document.title = pageTitles[pageName] || pageTitles.kazhi;

            content.style.opacity = '0';

            const showError = (error) => {
                if (myToken !== navToken) return;
                console.error('Error loading page:', error);
                content.innerHTML = '<p class="error">页面加载失败</p>';
                content.style.opacity = '1';
            };
            const fadeIn = () => {
                setTimeout(() => {
                    if (myToken === navToken) content.style.opacity = '1';
                }, 50);
            };

            // 特殊处理 kazhi 页面 — 现在是 Field Guide 首页：weibo + quarters 并行
            if (pageName === 'kazhi') {
                Promise.all([
                    fetchHomeWeibo(),
                    // quarters 单独 catch：缺失时降级到旧版 renderKazhi（不让首页彻底白屏）
                    fetchJSON('data/quarters.json').catch(() => null)
                ])
                .then(([wbData, qData]) => {
                    if (myToken !== navToken) return; // 期间用户已切到其他页
                    if (qData && Array.isArray(qData.quarters) && qData.quarters.length > 0) {
                        renderFieldGuideHome(wbData, qData);
                    } else {
                        // 降级：维持原行为
                        renderKazhi(wbData);
                    }
                    fadeIn();
                })
                .catch(showError);
                return; // 提前返回，避免执行后面的通用逻辑
            }

            // 其他页面的通用处理
            // say 页面读 columns.json（9 宫格 = 专栏 hub）
            const fileMap = { say: 'columns.json' };
            const dataFile = fileMap[pageName] || `${pageName}.json`;

            fetchJSON(`data/${dataFile}`)
                .then(data => {
                    if (myToken !== navToken) return;
                    if (pageName === 'say') {
                        renderSayGrid(data); // 9 宫格 = 专栏 hub
                    } else if (pageName === 'cooking') {
                        renderCooking(data);
                    } else if (pageName === 'listening') {
                        renderListening(data);
                    } else if (pageName === 'quarters') {
                        renderQuarters(data);
                    }
                    fadeIn();
                })
                .catch(showError);
        }
        // 初始化
        document.addEventListener('DOMContentLoaded', function() {
            // 绑定导航点击事件
            document.querySelectorAll('#navbar button').forEach(item => {
                item.onclick = () => {
                    loadPageWithFetch(item.getAttribute('data-page'));
                };
            });

            // 默认加载咔滋页面
            loadPageWithFetch('kazhi');

            // 点击遮罩关闭详情弹窗
            document.getElementById('detailOverlay').addEventListener('click', function(e) {
                if (e.target === this) {
                    closeDetail();
                }
            });

            // ESC 关闭弹窗 + Tab 焦点圈定在弹窗内
            document.addEventListener('keydown', function(e) {
                const overlay = document.getElementById('detailOverlay');
                const overlayActive = overlay.classList.contains('active');
                if (e.key === 'Escape' && overlayActive) {
                    closeDetail();
                    return;
                }
                if (e.key === 'Tab' && overlayActive) {
                    const focusables = overlay.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])');
                    if (focusables.length === 0) return;
                    const first = focusables[0];
                    const last = focusables[focusables.length - 1];
                    if (e.shiftKey && document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    } else if (!e.shiftKey && document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            });

            // 键盘激活自定义 role=button 控件（卡片 / essay 标题 / 歌单标题等
            // 动态渲染的可点击元素），Enter / Space 等价于点击
            document.addEventListener('keydown', function(e) {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const t = e.target;
                if (t instanceof HTMLElement && t.getAttribute('role') === 'button' && t.tagName !== 'BUTTON') {
                    e.preventDefault();
                    t.click();
                }
            });
        });
