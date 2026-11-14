"""Record the hero globe frame-by-frame on a virtual clock (smooth even if rendering is slow), then convert to GIF.
usage: python record_hero_gif.py URL OUT.gif [fps=12] [seconds=10.5] [width=800]"""
import sys, asyncio, os, subprocess, tempfile, shutil
from playwright.async_api import async_playwright

URL, OUT = sys.argv[1], sys.argv[2]
FPS = int(sys.argv[3]) if len(sys.argv) > 3 else 12
SEC = float(sys.argv[4]) if len(sys.argv) > 4 else 10.5
WIDTH = int(sys.argv[5]) if len(sys.argv) > 5 else 800


async def main(tmp):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=1)
        await pg.clock.install()
        await pg.goto(URL)
        for _ in range(300):
            if await pg.evaluate("!!window.__ready"):
                break
            await pg.clock.run_for(50)
        await pg.wait_for_timeout(2500)  # 让 CSS 文字入场动画（真实时间）先走完
        n = int(FPS * SEC)
        for i in range(n):
            await pg.clock.run_for(round(1000 / FPS))
            await pg.screenshot(path=f"{tmp}/f{i:04d}.png")
        await b.close()


tmp = tempfile.mkdtemp()
asyncio.run(main(tmp))
pal = f"{tmp}/pal.png"
sc = f"scale={WIDTH}:-1:flags=lanczos"
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-framerate", str(FPS), "-i", f"{tmp}/f%04d.png",
                "-vf", f"{sc},palettegen=max_colors=128:stats_mode=diff", pal], check=True)
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-framerate", str(FPS), "-i", f"{tmp}/f%04d.png", "-i", pal,
                "-lavfi", f"{sc}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle", OUT], check=True)
shutil.rmtree(tmp)
print(OUT, round(os.path.getsize(OUT) / 1e6, 2), "MB")
