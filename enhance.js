/* =============================================================================
   编辑式增强层（不动现有渲染逻辑）
   模块：reveal / cursor / hover-preview / page transitions / lenis / accordion
   加载方式：<script src="enhance.js" defer> 放在 <head> 内（详见 index.html）
   ============================================================================= */

(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer  = window.matchMedia('(pointer: fine)').matches;
    const isTouch      = ('ontouchstart' in window) || window.matchMedia('(pointer: coarse)').matches;
    const enableMotion = !reduceMotion;
    const enableCursor = enableMotion && finePointer && !isTouch;

    // ---------- Motion runtime (Phase 3) ----------
    // One motionState object shared across cursor / hover-preview / lenis / future
    // line field. One requestAnimationFrame loop drives all per-frame updates;
    // modules register a ticker via addMotionTicker(fn).
    const motionState = {
        pointer: {
            // raw target — set by global mousemove
            targetX: window.innerWidth / 2,
            targetY: window.innerHeight / 2,
            // smoothed (lerp 0.18) — used by cursor ring / hover preview
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            // fast-smoothed (lerp 0.45) — used by cursor dot
            dx: window.innerWidth / 2,
            dy: window.innerHeight / 2,
            // per-frame velocity of raw target
            vx: 0,
            vy: 0
        },
        scroll: { y: 0, vy: 0 },
        currentPage: null,         // set by wrapPageTransitions
        activeHoverTarget: null    // last .card / .essay-entry under pointer
    };

    const motionTickers = [];
    function addMotionTicker(fn) {
        if (typeof fn === 'function') motionTickers.push(fn);
    }

    // Single global mousemove listener feeds the runtime. Always tracks pointer
    // even when cursor is disabled (touch / reduced motion) so future code can
    // still read motionState.pointer if it wants to. Clamp to viewport so
    // downstream painters that normalize pointer.x/y to [-0.5, 0.5] don't
    // overshoot during edge-exit (codex Phase 4 review).
    window.addEventListener('mousemove', (e) => {
        const w = window.innerWidth, h = window.innerHeight;
        const x = e.clientX, y = e.clientY;
        motionState.pointer.targetX = x < 0 ? 0 : (x > w ? w : x);
        motionState.pointer.targetY = y < 0 ? 0 : (y > h ? h : y);
    });

    let motionLoopStarted = false;
    let lastTx = motionState.pointer.targetX;
    let lastTy = motionState.pointer.targetY;
    let lastScrollY = (typeof window.scrollY === 'number') ? window.scrollY : 0;

    function motionFrame(t) {
        // pointer velocity (raw, no smoothing)
        const ptr = motionState.pointer;
        ptr.vx = ptr.targetX - lastTx;
        ptr.vy = ptr.targetY - lastTy;
        lastTx = ptr.targetX;
        lastTy = ptr.targetY;

        // smoothed pointer (slow ring + fast dot)
        ptr.x  += (ptr.targetX - ptr.x)  * 0.18;
        ptr.y  += (ptr.targetY - ptr.y)  * 0.18;
        ptr.dx += (ptr.targetX - ptr.dx) * 0.45;
        ptr.dy += (ptr.targetY - ptr.dy) * 0.45;

        // Lenis tick first — must run BEFORE we sample scroll, otherwise tickers
        // see last frame's scroll position (caught in Phase 3 codex review).
        if (lenisInstance && typeof lenisInstance.raf === 'function') {
            lenisInstance.raf(t);
        }

        // Scroll position + velocity (reflects the just-applied Lenis update;
        // falls back to native window.scrollY when Lenis is disabled).
        const sy = lenisInstance && typeof lenisInstance.scroll === 'number'
            ? lenisInstance.scroll
            : (window.scrollY || 0);
        motionState.scroll.vy = sy - lastScrollY;
        motionState.scroll.y  = sy;
        lastScrollY = sy;

        // All registered tickers run in registration order
        for (let i = 0; i < motionTickers.length; i++) {
            try { motionTickers[i](motionState, t); }
            catch (err) { console.warn('motionTicker error:', err); }
        }

        requestAnimationFrame(motionFrame);
    }

    function startMotionLoop() {
        if (motionLoopStarted) return;
        motionLoopStarted = true;
        requestAnimationFrame(motionFrame);
    }

    // ---------- Smooth scroll (Lenis) ----------
    // Init only — Lenis's raf is now driven by motionFrame above.
    let lenisInstance = null;
    function initSmoothScroll() {
        if (!enableMotion || isTouch) return;
        if (typeof window.Lenis !== 'function') return;
        try {
            lenisInstance = new window.Lenis({
                lerp: 0.1,
                smoothWheel: true,
                smoothTouch: false
            });
            // Expose for inline scripts that want to use lenis.scrollTo (e.g. the
            // Field Guide "Timeline" button); they fall back to scrollIntoView
            // when this is null. Single additive line; keeps IIFE encapsulation
            // intact for everything else.
            window.lenis = lenisInstance;
        } catch (e) {
            console.warn('Lenis init failed:', e);
        }
    }

    // ---------- Reveal-on-scroll ----------
    let revealObserver = null;
    function ensureRevealObserver() {
        if (revealObserver || !('IntersectionObserver' in window)) return revealObserver;
        revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
        return revealObserver;
    }

    const REVEAL_TARGETS = '.card, .essay-entry, .song-item, .chart-row, .recipe-category, .wishlist li, .playlist-section, .profile-stat, .profile-block, .philosophy, .section-heading';

    function applyRevealTo(scope) {
        if (!enableMotion) return;
        const obs = ensureRevealObserver();
        if (!obs) return;
        const root = scope || document;
        const targets = root.querySelectorAll(REVEAL_TARGETS);
        // Group siblings so we can stagger by sibling index
        const counters = new WeakMap();
        targets.forEach(el => {
            if (el.classList.contains('reveal')) return;
            el.classList.add('reveal');
            const parent = el.parentElement;
            const i = counters.get(parent) || 0;
            counters.set(parent, i + 1);
            el.style.setProperty('--reveal-i', Math.min(i, 12));
            obs.observe(el);
        });
    }

    // ---------- Custom cursor ----------
    // mousemove / lerp now driven by motionState; this module only mounts DOM listeners
    // for visibility (mouseleave / enter / mouseout) and hover-state inference, and
    // registers a ticker that writes ptr.dx/dy/x/y → cursor element transforms.
    function initCursor() {
        if (!enableCursor) return;
        const cursor = document.querySelector('.cursor');
        if (!cursor) return;
        const dot   = cursor.querySelector('.cursor__dot');
        const ring  = cursor.querySelector('.cursor__ring');
        const label = cursor.querySelector('.cursor__label');
        if (!dot || !ring || !label) return;

        document.body.classList.add('has-custom-cursor');

        // Visibility: hide when pointer leaves the document, show on re-entry.
        // We can't gate on mousemove anymore (that's at top level), so a separate
        // listener flips is-hidden when the pointer is near the document edge.
        window.addEventListener('mouseout', (e) => {
            if (!e.relatedTarget && !e.toElement) cursor.classList.add('is-hidden');
        });
        document.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'));
        document.addEventListener('mouseenter', () => cursor.classList.remove('is-hidden'));
        window.addEventListener('mousemove', () => cursor.classList.remove('is-hidden'));

        // Per-frame transforms read from motionState. Label position depends on
        // mode: project mode places the chip at the cursor center (replaces the
        // dot/ring); link mode floats it above the ring so the underlying target
        // (a nav span, a button) stays readable. labelOffsetY is lerped so the
        // chip glides into its new position while the ring morphs (codex Phase 6
        // review caught the previous instant-snap).
        let labelOffsetY = 0;
        addMotionTicker((s) => {
            const p = s.pointer;
            dot.style.transform   = `translate(${p.dx}px, ${p.dy}px) translate(-50%, -50%)`;
            ring.style.transform  = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
            const isProj = cursor.classList.contains('is-project');
            const target = isProj ? 0 : -40;
            labelOffsetY += (target - labelOffsetY) * 0.18;
            label.style.transform = `translate(${p.x}px, ${p.y + labelOffsetY}px) translate(-50%, -50%)`;
        });

        // ---- Phase 6: cursor label resolver ----
        // Selector → { label, mode } table. Order matters: more specific first.
        // mode === 'project' uses the heavy ink ring + centered chip;
        // mode === 'link' uses the lighter ring + floating chip above.
        // Elements may also carry [data-cursor-label] / [data-cursor-mode] to
        // override or opt-in without matching a selector below.
        const CURSOR_LABEL_RULES = [
            { sel: '.read-full',                       label: 'Read',  mode: 'link' },
            { sel: '.breadcrumb',                      label: 'Back',  mode: 'link' },
            { sel: '.close-btn',                       label: 'Close', mode: 'link' },
            { sel: '.lt-tab',                          label: 'View',  mode: 'link' },
            { sel: '.playlist-title',                  label: 'Play',  mode: 'link' },
            { sel: '#navbar span',                     label: 'Go',    mode: 'link' },
            // Project-mode (heavy filled ring + label replaces cursor body)
            { sel: '.recipes-section .essay-entry',    label: 'Cook',  mode: 'project' },
            { sel: '.essay-entry[data-source="recipe"]', label: 'Cook', mode: 'project' },
            { sel: '.essay-entry',                     label: 'Read',  mode: 'project' },
            { sel: '.card:not(.empty-card)',           label: 'Open',  mode: 'project' }
        ];

        function resolveCursorTarget(t) {
            if (!(t instanceof Element)) return null;
            // Explicit data-cursor-label wins
            const labeled = t.closest('[data-cursor-label]');
            if (labeled) {
                const explicitMode = labeled.getAttribute('data-cursor-mode');
                return {
                    target: labeled,
                    label: labeled.getAttribute('data-cursor-label') || 'View',
                    mode:  (explicitMode === 'project') ? 'project' : 'link'
                };
            }
            for (const rule of CURSOR_LABEL_RULES) {
                const found = t.closest(rule.sel);
                if (found) return { target: found, label: rule.label, mode: rule.mode };
            }
            return null;
        }

        document.addEventListener('mouseover', (e) => {
            const r = resolveCursorTarget(e.target);
            if (r) {
                if (r.mode === 'project') {
                    cursor.classList.add('is-project');
                    cursor.classList.remove('is-link');
                    motionState.activeHoverTarget = r.target;
                } else {
                    cursor.classList.add('is-link');
                    cursor.classList.remove('is-project');
                    motionState.activeHoverTarget = null;
                }
                cursor.classList.add('has-label');
                label.textContent = r.label;
            } else {
                cursor.classList.remove('is-link', 'is-project', 'has-label');
                motionState.activeHoverTarget = null;
            }
        });
    }

    // ---------- Hover preview (Phase 7 upgrade) ----------
    // Visual specimen card: deterministic SVG line-art per item id, follows
    // pointer with viewport clamping, and adds velocity-driven rotateX/rotateY
    // tilt (lerped). Image hook reserved for future JSON image support.
    function initHoverPreview() {
        if (!enableCursor) return;
        const preview = document.querySelector('.hover-preview');
        if (!preview) return;
        const art   = preview.querySelector('.hover-preview__art');
        const title = preview.querySelector('.hover-preview__title');
        const meta  = preview.querySelector('.hover-preview__meta');
        if (!art || !title || !meta) return;

        const PROJECT_SEL = '.card:not(.empty-card), .essay-entry';

        // Deterministic hash → seed
        function hashStr(s) {
            let h = 5381;
            for (let i = 0; i < (s || '').length; i++) {
                h = ((h << 5) + h) + s.charCodeAt(i);
                h = h & h;
            }
            return Math.abs(h) >>> 0;
        }

        // Mulberry32: small, deterministic, ~uniform [0,1) PRNG
        function mulberry32(seed) {
            let t = seed >>> 0;
            return function () {
                t = (t + 0x6D2B79F5) | 0;
                let x = Math.imul(t ^ (t >>> 15), 1 | t);
                x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
                return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
            };
        }

        // Palette indices keep the line-art muted; alpha kept low so the
        // grain overlay (.hover-preview__art::after) and paper bg show through.
        const STROKE = ['rgba(26,26,20,0.18)', 'rgba(168,90,58,0.18)', 'rgba(91,107,74,0.18)'];

        // 4 visual genres in a 100×100 coordinate space (viewBox below). The art
        // slot is wider than tall (~240×220), so we use 'slice' for full-bleed;
        // a square viewBox keeps crops minimal vs the original 100×130 viewBox
        // which lost ~46px top+bottom (codex Phase 7 review).
        const GENERATORS = [
            // Concentric arcs
            function (rng) {
                const cx = 30 + rng() * 40;
                const cy = 30 + rng() * 40;
                const stroke = STROKE[Math.floor(rng() * STROKE.length)];
                const count = 5 + Math.floor(rng() * 4);
                let out = '';
                for (let i = 0; i < count; i++) {
                    const r = 12 + i * (10 + rng() * 4);
                    out += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" stroke="${stroke}" fill="none" stroke-width="0.55"/>`;
                }
                return out;
            },
            // Diagonal cross-hatch
            function (rng) {
                const stroke = STROKE[Math.floor(rng() * STROKE.length)];
                let out = '';
                for (let i = 0; i < 14; i++) {
                    const offset = i * 10 + rng() * 4;
                    out += `<line x1="${offset.toFixed(2)}" y1="0" x2="${(offset - 100).toFixed(2)}" y2="100" stroke="${stroke}" stroke-width="0.5"/>`;
                }
                return out;
            },
            // Sine-wave field
            function (rng) {
                const stroke = STROKE[Math.floor(rng() * STROKE.length)];
                let out = '';
                for (let i = 0; i < 5; i++) {
                    const baseY = 14 + i * 17 + rng() * 4;
                    const amp = 4 + rng() * 5;
                    const phase = rng() * 6.28;
                    let path = `M 0 ${baseY.toFixed(2)}`;
                    for (let x = 5; x <= 100; x += 5) {
                        const y = baseY + Math.sin(x * 0.06 + phase) * amp;
                        path += ` L ${x} ${y.toFixed(2)}`;
                    }
                    out += `<path d="${path}" stroke="${stroke}" fill="none" stroke-width="0.55"/>`;
                }
                return out;
            },
            // Hairline stack — uneven horizontal lines
            function (rng) {
                const stroke = STROKE[Math.floor(rng() * STROKE.length)];
                const count = 8 + Math.floor(rng() * 4);
                let out = '';
                for (let i = 0; i < count; i++) {
                    const y = (i / count) * 100 + rng() * 3;
                    const x1 = rng() * 30;
                    const x2 = 100 - rng() * 30;
                    out += `<line x1="${x1.toFixed(2)}" y1="${y.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y.toFixed(2)}" stroke="${stroke}" stroke-width="0.5"/>`;
                }
                return out;
            }
        ];

        function generateArt(idStr) {
            const seed = hashStr(idStr);
            const rng  = mulberry32(seed);
            rng(); rng();
            const genre = GENERATORS[seed % GENERATORS.length];
            return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">${genre(rng)}</svg>`;
        }

        let active = false;
        let currentTarget = null;   // (codex Phase 7 review) skip re-runs when
                                    // mouseover bubbles within the same item

        function show(target) {
            if (target === currentTarget) {
                preview.classList.add('is-active');
                active = true;
                return;
            }
            currentTarget = target;
            const id      = target.getAttribute('data-id') || target.getAttribute('data-column') || target.textContent.slice(0, 24);
            const titleEl = target.querySelector('.essay-title, .card-title');
            const tagEl   = target.querySelector('.essay-tag, .card-description');
            title.textContent = titleEl ? titleEl.textContent.trim() : '';
            meta.textContent  = tagEl   ? tagEl.textContent.trim()   : '';
            const imgUrl = target.getAttribute('data-image');
            if (imgUrl) {
                art.innerHTML = '';
                art.style.backgroundImage    = `url("${imgUrl}")`;
                art.style.backgroundSize     = 'cover';
                art.style.backgroundPosition = 'center';
            } else {
                art.style.backgroundImage = '';
                art.innerHTML = generateArt(String(id));
            }
            preview.classList.add('is-active');
            active = true;
        }
        function hide() {
            preview.classList.remove('is-active');
            active = false;
            currentTarget = null;
        }

        document.addEventListener('mouseover', (e) => {
            const t = e.target instanceof Element ? e.target.closest(PROJECT_SEL) : null;
            if (t) show(t);
        });
        document.addEventListener('mouseout', (e) => {
            const from = e.target instanceof Element ? e.target.closest(PROJECT_SEL) : null;
            const to   = e.relatedTarget instanceof Element ? e.relatedTarget.closest(PROJECT_SEL) : null;
            if (from && from !== to) hide();
        });

        // Per-frame transform: pointer (smoothed) + 24px down-right, viewport-clamped,
        // velocity-driven rotateX/rotateY tilt (lerped) wrapped in perspective().
        // ROT_GAIN tuned down from 0.45 → 0.15 so rotation reads as subtle
        // rather than instantly pinning at the clamp on normal desktop motion
        // (codex Phase 7 review).
        const ROT_GAIN     = 0.15;     // velocity (px/frame) → degrees
        const ROT_MAX      = 8;        // hard clamp ±8°
        const ROT_LERP     = 0.18;
        const PERSPECTIVE  = 900;
        let rotX = 0, rotY = 0;
        addMotionTicker((s) => {
            const w = preview.offsetWidth  || 240;
            const h = preview.offsetHeight || 320;
            const x  = s.pointer.x + 24;
            const y  = s.pointer.y + 24;
            const cx = Math.min(Math.max(0, x), window.innerWidth  - w - 8);
            const cy = Math.min(Math.max(0, y), window.innerHeight - h - 8);

            const tx = Math.max(-ROT_MAX, Math.min(ROT_MAX,  s.pointer.vx * ROT_GAIN));
            const ty = Math.max(-ROT_MAX, Math.min(ROT_MAX, -s.pointer.vy * ROT_GAIN));
            rotY += (tx - rotY) * ROT_LERP;
            rotX += (ty - rotX) * ROT_LERP;

            const scale = active ? 1 : 0.96;
            preview.style.transform =
                `perspective(${PERSPECTIVE}px) translate3d(${cx}px, ${cy}px, 0) ` +
                `rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) ` +
                `scale(${scale})`;
        });
    }

    // ---------- Scene layer (Phase 4) ----------
    // Animated background canvas that varies per body[data-page]. Static grain +
    // vignette are CSS-only siblings (see style.css § 4.5). The canvas is painted
    // each frame by a motion ticker; reduced-motion hides it via CSS.
    function initSceneLayer() {
        if (!enableMotion) return; // ticker skipped; CSS also hides canvas
        const canvas = document.querySelector('.scene-canvas');
        if (!canvas || typeof canvas.getContext !== 'function') return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let w = 0, h = 0, dpr = 1;
        function resize() {
            dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
            const rect = canvas.parentElement.getBoundingClientRect();
            w = Math.max(1, Math.floor(rect.width));
            h = Math.max(1, Math.floor(rect.height));
            canvas.width  = Math.floor(w * dpr);
            canvas.height = Math.floor(h * dpr);
            canvas.style.width  = w + 'px';
            canvas.style.height = h + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resize();
        window.addEventListener('resize', resize);

        // Per-page painters. Each receives (ctx, w, h, t [ms], motionState).
        // All draw in the local logical pixel space (DPR is baked into transform).
        const PAINTERS = {
            kazhi: (ctx, w, h, t, ms) => {
                // Quiet memory: 5 sparse horizontal hairlines drifting with pointer.y
                ctx.strokeStyle = 'rgba(26, 26, 20, 0.10)';
                ctx.lineWidth = 1;
                const py = (ms.pointer.y / Math.max(1, h)) - 0.5; // -0.5 .. 0.5
                for (let i = 0; i < 5; i++) {
                    const baseY = ((i + 0.5) / 5) * h;
                    const drift = Math.sin(t * 0.00018 + i * 1.4) * 9 + py * 14;
                    ctx.beginPath();
                    ctx.moveTo(0, baseY + drift);
                    ctx.lineTo(w, baseY + drift);
                    ctx.stroke();
                }
            },
            say: (ctx, w, h, t, ms) => {
                // Archive grid: 12 verticals + 8 horizontals, slight pointer offset
                ctx.strokeStyle = 'rgba(26, 26, 20, 0.07)';
                ctx.lineWidth = 0.5;
                const px = (ms.pointer.x / Math.max(1, w)) - 0.5;
                const py = (ms.pointer.y / Math.max(1, h)) - 0.5;
                const ox = px * 6;
                const oy = py * 6;
                for (let i = 0; i <= 12; i++) {
                    const x = (i / 12) * w + ox;
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
                }
                for (let i = 0; i <= 8; i++) {
                    const y = (i / 8) * h + oy;
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
                }
            },
            cooking: (ctx, w, h, t, ms) => {
                // Organic warm curves: 4 sine-of-sine lines in muted ochre
                ctx.strokeStyle = 'rgba(168, 90, 58, 0.10)';
                ctx.lineWidth = 1;
                const px = (ms.pointer.x / Math.max(1, w)) - 0.5;
                for (let i = 0; i < 4; i++) {
                    const baseY = ((i + 0.5) / 4) * h;
                    const phase = t * 0.00026 + i * 0.7;
                    const amp = 14 + Math.sin(phase * 0.9) * 5;
                    ctx.beginPath();
                    for (let x = 0; x <= w; x += 14) {
                        const y = baseY
                            + Math.sin(x * 0.0042 + phase) * amp
                            + Math.sin(x * 0.011 + phase * 1.3) * 4
                            + px * 8;
                        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }
            },
            listening: (ctx, w, h, t, ms) => {
                // Sine waves with rhythm; amplitude reacts to scroll velocity
                ctx.strokeStyle = 'rgba(26, 26, 20, 0.09)';
                ctx.lineWidth = 1;
                const vy = Math.min(Math.abs(ms.scroll.vy), 60);
                const ampBoost = 1 + vy * 0.03;
                for (let i = 0; i < 4; i++) {
                    const baseY = ((i + 0.5) / 4) * h;
                    const phase = t * 0.00045 - i * 0.55;
                    const baseAmp = 12 * ampBoost;
                    ctx.beginPath();
                    for (let x = 0; x <= w; x += 8) {
                        const y = baseY + Math.sin(x * 0.008 + phase) * baseAmp;
                        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }
            }
        };

        addMotionTicker((ms, t) => {
            ctx.clearRect(0, 0, w, h);
            const fn = ms.currentPage && PAINTERS[ms.currentPage];
            if (fn) fn(ctx, w, h, t, ms);
        });
    }

    // ---------- Page transition wrapper ----------
    // Three robustness fixes vs prior version:
    //   (a) MutationObserver on #content so post-render hooks fire when the new DOM
    //       actually lands (handles slow fetch).
    //   (b) Monotonic navId so stale 760ms cleanup from an older nav cannot remove
    //       .is-entering on a newer one (rapid-click race).
    //   (c) subtree:true observer so secondary render paths (switchListeningTab,
    //       renderColumnView, backToHub, etc.) also get accordion / playlist
    //       handlers attached without touching the original render functions.
    //       Top-level mutations on #content still drive the nav transition flow;
    //       deeper subtree mutations only run idempotent attachers on added nodes.
    //   (d) Defensive: if #content itself is ever replaced, rebind the observer.
    function wrapPageTransitions() {
        if (typeof window.loadPageWithFetch !== 'function') return;
        const original = window.loadPageWithFetch;
        const supportsMO = ('MutationObserver' in window);

        let navId = 0;
        let pendingNavId = 0;
        let pendingPageName = null;   // Phase 4: remember page name to commit on render
        let pageObserver = null;
        let observedContent = null;

        function onPageRendered(content, myNavId, pageName) {
            if (myNavId !== pendingNavId) return;
            pendingNavId = 0;
            // Phase 4 (codex review): commit page identity ONLY when the new DOM
            // has actually landed. Doing this before original.apply meant the
            // scene/painter switched while old content was still fading out,
            // and on fetch failure the scene committed to a page that never
            // rendered. With pendingNavId-gating above, we also skip stale navs.
            if (pageName) {
                motionState.currentPage = pageName;
                if (document.body) document.body.dataset.page = pageName;
            }
            if (enableMotion) {
                content.classList.remove('is-leaving');
                content.classList.add('is-entering');
                setTimeout(() => {
                    if (myNavId === navId) {
                        content.classList.remove('is-entering');
                    }
                }, 760);
            }
            applyRevealTo(content);
            attachPlaylistOpenMirror(content);
            attachAccordionMeasure(content);
            initKineticType(content);
            // applyContentPolish() is intentionally NOT called here; the
            // observer callback runs it once per mutation batch (Phase 8 codex
            // review noted that calling it both here and in attachToAddedNodes
            // produced redundant passes per nav).
        }

        function attachToAddedNodes(addedNodes) {
            for (const node of addedNodes) {
                if (!node || node.nodeType !== 1) continue;
                attachPlaylistOpenMirror(node);
                attachAccordionMeasure(node);
                initKineticType(node);
            }
        }

        function ensureObserver(content) {
            if (!supportsMO) return;
            if (pageObserver && observedContent === content) return;
            if (pageObserver) {
                pageObserver.disconnect();
                pageObserver = null;
            }
            observedContent = content;
            pageObserver = new MutationObserver((mutations) => {
                let topLevelMutated = false;
                let polishNeeded = false;
                for (const m of mutations) {
                    if (m.target === content) topLevelMutated = true;
                    if (m.addedNodes && m.addedNodes.length) {
                        polishNeeded = true;
                        attachToAddedNodes(m.addedNodes);
                    }
                }
                if (topLevelMutated && pendingNavId) {
                    onPageRendered(content, pendingNavId, pendingPageName);
                }
                // Single polish call per mutation batch — covers nav-driven and
                // secondary render paths (switchListeningTab, renderColumnView)
                // without the per-mutation duplication codex Phase 8 caught.
                if (polishNeeded) applyContentPolish();
            });
            pageObserver.observe(content, { childList: true, subtree: true });
        }

        window.loadPageWithFetch = function (pageName) {
            const content = document.getElementById('content');
            if (content) {
                ensureObserver(content);
                navId++;
                pendingNavId = navId;
                // Phase 4: remember target page; only commit it (motionState.currentPage
                // + body.dataset.page) when the new DOM actually lands in onPageRendered.
                // Old behavior committed before fetch resolved, which made the scene
                // switch while old content was still on screen and stuck on fetch failure.
                pendingPageName = pageName || null;
                if (enableMotion) {
                    content.classList.remove('is-entering');
                    content.classList.add('is-leaving');
                }
            }
            const myNavId = navId;
            const myPage  = pageName || null;
            const result = original.apply(this, arguments);
            if (content && !supportsMO) {
                // No MutationObserver → call polish from the same setTimeout that
                // commits the render hooks, so the no-MO fallback still gets it.
                setTimeout(() => {
                    onPageRendered(content, myNavId, myPage);
                    applyContentPolish();
                }, 380);
            }
            return result;
        };
    }

    // ---------- Accordion measurement ----------
    // Replace the fixed-cap CSS max-height (essay 1600px, playlist 100000px) with the
    // actual scrollHeight measured at toggle time, so long entries don't clip and
    // the height-transition matches real content. Watches the .open class on each
    // .essay-entry / .playlist-content.
    function attachAccordionMeasure(scope) {
        if (!('MutationObserver' in window)) return;
        const root = scope || document;

        // .essay-entry — body lives in a child .essay-body; .open toggled on entry
        root.querySelectorAll('.essay-entry').forEach(entry => {
            if (entry.__amOk) return;
            entry.__amOk = true;
            const body = entry.querySelector('.essay-body');
            if (!body) return;
            const sync = () => {
                if (entry.classList.contains('open')) {
                    body.style.maxHeight = body.scrollHeight + 'px';
                } else {
                    body.style.maxHeight = '';
                }
            };
            new MutationObserver(sync).observe(entry, {
                attributes: true, attributeFilter: ['class']
            });
        });

        // .playlist-content — .open toggled on the body itself
        root.querySelectorAll('.playlist-content').forEach(body => {
            if (body.__amOk) return;
            body.__amOk = true;
            const sync = () => {
                if (body.classList.contains('open')) {
                    body.style.maxHeight = body.scrollHeight + 'px';
                } else {
                    body.style.maxHeight = '';
                }
            };
            new MutationObserver(sync).observe(body, {
                attributes: true, attributeFilter: ['class']
            });
        });
    }

    // Mirror `.playlist-content.open` onto its parent `.playlist-section.is-open`.
    // This is a no-modify fallback for browsers without CSS :has().
    function attachPlaylistOpenMirror(scope) {
        if (!('MutationObserver' in window)) return;
        const root = scope || document;
        root.querySelectorAll('.playlist-content').forEach(el => {
            if (el.__poMirror) return;
            el.__poMirror = true;
            const sync = () => {
                const section = el.closest('.playlist-section');
                if (section) section.classList.toggle('is-open', el.classList.contains('open'));
            };
            sync();
            new MutationObserver(sync).observe(el, { attributes: true, attributeFilter: ['class'] });
        });
    }

    // ---------- Kinetic typography (Phase 5) ----------
    // Per-character mask reveal for major headings. We walk text nodes inside
    // .kazhi-text / .column-title / .section-heading and replace each character
    // with <span class="kt-mask"><span class="kt-inner">字</span></span>. Element
    // children (e.g. .toggle-icon inside cooking's section-heading) are kept in
    // place — we only split text nodes, never blow away child elements.
    let kineticObserver = null;
    function ensureKineticObserver() {
        if (kineticObserver || !('IntersectionObserver' in window)) return kineticObserver;
        kineticObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-typed');
                    kineticObserver.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
        return kineticObserver;
    }

    const KINETIC_TARGETS = '.kazhi-text, .column-title, .section-heading';

    function splitElementText(el) {
        // Walk childNodes; convert text nodes to kt-mask spans, keep element
        // children (e.g. .toggle-icon) in place. Contiguous text-derived spans
        // are wrapped in a single <span class="kt-run"> so that a flex parent
        // (e.g. .section-heading.toggle-section with space-between) still sees
        // a single text-run + the trailing icon, not N separate flex items
        // (codex Phase 5 review caught this).
        let counter = 0;
        const newKids = [];
        let currentRun = [];

        function flushRun() {
            if (currentRun.length === 0) return;
            const run = document.createElement('span');
            run.className = 'kt-run';
            currentRun.forEach(n => run.appendChild(n));
            newKids.push(run);
            currentRun = [];
        }

        for (const node of Array.from(el.childNodes)) {
            if (node.nodeType === 3) { // Text node
                const text = node.textContent;
                if (!text) continue;
                for (const ch of Array.from(text)) {
                    if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') {
                        currentRun.push(document.createTextNode(ch));
                        continue;
                    }
                    const mask = document.createElement('span');
                    mask.className = 'kt-mask';
                    const inner = document.createElement('span');
                    inner.className = 'kt-inner';
                    inner.style.setProperty('--kt-i', String(Math.min(counter, 60)));
                    inner.textContent = ch;
                    mask.appendChild(inner);
                    currentRun.push(mask);
                    counter++;
                }
            } else {
                // Element / comment / etc. — flush the current run first so the
                // element keeps its original position relative to surrounding text.
                flushRun();
                newKids.push(node);
            }
        }
        flushRun();

        while (el.firstChild) el.removeChild(el.firstChild);
        newKids.forEach(k => el.appendChild(k));
    }

    function initKineticType(scope) {
        if (!enableMotion) return;
        const obs = ensureKineticObserver();
        if (!obs) return;
        const root = scope || document;
        root.querySelectorAll(KINETIC_TARGETS).forEach(el => {
            if (el.__ktDone) return;
            el.__ktDone = true;
            // Skip if no text to split
            const hasText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
            if (!hasText) return;
            splitElementText(el);
            obs.observe(el);
        });
    }

    // ---------- Content polish (Phase 8) ----------
    // Inject lightweight editorial decorations without touching the JSON or any
    // render*() function. Idempotent via element flags. Always operates on the
    // whole document so that switchListeningTab swaps and other secondary
    // render paths still get their fresh sections numbered correctly.
    //   - say grid: "/ NN" archive count at top-right (pairs with the existing
    //     ::before counter "01" → reads "01 / 09" across the top edge)
    //   - cooking recipes: "NOTE NNN" experimental-notebook badge as flex-prefix
    //     in each .essay-header
    //   - listening: "VOL. NN" catalog prefix on every .playlist-section title
    //     (works for both the 12 curated playlists and the by-year/by-artist tabs)
    function applyContentPolish() {
        // Say 9-grid
        document.querySelectorAll('.grid-container').forEach(grid => {
            const cards = Array.from(grid.children).filter(el =>
                el.classList && el.classList.contains('card') && !el.classList.contains('empty-card')
            );
            const total = cards.length;
            const totalStr = String(total).padStart(2, '0');
            cards.forEach(card => {
                if (card.__cpArch) return;
                card.__cpArch = true;
                const chip = document.createElement('span');
                chip.className = 'cp-archive';
                chip.textContent = '/ ' + totalStr;
                card.appendChild(chip);
            });
        });

        // Cooking recipes
        document.querySelectorAll('.recipes-section .essay-entry').forEach((entry, i) => {
            if (entry.__cpNote) return;
            entry.__cpNote = true;
            const header = entry.querySelector('.essay-header');
            if (!header) return;
            const badge = document.createElement('span');
            badge.className = 'cp-note';
            badge.textContent = 'NOTE ' + String(i + 1).padStart(3, '0');
            header.insertBefore(badge, header.firstChild);
        });

        // Listening playlist sections (curated, by-year, by-artist all use the
        // same .playlist-section markup). Each tab swap brings fresh sections;
        // their __cpVol flag is fresh too, so numbering restarts at VOL. 01.
        document.querySelectorAll('.playlist-section').forEach((section, i) => {
            if (section.__cpVol) return;
            section.__cpVol = true;
            const title = section.querySelector('.playlist-title');
            if (!title) return;
            const prefix = document.createElement('span');
            prefix.className = 'cp-vol';
            prefix.textContent = 'VOL. ' + String(i + 1).padStart(2, '0');
            title.insertBefore(prefix, title.firstChild);
        });
    }

    // ---------- Bootstrap ----------
    // wrapPageTransitions runs at top level (before DOMContentLoaded), so the original
    // DOMContentLoaded handler in index.html — which calls loadPageWithFetch('kazhi')
    // for the initial page — already sees the wrapped function and the first transition
    // hooks fire correctly.
    wrapPageTransitions();

    document.addEventListener('DOMContentLoaded', () => {
        if (typeof window.Lenis === 'function') {
            initSmoothScroll();
        } else {
            window.addEventListener('load', initSmoothScroll, { once: true });
        }
        initCursor();
        initHoverPreview();
        initSceneLayer();
        // Single RAF drives Lenis + cursor + hover-preview + (future) line field.
        // Always start the loop — even with reduced motion / touch, scroll/page
        // tracking still updates motionState for later modules to read.
        startMotionLoop();
        // Reveal observer + playlist mirror + accordion measurement are all
        // re-attached after each page load by the wrapper; this initial pass
        // covers any static content that landed before the first navigation.
        requestAnimationFrame(() => {
            const content = document.getElementById('content');
            if (content) {
                applyRevealTo(content);
                attachPlaylistOpenMirror(content);
                attachAccordionMeasure(content);
                initKineticType(content);
                applyContentPolish();
            }
        });
    });
})();
