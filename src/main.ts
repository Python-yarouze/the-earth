import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/instrument-serif/400.css";
import { Game } from "./app";
import { World } from "./render/world";
import { Hud } from "./ui/hud";
import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#view");
const hudRoot = document.querySelector<HTMLElement>("#hud");
if (!canvas || !hudRoot) {
  throw new Error("Missing #view or #hud");
}

hudRoot.innerHTML = `<section class="overlay center"><p class="kicker">THE EARTH</p><p class="lead">宇宙を読み込んでいます…</p></section>`;

const world = await World.create(canvas);
const hud = new Hud(hudRoot);
new Game(world, hud);
