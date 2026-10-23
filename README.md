# Mexe-Mexe da Família

Mexe-Mexe with our family's house rules, played together from anywhere. No accounts.

- **Host:** open the site. Your device holds the table; keep the game open while the family plays.
- **Family:** tap the invite link (`…?mesa=…`), type a nickname once, and play.

Connections go device-to-device (WebRTC via PeerJS). The game and scoreboard are saved on the host's device.

`index.html` is generated: `node familia/build.js` rebuilds it from the Claude version (`mexe-mexe.html`) plus `p2p.js`.
