<div align="center">

<img src="assets/rage-logo.png" width="118" alt="RAGE logo">

# RAGE — COTL SAVE EDITOR

**A modern local save editor for Cult of the Lamb.**  
Read `.mp` saves, edit progression visually, browse the wiki catalog and create automatic backups — all from a localhost interface.

[![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-111111?style=for-the-badge&logo=windows&logoColor=white)](#requirements)
[![Node.js](https://img.shields.io/badge/Node.js-LTS-111111?style=for-the-badge&logo=nodedotjs&logoColor=white)](#requirements)
[![Local](https://img.shields.io/badge/Privacy-100%25%20Local-111111?style=for-the-badge&logo=protonvpn&logoColor=white)](#privacy)
[![License](https://img.shields.io/badge/Use-Personal-111111?style=for-the-badge)](#disclaimer)

<a href="https://www.pinterest.com/pin/kidmograph-animation-black-and-white-glitch-pattern--56998751514112747/">
  <img src="https://i.pinimg.com/originals/80/eb/15/80eb15b74b0e953de799f32cb26a8c61.gif" width="100%" alt="Black and white glitch animation">
</a>

</div>

## About

RAGE COTL Save Editor is a local tool made for the Steam version of **Cult of the Lamb**. It starts a private server on your computer and opens a polished web interface in your browser.

Nothing is uploaded. Your save stays on your computer.

> [!CAUTION]
> Close Cult of the Lamb before opening or modifying a save. Editing impossible combinations of quests, doctrines or progression flags can damage the save. The editor creates a backup automatically, but you should still use advanced fields carefully.

## Features

- Direct reading of current encrypted `.mp` saves.
- Support for legacy encrypted `.json` saves.
- Human-readable fields organized into categories.
- Visual inventory editor with item names, IDs, quantities and wiki images.
- Follower, progression, combat, cult, building, doctrine and DLC fields.
- Complete online catalog for resources, cooking, followers, buildings, rituals and doctrines.
- Advanced JSON editor with access to every available save field.
- Automatic backup before every write.
- Direct selection of `slot_#.mp` or `slot_#.json`.
- Light and dark modes.
- Four vibrant palettes: Neon Pink, Cyber Cyan, Crimson Rage and Terminal Green.
- Single-file Windows `.exe` build using Node.js SEA.

<div align="center">
  <a href="https://de.pinterest.com/pin/12666442693768354/">
    <img src="https://i.pinimg.com/originals/73/4f/b6/734fb6ed44aa280fe7546f7035363faf.gif" width="82%" alt="Dark computer code animation">
  </a>
</div>

## Requirements

To run the source version:

- Windows 10 or Windows 11.
- [Node.js LTS](https://nodejs.org/).
- Internet connection during the first installation.
- Internet connection for wiki catalog images.

The finished `.exe` does **not** require Node.js on the destination computer.

## Installation

### Option 1 — Run from the source

1. Download and extract the project ZIP.
2. Install the current [Node.js LTS](https://nodejs.org/).
3. Open the extracted project folder.
4. Double-click `start.bat`.
5. The first launch installs the required packages automatically.
6. The editor opens at:

```text
http://127.0.0.1:41731
```

You can also start it manually:

```cmd
npm install
npm start
```

### Option 2 — Build the standalone `.exe`

The recommended build uses **Node.js Single Executable Applications (SEA)**. The server, dependencies and interface assets are embedded into one executable.

1. Make sure `rage-logo.ico` exists in the project root.
2. Double-click:

```text
build-exe-with-icon.bat
```

3. Wait until `[DONE]` appears.
4. Find the finished application at:

```text
dist\Cotl-Save-Editor-by-Rage.exe
```

Terminal alternative:

```cmd
npm run build
```

> [!NOTE]
> The executable is large because it contains the Node.js runtime. Windows SmartScreen may display an **Unknown publisher** warning because the file is not digitally signed.

## How to use

1. Close Cult of the Lamb completely.
2. Open the editor or its `.exe`.
3. Choose whether DLC options should be visible.
4. Click **Select save**.
5. Select a file named `slot_#.mp` or `slot_#.json`.
6. Use the categories at the top to find the value you want.
7. Change the desired values.
8. Click **Save changes**.
9. Read the confirmation and start the game.

The default Steam save directory is:

```text
%USERPROFILE%\AppData\LocalLow\Massive Monster\Cult Of The Lamb\saves
```

Save slots use zero-based filenames:

| Game slot | Save filename |
|---:|---|
| Slot 1 | `slot_0.mp` |
| Slot 2 | `slot_1.mp` |
| Slot 3 | `slot_2.mp` |

## Save format

Modern Cult of the Lamb saves use:

```text
AES-128-CBC → MessagePack → LZ4
```

The editor reads the modern `.mp` format. When saving, it creates an encrypted legacy `slot_#.json` that the game can import. The existing `.mp` is removed only after it has been copied into an automatic backup. The game then recreates its modern `.mp` file.

## Backups and restoration

Backups are created inside:

```text
saves\RageEditorBackups\slot_#_DATE_AND_TIME
```

To restore one manually:

1. Close the game and the editor.
2. Open `RageEditorBackups`.
3. Choose the backup created before the unwanted edit.
4. Copy its files back into the main `saves` folder.
5. Replace files when Windows asks.

## Troubleshooting

| Problem | Solution |
|---|---|
| `Node.js was not found` | Install Node.js LTS and reopen the BAT. |
| Browser does not open | Visit `http://127.0.0.1:41731` manually. |
| Port `41731` is already in use | Close the older editor/EXE process in Task Manager. |
| Save is not listed | Select `slot_#.mp` or `slot_#.json` directly. |
| Wiki catalog does not load | Check your internet connection; save editing still works offline. |
| Build stops during package installation | Run `npm install`, then execute the build BAT again. |
| EXE shows the default Node icon | Build with the newest files and delete the old `dist` folder first. |
| Explorer shows an old cached icon | Rename the EXE or restart Windows Explorer. |
| Game ignored the edited save | Close Steam Cloud temporarily, restore the backup and try again with the game closed. |

## Project structure

```text
Cotl-Save-Editor/
├── assets/                      # README artwork
├── public/                      # Web interface
├── scripts/build-exe.js         # SEA executable builder
├── server.js                    # Local server and save processing
├── rage-logo.ico                # Windows executable icon
├── start.bat                    # Run from source
├── build-exe-with-icon.bat      # Build the final EXE
├── package.json
└── README.md
```

## Privacy

- The editor listens only on `127.0.0.1`.
- Save files are processed locally.
- No account, login, telemetry or database is used.
- Only wiki catalog information and images are requested from the internet.

## Credits

- Item information and catalog imagery: [Cult of the Lamb Wiki](https://cult-of-the-lamb.fandom.com/).
- `.mp` decoding support: [lamb-mp-decoder](https://www.npmjs.com/package/lamb-mp-decoder).
- Executable packaging: [Node.js SEA](https://nodejs.org/api/single-executable-applications.html), [esbuild](https://esbuild.github.io/) and [Postject](https://github.com/nodejs/postject).
- Dark GIF artwork sourced through Pinterest: [black and white glitch](https://www.pinterest.com/pin/kidmograph-animation-black-and-white-glitch-pattern--56998751514112747/), [dark code](https://de.pinterest.com/pin/12666442693768354/) and [glitch.inc](https://www.pinterest.com/pin/glitchinc--27373510215335312/).

## Disclaimer

This is an unofficial fan-made save utility. It is not affiliated with, endorsed by or supported by Massive Monster, Devolver Digital or the Cult of the Lamb Wiki.

Always keep backups. You are responsible for changes made to your own save files.

<div align="center">
  <a href="https://www.pinterest.com/pin/glitchinc--27373510215335312/">
    <img src="https://i.pinimg.com/originals/4a/c1/13/4ac11380983874d2d9c725acd14ff4af.gif" width="100%" alt="Dark glitch animation">
  </a>

  <br><br>
  <strong>RAGE — COTL SAVE EDITOR</strong><br>
  <sub>Local. Visual. Under your control.</sub>
</div>
