# Mexe-Mexe da Família

Mexe-Mexe with our family's house rules, played together from anywhere. No accounts.

- **Host:** open the site. Your device holds the table; keep the game open while the family plays.
- **Family:** tap the invite link (`…?mesa=…`), type a nickname once, and play.

Moves travel through free public MQTT relays (EMQX, HiveMQ, Mosquitto), all at once so one being down doesn't stop the game. The game and scoreboard are saved on the host's device.

`index.html` is generated: `node familia/build.js` rebuilds it from the Claude version (`mexe-mexe.html`) plus `net.js`.
