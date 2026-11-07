// Sons of Reaper Poker 4.1.0 — fichier unique, modifié directement (les sources src/ de la v4.0.0 ne sont pas livrées).
// =====================================================================
// Sons of Reaper Poker — moteur Texas Hold'em (logique pure, sans I/O).
// Chaque fonction modifie un contexte `ctx` ; le Worker persiste le
// résultat dans une seule transaction D1 (voir worker.js).
// Ce fichier est copié tel quel dans _worker.js par build.mjs (les
// mots-clés `export` sont retirés à la compilation).
// =====================================================================

const TURN_MS = 35000;
const MAX_SEATS = 5;
const RANKS = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
const SUITS = ['♠', '♥', '♦', '♣'];

function engineError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const numArr = v => (Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : []);
const plainObj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// ---------- Évaluation des mains ----------
function cardRank(c) { return RANKS[c.slice(0, -1)] || 0; }
function cardSuit(c) { return c.slice(-1); }

function score5(cards) {
  const ranks = cards.map(cardRank).sort((a, b) => b - a);
  const suits = cards.map(cardSuit);
  const flush = suits.every(s => s === suits[0]);
  const counts = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
  const groups = [...counts].map(([rank, count]) => ({ rank, count })).sort((a, b) => b.count - a.count || b.rank - a.rank);
  const kick = groups.map(g => g.rank);
  const uniq = [...new Set(ranks)];
  let straight = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straight = uniq[0];
    else if (uniq.join(',') === '14,5,4,3,2') straight = 5;
  }
  if (flush && straight) return [8, straight];
  if (groups[0].count === 4) return [7, kick[0], kick[1]];
  if (groups[0].count === 3 && groups[1].count === 2) return [6, kick[0], kick[1]];
  if (flush) return [5, ...ranks];
  if (straight) return [4, straight];
  if (groups[0].count === 3) return [3, kick[0], kick[1], kick[2]];
  if (groups[0].count === 2 && groups[1].count === 2) return [2, kick[0], kick[1], kick[2]];
  if (groups[0].count === 2) return [1, kick[0], kick[1], kick[2], kick[3]];
  return [0, ...ranks];
}

function compareScore(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d;
  }
  return 0;
}

function bestScore(cards) {
  let best = null;
  const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++)
    for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
      const s = score5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
      if (!best || compareScore(s, best) > 0) best = s;
    }
  return best;
}

// ---------- Paquet ----------
function freshDeck() {
  const d = [];
  for (const s of SUITS) for (const r of Object.keys(RANKS)) d.push(r + s);
  return d;
}

// Mélange de Fisher-Yates ; `rand(n)` doit renvoyer un entier uniforme dans [0, n).
function shuffle(deck, rand) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
  }
  return deck;
}

// ---------- État de table ----------
function normalizeState(raw) {
  const st = raw && typeof raw === 'object' ? raw : {};
  st.maxPlayers = Math.max(2, Math.min(MAX_SEATS, num(st.maxPlayers) || MAX_SEATS));
  st.hand = !!st.hand;
  st.handNumber = num(st.handNumber);
  st.street = st.street || (st.hand ? 'pre-flop' : 'waiting');
  st.status = st.status || '';
  st.community = Array.isArray(st.community) ? st.community : [];
  st.deck = Array.isArray(st.deck) ? st.deck : [];
  st.playerHands = plainObj(st.playerHands);
  st.dealt = Array.isArray(st.dealt) ? numArr(st.dealt) : (st.hand ? Object.keys(st.playerHands).map(Number) : []);
  st.folded = plainObj(st.folded);
  st.roundBets = plainObj(st.roundBets);
  st.contributions = plainObj(st.contributions);
  st.acted = numArr(st.acted);
  st.pendingLeave = numArr(st.pendingLeave);
  st.waitingNextHand = numArr(st.waitingNextHand);
  st.currentBet = num(st.currentBet);
  st.lastRaise = num(st.lastRaise);
  st.smallBlind = num(st.smallBlind);
  st.bigBlind = num(st.bigBlind);
  st.buttonSeat = st.buttonSeat == null ? null : num(st.buttonSeat);
  st.turn = st.turn == null ? null : num(st.turn);
  st.turnStartedAt = num(st.turnStartedAt);
  st.lastActivityAt = num(st.lastActivityAt);
  st.waitingSince = st.waitingSince == null ? null : num(st.waitingSince);
  st.message = st.message || '';
  st.lastResult = st.lastResult || '';
  st.lastOutcome = st.lastOutcome || null;
  return st;
}

function newTableState(maxPlayers = MAX_SEATS) {
  return normalizeState({ maxPlayers });
}

// Contexte de travail : copie de l'état, sièges, soldes avant/après.
function makeCtx(raw, seats, cfg) {
  const st = normalizeState(JSON.parse(JSON.stringify(raw && typeof raw === 'object' ? raw : {})));
  const list = seats.map(s => ({
    id: Number(s.id), username: String(s.username), chips: num(s.chips),
    avatar: String(s.avatar || ''), seat: Number(s.seat),
  })).sort((a, b) => a.seat - b.seat);
  const bal = new Map(list.map(s => [s.id, s.chips]));
  return { st, seats: list, bal, start: new Map(bal), now: cfg.now, rand: cfg.rand, minBet: cfg.minBet, removed: [] };
}

function addSeat(ctx, s) {
  const seat = { id: Number(s.id), username: String(s.username), chips: num(s.chips), avatar: String(s.avatar || ''), seat: Number(s.seat) };
  ctx.seats.push(seat);
  ctx.seats.sort((a, b) => a.seat - b.seat);
  ctx.bal.set(seat.id, seat.chips);
  ctx.start.set(seat.id, seat.chips);
  return seat;
}

function dropSeat(ctx, uid) {
  ctx.removed.push(uid);
  ctx.seats = ctx.seats.filter(s => s.id !== uid);
}

function credit(ctx, uid, amount) { ctx.bal.set(uid, (ctx.bal.get(uid) || 0) + amount); }

// Variation nette des soldes : ce que le Worker doit écrire en base.
function deltaOf(ctx) {
  const d = new Map();
  const keys = new Set([...ctx.start.keys(), ...ctx.bal.keys()]);
  for (const k of keys) {
    const v = (ctx.bal.get(k) || 0) - (ctx.start.get(k) || 0);
    if (v) d.set(k, v);
  }
  return d;
}

// ---------- Helpers de main ----------
const st_ = ctx => ctx.st;
const nameOf = (ctx, uid) => (ctx.seats.find(s => s.id === uid) || {}).username || 'Joueur';
const isLive = (ctx, uid) => st_(ctx).dealt.includes(uid) && !st_(ctx).folded[uid];
const liveSeats = ctx => ctx.seats.filter(s => isLive(ctx, s.id));
const roundBet = (ctx, uid) => num(st_(ctx).roundBets[uid]);
const toCall = (ctx, uid) => Math.max(0, num(st_(ctx).currentBet) - roundBet(ctx, uid));
const minRaiseTo = ctx => num(st_(ctx).currentBet) + num(st_(ctx).lastRaise);
const chipsOf = (ctx, uid) => ctx.bal.get(uid) || 0;

// Un joueur doit agir s'il peut encore miser, et s'il n'a pas encore répondu ou doit suivre.
function needsAction(ctx, uid) {
  const st = st_(ctx);
  return isLive(ctx, uid) && chipsOf(ctx, uid) > 0 && (!st.acted.includes(uid) || toCall(ctx, uid) > 0);
}

function addActed(ctx, uid) { if (!st_(ctx).acted.includes(uid)) st_(ctx).acted.push(uid); }

// Premier joueur devant agir, strictement après `fromSeat` dans l'ordre circulaire.
function nextActor(ctx, fromSeat) {
  const order = ctx.seats.slice().sort((a, b) => a.seat - b.seat);
  const idx = order.findIndex(s => s.seat > fromSeat);
  const ranked = idx < 0 ? order : [...order.slice(idx), ...order.slice(0, idx)];
  return ranked.find(s => needsAction(ctx, s.id)) || null;
}

function nextSeat(list, afterSeat) {
  return list.find(s => s.seat > afterSeat) || list[0];
}

// Mise posée par un joueur, plafonnée à son solde.
function put(ctx, uid, amount) {
  const st = st_(ctx);
  const pay = Math.max(0, Math.min(Number(amount) || 0, chipsOf(ctx, uid)));
  if (!pay) return 0;
  ctx.bal.set(uid, chipsOf(ctx, uid) - pay);
  st.roundBets[uid] = roundBet(ctx, uid) + pay;
  st.contributions[uid] = num(st.contributions[uid]) + pay;
  return pay;
}

// ---------- Pots (principal et annexes) ----------
// contribMap : uid -> total engagé sur la main. liveSet : joueurs encore en jeu.
function buildPots(contribMap, liveSet) {
  const levels = [...new Set(contribMap.values())].sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    for (const c of contribMap.values()) amount += Math.max(0, Math.min(c, level) - prev);
    const eligible = [...contribMap.keys()].filter(uid => liveSet.has(uid) && contribMap.get(uid) >= level);
    if (eligible.length === 0 && pots.length) pots[pots.length - 1].amount += amount;
    else pots.push({ amount, eligible });
    prev = level;
  }
  return pots;
}

function contribMapOf(st) {
  return new Map(Object.entries(st.contributions).map(([k, v]) => [Number(k), num(v)]).filter(([, v]) => v > 0));
}

// ---------- Progression de la main ----------
// Cherche le prochain joueur à agir ; sinon avance la rue ou conclut la main.
function progress(ctx, fromSeat) {
  const st = st_(ctx);
  for (let guard = 0; guard < 12; guard++) {
    const live = liveSeats(ctx);
    if (live.length <= 1) return finishHand(ctx, live[0] ? live[0].id : null);
    const next = nextActor(ctx, fromSeat);
    if (next) {
      st.turn = next.id;
      st.turnStartedAt = ctx.now;
      return ctx;
    }
    if (st.street === 'river') return showdown(ctx);
    advanceStreet(ctx);
    fromSeat = st.buttonSeat == null ? -1 : st.buttonSeat;
  }
  throw engineError('Erreur interne du moteur de jeu.', 500);
}

function advanceStreet(ctx) {
  const st = st_(ctx);
  if (st.street === 'pre-flop') { st.street = 'flop'; st.status = 'Flop'; st.community.push(...st.deck.splice(0, 3)); }
  else if (st.street === 'flop') { st.street = 'turn'; st.status = 'Turn'; st.community.push(st.deck.shift()); }
  else if (st.street === 'turn') { st.street = 'river'; st.status = 'River'; st.community.push(st.deck.shift()); }
  st.roundBets = {};
  st.acted = [];
  st.currentBet = 0;
  st.lastRaise = st.bigBlind;
  st.turn = null;
}

function showdown(ctx) {
  const st = st_(ctx);
  while (st.community.length < 5) st.community.push(st.deck.shift());
  st.street = 'showdown';
  st.status = 'Abattage';
  const liveSet = new Set(liveSeats(ctx).map(s => s.id));
  const pots = buildPots(contribMapOf(st), liveSet);
  const won = new Map();
  for (const pot of pots) {
    const cands = pot.eligible.filter(uid => liveSet.has(uid));
    if (!cands.length) continue;
    let winners;
    if (cands.length === 1) winners = cands;
    else {
      let best = null;
      winners = [];
      for (const uid of cands) {
        const sc = bestScore([...st.playerHands[uid], ...st.community]);
        const c = best ? compareScore(sc, best) : 1;
        if (c > 0) { best = sc; winners = [uid]; }
        else if (c === 0) winners.push(uid);
      }
    }
    // Reste de division : premier joueur à gauche du bouton.
    const btn = st.buttonSeat == null ? 0 : st.buttonSeat;
    const dist = uid => (ctx.seats.find(s => s.id === uid).seat - btn + MAX_SEATS) % MAX_SEATS;
    const ordered = winners.slice().sort((a, b) => dist(a) - dist(b));
    const share = Math.floor(pot.amount / ordered.length);
    const rem = pot.amount - share * ordered.length;
    ordered.forEach((uid, i) => won.set(uid, (won.get(uid) || 0) + share + (i === 0 ? rem : 0)));
  }
  const total = [...contribMapOf(st).values()].reduce((a, b) => a + b, 0);
  return settle(ctx, won, total);
}

function finishHand(ctx, soleId) {
  const st = st_(ctx);
  const total = [...contribMapOf(st).values()].reduce((a, b) => a + b, 0);
  const won = new Map();
  if (soleId != null) won.set(soleId, total);
  else for (const [uid, c] of contribMapOf(st)) won.set(uid, c);
  return settle(ctx, won, total);
}

// Crédite les gains, enregistre le résultat, retire les joueurs en attente de départ.
function settle(ctx, won, totalPot) {
  const st = st_(ctx);
  let paid = 0;
  for (const [uid, amt] of won) if (amt > 0) { credit(ctx, uid, amt); paid += amt; }
  if (paid !== totalPot) throw engineError('Incohérence détectée lors du règlement du pot.', 500);
  const winners = [...won].filter(([, a]) => a > 0)
    .map(([uid, a]) => ({ id: uid, username: nameOf(ctx, uid), payout: a }))
    .sort((x, y) => y.payout - x.payout);
  // Départs en attente, et joueurs ruinés (0 jeton) : ils libèrent leur place en fin de main.
  const busted = st.dealt.filter(uid => ctx.seats.some(s => s.id === uid) && chipsOf(ctx, uid) === 0);
  const removed = [...new Set([...st.pendingLeave, ...busted])].filter(uid => ctx.seats.some(s => s.id === uid));
  const removedNames = removed.map(uid => nameOf(ctx, uid));
  st.lastOutcome = { handNumber: st.handNumber, timestamp: ctx.now, pot: totalPot, winners, winnerNames: winners.map(w => w.username) };
  let result = winners.length
    ? `${winners.length > 1 ? 'Gagnants' : 'Gagnant'} : ${winners.map(w => w.username).join(', ')}. Pot de ${totalPot} jetons.`
    : 'Main terminée.';
  const bustedNames = busted.map(uid => nameOf(ctx, uid));
  const leftNames = removedNames.filter(n => !bustedNames.includes(n));
  if (leftNames.length) result += ` ${leftNames.join(', ')} quitte${leftNames.length > 1 ? 'nt' : ''} la table après un délai dépassé.`;
  if (bustedNames.length) result += ` ${bustedNames.join(', ')} n’a plus de jetons et libère sa place.`;
  st.lastResult = result;
  st.message = removedNames.length
    ? `${removedNames.join(', ')} ${removedNames.length > 1 ? 'ont quitté' : 'a quitté'} la table.`
    : 'La main est terminée. Une nouvelle main peut être lancée.';
  for (const uid of removed) dropSeat(ctx, uid);
  st.hand = false;
  st.street = 'showdown';
  st.status = 'Main terminée';
  st.turn = null;
  st.turnStartedAt = 0;
  st.folded = {};
  st.roundBets = {};
  st.contributions = {};
  st.acted = [];
  st.currentBet = 0;
  st.lastRaise = 0;
  st.playerHands = {};
  st.deck = [];
  st.dealt = [];
  st.pendingLeave = [];
  st.waitingNextHand = [];
  st.lastActivityAt = ctx.now;
  return ctx;
}

// ---------- Actions ----------
function dealHand(ctx, minBet) {
  const st = st_(ctx);
  if (st.hand) throw engineError('Une main est déjà en cours.', 409);
  const eligible = ctx.seats.filter(s => chipsOf(ctx, s.id) > 0).sort((a, b) => a.seat - b.seat);
  if (eligible.length < 2) throw engineError('Au moins deux joueurs doivent avoir des jetons pour jouer.', 400);
  const sb = Math.max(1, num(minBet) || 10);
  const bb = sb * 2;
  const button = nextSeat(eligible, st.buttonSeat == null ? -1 : st.buttonSeat);
  let sbP, bbP;
  if (eligible.length === 2) { sbP = button; bbP = eligible.find(s => s.id !== button.id); }
  else { sbP = nextSeat(eligible, button.seat); bbP = nextSeat(eligible, sbP.seat); }

  const deck = shuffle(freshDeck(), ctx.rand);
  st.hand = true;
  st.handNumber += 1;
  st.street = 'pre-flop';
  st.status = 'Pré-flop';
  st.buttonSeat = button.seat;
  st.smallBlind = sb;
  st.bigBlind = bb;
  st.lastRaise = bb;
  st.currentBet = 0;
  st.deck = deck;
  st.community = [];
  st.playerHands = {};
  st.roundBets = {};
  st.contributions = {};
  st.folded = {};
  st.acted = [];
  st.pendingLeave = [];
  st.waitingNextHand = [];
  st.turn = null;
  st.turnStartedAt = 0;
  st.lastActivityAt = ctx.now;
  st.dealt = eligible.map(s => s.id);
  for (const s of ctx.seats) {
    if (st.dealt.includes(s.id)) st.playerHands[s.id] = [deck.shift(), deck.shift()];
    else st.folded[s.id] = true; // sans jetons : spectateur pour cette main
  }
  put(ctx, sbP.id, sb);
  put(ctx, bbP.id, bb);
  st.currentBet = Math.max(roundBet(ctx, sbP.id), roundBet(ctx, bbP.id));
  st.message = 'La main a commencé.';
  st.lastResult = '';
  progress(ctx, bbP.seat);
  return ctx;
}

function act(ctx, uid, action, amount = 0, opts = {}) {
  const st = st_(ctx);
  if (!st.hand) throw engineError('Aucune main en cours.', 400);
  const seat = ctx.seats.find(s => s.id === uid);
  if (!seat) throw engineError('Vous n’êtes pas assis à cette table.', 403);
  if (!isLive(ctx, uid)) throw engineError('Vous avez déjà passé pour cette main.', 400);
  if (num(st.turn) !== uid) throw engineError('Ce n’est pas votre tour.', 409);
  if (!needsAction(ctx, uid)) throw engineError('Aucune action n’est attendue de votre part.', 409);

  const owe = toCall(ctx, uid);
  const cur = roundBet(ctx, uid);
  const chips = chipsOf(ctx, uid);
  if (!opts.auto) st.pendingLeave = st.pendingLeave.filter(x => x !== uid);
  if (!opts.auto) st.lastActivityAt = ctx.now;

  if (action === 'fold') {
    st.folded[uid] = true;
    addActed(ctx, uid);
  } else if (action === 'check') {
    if (owe > 0) throw engineError('Vous ne pouvez pas checker : il faut suivre ou passer.', 400);
    addActed(ctx, uid);
  } else if (action === 'call') {
    if (owe > 0) put(ctx, uid, owe);
    addActed(ctx, uid);
  } else if (action === 'raise') {
    const target = Number(amount);
    if (!Number.isSafeInteger(target)) throw engineError('Montant invalide.', 400);
    const stackTotal = cur + chips;
    if (target <= num(st.currentBet)) throw engineError('Le montant total doit dépasser la mise actuelle de la table.', 400);
    if (target > stackTotal) throw engineError('Le montant dépasse votre tapis disponible.', 400);
    const minTo = minRaiseTo(ctx);
    const allIn = target === stackTotal;
    if (target < minTo && !allIn) {
      throw engineError(`La relance totale doit être d’au moins ${minTo} jetons, sauf si vous êtes à tapis.`, 400);
    }
    const increment = target - num(st.currentBet);
    put(ctx, uid, target - cur);
    if (increment >= st.lastRaise) {
      st.lastRaise = increment;
      st.acted = [uid]; // une relance complète rouvre l'action
    } else addActed(ctx, uid);
    st.currentBet = target;
  } else {
    throw engineError('Action inconnue.', 400);
  }
  return progress(ctx, seat.seat);
}

// Délai dépassé : check si rien à suivre, sinon coucher. Le joueur quittera la table en fin de main.
function expireTurn(ctx) {
  const st = st_(ctx);
  if (!st.hand || st.turn == null || !st.turnStartedAt) return false;
  if (ctx.now - st.turnStartedAt < TURN_MS) return false;
  const uid = st.turn;
  if (!st.pendingLeave.includes(uid)) st.pendingLeave.push(uid);
  act(ctx, uid, toCall(ctx, uid) > 0 ? 'fold' : 'check', 0, { auto: true });
  return true;
}

// Répare une main bloquée (tour absent) : fait avancer ou conclure la main.
function repair(ctx) {
  const st = st_(ctx);
  if (!st.hand || st.turn != null) return false;
  progress(ctx, st.buttonSeat == null ? -1 : st.buttonSeat);
  return true;
}

// Départ d'un joueur. En cours de main : coucher (sauf si tapis), départ effectif en fin de main.
function leave(ctx, uid) {
  const st = st_(ctx);
  const seat = ctx.seats.find(s => s.id === uid);
  if (!seat) return ctx;
  if (!st.hand || !st.dealt.includes(uid)) {
    dropSeat(ctx, uid);
    st.waitingNextHand = st.waitingNextHand.filter(x => x !== uid);
    return ctx;
  }
  st.lastActivityAt = ctx.now;
  if (!st.pendingLeave.includes(uid)) st.pendingLeave.push(uid);
  if (chipsOf(ctx, uid) > 0 && !st.folded[uid]) {
    st.folded[uid] = true;
    addActed(ctx, uid);
  }
  const live = liveSeats(ctx);
  if (live.length <= 1) return finishHand(ctx, live[0] ? live[0].id : null);
  if (num(st.turn) === uid) return progress(ctx, seat.seat);
  return ctx;
}

// Entrée d'un joueur à une table. En cours de main : il ne joue qu'à partir de la main suivante.
function onJoin(ctx, uid, capacity) {
  const st = st_(ctx);
  st.lastActivityAt = ctx.now;
  if (st.waitingSince == null) st.waitingSince = ctx.now;
  if (ctx.seats.length === 1 && !st.hand) st.maxPlayers = capacity;
  if (st.hand) {
    st.folded[uid] = true;
    if (!st.waitingNextHand.includes(uid)) st.waitingNextHand.push(uid);
  }
  return ctx;
}

// Réinitialisation manager : rembourse les mises engagées puis remet la table à zéro.
function resetTable(ctx, { clear = false, maxPlayers = MAX_SEATS, message = '' } = {}) {
  const hadHand = st_(ctx).hand;
  for (const [uid, c] of contribMapOf(st_(ctx))) credit(ctx, uid, c);
  if (clear) for (const s of ctx.seats.slice()) dropSeat(ctx, s.id);
  const fresh = newTableState(maxPlayers);
  fresh.handNumber = st_(ctx).handNumber;
  fresh.buttonSeat = st_(ctx).buttonSeat;
  fresh.lastActivityAt = ctx.now;
  fresh.message = message || (hadHand ? 'Partie interrompue : les mises ont été remboursées.' : 'Table réinitialisée.');
  if (ctx.seats.length) fresh.waitingSince = ctx.now;
  ctx.st = fresh;
  return ctx;
}

// ---------- Vue publique (ce que le client peut voir) ----------
function publicTable(raw, seats, meta) {
  const st = normalizeState(JSON.parse(JSON.stringify(raw && typeof raw === 'object' ? raw : {})));
  const list = seats.slice().sort((a, b) => a.seat - b.seat);
  const dealt = new Set(st.dealt);
  const liveSet = new Set(list.filter(s => st.hand && dealt.has(s.id) && !st.folded[s.id]).map(s => s.id));
  const contrib = contribMapOf(st);
  const pots = st.hand ? buildPots(contrib, liveSet).map(p => p.amount) : [];
  const pot = [...contrib.values()].reduce((a, b) => a + b, 0);
  const me = meta.viewerId;
  const mine = list.find(s => s.id === me);
  const owe = mine ? Math.max(0, st.currentBet - num(st.roundBets[me])) : 0;
  let status = st.status;
  if (!st.hand && st.status !== 'Main terminée') status = list.length >= 2 ? 'Prête à distribuer' : 'En attente de joueurs';
  return {
    id: meta.id, name: meta.name, maxPlayers: st.maxPlayers, minBet: meta.minBet,
    smallBlind: st.smallBlind || meta.minBet, bigBlind: st.bigBlind || meta.minBet * 2,
    hand: st.hand, handNumber: st.handNumber, status, street: st.street,
    pot, pots, community: st.community, currentBet: st.currentBet,
    minRaiseTo: st.hand ? minRaiseTo({ st }) : meta.minBet * 2,
    toCall: owe, canCheck: owe === 0,
    turn: st.turn, turnStartedAt: st.turnStartedAt, turnMs: TURN_MS, serverTime: meta.now,
    buttonSeat: st.buttonSeat, message: st.message, lastResult: st.lastResult, lastOutcome: st.lastOutcome,
    myTurn: st.turn === me, myCards: mine ? (st.playerHands[me] || []) : [],
    playerCount: list.length,
    players: list.map(s => ({
      id: s.id, username: s.username, chips: s.chips, avatar: s.avatar, seat: s.seat,
      folded: !!st.folded[s.id] && dealt.has(s.id),
      sitOut: st.hand && !dealt.has(s.id),
      roundBet: num(st.roundBets[s.id]), contribution: num(st.contributions[s.id]),
      isTurn: st.turn === s.id,
      holeCards: s.id === me ? (st.playerHands[s.id] || []) : undefined,
    })),
  };
}

// =====================================================================
// Sons of Reaper Poker — API Worker (Cloudflare Pages, mode avancé).
// Compilé avec engine.js dans _worker.js par build.mjs.
// Toute écriture de table passe par commit() : une seule transaction D1,
// gardée par la valeur exacte de l'état lu (verrou optimiste).
// =====================================================================
const VERSION = '4.1.1';
const SESSION_SECONDS = 60 * 60 * 24 * 14;
const IDLE_MS = 10 * 60 * 1000;
const LOGIN_MAX_FAILS = 8;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const USERNAME_RE = /^[\p{L}\p{N}_-][\p{L}\p{N}_ -]{1,22}[\p{L}\p{N}_-]$/u;
function bootstrapUsername(env) {
  const name = String(env.ADMIN_BOOTSTRAP_USERNAME || 'SOR-VARG').trim();
  if (!USERNAME_RE.test(name)) throw httpErr('Configuration du nom administrateur invalide.', 503);
  return name;
}
function reservedUsername(name, env) {
  const key = name.toLowerCase();
  return key === 'manager' || key === bootstrapUsername(env).toLowerCase();
}
const MAX_CHIPS = 1000000000;
const schemaDone = new WeakMap();

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const httpErr = (message, status = 400) => Object.assign(new Error(message), { status });
const enc = s => new TextEncoder().encode(s);
const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const isInt = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;

async function sha256(s) { return hex(await crypto.subtle.digest('SHA-256', enc(s))); }
async function pbkdf2(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc(salt), iterations: 100000, hash: 'SHA-256' }, key, 256));
}
function randomHex(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return hex(a); }
// Entier uniforme dans [0, n) sans biais de modulo.
function randInt(n) {
  const max = Math.floor(0x100000000 / n) * n;
  let x;
  do { x = crypto.getRandomValues(new Uint32Array(1))[0]; } while (x >= max);
  return x % n;
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function readBody(req) {
  try { const b = await req.json(); return b && typeof b === 'object' ? b : null; } catch { return null; }
}
function bearerOf(req) { return (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''); }

// ---------- Schéma (additif : aucune colonne existante n'est modifiée) ----------
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL COLLATE NOCASE UNIQUE, password_hash TEXT NOT NULL, salt TEXT NOT NULL, chips INTEGER NOT NULL DEFAULT 0 CHECK(chips >= 0), avatar TEXT NOT NULL DEFAULT '', is_admin INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS tables_state (id INTEGER PRIMARY KEY, name TEXT NOT NULL, state_json TEXT NOT NULL DEFAULT '{}')`,
  `CREATE TABLE IF NOT EXISTS table_seats (table_id INTEGER NOT NULL REFERENCES tables_state(id), user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, seat_no INTEGER NOT NULL, PRIMARY KEY(table_id,user_id), UNIQUE(table_id,seat_no))`,
  `CREATE TABLE IF NOT EXISTS login_throttle (key TEXT PRIMARY KEY, failures INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS idx_seats_user ON table_seats(user_id)`,
];
async function ensureSchema(env) {
  if (schemaDone.has(env.DB)) return;
  for (const s of SCHEMA) await env.DB.prepare(s).run();
  await env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES ('active_tables','6'),('min_bet','10')").run();
  await env.DB.prepare("INSERT OR IGNORE INTO tables_state(id,name,state_json) VALUES (1,'Table 01','{}'),(2,'Table 02','{}'),(3,'Table 03','{}'),(4,'Table 04','{}'),(5,'Table 05','{}'),(6,'Table 06','{}')").run();
  schemaDone.set(env.DB, true);
}

async function settings(env) {
  const rows = (await env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('active_tables','min_bet')").all()).results;
  const m = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return { active_tables: clamp(Number(m.active_tables) || 6, 1, 6), min_bet: clamp(Number(m.min_bet) || 10, 1, 10000) };
}

// ---------- Comptes et sessions ----------
async function userFor(req, env) {
  const raw = bearerOf(req);
  if (!raw) return null;
  const row = await env.DB.prepare('SELECT u.id,u.username,u.chips,u.avatar,u.is_admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?')
    .bind(await sha256(raw), Math.floor(Date.now() / 1000)).first();
  return row ? { id: Number(row.id), username: row.username, chips: Number(row.chips), avatar: row.avatar || '', isAdmin: !!row.is_admin } : null;
}
async function requireUser(req, env) {
  const u = await userFor(req, env);
  if (!u) throw httpErr('Connexion requise.', 401);
  return u;
}
async function requireAdmin(req, env) {
  const u = await requireUser(req, env);
  if (!u.isAdmin) throw httpErr('Accès administrateur refusé.', 403);
  return u;
}
function publicUser(u) {
  return { id: Number(u.id), username: u.username, chips: Number(u.chips), avatar: u.avatar || '', isAdmin: !!u.is_admin };
}
async function createSession(env, userId) {
  const token = randomHex(32);
  await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
    .bind(await sha256(token), userId, Math.floor(Date.now() / 1000) + SESSION_SECONDS).run();
  const u = await env.DB.prepare('SELECT id,username,chips,avatar,is_admin FROM users WHERE id=?').bind(userId).first();
  return json({ token, user: publicUser(u) });
}
async function recordFailure(env, key, now) {
  const cur = await env.DB.prepare('SELECT failures FROM login_throttle WHERE key=?').bind(key).first();
  const f = (Number(cur ? cur.failures : 0) || 0) + 1;
  const locked = f >= LOGIN_MAX_FAILS ? now + LOGIN_LOCK_MS : 0;
  await env.DB.prepare('INSERT INTO login_throttle(key,failures,locked_until) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET failures=excluded.failures, locked_until=excluded.locked_until')
    .bind(key, locked ? 0 : f, locked).run();
}

// ---------- Tables : lecture, écriture atomique ----------
async function loadTable(env, id) {
  const row = await env.DB.prepare('SELECT id,name,state_json FROM tables_state WHERE id=?').bind(id).first();
  if (!row) return null;
  let state = {};
  try { state = JSON.parse(row.state_json || '{}'); } catch { state = {}; }
  const seats = (await env.DB.prepare('SELECT u.id,u.username,u.chips,u.avatar,ts.seat_no AS seat FROM table_seats ts JOIN users u ON u.id=ts.user_id WHERE ts.table_id=? ORDER BY ts.seat_no')
    .bind(id).all()).results.map(r => ({ id: Number(r.id), username: r.username, chips: Number(r.chips), avatar: r.avatar || '', seat: Number(r.seat) }));
  return { id, name: row.name, raw: row.state_json || '{}', state, seats };
}

const GUARD = 'EXISTS(SELECT 1 FROM tables_state WHERE id=? AND state_json=?)';
const opDeleteSeat = uid => (env, id, raw) =>
  env.DB.prepare(`DELETE FROM table_seats WHERE table_id=? AND user_id=? AND ${GUARD}`).bind(id, uid, id, raw);
const opInsertSeat = (uid, seat) => (env, id, raw) =>
  env.DB.prepare(`INSERT INTO table_seats(table_id,user_id,seat_no) SELECT ?,?,? WHERE ${GUARD} AND NOT EXISTS(SELECT 1 FROM table_seats WHERE user_id=?)`)
    .bind(id, uid, seat, id, raw, uid);

// Écrit l'état, les soldes et les sièges dans une seule transaction D1.
// Chaque instruction n'agit que si l'état est toujours celui lu : sinon rien n'est écrit.
async function commit(env, id, raw, st, delta, ops, guard) {
  const stmts = [];
  for (const [uid, amt] of delta) {
    stmts.push(env.DB.prepare(`UPDATE users SET chips=chips+? WHERE id=? AND ${GUARD}`).bind(amt, uid, id, raw));
  }
  for (const op of ops) stmts.push(op(env, id, raw));
  const sql = 'UPDATE tables_state SET state_json=? WHERE id=? AND state_json=?' + (guard ? ` AND ${guard.sql}` : '');
  stmts.push(env.DB.prepare(sql).bind(JSON.stringify(st), id, raw, ...(guard ? guard.params : [])));
  const results = await env.DB.batch(stmts);
  return Number(results[results.length - 1].meta.changes) === 1;
}

// fn(ctx, table, cfg) : modifie le contexte. Renvoie null (aucune écriture) ou { output, ops, guard }.
async function mutateTable(env, id, fn) {
  const cfg = await settings(env);
  for (let attempt = 0; attempt < 6; attempt++) {
    const t = await loadTable(env, id);
    if (!t) throw httpErr('Table inconnue.', 404);
    const ctx = makeCtx(t.state, t.seats, { now: Date.now(), rand: randInt, minBet: cfg.min_bet });
    const res = await fn(ctx, t, cfg);
    if (!res) return { output: undefined, written: false };
    const delta = deltaOf(ctx);
    const ops = [...(res.ops || []), ...ctx.removed.map(uid => opDeleteSeat(uid))];
    let ok;
    try {
      ok = await commit(env, id, t.raw, ctx.st, delta, ops, res.guard || null);
    } catch (e) {
      if (/UNIQUE|CHECK|constraint/i.test(String(e && e.message))) throw httpErr('Action impossible pour le moment. Actualisez la table.', 409);
      throw e;
    }
    if (ok) return { output: res.output, written: true };
  }
  throw httpErr('La table est très sollicitée. Réessayez dans un instant.', 409);
}

async function viewFor(env, id, viewerId) {
  const cfg = await settings(env);
  const t = await loadTable(env, id);
  if (!t) throw httpErr('Table inconnue.', 404);
  return publicTable(t.state, t.seats, { id, name: t.name, viewerId, minBet: cfg.min_bet, now: Date.now() });
}

// Applique l'expiration de délai ou répare une main bloquée, sans écrire si rien à faire.
async function advanceTable(env, id) {
  await mutateTable(env, id, ctx => (expireTurn(ctx) || repair(ctx)) ? {} : null);
}

// Nettoyage : tables inactives depuis 10 minutes → remboursement des mises puis vidage.
async function sweepIdle(env) {
  const rows = (await env.DB.prepare('SELECT t.id, t.state_json, (SELECT COUNT(*) FROM table_seats s WHERE s.table_id=t.id) AS n FROM tables_state t').all()).results;
  const now = Date.now();
  for (const r of rows) {
    const n = Number(r.n) || 0;
    let st = {};
    try { st = JSON.parse(r.state_json || '{}'); } catch { st = {}; }
    if (n === 0) {
      // Table vide mais restée en main (interruption) : on rembourse et on remet à zéro, une seule fois.
      if (st.hand) {
        await mutateTable(env, Number(r.id), ctx => { resetTable(ctx, { clear: true }); return {}; });
      }
      continue;
    }
    const last = Number(st.lastActivityAt || st.waitingSince || 0);
    if (last && now - last >= IDLE_MS) {
      await mutateTable(env, Number(r.id), ctx => {
        resetTable(ctx, { clear: true, message: 'Table vidée après 10 minutes sans activité.' });
        return {};
      });
    }
  }
}

// ---------- Routes ----------
async function route(req, env, url) {
  const method = req.method;
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  if (path === 'health' && (method === 'GET' || method === 'HEAD')) {
    return new Response(method === 'HEAD' ? null : JSON.stringify({ ok: true, service: 'sons-of-reaper-poker-api', version: VERSION }),
      { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  }
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'GET, POST' } });
  if (method !== 'GET' && method !== 'POST') throw httpErr('Méthode non autorisée.', 405);
  await ensureSchema(env);

  if (path === 'register' && method === 'POST') {
    const b = await readBody(req) || {};
    const username = String(b.username || '').trim();
    if (!USERNAME_RE.test(username)) throw httpErr('Nom d’utilisateur invalide (3 à 24 caractères).');
    if (typeof b.password !== 'string' || b.password.length < 6 || b.password.length > 128) throw httpErr('Le mot de passe doit contenir entre 6 et 128 caractères.');
    if (reservedUsername(username, env)) throw httpErr('Ce nom est réservé.', 403);
    const salt = randomHex(16);
    const hash = await pbkdf2(b.password, salt);
    let id;
    try {
      const r = await env.DB.prepare('INSERT INTO users(username,password_hash,salt,chips) VALUES(?,?,?,0)').bind(username, hash, salt).run();
      id = Number(r.meta.last_row_id);
    } catch {
      throw httpErr('Ce nom d’utilisateur est déjà utilisé.', 409);
    }
    return createSession(env, id);
  }

  if (path === 'login' && method === 'POST') {
    const b = await readBody(req);
    if (!b) throw httpErr('Données invalides.');
    const username = String(b.username || '').trim();
    const password = typeof b.password === 'string' ? b.password : '';
    if (!username || password.length > 128) throw httpErr('Identifiants incorrects.', 401);
    const key = username.toLowerCase();
    const now = Date.now();
    const th = await env.DB.prepare('SELECT locked_until FROM login_throttle WHERE key=?').bind(key).first();
    if (th && Number(th.locked_until) > now) throw httpErr('Trop de tentatives. Réessayez dans quelques minutes.', 429);
    const u = await env.DB.prepare('SELECT id,password_hash,salt,is_admin FROM users WHERE username=? COLLATE NOCASE').bind(username).first();
    const adminName = bootstrapUsername(env);
    if (key === adminName.toLowerCase() && env.ADMIN_BOOTSTRAP_PASSWORD && safeEqual(password, String(env.ADMIN_BOOTSTRAP_PASSWORD))) {
      if (u && !u.is_admin) throw httpErr('Ce nom est déjà utilisé par un compte joueur. Aucun droit administrateur n’a été ajouté : contactez l’administration.', 409);
      if (!u) {
        // Initialisation nominative depuis le secret Cloudflare, sans mot de passe embarqué.
        const salt = randomHex(16);
        const r = await env.DB.prepare('INSERT INTO users(username,password_hash,salt,chips,is_admin) VALUES(?,?,?,0,1)')
          .bind(adminName, await pbkdf2(password, salt), salt).run();
        return createSession(env, Number(r.meta.last_row_id));
      }
    }
    const hash = await pbkdf2(password, u ? u.salt : 'x'.repeat(32));
    if (!u || !safeEqual(hash, u.password_hash)) {
      await recordFailure(env, key, now);
      throw httpErr('Identifiants incorrects.', 401);
    }
    await env.DB.prepare('DELETE FROM login_throttle WHERE key=?').bind(key).run();
    await env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(Math.floor(now / 1000)).run();
    return createSession(env, Number(u.id));
  }

  if (path === 'me' && method === 'GET') {
    const u = await requireUser(req, env);
    return json({ user: u });
  }

  if (path === 'profile' && method === 'POST') {
    const u = await requireUser(req, env);
    const b = await readBody(req) || {};
    const username = String(b.username || '').trim();
    if (!USERNAME_RE.test(username)) throw httpErr('Le nom d’utilisateur doit contenir 3 à 24 caractères.');
    if (reservedUsername(username, env) && !u.isAdmin) throw httpErr('Ce nom est réservé.', 403);
    const avatar = String(b.avatar || '').trim();
    if (avatar && !/^https:\/\/[^\s"'<>]{4,}$/i.test(avatar)) throw httpErr('Le lien de photo doit commencer par https://.');
    try {
      if (typeof b.newPassword === 'string' && b.newPassword.length) {
        if (b.newPassword.length < 6 || b.newPassword.length > 128) throw httpErr('Le nouveau mot de passe doit contenir entre 6 et 128 caractères.');
        const row = await env.DB.prepare('SELECT password_hash,salt FROM users WHERE id=?').bind(u.id).first();
        if (typeof b.currentPassword !== 'string' || !safeEqual(await pbkdf2(b.currentPassword, row.salt), row.password_hash)) {
          throw httpErr('Le mot de passe actuel est incorrect.', 403);
        }
        const salt = randomHex(16);
        await env.DB.prepare('UPDATE users SET username=?,avatar=?,salt=?,password_hash=? WHERE id=?')
          .bind(username, avatar, salt, await pbkdf2(b.newPassword, salt), u.id).run();
        // Changement de mot de passe : les autres sessions sont révoquées.
        await env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').bind(u.id, await sha256(bearerOf(req))).run();
      } else {
        await env.DB.prepare('UPDATE users SET username=?,avatar=? WHERE id=?').bind(username, avatar, u.id).run();
      }
    } catch (e) {
      if (e && e.status) throw e;
      throw httpErr('Ce nom d’utilisateur est déjà utilisé.', 409);
    }
    return json({ ok: true });
  }

  if (path === 'tables' && method === 'GET') {
    const viewer = await userFor(req, env);
    const cfg = await settings(env);
    await sweepIdle(env);
    const out = [];
    for (let i = 1; i <= 6; i++) {
      const t = await loadTable(env, i);
      if (!t) continue;
      out.push({
        id: t.id, name: t.name, maxPlayers: t.state.maxPlayers || 5, playerCount: t.seats.length,
        hand: !!t.state.hand, disabled: i > cfg.active_tables,
        mine: !!viewer && t.seats.some(s => s.id === viewer.id),
      });
    }
    return json({ tables: out });
  }

  if (path === 'table' && method === 'GET') {
    const u = await requireUser(req, env);
    const id = Number(url.searchParams.get('id'));
    if (!isInt(id, 1, 6)) throw httpErr('Table inconnue.', 404);
    await advanceTable(env, id);
    return json({ table: await viewFor(env, id, u.id) });
  }

  if (path === 'join' && method === 'POST') {
    const u = await requireUser(req, env);
    if (u.isAdmin) throw httpErr('Le compte administrateur sert uniquement à gérer le club et ne peut pas jouer.', 403);
    const b = await readBody(req) || {};
    const id = Number(b.tableId);
    const cfg = await settings(env);
    if (!isInt(id, 1, 6) || id > cfg.active_tables) throw httpErr('Cette table n’est pas active.');
    const fresh = await env.DB.prepare('SELECT chips FROM users WHERE id=?').bind(u.id).first();
    const other = await env.DB.prepare('SELECT table_id FROM table_seats WHERE user_id=? AND table_id<>? LIMIT 1').bind(u.id, id).first();
    if (other) throw httpErr('Vous êtes déjà assis à une autre table. Quittez votre table actuelle avant d’en rejoindre une nouvelle.', 409);
    const capacity = clamp(Number(b.maxPlayers) || 5, 2, 5);
    let message = 'Place réservée. La main démarre quand la table est complète ; un joueur peut aussi la lancer dès deux joueurs.';
    let already = false;
    await mutateTable(env, id, (ctx, t, cfg2) => {
      if (t.seats.some(s => s.id === u.id)) { already = true; return null; }
      if (Number(fresh.chips) <= 0) throw httpErr('Vous n’avez plus de jetons. Demandez un crédit au manager pour prendre place.', 400);
      const taken = new Set(t.seats.map(s => s.seat));
      if (t.seats.length >= ctx.st.maxPlayers) throw httpErr('Cette table est complète.', 409);
      let seat = -1;
      for (let i = 0; i < 5; i++) if (!taken.has(i)) { seat = i; break; }
      if (seat < 0) throw httpErr('Cette table est complète.', 409);
      addSeat(ctx, { id: u.id, username: u.username, chips: Number(fresh.chips), avatar: u.avatar, seat });
      onJoin(ctx, u.id, capacity);
      if (!ctx.st.hand && ctx.seats.length >= ctx.st.maxPlayers && ctx.seats.filter(s => s.chips > 0).length >= 2) {
        dealHand(ctx, cfg2.min_bet);
        message = 'La table est complète : la main démarre.';
      }
      return {
        ops: [opInsertSeat(u.id, seat)],
        guard: { sql: 'EXISTS(SELECT 1 FROM table_seats WHERE table_id=? AND user_id=?)', params: [id, u.id] },
      };
    });
    return json({ table: await viewFor(env, id, u.id), message: already ? 'Vous êtes déjà à cette table.' : message });
  }

  if (path === 'leave' && method === 'POST') {
    const u = await requireUser(req, env);
    const b = await readBody(req) || {};
    const id = Number(b.tableId);
    if (!isInt(id, 1, 6)) throw httpErr('Table inconnue.', 404);
    let message = 'Vous avez quitté la table.';
    await mutateTable(env, id, (ctx, t) => {
      if (!t.seats.some(s => s.id === u.id)) return null;
      leave(ctx, u.id);
      if (ctx.seats.some(s => s.id === u.id)) message = 'Vous quitterez la table à la fin de cette main.';
      return {};
    });
    return json({ ok: true, message });
  }

  if (path === 'start' && method === 'POST') {
    const u = await requireUser(req, env);
    const b = await readBody(req) || {};
    const id = Number(b.tableId);
    if (!isInt(id, 1, 6)) throw httpErr('Table inconnue.', 404);
    let message = 'Main distribuée.';
    await mutateTable(env, id, (ctx, t, cfg) => {
      if (!t.seats.some(s => s.id === u.id)) throw httpErr('Vous devez être assis à cette table.', 403);
      if (ctx.st.hand) { message = 'Une main est déjà en cours.'; return null; }
      if (ctx.seats.length < 2) throw httpErr('Il faut au moins deux joueurs pour démarrer une main.', 400);
      dealHand(ctx, cfg.min_bet);
      return {};
    });
    return json({ table: await viewFor(env, id, u.id), message });
  }

  if (path === 'action' && method === 'POST') {
    const u = await requireUser(req, env);
    const b = await readBody(req) || {};
    const id = Number(b.tableId);
    if (!isInt(id, 1, 6)) throw httpErr('Table invalide.');
    const action = String(b.action || '');
    const amount = Number(b.amount || 0);
    let expired = false;
    await mutateTable(env, id, (ctx, t) => {
      if (!t.seats.some(s => s.id === u.id)) throw httpErr('Vous n’êtes pas assis à cette table.', 403);
      if (expireTurn(ctx)) { expired = true; return {}; }
      act(ctx, u.id, action, amount);
      return {};
    });
    if (expired) throw httpErr('Le délai de jeu est écoulé : l’action automatique a été appliquée.', 409);
    return json({ table: await viewFor(env, id, u.id), message: 'Action enregistrée.' });
  }

  if (path === 'admin' && method === 'GET') {
    await requireAdmin(req, env);
    const cfg = await settings(env);
    const users = (await env.DB.prepare('SELECT u.id,u.username,u.chips,u.is_admin,u.avatar, EXISTS(SELECT 1 FROM table_seats s WHERE s.user_id=u.id) AS seated FROM users u ORDER BY u.id DESC LIMIT 500').all()).results
      .map(r => ({ id: Number(r.id), username: r.username, chips: Number(r.chips), is_admin: !!r.is_admin, avatar: r.avatar || '', seated: !!r.seated }));
    return json({ settings: cfg, users });
  }

  if (path === 'admin/settings' && method === 'POST') {
    await requireAdmin(req, env);
    const b = await readBody(req) || {};
    if (!isInt(b.active_tables, 1, 6) || !isInt(b.min_bet, 1, 10000)) throw httpErr('Paramètres invalides.');
    await env.DB.prepare("INSERT INTO settings(key,value) VALUES('active_tables',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(b.active_tables)).run();
    await env.DB.prepare("INSERT INTO settings(key,value) VALUES('min_bet',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(b.min_bet)).run();
    return json({ ok: true, message: 'Paramètres enregistrés.' });
  }

  if (path === 'admin/table-reset' && method === 'POST') {
    await requireAdmin(req, env);
    const b = await readBody(req) || {};
    const id = Number(b.tableId);
    if (!isInt(id, 1, 6)) throw httpErr('Table invalide.');
    const clear = String(b.mode || 'reset') === 'clear';
    await mutateTable(env, id, ctx => {
      resetTable(ctx, {
        clear,
        maxPlayers: clamp(Number(b.maxPlayers) || 5, 2, 5),
        message: clear ? 'Table vidée par le manager. Les mises engagées ont été remboursées.' : undefined,
      });
      return {};
    });
    return json({ ok: true, table: await viewFor(env, id, null), message: clear ? 'Table vidée.' : 'Table réinitialisée.' });
  }

  if (path === 'admin/user' && method === 'POST') {
    await requireAdmin(req, env);
    const b = await readBody(req) || {};
    if (!isInt(b.id, 1, Number.MAX_SAFE_INTEGER) || !isInt(b.chips, 0, MAX_CHIPS) || !USERNAME_RE.test(String(b.username || '').trim())) {
      throw httpErr('Données utilisateur invalides.');
    }
    const target = await env.DB.prepare('SELECT is_admin FROM users WHERE id=?').bind(b.id).first();
    if (!target) throw httpErr('Compte introuvable.', 404);
    if (target.is_admin) throw httpErr('Le compte administrateur ne se modifie pas ici.', 403);
    const seated = await env.DB.prepare('SELECT 1 FROM table_seats WHERE user_id=? LIMIT 1').bind(b.id).first();
    if (seated) throw httpErr('Ce joueur est assis à une table. Faites-le quitter avant de modifier son compte.', 409);
    const username = String(b.username).trim();
    try {
      if (typeof b.password === 'string' && b.password.length) {
        if (b.password.length < 6 || b.password.length > 128) throw httpErr('Le mot de passe doit contenir entre 6 et 128 caractères.');
        const salt = randomHex(16);
        await env.DB.prepare('UPDATE users SET username=?,chips=?,salt=?,password_hash=? WHERE id=?').bind(username, b.chips, salt, await pbkdf2(b.password, salt), b.id).run();
        await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(b.id).run();
      } else {
        await env.DB.prepare('UPDATE users SET username=?,chips=? WHERE id=?').bind(username, b.chips, b.id).run();
      }
    } catch (e) {
      if (e && e.status) throw e;
      throw httpErr('Pseudonyme déjà utilisé ou mise à jour impossible.', 409);
    }
    return json({ ok: true, message: 'Compte mis à jour.' });
  }

  if (path === 'admin/user/delete' && method === 'POST') {
    await requireAdmin(req, env);
    const b = await readBody(req) || {};
    if (!isInt(b.id, 1, Number.MAX_SAFE_INTEGER)) throw httpErr('Compte invalide.');
    const target = await env.DB.prepare('SELECT id,is_admin FROM users WHERE id=?').bind(b.id).first();
    if (!target) throw httpErr('Compte introuvable.', 404);
    if (target.is_admin) throw httpErr('Le compte administrateur est protégé et ne peut pas être supprimé.', 403);
    const seated = await env.DB.prepare('SELECT 1 FROM table_seats WHERE user_id=? LIMIT 1').bind(b.id).first();
    if (seated) throw httpErr('Ce joueur est encore assis à une table. Faites-le quitter avant de supprimer son profil.', 409);
    await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(b.id).run();
    await env.DB.prepare('DELETE FROM users WHERE id=? AND is_admin=0').bind(b.id).run();
    return json({ ok: true, message: 'Profil supprimé.' });
  }

  throw httpErr('Route API inconnue.', 404);
}

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self'; font-src 'self' data:; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};
function secure(res) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      if (!env.ASSETS || typeof env.ASSETS.fetch !== 'function') {
        return secure(new Response('Configuration Pages incomplète : liaison ASSETS absente.', { status: 500 }));
      }
      const r = secure(await env.ASSETS.fetch(request));
      if (/(\.html|\/sw\.js|\.webmanifest|\/)$/.test(url.pathname)) r.headers.set('cache-control', 'no-cache');
      return r;
    }
    try {
      return secure(await route(request, env, url));
    } catch (e) {
      if (e && e.status) return secure(json({ error: e.message }, e.status));
      console.error('api_error', e && e.stack ? e.stack : e);
      return secure(json({ error: 'Erreur serveur. Réessayez dans un instant.' }, 500));
    }
  },
};
