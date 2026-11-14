"""Take screenshots of each act. usage: python shots.py URL OUTDIR"""
import sys, asyncio
from playwright.async_api import async_playwright
URL, OUT = sys.argv[1], sys.argv[2]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1.5)
        errs = []; pg.on("console", lambda m: m.type == "error" and errs.append(m.text)); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_function("window.__ready"); await pg.wait_for_timeout(4500)
        await pg.screenshot(path=f"{OUT}/1_hero.png")
        async def at(sel, idx, name, wait=1800):
            await pg.evaluate(f"""(()=>{{const s=document.querySelectorAll('{sel}')[{idx}];const sec=s.closest('section');const r=s.getBoundingClientRect();window.scrollTo(0, Math.max(sec.getBoundingClientRect().top+scrollY, r.top+scrollY+r.height/2-innerHeight/2))}})()""")
            await pg.wait_for_timeout(wait); await pg.screenshot(path=f"{OUT}/{name}.png")
        await at("#breadth .step", 0, "2a_1995"); await at("#breadth .step", 3, "2b_2024")
        await at("#depth .step", 0, "3a_depthmap"); await at("#depth .step", 1, "3b_strip"); await at("#depth .step", 2, "3c_scatter")
        for sel, name in [("#cases", "4_slope"), ("#after", "5_after"), ("#after .two-col:nth-of-type(2)", "5b_median"), (".conclusion", "6_conclusion")]:
            await pg.evaluate(f"document.querySelector('{sel}').scrollIntoView()"); await pg.wait_for_timeout(800)
            await pg.screenshot(path=f"{OUT}/{name}.png")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
