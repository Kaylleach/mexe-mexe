  // ---------- family edition: peer-to-peer table ----------
  // No accounts. Whoever opens the plain link HOSTS the table: their device keeps the game,
  // seats, settings and scoreboard, and sends the whole state to everyone connected.
  // Whoever opens the link with ?mesa=<id> is a GUEST: they receive that state and send
  // their moves back to the host. Connections go device-to-device through PeerJS.
  Object.assign(T.pt, {
    inviteHint: "Toque em Convidar e mande o link pelo WhatsApp. Faltou gente? Toque num lugar vago para adicionar um computador.",
    invite: "Convidar pelo WhatsApp",
    copyLink: "Copiar link da mesa",
    copied: "Link copiado!",
    inviteText: "Vem jogar Mexe-Mexe comigo! É só tocar no link:",
    netHostOpen: "Sua mesa está aberta · {c} conectado(s)",
    netHostOpening: "Abrindo sua mesa…",
    netHostKeep: "Deixe o jogo aberto enquanto a família joga.",
    netTaken: "Sua mesa já está aberta em outra aba ou aparelho. Feche a outra e recarregue.",
    netOffline: "Sem conexão: dá para jogar só com computadores.",
    netReconnecting: "Reconectando…",
    netGuestOpen: "Conectado à mesa",
    netGuestConnecting: "Entrando na mesa…",
    netHostAway: "A mesa está fechada no momento. Peça para quem te convidou abrir o jogo. Tentando de novo…",
    netNoState: "Esperando a mesa responder…"
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
    netTaken: "Your table is already open in another tab or device. Close it and reload.",
    netOffline: "No connection: you can still play with computers.",
    netReconnecting: "Reconnecting…",
    netGuestOpen: "Connected to the table",
    netGuestConnecting: "Joining the table…",
    netHostAway: "The table is closed right now. Ask whoever invited you to open the game. Trying again…",
    netNoState: "Waiting for the table to answer…"
  });

  const joinId = new URLSearchParams(location.search).get("mesa");
  const net = { role: joinId ? "guest" : "host", status: "connecting", peers: 0, hostId: joinId };
  const PEER_OPTS = { debug: 0 };
  const tableLink = () => location.origin + location.pathname + "?mesa=" + encodeURIComponent(net.hostId || "");

  hooks.status = (compact) => {
    const s = net.status, host = net.role === "host";
    if (compact && s === "open") return "";
    let text, cls = "";
    if (host) text = s === "open" ? t("netHostOpen", { c: net.peers }) : s === "taken" ? t("netTaken") : s === "offline" ? t("netOffline") : s === "reconnecting" ? t("netReconnecting") : t("netHostOpening");
    else text = s === "open" ? t("netGuestOpen") : s === "hostAway" ? t("netHostAway") : s === "reconnecting" ? t("netReconnecting") : t("netGuestConnecting");
    if (s === "open") cls = "ok"; else if (s === "taken" || s === "hostAway" || s === "offline") cls = "warn";
    return `<p class="netpill ${cls}" role="status"><i aria-hidden="true"></i>${text}</p>${host && s === "open" && !compact ? `<p class="note">${t("netHostKeep")}</p>` : ""}`;
  };
  hooks.invite = () => {
    if (net.role !== "host" || net.status !== "open") return "";
    const msg = `${t("inviteText")} ${tableLink()}`;
    return `<div class="invite">
      <a class="btn big whatsapp" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${t("invite")}</a>
      <button class="btn big" data-act="copylink">${t("copyLink")}</button>
    </div>`;
  };
  hooks.acts.copylink = async () => {
    const link = tableLink();
    try {
      if (navigator.share) { await navigator.share({ title: "Mexe-Mexe", text: t("inviteText"), url: link }); return; }
      await navigator.clipboard.writeText(link); toast(t("copied"));
    } catch (e) {
      try { await navigator.clipboard.writeText(link); toast(t("copied")); } catch (e2) { toast(link); }
    }
  };

  // Host: the normal on-device store, plus a broadcast of every change to the guests.
  function makeHostStore() {
    const local = makeLocalStore();
    const snap = { game: null, lobby: [], settings: {}, stats: {} };
    const conns = new Set();
    let queued = false;
    const broadcast = () => {
      if (queued) return;
      queued = true;
      setTimeout(() => {
        queued = false;
        conns.forEach((c) => { try { if (c.open) c.send({ type: "state", data: snap }); } catch (e) {} });
      });
    };
    local.subGame((g) => { snap.game = g; broadcast(); });
    local.subLobby((l) => { snap.lobby = l; broadcast(); });
    local.subSettings((s) => { snap.settings = s; broadcast(); });
    local.subStats((s) => { snap.stats = s; broadcast(); });
    const OPS = ["setGame", "updateGame", "setSeat", "delSeat", "setSettings", "setStats"];

    function start() {
      if (!window.Peer) { net.status = "offline"; render(); return; }
      let id = ls.get("mm-host-id");
      if (!id) { id = "mexe-" + randId().slice(1) + randId().slice(1); ls.set("mm-host-id", id); }
      const peer = new window.Peer(id, PEER_OPTS);
      peer.on("open", (pid) => { net.hostId = pid; net.status = "open"; render(); keepAwake(); });
      peer.on("connection", (c) => {
        c.on("open", () => { conns.add(c); net.peers = conns.size; c.send({ type: "state", data: snap }); render(); });
        c.on("data", (m) => {
          if (m && m.type === "op" && OPS.includes(m.op)) Promise.resolve(local[m.op](...(m.args || []))).catch(() => {});
        });
        const drop = () => { conns.delete(c); net.peers = conns.size; render(); };
        c.on("close", drop); c.on("error", drop);
      });
      peer.on("disconnected", () => {
        net.status = "reconnecting"; render();
        setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) {} }, 2000);
      });
      peer.on("error", (e) => {
        if (e.type === "unavailable-id") net.status = "taken";
        else if (["network", "server-error", "socket-error", "socket-closed"].includes(e.type)) net.status = "reconnecting";
        render();
      });
    }
    start();
    return local;
  }

  // Guest: mirrors the host's state and sends every write to the host.
  function makeGuestStore(hostId) {
    const subs = { game: [], lobby: [], settings: [], stats: [] };
    let data = null, conn = null, peer = null, retryTimer = null;
    const emit = (k) => subs[k].forEach((f) => f(data[k]));
    function onState(d) { data = d; ["settings", "stats", "lobby", "game"].forEach(emit); }
    function send(op, args) {
      if (!conn || !conn.open) return Promise.reject({ code: "unavailable" });
      conn.send({ type: "op", op, args });
      return Promise.resolve();
    }
    function retry(status) {
      net.status = status || "reconnecting"; render();
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        try { if (peer.disconnected && !peer.destroyed) peer.reconnect(); } catch (e) {}
        if (peer.open) connect();
      }, 4000);
    }
    function connect() {
      if (conn && conn.open) return;
      net.status = data ? "reconnecting" : "connecting"; render();
      conn = peer.connect(hostId, { reliable: true, serialization: "json" });
      conn.on("open", () => { net.status = "open"; render(); });
      conn.on("data", (m) => { if (m && m.type === "state") onState(m.data); });
      conn.on("close", () => retry());
      conn.on("error", () => retry());
    }
    if (window.Peer) {
      peer = new window.Peer(PEER_OPTS);
      peer.on("open", connect);
      peer.on("disconnected", () => retry());
      peer.on("error", (e) => retry(e.type === "peer-unavailable" ? "hostAway" : "reconnecting"));
    } else net.status = "hostAway";
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
