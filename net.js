  // ---------- family edition: the table, connected through free public relays ----------
  // No accounts. Whoever opens the plain link HOSTS the table: their device keeps the game,
  // seats, settings and scoreboard. Whoever opens the link with ?mesa=<id> is a GUEST.
  // Messages travel through public MQTT relays (like a group chat channel named after the
  // table), which work on any network, unlike direct phone-to-phone connections that many
  // mobile carriers block. The table talks on several relays at once, so one being down or
  // blocked doesn't stop the game.
  Object.assign(T.pt, {
    inviteHint: "Toque em Convidar e mande o link pelo WhatsApp. Faltou gente? Toque num lugar vago para adicionar um computador.",
    invite: "Convidar pelo WhatsApp",
    copyLink: "Copiar link da mesa",
    copied: "Link copiado!",
    inviteText: "Vem jogar Mexe-Mexe comigo! É só tocar no link:",
    netHostOpen: "Sua mesa está aberta · {c} conectado(s)",
    netHostOpening: "Abrindo sua mesa…",
    netHostKeep: "Deixe o jogo aberto enquanto a família joga.",
    netReconnecting: "Reconectando…",
    netGuestOpen: "Conectado à mesa",
    netGuestConnecting: "Entrando na mesa…",
    netHostAway: "A mesa está fechada agora. Peça para quem te convidou abrir o jogo.",
    joiningTitle: "Entrando na mesa…",
    joiningHelp: "Só um instante. Se demorar, confira a internet do celular.",
    awayTitle: "A mesa está fechada",
    awayHelp: "Quem te convidou precisa estar com o jogo aberto. Assim que abrir, você entra sozinho.",
    retryNow: "Tentar de novo"
  });
  Object.assign(T.en, {
    inviteHint: "Tap Invite and send the link on WhatsApp. Short on players? Tap an empty seat to add a computer.",
    invite: "Invite on WhatsApp",
    copyLink: "Copy table link",
    copied: "Link copied!",
    inviteText: "Come play Mexe-Mexe with me! Just tap the link:",
    netHostOpen: "Your table is open · {c} connected",
    netHostOpening: "Opening your table…",
    netHostKeep: "Keep the game open while the family plays.",
    netReconnecting: "Reconnecting…",
    netGuestOpen: "Connected to the table",
    netGuestConnecting: "Joining the table…",
    netHostAway: "The table is closed right now. Ask whoever invited you to open the game.",
    joiningTitle: "Joining the table…",
    joiningHelp: "Just a moment. If it takes long, check the phone's internet.",
    awayTitle: "The table is closed",
    awayHelp: "Whoever invited you needs to have the game open. As soon as they do, you'll join automatically.",
    retryNow: "Try again"
  });

  const RELAYS = ["wss://broker.emqx.io:8084/mqtt", "wss://broker.hivemq.com:8884/mqtt", "wss://test.mosquitto.org:8081"];
  const joinId = new URLSearchParams(location.search).get("mesa");
  const net = { role: joinId ? "guest" : "host", status: "connecting", peers: 0, hostId: joinId, hasState: false };
  const tableLink = () => location.origin + location.pathname + "?mesa=" + encodeURIComponent(net.hostId || "");
  const topicsFor = (id) => { const base = "mexe-mexe/v1/" + id; return { state: base + "/state", host: base + "/host", op: base + "/op", guests: base + "/guest/+", guest: (g) => base + "/guest/" + g }; };
  const enc = (o) => JSON.stringify(o);
  const dec = (buf) => { try { return JSON.parse(buf.toString()); } catch (e) { return null; } };
  function connectRelay(url, opts, onConnect, onMessage, onDown) {
    // A short keepalive means a phone that drops off is noticed in about 15 seconds.
    const c = window.mqtt.connect(url, { keepalive: 10, reconnectPeriod: 3000, connectTimeout: 10000, clean: true, clientId: "mm" + randId(), ...opts });
    c.on("connect", () => onConnect(c));
    c.on("message", (topic, payload) => onMessage(c, topic, payload));
    c.on("close", () => onDown(c));
    c.on("error", () => {});
    return c;
  }

  hooks.status = (compact) => {
    const s = net.status, host = net.role === "host";
    if (compact && s === "open") return "";
    const text = host
      ? s === "open" ? t("netHostOpen", { c: net.peers }) : s === "reconnecting" ? t("netReconnecting") : t("netHostOpening")
      : s === "open" ? t("netGuestOpen") : s === "hostAway" ? t("netHostAway") : s === "reconnecting" ? t("netReconnecting") : t("netGuestConnecting");
    const cls = s === "open" ? "ok" : s === "hostAway" ? "warn" : "";
    return `<p class="netpill ${cls}" role="status"><i aria-hidden="true"></i>${text}</p>${host && s === "open" && !compact ? `<p class="note">${t("netHostKeep")}</p>` : ""}`;
  };
  // Guests see a clear waiting screen until the table's state arrives, never an empty table.
  hooks.block = () => {
    if (net.role !== "guest" || net.hasState) return "";
    const away = net.status === "hostAway";
    return `<div class="home"><div class="home-main">
      <h1 class="logo">Mexe-Mexe</h1>
      ${away ? "" : `<div class="spinner" aria-hidden="true"></div>`}
      <h2 class="sheet-title">${away ? t("awayTitle") : t("joiningTitle")}</h2>
      <p class="tagline">${away ? t("awayHelp") : t("joiningHelp")}</p>
      <div class="home-actions"><button class="btn big" data-act="reload">${t("retryNow")}</button></div>
    </div></div>`;
  };
  hooks.invite = () => {
    if (net.role !== "host" || net.status !== "open") return "";
    const msg = `${t("inviteText")} ${tableLink()}`;
    return `<div class="invite">
      <a class="btn big whatsapp" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${t("invite")}</a>
      <button class="btn big" data-act="copylink">${t("copyLink")}</button>
    </div>`;
  };
  hooks.guest = () => net.role === "guest";
  hooks.acts.reload = () => location.reload();
  hooks.acts.copylink = async () => {
    const link = tableLink();
    try {
      if (navigator.share) { await navigator.share({ title: "Mexe-Mexe", text: t("inviteText"), url: link }); return; }
      await navigator.clipboard.writeText(link); toast(t("copied"));
    } catch (e) {
      try { await navigator.clipboard.writeText(link); toast(t("copied")); } catch (e2) { toast(link); }
    }
  };

  // Host: the normal on-device store; every change is published to the table's channel,
  // and guests' moves arrive as operations to apply.
  function makeHostStore() {
    const local = makeLocalStore();
    const snap = { game: null, lobby: [], settings: {}, stats: {}, online: [], hostUid: null };
    let id = ls.get("mm-host-id");
    if (!id) { id = "mexe-" + randId().slice(1) + randId().slice(1); ls.set("mm-host-id", id); }
    net.hostId = id;
    const tp = topicsFor(id);
    const clients = new Set(), up = new Set(), guestsByRelay = new Map();
    const seenOps = new Set();
    let rev = Date.now() * 1000, queued = false;
    const publishState = (c) => { if (c.connected) c.publish(tp.state, enc({ rev, data: snap }), { retain: true, qos: 1 }); };
    const broadcast = () => {
      if (queued) return;
      queued = true;
      setTimeout(() => { queued = false; rev++; clients.forEach(publishState); });
    };
    local.subGame((g) => { snap.game = g; broadcast(); });
    local.subLobby((l) => { snap.lobby = l; broadcast(); });
    local.subSettings((s) => { snap.settings = s; broadcast(); });
    local.subStats((s) => { snap.stats = s; broadcast(); });
    const OPS = ["setGame", "updateGame", "setSeat", "delSeat", "setSettings", "setStats"];
    // Who is connected: every guest seen on any relay, plus the host. Shared with everyone in the state.
    let onlineKey = "";
    const countGuests = () => {
      const all = new Set([myId]);
      guestsByRelay.forEach((s) => s.forEach((g) => all.add(g)));
      net.peers = all.size - 1;
      const key = [...all].sort().join(",");
      if (key !== onlineKey) { onlineKey = key; snap.online = [...all]; snap.hostUid = myId; broadcast(); presenceUpdate(all); }
    };
    const refresh = () => { net.status = up.size ? "open" : clients.size ? "reconnecting" : "connecting"; countGuests(); render(); };

    function apply(m) {
      if (!m || !OPS.includes(m.op) || !m.id || seenOps.has(m.id)) return;   // a move sent on several relays is applied once
      seenOps.add(m.id);
      if (seenOps.size > 500) seenOps.delete(seenOps.values().next().value);
      const args = m.args || [];
      // Ignore a late copy of an older game state so a slow relay can't undo a newer move.
      if (m.op === "setGame" && game && args[0] && args[0].id === game.id && args[0].seq < game.seq) return;
      Promise.resolve(local[m.op](...args)).catch(() => {});
    }
    if (!window.mqtt) { net.status = "connecting"; return local; }
    RELAYS.forEach((url) => {
      const c = connectRelay(url, { will: { topic: tp.host, payload: "0", retain: true, qos: 1 } },
        (c) => {
          up.add(c); guestsByRelay.set(c, new Set());
          c.subscribe([tp.op, tp.guests], { qos: 1 });
          c.publish(tp.host, "1", { retain: true, qos: 1 });
          publishState(c);
          refresh(); keepAwake();
        },
        (c, topic, payload) => {
          if (topic === tp.op) apply(dec(payload));
          else if (topic.startsWith(tp.guests.slice(0, -1))) {
            const g = topic.slice(tp.guests.length - 1), set = guestsByRelay.get(c) || new Set();
            payload.length ? set.add(g) : set.delete(g);
            guestsByRelay.set(c, set); refresh();
          }
        },
        (c) => { up.delete(c); guestsByRelay.delete(c); refresh(); });
      clients.add(c);
    });
    // Closing the page marks the table closed right away for everyone.
    window.addEventListener("pagehide", () => clients.forEach((c) => { try { if (c.connected) c.publish(tp.host, "0", { retain: true, qos: 0 }); } catch (e) {} }));
    return local;
  }

  // Guest: mirrors the newest state seen on any relay and sends each move on all of them.
  function makeGuestStore(hostId) {
    const subs = { game: [], lobby: [], settings: [], stats: [] };
    const tp = topicsFor(hostId);
    const clients = new Set(), up = new Set(), hostOn = new Map();
    let data = null, rev = 0, opN = 0;
    const emit = (k) => subs[k].forEach((f) => f(data[k]));
    const refresh = () => {
      const anyHost = [...hostOn.values()].some(Boolean);
      net.status = !up.size ? (net.hasState ? "reconnecting" : "connecting") : anyHost ? "open" : hostOn.size ? "hostAway" : "connecting";
      // Who is connected, as the host last reported it; the host itself drops out when its table closes.
      if (data) {
        const set = new Set(data.online || []);
        set.add(myId);
        if (!anyHost && data.hostUid) set.delete(data.hostUid);
        presenceUpdate(set);
      } else render();
    };
    function onState(m) {
      if (!m || !m.data || m.rev <= rev) return;
      // First contact: skip the home screen and go straight to the table to sit down.
      if (!net.hasState && m.data.game?.status !== "playing") screen = "lobby";
      rev = m.rev; data = m.data; net.hasState = true;
      ["settings", "stats", "lobby", "game"].forEach(emit);
      refresh();
    }
    function send(op, args) {
      const live = [...up].filter((c) => c.connected);
      if (!live.length) return Promise.reject({ code: "unavailable" });
      const msg = enc({ op, args, id: myId + "-" + Date.now().toString(36) + "-" + (opN++) });
      live.forEach((c) => c.publish(tp.op, msg, { qos: 1 }));
      return Promise.resolve();
    }
    if (window.mqtt) RELAYS.forEach((url) => {
      const c = connectRelay(url, { will: { topic: tp.guest(myId), payload: "", retain: true, qos: 1 } },
        (c) => {
          up.add(c);
          c.subscribe([tp.state, tp.host], { qos: 1 });
          c.publish(tp.guest(myId), "1", { retain: true, qos: 1 });
          refresh();
        },
        (c, topic, payload) => {
          if (topic === tp.state) onState(dec(payload));
          else if (topic === tp.host) { hostOn.set(c, payload.toString() === "1"); refresh(); }
        },
        (c) => { up.delete(c); hostOn.delete(c); refresh(); });
      clients.add(c);
    });
    // If the table never answers on any relay, say so instead of spinning forever.
    setTimeout(() => { if (!net.hasState && up.size) { if (![...hostOn.values()].some(Boolean)) { net.status = "hostAway"; render(); } } }, 8000);
    window.addEventListener("pagehide", () => clients.forEach((c) => { try { if (c.connected) c.publish(tp.guest(myId), "", { retain: true, qos: 0 }); } catch (e) {} }));
    const sub = (k) => (cb) => { subs[k].push(cb); if (data) setTimeout(() => cb(data[k])); return () => {}; };
    return {
      subGame: sub("game"), subLobby: sub("lobby"), subSettings: sub("settings"), subStats: sub("stats"),
      // Moves show up right away on this phone; the host's copy then confirms them for everyone.
      setGame(g) { if (data) { data.game = g; emit("game"); } return send("setGame", [g]); },
      updateGame(p) { if (data && data.game) { data.game = { ...data.game, ...p }; emit("game"); } return send("updateGame", [p]); },
      setSeat: (id, d) => send("setSeat", [id, d]),
      delSeat: (id) => send("delSeat", [id]),
      setSettings: (d) => send("setSettings", [d]),
      setStats: (d) => send("setStats", [d])
    };
  }

  // The host's screen must stay on, or the phone sleeps and the table closes.
  let wakeLock = null;
  async function keepAwake() {
    try { if ("wakeLock" in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } } catch (e) {}
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && net.role === "host") keepAwake(); });

  // ---------- boot ----------
  function localId() {
    let id = ls.get("mm-id");
    if (!id) { id = randId(); ls.set("mm-id", id); }
    return id;
  }
  function boot() {
    mode = "online";
    myId = localId();
    store = net.role === "host" ? makeHostStore() : makeGuestStore(joinId);
    store.subSettings((s) => { settings = s || {}; render(); });
    store.subStats((s) => { stats = s || {}; render(); });
    store.subLobby((l) => { lobby = (l || []).slice().sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0)); render(); });
    store.subGame((g) => onGame(g));
    render();
  }
  boot();
})();
</script>
