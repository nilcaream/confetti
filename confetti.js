(r => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r) : r())(() => {

    const random = (min, max) => min + (max - min) * Math.random();

    const range = (min, max) => {
        return {
            min: min,
            max: max,
            random: (x = 0) => random(x + min, x + max),
            limit: x => Math.max(min, Math.min(max, x))
        }
    };

    const cfg = {
        count: range(30, 60),
        v0: {
            length: range(10, 100),
            variation: range(0, 50),
            angle: range(-Math.PI / 2, Math.PI / 2)
        }
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
        }
    };

    class Paper {
        constructor(x, y, v0, angle) {
            this.x = x;
            this.y = y;
            this.vX = v0 * Math.cos(angle);
            this.vY = v0 * Math.sin(angle);
            this.x0 = x;
            this.y0 = y;
            this.t = 0;
        }
    }


    const createCanvas = () => {
        const canvas = document.getElementById("canvas");
        canvas.setAttribute("width", window.innerWidth.toString());
        canvas.setAttribute("height", window.innerHeight.toString());
        canvas.style.position = "fixed";
        canvas.style.top = "0";
        canvas.style.left = "0";

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

            if (length > cfg.v0.length.min) {
                const count = cfg.count.random();
                for (let i = 0; i < count; i++) {
                    const v0 = cfg.v0.variation.random(cfg.v0.length.limit(length));
                    const angle = cfg.v0.angle.random(Math.atan2(yD, xD));
                    runtime.papers.push(new Paper(runtime.mouse.x0, runtime.mouse.y0, v0, angle));
                }
            }
        });

        return canvas;
    };

    const canvas = createCanvas();
    const ctx = canvas.getContext("2d");

    const physics = {
        g: 90, // [px/s^2]
        x: paper => paper.x0 + paper.vX * paper.t,
        y: paper => paper.y0 - paper.vY * paper.t + 0.5 * physics.g * paper.t * paper.t
    };

    const animate = diff => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        runtime.papers.forEach(paper => {
            // V in [px/s]
            paper.t += diff / 1000;
            paper.x = physics.x(paper);
            paper.y = physics.y(paper);

            ctx.save();
            ctx.translate(paper.x, paper.y);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(10, 0);
            ctx.lineTo(10, 10);
            ctx.lineTo(0, 10);
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

        runtime.papers = runtime.papers.filter(p => p.y < canvas.height);

        ctx.save();
        ctx.fillText(`${(1000 / diff).toFixed(0)} FPS | ${runtime.papers.length}`, 20, 20);
        ctx.restore();
    };

    const frame = now => {
        animate(now - runtime.time);
        runtime.time = now;
        window.requestAnimationFrame(frame);
    }

    frame(0);

});
