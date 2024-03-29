"use strict";

(r => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r) : r())(() => {

    const id = "nc-confetti-everywhere-main";

    const version = 1;

    const extension = (chrome || {}).storage !== undefined;
    const debug = window.location.host === "example.com" || window.location.host === "";

    const log = m => debug ? console.log(`[${id}${extension ? "-ext" : ""}] ${m}`) : undefined;

    const random = (min, max) => min + (max - min) * Math.random();

    class Range {
        constructor(min, max = min) {
            this.min = min;
            this.max = max;
        }

        random = (x = 0) => random(x + this.min, x + this.max);

        limit = x => Math.max(this.min, Math.min(this.max, x));
    }

    const cfg = {
        count: new Range(160, 200),
        v0: {
            threshold: 10,
            length: new Range(30, 100),
            variation: new Range(30, 40),
            angle: new Range(-35, 35),
            multiplier: new Range(2, 5)
        },
        size: {
            width: 10,
            height: 6,
            skew: 4,
            wobble: {
                zoom: new Range(4.0, 6.0),
                offset: new Range(-180, 180),
            }
        },
        rotation: { // paper rotation around shifted axis
            zoom: new Range(-2, 2),
            offset: new Range(-180, 180),
            shift: new Range(5, 10)
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
            showFps: true,
            invertColors: false
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
        touches: {},
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

    const getColor = (normal, inverted) => cfg.ui.invertColors ? inverted : normal;

    const getIframe = () => document.getElementById("nc-confetti-everywhere-cfg");

    const createCanvas = () => {
        const canvas = document.createElement("canvas");
        canvas.setAttribute("id", id);
        canvas.style.position = "fixed";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.zIndex = "9000";

        const updateTouch = (id, x, y) => {
            if (runtime.touches[id] === undefined) {
                runtime.touches[id] = {
                    x0: x,
                    y0: y,
                    x1: x,
                    y1: y
                };
            } else {
                runtime.touches[id].x1 = x;
                runtime.touches[id].y1 = y;
            }
        };

        const removeTouch = id => delete runtime.touches[id];

        const onDown = (id, x, y) => updateTouch(id, x, y);

        const onMove = (id, x, y) => {
            if (runtime.touches[id]) {
                updateTouch(id, x, y)
            }
        };

        const onUp = id => {
            const touch = runtime.touches[id];
            if (touch) {
                fire(touch.x0, touch.y0, touch.x1, touch.y1);
                removeTouch(id);
            }
        };

        canvas.addEventListener("mousedown", e => onDown("mouse", e.clientX, e.clientY));
        canvas.addEventListener("mousemove", e => onMove("mouse", e.clientX, e.clientY));
        canvas.addEventListener("mouseup", () => onUp("mouse"));

        canvas.addEventListener("touchstart", e => {
            e.preventDefault();
            [...e.changedTouches].forEach(touch => onDown(touch.identifier, touch.clientX, touch.clientY));
        });
        canvas.addEventListener("touchmove", e => {
            e.preventDefault();
            [...e.changedTouches].forEach(touch => onMove(touch.identifier, touch.clientX, touch.clientY));
        });
        canvas.addEventListener("touchend", e => {
            e.preventDefault();
            [...e.changedTouches].forEach(touch => onUp(touch.identifier));
        });
        canvas.addEventListener("touchcancel", e => {
            e.preventDefault();
            [...e.changedTouches].forEach(touch => removeTouch(touch.identifier));
        });

        document.body.append(canvas);

        runtime.canvas = canvas;
        runtime.ctx = canvas.getContext("2d");

        refreshCanvas();

        if (!extension) {
            const settings = document.getElementById("nc-confetti-everywhere-cfg-toggle");
            settings.addEventListener("click", () => {
                const iframe = getIframe();
                const visible = iframe.classList.toggle("show");
                iframe.classList.toggle("hide");
                if (visible) {
                    sendMessage({ show: true });
                }
            });
        }
    };

    const refreshCanvas = () => {
        if (isVisible()) {
            runtime.canvas.width = window.innerWidth;
            runtime.canvas.height = window.innerHeight;
            runtime.canvas.style.cursor = "crosshair";
            runtime.ctx.font = "9px monospace";
            runtime.ctx.textBaseline = "middle";
            runtime.ctx.textAlign = "center";
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

        if (!extension) {
            canvas.style.backgroundColor = getColor("#fff", "#000");
        }

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

        Object.values(runtime.touches).forEach(touch => {
            ctx.save();
            ctx.strokeStyle = getColor("#000", "#fff");
            ctx.beginPath();
            ctx.arc(touch.x0, touch.y0, 10, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.moveTo(touch.x0, touch.y0);
            ctx.lineTo(touch.x1, touch.y1);
            ctx.stroke();
            ctx.restore();
        });

        if (cfg.ui.showFps) {
            ctx.save();
            ctx.fillStyle = getColor("white", "black");
            ctx.fillRect(0, 0, 90, 20);
            ctx.fillStyle = getColor("black", "white");
            ctx.fillText(`${runtime.fps} FPS | ${runtime.papers.length}`, 45, 10);
            // ctx.fillText(`${window.innerWidth}x${window.innerHeight} | ${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`, 45, 10);
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
        }
        window.requestAnimationFrame(frame);
    }

    const isVisible = () => document.getElementById(id) && runtime.canvas;

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
            const iframe = getIframe();
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
        const defaults = runtime.defaults || await saveCfg(`defaults.v${version}`);
        const configuration = await loadCfg(`configuration.v${version}`);

        sendMessage({
            defaults: defaults,
            configuration: configuration
        });

        runtime.defaults = defaults;
    };

    const show = () => {
        log("show");
        prepare();

        if (!isVisible()) {
            createCanvas();
            frame(0);
        }

        if (runtime.running === false) {
            runtime.papers = [];
            runtime.frameCounter = 0;
            runtime.running = true;
        }

        runtime.canvas.style.display = "block";
        runtime.canvas.style.zIndex = "9000";
    };

    const hide = () => {
        runtime.running = false;
        if (isVisible()) {
            runtime.canvas.style.display = "none";
            runtime.canvas.style.zIndex = "-9000";
        }
    };

    const toggleVisibility = () => {
        if (runtime.running) {
            hide();
        } else {
            show();
        }
        return runtime.running;
    };

    const flatten = (o, results, current) => {
        if (o instanceof Range) {
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

        if (key === "cfg.ui.invertColors" && !extension) {
            document.body.style.backgroundColor = getColor("#fff", "#000");
            if (value) {
                document.getElementById("nc-confetti-everywhere-cfg-toggle").setAttribute("src", "gear-24-white.png");
            } else {
                document.getElementById("nc-confetti-everywhere-cfg-toggle").setAttribute("src", "gear-24-black.png");
            }
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
        } else if (message.size && !extension) {
            const iframe = getIframe();
            iframe.style.width = message.size.width + "px";
            iframe.style.height = message.size.height + "px";
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
            } else if (runtime.running && (e.key.length === 1 || e.key === "Escape")) {
                hide();
            }
        });
    }

    visualViewport.addEventListener("resize", () => {
        if (isVisible()) {
            refreshCanvas();
        }
    });

    startMessageListener();

});
