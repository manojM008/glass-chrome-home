# Glass Home v2 — modern new tab for Chrome

## Try it first (no install)
Double-click `newtab.html`. It opens in your browser in **Preview mode** with sample bookmarks and real wallpapers.
Site icons in preview come from a public icon service. The installed version reads them from each site.

## Install
1. Unzip this folder.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. If v1 is installed, remove it. Then click **Load unpacked** and select the `glass-home` folder.
4. Open a new tab and choose **Keep it** when Chrome asks.

Chrome will say it can "read data on all websites". That access is only used to fetch each bookmarked site's own icon and the wallpapers.

## Developer testing tips
- **Load unpacked** is local only. Nothing is published, and **Remove** undoes it completely.
- After editing files, click the ↻ reload icon on the extension's card in `chrome://extensions`, then open a new tab.
- To keep your normal new tab untouched, test in a separate Chrome profile: profile icon → **Add** → load it there.
- Right-click the new tab → **Inspect** opens DevTools for debugging.

## Features
- Clock in 3 styles (Modern, Elegant, Tech), with rolling digits and 12/24-hour options. Date shown in a glass pill.
- Shows your **Chrome Bookmarks bar only**, split into **sections** you name yourself (e.g. Personal, Work).
  - Add, rename, reorder, or delete sections in Settings → Sections.
  - Assign each bookmark to a section (or hide it) in Settings → Bookmarks bar, or drag tiles between sections.
  - Click a section title to collapse it.
- Icons come from each site itself (apple-touch-icon, web-app manifest, then favicon). They are cached locally, and a coloured letter is used when a site has no icon.
- Large tiles (80–160 px) with a 3D tilt and glare on hover, a ripple on click, and a staggered entrance. Folders open as a glass sheet.
- **Drag tiles** to rearrange them. This only changes the order on this page, not in Chrome's bookmarks.
- Wallpaper themes in the dock: Space, Animals, Nature, Mountains, Ocean, Cities, Forest, Flowers, Sky, Mix.
  - Images are Wikimedia Commons *featured pictures*, which are public domain or free-licensed. Credit is shown bottom-left.
  - The gallery button lets you pick a specific image. ↻ loads the next one.
  - **Your wallpaper stays until you change it** (theme button, ↻, gallery, or your own image). A local copy is saved, so it opens instantly and works offline.
  - Optional auto-change (every tab, hour, or day) is in Settings. Blur, darken, and your own image are there too.
  - The background stays still. It does not move with the cursor.
