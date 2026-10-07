# Glass Home — a modern new tab for Chrome

Your Chrome **Bookmarks bar** as large app icons over beautiful free wallpapers, with a frosted-glass look.

## Try it first (no install)
Double-click `newtab.html`. It opens in **Preview mode** with sample bookmarks and real wallpapers.

## Install
1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and select this folder.
3. Open a new tab and choose **Keep it** when Chrome asks.

Chrome will say it can "read data on all websites". That is only used to fetch each bookmarked site's own icon and the wallpapers.

### Updating after a `git pull`
Click the ↻ reload icon on the Glass Home card in `chrome://extensions`, then open a new tab. Your settings are kept.

### Testing tips
- **Load unpacked** is local only; **Remove** undoes it completely.
- To keep your normal new tab untouched, test in a separate Chrome profile.
- Right-click the page → **Inspect** to open DevTools.

## Features

### Layout — everything is movable
- The page is a 3 × 3 grid of spots (top / middle / bottom × left / centre / right).
- Settings opens as a large window with tabs: Layout, Bookmarks, Sections & folders, Clock, Wallpaper.
- **Settings → Layout → Edit layout on page:** drag the clock, the bookmarks, the photo credit or the settings button to any spot.
- Or use the small 3 × 3 pickers next to each item in **Settings → Layout**.
- The clock and the photo credit can be hidden with their switches.
- Defaults: bookmarks in the centre (the main focus), clock top-left, credit bottom-left, settings bottom-right.

### Bookmarks
- Shows your **Chrome Bookmarks bar only**.
- **Sections** you name yourself (e.g. Personal, Work). Add, rename, reorder or delete them in **Settings → Sections**.
- Assign each bookmark to a section (or **Hidden**) in **Settings → Bookmarks bar**, or drag tiles between sections. Click a section title to collapse it.
- **Folders:**
  - **Unpack** a folder (Settings → Bookmarks bar, or **Show on home screen** inside the folder) to show its bookmarks directly on the page. It is still a folder in Chrome.
  - Inside an open folder, hover a bookmark and click **↗** to really move it out of the folder onto your Chrome Bookmarks bar.
- Icons come from each site itself (apple-touch-icon, web-app manifest, then favicon). They are cached locally, and a coloured letter is used when a site has no icon.
- Tile size, icons per row, icon alignment (Auto / Left / Centre / Right), show names, and an optional glass panel behind the bookmarks.

### Clock
- Three styles (Modern, Elegant, Tech), adjustable size, 12/24-hour, optional date, rolling digits.

### Wallpapers (Settings → Wallpaper)
- Themes: Space, Animals, Nature, Mountains, Ocean, Cities, Forest, Flowers, Sky, Mix.
  - Wikimedia Commons *featured pictures*: public domain or free licences, no API key. Credit is shown on the page.
- **Browse gallery** to pick a specific image, or **Next wallpaper**. You can also use your own image.
- **Your wallpaper stays until you change it.** A local copy is saved, so it opens instantly and works offline. Optional auto-change (every tab, hour or day).
- Blur and darken controls. The background never moves with the cursor.

## Files
```
manifest.json      extension manifest (MV3, new-tab override)
newtab.html        page markup + settings panel
css/style.css      all styles
js/main.js         all logic
fonts/             Outfit, Fraunces, Space Grotesk (SIL Open Font License)
assets/            extension icons
```
