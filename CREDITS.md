# Credits

THE EARTH で使っている第三者素材です。取り込み時に縮小しています。

## 天体テクスチャ

Solar System Scope の 2K テクスチャ（NASA 画像を基にしたマップ）。[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。

出典: https://www.solarsystemscope.com/textures/

- `public/bodies/earth.jpg` — 2k_earth_daymap
- `public/bodies/earth_clouds.jpg` — 2k_earth_clouds
- `public/bodies/sun.jpg` — 2k_sun
- `public/bodies/jupiter.jpg` — 2k_jupiter
- `public/bodies/saturn.jpg` — 2k_saturn
- `public/bodies/uranus.jpg` — 2k_uranus
- `public/bodies/neptune.jpg` — 2k_neptune
- `public/bodies/mercury.jpg` — 2k_mercury
- `public/bodies/venus.jpg` — 2k_venus_surface
- `public/bodies/moon.jpg` — 2k_moon
- `public/env/milkyway.jpg` — 2k_stars_milky_way
- `public/bodies/puff.jpg` — 2k_makemake_fictional（わたぼうしの下地）
- `public/bodies/contrarian.jpg` — 2k_eris_fictional（ぎゃくまわりの下地）

岩石・衛星テクスチャ:

- `public/bodies/mars.jpg` — Mars map from [threex.planets](https://github.com/jeromeetienne/threex.planets) (`marsmap1k.jpg`)。元データは NASA / USGS Viking 系の公開画像。

奇想惑星（おにび・さいころ・れんが・とけい・ゆきだま・たこやき・ピンポンなど）は、Three.js の手続きメッシュ／キャンバス描画によるオリジナル見た目です。

## 書体

- [Instrument Serif](https://github.com/googlefonts/instrument-serif) — SIL Open Font License 1.1
- [IBM Plex Sans](https://github.com/IBM/plex) — SIL Open Font License 1.1

`@fontsource` 経由で同梱しています。

## 音

衝突・UI の短い音は、外部ファイルではなくブラウザの Oscillator でその場で生成しています（オリジナル）。

フィナーレ（破壊星の演出）では `public/audio/Dvorak-Symphony-No9-4th-2013.mp3` — ドヴォルザーク「交響曲第9番『新世界より』」第4楽章（CMSL 2013年新録音・フル）を使用しています。

- **音源:** [CMSL クラシック名曲サウンドライブラリー](https://classical-sound.seesaa.net/article/370321443.html)（2013年新録音）
- **ライセンス:** ライセンスフリー / [CC BY 2.1 JP](https://creativecommons.org/licenses/by/2.1/jp/)
- 作曲（1883年）はパブリックドメイン

音源が読み込めない環境では、同主題に基づく Web Audio の簡易アレンジ（オリジナル）にフォールバックします。
