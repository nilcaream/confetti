"use strict";

(r => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r) : r())(() => {

    const id = "nc-confetti-everywhere-main";

    const version = 1;

    const extension = (chrome || {}).storage !== undefined;
    const debug = window.location.host === "example.com" || window.location.host === "";

    const log = m => debug ? console.log(`[${id}${extension ? "-ext" : ""}] ${m}`) : undefined;

    const random = (min, max) => min + (max - min) * Math.random();

    const range = (min, max = min) => {
        const result = {
            min: min,
            max: max,
        };

        result.random = (x = 0) => random(x + result.min, x + result.max);
        result.limit = x => Math.max(result.min, Math.min(result.max, x))

        return result;
    };

    const cfg = {
        count: range(160, 200),
        v0: {
            threshold: 10,
            length: range(30, 100),
            variation: range(30, 40),
            angle: range(-35, 35),
            multiplier: range(2, 5)
        },
        size: {
            width: 10,
            height: 6,
            skew: 4,
            wobble: {
                zoom: range(4.0, 6.0),
                offset: range(-180, 180),
            }
        },
        rotation: { // paper rotation around shifted axis
            zoom: range(-2, 2),
            offset: range(-180, 180),
            shift: range(5, 10)
        },
        fade: {
            t0: 3, // [s]
            t1: 4, // [s]
        },
        physics: {
            g: 300, // [px/s^2]
            vT: 500 // [px/s]
        },
        ui: {
            showFps: true
        }
    };

    const fade = t => {
        // https://www.desmos.com/calculator/zu1mawkfz8
        const b = 1 / (1 - (cfg.fade.t0 / cfg.fade.t1));
        const a = -b / cfg.fade.t1;
        return Math.min(1, Math.max(0, a * t + b));
    };

    const runtime = {
        time: 0,
        papers: [],
        mouse: {
            x0: 0,
            y0: 0,
            x1: 0,
            y1: 0,
            clicked: false
        },
        running: false,
        frameCounter: 0,
        lastFpsCheckTime: 0,
        fps: 0
    };

    class Paper {
        constructor(x, y, v0, angle) {
            this.x = x;
            this.y = y;
            this.vX = v0 * Math.cos(Math.PI * angle / 180);
            this.vY = v0 * Math.sin(Math.PI * angle / 180);
            this.vT = cfg.physics.vT; // static drag; dynamic drag: this.vT = v0 / 3
            this.x0 = x;
            this.y0 = y;
            this.t = 0;
            this.orientation = Math.sign(random(-1, 1)) || 1;
            this.wobble = {
                zoom: cfg.size.wobble.zoom.random(),
                offset: Math.PI * cfg.size.wobble.offset.random() / 180
            };
            this.color = {
                r: random(0, 255).toFixed(),
                g: random(0, 255).toFixed(),
                b: random(0, 255).toFixed(),
                a: random(0.7, 1),
            };
            this.rotation = {
                zoom: cfg.rotation.zoom.random(),
                offset: Math.PI * cfg.rotation.offset.random() / 180,
                shift: cfg.rotation.shift.random(),
            };
        }
    }

    const fire = (x0, y0, x1, y1) => {
        const xD = x0 - x1;
        const yD = y1 - y0;
        const length = Math.sqrt(xD * xD + yD * yD);

        if (length > cfg.v0.threshold) {
            const count = cfg.count.random();
            for (let i = 0; i < count; i++) {
                const v0 = cfg.v0.multiplier.random() * cfg.v0.variation.random(cfg.v0.length.limit(length));
                const angle = cfg.v0.angle.random(180 * Math.atan2(yD, xD) / Math.PI);
                runtime.papers.push(new Paper(x0, y0, v0, angle));
            }
        }
    };

    const createCanvas = () => {
        const canvas = document.createElement("canvas");
        canvas.setAttribute("width", window.innerWidth.toString());
        canvas.setAttribute("height", window.innerHeight.toString());
        canvas.setAttribute("id", id);
        canvas.style.position = "fixed";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.zIndex = "9000";

        canvas.addEventListener("mousedown", e => {
            runtime.mouse.x0 = e.clientX;
            runtime.mouse.y0 = e.clientY;
            runtime.mouse.x1 = e.clientX;
            runtime.mouse.y1 = e.clientY;
            runtime.mouse.clicked = true;
        });

        canvas.addEventListener("mousemove", e => {
            if (runtime.mouse.clicked) {
                runtime.mouse.x1 = e.clientX;
                runtime.mouse.y1 = e.clientY;
            }
        });

        canvas.addEventListener("mouseup", () => {
            runtime.mouse.clicked = false;
            fire(runtime.mouse.x0, runtime.mouse.y0, runtime.mouse.x1, runtime.mouse.y1);
        });

        document.getElementsByTagName("body")[0].append(canvas);

        runtime.canvas = canvas;
        runtime.ctx = canvas.getContext("2d");
        runtime.ctx.font = "9px monospace";
        runtime.ctx.textBaseline = "middle";
        runtime.ctx.textAlign = "center";

        if (!extension) {
            const settings = document.getElementById("nc-confetti-everywhere-cfg-toggle");
            settings.addEventListener("click", () => {
                const iframe = document.getElementById("nc-confetti-everywhere-cfg")
                iframe.classList.toggle("show");
                iframe.classList.toggle("hide");
            });
        }
    };

    const physics = {
        // https://farside.ph.utexas.edu/teaching/336k/Newton/node29.html
        x: paper => paper.x0 + paper.vT * paper.vX * (1 - Math.exp(-cfg.physics.g * paper.t / paper.vT)) / cfg.physics.g,
        y: paper => paper.y0 - paper.vT * (paper.vY + paper.vT) * (1 - Math.exp(-cfg.physics.g * paper.t / paper.vT)) / cfg.physics.g + paper.vT * paper.t
    };

    const animate = diff => {
        const ctx = runtime.ctx;
        const canvas = runtime.canvas;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        runtime.papers.forEach(paper => {
            paper.t += diff / 1000; // V in [px/s]
            paper.x = physics.x(paper);
            paper.y = physics.y(paper);
            paper.color.a = paper.color.a * fade(paper.t);

            const wobble = Math.cos(paper.wobble.zoom * paper.t + paper.wobble.offset);
            const width = cfg.size.width * paper.orientation;
            const skew = cfg.size.skew * paper.orientation;
            const height = cfg.size.height;

            ctx.save();
            ctx.translate(paper.x, paper.y);
            ctx.rotate(paper.t * paper.rotation.zoom + paper.rotation.offset);
            ctx.translate(paper.rotation.shift, paper.rotation.shift);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(width, 0);
            ctx.lineTo(width + skew, height * wobble);
            ctx.lineTo(skew, height * wobble);
            ctx.fillStyle = `rgba(${paper.color.r},${paper.color.g},${paper.color.b},${paper.color.a})`;
            ctx.fill();
            ctx.restore();
        });

        if (runtime.mouse.clicked) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(runtime.mouse.x0, runtime.mouse.y0, 10, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.moveTo(runtime.mouse.x0, runtime.mouse.y0);
            ctx.lineTo(runtime.mouse.x1, runtime.mouse.y1);
            ctx.stroke();
            ctx.restore();
        }

        if (cfg.ui.showFps) {
            ctx.save();
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, 90, 20);
            ctx.fillStyle = "black";
            ctx.fillText(`${runtime.fps} FPS | ${runtime.papers.length}`, 45, 10);
            ctx.restore();
        }
    };

    const frame = now => {
        if (runtime.running) {
            animate(now - runtime.time);
            runtime.time = now;
            runtime.frameCounter++;

            if (runtime.frameCounter % 10 === 0) {
                const maxHeight = runtime.canvas.height + Math.abs(cfg.size.width) + Math.abs(cfg.size.height) + Math.abs(cfg.size.skew);
                runtime.papers = runtime.papers.filter(p => p.color.a > 0 && p.y < maxHeight + p.rotation.shift);
                runtime.fps = (10 * 1000 / (now - runtime.lastFpsCheckTime)).toFixed(0);
                runtime.lastFpsCheckTime = now;
            }

            window.requestAnimationFrame(frame);
        }
    }

    const isVisible = () => document.getElementById(id) !== null;

    const sendMessage = message => {
        log(`sending ${JSON.stringify(message).substring(0, 64)}`);

        if (extension) {
            return chrome.runtime.sendMessage(message).then(() => { }, e => {
                if ((e || "").toString().toLowerCase().indexOf("receiving end does not exist") !== -1) {
                    log(`configuration panel is not available`);
                } else {
                    throw e;
                }
            });
        } else {
            const iframe = document.getElementById("nc-confetti-everywhere-cfg");
            if (iframe) {
                iframe.contentWindow.postMessage(JSON.stringify(message), "*");
                return Promise.resolve(true);
            } else {
                log("no message target");
                return Promise.resolve(false);
            }
        }
    };

    const prepare = async () => {
        log("prepare");
        const defaults = await saveCfg(`defaults.v${version}`);
        const configuration = await loadCfg(`configuration.v${version}`);

        sendMessage({
            defaults: defaults,
            configuration: configuration
        });
    };

    const show = () => {
        log("show");
        prepare();
        if (!isVisible()) {
            createCanvas();
            runtime.running = true;
            runtime.frameCounter = 0;
            runtime.lastFpsCheckTime = 0;
            runtime.fps = 0;
            frame(0);
        }
    };

    const hide = () => {
        runtime.running = false;
        if (isVisible()) {
            runtime.canvas.style.display = "none";
            runtime.canvas.style.zIndex = "-9000";
        }
        setTimeout(() => {
            runtime.papers = [];
            if (isVisible()) {
                document.getElementById(id).remove();
            }
            log("hidden");
        }, 100);
    };

    const toggleVisibility = () => {
        if (runtime.running) {
            hide();
        } else {
            show();
        }
        return runtime.running;
    };

    const isRange = o => o && typeof o.random === "function" && typeof o.limit === "function";

    const flatten = (o, results, current) => {
        if (isRange(o)) {
            results[current + ".range-min"] = o.min;
            results[current + ".range-max"] = o.max;
        } else if (typeof o === "object") {
            Object.keys(o).forEach(k => flatten(o[k], results, current + "." + k));
        } else {
            results[current] = o;
        }
    };

    const getFlattenCfg = () => {
        const results = {};
        flatten(cfg, results, "cfg");
        return results;
    };

    const autofire = () => {
        if (!isVisible()) {
            show();
        }

        const x0 = 0.5 * runtime.canvas.width;
        const y0 = 0.75 * runtime.canvas.height;
        const x1 = x0;
        const y1 = y0 + cfg.v0.length.random();

        fire(x0, y0, x1, y1);
    };

    const updateCfg = (key, value) => {
        const parts = (key || "").toString().split(".").slice(1).filter(x => typeof x === "string");

        if (parts.length < 2) {
            log("Invalid key: " + key);
            return;
        }
        if (isNaN(value)) {
            log("Invalid value: " + value);
            return;
        }

        const pointer = parts.slice(0, parts.length - 1);
        const parameter = parts[parts.length - 1];

        let holder = cfg;
        try {
            pointer.forEach(p => holder = holder[p]);
        } catch (e) {
            log(e);
            return;
        }

        let field;
        if (parameter === "range-min") {
            field = "min";
        } else if (parameter === "range-max") {
            field = "max";
        } else {
            field = parameter;
        }

        const oldValue = holder[field];
        if (value !== oldValue) {
            log(`updating ${key} from ${oldValue} to ${value}`);
            holder[field] = value;
        }

        return value !== oldValue;
    }

    const applyCfg = configuration => {
        Object.entries(configuration).forEach(([key, value]) => {
            log(`applying ${key} = ${value}`);
            updateCfg(key, value);
        });
    };

    const loadCfg = storageKey => {
        log(`loading ${storageKey}`);

        if (extension) {
            return chrome.storage.local.get([storageKey]).then(result => {
                if (result[storageKey]) {
                    applyCfg(result[storageKey]);
                    return getFlattenCfg();
                } else {
                    return saveCfg(storageKey);
                }
            });
        } else {
            const data = window.localStorage.getItem(storageKey);
            if (data) {
                applyCfg(JSON.parse(data));
                return Promise.resolve(getFlattenCfg());
            } else {
                return saveCfg(storageKey);
            }
        }
    };

    const saveCfg = storageKey => {
        log(`saving ${storageKey}`);

        const data = {};
        data[storageKey] = getFlattenCfg();

        if (extension) {
            return chrome.storage.local.set(data).then(() => data[storageKey]);
        } else {
            window.localStorage.setItem(storageKey, JSON.stringify(data[storageKey]));
            return Promise.resolve(data[storageKey]);
        }
    };

    const consumeMessage = async message => {
        log(`received ${JSON.stringify(message).substring(0, 64)}`);
        if (message.update) {
            const changed = updateCfg(message.update.key, message.update.value);
            if (changed) {
                await saveCfg(`configuration.v${version}`);
            }
        } else if (message.autofire && runtime.papers.length === 0) {
            autofire();
        } else if (message.show) {
            show();
        }
    };

    const startMessageListener = () => {
        if (extension) {
            chrome.runtime.onMessage.addListener(consumeMessage);
        } else {
            window.addEventListener("message", m => consumeMessage(JSON.parse(m.data)));
        }
    };

    // --------------------------------

    if (extension) {
        document.addEventListener("keydown", e => {
            if (e.key === "~" && e.ctrlKey) {
                toggleVisibility();
            } else if (runtime.running) {
                hide();
            }
        });
    }

    startMessageListener();

});
