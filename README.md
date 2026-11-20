[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/lhwnb/gta6-trophy-guide/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/lhwnb/gta6-trophy-guide/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

# GTA VI Trophy Guide -- Leonida, 55 trophies, one playthrough

A static, offline trophy guide for **Grand Theft Auto VI** (Leonida, Vice City and the Keys, Jason Duval and Lucia Caminos). It is one page with three views:

- **Checklist** -- all 55 trophies with grade badges, a live `n/55` counter, per-trophy tick boxes kept in `localStorage`, a hide-spoilers switch that blurs story text until you click it, and a detail panel on the right that carries the description, the numbered walkthrough, the chapter, the difficulty, the minute estimate, the missable warning and the in-game sources.
- **Roadmap** -- the platinum in seven ordered stages: what to do first, what each stage contains, how many hours it takes, and which lock points fall inside it.
- **Missables** -- the nine trophies that can be lost, with the exact lock point, what to do before it, how to recover if you already crossed it, and where to check the state in game.

Everything runs from disk. No network calls, no CDN, no web fonts, no build step: plain ES5-style JavaScript, one stylesheet, and the data preloaded as `app/data/data.js`.

## Contents

| Path | What it is |
| --- | --- |
| `app/index.html` | The whole app shell: header with progress, filters, three views, detail panes |
| `app/style.css` | Dark theme, tabular numbers, the grid layouts for each view |
| `app/app.js` | Filtering, sorting, ticking, spoiler blur, roadmap and missables rendering, deep links |
| `app/data/trophies.json` | The 55 trophies: official name and description plus grade, chapter, walkthrough, difficulty, minutes, missable, sources, spoiler flag |
| `app/data/roadmap.json` | Seven stages with hours, windows, one-line summaries, per-stage todo lists and lock flags |
| `app/data/missables.json` | The nine missable entries plus the checkpoint advice and the list of what is *not* missable |
| `app/data/data.js` | The same three files bundled into `window.GTA6` so the app also works from `file://` |
| `tools/content-1..4.mjs` | The authored half of the data: walkthrough steps, chapters, difficulty, minutes, sources |
| `tools/roadmap.src.json`, `tools/missables.src.json` | Authored roadmap and missables, keyed by trophy id |
| `tools/orig-trophies.json` | The untouched official list (name, description, grade) the build merges against |
| `tools/build-data.mjs` | Validates everything and writes the four files in `app/data/` |
| `shot.cjs` | Renders the four screenshots over the Chrome DevTools Protocol |
| `screenshots/` | The four 1280x720 JPEGs |
| `serve.ts`, `main.ts` | Static server for local use; packaging step that copies `app/` + `screenshots/` and writes `dossier.json` |

## Run it

```bash
node serve.ts
```

Then open <http://127.0.0.1:8080/>. `serve.ts` serves `app/` only and refuses paths outside it. Opening `app/index.html` straight from the filesystem works too, because the data ships as a script instead of a `fetch()`.

To regenerate the data after editing `tools/`:

```bash
node tools/build-data.mjs
```

To re-render the screenshots (Chrome, headless, JPEG at 1280x720):

```bash
node shot.cjs "file:///<abs path>/app/index.html?done=12" "screenshots/1-checklist.jpg" 1500 1280 720 88 262144
```

## What the data files hold

`trophies.json` is one object per trophy. `name`, `description` and `grade` come from the official list unchanged; `guide` is the walkthrough with numbered lines, `steps` is the same text as an array, `chapter` is one of the seven chapter names, `missable` is a boolean with `missableNote` explaining the lock, `difficulty` is 1-5, `minutes` is a realistic per-trophy estimate, `sources` lists only things a player can verify in game (`Pause > Stats > Trophies`, the mission replay list, the map filters, Social Club), `spoiler` marks guides that narrate story beats, and `order` is the recommended position in the run.

`roadmap.json` holds `first` (the one-page do-this-first list), `assumptions`, the seven `stages` (hours, window, summary, short line, todo list, missable ids, trophy count) and `totalHours`. `missables.json` holds the nine `entries` with `lockPoint`, `lockDetail`, `action`, `recovery` and `severity`, plus `checkpointAdvice` and `notMissable`.

## How the roadmap was built

The list was split by chapter availability, not by trophy type, because the only thing that actually ends a trophy's window is a chapter card or a mission start. Every trophy was placed in the stage where it first becomes available, the nine lock points were pulled out into their own file and cross-checked against the stages that contain them, and the leftover "survives the credits" work was pushed into a single cleanup stage at the end.

Hours per stage are the sum of the per-trophy minute estimates for the trophies that stage adds, rounded to the nearest half hour, plus the driving between them: 0.5 + 9 + 11 + 13 + 10 + 3 + 23 = **69.5 hours**, so the roadmap claims about 70 hours for one careful playthrough. A second run to recover a missed missable adds roughly 20 hours, which is the reason the missables view exists at all. Difficulty is a 1-5 judgement per trophy (5 = the 250-stunt grind and the 100% checklist), and the sort control uses it so the checklist can be read as a plan rather than as a list.

<sub>Entered on [make.fun](https://make.fun/?ref=7d4kyrhq&utm_source=github&utm_medium=readme)</sub>
