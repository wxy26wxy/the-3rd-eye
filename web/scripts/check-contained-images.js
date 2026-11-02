// Browser check (paste into the devtools console, or run with chrome-devtools evaluate_script) for
// R1 "never cropped": every `object-fit: contain` image must sit inside its parent box. A grid-item
// <img> keeps `min-height: auto` unless the CSS sets `min-height: 0`, and a tall sticker preview then
// grows past an `overflow: hidden` picture and is cut off. Prints the offenders; [] means all fit.
(() => {
  const bad = [];
  for (const img of document.querySelectorAll("img")) {
    if (getComputedStyle(img).objectFit !== "contain" || !img.offsetParent) continue;
    const i = img.getBoundingClientRect();
    const p = img.parentElement.getBoundingClientRect();
    if (i.width - p.width > 1 || i.height - p.height > 1) {
      bad.push({ src: img.currentSrc.split("/").slice(-2).join("/"), img: `${Math.round(i.width)}x${Math.round(i.height)}`, box: `${Math.round(p.width)}x${Math.round(p.height)}` });
    }
  }
  console.table(bad);
  return bad;
})();
