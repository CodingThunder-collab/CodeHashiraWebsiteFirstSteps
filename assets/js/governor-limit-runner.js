(function () {
    'use strict';

    /* ---------------- constants ---------------- */
    const W = 480;
    const H = 200;
    const GROUND = 172;
    const PIXEL_FONT = 'Silkscreen, "Courier New", monospace';
    const TIRED = 'System.LimitException: Dev too tired. Go home.';

    /*
     * Every governor limit / exception has its own look.
     * kind: ground = jump over, fly = duck under, tall = big jump.
     * at: seconds of play before it can appear.
     */
    const LIMITS = [
        { key: 'soql', name: 'SOQL 101', c: '#e2553f', kind: 'ground', w: 22, h: 30, at: 0, msg: 'System.LimitException: Too many SOQL queries: 101' },
        { key: 'dml', name: 'DML 151', c: '#c98a4b', kind: 'ground', w: 24, h: 24, at: 0, msg: 'System.LimitException: Too many DML statements: 151' },
        { key: 'rows', name: '50,001 rows', c: '#6f8cff', kind: 'ground', w: 46, h: 12, at: 0, msg: 'System.LimitException: Too many query rows: 50001' },
        { key: 'null', name: 'Null pointer', c: '#b8bfd9', kind: 'ground', w: 18, h: 20, at: 0, msg: 'System.NullPointerException: Attempt to de-reference a null object' },
        { key: 'heap', name: 'Heap 6 MB', c: '#a66bd6', kind: 'ground', w: 30, h: 18, at: 0, msg: 'System.LimitException: Apex heap size too large: 6291457' },
        { key: 'lock', name: 'Row lock', c: '#f4c542', kind: 'ground', w: 16, h: 22, at: 0, msg: 'UNABLE_TO_LOCK_ROW: unable to obtain exclusive access to this record' },
        { key: 'dup', name: 'Duplicate value', c: '#3fb6b0', kind: 'ground', w: 28, h: 14, at: 0, msg: 'DUPLICATE_VALUE: duplicate value found: External_Id__c' },
        { key: 'mixed', name: 'Mixed DML', c: '#ef8a3a', kind: 'ground', w: 22, h: 26, at: 10, msg: 'MIXED_DML_OPERATION: DML on setup object is not permitted after non-setup object' },
        { key: 'valid', name: 'Validation rule', c: '#d83b3b', kind: 'ground', w: 16, h: 32, at: 10, msg: 'FIELD_CUSTOM_VALIDATION_EXCEPTION: Close Date cannot be in the past' },
        { key: 'future', name: '@future 50', c: '#e6cf9a', kind: 'ground', w: 14, h: 24, at: 10, msg: 'System.LimitException: Too many future calls: 51' },
        { key: 'depth', name: 'Trigger depth 16', c: '#57c785', kind: 'ground', w: 18, h: 30, at: 10, msg: 'System.DmlException: Maximum trigger depth exceeded' },
        { key: 'cpu', name: 'CPU 10 s', c: '#f4c542', kind: 'fly', w: 40, h: 16, at: 20, msg: 'System.LimitException: Apex CPU time limit exceeded' },
        { key: 'callout', name: 'Callouts 100', c: '#8fd3ff', kind: 'fly', w: 30, h: 16, at: 20, msg: 'System.LimitException: Too many callouts: 101' },
        { key: 'email', name: 'Email 10', c: '#f2e6c9', kind: 'fly', w: 28, h: 14, at: 20, msg: 'SINGLE_EMAIL_LIMIT_EXCEEDED: Too many emails invoked: 11' },
        { key: 'sosl', name: 'SOSL 20', c: '#9be4c6', kind: 'fly', w: 28, h: 16, at: 30, msg: 'System.LimitException: Too many SOSL queries: 21' },
        { key: 'deploy', name: 'Deploy failed', c: '#b3263b', kind: 'tall', w: 14, h: 42, at: 45, msg: 'Deploy failed: Average test coverage across all Apex is 74%' },
        { key: 'dmlrows', name: 'DML rows 10,001', c: '#7b86b8', kind: 'tall', w: 18, h: 40, at: 45, msg: 'System.LimitException: Too many DML rows: 10001' },
        { key: 'queue', name: 'Queueable 50', c: '#e58fb8', kind: 'tall', w: 22, h: 38, at: 60, msg: 'System.LimitException: Too many queueable jobs added to the queue: 51' }
    ];
    const BY_KEY = Object.fromEntries(LIMITS.map((l) => [l.key, l]));

    const SPRINT_MSGS = {
        2: 'CPU limits incoming',
        3: 'Failed deploys ahead',
        4: 'Limits travel in pairs now',
        5: 'Release week',
        6: 'Hotfix Friday',
        7: 'Production is on fire'
    };

    /* Browser storage is optional: fall back silently if it is unavailable. */
    const STORE_PREFIX = 'governorLimitRunner:';
    const store = {
        get(key, fallback) {
            try {
                const v = window.localStorage.getItem(STORE_PREFIX + key);
                return v === null ? fallback : JSON.parse(v);
            } catch (e) {
                return fallback;
            }
        },
        set(key, value) {
            try {
                window.localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value));
            } catch (e) {
                // storage not available; keep in memory only
            }
        }
    };

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function makeSkyline(minH, maxH, minW, maxW) {
        const blocks = [];
        let x = 0;
        while (x < W * 2) {
            const w = minW + Math.random() * (maxW - minW);
            const h = minH + Math.random() * (maxH - minH);
            const wins = [];
            for (let wy = 6; wy < h - 6; wy += 9) {
                for (let wx = 4; wx < w - 4; wx += 8) {
                    if (Math.random() < 0.28) wins.push([wx, wy]);
                }
            }
            blocks.push({ x, w, h, wins });
            x += w + 2;
        }
        return { blocks, width: x };
    }

    class GovernorLimitRunner {
        constructor(root) {
            this.root = root;
            this.stage = root.querySelector('.glr-stage');
            this.canvas = root.querySelector('canvas');
            this.ctx = this.canvas.getContext('2d');
            this.ui = {};
            root.querySelectorAll('[data-ui]').forEach((el) => {
                this.ui[el.dataset.ui] = el;
            });

            this.rafId = null;
            this.lastTs = 0;
            this.lastHud = 0;
            this.overAt = 0;
            this.best = store.get('best', 0);
            this.seen = new Set(store.get('seen', []));
            this.stars = Array.from({ length: 40 }, () => ({
                x: Math.random() * W,
                y: Math.random() * 110,
                r: Math.random() < 0.2 ? 2 : 1
            }));
            this.far = makeSkyline(30, 70, 22, 40);
            this.near = makeSkyline(40, 90, 26, 48);
            this.loop = this.loop.bind(this);

            this.ui.best.textContent = String(this.best);
            this.resetGame();
            this.buildChips();
            this.bindInput();
            this.resizeCanvas();
            try {
                new ResizeObserver(() => this.resizeCanvas()).observe(this.canvas);
            } catch (e) {
                window.addEventListener('resize', () => this.resizeCanvas());
            }
            // Redraw once the pixel font has loaded so canvas labels use it.
            if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.draw());
        }

        /* ================= loop ================= */
        // The animation loop only runs during play, so an idle page costs no CPU.
        startLoop() {
            if (this.rafId) return;
            this.lastTs = performance.now();
            this.rafId = requestAnimationFrame(this.loop);
        }

        stopLoop() {
            if (this.rafId) cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        loop(now) {
            const dt = Math.min(2.5, (now - this.lastTs) / 16.67);
            this.lastTs = now;
            if (this.g.state === 'running') this.update(dt);
            this.draw();
            this.rafId = this.g.state === 'running' ? requestAnimationFrame(this.loop) : null;
        }

        // Size the canvas backing store to its displayed size so text stays sharp at any width.
        resizeCanvas() {
            const canvas = this.canvas;
            const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
            const cssW = canvas.clientWidth || W;
            const scale = Math.max(1, Math.min(8, (cssW / W) * dpr));
            const pw = Math.round(W * scale);
            const ph = Math.round(H * scale);
            if (canvas.width === pw && canvas.height === ph) return;
            canvas.width = pw;
            canvas.height = ph;
            // resizing resets the context, so set the transform again
            this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
            this.ctx.imageSmoothingEnabled = false;
            this.draw();
        }

        /* ================= game state ================= */
        resetGame() {
            this.g = {
                state: 'ready',
                t: 0,
                score: 0,
                speed: 3,
                slow: 0,
                shield: false,
                flash: 0,
                lives: 3,
                invuln: 0,
                hurt: 0,
                combo: 0,
                obstacles: [],
                pickups: [],
                particles: [],
                popups: [],
                spawnIn: 140,
                pickupIn: 380,
                offFar: 0,
                offNear: 0,
                offGround: 0,
                bag: [],
                lastKey: null,
                known: new Set(),
                lastSprint: 1,
                sprintToast: 0,
                p: { x: 46, y: GROUND, vy: 0, duck: false, onGround: true, frame: 0 }
            };
            this.syncHud(true);
        }

        showOverlay(name) {
            ['start', 'paused', 'over'].forEach((n) => {
                this.ui[n].hidden = n !== name;
            });
        }

        startRun() {
            this.resetGame();
            this.g.state = 'running';
            this.showOverlay(null);
            this.stage.focus({ preventScroll: true });
            this.startLoop();
        }

        pause() {
            if (this.g.state !== 'running') return;
            this.g.state = 'paused';
            this.g.p.duck = false;
            this.showOverlay('paused');
            this.stopLoop();
            this.draw();
        }

        resume() {
            if (this.g.state !== 'paused') return;
            this.g.state = 'running';
            this.showOverlay(null);
            this.stage.focus({ preventScroll: true });
            this.startLoop();
        }

        secs() {
            return this.g.t / 60;
        }
        level() {
            return Math.min(1, this.secs() / 180);
        }
        sprint() {
            return Math.min(7, 1 + Math.floor(this.secs() / 30));
        }
        mult() {
            const c = this.g.combo;
            if (c >= 25) return 3;
            if (c >= 10) return 2;
            return 1;
        }

        jump() {
            const state = this.g.state;
            if (state === 'paused') {
                this.resume();
                return;
            }
            if (state === 'over' && performance.now() - this.overAt < 700) return; // don't skip the game-over screen by holding Space
            if (state !== 'running') {
                this.startRun();
                return;
            }
            const p = this.g.p;
            if (p.onGround) {
                p.vy = -8.8;
                p.onGround = false;
                this.puff(p.x + 8, GROUND);
            }
        }

        setDuck(value) {
            const p = this.g.p;
            p.duck = value;
            if (value && !p.onGround) p.vy += 2.2;
        }

        /* ---------- effects ---------- */
        pop(x, y, text, color) {
            this.g.popups.push({ x, y, text, c: color || '#f4c542', life: 45 });
        }
        puff(x, y) {
            for (let i = 0; i < 5; i++) {
                this.g.particles.push({ x, y, vx: -Math.random() * 1.5 - 0.5, vy: -Math.random() * 1.2, life: 18, c: '#8b93b8' });
            }
        }
        steam(x, y, color) {
            for (let i = 0; i < 10; i++) {
                this.g.particles.push({ x, y, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2, life: 26, c: color });
            }
        }

        /* ---------- spawning ---------- */
        nextLimit() {
            const g = this.g;
            const open = LIMITS.filter((l) => this.secs() >= l.at);
            // newly unlocked limits jump the queue so you meet them right away
            const fresh = open.filter((l) => !g.known.has(l.key));
            if (fresh.length) {
                fresh.forEach((l) => g.known.add(l.key));
                g.bag = fresh.concat(g.bag);
            }
            if (!g.bag.length) {
                g.bag = shuffle(open.slice());
                if (g.bag.length > 1 && g.bag[0].key === g.lastKey) g.bag.push(g.bag.shift());
            }
            const d = g.bag.shift();
            g.lastKey = d.key;
            return d;
        }

        spawn() {
            const g = this.g;
            const s = this.secs();
            const lv = this.level();
            const d = this.nextLimit();
            const o = { type: d.key, d, w: d.w, h: d.h, y: d.kind === 'fly' ? GROUND - 24 : GROUND, x: W + 10 };
            g.obstacles.push(o);
            if (s > 60 && d.kind === 'ground' && Math.random() < 0.1 + lv * 0.2) {
                const small = LIMITS.filter((l) => l.kind === 'ground' && l.h <= 18);
                const e = small[Math.floor(Math.random() * small.length)];
                g.obstacles.push({ type: e.key, d: e, w: e.w, h: e.h, y: GROUND, x: o.x + o.w + 28 });
            }
            const minGap = 270 - lv * 140;
            const extra = 180 - lv * 80;
            g.spawnIn = minGap + Math.random() * extra + (d.w > 30 ? 20 : 0);
        }

        playerBox() {
            const p = this.g.p;
            const ducking = p.duck && p.onGround;
            const w = ducking ? 30 : 20;
            const h = ducking ? 17 : 30;
            return { x: p.x + 1, y: p.y - h, w, h };
        }

        // b.y is the bottom edge of b
        hit(a, b) {
            const pad = 4;
            return a.x + pad < b.x + b.w && a.x + a.w - pad > b.x && a.y + pad < b.y && a.y + a.h - pad > b.y - b.h;
        }

        /* ================= update ================= */
        update(dt) {
            const g = this.g;
            const p = g.p;
            g.t += dt;

            const base = 3 + this.level() * 5.5;
            g.speed = g.slow > 0 ? base * 0.62 : base;
            if (g.slow > 0) g.slow -= dt;
            g.score += g.speed * dt * 0.5 * this.mult();

            const sp = this.sprint();
            if (sp !== g.lastSprint) {
                g.lastSprint = sp;
                g.sprintToast = 150;
                g.score += 250;
                this.pop(W / 2, 70, '+250 sprint bonus', '#9be4c6');
            }
            if (g.sprintToast > 0) g.sprintToast -= dt;

            // player physics
            if (!p.onGround) {
                p.vy += 0.46 * dt;
                p.y += p.vy * dt;
                if (p.y >= GROUND) {
                    p.y = GROUND;
                    p.vy = 0;
                    p.onGround = true;
                    this.puff(p.x + 10, GROUND);
                }
            }
            p.frame += g.speed * dt * 0.06;

            // parallax
            g.offFar = (g.offFar + g.speed * 0.18 * dt) % this.far.width;
            g.offNear = (g.offNear + g.speed * 0.4 * dt) % this.near.width;
            g.offGround = (g.offGround + g.speed * dt) % 24;

            // spawn obstacles
            g.spawnIn -= g.speed * dt;
            if (g.spawnIn <= 0) this.spawn();

            // spawn power-ups, kept clear of obstacles
            g.pickupIn -= g.speed * dt;
            if (g.pickupIn <= 0) {
                const crowded = g.obstacles.some((o) => Math.abs(o.x - (W + 10)) < 90);
                if (crowded) {
                    g.pickupIn = 40;
                } else {
                    const floaty = this.sprint() >= 3 && Math.random() < 0.4;
                    g.pickups.push({
                        type: Math.random() < 0.55 ? 'coffee' : 'shield',
                        x: W + 10,
                        y: floaty ? GROUND - 30 : GROUND - 2,
                        w: 14,
                        h: 14,
                        bob: 0,
                        floaty
                    });
                    g.pickupIn = 550 + Math.random() * 550;
                }
            }

            // obstacles: collisions and dodges
            if (g.invuln > 0) g.invuln -= dt;
            if (g.hurt > 0) g.hurt -= dt;
            const pb = this.playerBox();
            for (const o of g.obstacles) {
                o.x -= g.speed * dt;
                if (!o.dead && !o.passed && g.invuln <= 0 && this.hit(pb, o)) {
                    if (g.shield) {
                        g.shield = false;
                        o.dead = true;
                        g.flash = 14;
                        this.steam(o.x + o.w / 2, o.y - o.h / 2, '#3fb68b');
                        this.pop(p.x + 10, p.y - 40, 'Shield saved you', '#9be4c6');
                    } else if (g.lives > 1) {
                        g.lives -= 1;
                        g.combo = 0;
                        g.invuln = 100;
                        g.hurt = 16;
                        o.dead = true;
                        this.steam(o.x + o.w / 2, o.y - o.h / 2, '#e2553f');
                        this.pop(p.x + 10, p.y - 40, '-1 life', '#f07a64');
                    } else {
                        g.lives = 0;
                        this.gameOver(o.type);
                        return;
                    }
                }
                if (!o.dead && !o.passed && o.x + o.w < p.x) {
                    o.passed = true;
                    g.combo += 1;
                    if (!this.seen.has(o.type)) {
                        this.seen.add(o.type);
                        store.set('seen', [...this.seen]);
                        this.renderChips();
                        this.pop(W / 2, 96, 'New limit: ' + BY_KEY[o.type].name, '#8fd3ff');
                    }
                    const bonus = 10 * this.mult();
                    g.score += bonus;
                    this.pop(p.x + 6, p.y - 38, '+' + bonus);
                    if (g.combo === 10) this.pop(W / 2, 80, 'Combo x2', '#9be4c6');
                    if (g.combo === 25) this.pop(W / 2, 80, 'Combo x3', '#9be4c6');
                }
            }
            g.obstacles = g.obstacles.filter((o) => o.x + o.w > -10 && !o.dead);

            // power-ups
            for (const k of g.pickups) {
                k.x -= g.speed * dt;
                k.bob += 0.12 * dt;
                const grab = 10;
                const kb = {
                    x: k.x - grab,
                    y: k.y + (k.floaty ? Math.sin(k.bob) * 3 : 0) + grab,
                    w: k.w + grab * 2,
                    h: k.h + grab * 2
                };
                if (this.hit(pb, kb)) {
                    k.got = true;
                    if (k.type === 'coffee') {
                        g.slow = 200;
                        g.score += 100;
                        this.pop(k.x, k.y - 24, '+100 coffee');
                        this.steam(k.x + 7, k.y - 7, '#f2e6c9');
                    } else {
                        g.shield = true;
                        g.score += 50;
                        this.pop(k.x, k.y - 24, '+50 shield', '#9be4c6');
                        this.steam(k.x + 7, k.y - 7, '#3fb68b');
                    }
                }
            }
            g.pickups = g.pickups.filter((k) => k.x > -20 && !k.got);

            for (const q of g.particles) {
                q.x += q.vx * dt;
                q.y += q.vy * dt;
                q.life -= dt;
            }
            g.particles = g.particles.filter((q) => q.life > 0);
            for (const u of g.popups) {
                u.y -= 0.5 * dt;
                u.life -= dt;
            }
            g.popups = g.popups.filter((u) => u.life > 0);
            if (g.flash > 0) g.flash -= dt;

            this.syncHud(false);
        }

        // Push engine state into the DOM, throttled so the page doesn't reflow every frame
        syncHud(force) {
            const now = performance.now();
            if (!force && now - this.lastHud < 100) return;
            this.lastHud = now;
            const g = this.g;
            const m = this.mult();
            this.ui.score.textContent = String(Math.floor(g.score));
            this.ui.mult.textContent = m > 1 ? 'x' + m : '';
            this.ui.lives.textContent = '♥'.repeat(g.lives) + '♡'.repeat(3 - g.lives);
            this.ui.sprint.textContent = 'Sprint ' + g.lastSprint;
            this.ui.shield.classList.toggle('off', !g.shield);
        }

        gameOver(type) {
            const g = this.g;
            g.state = 'over';
            this.overAt = performance.now();
            this.syncHud(true);
            const s = Math.floor(g.score);
            let msg = (BY_KEY[type] && BY_KEY[type].msg) || TIRED;
            if (s < 150) msg = TIRED;
            if (s > this.best) {
                this.best = s;
                store.set('best', s);
                this.ui.best.textContent = String(s);
                this.ui['over-title'].textContent = 'New personal best';
            } else {
                this.ui['over-title'].textContent = 'Run over';
            }
            this.ui['over-msg'].textContent = msg;
            this.ui['over-score'].textContent = 'You survived ' + s + ' CPU ms. Your best is ' + this.best + '.';
            this.showOverlay('over');
        }

        /* ================= limits collection ================= */
        buildChips() {
            this.chipEls = {};
            const box = this.ui.chips;
            LIMITS.forEach((l) => {
                const chip = document.createElement('span');
                chip.className = 'glr-chip';
                chip.textContent = l.name;
                // set via CSSOM: the page's CSP blocks inline style attributes
                chip.style.setProperty('--c', l.c);
                box.appendChild(chip);
                this.chipEls[l.key] = chip;
            });
            this.renderChips();
        }

        renderChips() {
            LIMITS.forEach((l) => this.chipEls[l.key].classList.toggle('got', this.seen.has(l.key)));
            this.ui.count.textContent = this.seen.size + '/' + LIMITS.length;
        }

        /* ================= input ================= */
        bindInput() {
            const root = this.root;
            root.addEventListener('keydown', (e) => {
                const code = e.code;
                // let Enter/Space activate buttons normally unless a run is in progress
                if (e.target.tagName === 'BUTTON' && this.g.state !== 'running') return;
                if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
                    e.preventDefault();
                    if (!e.repeat || this.g.state === 'running') this.jump();
                } else if (code === 'ArrowDown' || code === 'KeyS') {
                    e.preventDefault();
                    this.setDuck(true);
                }
            });
            root.addEventListener('keyup', (e) => {
                if (e.code === 'ArrowDown' || e.code === 'KeyS') this.setDuck(false);
            });
            // Pause when focus leaves the game or the tab is hidden.
            root.addEventListener('focusout', (e) => {
                if (e.relatedTarget && root.contains(e.relatedTarget)) return;
                this.pause();
            });
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) this.pause();
            });

            this.canvas.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this.stage.focus({ preventScroll: true });
                this.jump();
            });
            root.querySelectorAll('[data-action]').forEach((btn) => {
                const action = btn.dataset.action;
                if (action === 'start') btn.addEventListener('click', () => this.startRun());
                if (action === 'resume') btn.addEventListener('click', () => this.resume());
                if (action === 'jump') {
                    btn.addEventListener('pointerdown', (e) => {
                        e.preventDefault();
                        this.jump();
                    });
                }
                if (action === 'duck') {
                    btn.addEventListener('pointerdown', (e) => {
                        e.preventDefault();
                        this.setDuck(true);
                    });
                    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) =>
                        btn.addEventListener(ev, () => this.setDuck(false))
                    );
                }
            });
        }

        /* ================= drawing ================= */
        r(x, y, w, h, color) {
            this.ctx.fillStyle = color;
            this.ctx.fillRect(Math.round(x), Math.round(y), w, h);
        }

        label(x, y, text, color, size) {
            const ctx = this.ctx;
            ctx.fillStyle = color;
            ctx.font = (size || 7) + 'px ' + PIXEL_FONT;
            ctx.textAlign = 'center';
            ctx.fillText(text, x, y);
        }

        draw() {
            if (!this.ctx) return;
            const ctx = this.ctx;
            const g = this.g;

            this.drawSky();
            this.drawSkyline(this.far, g.offFar, '#262a52', '#3f4478');
            this.drawSkyline(this.near, g.offNear, '#1f2344', '#f4c542');
            this.drawGround();

            for (const k of g.pickups) this.drawPickup(k);
            for (const o of g.obstacles) this.drawObstacle(o);

            if (g.shield) {
                const b = this.playerBox();
                ctx.strokeStyle = 'rgba(63,182,139,.8)';
                ctx.lineWidth = 2;
                ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
            }
            if (!(g.invuln > 0 && Math.floor(g.invuln / 5) % 2 === 0)) this.drawPlayer();

            for (const q of g.particles) {
                ctx.globalAlpha = Math.max(0, q.life / 26);
                this.r(q.x, q.y, 2, 2, q.c);
            }
            ctx.globalAlpha = 1;

            for (const u of g.popups) {
                ctx.globalAlpha = Math.min(1, u.life / 20);
                this.label(u.x, u.y, u.text, u.c, 8);
            }
            ctx.globalAlpha = 1;

            if (g.hurt > 0) {
                ctx.fillStyle = 'rgba(226,85,63,' + g.hurt / 50 + ')';
                ctx.fillRect(0, 0, W, H);
            }
            if (g.slow > 0) {
                ctx.fillStyle = 'rgba(201,138,75,.10)';
                ctx.fillRect(0, 0, W, H);
                ctx.fillStyle = '#f2e6c9';
                ctx.font = '8px ' + PIXEL_FONT;
                ctx.textAlign = 'left';
                ctx.fillText('COFFEE SLOW-MO', 8, 14);
            }
            if (g.sprintToast > 0 && g.state === 'running') {
                ctx.globalAlpha = Math.min(1, g.sprintToast / 30);
                ctx.fillStyle = 'rgba(29,35,64,.85)';
                ctx.fillRect(W / 2 - 110, 22, 220, 34);
                this.label(W / 2, 36, 'SPRINT ' + g.lastSprint, '#f4c542', 10);
                this.label(W / 2, 49, (SPRINT_MSGS[g.lastSprint] || '').toUpperCase(), '#f2e6c9', 8);
                ctx.globalAlpha = 1;
            }
            if (g.flash > 0) {
                ctx.fillStyle = 'rgba(63,182,139,' + g.flash / 40 + ')';
                ctx.fillRect(0, 0, W, H);
            }
        }

        drawSky() {
            const ctx = this.ctx;
            const t = this.g.t;
            const grad = ctx.createLinearGradient(0, 0, 0, GROUND);
            grad.addColorStop(0, '#141833');
            grad.addColorStop(1, '#2c2f5c');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
            for (const s of this.stars) {
                ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.02 + s.x));
                this.r(s.x, s.y, s.r, s.r, '#f2e6c9');
            }
            ctx.globalAlpha = 1;
            // crescent moon
            ctx.fillStyle = '#f2e6c9';
            ctx.beginPath();
            ctx.arc(400, 38, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#232852';
            ctx.beginPath();
            ctx.arc(408, 33, 14, 0, Math.PI * 2);
            ctx.fill();
        }

        drawSkyline(sk, off, color, windowColor) {
            for (let pass = 0; pass < 2; pass++) {
                for (const b of sk.blocks) {
                    const x = b.x - off + pass * sk.width;
                    if (x > W || x + b.w < 0) continue;
                    this.r(x, GROUND - b.h, b.w, b.h, color);
                    for (const [wx, wy] of b.wins) this.r(x + wx, GROUND - b.h + wy, 3, 4, windowColor);
                }
            }
        }

        drawGround() {
            const off = this.g.offGround;
            this.r(0, GROUND, W, H - GROUND, '#191d3a');
            this.r(0, GROUND, W, 2, '#6a70a8');
            for (let x = -off; x < W; x += 24) {
                this.r(x, GROUND + 8, 10, 2, '#3a3f70');
                this.r(x + 12, GROUND + 16, 5, 2, '#2d3260');
            }
        }

        drawPlayer() {
            const g = this.g;
            const p = g.p;
            const ducking = p.duck && p.onGround;
            const leg = Math.floor(p.frame) % 2;
            if (ducking) {
                const x = p.x;
                const y = p.y - 17;
                this.r(x, y + 6, 22, 9, '#4f6bd8'); // hoodie
                this.r(x + 20, y + 1, 10, 9, '#e0a878'); // head
                this.r(x + 20, y, 10, 3, '#2b1d14'); // hair
                this.r(x + 26, y + 4, 2, 2, '#141414'); // eye
                this.r(x + 2, y + 15, 6, 2, '#2a2f45');
                this.r(x + 13, y + 15, 6, 2, '#2a2f45');
                this.r(x + 22, y + 11, 5, 5, '#f2e6c9'); // mug
                return;
            }
            const x = p.x;
            const y = p.y - 30;
            this.r(x + 4, y, 12, 4, '#2b1d14'); // hair
            this.r(x + 3, y + 1, 2, 4, '#2b1d14');
            this.r(x + 5, y + 4, 11, 8, '#e0a878'); // face
            this.r(x + 12, y + 6, 2, 2, '#141414'); // eye
            this.r(x + 11, y + 9, 4, 1, '#a86c46'); // tired eye bag
            this.r(x + 2, y + 12, 16, 11, '#4f6bd8'); // hoodie
            this.r(x + 8, y + 13, 4, 2, '#3a54c0');
            this.r(x + 16, y + 14, 6, 7, '#f2e6c9'); // mug
            this.r(x + 21, y + 16, 2, 3, '#f2e6c9');
            this.r(x + 17, y + 15, 4, 2, '#6b3f22'); // coffee
            if (Math.floor(g.t / 10) % 2 === 0) this.r(x + 18, y + 10, 1, 3, 'rgba(242,230,201,.6)');
            if (p.onGround) {
                if (leg) {
                    this.r(x + 4, y + 23, 5, 7, '#2a2f45');
                    this.r(x + 12, y + 23, 5, 5, '#2a2f45');
                } else {
                    this.r(x + 4, y + 23, 5, 5, '#2a2f45');
                    this.r(x + 12, y + 23, 5, 7, '#2a2f45');
                }
            } else {
                this.r(x + 3, y + 23, 5, 5, '#2a2f45');
                this.r(x + 13, y + 23, 5, 5, '#2a2f45');
            }
        }

        drawObstacle(o) {
            const ctx = this.ctx;
            const t = this.g.t;
            const x = o.x;
            const top = o.y - o.h;
            const w = o.w;
            const h = o.h;
            const cx = x + w / 2;
            const f = Math.floor(t / 8) % 2;
            const wob = Math.sin(t * 0.2) * 1.5;
            const r = this.r.bind(this);

            switch (o.type) {
                case 'soql': // stacked database cylinders
                    for (let i = 0; i < 3; i++) {
                        const y = top + i * 10;
                        r(x, y + 2, w, 8, '#e2553f');
                        r(x + 2, y, w - 4, 3, '#f07a64');
                        r(x, y + 9, w, 1, '#9e3526');
                    }
                    break;
                case 'dml': // crates
                    [[0, 12], [12, 12], [6, 0]].forEach(([dx, dy]) => {
                        r(x + dx, top + dy, 12, 12, '#c98a4b');
                        r(x + dx, top + dy, 12, 2, '#e0a868');
                        r(x + dx + 5, top + dy, 2, 12, '#8a5a2e');
                    });
                    break;
                case 'rows': // long low stack of result rows
                    for (let i = 0; i < 4; i++) r(x + (i % 2), top + i * 3, w - 1, 2, i % 2 ? '#4d67d6' : '#6f8cff');
                    r(x + w - 6, top - 4, 6, 4, '#6f8cff');
                    break;
                case 'null': // hollow ghost box
                    ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 0.15);
                    for (let i = 0; i < w; i += 4) {
                        r(x + i, top, 2, 2, '#b8bfd9');
                        r(x + i, top + h - 2, 2, 2, '#b8bfd9');
                    }
                    for (let i = 0; i < h; i += 4) {
                        r(x, top + i, 2, 2, '#b8bfd9');
                        r(x + w - 2, top + i, 2, 2, '#b8bfd9');
                    }
                    ctx.globalAlpha = 1;
                    this.label(cx, top + 13, '?', '#b8bfd9');
                    break;
                case 'heap': // heap of memory blocks
                    [[0, 12, 30], [4, 6, 22], [9, 0, 12]].forEach(([dx, dy, ww], i) => {
                        r(x + dx, top + dy, ww, 6, i % 2 ? '#8a52bd' : '#a66bd6');
                    });
                    r(x + 12, top + 2, 2, 2, '#e5c8ff');
                    break;
                case 'lock': // padlock
                    r(x + 3, top, 10, 2, '#c99a1f');
                    r(x + 3, top, 2, 9, '#c99a1f');
                    r(x + 11, top, 2, 9, '#c99a1f');
                    r(x, top + 8, w, 14, '#f4c542');
                    r(x + 7, top + 12, 2, 5, '#1d2340');
                    break;
                case 'dup': // two identical records
                    r(x, top + 2, 12, 12, '#3fb6b0');
                    r(x + 16, top + 2, 12, 12, '#3fb6b0');
                    r(x + 2, top + 5, 8, 2, '#b5f0ec');
                    r(x + 18, top + 5, 8, 2, '#b5f0ec');
                    this.label(x + 14, top + 10, '=', '#b5f0ec');
                    break;
                case 'mixed': // setup + non-setup fused, sparking
                    r(x, top + 4, 11, h - 4, '#6f8cff');
                    r(x + 11, top + 4, 11, h - 4, '#ef8a3a');
                    if (f) r(x + 9, top, 4, 4, '#ffffff');
                    else r(x + 10, top + 1, 2, 2, '#f4c542');
                    break;
                case 'valid': // stop sign on a pole
                    r(x + 7, top + 14, 2, h - 14, '#8b93b8');
                    r(x + 3, top, 10, 14, '#d83b3b');
                    r(x + 1, top + 3, 14, 8, '#d83b3b');
                    r(x + 4, top + 6, 8, 2, '#ffffff');
                    break;
                case 'future': // hourglass
                    r(x, top, w, 2, '#e6cf9a');
                    r(x, top + h - 2, w, 2, '#e6cf9a');
                    r(x + 2, top + 2, 10, 4, '#c9a86a');
                    r(x + 4, top + 6, 6, 4, '#c9a86a');
                    r(x + 6, top + 10, 2, 4, '#f4c542');
                    r(x + 4, top + 14, 6, 4, '#c9a86a');
                    r(x + 2, top + 18, 10, 4, '#c9a86a');
                    r(x + 6, top + 17, 2, 2, '#f4c542');
                    break;
                case 'depth': // recursive coil
                    for (let i = 0; i < 5; i++) {
                        const y = top + i * 6;
                        r(x + (i % 2 ? 2 : 0), y, 16, 3, '#57c785');
                        r(x + (i % 2 ? 16 : 0), y + 2, 2, 4, '#3c9a63');
                    }
                    break;
                case 'cpu': {
                    // winged clock
                    const y = top + wob;
                    ctx.fillStyle = '#f4c542';
                    ctx.beginPath();
                    ctx.arc(cx, y + 8, 8, 0, Math.PI * 2);
                    ctx.fill();
                    r(cx - 1, y + 3, 2, 5, '#1d2340');
                    r(cx, y + 7, 4, 2, '#1d2340');
                    r(x + (f ? 0 : 2), y + 4, 10, 3, '#f2e6c9');
                    r(x + w - 10 - (f ? 0 : 2), y + 4, 10, 3, '#f2e6c9');
                    break;
                }
                case 'callout': {
                    // satellite dish
                    const y = top + wob;
                    ctx.fillStyle = '#8fd3ff';
                    ctx.beginPath();
                    ctx.arc(x + 12, y + 8, 9, Math.PI * 0.15, Math.PI * 1.15);
                    ctx.fill();
                    r(x + 11, y + 6, 8, 2, '#cfe9ff');
                    r(x + 19, y + 4, 3, 3, '#ffffff');
                    if (f) {
                        r(x + 24, y + 2, 2, 2, '#8fd3ff');
                        r(x + 27, y, 2, 2, '#8fd3ff');
                    }
                    break;
                }
                case 'email': {
                    // flying envelope
                    const y = top + wob;
                    r(x, y, w, h, '#f2e6c9');
                    r(x, y, w, 2, '#c9bb95');
                    for (let i = 0; i < 7; i++) {
                        r(x + i * 2, y + 2 + i, 2, 1, '#c9bb95');
                        r(x + w - 2 - i * 2, y + 2 + i, 2, 1, '#c9bb95');
                    }
                    r(x + w / 2 - 2, y + 8, 4, 3, '#e2553f');
                    break;
                }
                case 'sosl': {
                    // magnifying glass
                    const y = top + wob;
                    ctx.strokeStyle = '#9be4c6';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(x + 10, y + 7, 6, 0, Math.PI * 2);
                    ctx.stroke();
                    r(x + 15, y + 11, 10, 3, '#9be4c6');
                    break;
                }
                case 'deploy': // striped failure wall
                    for (let i = 0; i < h; i += 8) {
                        r(x, top + i, w, 4, '#b3263b');
                        r(x, top + i + 4, w, 4, '#e2553f');
                    }
                    this.label(cx, top + 10, 'X', '#ffffff');
                    break;
                case 'dmlrows': // tower of paper records
                    for (let i = 0; i < h; i += 4) r(x + (i % 8 ? 1 : 0), top + i, w - 1, 3, i % 8 ? '#9aa4d6' : '#7b86b8');
                    break;
                case 'queue': // queue of waiting jobs
                    for (let i = 0; i < 4; i++) {
                        const y = top + i * 10;
                        r(x + 2, y, 18, 8, '#e58fb8');
                        r(x + 4, y + 3, 4, 2, '#ffffff');
                        r(x + 10, y + 3, 8, 2, '#b8638c');
                    }
                    break;
                default:
                    r(x, top, w, h, '#888888');
            }
            const labelY = o.d.kind === 'fly' ? top - 2 + wob : top - 3;
            this.label(cx, labelY, o.d.name.toUpperCase(), o.d.c);
        }

        drawPickup(k) {
            const ctx = this.ctx;
            const x = k.x;
            const y = k.y - k.h + (k.floaty ? Math.sin(k.bob) * 3 : Math.sin(k.bob));
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = k.type === 'coffee' ? '#f4c542' : '#3fb68b';
            ctx.beginPath();
            ctx.arc(x + 7, y + 7, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            if (k.type === 'coffee') {
                this.r(x + 2, y + 3, 9, 10, '#c98a4b');
                this.r(x + 2, y + 3, 9, 2, '#6b3f22');
                this.r(x + 11, y + 5, 3, 5, '#c98a4b');
                this.r(x + 4, y, 1, 2, '#f2e6c9');
                this.r(x + 8, y - 1, 1, 2, '#f2e6c9');
            } else {
                this.r(x + 2, y, 10, 11, '#3fb68b');
                this.r(x + 4, y + 11, 6, 2, '#3fb68b');
                this.r(x + 6, y + 13, 2, 1, '#3fb68b');
                this.r(x + 4, y + 2, 6, 1, '#9be4c6');
            }
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const root = document.getElementById('glr');
        if (root) new GovernorLimitRunner(root);
    });
})();
