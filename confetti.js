const id = "nc-confetti-everywhere";

const random = (min, max) => min + (max - min) * Math.random();

const range = (min, max = min) => {
    return {
        min: min,
        max: max,
        random: (x = 0) => random(x + min, x + max),
        limit: x => Math.max(min, Math.min(max, x))
    }
};

const cfg = {
    count: range(60, 80),
    v0: {
        threshold: 10,
        length: range(30, 100),
        variation: range(20, 90),
        angle: range(-Math.PI / 4, Math.PI / 4),
        multiplier: range(3, 5)
    },
    size: {
        width: 10,
        height: 6,
        skew: 4,
        wobble: {
            zoom: range(4.0, 6.0),
            offset: range(-Math.PI, Math.PI),
        }
    },
    rotation: { // paper rotation around shifted axis
        zoom: range(-2, 2),
        offset: range(-Math.PI, Math.PI),
        shift: range(5, 10)
    },
    fade: {
        t0: 2, // [s]
        t1: 3, // [s]
    }
};

// https://www.desmos.com/calculator/zu1mawkfz8
cfg.fade.b = 1 / (1 - (cfg.fade.t0 / cfg.fade.t1));
cfg.fade.a = -cfg.fade.b / cfg.fade.t1;
cfg.fade.f = t => Math.min(1, Math.max(0, cfg.fade.a * t + cfg.fade.b));

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
        this.vX = v0 * Math.cos(angle);
        this.vY = v0 * Math.sin(angle);
        this.vT = 60; // static drag; dynamic drag: this.vT = v0 / 3
        this.x0 = x;
        this.y0 = y;
        this.t = 0;
        this.orientation = Math.sign(random(-1, 1)) || 1;
        this.wobble = {
            zoom: cfg.size.wobble.zoom.random(),
            offset: cfg.size.wobble.offset.random()
        };
        this.color = {
            r: random(0, 255).toFixed(),
            g: random(0, 255).toFixed(),
            b: random(0, 255).toFixed(),
            a: random(0.9, 1),
        };
        this.rotation = {
            zoom: cfg.rotation.zoom.random(),
            offset: cfg.rotation.offset.random(),
            shift: cfg.rotation.shift.random(),
        };
    }
}

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

        const xD = runtime.mouse.x0 - runtime.mouse.x1;
        const yD = runtime.mouse.y1 - runtime.mouse.y0;
        const length = Math.sqrt(xD * xD + yD * yD);

        if (length > cfg.v0.threshold) {
            const count = cfg.count.random();
            for (let i = 0; i < count; i++) {
                const v0 = cfg.v0.multiplier.random() * cfg.v0.variation.random(cfg.v0.length.limit(length));
                const angle = cfg.v0.angle.random(Math.atan2(yD, xD));
                runtime.papers.push(new Paper(runtime.mouse.x0, runtime.mouse.y0, v0, angle));
            }
        }
    });

    document.getElementsByTagName("body")[0].append(canvas);

    runtime.canvas = canvas;
    runtime.ctx = canvas.getContext("2d");
};

const physics = {
    // https://farside.ph.utexas.edu/teaching/336k/Newton/node29.html
    g: 90, // [px/s^2]
    x: paper => paper.x0 + paper.vT * paper.vX * (1 - Math.exp(-physics.g * paper.t / paper.vT)) / physics.g,
    y: paper => paper.y0 - paper.vT * (paper.vY + paper.vT) * (1 - Math.exp(-physics.g * paper.t / paper.vT)) / physics.g + paper.vT * paper.t
};

const animate = diff => {
    const ctx = runtime.ctx;
    const canvas = runtime.canvas;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    runtime.papers.forEach(paper => {
        paper.t += diff / 1000; // V in [px/s]
        paper.x = physics.x(paper);
        paper.y = physics.y(paper);
        paper.color.a = paper.color.a * cfg.fade.f(paper.t);

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

const show = () => {
    if (!document.getElementById(id)) {
        initialize();
    }
    runtime.running = true;
    frame(0);
};

const hide = () => {
    runtime.running = false;
    runtime.papers = [];
    if (document.getElementById(id)) {
        document.getElementById(id).remove();
    }
};

const toggle = () => {
    if (runtime.running) {
        hide();
    } else {
        show();
    }
};

(r => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r) : r())(() => {
    document.addEventListener("keydown", e => {
        if (e.key === "~") {
            toggle();
        }
    });
});
