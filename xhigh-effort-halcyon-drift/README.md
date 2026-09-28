# Halcyon Drift — The Long Way Home

A 3D point-and-click space adventure that runs in the browser. Everything in it is generated from code at runtime: the ship, crew, creatures, plants, textures, planets, music, sound effects and spoken dialogue. The game uses no image, model or audio files, and no ElevenLabs.

> *Year 2187. After a three-year survey mission, the ISV-7 **Halcyon** is finally heading home, 4.2 light-years from Earth. Then a meteor punches through the cargo hold. It turns out to be a nest.*

## Play it

**On a laptop, no internet needed:** download `halcyon-drift-offline.html`, put it anywhere (your Desktop works well), and double-click it. It opens in your web browser; Microsoft Edge or Chrome work best. That single file of about 1 MB contains the whole game, including the 3D engine and fonts, so it runs with Wi-Fi off. Saves and voice choices are kept in that browser on that computer.

**Online version:** `index.html` is the same game at a third of the size. It loads [three.js](https://threejs.org) from the jsDelivr CDN, so it needs an internet connection. Open it in a recent desktop Chrome, Edge, Firefox or Safari, either by double-clicking the file or by serving the folder with any static server.

> **Voices offline:** Edge's best "Natural" voices are streamed from the internet. With no connection the game automatically switches to the voices installed on your computer, such as Hazel, George, Zira and David. They sound more robotic, but they work anywhere. The 🗣 Voices menu marks the online voices "needs internet".

| Control | Action |
| --- | --- |
| **Click** the floor | Walk there |
| **Click** an object, crew member or creature | Look, use, talk or fight (the tooltip shows what you're pointing at) |
| **Drag** / **scroll** | Look around / zoom |
| **V** or the 👁 button | Switch between **Behind** (third-person) and **First-Person** view |
| **Tab** or **📡 Scan** | HALO Scan: a sonar ping labels everything you can use in the room (tap a label to use it) |
| **L** or **📜 Log** | Read back, and hear again, everything that's been said |
| **1, 2, 3…** | Pick an answer in a conversation; type keypad codes straight on the keyboard |
| **💡 Hint** button (top) | A hint for the step you're on; **Clearer hint** goes from a nudge to the exact answer. The button glows if you've been stuck a while |
| **F** or the **Full Screen** button | Go full screen (top right in game, or on the title screen); press again or **Esc** to leave |
| **1–4** or the buttons by Comet's portrait | Comet's skills: Sniff, Bark, Dig, Fetch |
| **WASD / arrows** | Walk manually |
| Inventory item | Examine it, use it on something, eat it, or feed it to Comet |
| **Esc** / right-click | Stop using an item or cancel a walk |
| **Space / Enter / click** | Advance dialogue (the first click shows the whole line without cutting the speaker off) |
| **▶ Auto** (dialogue box) | Auto-Play: conversations and cutscenes play by themselves |

## What's in it

- **Four explorable decks:** the Bridge, a Hydroponic Garden under a glass dome, the damaged Cargo Hold and Engineering, joined by sliding pressure doors.
- **Comet, the space dog.** She wears her own face mask: a breather with teal filters, blinking LEDs and a hose to her little oxygen pack, plus a bubble helmet with an antenna. She follows you everywhere and solves problems with **AVE points** (*Animal Valor & Expertise*):
  - **Sniff** (1) finds hidden things and makes friends.
  - **Bark** (1) scares spiders or lures the boss.
  - **Dig** (2) digs up buried things.
  - **Fetch** (2) reaches tight spots and tugs things free.

  Pet her, feed her carrots or biscuits, or visit a Save Beacon to refill AVE.

  She has a personality of her own:
  - She blinks, watches whatever you point at and tilts her head when you point at her.
  - Her ears flop when she stops, and she gallops at full speed.
  - When she's bored she lies down, scratches, yawns or rolls in the garden.
  - After digging she shakes the dirt off.
  - She does zoomies when you beat the Queen or get the power back on.

  Take the **squeaky ball** from her bed to play fetch.
- **Comet's lost treasures:** eight keepsakes are scattered around the ship. When there's nothing else to find, Comet's Sniff leaves glowing paw prints to the next one, and Dig or Fetch brings it back with a little story about the crew.
- **The crew:**
  - Dr. Juno Park, the botanist.
  - Chief Engineer Rafi Okoye, who needs rescuing.
  - BOLT-7, a maintenance robot who becomes your hint system.
  - Zib, a tiny glowing alien stowaway.
- **Aliens, spiders and bugs:**
  - Giant spiders, and the **Brood Queen** boss, beaten with a cargo crane, a UV torch and a well-timed bark.
  - Iridescent skitterbugs that run from you.
  - Koi, butterflies and bees in the garden.
  - Bioluminescent space jellies and a kilometre-long Void Leviathan drifting past the windows.
- **The ship's garden:**
  - Vegetables: tomatoes, lettuce, carrots, pumpkins and a lemon tree.
  - Flowers: tulips, roses, lavender, sunflowers and glowing Kepler orchids.
  - A koi pond, a living strawberry wall and working sprinklers, with plants that sway on the GPU.
- **Big moments:**
  - Chapter title cards, and an "Objective complete" fanfare.
  - A skippable cutscene when the power comes back: the lights thunk on bank by bank, a wave of light runs along the hull and the engines ignite one by one.
  - A boss finale with hit-stop, crate splinters, a slow-motion final blow and a victory fanfare. The boss music speeds up with every hit, and Comet charges in if you're badly hurt.
  - A Captain's Report with a star rating at the end.
- **Save Beacons**, with auto-saves at key moments, stored in the browser's local storage.
- **Graphics:** physically based materials, soft shadows, bloom and ACES tone mapping. Red emergency lighting switches to warm light when you restore power. Every texture is procedural: panelled metal, diamond plate, soil, wood, the gas giant and Earth itself.
- **Speech:** every line is spoken aloud with your browser's built-in speech synthesiser. The game casts each character from the most natural voices your browser has: a British woman for HALO, a British man for Captain Vega, a child's voice for Zib and a robot voice for BOLT-7 where the device has one. Microsoft Edge's "Natural" voices and Chrome's "Google" voices sound best. The 🗣 **Voices** button turns speech on or off and lets you pick and test a voice for each character; your picks are remembered. The words appear in step with the voice, with the spoken word lit up. The music dips while people talk, and characters' mouths move and heads turn toward whoever is speaking. A narrator voice reads the story text (you can switch it off), and a film-style over-the-shoulder camera frames conversations with the crew. Comet barks, Zib chirps and BOLT-7 beeps, all synthesised with the Web Audio API. There's also a generative score and ship ambience that change with the situation.
- **Graphics quality:** toggle ✨ **Ultra**, **High** or **Lite** if your machine struggles.

## Walkthrough (spoilers)

<details>
<summary>Stuck? Click to reveal.</summary>

1. **Bridge:** the locker code is Comet's birthday, **0417**. It's on her collar tag and in the photo. Take the UV torch. *(Optional: talk to BOLT-7, then have Comet **Fetch** to free it. It gives you biscuits and hints.)*
2. **Garden:** have Comet **Sniff**, then **Dig** at the glowing spot in the carrot bed to recover your keycard. Use it on the door panel to the right of the Cargo door. Pick a carrot or two, and the brightest sunflower.
3. **Cargo Hold:** **Bark** to lure the Brood Queen onto the yellow X, then click the **Crane Console** to drop a crate. Hit her three times, and use the UV torch to stun her or to zap small spiders.
4. Free Rafi from the cocoon with the UV torch. Take the patch kit from the supply crate and seal the hull breach. Rafi then opens Engineering.
5. **Engineering:** **Sniff** to befriend the frightened alien, Zib. Send Comet down the floor vent with **Fetch** to get the power coupling, then install it in the reactor.
6. Give Zib the sunflower in exchange for the Remember-Stone, then go back to the Bridge's navigation console. Take everyone home.

</details>

## Tech notes

- A single self-contained `index.html` with no build step: an ES module that imports three.js r170 through an import map.
- `halcyon-drift-offline.html` is the same game with three.js r170 (and the addons it uses) bundled and minified inline. It also embeds the Orbitron and Exo 2 fonts (SIL Open Font License) as data URIs, so it makes no network requests at all and runs straight from `file://`.
- Add `?debug` to the URL to expose a `window.HD` helper in the console, for teleporting and inspecting state.
