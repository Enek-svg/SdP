// scene.js — escena de intervención en tiempo real: simulación (pura, sin DOM) y dibujo en canvas.
(function (root, deps) {
  'use strict';

  const { clamp, rand } = deps.Utils;
  const C = deps.Constants;

  const W = 100;
  const H = 60;
  const BASE_TENSION = [0, 12, 22, 35, 50, 72];
  const STANCE_X = { hold: 26, talk: 33, advance: 46, retreat: 8, disperse: 52 };

  function moodOf(tension) {
    return tension < 35 ? 'calm' : tension < 70 ? 'tense' : 'violent';
  }

  function create({ incident, support }) {
    const squadIds = ['patrulla'];
    if (support.includes('apoyo')) squadIds.push('apoyo');
    if (support.includes('uip')) squadIds.push('uip');
    const squads = squadIds.map((id, index) => ({ id, type: C.unitTypes[id], index }));

    const agents = [];
    squads.forEach((squad) => {
      const count = squad.type.agents;
      const laneY = squads.length === 1 ? 30 : 12 + squad.index * (36 / (squads.length - 1));
      for (let k = 0; k < count; k += 1) {
        agents.push({
          squad: squad.id,
          x: 5,
          y: laneY + (k - (count - 1) / 2) * 4.6,
          offX: (k % 2) * 2.2,
          label: k === 0
        });
      }
    });

    const civCount = clamp(incident.crowd, 4, 36);
    const civs = Array.from({ length: civCount }, () => ({
      x: rand(60, 92), y: rand(6, 54), hx: rand(58, 93), hy: rand(6, 54),
      p: Math.random(), k: Math.random(), flee: 0, fy: rand(-1, 1), angry: false
    }));

    const overResponse = support.includes('uip') && incident.sev <= 2;
    const sev = incident.sev;
    const levelFactor = sev >= 4 ? 1.3 : sev <= 1 ? 0.7 : 1;
    const tension = clamp(BASE_TENSION[sev] + (overResponse ? 10 : 0) + (incident.crowd > 20 ? 4 : 0), 0, 90);

    const stance = {};
    squads.forEach((squad) => { stance[squad.id] = 'hold'; });

    return {
      incident, support, squads, agents, civs,
      time: 0,
      limit: sev >= 5 ? 60 : sev >= 4 ? 52 : 45,
      tension, maxTension: tension,
      baseRise: 1.1 * levelFactor * (incident.crowd >= 20 ? 1.2 : 1),
      stance,
      orders: [],
      disperseUsed: false,
      pushUsed: false,
      trustPenalty: 0,
      calmTimer: 0,
      throwTimer: rand(2, 4),
      projectiles: [],
      flash: 0,
      feed: [`Llegáis a ${incident.place}.`],
      lastMood: moodOf(tension),
      frontX: 5,
      done: null
    };
  }

  function say(sim, text) {
    sim.feed.unshift(text);
    sim.feed = sim.feed.slice(0, 4);
  }

  function setStance(sim, squadIds, stanceId) {
    const def = C.stances.find((item) => item.id === stanceId);
    if (!def || sim.done) return;
    squadIds.forEach((id) => {
      if (!(id in sim.stance) || sim.stance[id] === stanceId) return;
      sim.stance[id] = stanceId;
      const squad = sim.squads.find((item) => item.id === id);
      sim.orders.push({ t: Math.round(sim.time), label: `${squad.type.name}: ${def.label.toLowerCase()}` });
      if (stanceId === 'disperse') sim.trustPenalty += 1;
      say(sim, `${squad.type.name}: ${def.label.toLowerCase()}.`);
    });
  }

  function step(sim, dtRaw) {
    if (sim.done) return;
    const dt = Math.min(dtRaw, 0.1);
    sim.time += dt;
    const t = sim.tension;

    // Tensión: sube sola y cada grupo la mueve según su postura y sus características.
    let rate = sim.baseRise;
    sim.squads.forEach((squad) => {
      const st = sim.stance[squad.id];
      const ut = squad.type;
      let effect = 0;
      if (st === 'hold') effect = -0.5 * ut.force;
      else if (st === 'talk') effect = t < 70 ? -1.3 * ut.dialogue : -0.3 * ut.dialogue;
      else if (st === 'advance') effect = t < 35 ? -0.3 * ut.force : 0.9 * ut.force * (0.5 + t / 100);
      else if (st === 'retreat') effect = -0.9;
      else if (st === 'disperse') effect = t >= 65 ? 2.0 * ut.force : -2.3 * ut.force;
      if (st === 'advance' && t >= 50) sim.pushUsed = true;
      if (st === 'disperse') sim.disperseUsed = true;
      rate += effect;
    });
    sim.tension = clamp(sim.tension + rate * dt, 0, 100);

    // Agentes: se mueven hacia la posición de su postura.
    let front = 0;
    sim.agents.forEach((agent) => {
      const squad = sim.squads.find((item) => item.id === agent.squad);
      const targetX = STANCE_X[sim.stance[agent.squad]] + agent.offX;
      const dx = targetX - agent.x;
      const stepX = Math.sign(dx) * Math.min(Math.abs(dx), squad.type.speed * dt);
      agent.x += stepX;
      front = Math.max(front, agent.x);
    });
    sim.frontX = front;

    // Civiles: los furiosos presionan la línea, los tranquilos se quedan; al dispersar huyen.
    const dispersing = sim.squads.some((squad) => sim.stance[squad.id] === 'disperse');
    sim.civs.forEach((civ) => {
      civ.angry = civ.p < sim.tension / 100;
      if (dispersing && civ.x < front + 34 && civ.flee <= 0 && Math.random() < dt * 2) civ.flee = 1.6;
      if (civ.flee > 0) {
        civ.flee -= dt;
        civ.x = Math.min(97, civ.x + 22 * dt);
        civ.y = clamp(civ.y + civ.fy * 6 * dt, 4, 56);
        return;
      }
      let tx = civ.hx;
      let ty = civ.hy;
      if (civ.angry && sim.tension > 30) {
        tx = Math.max(front + 6 + civ.k * 24, 40);
        ty = civ.hy;
      }
      const speed = civ.angry ? 0.9 : 0.5;
      civ.x += (tx - civ.x) * dt * speed + Math.sin(sim.time * 2 + civ.p * 20) * 0.06;
      civ.y += (ty - civ.y) * dt * 0.3 + Math.cos(sim.time * 1.7 + civ.k * 20) * 0.06;
      if (civ.x < front + 3.5) civ.x = front + 3.5;
      civ.x = clamp(civ.x, 3, 97);
    });

    // Objetos lanzados cuando la tensión es alta.
    sim.throwTimer -= dt;
    if (sim.throwTimer <= 0) {
      sim.throwTimer = rand(3.5, 5.5);
      const angry = sim.civs.filter((civ) => civ.angry && civ.flee <= 0);
      if (sim.tension > 45 && angry.length) {
        const from = angry[Math.floor(Math.random() * angry.length)];
        const target = sim.agents[Math.floor(Math.random() * sim.agents.length)];
        sim.projectiles.push({ x: from.x, y: from.y, tx: target.x, ty: target.y, t: 0 });
        say(sim, 'Lanzan un objeto contra la línea.');
      }
    }
    sim.projectiles.forEach((p) => {
      p.t += dt / 0.7;
      if (p.t >= 1 && !p.hit) {
        p.hit = true;
        const holding = sim.squads.some((squad) => sim.stance[squad.id] === 'hold' && squad.id === 'uip');
        sim.tension = clamp(sim.tension + (holding ? 0.8 : 2), 0, 100);
        sim.flash = 0.3;
      }
    });
    sim.projectiles = sim.projectiles.filter((p) => !p.hit);
    sim.flash = Math.max(0, sim.flash - dt);

    sim.maxTension = Math.max(sim.maxTension, sim.tension);
    const mood = moodOf(sim.tension);
    if (mood !== sim.lastMood) {
      say(sim, mood === 'calm' ? 'La multitud se calma.' : mood === 'tense' ? (sim.lastMood === 'calm' ? 'El ambiente se tensa.' : 'Baja un poco la tensión.') : 'La situación se vuelve violenta.');
      sim.lastMood = mood;
    }

    // Final de la escena.
    if (sim.tension >= 100) {
      sim.done = 'escalated';
    } else if (sim.tension <= 10) {
      sim.calmTimer += dt;
      if (sim.calmTimer >= 2.5) sim.done = 'calm';
    } else {
      sim.calmTimer = 0;
    }
    if (!sim.done && sim.time >= sim.limit) {
      sim.done = sim.tension <= 30 ? 'calm' : sim.tension < 60 ? 'partial' : 'escalated';
    }
  }

  function outcome(sim) {
    return {
      result: sim.done || 'partial',
      tension: sim.tension,
      maxTension: sim.maxTension,
      time: sim.time,
      limit: sim.limit,
      orders: sim.orders.map((item) => item.label),
      disperseUsed: sim.disperseUsed,
      pushUsed: sim.pushUsed,
      trustPenalty: sim.trustPenalty
    };
  }

  // --- dibujo ---
  function drawProp(ctx, sim, sx, sy) {
    const x = 80 * sx;
    const y = 30 * sy;
    ctx.save();
    ctx.fillStyle = '#5a6b73';
    switch (sim.incident.prop) {
      case 'car': ctx.fillStyle = '#7b8791'; ctx.fillRect(x - 6 * sx, y - 2.5 * sy, 12 * sx, 5 * sy); ctx.fillStyle = '#273038'; ctx.fillRect(x - 3 * sx, y - 2 * sy, 5 * sx, 4 * sy); break;
      case 'speaker': ctx.fillStyle = '#b58bd9'; ctx.fillRect(x - 3 * sx, y - 3 * sy, 6 * sx, 6 * sy); break;
      case 'banner': ctx.fillStyle = '#f0bc65'; ctx.fillRect(x - 1 * sx, y - 12 * sy, 2 * sx, 24 * sy); break;
      case 'door': ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 3 * sx, y - 6 * sy, 6 * sx, 12 * sy); break;
      case 'stall': ctx.fillStyle = '#c97a4a'; ctx.fillRect(x - 5 * sx, y - 3 * sy, 10 * sx, 6 * sy); break;
      default: ctx.beginPath(); ctx.arc(x, y, 3 * sx, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function draw(ctx, sim, width, height) {
    const sx = width / W;
    const sy = height / H;
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, width, 0);
    bg.addColorStop(0, '#1c2530');
    bg.addColorStop(1, '#222d36');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    // acera y calzada
    ctx.fillStyle = '#2a343d';
    ctx.fillRect(0, 0, width, 5 * sy);
    ctx.fillRect(0, height - 5 * sy, width, 5 * sy);
    ctx.strokeStyle = 'rgba(240,215,120,.35)';
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    drawProp(ctx, sim, sx, sy);

    if (sim.support.includes('sanitario')) {
      ctx.fillStyle = '#f2f4f5';
      ctx.fillRect(86 * sx, 53 * sy, 9 * sx, 5 * sy);
      ctx.fillStyle = '#e4453b';
      ctx.fillRect(89.6 * sx, 54 * sy, 1.8 * sx, 3 * sy);
      ctx.fillRect(89 * sx, 54.7 * sy, 3 * sx, 1.6 * sy);
    }

    // civiles
    sim.civs.forEach((civ) => {
      ctx.fillStyle = civ.flee > 0 ? '#c9b98a' : civ.angry ? '#e5534b' : '#e8d9a0';
      ctx.beginPath();
      ctx.arc(civ.x * sx, civ.y * sy, 1.35 * sx, 0, Math.PI * 2);
      ctx.fill();
    });

    // agentes y escudos
    sim.agents.forEach((agent) => {
      const squad = sim.squads.find((item) => item.id === agent.squad);
      const st = sim.stance[agent.squad];
      if ((st === 'hold' || st === 'advance' || st === 'disperse') && squad.id === 'uip') {
        ctx.fillStyle = 'rgba(200,215,235,.55)';
        ctx.fillRect((agent.x + 1.4) * sx, (agent.y - 1.8) * sy, 0.9 * sx, 3.6 * sy);
      }
      ctx.fillStyle = squad.type.color;
      ctx.beginPath();
      ctx.arc(agent.x * sx, agent.y * sy, 1.6 * sx, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e8f1ff';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (agent.label) {
        ctx.fillStyle = '#e8f1ff';
        ctx.font = '600 10px sans-serif';
        ctx.fillText(squad.id === 'patrulla' ? 'P' : squad.id === 'apoyo' ? 'A' : 'U', (agent.x - 0.8) * sx, (agent.y - 2.6) * sy);
      }
    });

    // proyectiles
    sim.projectiles.forEach((p) => {
      const px = p.x + (p.tx - p.x) * p.t;
      const py = p.y + (p.ty - p.y) * p.t - Math.sin(p.t * Math.PI) * 5;
      ctx.fillStyle = '#ffd25c';
      ctx.beginPath();
      ctx.arc(px * sx, py * sy, 1 * sx, 0, Math.PI * 2);
      ctx.fill();
    });

    // viñeta de tensión y destello de impacto
    const alpha = clamp(sim.tension / 100, 0, 1) * 0.22 + sim.flash;
    if (alpha > 0.01) {
      ctx.fillStyle = `rgba(229,83,75,${alpha.toFixed(3)})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  const api = { W, H, create, step, setStance, outcome, draw, moodOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Scene = api;
})(
  typeof window !== 'undefined' ? window : globalThis,
  typeof window !== 'undefined'
    ? { Utils: window.Utils, Constants: window.Constants }
    : { Utils: require('./utils.js'), Constants: require('./constants.js') }
);
