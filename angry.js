(() => {
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
  
    const scoreEl = document.getElementById("score");
    const shotsEl = document.getElementById("shots");
    const leftEl = document.getElementById("left");
  
    // --- Utils
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const len = (x, y) => Math.hypot(x, y);
    const rand = (a, b) => a + Math.random() * (b - a);
  
    function worldToScreenY(y) { return y; }
  
    // --- Simple physics (circles + AABB boxes)
    const W = canvas.width;
    const H = canvas.height;
  
    const GRAVITY = 1400;      // px/s^2
    const AIR_DENSITY = 0.0017;
    const DEFAULT_MASS = 1.0;
    const DEFAULT_CD = 0.47;
    const SPIN_LIFT = 0.07;
    const SPIN_DAMP = 0.993;
    const AIR_DAMP = 0.998;    // per frame multiplier-ish
    const RESTITUTION = 0.35;  // bounce on ground/walls
    const FRICTION = 0.86;     // ground friction
  
    const GROUND_Y = H - 70;
  
    const sling = {
      x: 170,
      y: GROUND_Y - 30,
      maxPull: 110,
    };
  
    let state = null;
  
    function reset() {
      state = {
        time: 0,
        score: 0,
        shots: 0,
        dragging: false,
        dragX: sling.x,
        dragY: sling.y,
        projectile: makeProjectile(),
        blocks: [],
        enemies: [],
        particles: [],
        lastImpactAt: 0,
        wind: {
          current: rand(-90, 90),
          target: rand(-140, 140),
          changeIn: rand(2.5, 5.5),
          gustAmp: rand(10, 34),
          gustFreq: rand(0.45, 0.9),
          gustPhase: rand(0, Math.PI * 2),
        },
      };
  
      buildLevel();
      updateHUD();
    }
  
    function makeProjectile() {
      return {
        r: 16,
        x: sling.x,
        y: sling.y,
        vx: 0,
        vy: 0,
        mass: DEFAULT_MASS,
        cd: DEFAULT_CD,
        area: Math.PI * 16 * 16,
        spin: 0,            // clockwise/counterclockwise rotation
        active: false,      // launched?
        resting: false,     // nearly stopped?
        used: false,        // one shot per ball
        color: "#ff4b4b",
      };
    }
  
    function buildLevel() {
      // A small "tower" of blocks and some enemies
      const baseX = 780;
      const baseY = GROUND_Y;
  
      // blocks: axis-aligned rectangles
      const addBlock = (x, y, w, h, hp = 70) => {
        state.blocks.push({ x, y, w, h, vx: 0, vy: 0, hp, alive: true });
      };
  
      // enemies: circles
      const addEnemy = (x, y, r = 18, hp = 1) => {
        state.enemies.push({ x, y, r, vx: 0, vy: 0, hp, alive: true, hitFlash: 0 });
      };
  
      // Platform blocks
      addBlock(baseX - 60, baseY - 24, 220, 20, 9999);
  
      // Tower columns
      addBlock(baseX - 10, baseY - 130, 20, 110, 85);
      addBlock(baseX + 80, baseY - 130, 20, 110, 85);
  
      // Middle beam
      addBlock(baseX - 30, baseY - 160, 180, 18, 80);
  
      // Top small blocks
      addBlock(baseX + 10, baseY - 210, 20, 50, 70);
      addBlock(baseX + 55, baseY - 210, 20, 50, 70);
  
      // Enemies
      addEnemy(baseX + 35, baseY - 190, 18, 1);
      addEnemy(baseX + 35, baseY - 110, 18, 1);
      addEnemy(baseX + 120, baseY - 40, 18, 1);
    }
  
    function updateHUD() {
      scoreEl.textContent = String(state.score);
      shotsEl.textContent = String(state.shots);
      leftEl.textContent = String(state.enemies.filter(e => e.alive).length);
    }
  
    // --- Input
    function getMouse(e) {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      return { mx, my };
    }
  
    canvas.addEventListener("mousedown", (e) => {
      const p = state.projectile;
      if (p.active) return; // can't drag after launch
      if (p.used) return;
  
      const { mx, my } = getMouse(e);
      const d = len(mx - p.x, my - p.y);
      if (d <= p.r + 20) {
        state.dragging = true;
        state.dragX = mx;
        state.dragY = my;
      }
    });
  
    window.addEventListener("mousemove", (e) => {
      if (!state.dragging) return;
      const { mx, my } = getMouse(e);
  
      // clamp drag within maxPull circle around sling
      const dx = mx - sling.x;
      const dy = my - sling.y;
      const d = Math.hypot(dx, dy);
      let nx = mx, ny = my;
      if (d > sling.maxPull) {
        const t = sling.maxPull / d;
        nx = sling.x + dx * t;
        ny = sling.y + dy * t;
      }
      state.dragX = nx;
      state.dragY = ny;
    });
  
    window.addEventListener("mouseup", () => {
      if (!state.dragging) return;
      state.dragging = false;
  
      const p = state.projectile;
      // launch vector is opposite of pull
      const dx = sling.x - state.dragX;
      const dy = sling.y - state.dragY;
      const power = 7.5; // tweak
      p.vx = dx * power;
      p.vy = dy * power;
      // Pull direction imparts spin: steeper pulls create more back/top spin.
      p.spin = clamp((-dy * 0.03) + (dx * 0.012), -18, 18);
      p.active = true;
      p.used = true;
  
      state.shots += 1;
      updateHUD();
    });
  
    window.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "r") reset();
  
      if (e.code === "Space") {
        // spawn a new ball if current is resting or out
        const p = state.projectile;
        if (!p.active || p.resting || p.y > H + 200 || p.x < -200 || p.x > W + 200) {
          state.projectile = makeProjectile();
        }
      }
    });
  
    // --- Collision helpers
    function circleVsAABB(cx, cy, r, bx, by, bw, bh) {
      const closestX = clamp(cx, bx, bx + bw);
      const closestY = clamp(cy, by, by + bh);
      const dx = cx - closestX;
      const dy = cy - closestY;
      const dist2 = dx * dx + dy * dy;
      return dist2 <= r * r ? { hit: true, dx, dy, closestX, closestY } : { hit: false };
    }
  
    function resolveCircleAABB(circle, box) {
      const res = circleVsAABB(circle.x, circle.y, circle.r, box.x, box.y, box.w, box.h);
      if (!res.hit) return 0;
  
      // Push circle out along smallest axis normal
      let nx = 0, ny = 0;
      // if dx/dy is zero (inside), choose axis by penetration
      const dx = res.dx;
      const dy = res.dy;
  
      if (dx === 0 && dy === 0) {
        // circle center inside box: choose based on distance to edges
        const left = Math.abs(circle.x - box.x);
        const right = Math.abs((box.x + box.w) - circle.x);
        const top = Math.abs(circle.y - box.y);
        const bottom = Math.abs((box.y + box.h) - circle.y);
        const m = Math.min(left, right, top, bottom);
        if (m === left) nx = -1;
        else if (m === right) nx = 1;
        else if (m === top) ny = -1;
        else ny = 1;
      } else {
        const d = Math.hypot(dx, dy) || 1;
        nx = dx / d;
        ny = dy / d;
      }
  
      // penetration depth
      const penetration = circle.r - Math.hypot(dx, dy);
      circle.x += nx * penetration;
      circle.y += ny * penetration;
  
      // reflect velocity along normal
      const vn = circle.vx * nx + circle.vy * ny;
      if (vn < 0) {
        circle.vx -= (1 + RESTITUTION) * vn * nx;
        circle.vy -= (1 + RESTITUTION) * vn * ny;
      }
  
      // damage based on impact
      const impact = Math.abs(vn);
      return impact;
    }
  
    function resolveCircleCircle(a, b) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const minD = a.r + b.r;
      if (d === 0 || d >= minD) return 0;
  
      const nx = dx / d;
      const ny = dy / d;
  
      const penetration = minD - d;
      // push out half/half (enemy has small mass-ish, but keep simple)
      a.x -= nx * penetration * 0.6;
      a.y -= ny * penetration * 0.6;
      b.x += nx * penetration * 0.4;
      b.y += ny * penetration * 0.4;
  
      // velocity reflection (simple)
      const relVx = a.vx - b.vx;
      const relVy = a.vy - b.vy;
      const vn = relVx * nx + relVy * ny;
      if (vn < 0) {
        const j = -(1 + 0.5) * vn; // restitution-ish
        a.vx += j * nx;
        a.vy += j * ny;
        b.vx -= j * nx * 0.35;
        b.vy -= j * ny * 0.35;
      }
      return Math.abs(vn);
    }
  
    // --- Particles for hits
    function spawnSparks(x, y, n = 10) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 120 + Math.random() * 380;
        state.particles.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 0.35 + Math.random() * 0.25,
        });
      }
    }
  
    // --- Simulation
    function getWindXAt(time) {
      const w = state.wind;
      return w.current + Math.sin(time * w.gustFreq + w.gustPhase) * w.gustAmp;
    }

    function getWindX() {
      return getWindXAt(state.time);
    }

    function updateWind(dt) {
      const w = state.wind;
      w.changeIn -= dt;
      if (w.changeIn <= 0) {
        w.target = rand(-150, 150);
        w.changeIn = rand(2.5, 5.5);
        w.gustAmp = rand(10, 34);
        w.gustFreq = rand(0.45, 0.9);
      }

      const blend = 1 - Math.exp(-dt * 1.4);
      w.current += (w.target - w.current) * blend;
    }

    function applyProjectileForces(body, dt, windX) {
      const relVx = body.vx - windX;
      const relVy = body.vy;
      const relSpeed = Math.hypot(relVx, relVy);
      const safeSpeed = relSpeed || 1;

      const dragMag = (0.5 * AIR_DENSITY * body.cd * body.area * relSpeed * relSpeed) / body.mass;
      const dragAx = -(relVx / safeSpeed) * dragMag;
      const dragAy = -(relVy / safeSpeed) * dragMag;

      // Magnus effect: lift perpendicular to relative airflow and proportional to spin.
      const magnusScale = (body.spin * SPIN_LIFT) / body.mass;
      const magnusAx = -relVy * magnusScale;
      const magnusAy = relVx * magnusScale;

      body.vx += (dragAx + magnusAx) * dt;
      body.vy += (GRAVITY + dragAy + magnusAy) * dt;
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.spin *= Math.pow(SPIN_DAMP, dt * 60);
    }

    function buildTrajectoryPreview() {
      const dx = sling.x - state.dragX;
      const dy = sling.y - state.dragY;
      const power = 7.5;
      const test = {
        x: state.dragX,
        y: state.dragY,
        vx: dx * power,
        vy: dy * power,
        mass: DEFAULT_MASS,
        cd: DEFAULT_CD,
        area: Math.PI * 16 * 16,
        spin: clamp((-dy * 0.03) + (dx * 0.012), -18, 18),
        r: 16,
      };

      const points = [];
      const dt = 1 / 60;
      let t = state.time;
      for (let i = 0; i < 80; i++) {
        const windX = getWindXAt(t);
        applyProjectileForces(test, dt, windX);

        if (test.x - test.r < 0 || test.x + test.r > W) break;
        if (test.y + test.r > GROUND_Y) break;

        if (i % 2 === 0) points.push({ x: test.x, y: test.y });
        t += dt;
      }
      return points;
    }

    function step(dt) {
      state.time += dt;
      updateWind(dt);
  
      // particles
      for (const pt of state.particles) {
        pt.vy += GRAVITY * 0.25 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.98;
        pt.vy *= 0.98;
        pt.life -= dt;
      }
      state.particles = state.particles.filter(p => p.life > 0);
  
      // enemy flash decay
      for (const e of state.enemies) {
        e.hitFlash = Math.max(0, e.hitFlash - dt * 3);
      }
  
      const p = state.projectile;
  
      // projectile
      if (p.active) {
        applyProjectileForces(p, dt, getWindX());
  
        // tiny extra damping to avoid endless micro motion in late game
        p.vx *= Math.pow(AIR_DAMP, dt * 60);
        p.vy *= Math.pow(AIR_DAMP, dt * 60);
  
        // walls
        if (p.x - p.r < 0) {
          p.x = p.r;
          p.vx = -p.vx * RESTITUTION;
          p.spin += clamp(p.vy * 0.0008, -0.5, 0.5);
        }
        if (p.x + p.r > W) {
          p.x = W - p.r;
          p.vx = -p.vx * RESTITUTION;
          p.spin -= clamp(p.vy * 0.0008, -0.5, 0.5);
        }
  
        // ground
        if (p.y + p.r > GROUND_Y) {
          p.y = GROUND_Y - p.r;
          p.vy = -p.vy * RESTITUTION;
          p.vx *= FRICTION;
          p.spin += clamp(-p.vx * 0.0009, -0.6, 0.6);
        }
  
        // collisions with blocks
        for (const b of state.blocks) {
          if (!b.alive) continue;
          const impact = resolveCircleAABB(p, b);
          if (impact > 160) {
            b.hp -= impact * 0.22;
            spawnSparks(p.x, p.y, 6);
          }
          if (b.hp <= 0 && b.hp !== 9999) {
            b.alive = false;
            state.score += 30;
            updateHUD();
          }
        }
  
        // collisions with enemies
        for (const e of state.enemies) {
          if (!e.alive) continue;
          const impact = resolveCircleCircle(p, e);
          if (impact > 120) {
            e.hp -= 1;
            e.hitFlash = 1;
            spawnSparks(e.x, e.y, 10);
            if (e.hp <= 0) {
              e.alive = false;
              state.score += 200;
              updateHUD();
            }
          }
        }
  
        // resting check
        const speed = Math.hypot(p.vx, p.vy);
        p.resting = speed < 45 && (p.y + p.r >= GROUND_Y - 0.5);
      }
    }
  
    // --- Render
    function drawBackground() {
      // sky gradient-ish overlay is in CSS; here draw ground + hills
      ctx.clearRect(0, 0, W, H);
  
      // subtle stars
      ctx.save();
      ctx.globalAlpha = 0.15;
      for (let i = 0; i < 60; i++) {
        const x = (i * 97) % W;
        const y = (i * 53) % (GROUND_Y - 120);
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.restore();
  
      // hills
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.quadraticCurveTo(260, GROUND_Y - 110, 520, GROUND_Y);
      ctx.quadraticCurveTo(800, GROUND_Y + 60, W, GROUND_Y - 10);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fillStyle = "#7aa7ff";
      ctx.fill();
      ctx.restore();
  
      // ground
      ctx.beginPath();
      ctx.rect(0, GROUND_Y, W, H - GROUND_Y);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fill();
  
      // ground line
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y + 0.5);
      ctx.lineTo(W, GROUND_Y + 0.5);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 2;
      ctx.stroke();

      drawWindOverlay();
    }

    function drawWindOverlay() {
      const windX = getWindX();
      const dir = windX >= 0 ? 1 : -1;
      const speed = Math.abs(windX);
      const arrow = dir > 0 ? "->" : "<-";
      const label = `${arrow} Wind ${(speed / 42).toFixed(1)} m/s`;

      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "rgba(210,235,255,0.65)";
      ctx.lineWidth = 2;

      const laneY = [88, 132, 176, 220, 264];
      for (let i = 0; i < laneY.length; i++) {
        const y = laneY[i];
        const stride = 120;
        const flow = (state.time * speed * 0.6 + i * 34) % stride;
        for (let x = -stride; x < W + stride; x += stride) {
          const x0 = x + (dir > 0 ? flow : -flow);
          const x1 = x0 + dir * (26 + speed * 0.09);
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.lineTo(x1, y);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "600 16px system-ui, -apple-system, Segoe UI, Roboto";
      ctx.textAlign = "right";
      ctx.fillText(label, W - 22, 36);
      ctx.restore();
    }

    function drawTrajectoryPreview() {
      if (!state.dragging || state.projectile.active) return;
      const points = buildTrajectoryPreview();
      if (points.length === 0) return;

      ctx.save();
      for (let i = 0; i < points.length; i++) {
        const t = i / points.length;
        const a = 0.2 + (1 - t) * 0.45;
        const r = 2 + (1 - t) * 1.4;
        ctx.globalAlpha = a;
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.beginPath();
        ctx.arc(points[i].x, points[i].y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  
    function drawSling() {
      // base
      ctx.save();
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
  
      // wood frame
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.moveTo(sling.x - 20, sling.y + 40);
      ctx.lineTo(sling.x - 10, sling.y);
      ctx.lineTo(sling.x, sling.y - 22);
      ctx.stroke();
  
      ctx.beginPath();
      ctx.moveTo(sling.x + 20, sling.y + 40);
      ctx.lineTo(sling.x + 10, sling.y);
      ctx.lineTo(sling.x, sling.y - 22);
      ctx.stroke();
  
      // band
      const p = state.projectile;
      let bandX = p.x, bandY = p.y;
      if (!p.active && state.dragging) {
        bandX = state.dragX;
        bandY = state.dragY;
      }
  
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(255,75,75,0.85)";
      ctx.beginPath();
      ctx.moveTo(sling.x - 8, sling.y);
      ctx.lineTo(bandX, bandY);
      ctx.lineTo(sling.x + 8, sling.y);
      ctx.stroke();
  
      ctx.restore();
    }
  
    function drawBlocks() {
      for (const b of state.blocks) {
        if (!b.alive) continue;
  
        // platform (hp 9999) gets different color
        const isPlatform = b.hp === 9999;
        ctx.save();
        ctx.fillStyle = isPlatform ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.10)";
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 10);
        ctx.fill();
        ctx.stroke();
  
        if (!isPlatform) {
          // hp bar subtle
          const t = clamp(b.hp / 90, 0, 1);
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = "rgba(255,75,75,1)";
          ctx.fillRect(b.x, b.y - 6, b.w * (1 - t), 3);
        }
  
        ctx.restore();
      }
    }
  
    function drawEnemies() {
      for (const e of state.enemies) {
        if (!e.alive) continue;
        ctx.save();
  
        // body
        ctx.fillStyle = "rgba(77, 255, 140, 0.95)";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
  
        // face
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.arc(e.x - 6, e.y - 3, 3, 0, Math.PI * 2);
        ctx.arc(e.x + 6, e.y - 3, 3, 0, Math.PI * 2);
        ctx.fill();
  
        // hit flash ring
        if (e.hitFlash > 0) {
          ctx.globalAlpha = e.hitFlash * 0.8;
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r + 6, 0, Math.PI * 2);
          ctx.stroke();
        }
  
        ctx.restore();
      }
    }
  
    function drawProjectile() {
      const p = state.projectile;
  
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, worldToScreenY(p.y), p.r, 0, Math.PI * 2);
      ctx.fill();
  
      // little highlight
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(p.x - 6, p.y - 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  
    function drawParticles() {
      ctx.save();
      ctx.globalAlpha = 0.9;
      for (const pt of state.particles) {
        const a = clamp(pt.life / 0.6, 0, 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillRect(pt.x, pt.y, 3, 3);
      }
      ctx.restore();
    }
  
    function drawWinLose() {
      const alive = state.enemies.filter(e => e.alive).length;
      if (alive > 0) return;
  
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, W, H);
  
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "700 44px system-ui, -apple-system, Segoe UI, Roboto";
      ctx.textAlign = "center";
      ctx.fillText("DU VANT! 🎯", W / 2, H / 2 - 24);
  
      ctx.font = "500 18px system-ui, -apple-system, Segoe UI, Roboto";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText("Trykk R for restart", W / 2, H / 2 + 18);
  
      ctx.restore();
    }
  
    // Polyfill for roundRect if needed
    if (!CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        this.beginPath();
        this.moveTo(x + rr, y);
        this.arcTo(x + w, y, x + w, y + h, rr);
        this.arcTo(x + w, y + h, x, y + h, rr);
        this.arcTo(x, y + h, x, y, rr);
        this.arcTo(x, y, x + w, y, rr);
        this.closePath();
        return this;
      };
    }
  
    // --- Game loop
    let last = performance.now();
    function loop(now) {
      const dt = Math.min(0.02, (now - last) / 1000);
      last = now;
  
      step(dt);
      drawBackground();
      drawBlocks();
      drawEnemies();
      drawSling();
  
      // if dragging, draw ghost projectile at drag point
      const p = state.projectile;
      if (!p.active && state.dragging) {
        drawTrajectoryPreview();
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(state.dragX, state.dragY, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        drawProjectile();
      }
  
      drawParticles();
      drawWinLose();
  
      requestAnimationFrame(loop);
    }
  
    reset();
    requestAnimationFrame(loop);
  })();
