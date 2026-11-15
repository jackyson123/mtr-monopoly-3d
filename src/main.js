import { BoardScene } from './scene.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { BOARD, LINES, ROLES, levelName, money, rentFor } from './data.js';

const ui = new UI();
const canvas = document.getElementById('stage');

let scene;
let game;

function tooltipHTML(idx) {
  if (idx == null) return null;
  const t = BOARD[idx];
  const ownerId = game ? game.owners[idx] : null;
  const level = game ? game.levels[idx] : 0;
  const owner = ownerId !== null && game ? game.players[ownerId] : null;
  const color = t.line ? LINES[t.line].color : t.accent || '#6fe3ff';
  const lineName = t.line ? LINES[t.line].name : '港鐵網絡';

  const head = `
    <div class="ttTop">
      <span class="ttChip" style="--c:${color}"></span>
      <div>
        <div class="ttName">${t.name}</div>
        <div class="ttLine">${lineName}${t.type === 'property' ? ' · STATION' : ''}</div>
      </div>
    </div>`;

  if (t.type === 'property') {
    const rows = [0, 1, 2, 3]
      .map(
        (l) =>
          `<span>${levelName(l)}${l === level ? ' ←' : ''}</span><b>${money(
            rentFor(idx, l, !!(owner && game.ownsLine(owner.id, t.line))),
          )}</b>`,
      )
      .join('');
    return `${head}
      <div class="ttRows">${rows}</div>
      <div class="ttFoot">${
        owner
          ? `業主 <b style="color:${owner.color}">${owner.name}</b> · ${levelName(level)}`
          : `待售 <b>${money(t.price)}</b>`
      }</div>`;
  }

  if (t.type === 'utility') {
    return `${head}
      <div class="ttRows"><span>售價</span><b>${money(t.price)}</b>
      <span>車費</span><b>骰子 × $100</b><span>兩間齊集</span><b>骰子 × $250</b></div>
      <div class="ttFoot">${owner ? `業主 <b style="color:${owner.color}">${owner.name}</b>` : '待售'}</div>`;
  }

  const desc = {
    go: '駛經或停留可領取 HK$2,000 車費收入。',
    card: '抽一張乘客消息，可能獲得獎金或遭遇罰款。',
    tax: '按現金 10% 繳付票價調整，款項撥入車費池。',
    ride: t.mode === 'express' ? '支付 HK$800，飛往任何一個車站。' : '免費轉乘至任何路綫的車站。',
    jail: '列車服務延誤，暫停 2 回合。可付 HK$800 提早出閘。',
    gotojail: '發生事故，即時被送往「服務延誤」。',
    parking: '停在車廠可獨得車費池內所有罰款。',
  }[t.type];

  return `${head}<div class="ttFoot" style="border-top:0;padding-top:2px;color:#c3d6ee;font-size:10.5px;line-height:1.65">${desc || ''}</div>`;
}

function onHover(idx, x, y) {
  if (idx == null) {
    ui.hideTooltip();
    return;
  }
  const html = tooltipHTML(idx);
  if (html) ui.showTooltip(html, x, y);
}

async function boot() {
  await Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((r) => setTimeout(r, 1600)),
  ]);

  scene = new BoardScene(canvas, { onHover });
  game = new Game(scene, ui);
  ui.buildRolePicker(ROLES);

  ui.showStart((roleId) => {
    game.setHumanRole(roleId);
    game.start();
  });
}

boot();
