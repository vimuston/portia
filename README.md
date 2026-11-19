# Portia

*Portia labiata: the jumping spider that hunts spiders.*

A browser game where you play a jumping spider a few millimetres long, hunting in the leaf litter and undergrowth of a jungle floor. Watch what moves, feel what trembles in the silk, follow what smells. Most of it can kill you.

Built with [three.js](https://threejs.org/) and plain JavaScript. There is no build step and nothing to install.

## Running it

The game loads its scripts with `fetch`, so it has to be served over HTTP. Opening `index.html` straight from disk won't work. Any static file server will do, for example:

```sh
python -m http.server 8000
```

Then open <http://localhost:8000>. You need an internet connection the first time, because three.js and the fonts come from CDNs.

## Field notes

The first time you play, Portia wakes on a broad leaf high above the forest floor, and a narrated tutorial teaches one thing at a time: walking, the underside of a leaf, stalking, dashing, leaping, ballooning, the slow-motion leap, the dragline, catching a fly, why leaping straight at an orb-weaver fails, and luring one out by plucking its web from the safe rim. Fall off and she is set back on her leaf. The last lesson drops her into the forest; T takes her back up any time.

## Code layout

`index.html` holds the HUD and a small loader. The game itself lives in `js/*.js` as classic scripts that share one global scope, run in the order listed in `FILES` in `index.html`. `node js/build-hash.mjs` prints the build hash (`window.BUILD`) that debug snapshots carry.

## License

[MIT](LICENSE)
