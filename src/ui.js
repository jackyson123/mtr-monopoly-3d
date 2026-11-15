import { BOARD, LINES, levelName, money, rentFor } from './data.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.playersEl = $('players');
    this.logEl = $('logList');
    this.actionsEl = $('actions');
    this.hintEl = $('hint');
    this.d1El = $('d1');
    this.d2El = $('d2');
    this.diceSumEl = $('diceSum');
    this.potEl = $('pot');
    this.roundEl = $('round');
    this.tooltipEl = $('tooltip');
    this.toastsEl = $('toasts');
    this.modalEl = $('modal');
    this.sheetEl = $('sheet');
    this.startEl = $('start');
    this.startBtn = $('startBtn');
    this.rolePickerEl = $('rolePicker');
    this.rushEl = $('rush');
    this.cards = {};
    this.activeId = 0;
    this.selectedRole = 0;
  }

  /* ── 玩家卡 ─────────────────────────────────────────────── */
  buildPlayers(players) {
    this.players = players;
    this.playersEl.innerHTML = '';
    this.cards = {};
    players.forEach((p) => {
      const el = document.createElement('div');
      el.className = 'pcard';
      el.style.setProperty('--pc', p.color);
      el.innerHTML = `
        <div class="pAvatar">${p.glyph || p.name.slice(0, 1)}</div>
        <div class="pBody">
          <div class="pName">${p.name}<small>${p.human ? 'YOU' : 'AI'}</small></div>
          <div class="pCash">HK$0</div>
          <div class="pStats"><span><b class="s">0</b> 站</span><span><b class="l">0</b> 條綫</span></div>
          <div class="pRole">${p.ability || ''}</div>
        </div>
        <div class="pBadge">READY</div>
      `;
      this.playersEl.appendChild(el);
      this.cards[p.id] = {
        el,
        cash: el.querySelector('.pCash'),
        stations: el.querySelector('.s'),
        lines: el.querySelector('.l'),
        badge: el.querySelector('.pBadge'),
      };
    });
  }

  updatePlayer(p) {
    const c = this.cards[p.id];
    if (!c) return;
    c.cash.textContent = money(p.cash);
    c.cash.classList.toggle('neg', p.cash < 0);
    c.stations.textContent = p.props.length;
    c.lines.textContent = p.completedLines || 0;
    c.el.classList.toggle('dead', !!p.bankrupt);
    this.updateBadge(p);
  }

  updateBadge(p) {
    const c = this.cards[p.id];
    if (!c) return;
    let label = 'READY';
    if (p.bankrupt) label = '破產';
    else if (p.jail > 0) label = '延誤';
    else if (p.id === this.activeId) label = '行動中';
    c.badge.textContent = label;
    c.badge.classList.toggle('jail', p.jail > 0 && !p.bankrupt);
    c.badge.classList.toggle('you', p.human && !p.bankrupt);
  }

  setActive(id) {
    this.activeId = id;
    Object.entries(this.cards).forEach(([pid, c]) => {
      c.el.classList.toggle('active', Number(pid) === id);
      const p = this.players.find((x) => x.id === Number(pid));
      if (p) this.updateBadge(p);
    });
  }

  /* ── 日誌 / 提示 ────────────────────────────────────────── */
  log(html, kind = '') {
    const item = document.createElement('div');
    item.className = 'logItem' + (kind ? ' ' + kind : '');
    item.innerHTML = html;
    this.logEl.appendChild(item);
    while (this.logEl.children.length > 70) this.logEl.removeChild(this.logEl.firstChild);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  toast(text, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = text;
    this.toastsEl.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }

  hint(text, tone = '') {
    this.hintEl.innerHTML = text;
    this.hintEl.className = 'hint' + (tone ? ' ' + tone : '');
  }

  setDice(a, b) {
    this.d1El.textContent = a ?? '–';
    this.d2El.textContent = b ?? '–';
    this.diceSumEl.textContent = a && b ? `= ${a + b}` : '';
  }

  setPot(v) {
    this.potEl.textContent = money(v);
  }

  setRound(n) {
    this.roundEl.textContent = n;
  }

  setRush(on) {
    if (!this.rushEl) return;
    this.rushEl.textContent = on ? '繁忙 ×1.5' : '正常';
    this.rushEl.classList.toggle('hot', !!on);
  }

  buildRolePicker(roles) {
    if (!this.rolePickerEl) return;
    this.rolePickerEl.innerHTML = '';
    roles.forEach((role, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'roleCard' + (i === this.selectedRole ? ' sel' : '');
      card.style.setProperty('--c', role.color);
      card.innerHTML = `
        <div class="roleGlyph">${role.glyph}</div>
        <div class="roleName">${role.name}</div>
        <div class="roleAbility">${role.ability}</div>
      `;
      card.onclick = () => {
        this.selectedRole = i;
        [...this.rolePickerEl.children].forEach((c, k) => c.classList.toggle('sel', k === i));
        this.startBtn.textContent = `以${role.name}身份開始`;
      };
      this.rolePickerEl.appendChild(card);
    });
    this.startBtn.textContent = `以${roles[this.selectedRole].name}身份開始`;
  }

  /* ── 操作按鈕 ───────────────────────────────────────────── */
  clearActions() {
    this.actionsEl.innerHTML = '';
  }

  ask(actions, hintText = '') {
    if (hintText) this.hint(hintText);
    return new Promise((resolve) => {
      this.clearActions();
      actions.forEach((a) => {
        const btn = document.createElement('button');
        btn.className = 'act ' + (a.variant || '');
        btn.innerHTML = a.label + (a.sub ? `<span class="sub">${a.sub}</span>` : '');
        btn.disabled = !!a.disabled;
        btn.onclick = () => {
          this.clearActions();
          resolve(a.value);
        };
        this.actionsEl.appendChild(btn);
      });
    });
  }

  /* ── 對話框 ─────────────────────────────────────────────── */
  openModal(html) {
    this.sheetEl.innerHTML = html;
    this.modalEl.classList.remove('hidden');
    return this.sheetEl;
  }

  closeModal() {
    this.modalEl.classList.add('hidden');
  }

  showCard(card) {
    return new Promise((resolve) => {
      const sheet = this.openModal(`
        <div class="ticket">
          <div class="ticketTop"><b>乘客資訊 · PASSENGER NOTICE</b><span>MTR</span></div>
          <div class="ticketIcon">${card.icon}</div>
          <h3>${card.title}</h3>
          <p>${card.text}</p>
          <div class="ticketMeta">
            <span>ISSUE <b>${String(Math.floor(Math.random() * 9000) + 1000)}</b></span>
            <span>${card.tag || 'SERVICE'}</span>
          </div>
        </div>
        <div class="sheetActions"><button class="act primary" id="okBtn">繼續行程</button></div>
      `);
      sheet.querySelector('#okBtn').onclick = () => {
        this.closeModal();
        resolve();
      };
    });
  }

  confirmPurchase({ idx, cash, price, base }) {
    const t = BOARD[idx];
    const line = LINES[t.line];
    const discounted = price != null && price < (base ?? t.price);
    const rows = [0, 1, 2, 3]
      .map(
        (l) =>
          `<div class="rentRow${l === 0 ? ' hl' : ''}"><span>${levelName(l)}</span><b>${money(
            rentFor(idx, l, false),
          )}</b></div>`,
      )
      .join('');
    return new Promise((resolve) => {
      const sheet = this.openModal(`
        <div class="sheetHead">
          <div class="sheetChip" style="--c:${line.color}"></div>
          <div>
            <h2>${t.name}</h2>
            <p>${line.name} · 買入後可升級上蓋物業</p>
          </div>
        </div>
        <div class="priceBig">${money(price ?? t.price)}${
          discounted ? `<span class="priceOld">${money(base ?? t.price)}</span>` : ''
        }</div>
        <div class="rentTable">${rows}</div>
        <p style="font-size:10.5px;color:var(--muted);margin:10px 0 0;line-height:1.7">
          ${discounted ? '站長專屬 9 折優惠。<br>' : ''}持有整條路綫時，車費 ×2。你現時有 ${money(cash)}。
        </p>
        <div class="sheetActions">
          <button class="act primary" id="buyBtn" ${cash < (price ?? t.price) ? 'disabled' : ''}>買入</button>
          <button class="act ghost" id="skipBtn">放棄</button>
        </div>
      `);
      sheet.querySelector('#buyBtn').onclick = () => {
        this.closeModal();
        resolve(true);
      };
      sheet.querySelector('#skipBtn').onclick = () => {
        this.closeModal();
        resolve(false);
      };
    });
  }

  chooseStation({ title, subtitle, groups, footer }) {
    return new Promise((resolve) => {
      const grid = groups
        .map(
          (g) => `
          <div class="lineHeading"><span style="color:${g.color}">●</span>${g.name}</div>
          ${g.items
            .map(
              (it) => `
            <button class="stationBtn" data-idx="${it.idx}" style="--c:${g.color}" ${
                it.disabled ? 'disabled' : ''
              }>
              <i></i><span><b>${it.name}</b><small>${it.sub || ''}</small></span>
            </button>`,
            )
            .join('')}
        `,
        )
        .join('');
      const sheet = this.openModal(`
        <div class="sheetHead">
          <div class="sheetChip" style="--c:#6fe3ff"></div>
          <div><h2>${title}</h2><p>${subtitle}</p></div>
        </div>
        <div class="stationGrid">${grid}</div>
        ${footer ? `<p style="font-size:10px;color:var(--dim);margin-top:10px">${footer}</p>` : ''}
        <div class="sheetActions"><button class="act ghost" id="cancelBtn">留在原地</button></div>
      `);
      sheet.querySelectorAll('.stationBtn').forEach((btn) => {
        btn.onclick = () => {
          this.closeModal();
          resolve(Number(btn.dataset.idx));
        };
      });
      sheet.querySelector('#cancelBtn').onclick = () => {
        this.closeModal();
        resolve(null);
      };
    });
  }

  chooseBuild({ items, cash }) {
    return new Promise((resolve) => {
      const grid = items
        .map((it) => {
          const color = LINES[BOARD[it.idx].line].color;
          return `<button class="stationBtn" data-idx="${it.idx}" style="--c:${color}" ${
            cash < it.cost ? 'disabled' : ''
          }>
            <i></i><span><b>${it.name}</b><small>${levelName(it.level)} → ${levelName(
            it.level + 1,
          )} · ${money(it.cost)}</small></span>
          </button>`;
        })
        .join('');
      const sheet = this.openModal(`
        <div class="sheetHead">
          <div class="sheetChip" style="--c:#f6d08a"></div>
          <div><h2>升級上蓋物業</h2><p>車站 → 商舖 → 上蓋 → 摩天塔，車費隨之提升。</p></div>
        </div>
        <div class="stationGrid">${grid}</div>
        <div class="sheetActions"><button class="act ghost" id="cancelBtn">返回</button></div>
      `);
      sheet.querySelectorAll('.stationBtn').forEach((btn) => {
        btn.onclick = () => {
          this.closeModal();
          resolve(Number(btn.dataset.idx));
        };
      });
      sheet.querySelector('#cancelBtn').onclick = () => {
        this.closeModal();
        resolve(null);
      };
    });
  }

  gameOver(rows, { reason, winner }) {
    const list = rows
      .map((r, i) => {
        const p = r.player;
        return `
          <div class="settleRow ${i === 0 ? 'win' : ''}">
            <div class="rank">${String(i + 1).padStart(2, '0')}</div>
            <div class="nm">
              <b style="color:${p.color}">${p.name}</b>
              <small>${p.props.length} 個車站 · ${p.completedLines || 0} 條完整路綫</small>
              ${p.bankrupt ? '<span class="bankruptTag">已破產</span>' : ''}
            </div>
            <div class="net">${money(r.net)}</div>
          </div>`;
      })
      .join('');
    const sheet = this.openModal(`
      <div class="sheetHead">
        <div class="sheetChip" style="--c:#f6d08a"></div>
        <div><h2>${winner ? winner.name + ' 勝出！' : '本局結算'}</h2><p>${reason}</p></div>
      </div>
      ${list}
      <div class="sheetActions"><button class="act primary" id="againBtn">再玩一局</button></div>
    `);
    sheet.querySelector('#againBtn').onclick = () => window.location.reload();
    this.hint(`${winner ? winner.name + ' 成為路綫之王' : '本局完結'}`, 'good');
  }

  /* ── Tooltip ───────────────────────────────────────────── */
  showTooltip(html, x, y) {
    this.tooltipEl.innerHTML = html;
    const pad = 14;
    const w = 236;
    let left = x + 16;
    let top = y + 14;
    if (left + w > window.innerWidth - pad) left = x - w - 16;
    if (top + 210 > window.innerHeight - pad) top = window.innerHeight - 224;
    this.tooltipEl.style.left = left + 'px';
    this.tooltipEl.style.top = top + 'px';
    this.tooltipEl.classList.remove('hidden');
  }

  hideTooltip() {
    this.tooltipEl.classList.add('hidden');
  }

  /* ── 開始畫面 ───────────────────────────────────────────── */
  showStart(onStart) {
    this.startBtn.addEventListener(
      'click',
      () => {
        this.startEl.classList.add('hidden');
        onStart(this.selectedRole);
      },
      { once: true },
    );
  }
}
