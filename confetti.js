const id = "nc-confetti-everywhere";

const log = m => console.log(`[${id}] ${m}`);

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
    count: range(60, 80),
    v0: {
        threshold: 10,
        length: range(30, 100),
        variation: range(20, 90),
        angle: range(-45, 45),
        multiplier: range(3, 5)
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
        t0: 2, // [s]
        t1: 3, // [s]
    },
    physics: {
        g: 90, // [px/s^2]
        vT: 60
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
    running: false
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
            a: random(0.9, 1),
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

const initialize = () => {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("width", window.innerWidth.toString());
    canvas.setAttribute("height", window.innerHeight.toString());
    canvas.setAttribute("id", id);
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.zIndex = "99999";

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

    runtime.papers = runtime.papers.filter(p => p.y < canvas.height && p.color.a > 0);

    ctx.save();
    ctx.fillText(`${(1000 / diff).toFixed(0)} FPS | ${runtime.papers.length}`, 20, 20);
    ctx.restore();
};

const frame = now => {
    if (runtime.running) {
        animate(now - runtime.time);
        runtime.time = now;
        window.requestAnimationFrame(frame);
    }
}

const isVisible = () => document.getElementById(id) !== null;

const show = () => {
    if (!isVisible()) {
        initialize();
        runtime.running = true;
        frame(0);
    }
};

const hide = () => {
    runtime.running = false;
    setTimeout(() => {
        runtime.papers = [];
        if (isVisible()) {
            document.getElementById(id).remove();
        }
    }, 200);
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
}

const getFlattenCfg = () => {
    const results = {};
    flatten(cfg, results, "cfg");
    return results;
};

const isExtension = () => (chrome || {}).storage !== undefined;

const loadCfg = () => {
    if (isExtension()) {
        chrome.storage.local.get(["configuration"]).then(result => {
            if (result.configuration) {
                Object.entries(result.configuration).forEach(([key, value]) => {
                    log(`storage configuration: ${key} = ${value}`);
                    updateCfg(key, value);
                });
            }
        });
    }
};

const saveCfg = () => {
    if (isExtension()) {
        chrome.storage.local.set({ configuration: getFlattenCfg() });
    }
};

const autofire = () => {
    show();

    const x0 = 0.5 * runtime.canvas.width;
    const y0 = 0.75 * runtime.canvas.height;
    const x1 = x0;
    const y1 = y0 + cfg.v0.length.random();

    fire(x0, y0, x1, y1);
};

const monitorCfgChanges = () => {
    if (isExtension()) {
        chrome.runtime.onMessage.addListener(r => {
            log(`received ${JSON.stringify(r)}`);
            if (r.update) {
                updateCfg(r.update.key, r.update.value);
                saveCfg();
            } else if (r.autofire && runtime.papers.length === 0) {
                autofire();
            }
        });
    }
};

(r => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r) : r())(() => {
    document.addEventListener("keydown", e => {
        if (e.key === "~") {
            toggleVisibility();
        }
    });

    loadCfg();
    monitorCfgChanges();

});
