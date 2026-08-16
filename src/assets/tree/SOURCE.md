# Old Duolingo tree icons

This is the skill-icon set from the Duolingo learning tree. Duolingo used this
tree from approximately 2018 to 2022. The crown levels showed as segments of a
ring around each circle. Duolingo replaced the tree with the Path in 2022.

Open `index.html` in a browser to look at all the icons.

## What is in this package

| Folder | Contents |
| --- | --- |
| `skill-icons/unlocked/` | 54 glyphs. Full colour. These go on a coloured circle. |
| `skill-icons/gold/` | 56 glyphs. Gold. These are the completed (legendary) skills. |
| `skill-icons/locked/` | 56 glyphs. Grey. These are the locked skills. |
| `sprites/` | The 5 original sprite sheets. No changes. |
| `library/` | 118 other Duolingo assets. See below. |
| `index.html` | A browsable sheet of all the icons. |
| `manifest.json`, `manifest.csv` | The index, name and grid position of each icon. |

Each variant folder has three formats:

- `svg/` — vector. Use this format if you can.
- `png-110/` — raster at 110 x 110 px. This is the native size.
- `png-512/` — raster at 512 x 512 px.

The file names have this format: `NN_name.svg`. `NN` is the grid index.
Example: `40_gear.svg`.

## The two missing glyphs

The `unlocked` set has 54 files, but the `gold` and `locked` sets have 56.
Cells 24 (`punctuation`) and 37 (`skull`) are empty in the colour sprite sheet.
The source file has no artwork in these two cells. Use the gold or the locked
version of these two icons.

## Circle colours

The glyphs are transparent. Duolingo drew them on a coloured circle. These are
the colours:

| Name | Hex |
| --- | --- |
| red | `#dd381d` |
| green | `#7eb530` |
| blue | `#1caff6` |
| purple | `#9b5fca` |
| orange | `#fa811b` |
| legendary | `#5c6cfc` |
| locked grey | `#f0f0f0` |
| gold | `#fbb430` |

The gold circle used a diagonal stripe gradient:

```css
background: linear-gradient(135deg,#fbb430,#fbb430 26%,#faa919 0,#faa919 39%,
  #fbb430 0,#fbb430 52%,#faa919 0,#faa919 57%,#fbb430 0,#fbb430 78%,
  #faa919 0,#faa919 90%,#fbb430 0,#fbb430);
```

## The sprite grid

Each sprite sheet is 1100 x 1100 units. The grid has 10 columns and 6 used
rows. Each cell is 110 x 110 units. The index counts from 1, from left to
right, then from top to bottom. Cell 53 is empty in all three sheets.

To find an icon in a sheet, use this rule:

```
row = (index - 1) / 10        (integer division)
col = (index - 1) % 10
x   = col * 110
y   = row * 110
```

## The names

The `name_source` column in the manifest shows where each name comes from:

- `duome` — the name comes from a comment in the duome.eu stylesheet.
  Icons 31 to 57 have these names.
- `visual` — I identified the icon from its picture. Icons 1 to 30 have these
  names. Change a name if you do not agree with it.

## The library folder

| Folder | Count | Contents |
| --- | --- | --- |
| `owl-trophies/` | 47 | The gold owl trophy for each language course. |
| `ui/` | 42 | Hearts, chests, keys, streak flame, lingots, XP, and more. |
| `league-badges/` | 12 | Bronze to Obsidian league badges. |
| `patreon/` | 7 | duome.eu Patreon marks. |
| `crowns/` | 5 | Crown icons and the legendary crown. |
| `flags/` | 5 | Language flags and the flag sprite sheet. |

## Source and rights

I scraped these files from `duome.eu/x/`. duome.eu is an unofficial Duolingo
statistics site. The artwork is the property of Duolingo, Inc.

Use these files for personal projects, archives, and reference. Do not sell
them. Do not present them as your own work.

## How I made the icon files

1. I found the three sprite sheets in the duome.eu stylesheet.
2. I read the CSS rules that give the grid position of each icon.
3. I downloaded the sheets and parsed the XML.
4. I calculated the bounding box of each shape.
5. I put each shape in a cell of the 110 x 110 grid.
6. I wrote one SVG file for each cell. A `translate` moves the shape to the
   origin. The shape data does not change.
7. I made the PNG files with cairosvg.
