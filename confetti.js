(r => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r) : r())(() => {

    let timestamp = 0;

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
        });

        return canvas;
    };

    const canvas = createCanvas();
    const ctx = canvas.getContext("2d");

    const animate = diff => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

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
