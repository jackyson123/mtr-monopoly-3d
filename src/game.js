import {
  BOARD,
  GROUP_TILES,
  LINES,
  ROLES,
  START_CASH,
  GO_SALARY,
  JAIL_FINE,
  MAX_LEVEL,
  MAX_ROUNDS,
  RUSH_ROUND,
  RUSH_MULT,
  buildCost,
  buyPrice,
  upgradeCost,
  levelName,
  money,
  rentFor,
  utilityRent,
} from './data.js';

/* ── 乘客消息卡 ─────────────────────────────────────────────── */
const CARDS = [
  {
    icon: '↺',
    tag: 'SIGNAL FAILURE',
    title: '訊號故障',
    text: '前方訊號系統故障，列車需要倒車 3 個站，並重新處理到站事宜。',
    tone: 'warn',
    apply: async (g, p) => {
      await g.movePlayer(p, 3, -1);
      await g.resolveTile(p, 7, 1);
    },
  },
  {
    icon: '✓',
    tag: 'OCTOPUS REWARD',
    title: '八達通回贈',
    text: '港鐵推出乘車回贈計劃，你的八達通即時獲得 HK$300。',
    tone: 'good',
    apply: (g, p) => g.reward(p, 300, '八達通回贈'),
  },
  {
    icon: '≋',
    tag: 'TYPHOON',
    title: '八號風球',
    text: '天文台掛起八號風球，列車服務暫停，你下回合無法開車。',
    tone: 'warn',
    apply: (g, p) => {
      p.skip = 1;
      g.log(`${p.name} 因颱風停駛，下回合暫停。`, 'warn');
      g.ui.updatePlayer(p);
    },
  },
  {
    icon: '$',
    tag: 'FARE INSPECTION',
    title: '突擊查票',
    text: '車站職員發現你的車票有誤，罰款 HK$400 撥入車費池。',
    tone: 'bad',
    apply: (g, p) => g.payMoney(p, 400, null, '查票罰款'),
  },
  {
    icon: '★',
    tag: 'AD REVENUE',
    title: '車站廣告收益',
    text: '你的車站廣告位大賣，每個車站帶來 HK$150 收入。',
    tone: 'good',
    apply: (g, p) => {
      if (!p.props.length) {
        g.log(`${p.name} 未有車站，廣告收益落空。`, 'warn');
        return;
      }
      g.reward(p, p.props.length * 150, '廣告收益');
    },
  },
  {
    icon: '⌂',
    tag: 'GOV SUBSIDY',
    title: '政府交通補貼',
    text: '政府向公共交通營運商發放補貼，你獲得 HK$1,200。',
    tone: 'good',
    apply: (g, p) => g.reward(p, 1200, '政府補貼'),
  },
  {
    icon: '⚒',
    tag: 'MAINTENANCE',
    title: '商場維修費',
    text: '上蓋物業需要例行維修，每級物業收取 HK$120。',
    tone: 'bad',
    apply: (g, p) => {
      const total = p.props.reduce((sum, idx) => sum + g.levels[idx] * 120, 0);
      if (!total) {
        g.log(`${p.name} 沒有上蓋物業，毋須支付維修費。`, '');
        return;
      }
      g.payMoney(p, total, null, '維修費');
    },
  },
  {
    icon: '✕',
    tag: 'LOST PROPERTY',
    title: '遺失行李',
    text: '你在月台遺失行李，補領及賠償費用共 HK$500。',
    tone: 'bad',
    apply: (g, p) => g.payMoney(p, 500, null, '遺失行李'),
  },
  {
    icon: '✈',
    tag: 'AE TICKET',
    title: '機場快綫禮券',
    text: '你獲贈機場快綫禮券，可免費前往任何一個車站。',
    tone: 'good',
    apply: (g, p) => g.freeRide(p),
  },
  {
    icon: '↑',
    tag: 'FREE UPGRADE',
    title: '免費升級',
    text: '港鐵送你一次免費上蓋升級，隨機一座物業立即升級。',
    tone: 'good',
    apply: (g, p) => g.promoteRandom(p),
  },
  {
    icon: '♥',
    tag: 'PASSENGER PRAISE',
    title: '乘客好評',
    text: '你的車站服務評分滿分，獲得 HK$600 獎金。',
    tone: 'good',
    apply: (g, p) => g.reward(p, 600, '乘客好評'),
  },
  {
    icon: '⚡',
    tag: 'POWER OUTAGE',
    title: '電力故障',
    text: '你的車站停電，向每位對手收取 HK$150 應急補償。',
    tone: 'good',
    apply: (g, p) => g.collectFromAll(p, 150),
  },
  {
    icon: '↗',
    tag: 'PROMOTION',
    title: '升職加薪',
    text: '你獲晉升為高級站長，額外獲得 HK$800。',
    tone: 'good',
    apply: (g, p) => g.reward(p, 800, '升職加薪'),
  },
  {
    icon: '⇉',
    tag: 'THROUGH TRAIN',
    title: '直通車',
    text: '直通車開出，帶你前往香港站，並領取 HK$2,000 車費。',
    tone: 'good',
    apply: async (g, p) => {
      await g.rideTo(p, 0);
      g.reward(p, GO_SALARY, '直通車收入');
    },
  },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Game {
  constructor(board, ui) {
    this.board = board;
    this.ui = ui;
    this.humanId = 0;
    this.players = ROLES.map((role, i) => ({
      id: i,
      role,
      name: role.name,
      glyph: role.glyph,
      ability: role.ability,
      buyDiscount: role.buyDiscount || 0,
      buildDiscount: role.buildDiscount || 0,
      goBonus: role.goBonus || 0,
      cardBonus: role.cardBonus || 0,
      human: i === this.humanId,
      color: role.color,
      cash: START_CASH,
      tile: 0,
      jail: 0,
      skip: 0,
      bankrupt: false,
      props: [],
      completedLines: 0,
    }));
    this.rushLogged = false;
    this.owners = new Array(BOARD.length).fill(null);
    this.levels = new Array(BOARD.length).fill(0);
    this.pot = 0;
    this.round = 1;
    this.turn = 0;
    this.over = false;
    this.deck = shuffle(CARDS);
    this.ui.setPot(0);
  }

  /* 選擇角色：玩家取得該席位，並由該席位先手 */
  setHumanRole(roleId) {
    this.humanId = roleId;
    this.players.forEach((p) => {
      p.human = p.id === roleId;
    });
    this.turn = roleId;
  }

  applyRush(amount) {
    if (this.round < RUSH_ROUND) return amount;
    return Math.round((amount * RUSH_MULT) / 10) * 10;
  }

  log(html, kind = '') {
    this.ui.log(html, kind);
  }

  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /* ── 主流程 ─────────────────────────────────────────────── */
  async start() {
    this.ui.buildPlayers(this.players);
    this.players.forEach((p) => {
      this.ui.updatePlayer(p);
      this.board.setTokenTile(p.id, 0);
    });
    this.ui.setActive(this.turn);
    this.board.setActiveToken(this.turn);
    this.ui.setRound(1);
    this.ui.setRush(this.round >= RUSH_ROUND);
    this.log('遊戲開始 · 每人獲發 <b>HK$15,000</b> 營運資金。', 'sys');
    this.log('目標：集齊 3 條路綫，或成為最後生還者。', '');

    while (!this.over) {
      if (this.round > MAX_ROUNDS) {
        this.settle(`${MAX_ROUNDS} 回合完結，以總資產結算。`);
        break;
      }
      const p = this.players[this.turn];
      if (!p.bankrupt) {
        await this.takeTurn(p);
      }
      if (this.over) break;
      this.advanceTurn();
    }
  }

  checkRush() {
    const rush = this.round >= RUSH_ROUND;
    this.ui.setRush(rush);
    if (rush && !this.rushLogged) {
      this.rushLogged = true;
      this.log(`繁忙時間開始：全綫車費 <b>×${RUSH_MULT}</b>！`, 'warn');
      this.ui.toast(`繁忙時間 · 車費 ×${RUSH_MULT}`, 'gold');
    }
  }

  advanceTurn() {
    const n = this.players.length;
    for (let k = 1; k <= n; k++) {
      const idx = (this.turn + k) % n;
      if (!this.players[idx].bankrupt) {
        if (idx <= this.turn) this.round++;
        this.turn = idx;
        this.ui.setRound(this.round);
        this.checkRush();
        return;
      }
    }
  }

  async takeTurn(p) {
    this.current = p;
    this.ui.setActive(p.id);
    this.board.setActiveToken(p.id);
    this.board.pulseTile(p.tile);
    this.ui.setRound(this.round);
    this.ui.setPot(this.pot);

    if (p.skip > 0) {
      p.skip--;
      this.log(`${p.name} 受颱風影響，本回合停駛。`, 'warn');
      this.ui.hint(`${p.name} 暫停一回合`, 'warn');
      this.ui.updatePlayer(p);
      await this.sleep(800);
      return;
    }

    if (p.jail > 0) {
      const released = await this.handleJail(p);
      if (!released) return;
    }

    this.ui.hint(p.human ? '你的回合 — 擲骰出發' : `${p.name} 準備開車…`);
    let doubles = 0;

    while (!this.over && !p.bankrupt) {
      const { d1, d2 } = await this.rollPhase(p);
      if (d1 === d2) {
        doubles++;
        if (doubles >= 3) {
          this.log(`${p.name} 連續三次雙數，被安排到「服務延誤」。`, 'bad');
          await this.sendToJail(p);
          break;
        }
      }

      await this.movePlayer(p, d1 + d2, 1);
      if (this.over || p.bankrupt) return;
      await this.resolveTile(p, d1 + d2, 0);
      if (this.over || p.bankrupt) return;
      this.maybeMonopolyWin(p);
      if (this.over) return;

      if (d1 === d2) {
        this.log(`${p.name} 擲出雙數，可再擲一次。`, 'good');
        this.ui.hint(`${p.name} 擲出雙數 — 再擲一次`, 'good');
        await this.sleep(520);
        continue;
      }
      break;
    }

    if (!this.over && !p.bankrupt) await this.finishTurn(p);
  }

  async finishTurn(p) {
    if (p.human) {
      while (!this.over) {
        const buildable = p.props.filter((idx) => this.levels[idx] < MAX_LEVEL);
        const actions = [];
        if (buildable.length) actions.push({ label: '🏗 升級物業', value: 'build', variant: 'gold' });
        actions.push({ label: '結束回合 →', value: 'end', variant: 'primary' });
        const choice = await this.ui.ask(actions, '可升級上蓋物業，或結束回合。');
        if (choice === 'end') break;
        const idx = await this.ui.chooseBuild({
          cash: p.cash,
          items: buildable.map((i) => ({
            idx: i,
            name: BOARD[i].name,
            level: this.levels[i],
            cost: buildCost(i),
          })),
        });
        if (idx === null) continue;
        this.buildUp(p, idx);
      }
    } else {
      this.ui.clearActions();
      this.ui.hint(`${p.name} 正在考慮上蓋投資…`);
      await this.sleep(320);
      let guard = 0;
      while (!this.over && this.aiBuild(p) && guard++ < 4) await this.sleep(300);
    }
    this.ui.clearActions();
  }

  /* ── 骰子 ───────────────────────────────────────────────── */
  async rollPhase(p) {
    this.ui.clearActions();
    this.ui.setDice(null, null);
    if (p.human) {
      await this.ui.ask([{ label: '🎲 擲骰出發', value: 'roll', variant: 'primary' }], '輪到你了 — 擲骰');
    } else {
      this.ui.hint(`${p.name} 正在擲骰…`);
      await this.sleep(480);
    }
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    await this.board.rollDice(d1, d2);
    this.ui.setDice(d1, d2);
    this.log(`${p.name} 擲出 ${d1} + ${d2} = <b>${d1 + d2}</b>`, 'dice');
    return { d1, d2 };
  }

  /* ── 移動 ───────────────────────────────────────────────── */
  async movePlayer(p, steps, dir = 1) {
    if (!steps) return;
    const path = [];
    for (let k = 1; k <= Math.abs(steps); k++) path.push((p.tile + dir * k + BOARD.length) % BOARD.length);
    await this.board.walk(p.id, path);
    p.tile = path[path.length - 1];

    if (dir > 0 && path.includes(0)) {
      const bonus = p.goBonus || 0;
      const total = GO_SALARY + bonus;
      p.cash += total;
      this.log(
        `${p.name} 駛經香港站，收取 <b>${money(GO_SALARY)}</b>${bonus ? ` + 車長津貼 ${money(bonus)}` : ''}。`,
        'good',
      );
      this.ui.toast(`+${money(total)} 車費收入`, 'good');
    }
    this.board.highlightTile(p.tile);
    this.ui.updatePlayer(p);
  }

  async rideTo(p, target) {
    await this.board.ride(p.id, target);
    p.tile = target;
    this.board.highlightTile(target);
    this.ui.updatePlayer(p);
  }

  async sendToJail(p) {
    p.jail = 2;
    if (p.tile !== 10) {
      await this.board.sendToJail(p.id, 10);
      p.tile = 10;
    }
    this.board.highlightTile(10);
    this.log(`${p.name} 被送到「服務延誤」，暫停 2 回合。`, 'bad');
    this.ui.toast(`${p.name} 遭遇服務延誤`, 'warn');
    this.ui.updatePlayer(p);
  }

  async handleJail(p) {
    this.log(`${p.name} 仍被扣留在「服務延誤」（剩餘 ${p.jail} 回合）。`, 'warn');
    let pay = false;
    if (p.human) {
      const options = [{ label: '等下一班車', value: 'wait' }];
      if (p.cash >= JAIL_FINE) {
        options.unshift({
          label: `付 ${money(JAIL_FINE)} 出閘`,
          value: 'pay',
          variant: 'primary',
        });
      }
      pay = (await this.ui.ask(options, '列車服務延誤中：付費出閘，或等一回合？')) === 'pay';
    } else {
      pay = p.cash > 8000;
      await this.sleep(420);
    }

    if (pay) {
      this.payMoney(p, JAIL_FINE, null, '出閘罰款');
      if (p.bankrupt) return false;
      p.jail = 0;
      this.log(`${p.name} 付了 ${money(JAIL_FINE)}，成功出閘。`, 'good');
      this.ui.updatePlayer(p);
      return true;
    }

    p.jail--;
    this.ui.updatePlayer(p);
    if (p.jail <= 0) {
      this.log(`${p.name} 的延誤結束，下回合可正常開車。`, '');
    } else {
      this.log(`${p.name} 仍要等候（剩餘 ${p.jail} 回合）。`, 'warn');
    }
    await this.sleep(500);
    return false;
  }

  /* ── 到站處理 ───────────────────────────────────────────── */
  async resolveTile(p, dice, depth = 0) {
    const idx = p.tile;
    const t = BOARD[idx];
    this.board.highlightTile(idx);
    this.board.pulseTile(idx);

    if (t.type === 'property') {
      await this.onProperty(p, idx, depth);
    } else if (t.type === 'utility') {
      const ownerId = this.owners[idx];
      if (ownerId === null) {
        await this.offerBuy(p, idx);
      } else if (ownerId === p.id) {
        this.log(`${p.name} 回到自己的「${t.name}」。`, '');
      } else {
        const owner = this.players[ownerId];
        const both = this.players[ownerId].props.filter((i) => BOARD[i].type === 'utility').length >= 2;
        const rent = this.applyRush(utilityRent(dice || 7, both));
        this.log(
          `${p.name} 使用 ${owner.name} 的「${t.name}」，車費 <b>${money(rent)}</b>（骰子 ${dice || 7} × ${
            both ? 250 : 100
          }）。`,
          'bad',
        );
        this.payMoney(p, rent, owner, '商場消費');
      }
    } else if (t.type === 'tax') {
      const amount = Math.max(500, Math.min(3000, Math.round((p.cash * 0.1) / 100) * 100));
      this.log(`票價調整：${p.name} 需繳付 <b>${money(amount)}</b>，撥入車費池。`, 'bad');
      this.payMoney(p, amount, null, '票價調整');
      this.ui.setPot(this.pot);
    } else if (t.type === 'card') {
      if (depth === 0) await this.drawCard(p);
      else this.log('訊息太多，這次沒有新的乘客消息。', '');
    } else if (t.type === 'ride') {
      if (depth === 0) await this.onRide(p, idx);
      else this.log(`${p.name} 抵達轉綫站。`, '');
    } else if (t.type === 'parking') {
      if (this.pot > 0) {
        p.cash += this.pot;
        this.log(`${p.name} 返到車廠，領取車費池 <b>${money(this.pot)}</b>！`, 'good');
        this.ui.toast(`+${money(this.pot)} 車費池`, 'gold');
        this.pot = 0;
        this.ui.setPot(0);
        this.ui.updatePlayer(p);
      } else {
        this.log(`${p.name} 返到車廠，車費池空空如也。`, '');
      }
    } else if (t.type === 'jail') {
      this.log(`${p.name} 遇上服務延誤，被扣留 2 回合。`, 'bad');
      p.jail = 2;
      this.ui.toast(`${p.name} 遭遇服務延誤`, 'warn');
      this.ui.updatePlayer(p);
      await this.sleep(400);
    } else if (t.type === 'gotojail') {
      this.log(`事故發生！${p.name} 被送往「服務延誤」。`, 'bad');
      await this.sendToJail(p);
    } else if (t.type === 'go') {
      this.log(`${p.name} 返到香港站。`, '');
    }

    this.ui.updatePlayer(p);
  }

  async onProperty(p, idx, depth) {
    const t = BOARD[idx];
    const ownerId = this.owners[idx];
    if (ownerId === null) {
      await this.offerBuy(p, idx, depth);
    } else if (ownerId === p.id) {
      this.log(`${p.name} 回到自己的「${t.name}」。`, '');
    } else {
      const owner = this.players[ownerId];
      const monopoly = this.ownsLine(ownerId, t.line);
      const rent = this.applyRush(rentFor(idx, this.levels[idx], monopoly));
      this.log(
        `${p.name} 抵達 ${owner.name} 的「${t.name}」，車費 <b>${money(rent)}</b>${
          monopoly ? '（獨佔路綫 ×2）' : ''
        }。`,
        'bad',
      );
      await this.sleep(320);
      this.payMoney(p, rent, owner, `「${t.name}」車費`);
    }
  }

  async offerBuy(p, idx, depth = 0) {
    const t = BOARD[idx];
    if (!t.price) return;
    const price = buyPrice(idx, p);
    if (p.cash < price) {
      this.log(`${p.name} 現金不足，未能買入「${t.name}」。`, 'warn');
      return;
    }
    let buy;
    if (p.human) {
      this.ui.hint(`可以買入「${t.name}」— ${money(price)}`);
      buy = await this.ui.confirmPurchase({ idx, cash: p.cash, price, base: t.price });
    } else {
      this.ui.hint(`${p.name} 正在考慮買入「${t.name}」…`);
      await this.sleep(520);
      buy = this.aiWantsBuy(p, idx);
    }
    if (buy) this.acquire(p, idx, price);
    else this.log(`${p.name} 放棄買入「${t.name}」。`, '');
  }

  acquire(p, idx, price) {
    p.cash -= price;
    this.owners[idx] = p.id;
    p.props.push(idx);
    this.board.setOwner(idx, p.color);
    this.board.pulseTile(idx);
    this.log(`${p.name} 以 <b>${money(price)}</b> 買入「${BOARD[idx].name}」。`, 'good');
    this.ui.toast(`${p.name} 買入 ${BOARD[idx].name}`, 'gold');
    this.recomputeLines(p);
    this.ui.updatePlayer(p);
  }

  recomputeLines(p) {
    let total = 0;
    for (const [line, tiles] of Object.entries(GROUP_TILES)) {
      if (tiles.length && tiles.every((i) => this.owners[i] === p.id)) {
        total++;
        if (!p._lines) p._lines = new Set();
        if (!p._lines.has(line)) {
          p._lines.add(line);
          this.log(`${p.name} 集齊 <b>${LINES[line].name}</b> 全綫，車費 ×2！`, 'good');
          this.ui.toast(`${p.name} 集齊 ${LINES[line].name}`, 'gold');
        }
      }
    }
    p.completedLines = total;
  }

  ownsLine(playerId, line) {
    const tiles = GROUP_TILES[line] || [];
    return tiles.length > 0 && tiles.every((i) => this.owners[i] === playerId);
  }

  maybeMonopolyWin(p) {
    if (this.over) return;
    if ((p.completedLines || 0) >= 3) {
      this.log(`${p.name} 集齊 3 條路綫，成為路綫霸主！`, 'good');
      this.settle(`${p.name} 集齊 3 條完整路綫，奪得路綫霸主之位。`, p);
    }
  }

  /* ── 搭車 ───────────────────────────────────────────────── */
  lineGroups(p) {
    return Object.entries(GROUP_TILES)
      .filter(([, tiles]) => tiles.length)
      .map(([line, tiles]) => ({
        name: LINES[line].name,
        color: LINES[line].color,
        items: tiles
          .filter((i) => i !== p.tile)
          .map((i) => {
            const t = BOARD[i];
            const ownerId = this.owners[i];
            return {
              idx: i,
              name: t.name,
              sub:
                ownerId === null
                  ? `${money(t.price)} · 待售`
                  : ownerId === p.id
                    ? '你的車站'
                    : `${this.players[ownerId].name} 的車站`,
            };
          }),
      }));
  }

  async onRide(p, idx) {
    const t = BOARD[idx];
    const fee = t.fee || 0;
    if (fee > p.cash) {
      this.log(`${p.name} 現金不足，未能乘搭${t.name}。`, 'warn');
      return;
    }

    if (p.human) {
      const choice = await this.ui.chooseStation({
        title: t.mode === 'express' ? '機場快綫 · 任意飛站' : '轉綫站 · 免費轉乘',
        subtitle:
          t.mode === 'express'
            ? `支付 ${money(fee)}，飛往任何一個車站。`
            : '只要身處轉綫站，即可免費前往任何路綫的車站。',
        groups: this.lineGroups(p),
        footer: '到站後仍需處理該站的買地或車費。',
      });
      if (choice === null) return;
      await this.takeRide(p, choice, fee);
    } else {
      const choice = this.aiRideChoice(p);
      if (choice === null) {
        this.log(`${p.name} 沒有乘車。`, '');
        return;
      }
      this.ui.hint(`${p.name} 正在轉綫…`);
      await this.sleep(600);
      await this.takeRide(p, choice, fee);
    }
  }

  async takeRide(p, target, fee) {
    if (fee) {
      const ok = this.payMoney(p, fee, null, '機場快綫車費');
      if (!ok) return;
    }
    await this.rideTo(p, target);
    this.log(`${p.name} 乘車前往「${BOARD[target].name}」。`, '');
    this.ui.updatePlayer(p);
    await this.sleep(360);
    await this.resolveTile(p, 7, 1);
  }

  freeRide(p) {
    return new Promise(async (resolve) => {
      let target = null;
      if (p.human) {
        this.ui.chooseStation({
          title: '免費乘車 · 任何車站',
          subtitle: '禮券可帶你前往任何一個車站，費用全免。',
          groups: this.lineGroups(p),
        }).then(async (choice) => {
          if (choice === null) return resolve();
          await this.rideTo(p, choice);
          this.log(`${p.name} 使用禮券前往「${BOARD[choice].name}」。`, 'good');
          await this.sleep(300);
          await this.resolveTile(p, 7, 1);
          resolve();
        });
      } else {
        const choice = this.aiRideChoice(p);
        if (choice === null) return resolve();
        await this.rideTo(p, choice);
        this.log(`${p.name} 使用禮券前往「${BOARD[choice].name}」。`, 'good');
        await this.sleep(300);
        await this.resolveTile(p, 7, 1);
        resolve();
      }
    });
  }

  aiRideChoice(p) {
    const options = BOARD.map((t, i) => i).filter((i) => i !== p.tile && BOARD[i].price);
    let best = null;
    let bestScore = -Infinity;
    for (const i of options) {
      const t = BOARD[i];
      const ownerId = this.owners[i];
      let score = 0;
      if (ownerId === null) score += 500 + t.price * 0.35;
      else if (ownerId === p.id) score += 120;
      else score -= t.price * 0.45;
      if (this.levels[i] >= 2 && ownerId !== p.id) score -= 300;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  /* ── 乘客消息 ───────────────────────────────────────────── */
  async drawCard(p) {
    if (!this.deck.length) this.deck = shuffle(CARDS);
    const card = this.deck.pop();
    this.ui.hint(`${p.name} 收到一封乘客消息…`);
    await this.ui.showCard(card);
    this.log(`${p.name} 抽到「${card.title}」。`, card.tone === 'good' ? 'good' : card.tone === 'bad' ? 'bad' : 'warn');
    await card.apply(this, p);
    if (!p.bankrupt && p.cardBonus) this.reward(p, p.cardBonus, '八達通乘車津貼');
    this.ui.updatePlayer(p);
    this.ui.setPot(this.pot);
  }

  /* ── 金錢 ───────────────────────────────────────────────── */
  reward(p, amount, reason = '') {
    p.cash += amount;
    this.log(`${p.name} 獲得 <b>${money(amount)}</b>${reason ? ' · ' + reason : ''}。`, 'good');
    this.ui.toast(`+${money(amount)}${reason ? ' · ' + reason : ''}`, 'good');
    this.ui.updatePlayer(p);
  }

  payMoney(from, amount, to, reason = '') {
    amount = Math.max(0, Math.round(amount));
    if (!amount) return true;

    if (from.cash >= amount) {
      from.cash -= amount;
      if (to) to.cash += amount;
      else this.pot += amount;
      this.log(
        `${from.name} 支付 <b>${money(amount)}</b>${reason ? ' · ' + reason : ''}${
          to ? ' 給 ' + to.name : '（撥入車費池）'
        }。`,
        'bad',
      );
      this.ui.toast(`-${money(amount)}${reason ? ' · ' + reason : ''}`, 'bad');
      this.ui.updatePlayer(from);
      if (to) this.ui.updatePlayer(to);
      this.ui.setPot(this.pot);
      return true;
    }

    const paid = from.cash;
    from.cash = 0;
    if (to) to.cash += paid;
    else this.pot += paid;
    this.log(`${from.name} 現金不足，無力支付 ${money(amount)}，宣告破產。`, 'bad');
    this.ui.toast(`${from.name} 破產！`, 'bad');
    this.bankrupt(from, to);
    this.ui.setPot(this.pot);
    return false;
  }

  collectFromAll(p, amount) {
    this.players.forEach((other) => {
      if (other.id === p.id || other.bankrupt) return;
      this.payMoney(other, amount, p, '應急補償');
    });
    this.ui.updatePlayer(p);
  }

  bankrupt(p, creditor) {
    p.bankrupt = true;
    p.props.forEach((idx) => {
      this.owners[idx] = null;
      this.levels[idx] = 0;
      this.board.setOwner(idx, null);
      this.board.setLevel(idx, 0);
    });
    p.props = [];
    p.completedLines = 0;
    p._lines = new Set();
    this.board.retireToken(p.id);
    this.ui.updatePlayer(p);
    this.log(`${p.name} 退出遊戲。`, 'bad');

    const alive = this.players.filter((x) => !x.bankrupt);
    if (alive.length <= 1) {
      const winner = alive[0];
      this.settle(
        winner ? `${winner.name} 成為最後生還者，獨佔全港路綫。` : '全員破產，遊戲結束。',
        winner,
      );
    }
  }

  /* ── 上蓋物業 ───────────────────────────────────────────── */
  buildUp(p, idx) {
    if (this.owners[idx] !== p.id) return false;
    if (this.levels[idx] >= MAX_LEVEL) return false;
    const cost = upgradeCost(idx, p);
    if (p.cash < cost) {
      this.log(`${p.name} 現金不足，未能升級「${BOARD[idx].name}」。`, 'warn');
      return false;
    }
    p.cash -= cost;
    this.levels[idx]++;
    this.board.setLevel(idx, this.levels[idx]);
    this.board.pulseTile(idx);
    this.log(
      `${p.name} 把「${BOARD[idx].name}」升級為 <b>${levelName(this.levels[idx])}</b>（${money(cost)}）。`,
      'good',
    );
    this.ui.updatePlayer(p);
    return true;
  }

  aiWantsBuy(p, idx) {
    const t = BOARD[idx];
    const price = buyPrice(idx, p);
    if (p.cash < price) return false;
    const group = GROUP_TILES[t.line] || [];
    const owned = group.filter((i) => this.owners[i] === p.id).length;
    const missing = group.length - owned;
    if (p.cash - price < 2600) return Math.random() < 0.2;
    if (missing === 1) return true;
    return Math.random() < 0.72;
  }

  aiBuild(p) {
    const buildable = p.props.filter(
      (i) => this.levels[i] < MAX_LEVEL && p.cash - upgradeCost(i, p) > 3800,
    );
    if (!buildable.length) return false;
    const withLine = buildable.filter((i) => this.ownsLine(p.id, BOARD[i].line));
    const pick = (withLine.length ? withLine : buildable).sort(
      (a, b) => upgradeCost(b, p) - upgradeCost(a, p),
    )[0];
    return this.buildUp(p, pick);
  }

  promoteRandom(p) {
    const options = p.props.filter((i) => this.levels[i] < MAX_LEVEL);
    if (!options.length) {
      this.reward(p, 300, '免費升級替代獎金');
      return;
    }
    const idx = options[Math.floor(Math.random() * options.length)];
    this.levels[idx]++;
    this.board.setLevel(idx, this.levels[idx]);
    this.board.pulseTile(idx);
    this.log(`${p.name} 的「${BOARD[idx].name}」免費升級為 <b>${levelName(this.levels[idx])}</b>。`, 'good');
    this.ui.toast(`${BOARD[idx].name} 免費升級`, 'gold');
    this.ui.updatePlayer(p);
  }

  /* ── 結算 ───────────────────────────────────────────────── */
  netWorth(p) {
    const propertyValue = p.props.reduce((sum, idx) => sum + BOARD[idx].price + this.levels[idx] * buildCost(idx), 0);
    return p.cash + propertyValue;
  }

  settle(reason, winner = null) {
    if (this.over) return;
    this.over = true;
    this.ui.clearActions();
    const rows = this.players
      .map((p) => ({ player: p, net: this.netWorth(p) }))
      .sort((a, b) => {
        if (a.player.bankrupt !== b.player.bankrupt) return a.player.bankrupt ? 1 : -1;
        return b.net - a.net;
      });
    const champ = winner || (rows[0].player.bankrupt ? null : rows[0].player);
    this.log(`本局結束 · ${reason}`, 'sys');
    this.ui.gameOver(rows, { reason, winner: champ });
  }
}
