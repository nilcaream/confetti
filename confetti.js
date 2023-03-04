(r => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r) : r())(() => {

    let timestamp = 0;

    const papers = [];

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

    const mouse = {
        x0: 0,
        y0: 0,
        x1: 0,
        y1: 0,
        click: false
    };

    const createCanvas = () => {
        const canvas = document.getElementById("canvas");
        canvas.setAttribute("width", window.innerWidth.toString());
        canvas.setAttribute("height", window.innerHeight.toString());
        canvas.style.backgroundColor = "rgba(255,255,255,0.5)";
        canvas.style.position = "fixed";
        canvas.style.top = "0";
        canvas.style.left = "0";

        canvas.addEventListener("mousedown", e => {
            mouse.x0 = e.clientX;
            mouse.y0 = e.clientY;
            mouse.x1 = e.clientX;
            mouse.y1 = e.clientY;
            mouse.click = true;
        });

        canvas.addEventListener("mousemove", e => {
            if (mouse.click) {
                mouse.x1 = e.clientX;
                mouse.y1 = e.clientY;
            }
        });

        canvas.addEventListener("mouseup", () => {
            mouse.click = false;

            const xD = mouse.x0 - mouse.x1;
            const yD = mouse.y1 - mouse.y0;
            const v0 = Math.sqrt(xD * xD + yD * yD);
            const angle = Math.atan2(yD, xD);

            for (let i = 0; i < 50; i++) {
                papers.push(new Paper(mouse.x0, mouse.y0, v0, angle));
            }
        });

        return canvas;
    };

    const canvas = createCanvas();
    const ctx = canvas.getContext("2d");

    const animate = diff => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        papers.forEach(paper => {
            paper.t += diff;
            paper.x = paper.x0 + paper.vX * paper.t * 0.01;
            paper.y = paper.y0 - paper.vY * paper.t * 0.01;

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

        if (mouse.click) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(mouse.x0, mouse.y0, 10, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.moveTo(mouse.x0, mouse.y0);
            ctx.lineTo(mouse.x1, mouse.y1);
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.fillText(`${(1000 / diff).toFixed(0)} FPS`, 20, 20);
        ctx.restore();
    };

    const frame = time => {
        animate(time - timestamp);
        timestamp = time;
        window.requestAnimationFrame(frame);
    }

    frame(0);

});
