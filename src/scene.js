import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BOARD, LINES, ROLES, tilePosition } from './data.js';

const TILE = 0.92;
const TILE_TOP = 0.12;
const PLAYER_OFFSETS = [
  [-0.2, -0.2],
  [0.2, -0.2],
  [-0.2, 0.2],
  [0.2, 0.2],
];

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

function hexA(hex, alpha) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function roundedRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

function fitFont(g, text, maxWidth, size, weight = '900', family = '"Noto Sans HK","PingFang HK",sans-serif') {
  let s = size;
  while (s > 14) {
    g.font = `${weight} ${s}px ${family}`;
    if (g.measureText(text).width <= maxWidth) break;
    s -= 2;
  }
  return s;
}

function wrapText(g, text, maxWidth) {
  const lines = [];
  let cur = '';
  for (const ch of text) {
    if (g.measureText(cur + ch).width > maxWidth && cur) {
      lines.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) lines.push(cur);
  return lines;
}

/* ── 棋盤格貼圖 ─────────────────────────────────────────────── */
function makeTileTexture(tile, inner) {
  const S = 384;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d');
  const accent = tile.line ? LINES[tile.line].color : tile.accent || '#6fe3ff';

  const bg = g.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, '#16213a');
  bg.addColorStop(0.5, '#0d1526');
  bg.addColorStop(1, '#070d18');
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);

  const rg = g.createRadialGradient(S * 0.5, S * 0.46, 8, S * 0.5, S * 0.5, S * 0.8);
  rg.addColorStop(0, hexA(accent, 0.28));
  rg.addColorStop(1, hexA(accent, 0));
  g.fillStyle = rg;
  g.fillRect(0, 0, S, S);

  g.strokeStyle = 'rgba(150,190,255,0.16)';
  g.lineWidth = 3;
  g.strokeRect(5, 5, S - 10, S - 10);

  const band = 34;
  if (tile.type === 'property') {
    const grad = g.createLinearGradient(0, 0, S, 0);
    grad.addColorStop(0, accent);
    grad.addColorStop(1, hexA(accent, 0.7));
    g.fillStyle = grad;
    g.shadowColor = accent;
    g.shadowBlur = 18;
    if (inner === 'top') g.fillRect(0, 0, S, band);
    else if (inner === 'bottom') g.fillRect(0, S - band, S, band);
    else if (inner === 'left') g.fillRect(0, 0, band, S);
    else g.fillRect(S - band, 0, band, S);
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.35)';
    if (inner === 'top') g.fillRect(0, 0, S, 3);
    else if (inner === 'bottom') g.fillRect(0, S - 3, S, 3);
    else if (inner === 'left') g.fillRect(0, 0, 3, S);
    else g.fillRect(S - 3, 0, 3, S);

    const nameY = inner === 'top' ? S * 0.43 : inner === 'bottom' ? S * 0.39 : S * 0.44;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#f4f9ff';
    fitFont(g, tile.name, S * 0.9, 94);
    g.fillStyle = '#ffffff';
    g.fillText(tile.name, S / 2, nameY);

    g.font = '600 23px "JetBrains Mono","Noto Sans HK",monospace';
    g.fillStyle = hexA(accent, 1);
    g.fillText(LINES[tile.line].name, S / 2, nameY + 52);

    const priceY = inner === 'bottom' ? S - band - 30 : S - 32;
    g.font = '700 40px "JetBrains Mono",monospace';
    g.fillStyle = '#f6d08a';
    g.fillText('HK$' + tile.price, S / 2, priceY);
  } else {
    const glyphs = {
      go: 'GO',
      jail: 'II',
      parking: 'P',
      gotojail: '!',
      card: '?',
      tax: '%',
      utility: '◈',
      ride: '⇄',
    };
    const glyph = glyphs[tile.type] || '◆';
    g.save();
    g.strokeStyle = hexA(accent, 0.85);
    g.lineWidth = 3;
    g.fillStyle = hexA(accent, 0.1);
    g.shadowColor = accent;
    g.shadowBlur = 22;
    roundedRect(g, S / 2 - 58, 62, 116, 116, 26);
    g.fill();
    g.stroke();
    g.restore();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = accent;
    g.font = '900 54px "JetBrains Mono","Noto Sans HK",sans-serif';
    g.fillText(glyph, S / 2, 122);

    const nameY = tile.type === 'go' ? 236 : 232;
    g.fillStyle = '#f4f9ff';
    fitFont(g, tile.name, S * 0.86, tile.name.length > 3 ? 54 : 62);
    g.fillText(tile.name, S / 2, nameY);

    if (tile.sub) {
      g.font = '500 20px "Noto Sans HK",sans-serif';
      g.fillStyle = '#93a9c8';
      const lines = wrapText(g, tile.sub, S * 0.78).slice(0, 2);
      lines.forEach((ln, i) => g.fillText(ln, S / 2, nameY + 38 + i * 26));
    }

    g.font = '600 16px "JetBrains Mono",monospace';
    g.fillStyle = hexA(accent, 0.55);
    g.fillText(
      { go: 'MTR · 起點', jail: 'DETENTION', parking: 'DEPOT', gotojail: 'ALERT', card: 'PASSENGER INFO', tax: 'FARE REVIEW', utility: 'STATION MALL', ride: 'INTERCHANGE' }[
        tile.type
      ] || '',
      S / 2,
      S - 26,
    );
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeWindowTexture() {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d');
  g.fillStyle = '#060d18';
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 7; x++) {
      const lit = Math.random();
      g.fillStyle = lit > 0.55 ? `rgba(255,225,170,${0.55 + Math.random() * 0.45})` : 'rgba(40,70,110,0.5)';
      g.fillRect(10 + x * 16, 8 + y * 15, 9, 9);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePipTexture(value) {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d');
  const bg = g.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, '#eef6ff');
  bg.addColorStop(1, '#a9c4e0');
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 6;
  g.strokeRect(3, 3, S - 6, S - 6);

  const pos = {
    1: [[0.5, 0.5]],
    2: [[0.28, 0.28], [0.72, 0.72]],
    3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
    4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
    5: [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
    6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]],
  }[value];
  g.fillStyle = '#16233a';
  for (const [x, y] of pos) {
    g.beginPath();
    g.arc(x * S, y * S, S * 0.082, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLabelTexture(text, color) {
  const w = 320;
  const h = 112;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(3,8,16,0.82)';
  g.strokeStyle = hexA(color, 0.9);
  g.lineWidth = 4;
  roundedRect(g, 4, 4, w - 8, h - 8, 26);
  g.fill();
  g.stroke();
  g.fillStyle = color;
  g.beginPath();
  g.arc(42, h / 2, 12, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f2f8ff';
  g.font = '700 44px "Noto Sans HK",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2 + 16, h / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBackgroundTexture() {
  const S = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d');
  const bg = g.createRadialGradient(S * 0.5, S * 0.44, 40, S * 0.5, S * 0.5, S * 0.78);
  bg.addColorStop(0, '#132744');
  bg.addColorStop(0.45, '#0a1526');
  bg.addColorStop(1, '#03060d');
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);

  for (let i = 0; i < 260; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = Math.random() * 1.6;
    g.fillStyle = `rgba(180,215,255,${0.05 + Math.random() * 0.22})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ── 棋盤場景 ─────────────────────────────────────────────── */
export class BoardScene {
  constructor(canvas, { onHover } = {}) {
    this.canvas = canvas;
    this.onHover = onHover;
    this.tweens = [];
    this.tileObjects = [];
    this.hovered = -1;
    this.activeToken = 0;
    this.time = 0;
    this.trains = [];
    this.monoTrains = [];
    this.holoTrains = [];
    this.isDragging = false;
    this.dragMoved = 0;
    this.lastPointer = { x: 0, y: 0 };
    this.clock = new THREE.Clock();

    this.initRenderer();
    this.initScene();
    this.buildBoard();
    this.buildHologram();
    this.buildMonorail();
    this.buildDice();
    this.buildTokens();
    this.buildParticles();
    this.bindEvents();
    this.resize();
    this.animate();
  }

  /* ── 初始化 ─────────────────────────────────────────────── */
  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.94;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    this.camState = { radius: 22, theta: 0.72, phi: 0.88 };
    this.camTarget = { radius: 22, theta: 0.72, phi: 0.88 };
    this.lookAt = new THREE.Vector3(0, 0.2, 0);
  }

  initScene() {
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.background = makeBackgroundTexture();
    scene.fog = new THREE.Fog(0x04070e, 34, 78);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.42;

    const hemi = new THREE.HemisphereLight(0x9ccbff, 0x04070e, 0.75);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff1d6, 1.5);
    key.position.set(9, 18, 11);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 50;
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    key.shadow.bias = -0.0006;
    key.shadow.radius = 2.4;
    scene.add(key);
    this.keyLight = key;

    const fill = new THREE.DirectionalLight(0x4aa8ff, 0.55);
    fill.position.set(-11, 9, -9);
    scene.add(fill);

    const rim = new THREE.PointLight(0x5ee6ff, 12, 40, 2);
    rim.position.set(-7, 5, 7);
    scene.add(rim);

    const warm = new THREE.PointLight(0xff8a6b, 9, 36, 2);
    warm.position.set(8, 4, -6);
    scene.add(warm);

    // 地面
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(46, 96),
      new THREE.MeshStandardMaterial({ color: 0x060b14, metalness: 0.55, roughness: 0.62 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.85;
    ground.receiveShadow = true;
    scene.add(ground);

    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 256;
    const gg = glowCanvas.getContext('2d');
    const grd = gg.createRadialGradient(128, 128, 4, 128, 128, 128);
    grd.addColorStop(0, 'rgba(80,170,255,0.55)');
    grd.addColorStop(0.45, 'rgba(50,120,220,0.18)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    gg.fillStyle = grd;
    gg.fillRect(0, 0, 256, 256);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshBasicMaterial({
        map: glowTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        opacity: 0.65,
      }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.8;
    scene.add(glow);

    // 後期處理
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.62, 0.5, 1.0);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.composer = composer;
  }

  /* ── 棋盤 ───────────────────────────────────────────────── */
  buildBoard() {
    const plinth = new THREE.Mesh(
      new RoundedBoxGeometry(11.46, 0.62, 11.46, 4, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x0a1322, metalness: 0.85, roughness: 0.32 }),
    );
    plinth.position.y = -0.38;
    plinth.receiveShadow = true;
    plinth.castShadow = true;
    this.scene.add(plinth);

    const rim = new THREE.Mesh(
      new RoundedBoxGeometry(11.58, 0.1, 11.58, 4, 0.05),
      new THREE.MeshStandardMaterial({
        color: 0xc19a58,
        metalness: 0.85,
        roughness: 0.44,
        emissive: 0x2e1f08,
        emissiveIntensity: 0.3,
      }),
    );
    rim.position.y = -0.06;
    rim.receiveShadow = true;
    this.scene.add(rim);

    const inner = new THREE.Mesh(
      new RoundedBoxGeometry(9.2, 0.1, 9.2, 4, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x091324, metalness: 0.9, roughness: 0.28 }),
    );
    inner.position.y = 0.02;
    inner.receiveShadow = true;
    this.scene.add(inner);

    // 中央地面光紋
    const paveCanvas = document.createElement('canvas');
    paveCanvas.width = paveCanvas.height = 512;
    const pg = paveCanvas.getContext('2d');
    pg.fillStyle = '#081120';
    pg.fillRect(0, 0, 512, 512);
    pg.strokeStyle = 'rgba(90,150,230,0.14)';
    pg.lineWidth = 1;
    for (let i = 0; i <= 512; i += 32) {
      pg.beginPath();
      pg.moveTo(i, 0);
      pg.lineTo(i, 512);
      pg.stroke();
      pg.beginPath();
      pg.moveTo(0, i);
      pg.lineTo(512, i);
      pg.stroke();
    }
    const paveTex = new THREE.CanvasTexture(paveCanvas);
    paveTex.colorSpace = THREE.SRGBColorSpace;
    const pave = new THREE.Mesh(
      new THREE.PlaneGeometry(8.9, 8.9),
      new THREE.MeshStandardMaterial({
        map: paveTex,
        color: 0x254468,
        metalness: 0.9,
        roughness: 0.24,
        emissiveMap: paveTex,
        emissive: 0x2f6ea8,
        emissiveIntensity: 0.4,
      }),
    );
    pave.rotation.x = -Math.PI / 2;
    pave.position.y = 0.08;
    pave.receiveShadow = true;
    this.scene.add(pave);

    const windowTex = makeWindowTexture();
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x0b1524, metalness: 0.75, roughness: 0.4 });

    BOARD.forEach((tile, i) => {
      const pos = tilePosition(i);
      // 左右兩邊的車站牌沿邊緣排版，避免文字被透視壓扁
      const sideTile = pos.side === 'left' || pos.side === 'right';
      const tex = makeTileTexture(tile, sideTile ? 'top' : pos.inner);
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

      const topMat = new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: 0xffffff,
        emissiveIntensity: 0.3,
        metalness: 0.14,
        roughness: 0.62,
      });

      const mesh = new THREE.Mesh(new THREE.BoxGeometry(TILE, 0.16, TILE), [
        sideMat,
        sideMat,
        topMat,
        sideMat,
        sideMat,
        sideMat,
      ]);
      mesh.position.set(pos.x, 0.04, pos.z);
      if (pos.side === 'left') mesh.rotation.y = -Math.PI / 2;
      else if (pos.side === 'right') mesh.rotation.y = Math.PI / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.tile = i;
      this.scene.add(mesh);

      // 擁有權光框
      const frame = new THREE.Group();
      const frameMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const mk = (w, h, d, x, y, z) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
        m.position.set(x, y, z);
        frame.add(m);
      };
      mk(TILE - 0.06, 0.02, 0.035, 0, 0, TILE / 2 - 0.035);
      mk(TILE - 0.06, 0.02, 0.035, 0, 0, -TILE / 2 + 0.035);
      mk(0.035, 0.02, TILE - 0.1, TILE / 2 - 0.035, 0, 0);
      mk(0.035, 0.02, TILE - 0.1, -TILE / 2 + 0.035, 0, 0);
      frame.position.set(pos.x, TILE_TOP + 0.004, pos.z);
      frame.visible = false;
      this.scene.add(frame);

      // 上蓋物業
      const builds = new THREE.Group();
      builds.position.set(pos.x, 0, pos.z);
      const buildMat = new THREE.MeshStandardMaterial({
        color: 0x1a2b47,
        metalness: 0.6,
        roughness: 0.25,
        emissiveMap: windowTex,
        emissive: 0xffffff,
        emissiveIntensity: 1.15,
      });
      const lineColor = new THREE.Color(LINES[tile.line]?.color || '#6fe3ff');
      const glass = new THREE.MeshPhysicalMaterial({
        color: lineColor.clone().lerp(new THREE.Color('#e6f3ff'), 0.6),
        metalness: 0.15,
        roughness: 0.08,
        transparent: true,
        opacity: 0.8,
        emissive: lineColor.clone().multiplyScalar(0.5),
        emissiveIntensity: 0.7,
        clearcoat: 1,
      });
      const roofLight = new THREE.MeshStandardMaterial({
        color: 0x0d1725,
        metalness: 0.6,
        roughness: 0.35,
        emissive: lineColor.clone(),
        emissiveIntensity: 1.1,
      });
      const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe9b8'), toneMapped: false });

      const kiosk = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.15, 0.42, 3, 0.03), buildMat);
      kiosk.position.y = 0.2;
      kiosk.castShadow = true;
      const kioskTop = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.03, 0.46, 2, 0.01), roofLight);
      kioskTop.position.y = 0.28;
      builds.add(kiosk, kioskTop);

      const tower = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.3, 0.28, 3, 0.04), glass);
      tower.position.y = 0.44;
      tower.castShadow = true;
      builds.add(tower);

      const spire = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.34, 0.17, 3, 0.03), glass);
      spire.position.y = 0.76;
      spire.castShadow = true;
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), beaconMat);
      beacon.position.y = 0.95;
      builds.add(spire, beacon);

      builds.children.forEach((c, ci) => {
        c.visible = false;
        c.scale.setScalar(0.001);
      });
      this.scene.add(builds);

      this.tileObjects.push({ mesh, topMat, frame, frameMat, builds, tile });
    });

    // 落點光環
    this.landRing = new THREE.Mesh(
      new THREE.RingGeometry(0.36, 0.46, 56),
      new THREE.MeshBasicMaterial({
        color: 0x8fe8ff,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.landRing.rotation.x = -Math.PI / 2;
    this.landRing.position.y = TILE_TOP + 0.02;
    this.landRing.visible = false;
    this.scene.add(this.landRing);
  }

  /* ── 中央全息路綫圖 ─────────────────────────────────────── */
  buildHologram() {
    const group = new THREE.Group();
    group.position.y = 0.9;
    group.scale.setScalar(1.12);
    this.holo = group;
    this.scene.add(group);

    const dais = new THREE.Mesh(
      new THREE.CylinderGeometry(3.55, 3.65, 0.09, 64),
      new THREE.MeshStandardMaterial({ color: 0x0a1526, metalness: 0.95, roughness: 0.15 }),
    );
    dais.position.y = -0.72;
    dais.receiveShadow = true;
    this.scene.add(dais);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x5ad8ff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2 - i * 0.28, 0.008, 6, 120), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.66 + i * 0.015;
      group.add(ring);
      if (i === 1) this.holoRing = ring;
    }

    const NETWORK = [
      { line: 'tsuen', pts: [[-2.7, -1.5], [-1.6, -0.9], [-0.6, -0.2], [0.4, 0.6], [1.4, 1.3], [2.5, 1.9]] },
      { line: 'kwun', pts: [[-2.3, 2.1], [-1.1, 1.2], [-0.2, 0.4], [0.7, 0.8], [1.7, 1.7]] },
      { line: 'island', pts: [[-2.5, 0.1], [-1.2, 0.5], [0.1, 0.85], [1.3, 0.4], [2.4, -0.5]] },
      { line: 'tung', pts: [[-1.7, -2.2], [-0.7, -1.3], [0.1, -0.5], [0.6, 0.3], [1.2, 1.1], [2.1, 1.7]] },
      { line: 'tko', pts: [[0.2, -2.3], [0.5, -1.2], [0.9, -0.3], [1.5, 0.6], [2.3, 1.2]] },
      { line: 'east', pts: [[-2.1, -0.8], [-1.0, -0.1], [0.2, 0.15], [1.2, -0.15], [2.2, -0.9]] },
    ];

    NETWORK.forEach((route, idx) => {
      const color = LINES[route.line].color;
      const pts = route.pts.map(([x, z], i) => new THREE.Vector3(x, 0.16 + idx * 0.045 + Math.sin(i) * 0.02, z));
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 64, 0.038, 6, false),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(color).multiplyScalar(1.35),
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      group.add(tube);

      pts.forEach((p, pi) => {
        if (pi % 2 === 0) {
          const node = new THREE.Mesh(
            new THREE.SphereGeometry(0.055, 10, 10),
            new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
          );
          node.position.copy(p);
          group.add(node);
        }
      });

      const train = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.045, 0.12, 4, 8),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.8), toneMapped: false }),
      );
      train.rotation.z = Math.PI / 2;
      group.add(train);
      this.holoTrains.push({ mesh: train, curve, offset: Math.random(), speed: 0.05 + Math.random() * 0.04 });
    });

    // 中央銘牌
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 128;
    const lg = labelCanvas.getContext('2d');
    lg.textAlign = 'center';
    lg.textBaseline = 'middle';
    lg.fillStyle = 'rgba(140,200,255,0.5)';
    lg.font = '600 30px "JetBrains Mono",monospace';
    lg.fillText('HONG KONG MTR · NETWORK', 256, 44);
    lg.fillStyle = 'rgba(246,208,138,0.9)';
    lg.font = '900 44px "Noto Sans HK",sans-serif';
    lg.fillText('全 港 路 綫 圖', 256, 92);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    labelTex.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(2.7, 0.68),
      new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthWrite: false, toneMapped: false }),
    );
    label.rotation.x = -Math.PI / 2;
    label.position.set(0, -0.63, 2.55);
    group.add(label);
  }

  /* ── 環繞列車 ───────────────────────────────────────────── */
  buildMonorail() {
    const shape = new THREE.Shape();
    const h = 6.62;
    const r = 1.5;
    shape.moveTo(-h + r, -h);
    shape.lineTo(h - r, -h);
    shape.absarc(h - r, -h + r, r, -Math.PI / 2, 0, false);
    shape.lineTo(h, h - r);
    shape.absarc(h - r, h - r, r, 0, Math.PI / 2, false);
    shape.lineTo(-h + r, h);
    shape.absarc(-h + r, h - r, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(-h, -h + r);
    shape.absarc(-h + r, -h + r, r, Math.PI, Math.PI * 1.5, false);
    const raw = shape.getPoints(320);
    const pts = raw.map((p) => new THREE.Vector3(p.x, 0.55, p.y));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.1);

    const track = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 480, 0.035, 5, true),
      new THREE.MeshStandardMaterial({ color: 0x2a4a72, metalness: 1, roughness: 0.2, emissive: 0x0d2f52, emissiveIntensity: 0.9 }),
    );
    this.scene.add(track);

    const glowCurve = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 480, 0.022, 5, true),
      new THREE.MeshBasicMaterial({ color: 0x7fe4ff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    glowCurve.position.y = 0.06;
    this.scene.add(glowCurve);

    const palette = ['#ff6b7f', '#6ff0c4', '#7fbcff'];
    for (let i = 0; i < 3; i++) {
      const color = palette[i];
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new RoundedBoxGeometry(0.34, 0.11, 0.14, 3, 0.04),
        new THREE.MeshStandardMaterial({ color: 0xe8f3ff, metalness: 0.4, roughness: 0.2, emissive: 0x1c4c6e, emissiveIntensity: 0.6 }),
      );
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.03, 0.145),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color), toneMapped: false }),
      );
      stripe.position.y = 0.03;
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.028, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      );
      light.position.set(0.18, 0.01, 0);
      g.add(body, stripe, light);
      this.scene.add(g);
      this.monoTrains.push({ group: g, curve, offset: i / 3 + 0.06, speed: 0.022 + i * 0.004 });
    }
  }

  /* ── 骰子 ───────────────────────────────────────────────── */
  buildDice() {
    const group = new THREE.Group();
    this.scene.add(group);
    this.diceGroup = group;

    // 骰子台
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.08, 0.24, 48),
      new THREE.MeshStandardMaterial({ color: 0x101d33, metalness: 0.9, roughness: 0.2 }),
    );
    pedestal.position.set(0, 0.16, 3.28);
    pedestal.receiveShadow = true;
    group.add(pedestal);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.96, 0.016, 8, 80),
      new THREE.MeshBasicMaterial({ color: 0xf6d08a, transparent: true, opacity: 0.9, toneMapped: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.29, 3.28);
    group.add(ring);

    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(0.82, 1.5, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x6fe3ff,
        transparent: true,
        opacity: 0.07,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    beam.position.set(0, 1.0, 3.28);
    group.add(beam);

    const faceIndex = [2, 5, 1, 6, 3, 4];
    const geo = new THREE.BoxGeometry(0.52, 0.52, 0.52);
    this.dice = [];
    for (let d = 0; d < 2; d++) {
      const mats = faceIndex.map(
        (v) =>
          new THREE.MeshStandardMaterial({
            map: makePipTexture(v),
            metalness: 0.35,
            roughness: 0.28,
            emissive: 0x223a5c,
            emissiveIntensity: 0.25,
          }),
      );
      const die = new THREE.Mesh(geo, mats);
      die.castShadow = true;
      die.position.set(d === 0 ? -0.44 : 0.44, 1.55, 3.28);
      group.add(die);
      // 邊線
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, toneMapped: false }),
      );
      edges.rotation.copy(die.rotation);
      die.userData.edges = edges;
      group.add(edges);
      this.dice.push(die);
    }
    group.visible = false;
  }

  /* ── 港鐵角色棋子 ───────────────────────────────────────── */
  buildTokens() {
    this.tokens = [];
    ROLES.forEach((role, i) => {
      const color = role.color;
      const g = new THREE.Group();
      const body = new THREE.Group();
      g.add(body);

      const skinMat = new THREE.MeshStandardMaterial({ color: 0xf3cba6, roughness: 0.62, metalness: 0.04 });
      const navyMat = new THREE.MeshStandardMaterial({ color: 0x17253a, roughness: 0.5, metalness: 0.25 });
      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xeef5ff, roughness: 0.45, metalness: 0.12 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.45, metalness: 0.3 });
      const accentMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0.3,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.28,
      });
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xf0c977,
        roughness: 0.25,
        metalness: 0.95,
        emissive: 0x4a310c,
        emissiveIntensity: 0.35,
      });
      const hiMat = new THREE.MeshStandardMaterial({
        color: 0xe6fbff,
        roughness: 0.25,
        metalness: 0.2,
        emissive: 0x86ddff,
        emissiveIntensity: 0.55,
      });
      const faceMat = new THREE.MeshStandardMaterial({ color: 0x141a24, roughness: 0.4, metalness: 0.1 });

      const add = (mesh, x, y, z) => {
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        body.add(mesh);
        return mesh;
      };

      // 腿與鞋
      for (const sx of [-0.058, 0.058]) {
        add(new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.15, 0.075, 2, 0.02), navyMat), sx, 0.09, 0);
        add(new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.045, 0.13, 2, 0.018), darkMat), sx, 0.024, 0.018);
      }

      const isEngineer = role.id === 'engineer';
      const isRider = role.id === 'rider';

      // 制服
      add(
        new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.25, 0.17, 3, 0.05), isEngineer || isRider ? accentMat : whiteMat),
        0,
        0.31,
        0,
      );
      add(new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.05, 0.05, 2, 0.015), navyMat), 0, 0.445, 0.04);

      if (isEngineer) {
        for (const sy of [0.265, 0.34]) {
          add(new THREE.Mesh(new THREE.BoxGeometry(0.262, 0.02, 0.006), hiMat), 0, sy, 0.088);
        }
        add(new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.08, 0.06, 2, 0.02), darkMat), 0.13, 0.19, -0.03);
      } else if (isRider) {
        add(new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.13, 0.035, 2, 0.012), darkMat), 0, 0.31, 0.088);
        add(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.038, 0.008), goldMat), 0.045, 0.365, 0.107);
        add(new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.22, 0.09, 3, 0.03), accentMat), 0, 0.33, -0.125);
      } else {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.15, 0.008), accentMat), 0, 0.33, 0.089);
        add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.008, 0.01), goldMat), 0, 0.4, 0.09);
      }

      // 手臂與手
      for (const sx of [-1, 1]) {
        const arm = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.032, 0.13, 4, 8),
          isEngineer || isRider ? accentMat : whiteMat,
        );
        arm.rotation.z = sx * 0.18;
        arm.castShadow = true;
        arm.position.set(sx * 0.15, 0.32, 0);
        body.add(arm);
        add(new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 10), skinMat), sx * 0.175, 0.235, 0.012);
      }

      // 頭、頭髮、表情
      add(new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 16), skinMat), 0, 0.535, 0);
      const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.118, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
        faceMat,
      );
      hair.position.set(0, 0.538, -0.004);
      hair.castShadow = true;
      body.add(hair);
      for (const sx of [-0.042, 0.042]) {
        add(new THREE.Mesh(new THREE.SphereGeometry(0.0155, 10, 10), faceMat), sx, 0.528, 0.104);
      }
      const smile = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 6, 14, Math.PI), faceMat);
      smile.position.set(0, 0.497, 0.106);
      smile.rotation.z = Math.PI;
      body.add(smile);

      // 角色配件
      if (role.id === 'captain') {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.122, 0.06, 22), navyMat), 0, 0.628, 0);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.123, 0.123, 0.014, 22), accentMat), 0, 0.601, 0);
        const brim = add(new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.016, 0.1, 2, 0.008), darkMat), 0, 0.605, 0.085);
        brim.rotation.x = -0.12;
        add(new THREE.Mesh(new THREE.TorusGeometry(0.121, 0.009, 6, 24), goldMat), 0, 0.607, 0).rotation.x = Math.PI / 2;
      } else if (role.id === 'master') {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.122, 0.055, 22), whiteMat), 0, 0.64, 0);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.123, 0.123, 0.022, 22), navyMat), 0, 0.612, 0);
        const brim = add(new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.016, 0.1, 2, 0.008), darkMat), 0, 0.606, 0.086);
        brim.rotation.x = -0.1;
        const board = add(new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.14, 0.012), whiteMat), 0.196, 0.29, 0.06);
        board.rotation.z = 0.12;
        add(new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.05, 0.008), accentMat), 0.196, 0.315, 0.07);
      } else if (role.id === 'engineer') {
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(0.127, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
          hiMat,
        );
        dome.position.set(0, 0.625, 0);
        dome.scale.set(1, 0.92, 1);
        dome.castShadow = true;
        body.add(dome);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.158, 0.158, 0.014, 22), hiMat), 0, 0.63, 0);
      } else if (role.id === 'rider') {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.012, 6, 22, Math.PI), darkMat);
        band.position.set(0, 0.558, -0.004);
        band.castShadow = true;
        body.add(band);
        for (const sx of [-0.114, 0.114]) {
          add(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.026, 12), accentMat), sx, 0.532, 0).rotation.z = Math.PI / 2;
        }
        const card = add(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.05, 0.008), hiMat), 0.19, 0.24, 0.05);
        card.rotation.z = -0.2;
      }

      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.17, 0.245, 40),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.008;
      g.add(halo);

      const labelTex = makeLabelTexture(role.name, color);
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false, depthTest: false }),
      );
      label.scale.set(0.44, 0.154, 1);
      label.position.y = 0.84;
      label.renderOrder = 10;
      g.add(label);

      g.userData.halo = halo;
      g.userData.body = body;
      g.userData.color = color;
      const p = tilePosition(0);
      g.position.set(p.x + PLAYER_OFFSETS[i][0], TILE_TOP, p.z + PLAYER_OFFSETS[i][1]);
      this.scene.add(g);
      this.tokens.push(g);
    });
  }

  buildParticles() {
    const count = 320;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 6 + Math.random() * 12;
      const a = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = Math.random() * 9 - 0.5;
      positions[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x9fd4ff,
      size: 0.05,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  /* ── 事件 ───────────────────────────────────────────────── */
  bindEvents() {
    const canvas = this.canvas;

    canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.dragMoved = 0;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture?.(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        this.dragMoved += Math.abs(dx) + Math.abs(dy);
        this.camTarget.theta -= dx * 0.006;
        this.camTarget.phi = THREE.MathUtils.clamp(this.camTarget.phi - dy * 0.0042, 0.32, 1.22);
        if (this.onHover) this.onHover(null, 0, 0);
        return;
      }
      this.pickTile(e.clientX, e.clientY);
    });

    const end = () => {
      this.isDragging = false;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointerleave', () => {
      this.isDragging = false;
      if (this.onHover) this.onHover(null, 0, 0);
    });

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
            this.userZoomed = true;
        this.camTarget.radius = THREE.MathUtils.clamp(this.camTarget.radius + e.deltaY * 0.012, 13, 34);
      },
      { passive: false },
    );

    window.addEventListener('resize', () => this.resize());
  }

  pickTile(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObjects(this.tileObjects.map((t) => t.mesh), false);
    const idx = hits.length ? hits[0].object.userData.tile : null;
    if (idx !== this.hovered) {
      this.hovered = idx;
      this.canvas.style.cursor = idx !== null ? 'pointer' : 'grab';
      if (this.onHover) this.onHover(idx, clientX, clientY);
    } else if (idx !== null && this.onHover) {
      this.onHover(idx, clientX, clientY);
    }
  }

  /* ── 鏡頭 & 尺寸 ────────────────────────────────────────── */
  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;

    const aspect = w / h;
    const vFov = (this.camera.fov * Math.PI) / 180;
    const fit = Math.max(7.9 / Math.tan(vFov / 2), 8.6 / (Math.tan(vFov / 2) * aspect));
    this.fitRadius = THREE.MathUtils.clamp(fit * 1.02, 16, 33);
    this.camera.setViewOffset(w, h, 0, h * 0.14, w, h);
    if (!this.userZoomed) {
      this.camTarget.radius = this.fitRadius;
      this.camState.radius = this.fitRadius;
    }
    this.camera.updateProjectionMatrix();
    this.bloom?.setSize(w, h);
  }

  updateCamera(dt) {
    const s = this.camState;
    const t = this.camTarget;
    const k = 1 - Math.pow(0.0016, dt);
    s.theta += (t.theta - s.theta) * k;
    s.phi += (t.phi - s.phi) * k;
    s.radius += (t.radius - s.radius) * k;
    const sinPhi = Math.sin(s.phi);
    this.camera.position.set(
      this.lookAt.x + s.radius * sinPhi * Math.sin(s.theta),
      this.lookAt.y + s.radius * Math.cos(s.phi),
      this.lookAt.z + s.radius * sinPhi * Math.cos(s.theta),
    );
    this.camera.lookAt(this.lookAt);
  }

  /* ── 補間 ───────────────────────────────────────────────── */
  tween(duration, update, ease = easeOutCubic) {
    return new Promise((resolve) => {
      this.tweens.push({ t: 0, duration, update, ease, resolve });
    });
  }

  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /* ── 對外：棋子移動 ─────────────────────────────────────── */
  tokenPosition(playerIdx, tileIdx) {
    const p = tilePosition(tileIdx);
    const off = PLAYER_OFFSETS[playerIdx] || [0, 0];
    return new THREE.Vector3(p.x + off[0], TILE_TOP, p.z + off[1]);
  }

  setTokenTile(playerIdx, tileIdx) {
    const token = this.tokens[playerIdx];
    if (!token) return;
    token.position.copy(this.tokenPosition(playerIdx, tileIdx));
    token.visible = true;
  }

  async walk(playerIdx, path) {
    const token = this.tokens[playerIdx];
    if (!token) return;
    for (const idx of path) {
      const from = token.position.clone();
      const to = this.tokenPosition(playerIdx, idx);
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      if (Math.abs(dx) + Math.abs(dz) > 1e-4) {
        const targetRot = Math.atan2(dx, dz);
        let delta = targetRot - token.rotation.y;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        const startRot = token.rotation.y;
        await this.tween(120, (e) => {
          token.rotation.y = startRot + delta * e;
        });
      }
      await this.tween(160, (e) => {
        token.position.x = from.x + dx * e;
        token.position.z = from.z + dz * e;
        token.position.y = TILE_TOP + Math.sin(Math.PI * e) * 0.24;
        if (token.userData.body) token.userData.body.rotation.x = -0.18 * Math.sin(Math.PI * e);
      });
      token.position.copy(to);
      if (token.userData.body) token.userData.body.rotation.x = 0;
      this.pulseAt(to.x, to.z, token.userData.color, 0.55);
    }
    token.position.copy(this.tokenPosition(playerIdx, path[path.length - 1] ?? 0));
  }

  async ride(playerIdx, tileIdx) {
    const token = this.tokens[playerIdx];
    if (!token) return;
    const from = token.position.clone();
    const to = this.tokenPosition(playerIdx, tileIdx);
    const mid = from.clone().lerp(to, 0.5);
    mid.y += 2.6;
    await this.tween(820, (e) => {
      const a = from.clone().lerp(mid, e);
      const b = mid.clone().lerp(to, e);
      token.position.copy(a.lerp(b, e));
      token.rotation.y += 0.18;
    }, easeInOutCubic);
    token.position.copy(to);
    this.pulseAt(to.x, to.z, token.userData.color, 1.1);
  }

  async sendToJail(playerIdx, tileIdx) {
    await this.ride(playerIdx, tileIdx);
  }

  retireToken(playerIdx) {
    const token = this.tokens[playerIdx];
    if (!token) return;
    this.tween(500, (e) => {
      token.scale.setScalar(1 - e);
      token.rotation.y += 0.1;
    }).then(() => {
      token.visible = false;
    });
  }

  setActiveToken(playerIdx) {
    this.activeToken = playerIdx;
    this.tokens.forEach((t, i) => {
      const active = i === playerIdx;
      t.userData.halo.material.opacity = active ? 0.85 : 0.35;
      t.userData.halo.scale.setScalar(active ? 1.15 : 1);
    });
  }

  pulseAt(x, z, color = '#6fe3ff', strength = 1) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.26, 32),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, TILE_TOP + 0.02, z);
    this.scene.add(ring);
    this.tween(560, (e) => {
      ring.scale.setScalar(1 + e * 2.6 * strength);
      ring.material.opacity = 0.75 * (1 - e);
    }).then(() => {
      this.scene.remove(ring);
      ring.geometry.dispose();
      ring.material.dispose();
    });
  }

  pulseTile(tileIdx) {
    const p = tilePosition(tileIdx);
    this.pulseAt(p.x, p.z, 0x9fe8ff, 1.6);
  }

  highlightTile(tileIdx) {
    const p = tilePosition(tileIdx);
    this.landRing.position.set(p.x, TILE_TOP + 0.02, p.z);
    this.landRing.visible = true;
    this.landRingTimer = 0;
  }

  setOwner(tileIdx, color) {
    const t = this.tileObjects[tileIdx];
    if (!t) return;
    if (!color) {
      t.frame.visible = false;
      return;
    }
    t.frame.visible = true;
    t.frameMat.color.set(color);
    t.frameMat.opacity = 0.95;
  }

  setLevel(tileIdx, level) {
    const t = this.tileObjects[tileIdx];
    if (!t) return;
    const groups = [
      [0, 1], // 商舖
      [2], // 上蓋
      [3, 4], // 摩天塔 + 信標
    ];
    groups.forEach((group, gi) => {
      const show = level > gi;
      group.forEach((ci) => {
        const child = t.builds.children[ci];
        if (!child) return;
        if (show && !child.visible) {
          child.visible = true;
          const start = 0.001;
          child.scale.setScalar(start);
          this.tween(340, (e) => child.scale.setScalar(start + (1 - start) * e), easeOutBack);
        } else if (!show) {
          child.visible = false;
        }
      });
    });
  }

  /* ── 骰子動畫 ───────────────────────────────────────────── */
  diceEuler(value) {
    switch (value) {
      case 1: return new THREE.Euler(0, 0, 0);
      case 6: return new THREE.Euler(Math.PI, 0, 0);
      case 2: return new THREE.Euler(0, 0, Math.PI / 2);
      case 5: return new THREE.Euler(0, 0, -Math.PI / 2);
      case 3: return new THREE.Euler(-Math.PI / 2, 0, 0);
      default: return new THREE.Euler(Math.PI / 2, 0, 0);
    }
  }

  async rollDice(d1, d2) {
    const values = [d1, d2];
    this.diceGroup.visible = true;
    const start = [new THREE.Vector3(-0.44, 3.15, 3.28), new THREE.Vector3(0.44, 3.15, 3.28)];
    const end = [new THREE.Vector3(-0.44, 1.5, 3.28), new THREE.Vector3(0.44, 1.5, 3.28)];
    this.dice.forEach((die, i) => {
      die.position.copy(start[i]);
      die.quaternion.setFromEuler(
        new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      );
      die.userData.edges.position.copy(die.position);
      die.userData.edges.quaternion.copy(die.quaternion);
    });

    await this.tween(260, (e) => {
      this.dice.forEach((die, i) => {
        die.position.y = start[i].y - 0.4 * e;
        die.userData.edges.position.copy(die.position);
      });
    });

    await Promise.all(
      this.dice.map((die, i) => {
        const q0 = die.quaternion.clone();
        const q1 = new THREE.Quaternion().setFromEuler(this.diceEuler(values[i]));
        const p0 = die.position.clone();
        return this.tween(700, (e) => {
          die.position.x = p0.x + (end[i].x - p0.x) * e;
          die.position.z = p0.z + (end[i].z - p0.z) * e;
          die.position.y = p0.y + (end[i].y - p0.y) * e + Math.sin(Math.PI * e) * 0.55;
          die.quaternion.slerpQuaternions(q0, q1, Math.min(1, e * 1.18));
          die.userData.edges.position.copy(die.position);
          die.userData.edges.quaternion.copy(die.quaternion);
        }, easeOutCubic);
      }),
    );

    this.dice.forEach((die, i) => {
      die.position.copy(end[i]);
      die.quaternion.setFromEuler(this.diceEuler(values[i]));
      die.userData.edges.position.copy(die.position);
      die.userData.edges.quaternion.copy(die.quaternion);
    });
    this.pulseAt(0, 3.28, 0xf6d08a, 1.8);
  }

  showDice(show) {
    this.diceGroup.visible = show;
  }

  /* ── 每幀更新 ───────────────────────────────────────────── */
  animate = () => {
    requestAnimationFrame(this.animate);
    const raw = Math.min(this.clock.getDelta(), 0.5);
    const dt = Math.min(raw, 0.05);
    this.time += dt;
    this.frames = (this.frames || 0) + 1;

    // tweens (用真實時間推進，低幀率時仍保持節奏)
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += raw * 1000;
      const progress = Math.min(1, tw.t / tw.duration);
      tw.update(tw.ease(progress), progress);
      if (progress >= 1) {
        this.tweens.splice(i, 1);
        tw.resolve();
      }
    }

    // 漂浮列車（全息）
    this.holoTrains.forEach(({ mesh, curve, offset, speed }) => {
      const t = (this.time * speed + offset) % 1;
      const pos = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      mesh.position.copy(pos);
      mesh.rotation.y = Math.atan2(tan.x, tan.z);
    });

    // 環繞列車
    this.monoTrains.forEach(({ group, curve, offset, speed }) => {
      const t = (this.time * speed + offset) % 1;
      const pos = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      group.position.copy(pos);
      group.rotation.y = Math.atan2(tan.x, tan.z) - Math.PI / 2;
      group.position.y = 0.55 + Math.sin(this.time * 1.4 + offset * 9) * 0.012;
    });

    // 光環旋轉
    if (this.holoRing) this.holoRing.rotation.z += dt * 0.12;

    // 棋子光環呼吸
    this.tokens.forEach((token, i) => {
      const body = token.userData.body;
      if (body) {
        const active = i === this.activeToken;
        body.position.y = Math.sin(this.time * 2.2 + i * 1.7) * 0.008 + (active ? 0.004 : 0);
        body.rotation.y = Math.sin(this.time * 1.3 + i) * 0.04;
      }
      const halo = token.userData.halo;
      if (!halo.material) return;
      const active = i === this.activeToken;
      const k = active ? 1 + Math.sin(this.time * 3.2) * 0.09 : 1;
      halo.scale.setScalar(k);
      halo.rotation.z += dt * (active ? 0.9 : 0.2);
    });

    // 落點環
    if (this.landRing.visible) {
      this.landRingTimer = (this.landRingTimer || 0) + dt;
      const p = 0.85 + Math.sin(this.time * 3) * 0.13;
      this.landRing.material.opacity = p;
      this.landRing.rotation.z += dt * 0.4;
    }

    // 懸停格微光
    this.tileObjects.forEach((t, i) => {
      const target = i === this.hovered ? 0.72 : 0.3;
      t.topMat.emissiveIntensity += (target - t.topMat.emissiveIntensity) * Math.min(1, dt * 10);
    });

    // 粒子上升
    if (this.particles) {
      const pos = this.particles.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + dt * 0.14;
        if (y > 9) y = -0.4;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      this.particles.rotation.y += dt * 0.01;
    }

    this.updateCamera(dt);
    this.composer.render();
  };
}
