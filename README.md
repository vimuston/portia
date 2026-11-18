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

| Keyboard / mouse | Controller | Action |
|---|---|---|
| WASD | Left stick | Walk: up bark, over stone, under leaves |
| Mouse | Right stick | Look and aim |
| C | LT | Toggle sneak |
| Shift | RT | Toggle dash: snap, dart, freeze |
| Hold Space, release | Hold A, release | Aim a leap, then jump to the ring |
| Space in the air | A in the air | Balloon on silk |
| X | B | Tie a dragline; press again to hang, again to cut |
| Hold Q | RB | Pluck a web |
| R | LB | Change the pluck signal |
| Hold F | X | Raise front legs |
| H | Start | Hide the HUD |
| M | | Sound on/off |
| G | | Show the intro again |
| | D-pad | Zoom |

## How to hunt

- **Read:** point at or look at a spider to see its state and how alert it is.
- **Stalk:** sneak, and come from behind or above. If it turns, freeze.
- **Strike:** hold Space, target the spider, then release to leap and attack.

Each prey spider needs its own approach:

- **Scytodes** spits glue at whatever is in front of it. Never approach from the front, unless it's carrying its egg sac.
- **Badumna** hides in a tube. Stand on its sheet, pluck with Q and try signals with R until it comes out. Move when the breeze gusts.
- **Argiope** waits at the hub of its orb web. Sneak along the silk or drop in from above. If it pumps the web, freeze.

## Code layout

`index.html` holds the HUD and a small loader. The game itself lives in `js/*.js` as classic scripts that share one global scope, run in the order listed in `FILES` in `index.html`. `node js/build-hash.mjs` prints the build hash (`window.BUILD`) that debug snapshots carry.

## License

[MIT](LICENSE)
