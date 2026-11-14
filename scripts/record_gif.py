"""Record the breadth-map autoplay to webm, then crop + convert to GIF (<5MB). usage: python record_gif.py URL OUTDIR"""
import sys, asyncio, glob, os, subprocess, json
from playwright.async_api import async_playwright
URL, OUT = sys.argv[1], sys.argv[2]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1280, "height": 760}, record_video_dir=f"{OUT}/tmp", record_video_size={"width": 1280, "height": 760})
        pg = await ctx.new_page()
        await pg.goto(URL + "?autoplay&delay=1500&speed=360")
        await pg.wait_for_function("window.__ready")
        box = await pg.evaluate("(()=>{const r=document.querySelector('#breadth .graphic').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()")
        await pg.wait_for_timeout(15000)
        await ctx.close(); await b.close()
    vid = max(glob.glob(f"{OUT}/tmp/*.webm"), key=os.path.getmtime)
    json.dump({"box": box, "vid": vid}, open(f"{OUT}/tmp/rec.json", "w"))
    print(box, vid)
asyncio.run(main())
