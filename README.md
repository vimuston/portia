# Portia

*Portia labiata: the spider that hunts spiders.*

A browser game where you play a jumping spider a few millimetres long, hunting in the leaf litter and undergrowth of a jungle floor. Watch what moves, feel what trembles in the silk, follow what smells. Most of it can kill you.

Built with [three.js](https://threejs.org/) and plain JavaScript. There is no build step and nothing to install.

## Running it

The game loads its scripts with `fetch`, so it has to be served over HTTP. Opening `index.html` straight from disk won't work. Any static file server will do, for example:

```sh
python -m http.server 8000
```

Then open <http://localhost:8000>. You need an internet connection the first time, because three.js and the fonts come from CDNs.

## Controls

The in-game legend shows whichever scheme you used last.

| Keyboard / mouse | Controller | Action |
|---|---|---|
| WASD | Left stick | Walk: up bark, over stone, under leaves. A or D alone (stick held sideways) sidles: eyes kept front, she slips sideways in quick shoves |
| Mouse | Right stick | Look (the mouse also aims) |
| C | RT or click left stick | Toggle sneak |
| Shift | LT | Toggle dash: snap, dart, freeze |
| Hold Space, release | Hold A, release | Aim a leap, then jump to the ring (left stick moves the ring while A is held) |
| Hold Shift while aiming | Hold LT while aiming | Slow motion for the leap, until you let go or she lands |
| Space in the air | A in the air | Balloon on silk |
| X | B | Tie a dragline; press again to hang, again to cut |
| Hold Q | RB | Pluck a web |
| R | LB | Change the pluck signal |
| Hold F | X | Raise front legs |
| H | Start | Hide the HUD |
| M | | Sound on/off |
| T | Y | Field notes: the tutorial on its own leaf; press again to leave it |
| | D-pad | Zoom |

## Field notes

The first time you play, Portia wakes on a broad leaf high above the forest floor, and a narrated tutorial teaches one thing at a time: walking, the underside of a leaf, stalking, dashing, leaping, ballooning, the slow-motion leap, the dragline, catching a fly, why leaping straight at an orb-weaver fails, and luring one out by plucking its web from the safe rim. Fall off and she is set back on her leaf. The last lesson drops her into the forest; T takes her back up any time.

## How to hunt

- **Read:** point at or look at a spider to see its state and how alert it is.
- **Stalk:** sneak, and come from behind or above. If it turns, freeze.
- **Strike:** hold Space, target the spider, then release to leap and attack.

Each prey spider needs its own approach:

- **Scytodes** spits venomous glue at whatever comes onto its leaf in front of it, or leaps at its face. Once glued you can't get free: it walks round to your back and bites. Approach from behind or drop from above.
- **Badumna** hides in a tube. Stand on its sheet, pluck with Q and try signals with R until it comes out. Move when the breeze gusts.
- **Argiope** waits at the hub of its orb web. Leap at it while it rests and it drops away on its dragline, and a leap that comes down in the sticky spiral glues you fast. Land on the frame at the rim, pluck to draw it out, and strike while it hunts the signal. If it pumps the web, freeze.

## Code layout

`index.html` holds the HUD and a small loader. The game itself lives in `js/*.js` as classic scripts that share one global scope, run in the order listed in `FILES` in `index.html`. `node js/build-hash.mjs` prints the build hash (`window.BUILD`) that debug snapshots carry.

## License

[MIT](LICENSE)
