# Glass Home — handoff for Claude Code

A Chrome **new-tab extension** (Manifest V3, plain HTML/CSS/JS, no build step). It shows the user's **Chrome Bookmarks bar** as large iOS-style glass app icons over free wallpapers, with a clock. The user is Manoj. He wants minimal explanation and output he can copy and paste.

- Repo: `~/Documents/GitHub/glass-chrome-home` (git, branch `main`, remote `origin`)
- Loaded in Chrome with **Load unpacked** from that folder. After any file change, click **↻ on the Glass Home card in `chrome://extensions`** and open a new tab.
- Unpacked extension ID (derived from the path): `dbipfejbmeghckikkecbinfdbiimmbmk`, so the page is `chrome-extension://dbipfejbmeghckikkecbinfdbiimmbmk/newtab.html`. Verify it in `chrome://extensions`.
- Preview without the extension: open `newtab.html` directly (file://). `isExt` is false, so it uses the sample `DEMO` bookmarks and `localStorage`.

---

## 1. Open items (do these first)

### A. Right-click menu on icons: built, NOT tested, NOT in the repo
The patch is `right-click-menu.patch` (next to this file). Apply it from the repo root:
```
git apply right-click-menu.patch      # or: patch -p1 < right-click-menu.patch
```
What it adds:
- `#ctx`, a glass context menu on `contextmenu` over any `.tile`. Each tile stores its node as `el._node` in `makeTile`.
- Menu items:
  - Open in new tab (Open folder, for folders)
  - **Edit name & URL…** (Rename folder…): opens the `#editDlg` form and calls `chrome.bookmarks.update(id, {title, url})`. The URL gets `https://` added if no scheme is given.
  - Move to <section>: only when there is more than one section, and not inside the folder sheet
  - Hide from home screen
  - Refresh icon
  - **Delete…**: an in-page two-click confirm (the button turns red, "Click again to delete"); uses `chrome.bookmarks.remove` or `removeTree`. No `confirm()` dialogs.
- Helpers `bm.update` and `bm.remove` (they also mutate `DEMO` in preview mode), and `afterBookmarkChange()` to re-render the grid, the settings list and the open folder.
- Esc closes the menu, then the edit dialog. The menu also closes on outside pointerdown, window blur, or stage scroll.

To test (headless Chromium with `--load-extension` works well; see §6):
1. Right-click a tile, check the menu, edit the name and URL, and confirm the Chrome bookmark changed.
2. Move to a section, hide, and delete (check both clicks of the confirm).
3. Right-click a tile inside an open folder; there should be no section or hide items.

Then commit.

### B. Icon alignment: user says it is not behaving as expected (unresolved)
- Setting: `S.align` = `auto | start | center | end`, set in Settings → Bookmarks → Icon alignment (`#setAlign` segmented control). `applyVars()` puts it on `body[data-align]`.
- **Current behaviour:** CSS sets `justify-content` on `.sec-grid` (the icon grid). The grid's width is fixed at `min(--bm-w, 100vw - 130px)`, where `--bm-w = cols × cell + gaps` comes from **Icons per row** (`S.cols`, default 8). Section-header lines also change per alignment.
- **User's complaint:** "section header is getting changed with alignment, not the icon rows". With full rows there is no spare space inside the grid, so the icons don't visibly move.
- **The user rejected** making the block span the whole page ("no no not across the page"). That attempt (a `row[data-bmwide]` approach) was reverted.
- **Next step:** look at the user's actual new tab first, as he asked ("test first with existing, then decide"). Find out how many icons per row he has against `S.cols`, and where he expects the rows to sit. One likely good fix: shrink the grid to the width its content actually needs (e.g. `cols = min(S.cols, items)` for each section), then align that block within the bookmarks widget. Short and long sections would then share a common left, centre or right edge. Confirm with him before building.

### C. Peek behaviour (just added, already in the repo)
When a setting changes, the Settings window fades to 14% opacity for about 1.4 s (`.settings-overlay.peek`) so the change is visible behind it. Check that the user likes it.

---

## 2. Files
```
manifest.json      MV3; chrome_url_overrides.newtab = newtab.html
                   permissions: bookmarks, storage, unlimitedStorage, favicon
                   host_permissions: <all_urls>   (site icons + wallpapers)
newtab.html        3×3 layout stage, widgets, folder sheet, gallery, settings window
css/style.css      all styles (glass tokens in :root)
js/main.js         all logic, one IIFE (~1300 lines)
fonts/             outfit.woff2, fraunces.woff2, space-grotesk.woff2 (OFL, bundled)
assets/            icon16/48/128.png
README.md          user-facing docs
```

## 3. Architecture (js/main.js, top to bottom)
- **Settings `S`**: stored in `chrome.storage.local` under the key `settings` (or `localStorage` in preview). `save()` is debounced. `DEFAULTS` holds every key. On boot there is a migration block (`S.v = 3`) and nested defaults are merged for `layout` and `show`.
- **Clock**: `renderClock()`. Each digit is a `.slot` and rolls when it changes. Styles: `body[data-font=modern|elegant|tech]`. Size uses `--clock-size`. *Note:* the clock digit class is `.slot`; layout cells are `.cell`. Don't reuse `.slot`, which caused a clipping bug earlier.
- **Wallpapers**:
  - Source: Wikimedia Commons featured pictures via `commons.wikimedia.org/w/api.php` (generator=search, `incategory:Featured_pictures_on_Wikimedia_Commons`).
  - `CATS` holds themes (space, animals, nature, mountains, ocean, cities, forest, flowers, sky), plus `mix` and `custom`.
  - Pools are cached as `pool3_<cat>` for 7 days. Image widths are snapped to 1920, 2560 or 3840 (the sizes Wikimedia keeps ready).
  - Loading is progressive: the 500px thumb shows first, then the full image (`showSeq` guards the order).
  - The chosen wallpaper is stored as `wp`, plus a **local dataURL copy `wpData`**. It **stays until changed** (default `rotate: 'never'`).
  - Two background layers `#bgA`/`#bgB` crossfade. No parallax or zoom; the user asked for a static background.
- **Site icons**: `resolveIcon()` parses the site's HTML for apple-touch-icon, manifest icons, SVG or `rel=icon`, then falls back to `/apple-touch-icon.png`, `/favicon.ico`, and finally Chrome's `_favicon` API.
  - Results are rasterized to a 256px PNG dataURL and cached in storage as `icons` (by origin; 14 days, or 2 days for misses).
  - Opaque square icons get the `.full` class (edge-to-edge). A coloured letter is the last fallback.
  - Queue concurrency is 5.
- **Bookmarks**:
  - `children('1')` returns the Bookmarks bar.
  - `barItems()` swaps each **unpacked** folder (`S.unpack`) for its children, tagged with `_from`.
  - Order: `S.order`. Sections: `S.sections = [{id,name}]`. `S.assign[id] = sectionId | 'hidden'`. Unpacked children inherit their folder's assignment (`secOf`).
  - Drag a tile to reorder, or between sections (`placeDragged`; it captures `dragId` before any await, which fixed a race).
  - The folder sheet has **Show on home screen** (unpack) and a **↗** button on each tile, which really moves the bookmark to the bar via `chrome.bookmarks.move`.
- **Layout**:
  - `#stage` has 3 `.row`s (top, middle, bottom), each with 3 `.cell[data-slot=row-col]`.
  - Widgets (`clock`, `bookmarks`, `credit`, `settings`) are moved into cells by `placeWidgets()` from `S.layout`. `S.show` toggles the clock and credit.
  - A row with a centre item uses `1fr auto 1fr`; otherwise `auto 1fr auto`.
  - Settings → Layout has a 3×3 `.pos-picker` per widget, and **Edit layout on page** (`body.editing`): drag a widget onto a dashed cell using pointer events and a ghost clone.
  - Defaults: bookmarks `middle-center`, clock `top-left`, credit `bottom-left`, settings `bottom-right`.
- **Settings UI**: a large centred window (`#settings.settings-overlay.open`).
  - Sidebar tabs (`.nav-item[data-tab]`): layout, bookmarks, sections, clock, wallpaper. The last tab is remembered in `localStorage.gh_tab`.
  - Close it by clicking the backdrop, the ✕, or pressing Esc.
  - The gallery (`#gallery`, z 40) opens above Settings.

## 4. Settings keys (S)
`font, clock24, clockSize, showDate, cat, rotate, blur, dim, tile (120), cols (8), align, panel, labels, layout{bookmarks,clock,credit,settings}, show{clock,credit}, sections[], assign{}, collapsed[], order[], unpack[], v`

## 5. User preferences and history (what he asked for)
- Glass / iOS style. Modern UI with animations. **Bookmarks are the main focus**; the clock is secondary and can be moved.
- Bookmarks bar only. Real site icons. Large tiles. **No search bar. No greeting.** Better fonts for time and date.
- Themed wallpapers (space, animals…) from free, non-copyright sources. **The wallpaper must stay until he changes it. The background must not move with the cursor.**
- Sections (Personal / Work). Folders can be unpacked, or bookmarks moved out of them.
- **No bottom dock.** Wallpaper controls live in Settings.
- **Everything's position is customisable.**
- **Settings drawer was too small:** replaced with the large centred window.
- Wants to work in git so he can use it on several computers.
- Prefers short, direct replies.

## 6. Testing tips
- Headless Chromium with the extension:
  ```python
  ctx = await p.chromium.launch_persistent_context(profile, headless=True, channel='chromium',
        args=[f'--disable-extensions-except={EXT}', f'--load-extension={EXT}'], viewport={'width':1440,'height':900})
  pg = await ctx.new_page(); await pg.goto('chrome://newtab/')
  # seed: await pg.evaluate("chrome.bookmarks.create({parentId:'1',title:'GitHub',url:'https://github.com'})")
  # settings: chrome.storage.local.set({settings:{...}})
  ```
- `node --check js/main.js` catches syntax errors.
- Claude in Chrome **cannot** open `chrome://newtab`, `chrome-extension://` or `file://` pages. To see the user's real page, use screen capture with his permission, or ask him for a screenshot.

## 7. Commit
```
cd ~/Documents/GitHub/glass-chrome-home
git add -A && git commit -m "<message>" && git push
```
