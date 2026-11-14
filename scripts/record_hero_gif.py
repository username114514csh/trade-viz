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
        await pg.clock.install(time=1_700_000_000_000)
        await pg.clock.pause_at(1_700_000_001_000)  # 冻结虚拟时钟后再加载，地球只随 run_for 前进
        await pg.goto(URL)
        await pg.wait_for_function("window.__heroT0 !== undefined")
        await pg.wait_for_timeout(2500)  # 让 CSS 文字入场动画（真实时间）先走完
        el = await pg.evaluate("performance.now() - window.__heroT0")
        await pg.clock.run_for(max(0, int(1200 - el)))  # 从地球入场将完成时开始录
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
                "-vf", f"{sc},palettegen=max_colors={os.environ.get('COLORS', 128)}:stats_mode=diff", pal], check=True)
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-framerate", str(FPS), "-i", f"{tmp}/f%04d.png", "-i", pal,
                "-lavfi", f"{sc}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle", OUT], check=True)
shutil.rmtree(tmp)
print(OUT, round(os.path.getsize(OUT) / 1e6, 2), "MB")
