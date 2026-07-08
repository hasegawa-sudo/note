/* ================================================================
   BANSO Note — Web プロトタイプ
   仕様書(SPEC)の Phase 1〜3 相当をブラウザで体験できる形に実装
================================================================ */
const $ = id => document.getElementById(id);
const DPR = Math.min(window.devicePixelRatio || 1, 2);

/* ---------- 状態 ---------- */
let DB = { notes: [], board: { strokes: [] } };
let current = null;            // 編集中ノート
let pageIndex = 0;             // 現在のページ番号(0始まり)
let page = null;               // 現在ページ(current.pages[pageIndex])
let tool = 'pen';              // pen | eraser | marker | lasso | text | sticky-place
let penKind = 'ball';          // ball | pencil
let penWidth = 2.5;
let penColor = '#23303D';
let markerWidth = 8;           // マーカーは太さ・色を独立して保持
let markerColor = '#FFE066';
let rulerOn = false;
let pendingStickyColor = null;
let undoStack = [], redoStack = [];
let saveTimer = null;

const STICKY_COLORS = ['#FFE58A','#FFC2CE','#BBDDF5','#C6EBC5','#FFD3A8','#DCC9F0','#F4F1EA'];
const PEN_COLORS = ['#23303D','#D64545','#2E6FD8','#2F9E5F','#E88A00','#8A4FD3','#888F98'];
const MARKER_COLORS = ['#FFE066','#FFC2D1','#B8E986','#8FD9F2','#FFB86C','#C9A7F5','#FF9AA2'];
/* 配色パレット(ペン/マーカー共通で選べる) */
const COLOR_PALETTES = {
  'スタンダード': null, // ツールごとの既定色(PEN_COLORS / MARKER_COLORS)
  'パステル':   ['#F8B4C4','#FADCA8','#F9F1A5','#B8E6C1','#A8D8EA','#C3B4E6','#E8C8E8'],
  '緑系':       ['#1B4332','#2D6A4F','#40916C','#52B788','#74C69D','#95D5B2','#B7E4C7'],
  '青系':       ['#03045E','#0353A4','#0466C8','#4895EF','#4CC9F0','#90E0EF','#CAF0F8'],
  'ピンク系':   ['#590D22','#A4133C','#C9184A','#FF4D6D','#FF758F','#FF8FA3','#FFB3C1'],
  '水色と黄色': ['#023E8A','#00B4D8','#48CAE4','#90E0EF','#FFD60A','#FFC300','#FFEA00'],
  '蛍光色':     ['#FF3131','#FF9E00','#FFFF00','#39FF14','#00FFFF','#FF6EC7','#CCFF00'],
  '茶系':       ['#4A2C17','#6F4518','#8B5E34','#A47148','#BC8A5F','#D4A276','#E7BC91'],
  'モノトーン': ['#000000','#333333','#555555','#777777','#999999','#BBBBBB','#DDDDDD'],
};
let penPalette = 'スタンダード', markerPalette = 'スタンダード';
const TEMPLATES = [
  {key:'grid',  name:'方眼紙'},
  {key:'dot',   name:'ドット調'},
  {key:'lines', name:'横線'},
  {key:'vertical', name:'縦書き罫線'},
  {key:'blank', name:'無地'},
  {key:'todo',  name:'ToDoリスト'},
  {key:'ring',  name:'リング(無地)'},
  {key:'ring-lined', name:'リング(罫線)'},
  {key:'vocab', name:'単語帳'},
];
/* ノートの表紙(カバー): 柄 × 色 で自由に選べる */
const COVER_PATTERNS = [
  {key:'standard', name:'スタンダード'},
  {key:'dot',      name:'ドット'},
  {key:'gingham',  name:'ギンガム'},
  {key:'star',     name:'スター'},
  {key:'heart',    name:'ハート'},
  {key:'wave',     name:'ウェーブ'},
  {key:'check',    name:'細チェック'},
];
const COVER_COLORS = [
  '#3A3A3C', // スミ黒
  '#F4B8C6', // ピンク
  '#F58BA8', // ローズ
  '#F5A6A6', // コーラル
  '#F6C89A', // ピーチ
  '#F3DE8A', // イエロー
  '#A9D8B8', // ミント
  '#8FB9AA', // スモークグリーン
  '#9FC7E8', // ブルー
  '#AEB9DC', // くすみブルー
  '#C3B1E1', // ラベンダー
  '#D8C3A5', // ラテ
  '#EDE3D3', // クリーム
];
/* 表紙向けのトレンド配色(白い柄が映えるよう調整) */
const COVER_EXTRA_PALETTES = {
  'くすみ(ダスティ)':   ['#C9A9A6','#B7C4A0','#D9B08C','#A7BBC7','#C7B2C9','#D6C39A','#9DA9A0'],
  'ニュアンスベージュ': ['#E8DFD3','#D8C7B0','#C9B79C','#BBA987','#B0A48F','#DBCBB4','#9E8E78'],
  'レトロ/ヴィンテージ':['#D98E5A','#C7602C','#9C8A3C','#5E7A6B','#C24E4E','#E5C07B','#7A5C3E'],
  'サンセット':         ['#F7B267','#F79D65','#F4845F','#F27059','#EE6C4D','#F6BD60','#FF9AA2'],
  'オーシャン':         ['#0A4D68','#088395','#22B4C9','#5AB9D9','#7DCFB6','#3AA896','#A7E8D8'],
  'さくら/春':          ['#F7CAD0','#FBBFC9','#FBC4AB','#E8C8D8','#CDE7B0','#B8E0D2','#F6E1B0'],
  '韓国カフェ':         ['#EBE3D5','#D6C7B0','#B9A48C','#8C7A6B','#A3B18A','#C4B7A6','#7C8C7A'],
  '和モダン':           ['#8C4B4B','#3F5E5A','#B58B4C','#6B4C6B','#4A5D6B','#A65A4A','#7C8C5A'],
  'キャンディポップ':   ['#FF8FAB','#FFB3C6','#FFC49B','#FDE074','#9BE6C1','#8FD3F2','#C9A7F5'],
  // キャラクターテーマ
  'エンジェル':         ['#FFFFFF','#EAF6FD','#D3ECF9','#BFE3F5','#A9D8F0','#8FCDEC','#CDE9F7'], // 水色と白
  'デビル':             ['#1C1C1E','#2B2130','#4A2338','#8E2A4E','#E8467F','#FF7AA8','#3A2A33'], // ピンクと黒
  'わん':               ['#F5ECD8','#E3B778','#C98A4B','#8B5E3C','#5A3C28','#3A2B22','#D89A9A'], // 犬の毛色＋肉球
  'ねこ':               ['#F2E6D0','#E8965A','#9AA0A6','#6E5844','#2E2A28','#C9B79C','#F4A9B8'], // 猫の毛色＋肉球ピンク
};
/* 表紙用の新パレットを、ペン/マーカー/ブラインドの配色パレットにも反映(共有) */
Object.assign(COLOR_PALETTES, COVER_EXTRA_PALETTES);
/* 表紙の配色パレット: 「おすすめ」＋ 表紙向けトレンド配色 ＋ ペンツールの COLOR_PALETTES を流用 */
const COVER_PALETTES = { 'おすすめ': COVER_COLORS, ...COVER_EXTRA_PALETTES, ...COLOR_PALETTES };
/* パレット名 → 色配列(スタンダードは null なので PEN_COLORS を使う) */
function coverPaletteColors(name){ return COVER_PALETTES[name] || PEN_COLORS; }
let coverPalette = 'おすすめ';
const PAGE_W = 840, PAGE_H = 1120; // 論理キャンバスサイズ(A4比率)
const LIP_H = 150;                 // 付箋がノートエリア上にはみ出す高さ(大きめ)
let CANVAS_W = PAGE_W;             // 描画キャンバス幅(見開き時は2ページ+綴じ)
const GUTTER = 30;                 // 見開きの綴じ幅
let spreadMode = false;            // 横長ワイド画面で見開き2ページ表示
let visPages = [];                 // 表示中のページindex配列
let pageOffsets = {};              // pageIndex -> キャンバス内xオフセット
let pageOffset = 0;                // 現在の編集対象ページのオフセット
const CANVAS_H = PAGE_H + LIP_H;   // 描画キャンバス総高(付箋つまみ + ページ)
const TOP = LIP_H;                 // ページ本体の上端Y(つまみ分ずらす)

/* ---------- 保存 / 読み込み ---------- */
async function load(){
  try{
    const r = await window.storage.get('banso-data');
    if(r && r.value) DB = JSON.parse(r.value);
  }catch(e){ /* 初回はキーなし */ }
}
function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 800); // デバウンス自動保存
}
async function saveNow(){
  try{ await window.storage.set('banso-data', JSON.stringify(DB)); }
  catch(e){ toast('保存に失敗しました'); }
}

function toast(msg){
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), 1800);
}
const uid = () => Math.random().toString(36).slice(2,10);

/* ================================================================
   描画プリミティブ(ペン質感)
================================================================ */
/* マーカーは文字(ペン)の下のレイヤーに描く。
   1パス目: マーカー(+消しゴム)、2パス目: ペン類(+消しゴム)。
   消しゴムは両パスに効かせることで、どちらの層も時系列どおり消える */
function drawStrokesLayered(ctx, strokes){
  for(const s of strokes) if(s.tool==='marker' || s.tool==='eraser') drawStroke(ctx, s);
  for(const s of strokes) if(s.tool!=='marker') drawStroke(ctx, s);
}
function drawStroke(ctx, s){
  const pts = s.points;
  if(!pts || pts.length < 2) { if(pts && pts.length===1) dot(ctx,s); return; }
  ctx.save();
  if(s.tool === 'eraser'){
    ctx.globalCompositeOperation = 'destination-out';
    line(ctx, pts, s.width*5, '#000', 1);
  } else if(s.tool === 'marker'){
    ctx.globalAlpha = .38;
    ctx.lineCap = 'butt';
    line(ctx, pts, s.width*4.5, s.color, .38, 'butt');
  } else if(s.tool === 'chalk'){
    chalkLine(ctx, pts, s.width, s.color);
  } else if(s.kind === 'pencil'){
    pencilLine(ctx, pts, s.width, s.color);
  } else if(s.kind === 'fountain'){
    variableLine(ctx, pts, s.width*1.35, s.color, 55, 0.34);
  } else if(s.kind === 'brush'){
    variableLine(ctx, pts, s.width*2.4, s.color, 42, 0.12);
  } else if(s.kind === 'neon'){
    neonLine(ctx, pts, s.width, s.color);
  } else {
    line(ctx, pts, s.width, s.color, 1);
  }
  ctx.restore();
}
/* 万年筆・筆: 書く速さ(点の間隔)で太さが変わる可変線。端は先すぼまり */
function variableLine(ctx, pts, w, color, taper, minR){
  ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const n = pts.length;
  for(let i=1;i<n;i++){
    const [px,py] = pts[i-1], [x,y] = pts[i];
    const d = Math.hypot(x-px, y-py);
    let ww = w * Math.max(minR, 1 - d/taper);   // 速い(間隔広い)ほど細く
    const ends = Math.min(i, n-1-i);
    const ef = Math.min(1, ends/6);             // 描き始め・終わりを細く
    ww *= (minR + (1-minR)*ef);
    ctx.lineWidth = Math.max(0.6, ww);
    ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(x,y); ctx.stroke();
  }
}
/* ネオン: 色のグロー＋白いコアで発光しているように */
function neonLine(ctx, pts, w, color){
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = Math.max(6, w*3);
  line(ctx, pts, w*1.1, color, 1);
  ctx.shadowBlur = Math.max(3, w*1.5);
  line(ctx, pts, Math.max(0.8, w*0.5), '#ffffff', 0.9);
  ctx.restore();
}
function line(ctx, pts, w, color, alpha=1, cap='round'){
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.lineCap = cap; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for(let i=1;i<pts.length;i++){
    const [x,y] = pts[i], [px,py] = pts[i-1];
    ctx.quadraticCurveTo(px, py, (px+x)/2, (py+y)/2);
  }
  ctx.stroke();
}
function dot(ctx, s){
  ctx.save();
  if(s.tool==='eraser') ctx.globalCompositeOperation='destination-out';
  ctx.fillStyle = s.color || '#000';
  ctx.beginPath(); ctx.arc(s.points[0][0], s.points[0][1], (s.width||2)/1.6, 0, 7);
  ctx.fill(); ctx.restore();
}
/* えんぴつ質感: 細い線を揺らして重ねる */
function pencilLine(ctx, pts, w, color){
  ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle=color;
  for(let pass=0; pass<3; pass++){
    ctx.globalAlpha = .22 + pass*.08;
    ctx.lineWidth = Math.max(.5, w*(0.55 - pass*0.12));
    ctx.beginPath();
    for(let i=0;i<pts.length;i++){
      const j = ((pts[i][0]*13 + pts[i][1]*7 + pass*31) % 10) / 10; // 疑似乱数で揺らぎ
      const x = pts[i][0] + (j-.5)*w*.9;
      const y = pts[i][1] + (((j*7)%1)-.5)*w*.9;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
/* チョーク質感 */
function chalkLine(ctx, pts, w, color){
  ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle=color;
  for(let pass=0; pass<2; pass++){
    ctx.globalAlpha = .5 - pass*.2;
    ctx.lineWidth = w*(1 - pass*.35);
    ctx.beginPath();
    for(let i=0;i<pts.length;i++){
      const j = ((pts[i][0]*17 + pts[i][1]*11 + pass*53) % 10)/10;
      const x = pts[i][0] + (j-.5)*2.4, y = pts[i][1] + (((j*3)%1)-.5)*2.4;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  /* 粉のかすれ */
  ctx.globalAlpha = .25; ctx.fillStyle = color;
  for(let i=0;i<pts.length;i+=3){
    const j = ((pts[i][0]*29+pts[i][1]*19)%10)/10;
    ctx.fillRect(pts[i][0]+(j-.5)*w*2, pts[i][1]+(((j*7)%1)-.5)*w*2, 1.2, 1.2);
  }
  ctx.globalAlpha = 1;
}

/* ================================================================
   テンプレート背景
================================================================ */
function drawTemplate(ctx, key, w, h){
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle = 'rgba(199,217,234,.75)'; ctx.lineWidth = 1;

  if(key==='grid'){
    for(let x=0;x<=w;x+=28){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke(); }
    for(let y=0;y<=h;y+=28){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke(); }
  }

  // ドット調: 格子の交点に薄いドット
  if(key==='dot'){
    const gap = 28;
    ctx.fillStyle = 'rgba(150,175,200,.6)';
    for(let x=gap;x<w;x+=gap){
      for(let y=gap;y<h;y+=gap){
        ctx.beginPath();ctx.arc(x,y,1.6,0,7);ctx.fill();
      }
    }
  }

  // 横線ノート: 縦幅を広めに(56px)
  if(key==='lines'){
    const gap = 56;
    for(let y=80;y<h;y+=gap){ ctx.beginPath();ctx.moveTo(24,y);ctx.lineTo(w-24,y);ctx.stroke(); }
    ctx.strokeStyle = 'rgba(232,140,140,.7)';
    ctx.beginPath();ctx.moveTo(72,0);ctx.lineTo(72,h);ctx.stroke();
  }

  // 縦書き罫線: 縦線で区切り、右から左へ書き進める
  if(key==='vertical'){
    const gap = 56;
    const top = 60, bottom = h-60;
    ctx.strokeStyle = 'rgba(199,217,234,.85)'; ctx.lineWidth = 1;
    for(let x=w-40; x>40; x-=gap){
      ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();
    }
    // 上下の余白ライン(赤)
    ctx.strokeStyle = 'rgba(232,140,140,.6)'; ctx.lineWidth = 1.2;
    ctx.beginPath();ctx.moveTo(40,top);ctx.lineTo(w-40,top);ctx.stroke();
    ctx.beginPath();ctx.moveTo(40,bottom);ctx.lineTo(w-40,bottom);ctx.stroke();
  }

  // ToDoリスト: 約10項目、行間を広く
  if(key==='todo'){
    const items = 10;
    const top = 96, bottom = h-60;
    const gap = (bottom - top) / (items - 1);
    const box = 30;
    for(let i=0;i<items;i++){
      const y = top + i*gap;   // 行の基準線(中央)
      // 罫線
      ctx.strokeStyle = 'rgba(199,217,234,.75)'; ctx.lineWidth = 1;
      ctx.beginPath();ctx.moveTo(96,y+16);ctx.lineTo(w-24,y+16);ctx.stroke();
      // チェックボックス
      ctx.strokeStyle = 'rgba(91,107,123,.6)'; ctx.lineWidth = 1.8;
      roundRect(ctx, 44, y-box/2+8, box, box, 6); ctx.stroke();
    }
  }

  // リングノート(無地 / 罫線)
  if(key==='ring' || key==='ring-lined'){
    if(key==='ring-lined'){
      // リング装飾を避けて左マージン(x=80)から罫線
      const gap = 56;
      ctx.strokeStyle = 'rgba(199,217,234,.75)'; ctx.lineWidth = 1;
      for(let y=80;y<h;y+=gap){ ctx.beginPath();ctx.moveTo(80,y);ctx.lineTo(w-24,y);ctx.stroke(); }
    }
    drawRings(ctx, h);
  }

  // 単語帳: 左=単語 / 右=意味 の2列 + 行区切り
  if(key==='vocab'){
    const top = 100, rowH = 92;
    const divX = w*0.36; // 列の区切り位置
    // 見出し
    ctx.fillStyle = 'rgba(91,107,123,.55)';
    ctx.font = "700 20px 'Zen Maru Gothic', sans-serif";
    ctx.textAlign='center';
    ctx.fillText('単語', divX/2, top-32);
    ctx.fillText('意味・訳', divX+(w-24-divX)/2, top-32);
    ctx.textAlign='left';
    // 外枠
    ctx.strokeStyle = 'rgba(91,107,123,.5)'; ctx.lineWidth = 1.6;
    ctx.strokeRect(24, top-60, w-48, Math.floor((h-top-20)/rowH)*rowH + 60);
    // 行区切り
    ctx.strokeStyle = 'rgba(199,217,234,.9)'; ctx.lineWidth = 1;
    for(let y=top; y<h-40; y+=rowH){
      ctx.beginPath();ctx.moveTo(24,y);ctx.lineTo(w-24,y);ctx.stroke();
    }
    // 列の区切り(赤の縦線)
    ctx.strokeStyle = 'rgba(232,140,140,.85)'; ctx.lineWidth = 1.5;
    ctx.beginPath();ctx.moveTo(divX, top-60);ctx.lineTo(divX, top-60 + Math.floor((h-top-20)/rowH)*rowH + 60);ctx.stroke();
  }
}
// 角丸矩形パス
function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
// リングノートの綴じリング装飾
function drawRings(ctx, h){
  for(let y=40;y<h;y+=56){
    ctx.fillStyle='#E7ECF1';
    ctx.beginPath();ctx.arc(28,y,7,0,7);ctx.fill();
    ctx.strokeStyle='#9AA7B4';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(22,y-3,10,-2.4,1.2);ctx.stroke();
  }
}

/* ================================================================
   ノートの表紙(カバー)描画
================================================================ */
/* hex色を明るく(amt>0)/暗く(amt<0)する。amtは-1〜1(倍率)。表紙描画用。
   ※付箋用の shade(RGB加算版)とは別物なので名前を分けている */
function tint(hex, amt){
  const n = parseInt(hex.slice(1),16);
  let r=(n>>16)&255, g=(n>>8)&255, b=n&255;
  const t = amt<0 ? 0 : 255, p = Math.abs(amt);
  r=Math.round((t-r)*p)+r; g=Math.round((t-g)*p)+g; b=Math.round((t-b)*p)+b;
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
const DEFAULT_COVER = () => ({ pattern:'standard', color:COVER_COLORS[0] });

/* 星(5芒)を1つ描く */
function drawStar(ctx, cx, cy, rad){
  ctx.beginPath();
  for(let i=0;i<5;i++){
    const a = -Math.PI/2 + i*2*Math.PI/5;
    ctx.lineTo(cx+Math.cos(a)*rad, cy+Math.sin(a)*rad);
    const b = a + Math.PI/5;
    ctx.lineTo(cx+Math.cos(b)*rad*0.45, cy+Math.sin(b)*rad*0.45);
  }
  ctx.closePath(); ctx.fill();
}
/* ハートを1つ描く */
function drawHeart(ctx, cx, cy, s){
  ctx.beginPath();
  ctx.moveTo(cx, cy+s*0.3);
  ctx.bezierCurveTo(cx+s, cy-s*0.5, cx+s*0.5, cy-s, cx, cy-s*0.35);
  ctx.bezierCurveTo(cx-s*0.5, cy-s, cx-s, cy-s*0.5, cx, cy+s*0.3);
  ctx.closePath(); ctx.fill();
}

/* カバー全体を描く。cover={pattern,color}, title は中央ラベルに載せる */
function drawCover(ctx, cover, w, h, title){
  cover = cover || DEFAULT_COVER();
  const base = cover.color || COVER_COLORS[0];
  ctx.clearRect(0,0,w,h);
  // 下地(縦グラデで少し立体感)
  const g = ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0, shade(base, 0.10));
  g.addColorStop(1, shade(base,-0.12));
  ctx.fillStyle = g; ctx.fillRect(0,0,w,h);

  // 柄
  if(cover.pattern==='dot'){
    // トレンドの白い水玉(小さめ・はっきり見えるよう白＋うっすら陰影)
    const gap = w/9, r = gap*0.11;
    const put = (col, dy)=>{
      ctx.fillStyle = col;
      for(let iy=0, y=gap*0.7; y<h; y+=gap, iy++){
        const x0 = iy%2 ? gap*0.7 + gap/2 : gap*0.7;
        for(let x=x0; x<w; x+=gap){ ctx.beginPath(); ctx.arc(x, y+dy, r, 0, 7); ctx.fill(); }
      }
    };
    put(shade(base,-0.26), r*0.18);         // 下地の陰
    put('rgba(255,255,255,0.92)', 0);       // 白い水玉本体
  } else if(cover.pattern==='gingham'){
    // ギンガムチェック(白い帯が縦横に重なり、交点がいちばん白い)
    const s = w/12;
    ctx.save();
    ctx.globalAlpha = 0.55; ctx.fillStyle = '#ffffff';
    for(let x=0; x<w; x+=s*2) ctx.fillRect(x,0,s,h);
    for(let y=0; y<h; y+=s*2) ctx.fillRect(0,y,w,s);
    ctx.restore();
  } else if(cover.pattern==='star'){
    // 白い星を散りばめ
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    const g = w/5, rad = g*0.2;
    for(let iy=0, y=g*0.6; y<h; y+=g, iy++){
      const x0 = iy%2 ? g : g*0.5;
      for(let x=x0; x<w; x+=g) drawStar(ctx, x, y, rad);
    }
  } else if(cover.pattern==='heart'){
    // 白い小さめハート
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    const g = w/5.5, s = g*0.2;
    for(let iy=0, y=g*0.6; y<h; y+=g, iy++){
      const x0 = iy%2 ? g : g*0.5;
      for(let x=x0; x<w; x+=g) drawHeart(ctx, x, y, s);
    }
  } else if(cover.pattern==='wave'){
    // レトロ可愛い波線
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = w*0.022;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const amp = h*0.018, per = w*0.28;
    for(let y=h*0.08; y<h; y+=h*0.09){
      ctx.beginPath();
      for(let x=0; x<=w; x+=4){
        const yy = y + Math.sin(x/per*Math.PI*2)*amp;
        x===0 ? ctx.moveTo(x,yy) : ctx.lineTo(x,yy);
      }
      ctx.stroke();
    }
  } else if(cover.pattern==='check'){
    // 細チェック(白い格子線)
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = Math.max(1, w*0.012);
    const s = w/6;
    for(let x=0; x<=w; x+=s){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
    for(let y=0; y<h; y+=s){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
  } else {
    // standard: クラシックなノート表紙(上部に帯 + 白線)
    ctx.fillStyle = shade(base,-0.14);
    ctx.fillRect(0, h*0.11, w, h*0.05);
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = Math.max(1, w*0.006);
    for(const yy of [h*0.10, h*0.17]){
      ctx.beginPath(); ctx.moveTo(0,yy); ctx.lineTo(w,yy); ctx.stroke();
    }
  }

  // 綴じ(左端の縦帯)
  ctx.fillStyle = shade(base,-0.22);
  ctx.fillRect(0,0, w*0.055, h);
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.fillRect(w*0.055, 0, w*0.012, h);

  // 中央のタイトルラベル(白いシール)
  drawCoverLabel(ctx, w, h, title, base);
}

function drawCoverLabel(ctx, w, h, title, base){
  const lw = w*0.72, lh = h*0.26, lx = (w-lw)/2, ly = h*0.4;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.16)';
  ctx.shadowBlur = w*0.035; ctx.shadowOffsetY = w*0.012;
  ctx.fillStyle = '#fff';
  roundRect(ctx, lx, ly, lw, lh, w*0.03); ctx.fill();
  ctx.restore();
  // 内側の細枠
  ctx.strokeStyle = shade(base,-0.18); ctx.lineWidth = Math.max(1, w*0.005);
  roundRect(ctx, lx+w*0.028, ly+w*0.028, lw-w*0.056, lh-w*0.056, w*0.02); ctx.stroke();
  // タイトル(最大2行で折り返し・省略)
  ctx.fillStyle = '#3A4A5A';
  ctx.font = `700 ${Math.round(w*0.072)}px 'Zen Maru Gothic', sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = wrapCoverText(ctx, title || '無題のノート', lw - w*0.13, 2);
  const lineH = w*0.092;
  const startY = ly + lh/2 - (lines.length-1)*lineH/2;
  lines.forEach((ln,i)=> ctx.fillText(ln, w/2, startY + i*lineH));
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

/* テキストを maxW 幅・maxLines 行に収める(あふれは…) */
function wrapCoverText(ctx, text, maxW, maxLines){
  const lines = []; let cur = '';
  for(const ch of text){
    if(ctx.measureText(cur+ch).width > maxW && cur){
      lines.push(cur); cur = ch;
      if(lines.length === maxLines-1) break;
    } else cur += ch;
  }
  // 残り
  let rest = text.slice(lines.join('').length);
  if(lines.length < maxLines){
    if(ctx.measureText(rest).width <= maxW){ lines.push(rest); rest=''; }
    else {
      let s='';
      for(const ch of rest){
        if(ctx.measureText(s+ch+'…').width > maxW){ break; }
        s += ch;
      }
      lines.push(s + (s.length < rest.length ? '…' : ''));
    }
  }
  return lines.length ? lines : [''];
}

/* カバーのサムネ(dataURL)を生成・キャッシュ */
function makeCover(n){
  if(!n.cover) n.cover = DEFAULT_COVER();
  const c = document.createElement('canvas'); c.width=300; c.height=400;
  drawCover(c.getContext('2d'), n.cover, 300, 400, n.title);
  n.coverThumb = c.toDataURL('image/png');
  return n.coverThumb;
}

/* ================================================================
   ホーム画面
================================================================ */
function renderHome(){
  const grid = $('noteGrid');
  grid.innerHTML = '';
  if(DB.notes.length === 0){
    grid.innerHTML = `<div class="empty-note">まだノートがありません。<br>「＋ 新しいノート」から作ってみよう ✎</div>`;
  }
  const sorted = [...DB.notes].sort((a,b)=>(a.order??0)-(b.order??0));
  if(sorted.length >= 2){
    const hint = document.createElement('div'); hint.className='note-hint';
    hint.textContent = '長押しでドラッグして並べ替え・🎨で表紙を変更';
    grid.append(hint);
  }
  for(const n of sorted){
    const wrap = document.createElement('div'); wrap.className='card-wrap';
    wrap.dataset.id = n.id;
    const card = document.createElement('button'); card.className='note-card';
    const img = document.createElement('img'); img.className='thumb';
    img.src = coverImageFor(n); img.alt='';
    const meta = document.createElement('div'); meta.className='meta';
    const d = new Date(n.updatedAt);
    meta.innerHTML = `<div class="name">${esc(n.title||'無題のノート')}</div>
      <div class="date">${TEMPLATES.find(t=>t.key===n.template)?.name||''} ・ ${d.getMonth()+1}/${d.getDate()} 更新</div>`;
    card.append(img, meta);
    card.onclick = ()=>{ if(reorder.moved) return; openNote(n.id); };
    // 表紙を編集(左上の🎨)
    const cov = document.createElement('button'); cov.className='cover-edit'; cov.textContent='🎨';
    cov.setAttribute('aria-label','表紙を編集');
    cov.onclick = (e)=>{ e.stopPropagation(); openCoverSheet(n.id); };
    const del = document.createElement('button'); del.className='del'; del.textContent='×';
    del.setAttribute('aria-label','ノートを削除');
    del.onclick = (e)=>{ e.stopPropagation();
      if(confirm(`「${n.title||'無題のノート'}」を削除しますか?`)){
        DB.notes = DB.notes.filter(x=>x.id!==n.id); scheduleSave(); renderHome();
      }};
    wrap.append(card, del, cov);
    grid.append(wrap);
  }
  renderBoardThumb();
}
function esc(s){ return s.replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* 1ページ目の内容を任意サイズの ctx に描く(サムネ・ページ表紙で共用) */
function drawFirstPage(ctx, n, w, h){
  migrate(n);
  const p = n.pages[0];
  ctx.save();
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h);
  // 付箋つまみ(上)〜ページ全体(CANVAS_H)が収まるスケール。幅にも収める
  const sc = Math.min(w/PAGE_W, h/CANVAS_H);
  ctx.translate((w - PAGE_W*sc)/2, 0);
  ctx.scale(sc, sc);
  ctx.translate(0, TOP); // つまみ分を下げてページ本体を表示
  drawTemplate(ctx, n.template, PAGE_W, PAGE_H);
  drawMidItems(ctx, p);
  drawStrokesLayered(ctx, p.strokes);
  drawStickies(ctx, n, 0); // 1ページ目基準で付箋
  ctx.restore();
}

function makeThumb(n){
  const c = document.createElement('canvas'); c.width=210; c.height=280;
  drawFirstPage(c.getContext('2d'), n, 210, 280);
  n.thumb = c.toDataURL('image/png');
  return n.thumb;
}

/* ホームのカードに出す表紙画像。coverMode==='page1' なら1ページ目を表紙代わりに */
function coverImageFor(n){
  if(n.coverMode === 'page1'){
    const c = document.createElement('canvas'); c.width=300; c.height=400;
    drawFirstPage(c.getContext('2d'), n, 300, 400);
    return c.toDataURL('image/png');
  }
  return n.coverThumb || makeCover(n);
}

/* テンプレ選択シート */
function buildTplSheet(){
  const g = $('tplGrid');
  for(const t of TEMPLATES){
    const b = document.createElement('button'); b.className='tpl-btn';
    const pc = document.createElement('canvas'); pc.className='prev'; pc.width=90; pc.height=120;
    const ctx = pc.getContext('2d');
    ctx.scale(90/PAGE_W, 120/PAGE_H);
    drawTemplate(ctx, t.key, PAGE_W, PAGE_H);
    b.append(pc, Object.assign(document.createElement('span'),{className:'nm',textContent:t.name}));
    b.onclick = ()=>{ closeSheet(); createNote(t.key); };
    g.append(b);
  }
}
function openSheet(){ $('sheetBg').classList.add('open'); $('tplSheet').classList.add('open'); }
function closeSheet(){ $('sheetBg').classList.remove('open'); $('tplSheet').classList.remove('open'); }
$('fabNew').onclick = openSheet;
$('sheetBg').onclick = closeSheet;

function blankPage(){
  return { id: uid(), strokes: [], texts: [], images: [], shapes: [], blinds: [] };
}
/* 見開き2ページ表示になる画面幅か(layoutCanvas と同じ判定を wrap 無しで) */
function isSpreadLayout(){
  return window.innerWidth >= 880 && window.innerWidth > window.innerHeight * 0.9;
}
function createNote(tpl){
  // タブレット等の見開き表示では最初から2ページ用意する
  const pages = isSpreadLayout() ? [ blankPage(), blankPage() ] : [ blankPage() ];
  const minOrder = DB.notes.reduce((m,x)=>Math.min(m, x.order??0), 0);
  const n = {
    id: uid(), title: '', template: tpl,
    pages,                    // 複数ページ
    stickies: [],             // 付箋はノート全体で共有(全ページに貫通)
    // 表紙(カバー): 作成時は柄と色をローテーションして見分けやすく
    cover: {
      pattern: COVER_PATTERNS[DB.notes.length % COVER_PATTERNS.length].key,
      color:   COVER_COLORS[(DB.notes.length*3) % COVER_COLORS.length],
    },
    order: minOrder - 1,      // 先頭(左上)に表示
    createdAt: Date.now(), updatedAt: Date.now(), thumb: null, coverThumb: null
  };
  DB.notes.push(n); scheduleSave();
  openNote(n.id);
}
/* 旧形式(1ノート=1ページ)を新形式へ移行 */
function migrate(n){
  if(!n.pages){
    n.pages = [{ id: uid(), strokes: n.strokes||[], texts: n.texts||[], images: n.images||[], shapes: [] }];
    delete n.strokes; delete n.texts; delete n.images;
  }
  if(!n.stickies) n.stickies = [];
  if(!n.cover) n.cover = DEFAULT_COVER();
  if(n.cover.pattern === 'trend') n.cover.pattern = 'gingham'; // 旧「トレンド」を改名
  if(n.cover.pattern === 'floral') n.cover.pattern = 'dot';    // 小花柄は廃止→ドットへ
  n.pages.forEach(p=>{ p.strokes||=[]; p.texts||=[]; p.images||=[]; p.shapes||=[]; p.blinds||=[]; });
  // 付箋: 旧(縦タブ y/h/tabW)→新(上端タブ x/page)へ移行
  n.stickies.forEach((s,i)=>{
    if(s.page===undefined) s.page = 0;            // 旧付箋は1ページ目に紐付け
    if(s.x===undefined) s.x = 24 + i*(132+10);    // 横位置を割り振る
    delete s.y; delete s.h; delete s.tabW;
    if(!s.strokes) s.strokes = [];
  });
  return n;
}

/* ================================================================
   エディタ
================================================================ */
const bgC = $('bgCanvas'), midC = $('midCanvas'), inkC = $('inkCanvas');
const bgX = bgC.getContext('2d'), midX = midC.getContext('2d'), inkX = inkC.getContext('2d');
let viewScale = 1, viewX = 0, viewY = 0;
let zoom = 1, panX = 0, panY = 0;
function applyView(){
  $('canvasStack').style.transform = `translate(${panX}px,${panY}px) scale(${zoom})`;
}
let inkCache = document.createElement('canvas'); // 確定済みストロークのキャッシュ
let inkCacheX = inkCache.getContext('2d');
const imgCache = {}; // id -> Image (dataURL から復元)

function ensureImages(n, onReady){
  const list = n.images || [];
  let pending = 0;
  for(const im of list){
    if(imgCache[im.id]) continue;
    pending++;
    const img = new Image();
    img.onload = ()=>{ if(--pending<=0 && onReady) onReady(); };
    img.onerror = ()=>{ if(--pending<=0 && onReady) onReady(); };
    img.src = im.src;
    imgCache[im.id] = img;
  }
  if(pending===0 && onReady) onReady();
}

function openNote(id){
  current = DB.notes.find(n=>n.id===id);
  if(!current) return;
  migrate(current);
  showScreen('editor');
  $('edTitle').value = current.title;
  gotoPage(0, true);
}
/* ページを開く(idx: 0始まり) */
function gotoPage(idx, force){
  if(!current) return;
  idx = Math.max(0, Math.min(current.pages.length-1, idx));
  if(!force && idx===pageIndex) return;
  pageIndex = idx;
  page = current.pages[pageIndex];
  revealedBlinds = new Set(); // ブラインドは再び隠れた状態に
  undoStack = []; redoStack = []; updateUndoBtns();
  exitLasso();
  layoutCanvas();
  redrawAll();
  ensureImages(page, ()=>{ redrawMid(); });
  updatePageBar();
}
function updatePageBar(){
  const N = current.pages.length;
  if(spreadMode){
    const base = pageIndex - (pageIndex % 2);
    const right = Math.min(base+2, N);
    $('pageLabel').textContent = (base+1===right) ? `${base+1} / ${N}` : `${base+1}-${right} / ${N}`;
    $('pagePrev').disabled = base===0;
    const isEnd = base+2 > N-1;
    $('pageNext').classList.toggle('is-add', isEnd);
    $('pageNext').textContent = isEnd ? '＋' : '›';
  } else {
    $('pageLabel').textContent = `${pageIndex+1} / ${N}`;
    $('pagePrev').disabled = pageIndex===0;
    $('pageNext').classList.toggle('is-add', pageIndex===N-1);
    $('pageNext').textContent = pageIndex===N-1 ? '＋' : '›';
  }
}
function addPage(){
  snapshotNote();
  // 見開き表示では2ページずつ追加し、現在の見開みの直後に挿入する
  const count = spreadMode ? 2 : 1;
  const target = spreadMode ? (pageIndex - (pageIndex % 2)) + 2 : pageIndex + 1;
  const at = Math.min(target, current.pages.length);
  const newPages = Array.from({length:count}, ()=>blankPage());
  current.pages.splice(at, 0, ...newPages);
  touched();
  gotoPage(at, true);
  toast(count===2 ? 'ページを2枚追加しました' : `ページ ${at+1} を追加しました`);
}
function deletePage(){
  if(current.pages.length<=1){ toast('最後の1ページは削除できません'); return; }
  if(!confirm(`ページ ${pageIndex+1} を削除しますか?`)) return;
  snapshotNote();
  current.pages.splice(pageIndex,1);
  touched();
  closePagelist();
  gotoPage(Math.min(pageIndex, current.pages.length-1), true);
}
/* ページャのボタン(見開き時は2ページずつめくる) */
$('pagePrev').onclick = ()=>{
  if(spreadMode){
    const base = pageIndex - (pageIndex % 2);
    if(base>0) gotoPage(base-2, true);
  } else if(pageIndex>0) gotoPage(pageIndex-1);
};
$('pageNext').onclick = ()=>{
  const N = current.pages.length;
  if(spreadMode){
    const base = pageIndex - (pageIndex % 2);
    if(base+2 > N-1) addPage();
    else gotoPage(base+2, true);
  } else {
    if(pageIndex === N-1) addPage();  // 最終ページなら追加
    else gotoPage(pageIndex+1);
  }
};
$('pageLabel').onclick = ()=> openPagelist();  // ページ番号タップで一覧
$('pageDelete').onclick = deletePage;

/* ページ一覧シート */
function openPagelist(){
  const grid = $('plGrid'); grid.innerHTML='';
  current.pages.forEach((p, i)=>{
    const item = document.createElement('button');
    item.className = 'pl-item' + (i===pageIndex?' cur':'');
    const c = document.createElement('canvas'); c.width=180; c.height=240;
    const ctx = c.getContext('2d');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,180,240);
    const sc = Math.min(180/PAGE_W, 240/CANVAS_H);
    ctx.translate((180 - PAGE_W*sc)/2, 0);
    ctx.scale(sc, sc); ctx.translate(0, TOP);
    drawTemplate(ctx, current.template, PAGE_W, PAGE_H);
    ensureImages(p, ()=>{});
    drawMidItems(ctx, p);
    drawStrokesLayered(ctx, p.strokes);
    drawStickies(ctx, current, i); // このページ基準で付箋
    const n = document.createElement('div'); n.className='n'; n.textContent = `${i+1}`;
    item.append(c, n);
    item.onclick = ()=>{ closePagelist(); gotoPage(i); };
    grid.append(item);
  });
  const add = document.createElement('button'); add.className='pl-add'; add.textContent='＋';
  add.setAttribute('aria-label','ページを追加');
  add.onclick = ()=>{ closePagelist(); addPage(); };
  grid.append(add);
  $('pagelistBg').classList.add('open'); $('pagelist').classList.add('open');
}
function closePagelist(){ $('pagelistBg').classList.remove('open'); $('pagelist').classList.remove('open'); }
$('pagelistBg').onclick = closePagelist;
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $(id).classList.add('active');
  if(id==='home') renderHome();
}
$('btnBack').onclick = ()=>{
  commitTitle(); current.thumb = null; makeThumb(current);
  current.coverThumb = null; // タイトル変更を表紙ラベルに反映
  saveNow(); showScreen('home');
};
$('edTitle').addEventListener('change', commitTitle);
function commitTitle(){
  if(!current) return;
  current.title = $('edTitle').value.trim();
  current.updatedAt = Date.now(); scheduleSave();
}

const RES = 2; // ズームインしても粗くならないよう、常に高解像度で保持
function layoutCanvas(){
  const wrap = $('canvasWrap');
  // ワイド横長画面(iPad横など)では本物のノートのように見開き2ページ
  spreadMode = wrap.clientWidth >= 880 && wrap.clientWidth > wrap.clientHeight * 0.9;
  const base = spreadMode ? pageIndex - (pageIndex % 2) : pageIndex;
  visPages = spreadMode
    ? [base, base+1].filter(i => i < current.pages.length)
    : [pageIndex];
  CANVAS_W = spreadMode ? PAGE_W*2 + GUTTER : PAGE_W;
  pageOffsets = {};
  visPages.forEach((pi,k)=>{ pageOffsets[pi] = spreadMode ? k*(PAGE_W+GUTTER) : 0; });
  pageOffset = pageOffsets[pageIndex] ?? 0;

  const availW = wrap.clientWidth - 16, availH = wrap.clientHeight - 24;
  viewScale = Math.min(availW/CANVAS_W, availH/CANVAS_H);
  const w = CANVAS_W*viewScale, h = CANVAS_H*viewScale;
  viewX = (wrap.clientWidth - w)/2;
  viewY = Math.max((wrap.clientHeight - PAGE_H*viewScale)/2 - LIP_H*viewScale/2, 12);
  const stack = $('canvasStack');
  stack.style.left = viewX+'px'; stack.style.top = viewY+'px';
  stack.style.width = w+'px'; stack.style.height = h+'px';
  for(const c of [bgC, midC, inkC, inkCache]){
    c.width = CANVAS_W*RES; c.height = CANVAS_H*RES;
  }
  for(const c of [bgC, midC, inkC]){ c.style.width = w+'px'; c.style.height = h+'px'; }
  // コンテキストを TOP だけ下げる → ページ座標(0〜PAGE_H)はそのまま、つまみは y<0 に描く
  for(const x of [bgX, midX, inkX, inkCacheX]){
    x.setTransform(RES,0,0,RES,0,TOP*RES);
  }
  zoom = 1; panX = 0; panY = 0; applyView();
}
window.addEventListener('resize', ()=>{ if($('editor').classList.contains('active')){ layoutCanvas(); redrawAll(); } sizeBoard(); });

function redrawAll(){
  clearFull(bgX);
  for(const pi of visPages){
    const off = pageOffsets[pi];
    bgX.save(); bgX.translate(off, 0);
    // 白いノート用紙(影付き)。この外側=灰色背景に付箋がはみ出す
    bgX.shadowColor='rgba(35,48,61,.20)'; bgX.shadowBlur=14; bgX.shadowOffsetY=4;
    bgX.fillStyle='#fff'; bgX.fillRect(0,0,PAGE_W,PAGE_H);
    bgX.shadowColor='transparent';
    drawTemplate(bgX, current.template, PAGE_W, PAGE_H);
    bgX.restore();
  }
  // 見開きの綴じ目(中央の影)
  if(spreadMode && visPages.length===2){
    const gx = PAGE_W;
    const grad = bgX.createLinearGradient(gx,0,gx+GUTTER,0);
    grad.addColorStop(0,'rgba(35,48,61,.16)');
    grad.addColorStop(.5,'rgba(35,48,61,.03)');
    grad.addColorStop(1,'rgba(35,48,61,.16)');
    bgX.fillStyle = grad;
    bgX.fillRect(gx, 0, GUTTER, PAGE_H);
  }
  redrawMid();
  rebuildInkCache();
  blitInk();
}
// TOPオフセットを考慮した全面クリア
function clearFull(ctx){ ctx.clearRect(0, -TOP, CANVAS_W, CANVAS_H); }
function redrawMid(){
  clearFull(midX);
  for(const pi of visPages){
    midX.save(); midX.translate(pageOffsets[pi], 0);
    drawMidItems(midX, current.pages[pi]);
    midX.restore();
  }
  drawStickies(midX, current);
}
/* ページ固有の要素(画像・テキスト) */
function drawMidItems(ctx, p){
  // 図形スタンプ(枠・表)は最背面に
  for(const sh of (p.shapes||[])) drawShape(ctx, sh);
  for(const im of (p.images||[])){
    const img = imgCache[im.id];
    if(!img || !img.complete) continue;
    ctx.save();
    ctx.translate(im.x, im.y);
    ctx.beginPath();
    clipShape(ctx, im.w, im.h, im.shape, im.radius);
    ctx.clip();
    const s = im.crop || {x:0,y:0,w:1,h:1};
    ctx.drawImage(img, s.x*img.naturalWidth, s.y*img.naturalHeight,
      s.w*img.naturalWidth, s.h*img.naturalHeight, 0, 0, im.w, im.h);
    ctx.restore();
  }
  for(const t of (p.texts||[])) drawTextEl(ctx, t);
}
/* テキスト1件の描画(縦書き / 横書き・太字対応) */
function drawTextEl(ctx, t){
  ctx.save();
  ctx.fillStyle = t.color;
  ctx.font = `${t.weight||''} ${t.size}px ${t.font}`.trim();
  ctx.textBaseline='top';
  const lines = (t.text||'').split('\n');
  if(t.vertical){
    const colGap = t.size*1.5, charAdv = t.size*1.05;
    ctx.textAlign='center';
    lines.forEach((ln,ci)=>{
      const cx = t.x - colGap*(ci+0.5);      // 右の列から左へ
      [...ln].forEach((ch,ri)=> ctx.fillText(ch, cx, t.y + ri*charAdv));
    });
  } else {
    ctx.textAlign='left';
    lines.forEach((ln,i)=> ctx.fillText(ln, t.x, t.y + i*t.size*1.4));
  }
  ctx.restore();
}
/* テキストの外接矩形(左上/幅/高さ)。縦書きは (x,y) を右上として左へ伸びる */
function textRect(t){
  const lines = (t.text||'').split('\n');
  if(t.vertical){
    const colGap = t.size*1.5, charAdv = t.size*1.05;
    const maxChars = Math.max(1, ...lines.map(l=>[...l].length||1));
    const w = lines.length*colGap;
    const h = maxChars*charAdv;
    return { left: t.x - w, top: t.y, w, h };
  }
  const w = Math.max(...lines.map(l=>l.length))*t.size*0.6 + 10;
  const h = lines.length*t.size*1.4;
  return { left: t.x, top: t.y, w, h };
}
/* 図形スタンプの描画。kind: rect / round / table */
function drawShape(ctx, sh){
  ctx.save();
  ctx.strokeStyle = sh.color || '#3A4A5A';
  ctx.lineWidth = sh.lineWidth || 2.2;
  ctx.lineJoin = 'round';
  const {x,y,w,h} = sh;
  if(sh.kind==='rect'){
    ctx.strokeRect(x,y,w,h);
  } else if(sh.kind==='round'){
    roundRect(ctx, x, y, w, h, Math.min(sh.radius||18, w/2, h/2)); ctx.stroke();
  } else if(sh.kind==='table'){
    const rows = sh.rows||3, cols = sh.cols||3;
    ctx.strokeRect(x,y,w,h);
    ctx.lineWidth = Math.max(1, (sh.lineWidth||2.2)*0.7);
    for(let c=1;c<cols;c++){ const cx=x+w/cols*c; ctx.beginPath();ctx.moveTo(cx,y);ctx.lineTo(cx,y+h);ctx.stroke(); }
    for(let r=1;r<rows;r++){ const cy=y+h/rows*r; ctx.beginPath();ctx.moveTo(x,cy);ctx.lineTo(x+w,cy);ctx.stroke(); }
  }
  ctx.restore();
}
/* ---- 付箋(ノート全ページ共通・上端タブ形式) ----
   st = { id, page(所属ページ番号), x(横位置), colorIndex, strokes[] }
   ・所属ページ表示中: つまみ(上にはみ出す) + 本体(ページ内上部)
   ・別ページ表示中  : つまみのみ見える(タップでそのページへ)               */
const STICKY_W = 132;   // タブの幅
const STICKY_LIP = LIP_H; // ノートエリア上にはみ出す高さ(付箋の大部分)
const STICKY_BODY = 72;   // ページ内に食い込む本体の高さ(小さめ)

function drawSticky(ctx, st, viewPage){
  const vp = (viewPage===undefined) ? pageIndex : viewPage;
  const col = STICKY_COLORS[st.colorIndex];
  const x = st.x;
  const onThisPage = (st.page === vp);
  ctx.save();
  ctx.shadowColor='rgba(35,48,61,.20)'; ctx.shadowBlur=6; ctx.shadowOffsetY=2;
  // はみ出し部分(ノートエリアより上、y<0)。付箋の大部分・常に見える
  ctx.fillStyle = col;
  roundRectTop(ctx, x, -STICKY_LIP, STICKY_W, STICKY_LIP+6, 10); // 上角丸
  ctx.shadowColor='transparent';
  if(onThisPage){
    // ページに食い込む本体(少し暗くして折り返しを表現)
    ctx.fillStyle = shade(col,-14);
    ctx.fillRect(x, 0, STICKY_W, STICKY_BODY);
    // 境界の陰(ノートの縁)
    ctx.fillStyle='rgba(0,0,0,.07)';
    ctx.fillRect(x, 0, STICKY_W, 3);
  }
  ctx.restore();
  // ページ番号ラベル(はみ出し部分の上寄り)
  ctx.save();
  ctx.fillStyle = 'rgba(35,48,61,.5)';
  ctx.font = "700 13px 'Zen Maru Gothic', sans-serif";
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('P'+(st.page+1), x+STICKY_W/2, -STICKY_LIP+18);
  ctx.restore();
  // 付箋上の手書き(所属ページ表示時のみ)。はみ出し部分〜本体まで書ける
  if(onThisPage && st.strokes && st.strokes.length){
    ctx.save();
    ctx.beginPath(); ctx.rect(x, -STICKY_LIP, STICKY_W, STICKY_LIP+STICKY_BODY); ctx.clip();
    ctx.translate(x, -STICKY_LIP); // 手書きの原点を付箋の左上(はみ出し上端)に
    drawStrokesLayered(ctx, st.strokes);
    ctx.restore();
  }
}
// 上側だけ角丸の矩形
function roundRectTop(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x, y+h);
  ctx.lineTo(x, y+r); ctx.arcTo(x, y, x+r, y, r);
  ctx.lineTo(x+w-r, y); ctx.arcTo(x+w, y, x+w, y+r, r);
  ctx.lineTo(x+w, y+h); ctx.closePath(); ctx.fill();
}
// 付箋の描画先: 表示中ページの上ならそのページ、非表示ページは左端ページの上につまみ表示
function stickyHost(st){
  return (pageOffsets[st.page]!==undefined) ? st.page : visPages[0];
}
function drawStickies(ctx, n, viewPage){
  if(viewPage!==undefined){
    // サムネイル用(単一ページ・オフセット無し)
    for(const st of n.stickies) if(st.page!==viewPage) drawSticky(ctx, st, viewPage);
    for(const st of n.stickies) if(st.page===viewPage) drawSticky(ctx, st, viewPage);
    return;
  }
  // エディタ: 見開き対応。非表示(つまみのみ)→表示中(本体)の順で
  const draw = (st)=>{
    ctx.save(); ctx.translate(pageOffsets[stickyHost(st)]||0, 0);
    drawSticky(ctx, st, (pageOffsets[st.page]!==undefined) ? st.page : -1);
    ctx.restore();
  };
  for(const st of n.stickies) if(pageOffsets[st.page]===undefined) draw(st);
  for(const st of n.stickies) if(pageOffsets[st.page]!==undefined) draw(st);
}
function shade(hex, amt){
  const c = hex.replace('#',''); 
  let r=parseInt(c.slice(0,2),16), g=parseInt(c.slice(2,4),16), b=parseInt(c.slice(4,6),16);
  r=Math.max(0,Math.min(255,r+amt)); g=Math.max(0,Math.min(255,g+amt)); b=Math.max(0,Math.min(255,b+amt));
  return `rgb(${r},${g},${b})`;
}
/* 切り抜き形状のパスを引く(矩形 / 丸(楕円) / 角丸四角) */
function clipShape(ctx, w, h, shape, radius){
  if(shape==='ellipse'){
    ctx.ellipse(w/2, h/2, w/2, h/2, 0, 0, 7);
  } else if(shape==='round'){
    const r = Math.min(radius ?? Math.min(w,h)*0.18, w/2, h/2);
    ctx.moveTo(r,0); ctx.arcTo(w,0,w,h,r); ctx.arcTo(w,h,0,h,r);
    ctx.arcTo(0,h,0,0,r); ctx.arcTo(0,0,w,0,r); ctx.closePath();
  } else {
    ctx.rect(0,0,w,h);
  }
}
function rebuildInkCache(){
  inkCacheX.save();
  inkCacheX.setTransform(1,0,0,1,0,0);
  inkCacheX.clearRect(0,0,inkCache.width,inkCache.height);
  inkCacheX.restore();
  for(const pi of visPages){
    inkCacheX.save();
    inkCacheX.translate(pageOffsets[pi], 0);
    inkCacheX.beginPath(); inkCacheX.rect(-2, -TOP, PAGE_W+4, CANVAS_H); inkCacheX.clip();
    drawStrokesLayered(inkCacheX, current.pages[pi].strokes);
    inkCacheX.restore();
  }
}
function blitInk(liveStroke){
  inkX.save(); inkX.setTransform(1,0,0,1,0,0);
  inkX.clearRect(0,0,inkC.width,inkC.height);
  inkX.drawImage(inkCache,0,0);
  inkX.restore();
  if(liveStroke){
    inkX.save(); inkX.translate(pageOffset, 0);
    inkX.beginPath(); inkX.rect(-2, -TOP, PAGE_W+4, CANVAS_H); inkX.clip();
    drawStroke(inkX, liveStroke);
    inkX.restore();
  }
  drawBlinds(inkX);
}
/* ブラインドシール(暗記用の目隠し)。手書きの上に被せる */
let revealedBlinds = new Set(); // タッチで透明化した状態(保存しない・ページ移動でリセット)
function drawBlinds(ctx){
  if(!current) return;
  for(const pi of visPages){
    ctx.save(); ctx.translate(pageOffsets[pi], 0);
    for(const b of (current.pages[pi].blinds||[])) drawBlind(ctx, b, revealedBlinds.has(b.id));
    ctx.restore();
  }
}
function drawBlind(ctx, b, revealed){
  ctx.save();
  if(revealed){
    // 透明化: 枠線だけ残す
    ctx.strokeStyle = b.color || '#F4623A';
    ctx.globalAlpha = .8;
    ctx.setLineDash([7,5]); ctx.lineWidth = 2;
    roundRect(ctx, b.x, b.y, b.w, b.h, 10); ctx.stroke();
  } else {
    ctx.fillStyle = b.color || '#F4623A';
    ctx.shadowColor='rgba(35,48,61,.18)'; ctx.shadowBlur=4; ctx.shadowOffsetY=2;
    roundRect(ctx, b.x, b.y, b.w, b.h, 10); ctx.fill();
    ctx.shadowColor='transparent';
    // 模様(シール内にクリップして描く)
    if(b.pattern && b.pattern!=='solid'){
      ctx.save();
      roundRect(ctx, b.x, b.y, b.w, b.h, 10); ctx.clip();
      drawBlindPattern(ctx, b);
      ctx.restore();
    }
    // シールらしい光沢と目印
    ctx.fillStyle='rgba(255,255,255,.25)';
    roundRect(ctx, b.x+3, b.y+3, b.w-6, b.h*0.32, 7); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.9)';
    ctx.shadowColor='rgba(0,0,0,.3)'; ctx.shadowBlur=3;
    ctx.font = "700 15px 'Zen Maru Gothic', sans-serif";
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('タップで見る', b.x+b.w/2, b.y+b.h/2+1);
  }
  ctx.restore();
}
/* ブラインドの模様: stripe / dot / check */
function drawBlindPattern(ctx, b){
  if(b.pattern==='stripe'){
    ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=7;
    for(let x=b.x-b.h; x<b.x+b.w+b.h; x+=24){
      ctx.beginPath(); ctx.moveTo(x, b.y+b.h+5); ctx.lineTo(x+b.h+10, b.y-5); ctx.stroke();
    }
  } else if(b.pattern==='dot'){
    ctx.fillStyle='rgba(255,255,255,.42)';
    let row=0;
    for(let yy=b.y+10; yy<b.y+b.h-2; yy+=18, row++){
      for(let xx=b.x+10+(row%2?9:0); xx<b.x+b.w-2; xx+=18){
        ctx.beginPath(); ctx.arc(xx,yy,3.2,0,7); ctx.fill();
      }
    }
  } else if(b.pattern==='check'){
    ctx.fillStyle='rgba(255,255,255,.2)';
    const s=16;
    for(let r=0; r*s<b.h; r++)
      for(let c=0; c*s<b.w; c++)
        if((r+c)%2===0) ctx.fillRect(b.x+c*s, b.y+r*s, s, s);
  }
}

/* ---------- Undo / Redo (スナップショット方式) ---------- */
// ページ内容 + 付箋(共有)を1スナップに
function snap(){ return JSON.stringify({pid:page.id, s:page.strokes,t:page.texts,i:page.images,g:page.shapes,b:page.blinds,k:current.stickies}); }
function snapshot(){
  undoStack.push(snap());
  if(undoStack.length>40) undoStack.shift();
  redoStack = []; updateUndoBtns();
}
function restore(json){
  const o = JSON.parse(json);
  const pg = (o.pid && current.pages.find(p=>p.id===o.pid)) || page;
  pg.strokes=o.s; pg.texts=o.t; pg.images=o.i||[]; pg.shapes=o.g||[]; pg.blinds=o.b||[]; current.stickies=o.k||[];
  ensureImages(pg, ()=>redrawMid());
  redrawAll(); touched();
}
// ページ追加/削除用: ノート全体のスナップ(Undo対象外の軽い保存)
function snapshotNote(){ /* ページ構成変更は元に戻す対象にしないため保存のみ */ }
$('btnUndo').onclick = ()=>{
  if(!undoStack.length) return;
  redoStack.push(snap());
  restore(undoStack.pop()); updateUndoBtns();
};
$('btnRedo').onclick = ()=>{
  if(!redoStack.length) return;
  undoStack.push(snap());
  restore(redoStack.pop()); updateUndoBtns();
};
function updateUndoBtns(){
  $('btnUndo').disabled = !undoStack.length;
  $('btnRedo').disabled = !redoStack.length;
}
function touched(){ current.updatedAt = Date.now(); scheduleSave(); }

/* ---------- ツール切替 ---------- */
document.querySelectorAll('.pal-btn').forEach(b=>{
  b.onclick = ()=>{
    const t = b.dataset.tool;
    if(t==='ruler'){ closeMini(); closePops(); rulerOn = !rulerOn; b.classList.toggle('on', rulerOn);
      toast(rulerOn ? '定規 ON — 直線モード' : '定規 OFF — フリーハンド'); return; }

    // ペン/マーカー: すでに選択中の状態でもう一度タップ → 設定ミニウィンドウ開閉
    if((t==='pen'||t==='marker') && tool===t){
      toggleMini(t);
      return;
    }
    // それ以外(初回選択 or 別ツールから切替)
    closePops(); closeMini();
    tool = t; exitLasso();
    document.querySelectorAll('.pal-btn').forEach(x=>{ if(x.dataset.tool!=='ruler') x.classList.remove('on'); });
    b.classList.add('on');
    $('btnLasso').classList.remove('on'); $('btnText').classList.remove('on');
  };
});
$('btnLasso').onclick = ()=>{ closePops(); closeMini(); setHeaderTool('lasso', $('btnLasso')); };
$('btnText').onclick  = ()=>{ closePops(); closeMini(); setHeaderTool('text',  $('btnText')); toast('置きたい場所をタップ'); };
function setHeaderTool(t, btn){
  exitLasso();
  tool = t;
  document.querySelectorAll('.pal-btn').forEach(x=>{ if(x.dataset.tool!=='ruler') x.classList.remove('on'); });
  $('btnLasso').classList.remove('on'); $('btnText').classList.remove('on');
  btn.classList.add('on');
}
$('btnSticky').onclick = ()=>{ closeMini(); togglePop('stickyPop'); };
$('btnStamp').onclick = ()=>{ closeMini(); togglePop('stampPop'); };
function togglePop(id){
  const was = $(id).classList.contains('open');
  closePops();
  if(!was) $(id).classList.add('open');
}
function closePops(){ ['stickyPop','stampPop','textEntry','tableEntry','blindEntry'].forEach(i=>$(i).classList.remove('open')); editingBlind=null; }

/* ---------- ツール設定ミニウィンドウ(ペン/マーカー) ---------- */
let miniTool = null; // 現在ミニウィンドウが表示しているツール

function toggleMini(t){
  if(miniTool===t && $('toolMini').classList.contains('open')){ closeMini(); return; }
  openMini(t);
}
function closeMini(){ $('toolMini').classList.remove('open'); miniTool=null; }
function openMini(t){
  miniTool = t;
  closePops();
  $('miniTitle').textContent = t==='pen' ? 'ペン' : 'マーカー';
  // ペン先(ボールペン/えんぴつ)はペンのみ
  $('miniKindRow').style.display = t==='pen' ? '' : 'none';
  if(t==='pen'){
    $('miniKind').querySelectorAll('button').forEach(x=>x.classList.toggle('on', x.dataset.kind===penKind));
  }
  // 太さスライダー
  const wIn = $('miniWidth');
  if(t==='pen'){ wIn.min=1; wIn.max=14; wIn.step=0.5; wIn.value=penWidth; }
  else         { wIn.min=4; wIn.max=30; wIn.step=1;   wIn.value=markerWidth; }
  updateMiniWidthUI();
  // 配色パレットのセレクト
  const palSel = $('miniPalette');
  if(!palSel.options.length){
    for(const name of Object.keys(COLOR_PALETTES)){
      palSel.append(new Option(name, name));
    }
    palSel.onchange = ()=>{
      if(miniTool==='pen') penPalette = palSel.value; else markerPalette = palSel.value;
      buildMiniColors(miniTool);
    };
  }
  palSel.value = t==='pen' ? penPalette : markerPalette;
  // 色パレット
  buildMiniColors(t);
  $('toolMini').classList.add('open');
}
function updateMiniWidthUI(){
  const w = +$('miniWidth').value;
  $('miniWidthVal').textContent = w.toFixed(w%1?1:0) + 'pt';
  const d = $('miniWidthDemo');
  d.style.height = Math.max(2, w * (miniTool==='marker'?0.7:1)) + 'px';
  d.style.width = '100%';
  d.style.background = miniTool==='marker' ? (markerColor+'aa') : penColor;
  d.style.borderRadius = '99px';
}
$('miniWidth').oninput = ()=>{
  const w = +$('miniWidth').value;
  if(miniTool==='pen') penWidth = w; else markerWidth = w;
  updateMiniWidthUI();
};
$('miniKind').querySelectorAll('button').forEach(b=>{
  b.onclick = ()=>{
    penKind = b.dataset.kind;
    $('miniKind').querySelectorAll('button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    updateMiniWidthUI();
  };
});
function buildMiniColors(t){
  const box = $('miniColors'); box.innerHTML='';
  const palName = t==='pen' ? penPalette : markerPalette;
  const colors = COLOR_PALETTES[palName] || (t==='pen' ? PEN_COLORS : MARKER_COLORS);
  const cur = t==='pen' ? penColor : markerColor;
  for(const c of colors){
    const b = document.createElement('button');
    b.className = 'sw'+(c===cur?' on':''); b.style.background=c;
    b.onclick = ()=>{
      if(t==='pen') penColor=c; else markerColor=c;
      box.querySelectorAll('.sw').forEach(x=>x.classList.remove('on')); b.classList.add('on');
      updateMiniWidthUI();
    };
    box.append(b);
  }
  // カラーピッカー
  const pick = document.createElement('label'); pick.className='sw-pick';
  const inp = document.createElement('input'); inp.type='color'; inp.value=cur;
  inp.oninput = ()=>{
    if(t==='pen') penColor=inp.value; else markerColor=inp.value;
    box.querySelectorAll('.sw').forEach(x=>x.classList.remove('on'));
    updateMiniWidthUI();
  };
  pick.append(inp); box.append(pick);
}

/* 付箋 UI */
(function buildSticky(){
  const box = $('stickyColors');
  STICKY_COLORS.forEach((c,i)=>{
    const b=document.createElement('button'); b.style.background=c;
    b.setAttribute('aria-label','付箋 色'+(i+1));
    b.onclick=()=>{ closePops(); pendingStickyColor=i; tool='sticky-place'; toast('貼りたい場所をタップ'); };
    box.append(b);
  });
})();

/* ---------- スタンプ ---------- */
// type: 'text' はテキスト要素として、'shape' は図形要素として配置
const STAMPS = [
  {label:'【', type:'text', text:'【', size:44},
  {label:'】', type:'text', text:'】', size:44},
  {label:'●', type:'text', text:'●', size:30},
  {label:'■', type:'text', text:'■', size:30},
  {label:'▶', type:'text', text:'▶', size:28},
  {label:'★', type:'text', text:'★', size:34},
  {label:'※', type:'text', text:'※', size:30},
  {label:'→', type:'text', text:'→', size:34},
  {label:'✓', type:'text', text:'✓', size:34},
  {label:'四角', type:'shape', shape:{kind:'rect', w:260, h:170}},
  {label:'角丸', type:'shape', shape:{kind:'round', w:260, h:170, radius:24}},
  {label:'表 3×3', type:'shape', wide:true, shape:{kind:'table', w:360, h:240, rows:3, cols:3}},
  {label:'日付', type:'date', wide:true},
  {label:'ブラインドシール', type:'blind', wide:true},
];
(function buildStamps(){
  const grid = $('stampGrid');
  for(const s of STAMPS){
    const b = document.createElement('button');
    if(s.wide) b.classList.add('wide');
    if(s.type==='date'){ b.innerHTML = `📅<small style="margin-left:4px">今日の日付</small>`; }
    else if(s.type==='blind'){ b.innerHTML = `<span style="display:inline-block;width:38px;height:16px;border-radius:5px;background:#F4623A;margin-right:6px"></span><small>ブラインドシール</small>`; }
    else if(s.type==='shape'){ b.innerHTML = `<span style="font-size:13px">${s.label}</span>`; }
    else b.textContent = s.label;
    b.setAttribute('aria-label', 'スタンプ '+s.label);
    b.onclick = ()=> placeStamp(s);
    grid.append(b);
  }
})();
// 現在見えているキャンバス範囲の中央あたりの論理座標
function viewCenter(){
  return [ PAGE_W/2, PAGE_H/2 ];
}
function placeStamp(s){
  closePops();
  snapshot();
  const [cx,cy] = viewCenter();
  if(s.type==='blind'){
    page.blinds.push({ id:uid(), x:cx-130, y:cy-36, w:260, h:72,
      color:lastBlindStyle.color, pattern:lastBlindStyle.pattern });
    blitInk(); touched();
    toast('シールを置きました。投げ縄でタップ→編集で色・模様');
    return;
  }
  if(s.type==='shape'){
    const w=s.shape.w, h=s.shape.h;
    page.shapes.push({ id:uid(), ...s.shape, x:cx-w/2, y:cy-h/2, color:penColor, lineWidth:2.2 });
  } else {
    let text = s.text;
    if(s.type==='date'){
      const d=new Date();
      text = `${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()}`;
    }
    const size = s.size || 30;
    page.texts.push({ id:uid(), x:cx-size*(text.length*0.3), y:cy-size/2, text,
      font:"'Zen Maru Gothic', sans-serif", size, color:penColor });
  }
  redrawMid(); touched();
  toast('スタンプを置きました（投げ縄で移動・サイズ変更）');
}

/* ---------- ポインタ処理(メインキャンバス) ---------- */
let drawing=null, lassoPath=null, selection=null, dragSel=null, dragSticky=null, resizing=null, stickyTap=null;
let smoothPt=null;

function canvasPos(e){
  const r = inkC.getBoundingClientRect(); // transform(ズーム)後の矩形基準
  // キャンバス全高は CANVAS_H。ページ座標は上端が0なので TOP を引く(つまみ領域は負値)
  return [(e.clientX-r.left)/r.width*CANVAS_W, (e.clientY-r.top)/r.height*CANVAS_H - TOP];
}
// 見開き: グローバルxからどのページの上かを解決
function resolvePage(gx){
  let best = visPages[0], bestOff = pageOffsets[visPages[0]]||0;
  for(const pi of visPages){
    const off = pageOffsets[pi];
    if(gx >= off - 10 && gx <= off + PAGE_W + GUTTER/2){ best = pi; bestOff = off; }
  }
  return {pi: best, off: bestOff};
}
// 見開きで反対側のページに触れたら、編集対象を切り替える(レイアウトは維持)
function switchActivePage(pi){
  if(pi===pageIndex || !current.pages[pi]) return;
  pageIndex = pi;
  page = current.pages[pi];
  pageOffset = pageOffsets[pi] ?? 0;
  exitLasso();
  updatePageBar();
}
let gestureOff = 0; // 現在のジェスチャが始まったページのオフセット
inkC.addEventListener('pointerdown', e=>{
  if(e.pointerType==='touch' && !e.isPrimary) return; // 2本目以降はジェスチャ用
  if(gesture) return;
  inkC.setPointerCapture(e.pointerId);
  const [gx,y] = canvasPos(e);
  // 見開き: 触れた側のページを編集対象に
  const rp = resolvePage(gx);
  switchActivePage(rp.pi);
  gestureOff = rp.off;
  const x = gx - gestureOff; // 以降はページローカル座標
  smoothPt = [x,y];
  closePops(); closeMini();

  // 付箋の当たり判定を最優先(全ツール共通)
  const hitS = hitSticky(x,y);
  if(hitS){
    const own = (hitS.st.page===pageIndex);
    if(!own){
      // 他ページの付箋: タップでそのページへジャンプ
      stickyTap = { st:hitS.st, startX:x, startY:y, moved:false, dx:x-hitS.st.x, canDrag:false };
      return;
    }
    if(hitS.zone==='body'){
      // ノートに貼り付いている部分: どのツールでも掴んで横に動かせる
      stickyTap = { st:hitS.st, startX:x, startY:y, moved:false, dx:x-hitS.st.x, canDrag:true };
      snapshot();
      return;
    }
    // zone==='lip'(はみ出し部分)
    if(tool==='lasso'){
      stickyTap = { st:hitS.st, startX:x, startY:y, moved:false, dx:x-hitS.st.x, canDrag:true };
      snapshot();
      return;
    }
    // はみ出し部分 + ペン系ツール → 付箋に手書き(下の描画開始へフォールスルー)
  }

  // 選択中の操作(角=リサイズ/内側=移動)はどのツールでも有効
  if(selection && !hitS){
    const hk = hitHandle(x,y);
    if(hk){
      const [a,b,c,d]=selBounds();
      // ドラッグ中の角に対して、対角を固定点にする
      const anchor = {tl:[c,d],tr:[a,d],bl:[c,b],br:[a,b]}[hk];
      const w0=c-a, h0=d-b;
      // 掴んだ瞬間の倍率(≒1)を初期値にしてジャンプを防ぐ
      const isx = (x-anchor[0]) / ((hk==='tl'||hk==='bl') ? -w0 : w0);
      const isy = (y-anchor[1]) / ((hk==='tl'||hk==='tr') ? -h0 : h0);
      let ilx=Math.max(0.05,Math.abs(isx)), ily=Math.max(0.05,Math.abs(isy));
      if(selection.images.length){ const s=Math.max(ilx,ily); ilx=s; ily=s; }
      resizing = {hk, ox:anchor[0], oy:anchor[1], w0, h0, lastX:ilx, lastY:ily};
      snapshot(); return;
    }
    if(inSelBounds(x,y)){ dragSel={sx:x,sy:y,moved:false}; snapshot(); return; }
    // 範囲外をタッチ → 選択を解除して通常操作へ
    exitLasso(); blitInk();
  }

  if(tool==='sticky-place'){
    snapshot();
    // 既存タブと重ならない横位置を探す(左から STICKY_W+10 間隔)
    const used = current.stickies.map(s=>s.x).sort((a,b)=>a-b);
    let nx = 24;
    while(used.some(u=>Math.abs(u-nx) < STICKY_W+6) && nx < PAGE_W-STICKY_W) nx += STICKY_W+10;
    nx = Math.min(nx, PAGE_W-STICKY_W-8);
    current.stickies.push({
      id:uid(), page: pageIndex, x: nx,
      colorIndex:pendingStickyColor, strokes:[]
    });
    redrawMid(); touched(); tool='pen'; $('palPen').classList.add('on');
    toast('付箋を貼りました。他ページからはつまみが見え、タップで戻れます'); return;
  }
  if(tool==='text'){ openTextEntry(e.clientX, e.clientY, x, y); return; }

  if(tool==='lasso'){
    lassoPath=[[x,y]]; return;
  }

  // 描画開始
  snapshot();
  // 自ページの付箋のはみ出し部分で描く場合は、その付箋の手書きに記録(ローカル座標)
  let onSticky = null;
  if(tool!=='eraser' && hitS && hitS.st.page===pageIndex && hitS.zone==='lip'){
    onSticky = {st: hitS.st, ox: hitS.st.x, oy: -STICKY_LIP};
  }
  // ブラインドシールの上か(タップならpointerupで見え隠れトグル)
  const blindHit = hitBlind(x,y);
  // スタンプ(文字・図形)の上か(タップならpointerupで選択)
  const elHit = (!onSticky && !blindHit && (tool==='pen'||tool==='marker'))
    ? hitStampEl(x,y) : null;
  drawing = {
    tool: (tool==='pen'?'pen':tool),
    kind: penKind,
    color: tool==='marker' ? markerColor : penColor,
    width: tool==='marker' ? markerWidth : penWidth,
    points: [[x,y]],
    start:[x,y],
    onSticky,
    blindHit,
    elHit
  };
});
inkC.addEventListener('pointermove', e=>{
  if(e.pointerType==='touch' && !e.isPrimary) return;
  const [gx0,y] = canvasPos(e);
  const x = gx0 - gestureOff; // ジェスチャ開始ページのローカル座標

  if(resizing){
    let sx = (x - resizing.ox) / ((resizing.hk==='tl'||resizing.hk==='bl') ? -resizing.w0 : resizing.w0);
    let sy = (y - resizing.oy) / ((resizing.hk==='tl'||resizing.hk==='tr') ? -resizing.h0 : resizing.h0);
    // 画像を含む選択は比率を保つ(縦横比維持)。それ以外は自由変形
    if(selection.images.length){ const s=Math.max(Math.abs(sx),Math.abs(sy)); sx=s; sy=s; }
    sx = Math.max(0.05, Math.abs(sx)); sy = Math.max(0.05, Math.abs(sy));
    // 前フレームからの相対倍率をかける
    const rx = sx/(resizing.lastX||1), ry = sy/(resizing.lastY||1);
    resizing.lastX=sx; resizing.lastY=sy;
    scaleSelection(resizing.ox, resizing.oy, rx, ry);
    return;
  }
  if(stickyTap){
    if(!stickyTap.moved && Math.hypot(x-stickyTap.startX, y-stickyTap.startY) > 8) stickyTap.moved=true;
    if(stickyTap.moved && stickyTap.canDrag){
      // 自ページの付箋は横にドラッグ移動できる(投げ縄ツール時)
      stickyTap.st.x = Math.max(4, Math.min(PAGE_W-STICKY_W-4, x-stickyTap.dx));
      redrawMid();
    }
    return;
  }
  if(dragSel){ moveSelection(x-dragSel.sx, y-dragSel.sy); dragSel.sx=x; dragSel.sy=y; dragSel.moved=true; return; }
  if(lassoPath){ lassoPath.push([x,y]); drawLassoPreview(); return; }
  if(!drawing) return;

  if(rulerOn || drawing.tool==='marker'){
    // 定規 ON / マーカー: 始点→現在点の直線プレビュー(マーカー自動直線化)
    drawing.points = [drawing.start, [x,y]];
  } else {
    // 手ぶれ補正: 生の座標に少しずつ追従させて線のガタつきを吸収
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for(const ev of evs){
      const gp = canvasPos(ev);
      const p = [gp[0]-gestureOff, gp[1]];
      smoothPt = [
        smoothPt[0] + (p[0]-smoothPt[0]) * 0.3,
        smoothPt[1] + (p[1]-smoothPt[1]) * 0.3
      ];
      drawing.points.push([smoothPt[0], smoothPt[1]]);
    }
  }
  blitInk(drawing);
});
inkC.addEventListener('pointerup', e=>{
  if(resizing){ resizing=null; touched(); rebuildInkCache(); blitInk(); drawSelOutline(); updateLassoBar(); return; }
  if(stickyTap){
    const s = stickyTap.st;
    if(!stickyTap.moved){
      // タップ(動かさなかった)
      if(s.page!==pageIndex){ gotoPage(s.page, true); toast('P'+(s.page+1)+' へ移動'); }
      else if(stickyTap.canDrag){ undoStack.pop(); updateUndoBtns(); } // 移動しなかった→スナップ取消
    } else if(stickyTap.canDrag){
      touched(); // 横移動を確定(スナップは有効のまま)
    }
    stickyTap=null; return;
  }
  if(dragSel){ if(!dragSel.moved) undoStack.pop(); dragSel=null; touched(); rebuildInkCache(); blitInk(); drawSelOutline(); return; }
  if(lassoPath){ finishLasso(); return; }
  if(!drawing) return;
  // ブラインドシールのタップ判定(ほぼ動いていない)→ 見え隠れトグル
  if(drawing.blindHit && polyExtent(drawing.points) < 8){
    const b = drawing.blindHit;
    undoStack.pop(); updateUndoBtns(); // 描画スナップを取消
    revealedBlinds.has(b.id) ? revealedBlinds.delete(b.id) : revealedBlinds.add(b.id);
    drawing=null; blitInk(); return;
  }
  // スタンプ(文字・図形)のタップ判定 → どのツールでも選択できる
  if(drawing.elHit && polyExtent(drawing.points) < 8){
    undoStack.pop(); updateUndoBtns(); // 描画スナップを取消
    selection = {strokes:[], texts:[], images:[], shapes:[], blinds:[], ...drawing.elHit};
    drawing=null;
    blitInk(); drawSelOutline();
    $('lassoBar').classList.add('open'); updateLassoBar();
    return;
  }
  if(drawing.tool==='marker'){
    // 自動直線化: 始点と終点を結ぶ直線にスナップ(水平に近ければ水平化)
    let [sx,sy]=drawing.start; let [ex,ey]=drawing.points[drawing.points.length-1];
    if(Math.abs(ey-sy) < Math.abs(ex-sx)*0.25) ey = sy;
    drawing.points=[[sx,sy],[ex,ey]];
  }
  if(drawing.onSticky){
    // 付箋ローカル座標に変換して付箋へ記録
    const {st,ox,oy} = drawing.onSticky;
    const local = {...drawing, points: drawing.points.map(p=>[p[0]-ox, p[1]-oy])};
    delete local.onSticky; delete local.start;
    st.strokes = st.strokes || []; st.strokes.push(local);
    drawing=null; redrawMid(); blitInk(); touched(); return;
  }
  page.strokes.push(drawing);
  if(drawing.tool==='marker'){
    // マーカーは文字の下のレイヤーに入るので、描画順を組み直す
    drawing=null; rebuildInkCache(); blitInk(); touched();
    return;
  }
  drawStroke(inkCacheX, drawing);
  drawing=null; blitInk(); touched();
});
inkC.addEventListener('pointercancel', ()=>{ drawing=null; lassoPath=null; dragSel=null; dragSticky=null; stickyTap=null; resizing=null; blitInk(); });

/* ---------- ピンチズーム / 2本指ジェスチャ ---------- */
const wrapEl = $('canvasWrap');
const touches = new Map();
let gesture = null;

function cancelDrawing(){
  // 2本目の指が触れたら描きかけの線は破棄(誤描画防止)
  if(drawing){ drawing=null; if(undoStack.length){ undoStack.pop(); updateUndoBtns(); } blitInk(); }
  if(resizing){ resizing=null; if(undoStack.length){ undoStack.pop(); updateUndoBtns(); } rebuildInkCache(); blitInk(); drawSelOutline(); }
  if(dragSel){ dragSel=null; if(undoStack.length){ undoStack.pop(); updateUndoBtns(); } }
  if(stickyTap){ if(stickyTap.canDrag && undoStack.length){ undoStack.pop(); updateUndoBtns(); } stickyTap=null; redrawMid(); }
  if(lassoPath){ lassoPath=null; blitInk(); }
}
function clampPan(){
  if(zoom <= 1){ panX = 0; panY = 0; return; }
  const pw = CANVAS_W*viewScale*zoom, ph = CANVAS_H*viewScale*zoom;
  panX = Math.min(wrapEl.clientWidth - viewX - 60, Math.max(60 - viewX - pw, panX));
  panY = Math.min(wrapEl.clientHeight - viewY - 60, Math.max(60 - viewY - ph, panY));
}
wrapEl.addEventListener('pointerdown', e=>{
  if(e.pointerType !== 'touch') return;
  touches.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if(touches.size === 2){
    cancelDrawing();
    const [a,b] = [...touches.values()];
    gesture = {
      dist0: Math.hypot(a.x-b.x, a.y-b.y),
      cx0: (a.x+b.x)/2, cy0: (a.y+b.y)/2,
      zoom0: zoom, panX0: panX, panY0: panY,
      t0: Date.now(), moved: false
    };
  } else if(touches.size > 2){ gesture = null; }
}, true);
wrapEl.addEventListener('pointermove', e=>{
  const t = touches.get(e.pointerId); if(!t) return;
  t.x = e.clientX; t.y = e.clientY;
  if(!gesture || touches.size !== 2) return;
  const [a,b] = [...touches.values()];
  const dist = Math.hypot(a.x-b.x, a.y-b.y);
  const cx = (a.x+b.x)/2, cy = (a.y+b.y)/2;
  if(!gesture.moved && (Math.abs(dist-gesture.dist0) > 12 || Math.hypot(cx-gesture.cx0, cy-gesture.cy0) > 12)){
    gesture.moved = true; // タップではなくピンチ/パンと判定
  }
  if(!gesture.moved) return;
  const wr = wrapEl.getBoundingClientRect();
  const nz = Math.min(4, Math.max(1, gesture.zoom0 * dist / gesture.dist0));
  // ピンチの中心点が画面上で動かないようにパンを補正
  const lx = (gesture.cx0 - wr.left - viewX - gesture.panX0) / gesture.zoom0;
  const ly = (gesture.cy0 - wr.top  - viewY - gesture.panY0) / gesture.zoom0;
  zoom = nz;
  panX = (cx - wr.left) - viewX - nz*lx;
  panY = (cy - wr.top)  - viewY - nz*ly;
  clampPan(); applyView();
  e.preventDefault();
}, true);
function endGesture(e){
  if(!touches.has(e.pointerId)) return;
  touches.delete(e.pointerId);
  if(gesture && touches.size === 1){
    // 2本指タップ = ひとつ前の操作を取り消し
    if(!gesture.moved && Date.now() - gesture.t0 < 350){
      if(undoStack.length){ $('btnUndo').click(); toast('↩ 取り消しました'); }
    }
    gesture = null;
  }
  if(touches.size === 0) gesture = null;
}
wrapEl.addEventListener('pointerup', endGesture, true);
wrapEl.addEventListener('pointercancel', endGesture, true);

/* デスクトップ用: ホイールでズーム */
wrapEl.addEventListener('wheel', e=>{
  e.preventDefault();
  const wr = wrapEl.getBoundingClientRect();
  const nz = Math.min(4, Math.max(1, zoom * (e.deltaY < 0 ? 1.12 : 0.9)));
  const lx = (e.clientX - wr.left - viewX - panX) / zoom;
  const ly = (e.clientY - wr.top  - viewY - panY) / zoom;
  zoom = nz;
  panX = (e.clientX - wr.left) - viewX - nz*lx;
  panY = (e.clientY - wr.top)  - viewY - nz*ly;
  clampPan(); applyView();
}, {passive:false});

/* ---------- 投げ縄 ---------- */
function drawLassoPreview(){
  blitInk();
  inkX.save();
  inkX.translate(pageOffset, 0);
  inkX.strokeStyle='#2E6FD8'; inkX.setLineDash([6,5]); inkX.lineWidth=1.5;
  inkX.beginPath();
  lassoPath.forEach((p,i)=> i?inkX.lineTo(p[0],p[1]):inkX.moveTo(p[0],p[1]));
  inkX.stroke(); inkX.restore();
}
function pointInPoly(x,y,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const [xi,yi]=poly[i],[xj,yj]=poly[j];
    if(((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi)) inside=!inside;
  }
  return inside;
}
function finishLasso(){
  const poly = lassoPath; lassoPath=null;
  // 小さな動き=タップ扱い。その位置の単一要素を選択
  if(poly.length<8 || polyExtent(poly) < 14){
    const p = poly[0];
    const el = hitElement(p[0], p[1]);
    if(el){
      selection = {strokes:[], texts:[], images:[], shapes:[], blinds:[], ...el};
      blitInk(); drawSelOutline();
      $('lassoBar').classList.add('open'); updateLassoBar();
    } else { blitInk(); }
    return;
  }
  const strokes = page.strokes.filter(s => s.tool!=='eraser' && s.points.some(p=>pointInPoly(p[0],p[1],poly)));
  const texts = page.texts.filter(t=>pointInPoly(t.x,t.y,poly));
  const images = (page.images||[]).filter(im=>pointInPoly(im.x+im.w/2, im.y+im.h/2, poly));
  const shapes = (page.shapes||[]).filter(sh=>pointInPoly(sh.x+sh.w/2, sh.y+sh.h/2, poly));
  const blinds = (page.blinds||[]).filter(b=>pointInPoly(b.x+b.w/2, b.y+b.h/2, poly));
  if(!strokes.length && !texts.length && !images.length && !shapes.length && !blinds.length){ blitInk(); toast('何も選択されませんでした'); return; }
  selection = {strokes, texts, images, shapes, blinds};
  blitInk(); drawSelOutline();
  $('lassoBar').classList.add('open'); updateLassoBar();
}
// 投げ縄パスの広がり(最大辺長)
function polyExtent(poly){
  let x1=1e9,y1=1e9,x2=-1e9,y2=-1e9;
  for(const p of poly){ x1=Math.min(x1,p[0]);y1=Math.min(y1,p[1]);x2=Math.max(x2,p[0]);y2=Math.max(y2,p[1]); }
  return Math.max(x2-x1, y2-y1);
}
// 座標にある単一要素を優先順(ブラインド>テキスト>図形>画像)で拾う
// スタンプ類(文字・図形)のみのタップ判定。写真・ブラインドは含めない
// (写真の上に点を打つ操作を邪魔しないため)
function hitStampEl(x,y){
  for(let i=page.texts.length-1;i>=0;i--){
    const t=page.texts[i]; const r=textRect(t);
    if(x>=r.left-6 && x<=r.left+r.w && y>=r.top-4 && y<=r.top+r.h) return {texts:[t]};
  }
  for(let i=(page.shapes||[]).length-1;i>=0;i--){
    const s=page.shapes[i];
    // 図形は枠線付近のみヒット(内側は書き込みスペースなので邪魔しない)
    const near = 12;
    const inOuter = x>=s.x-near && x<=s.x+s.w+near && y>=s.y-near && y<=s.y+s.h+near;
    const inInner = x>=s.x+near && x<=s.x+s.w-near && y>=s.y+near && y<=s.y+s.h-near;
    if(inOuter && !inInner) return {shapes:[s]};
    if(inOuter && s.kind==='table' && nearTableLine(s,x,y,near)) return {shapes:[s]};
  }
  return null;
}
// 表の内部罫線の近くか
function nearTableLine(s,x,y,near){
  const rows=s.rows||3, cols=s.cols||3;
  for(let c=1;c<cols;c++){ if(Math.abs(x-(s.x+s.w/cols*c))<near) return true; }
  for(let r=1;r<rows;r++){ if(Math.abs(y-(s.y+s.h/rows*r))<near) return true; }
  return false;
}
function hitElement(x,y){
  const b = hitBlind(x,y);
  if(b) return {blinds:[b]};
  for(let i=page.texts.length-1;i>=0;i--){
    const t=page.texts[i]; const r=textRect(t);
    if(x>=r.left-6 && x<=r.left+r.w && y>=r.top-4 && y<=r.top+r.h) return {texts:[t]};
  }
  for(let i=(page.shapes||[]).length-1;i>=0;i--){
    const s=page.shapes[i];
    if(x>=s.x-8 && x<=s.x+s.w+8 && y>=s.y-8 && y<=s.y+s.h+8) return {shapes:[s]};
  }
  for(let i=(page.images||[]).length-1;i>=0;i--){
    const im=page.images[i];
    if(x>=im.x && x<=im.x+im.w && y>=im.y && y<=im.y+im.h) return {images:[im]};
  }
  return null;
}
function selBounds(){
  let x1=1e9,y1=1e9,x2=-1e9,y2=-1e9;
  for(const s of selection.strokes) for(const p of s.points){
    x1=Math.min(x1,p[0]);y1=Math.min(y1,p[1]);x2=Math.max(x2,p[0]);y2=Math.max(y2,p[1]);
  }
  for(const t of selection.texts){ const r=textRect(t); x1=Math.min(x1,r.left);y1=Math.min(y1,r.top);x2=Math.max(x2,r.left+r.w);y2=Math.max(y2,r.top+r.h); }
  for(const im of selection.images){ x1=Math.min(x1,im.x);y1=Math.min(y1,im.y);x2=Math.max(x2,im.x+im.w);y2=Math.max(y2,im.y+im.h); }
  for(const sh of (selection.shapes||[])){ x1=Math.min(x1,sh.x);y1=Math.min(y1,sh.y);x2=Math.max(x2,sh.x+sh.w);y2=Math.max(y2,sh.y+sh.h); }
  for(const b of (selection.blinds||[])){ x1=Math.min(x1,b.x);y1=Math.min(y1,b.y);x2=Math.max(x2,b.x+b.w);y2=Math.max(y2,b.y+b.h); }
  return [x1-14,y1-14,x2+14,y2+14];
}
function inSelBounds(x,y){ const [a,b,c,d]=selBounds(); return x>=a&&x<=c&&y>=b&&y<=d; }
const HANDLE_R = 20; // タップ判定半径(論理px)
function selHandles(){
  const [a,b,c,d]=selBounds();
  return {tl:[a,b],tr:[c,b],bl:[a,d],br:[c,d]};
}
function hitHandle(x,y){
  if(!selection) return null;
  const h = selHandles();
  for(const k in h){ if(Math.hypot(x-h[k][0], y-h[k][1]) < HANDLE_R) return k; }
  return null;
}
function drawSelOutline(){
  if(!selection) return;
  const [a,b,c,d]=selBounds();
  inkX.save();
  inkX.translate(pageOffset, 0);
  inkX.strokeStyle='#2E6FD8'; inkX.setLineDash([7,5]); inkX.lineWidth=1.5;
  inkX.strokeRect(a,b,c-a,d-b);
  inkX.setLineDash([]);
  // 四隅リサイズハンドル
  for(const k of ['tl','tr','bl','br']){
    const [hx,hy]=selHandles()[k];
    inkX.fillStyle='#fff'; inkX.strokeStyle='#2E6FD8'; inkX.lineWidth=2;
    inkX.beginPath(); inkX.arc(hx,hy,7,0,7); inkX.fill(); inkX.stroke();
  }
  inkX.restore();
}
function moveSelection(dx,dy){
  for(const s of selection.strokes) s.points = s.points.map(p=>[p[0]+dx,p[1]+dy]);
  for(const t of selection.texts){ t.x+=dx; t.y+=dy; }
  for(const im of selection.images){ im.x+=dx; im.y+=dy; }
  for(const sh of (selection.shapes||[])){ sh.x+=dx; sh.y+=dy; }
  for(const b of (selection.blinds||[])){ b.x+=dx; b.y+=dy; }
  rebuildInkCache(); redrawMid(); blitInk(); drawSelOutline();
}
/* 選択物を固定点(ox,oy)を基準に sx,sy 倍にスケール */
function scaleSelection(ox, oy, sx, sy){
  for(const s of selection.strokes) s.points = s.points.map(p=>[ox+(p[0]-ox)*sx, oy+(p[1]-oy)*sy]);
  for(const t of selection.texts){
    t.x = ox+(t.x-ox)*sx; t.y = oy+(t.y-oy)*sy;
    t.size = Math.max(8, t.size*(sx+sy)/2);
  }
  for(const im of selection.images){
    im.x = ox+(im.x-ox)*sx; im.y = oy+(im.y-oy)*sy;
    im.w *= sx; im.h *= sy;
    if(im.radius) im.radius *= (sx+sy)/2;
  }
  for(const sh of (selection.shapes||[])){
    sh.x = ox+(sh.x-ox)*sx; sh.y = oy+(sh.y-oy)*sy;
    sh.w *= sx; sh.h *= sy;
    if(sh.radius) sh.radius *= (sx+sy)/2;
  }
  for(const b of (selection.blinds||[])){
    b.x = ox+(b.x-ox)*sx; b.y = oy+(b.y-oy)*sy;
    b.w *= sx; b.h *= sy;
  }
  rebuildInkCache(); redrawMid(); blitInk(); drawSelOutline();
}
$('lassoDelete').onclick = ()=>{
  snapshot();
  page.strokes = page.strokes.filter(s=>!selection.strokes.includes(s));
  page.texts = page.texts.filter(t=>!selection.texts.includes(t));
  page.images = (page.images||[]).filter(im=>!selection.images.includes(im));
  page.shapes = (page.shapes||[]).filter(sh=>!(selection.shapes||[]).includes(sh));
  page.blinds = (page.blinds||[]).filter(b=>!(selection.blinds||[]).includes(b));
  exitLasso(); redrawAll(); touched();
};
$('lassoDone').onclick = ()=>{ exitLasso(); blitInk(); };
/* 選択中の要素を複製(少しずらして配置し、コピー側を選択状態に) */
$('lassoCopy').onclick = ()=>{
  if(!selection) return;
  snapshot();
  const OFF = 30;
  const ns=[], nt=[], ni=[], ng=[], nb=[];
  for(const s of selection.strokes){
    const c = JSON.parse(JSON.stringify(s));
    c.points = c.points.map(p=>[p[0]+OFF, p[1]+OFF]);
    page.strokes.push(c); ns.push(c);
  }
  for(const t of selection.texts){
    const c = {...t, id:uid(), x:t.x+OFF, y:t.y+OFF};
    page.texts.push(c); nt.push(c);
  }
  for(const im of selection.images){
    const c = JSON.parse(JSON.stringify(im));
    c.id = uid(); c.x += OFF; c.y += OFF;
    imgCache[c.id] = imgCache[im.id]; // 同じ画像データを共有
    page.images.push(c); ni.push(c);
  }
  for(const sh of (selection.shapes||[])){
    const c = {...sh, id:uid(), x:sh.x+OFF, y:sh.y+OFF};
    page.shapes.push(c); ng.push(c);
  }
  for(const b of (selection.blinds||[])){
    const c = {...b, id:uid(), x:b.x+OFF, y:b.y+OFF};
    page.blinds.push(c); nb.push(c);
  }
  selection = {strokes:ns, texts:nt, images:ni, shapes:ng, blinds:nb};
  rebuildInkCache(); redrawMid(); blitInk(); drawSelOutline(); updateLassoBar(); touched();
  toast('コピーしました(そのまま動かせます)');
};
function exitLasso(){ selection=null; updateLassoBar(); $('lassoBar').classList.remove('open'); }
function singleSel(){
  // 単一要素だけ選択されているか判定し、その種類と要素を返す
  if(!selection) return null;
  const nS=selection.strokes.length, nT=selection.texts.length,
        nI=selection.images.length, nG=(selection.shapes||[]).length,
        nB=(selection.blinds||[]).length;
  const total=nS+nT+nI+nG+nB;
  if(total!==1) return null;
  if(nT===1) return {kind:'text', el:selection.texts[0]};
  if(nI===1) return {kind:'image', el:selection.images[0]};
  if(nG===1) return {kind:'shape', el:selection.shapes[0]};
  if(nB===1) return {kind:'blind', el:selection.blinds[0]};
  return null;
}
function updateLassoBar(){
  const sng = singleSel();
  $('lassoCrop').hidden = !(sng && sng.kind==='image');
  // テキスト / 表 / ブラインドシール は編集可能
  const editable = sng && (sng.kind==='text' || sng.kind==='blind'
    || (sng.kind==='shape' && sng.el.kind==='table'));
  $('lassoEdit').hidden = !editable;
}
$('lassoCrop').onclick = ()=>{
  if(selection && selection.images.length===1) openCrop(selection.images[0]);
};
$('lassoEdit').onclick = ()=>{
  const sng = singleSel();
  if(!sng) return;
  if(sng.kind==='text') editTextElement(sng.el);
  else if(sng.kind==='shape' && sng.el.kind==='table') editTable(sng.el);
  else if(sng.kind==='blind') editBlind(sng.el);
};
// ブラインドシールの当たり判定
function hitBlind(x,y){
  for(let i=(page.blinds||[]).length-1;i>=0;i--){
    const b=page.blinds[i];
    if(x>=b.x && x<=b.x+b.w && y>=b.y && y<=b.y+b.h) return b;
  }
  return null;
}
function stickyRect(s){
  return {
    x: s.x, w: STICKY_W,
    lipY: -STICKY_LIP, lipH: STICKY_LIP,   // つまみ(上, y<0)
    bodyY: 0, bodyH: STICKY_BODY           // 本体(ページ内上部)
  };
}
// 付箋ヒット判定。zone: 'lip'(つまみ) / 'body'(本体) を返す
function hitSticky(x,y){
  for(let i=current.stickies.length-1;i>=0;i--){
    const s=current.stickies[i], r=stickyRect(s);
    if(stickyHost(s)!==pageIndex) continue; // このページ列に描かれていない付箋は無視
    if(x>=r.x && x<=r.x+r.w){
      if(y>=r.lipY && y<0) return {st:s, zone:'lip'};
      if(s.page===pageIndex && y>=0 && y<=r.bodyH) return {st:s, zone:'body'};
    }
  }
  return null;
}

/* ---------- 写真アップロード ---------- */
$('btnPhoto').onclick = ()=>{ closePops(); $('photoInput').value=''; $('photoInput').click(); };
$('photoInput').onchange = e=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    const img = new Image();
    img.onload = ()=>{
      // ページ幅の55%程度で配置(縦横比維持)
      const maxW = PAGE_W*0.55;
      let w = Math.min(maxW, img.naturalWidth);
      let h = w * img.naturalHeight/img.naturalWidth;
      if(h > PAGE_H*0.55){ h = PAGE_H*0.55; w = h*img.naturalWidth/img.naturalHeight; }
      const id = uid();
      imgCache[id] = img;
      snapshot();
      page.images.push({
        id, src: reader.result,
        x:(PAGE_W-w)/2, y:(PAGE_H-h)/2, w, h,
        shape:'rect', radius: Math.min(w,h)*0.12,
        crop:{x:0,y:0,w:1,h:1}
      });
      redrawMid(); touched();
      toast('写真を置きました。投げ縄で選ぶと切り抜けます');
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
};

/* ================================================================
   画像トリミング / 切り抜き
================================================================ */
const cropC = $('cropCanvas'), cropX = cropC.getContext('2d');
let cropTarget=null, cropImg=null;
let cropShape='rect';
let cropRect=null;       // 表示座標系での切り抜き枠 {x,y,w,h}
let cropView=null;       // 画像描画情報 {ox,oy,dw,dh}(表示上の画像位置とサイズ)
let cropDrag=null;

function openCrop(im){
  cropTarget = im;
  cropImg = imgCache[im.id];
  cropShape = (im.shape==='rect') ? 'rect' : im.shape;
  $('cropShape').querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.dataset.shape===cropShape));
  $('cropScreen').classList.add('open');
  requestAnimationFrame(()=>{ layoutCrop(); initCropRect(); drawCrop(); });
}
function layoutCrop(){
  const stage = $('cropStage');
  const availW = stage.clientWidth - 32, availH = stage.clientHeight - 32;
  const scale = Math.min(availW/cropImg.naturalWidth, availH/cropImg.naturalHeight);
  const dw = cropImg.naturalWidth*scale, dh = cropImg.naturalHeight*scale;
  cropC.width = dw*DPR; cropC.height = dh*DPR;
  cropC.style.width = dw+'px'; cropC.style.height = dh+'px';
  cropX.setTransform(DPR,0,0,DPR,0,0);
  cropView = {dw, dh};
}
function initCropRect(){
  // 既存の crop(正規化)を表示座標へ展開。無ければ全体
  const c = cropTarget.crop || {x:0,y:0,w:1,h:1};
  cropRect = {x:c.x*cropView.dw, y:c.y*cropView.dh, w:c.w*cropView.dw, h:c.h*cropView.dh};
}
function drawCrop(){
  cropX.clearRect(0,0,cropView.dw,cropView.dh);
  // 画像全体を薄く表示
  cropX.globalAlpha=.4; cropX.drawImage(cropImg,0,0,cropView.dw,cropView.dh); cropX.globalAlpha=1;
  // 切り抜き範囲だけくっきり(形状でクリップ)
  const rad = Math.min(cropRect.w,cropRect.h)*0.18;
  cropX.save();
  cropX.translate(cropRect.x, cropRect.y);
  cropX.beginPath();
  clipShape(cropX, cropRect.w, cropRect.h, cropShape, rad);
  cropX.clip();
  cropX.drawImage(cropImg, -cropRect.x, -cropRect.y, cropView.dw, cropView.dh);
  cropX.restore();
  // 枠線
  cropX.save();
  cropX.translate(cropRect.x, cropRect.y);
  cropX.strokeStyle='#FFD64D'; cropX.lineWidth=2;
  cropX.beginPath();
  clipShape(cropX, cropRect.w, cropRect.h, cropShape, rad);
  cropX.stroke();
  // 角ハンドル
  cropX.fillStyle='#FFD64D';
  for(const [hx,hy] of [[0,0],[cropRect.w,0],[0,cropRect.h],[cropRect.w,cropRect.h]]){
    cropX.beginPath(); cropX.arc(hx,hy,6,0,7); cropX.fill();
  }
  cropX.restore();
}
function cropPos(e){
  const r = cropC.getBoundingClientRect();
  return [(e.clientX-r.left)/r.width*cropView.dw, (e.clientY-r.top)/r.height*cropView.dh];
}
function cropHandle(x,y){
  const corners = {tl:[cropRect.x,cropRect.y],tr:[cropRect.x+cropRect.w,cropRect.y],
    bl:[cropRect.x,cropRect.y+cropRect.h],br:[cropRect.x+cropRect.w,cropRect.y+cropRect.h]};
  for(const k in corners){ if(Math.hypot(x-corners[k][0],y-corners[k][1])<22) return k; }
  return null;
}
cropC.addEventListener('pointerdown', e=>{
  cropC.setPointerCapture(e.pointerId);
  const [x,y]=cropPos(e);
  const hk = cropHandle(x,y);
  if(hk){ cropDrag={mode:'resize',hk}; return; }
  if(x>=cropRect.x && x<=cropRect.x+cropRect.w && y>=cropRect.y && y<=cropRect.y+cropRect.h){
    cropDrag={mode:'move',dx:x-cropRect.x,dy:y-cropRect.y};
  }
});
cropC.addEventListener('pointermove', e=>{
  if(!cropDrag) return;
  let [x,y]=cropPos(e);
  x=Math.max(0,Math.min(cropView.dw,x)); y=Math.max(0,Math.min(cropView.dh,y));
  if(cropDrag.mode==='move'){
    cropRect.x = Math.max(0, Math.min(cropView.dw-cropRect.w, x-cropDrag.dx));
    cropRect.y = Math.max(0, Math.min(cropView.dh-cropRect.h, y-cropDrag.dy));
  } else {
    const R=cropRect, min=30;
    if(cropDrag.hk.includes('l')){ const nx=Math.min(x,R.x+R.w-min); R.w=R.x+R.w-nx; R.x=nx; }
    if(cropDrag.hk.includes('r')){ R.w=Math.max(min, x-R.x); }
    if(cropDrag.hk[0]==='t'){ const ny=Math.min(y,R.y+R.h-min); R.h=R.y+R.h-ny; R.y=ny; }
    if(cropDrag.hk[0]==='b'){ R.h=Math.max(min, y-R.y); }
  }
  drawCrop();
});
cropC.addEventListener('pointerup', ()=>{ cropDrag=null; });
cropC.addEventListener('pointercancel', ()=>{ cropDrag=null; });

$('cropShape').querySelectorAll('button').forEach(b=>{
  b.onclick = ()=>{
    cropShape = b.dataset.shape;
    $('cropShape').querySelectorAll('button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); drawCrop();
  };
});
$('cropCancel').onclick = ()=>{ $('cropScreen').classList.remove('open'); cropTarget=null; };
$('cropApply').onclick = ()=>{
  snapshot();
  // 表示座標の枠を元画像の正規化 crop に変換(既存 crop を考慮せず、全体基準で単純化)
  const nx = cropRect.x/cropView.dw, ny = cropRect.y/cropView.dh;
  const nw = cropRect.w/cropView.dw, nh = cropRect.h/cropView.dh;
  cropTarget.crop = {x:nx, y:ny, w:nw, h:nh};
  cropTarget.shape = cropShape;
  // ノート上での表示サイズは切り抜き比率に合わせて更新(幅を保ち高さを調整)
  const aspect = (nw*cropImg.naturalWidth)/(nh*cropImg.naturalHeight);
  cropTarget.h = cropTarget.w / aspect;
  cropTarget.radius = Math.min(cropTarget.w, cropTarget.h)*0.18;
  $('cropScreen').classList.remove('open'); cropTarget=null;
  redrawMid(); if(selection) drawSelOutline(); touched();
  toast('切り抜きました');
};
window.addEventListener('resize', ()=>{ if($('cropScreen').classList.contains('open')){ const c=cropTarget.crop; layoutCrop(); cropRect={x:c.x*cropView.dw,y:c.y*cropView.dh,w:c.w*cropView.dw,h:c.h*cropView.dh}; drawCrop(); } });

/* ---------- テキスト入力 / 編集 ---------- */
let textPos=null;
let editingText=null; // 編集中のテキスト要素(nullなら新規)
/* テキスト設定の下書き(色・大きさ・向き・太字) */
let txtColor = penColor, txtSize = 24, txtVertical = false, txtBold = false;
const TEXT_COLORS = PEN_COLORS; // 黒/赤/青/緑/橙/紫/グレー

/* 文字色スウォッチを構築 */
TEXT_COLORS.forEach(c=>{
  const b = document.createElement('button');
  b.className='sw'; b.style.background=c;
  b.setAttribute('aria-label','文字色');
  b.onclick = ()=>{ txtColor=c; syncTextControls(); };
  $('textColors').append(b);
});
/* コントロールの表示を現在の下書き値に合わせる */
function syncTextControls(){
  [...$('textColors').children].forEach((b,i)=>
    b.classList.toggle('on', TEXT_COLORS[i]===txtColor));
  $('txtSizeVal').textContent = Math.round(txtSize);
  $('txtBold').classList.toggle('on', txtBold);
  $('txtBold').setAttribute('aria-pressed', txtBold);
  [...$('txtOrient').children].forEach(b=>
    b.classList.toggle('on', (b.dataset.o==='v')===txtVertical));
}
$('txtSizeMinus').onclick = ()=>{ txtSize=Math.max(12, txtSize-4); syncTextControls(); };
$('txtSizePlus').onclick  = ()=>{ txtSize=Math.min(96, txtSize+4); syncTextControls(); };
$('txtBold').onclick = ()=>{ txtBold=!txtBold; syncTextControls(); };
[...$('txtOrient').children].forEach(b=> b.onclick = ()=>{ txtVertical=(b.dataset.o==='v'); syncTextControls(); });

/* パネルが画面からはみ出さない位置に置く */
function positionTextEntry(left, top){
  const el=$('textEntry'); el.classList.add('open');
  const w=el.offsetWidth, h=el.offsetHeight;
  el.style.left = Math.max(8, Math.min(left, window.innerWidth - w - 8))+'px';
  el.style.top  = Math.max(60, Math.min(top,  window.innerHeight - h - 8))+'px';
}
function openTextEntry(cx, cy, x, y){
  editingText=null; textPos=[x,y];
  txtColor=penColor; txtSize=24; txtVertical=false; txtBold=false;
  $('textInput').value=''; $('fontSel').value = "system-ui";
  syncTextControls();
  positionTextEntry(cx, cy);        // タップ位置の近くに開く
  setTimeout(()=>$('textInput').focus(), 30);
}
// 既存テキストを編集(色・大きさ・向き・太字も読み込む)
function editTextElement(t){
  editingText=t;
  txtColor = t.color || penColor; txtSize = t.size || 24;
  txtVertical = !!t.vertical; txtBold = (t.weight==='bold');
  $('textInput').value = t.text; $('fontSel').value = t.font || "system-ui";
  syncTextControls();
  positionTextEntry((window.innerWidth-280)/2, window.innerHeight*0.24);
  setTimeout(()=>{ $('textInput').focus(); $('textInput').select(); }, 30);
}
$('textOk').onclick = ()=>{
  const txt = $('textInput').value.replace(/\s+$/,'');
  const props = { font: $('fontSel').value, size: txtSize, color: txtColor,
    weight: txtBold ? 'bold' : '', vertical: txtVertical };
  closePops();
  if(editingText){
    snapshot();
    if(txt===''){ // 空にしたら削除
      page.texts = page.texts.filter(t=>t!==editingText);
      exitLasso();
    } else {
      Object.assign(editingText, { text: txt, ...props });
      if(selection) drawSelOutline();
    }
    editingText=null; redrawMid(); touched(); return;
  }
  if(!txt || !textPos) return;
  snapshot();
  page.texts.push({ id:uid(), x:textPos[0], y:textPos[1], text:txt, ...props });
  redrawMid(); touched();
};

/* ---------- 表の編集(行×列) ---------- */
let editingTable=null, teRows=3, teCols=3;
function editTable(sh){
  editingTable = sh;
  teRows = sh.rows||3; teCols = sh.cols||3;
  $('rowVal').textContent = teRows; $('colVal').textContent = teCols;
  const el = $('tableEntry');
  el.classList.add('open');
  el.style.left = Math.max(10, (window.innerWidth-260)/2)+'px';
  el.style.top = Math.max(70, window.innerHeight*0.3)+'px';
}
$('rowMinus').onclick = ()=>{ teRows=Math.max(1,teRows-1); $('rowVal').textContent=teRows; };
$('rowPlus').onclick  = ()=>{ teRows=Math.min(12,teRows+1); $('rowVal').textContent=teRows; };
$('colMinus').onclick = ()=>{ teCols=Math.max(1,teCols-1); $('colVal').textContent=teCols; };
$('colPlus').onclick  = ()=>{ teCols=Math.min(10,teCols+1); $('colVal').textContent=teCols; };
$('tableOk').onclick = ()=>{
  if(!editingTable) return;
  snapshot();
  editingTable.rows = teRows; editingTable.cols = teCols;
  $('tableEntry').classList.remove('open');
  editingTable=null;
  redrawMid(); if(selection) drawSelOutline(); touched();
  toast('表を更新しました');
};

/* ---------- ブラインドシールの編集(色・模様) ---------- */
const BLIND_COLORS = ['#F4623A','#E03131','#2F9E44','#1971C2','#E64980','#7048E8','#495057'];
let lastBlindStyle = { color:'#F4623A', pattern:'solid' }; // 次に置くシールに引き継ぐ
let editingBlind = null, blindSnapDone = false;

let blindPalette = 'スタンダード'; // ブラインド用の配色パレット選択(セッション中保持)
function editBlind(b){
  closePops();
  editingBlind = b;
  blindSnapDone = false; // 最初の変更時に一度だけスナップ
  // 配色パレットのセレクト(初回のみ構築)
  const palSel = $('blindPalette');
  if(!palSel.options.length){
    for(const name of Object.keys(COLOR_PALETTES)){
      palSel.append(new Option(name, name));
    }
    palSel.onchange = ()=>{ blindPalette = palSel.value; buildBlindColors(); };
  }
  palSel.value = blindPalette;
  buildBlindColors();
  $('blindPatterns').querySelectorAll('button').forEach(x=>
    x.classList.toggle('on', x.dataset.p === (b.pattern||'solid')));
  const el = $('blindEntry');
  el.classList.add('open');
  el.style.left = Math.max(10, (window.innerWidth-280)/2)+'px';
  el.style.top = Math.max(70, window.innerHeight*0.28)+'px';
}
function blindSnapOnce(){
  if(!blindSnapDone){ snapshot(); blindSnapDone = true; }
}
function applyBlindColor(c){
  if(!editingBlind) return;
  blindSnapOnce();
  editingBlind.color = c; lastBlindStyle.color = c;
  blitInk(); if(selection) drawSelOutline(); touched();
}
function buildBlindColors(){
  const box = $('blindColors'); box.innerHTML='';
  const colors = COLOR_PALETTES[blindPalette] || BLIND_COLORS;
  for(const c of colors){
    const btn = document.createElement('button');
    btn.className = 'sw' + (editingBlind && editingBlind.color===c ? ' on' : '');
    btn.style.background = c;
    btn.onclick = ()=>{
      applyBlindColor(c);
      box.querySelectorAll('.sw').forEach(x=>x.classList.remove('on')); btn.classList.add('on');
    };
    box.append(btn);
  }
  // 自由選択のカラーピッカー
  const pick = document.createElement('label'); pick.className='sw-pick';
  const inp = document.createElement('input'); inp.type='color';
  inp.value = (editingBlind && editingBlind.color) || '#F4623A';
  inp.oninput = ()=>{
    applyBlindColor(inp.value);
    box.querySelectorAll('.sw').forEach(x=>x.classList.remove('on'));
  };
  pick.append(inp); box.append(pick);
}
$('blindPatterns').querySelectorAll('button').forEach(btn=>{
  btn.onclick = ()=>{
    if(!editingBlind) return;
    blindSnapOnce();
    editingBlind.pattern = btn.dataset.p; lastBlindStyle.pattern = btn.dataset.p;
    $('blindPatterns').querySelectorAll('button').forEach(x=>x.classList.remove('on'));
    btn.classList.add('on');
    blitInk(); if(selection) drawSelOutline(); touched();
  };
});
$('blindOk').onclick = ()=>{ $('blindEntry').classList.remove('open'); editingBlind=null; };

/* ================================================================
   黒板(全ノート共通・引き出し式)
================================================================ */
const boardC = $('boardCanvas'), boardX = boardC.getContext('2d');
const BOARD_W = 1000, BOARD_H = 640;
let boardOpen=false, boardDrawing=null;

function sizeBoard(){
  const r = boardC.getBoundingClientRect();
  if(r.width===0) return;
  boardC.width = r.width*DPR; boardC.height = r.height*DPR;
  boardX.setTransform(boardC.width/BOARD_W,0,0,boardC.height/BOARD_H,0,0);
  redrawBoard();
}
function redrawBoard(){
  boardX.save(); boardX.setTransform(1,0,0,1,0,0);
  boardX.clearRect(0,0,boardC.width,boardC.height); boardX.restore();
  for(const s of DB.board.strokes) drawStroke(boardX, s);
}
function toggleBoard(open){
  boardOpen = open ?? !boardOpen;
  $('boardPanel').classList.toggle('open', boardOpen);
  if(boardOpen) requestAnimationFrame(sizeBoard);
  else { renderBoardThumb(); saveNow(); }
}
$('boardTab').onclick = ()=>toggleBoard(true);
$('boardStrip').onclick = ()=>toggleBoard(true);
$('boardClose').onclick = ()=>toggleBoard(false);
$('boardCloseTab').onclick = ()=>toggleBoard(false);

/* 黒板消し: 本物のようにタッチしたまま動かして消す */
let eraserDrag = null; // {x,y} 画面座標(黒板消しの現在位置)
const chalkEraserBtn = $('chalkEraser');
chalkEraserBtn.addEventListener('pointerdown', e=>{
  e.preventDefault();
  chalkEraserBtn.setPointerCapture(e.pointerId);
  eraserDrag = {x:e.clientX, y:e.clientY};
  boardDrawing = {tool:'eraser', width:26, points:[]};
  chalkEraserBtn.classList.add('on');
  drawBoardWithEraser();
});
chalkEraserBtn.addEventListener('pointermove', e=>{
  if(!eraserDrag) return;
  eraserDrag = {x:e.clientX, y:e.clientY};
  const r = boardC.getBoundingClientRect();
  // 黒板の上にいる間だけ消す
  if(e.clientX>=r.left && e.clientX<=r.right && e.clientY>=r.top && e.clientY<=r.bottom){
    boardDrawing.points.push([(e.clientX-r.left)/r.width*BOARD_W, (e.clientY-r.top)/r.height*BOARD_H]);
  } else {
    // 黒板から出たら、そこまでの消し跡を確定して新しいストロークへ
    if(boardDrawing.points.length>1){ DB.board.strokes.push(boardDrawing); }
    boardDrawing = {tool:'eraser', width:26, points:[]};
  }
  drawBoardWithEraser();
});
function endEraserDrag(){
  if(!eraserDrag) return;
  if(boardDrawing && boardDrawing.points.length>1){ DB.board.strokes.push(boardDrawing); scheduleSave(); }
  boardDrawing=null; eraserDrag=null;
  chalkEraserBtn.classList.remove('on');
  redrawBoard();
}
chalkEraserBtn.addEventListener('pointerup', endEraserDrag);
chalkEraserBtn.addEventListener('pointercancel', endEraserDrag);
// 黒板消しの見た目(ドラッグ中、指に追従して表示)
function drawBoardWithEraser(){
  redrawBoard();
  if(boardDrawing) drawStroke(boardX, boardDrawing);
  if(!eraserDrag) return;
  const r = boardC.getBoundingClientRect();
  if(eraserDrag.x<r.left||eraserDrag.x>r.right||eraserDrag.y<r.top||eraserDrag.y>r.bottom) return;
  const bx=(eraserDrag.x-r.left)/r.width*BOARD_W, by=(eraserDrag.y-r.top)/r.height*BOARD_H;
  boardX.save();
  boardX.translate(bx,by); boardX.rotate(-.08);
  boardX.shadowColor='rgba(0,0,0,.45)'; boardX.shadowBlur=8; boardX.shadowOffsetY=4;
  boardX.fillStyle='#E8E2D2'; boardX.fillRect(-37,-16,74,18);
  boardX.shadowColor='transparent';
  boardX.fillStyle='#4A5568'; boardX.fillRect(-37,2,74,14);
  boardX.restore();
}
function boardPos(e){
  const r = boardC.getBoundingClientRect();
  return [(e.clientX-r.left)/r.width*BOARD_W, (e.clientY-r.top)/r.height*BOARD_H];
}
boardC.addEventListener('pointerdown', e=>{
  boardC.setPointerCapture(e.pointerId);
  const p = boardPos(e);
  boardDrawing = {tool:'chalk', color:'#F2EFE4', width:4.5, points:[p]};
});
boardC.addEventListener('pointermove', e=>{
  if(!boardDrawing) return;
  boardDrawing.points.push(boardPos(e));
  redrawBoard(); drawStroke(boardX, boardDrawing);
});
boardC.addEventListener('pointerup', ()=>{
  if(!boardDrawing) return;
  DB.board.strokes.push(boardDrawing); boardDrawing=null;
  redrawBoard(); scheduleSave();
});

function renderBoardThumb(){
  const c = $('boardThumb');
  const r = c.parentElement.getBoundingClientRect();
  c.width = r.width*DPR; c.height = r.height*DPR;
  const x = c.getContext('2d');
  x.setTransform(c.width/BOARD_W,0,0,c.width/BOARD_W,0,-c.width/BOARD_W*40);
  for(const s of DB.board.strokes) drawStroke(x, s);
}

/* ---------- 勉強タイマー ---------- */
let timerLeft=0, timerHandle=null;
const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
$('timerMin').oninput = ()=>{ if(!timerHandle) $('timerDisp').textContent = fmt((+$('timerMin').value||0)*60); };
$('timerBtn').onclick = ()=>{
  if(timerHandle){ stopTimer('タイマーを止めました'); return; }
  timerLeft = Math.max(1, Math.min(180, +$('timerMin').value||25))*60;
  $('timerBtn').textContent='ストップ';
  $('tabTimer').hidden=false;
  $('timerDisp').classList.remove('alarm');
  tick();
  timerHandle = setInterval(tick, 1000);
};
function tick(){
  $('timerDisp').textContent = fmt(timerLeft);
  $('tabTimer').textContent = fmt(timerLeft);
  if(timerLeft<=0){ finishTimer(); return; }
  timerLeft--;
}
function stopTimer(msg){
  clearInterval(timerHandle); timerHandle=null;
  $('timerBtn').textContent='スタート';
  $('tabTimer').hidden=true;
  $('timerDisp').textContent = fmt((+$('timerMin').value||25)*60);
  if(msg) toast(msg);
}
function finishTimer(){
  clearInterval(timerHandle); timerHandle=null;
  $('timerBtn').textContent='スタート';
  $('timerDisp').classList.add('alarm');
  $('timerDisp').textContent='00:00';
  beep(); toast('⏰ 時間になりました!おつかれさま');
  setTimeout(()=>{ $('timerDisp').classList.remove('alarm'); $('tabTimer').hidden=true; }, 6000);
}
function beep(){
  try{
    const ac = new (window.AudioContext||window.webkitAudioContext)();
    [0,.35,.7].forEach(t=>{
      const o=ac.createOscillator(), g=ac.createGain();
      o.frequency.value=880; o.type='sine';
      g.gain.setValueAtTime(.25, ac.currentTime+t);
      g.gain.exponentialRampToValueAtTime(.001, ac.currentTime+t+.3);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime+t); o.stop(ac.currentTime+t+.32);
    });
  }catch(e){}
}

/* ================================================================
   起動
================================================================ */
/* ================================================================
   初回サンプルノート(レイアウト使用例: コーネル式)
================================================================ */
function makeSampleNote(){
  const t = (x,y,text,size,color,font)=>({id:uid(),x,y,text,size:size||26,
    color:color||'#3A4A5A',font:font||"'Zen Maru Gothic', sans-serif"});
  const rect = (x,y,w,h,extra)=>({id:uid(),kind:'rect',x,y,w,h,color:'#9AB0C4',lineWidth:2,...(extra||{})});
  const round = (x,y,w,h,r)=>({id:uid(),kind:'round',x,y,w,h,radius:r||20,color:'#E8B400',lineWidth:2.4});

  // ページ1: コーネル式レイアウトの使用例
  const p1 = { id:uid(), strokes:[], images:[],
    texts:[
      t(60, 40, '【 授業ノートの使い方 】', 40, '#23303D'),
      t(70, 120, '① 見出しゾーン', 22, '#E8A400'),
      t(70, 300, '手がかり', 22, '#2E9E5F'),
      t(70, 340, '(キーワード', 17, '#5B6B7B'),
      t(70, 366, ' ・質問)', 17, '#5B6B7B'),
      t(340, 300, 'メモ・板書ゾーン', 22, '#2E6FD8'),
      t(340, 345, 'ここに授業内容を書く。', 20, '#3A4A5A'),
      t(340, 385, '図やマーカーも自由に。', 20, '#3A4A5A'),
      t(70, 950, 'まとめ', 22, '#8A4FD3'),
      t(70, 995, '授業の要点を1〜2行で。', 20, '#3A4A5A'),
    ],
    shapes:[
      round(50, 100, 720, 90),          // 見出し帯
      rect(50, 280, 260, 640),          // 手がかり欄(左)
      rect(320, 280, 450, 640),         // メモ欄(右)
      rect(50, 930, 720, 140),          // まとめ欄(下)
    ]
  };
  // ページ2: 使い方の続き(空きめ)
  const p2 = { id:uid(), strokes:[], images:[], shapes:[
      round(50, 60, 720, 80),
    ], texts:[
      t(80, 78, '【 2ページ目 】自由に書いてみよう', 30, '#23303D'),
      t(80, 200, '● スタンプボタンから枠・表・日付を置けます', 22, '#3A4A5A'),
      t(80, 250, '● 上のタブを引くと共有の黒板が出ます', 22, '#3A4A5A'),
      t(80, 300, '● 右端の付箋はページをめくっても残ります', 22, '#3A4A5A'),
    ]
  };
  return {
    id: uid(), title: 'ノートの使い方（サンプル）', template: 'blank',
    pages: [p1, p2], stickies: [
      { id:uid(), page: 0, x: 560, colorIndex: 3, strokes: [] },
      { id:uid(), page: 1, x: 300, colorIndex: 1, strokes: [] }
    ],
    createdAt: Date.now(), updatedAt: Date.now(), thumb: null
  };
}

/* ================================================================
   ホーム: 表紙(カバー)編集シート
================================================================ */
let editingCoverId = null;   // 編集中ノートID
let draftCover = null;       // {pattern,color} 適用前の下書き
let draftMode = 'design';    // 'design'(柄)| 'page1'(1ページ目を表紙に)

function openCoverSheet(id){
  const n = DB.notes.find(x=>x.id===id);
  if(!n) return;
  if(!n.cover) n.cover = DEFAULT_COVER();
  editingCoverId = id;
  draftCover = { pattern:n.cover.pattern, color:n.cover.color };
  draftMode = n.coverMode === 'page1' ? 'page1' : 'design';
  // 現在の色を含むパレットを初期選択(なければ「おすすめ」)
  coverPalette = 'おすすめ';
  for(const name of Object.keys(COVER_PALETTES)){
    if(coverPaletteColors(name).includes(draftCover.color)){ coverPalette = name; break; }
  }
  buildCoverPaletteSelect(); buildCoverPatterns(); buildCoverColors(); updateCoverMode();
  $('coverBg').classList.add('open'); $('coverSheet').classList.add('open');
}
/* モード切り替えの見た目と、柄・色オプションの表示/非表示を更新 */
function updateCoverMode(){
  document.querySelectorAll('#coverMode .cm-btn').forEach(b=>{
    b.classList.toggle('on', b.dataset.mode === draftMode);
  });
  $('coverDesignOpts').style.display = draftMode === 'page1' ? 'none' : '';
  updateCoverPreview();
}
function closeCoverSheet(){
  $('coverBg').classList.remove('open'); $('coverSheet').classList.remove('open');
  editingCoverId = null; draftCover = null;
}
function buildCoverPatterns(){
  const box = $('coverPatterns'); box.innerHTML = '';
  for(const p of COVER_PATTERNS){
    const b = document.createElement('button'); b.className = 'cover-pat';
    if(p.key === draftCover.pattern) b.classList.add('on');
    const c = document.createElement('canvas'); c.width = 90; c.height = 120;
    drawCover(c.getContext('2d'), {pattern:p.key, color:draftCover.color}, 90, 120, '');
    b.append(c, Object.assign(document.createElement('span'), {className:'nm', textContent:p.name}));
    b.onclick = ()=>{ draftCover.pattern = p.key; buildCoverPatterns(); updateCoverPreview(); };
    box.append(b);
  }
}
/* 配色パレットのドロップダウン(ペンツールの COLOR_PALETTES を流用) */
function buildCoverPaletteSelect(){
  const sel = $('coverPalette');
  if(!sel.options.length){
    for(const name of Object.keys(COVER_PALETTES)) sel.append(new Option(name, name));
    sel.onchange = ()=>{ coverPalette = sel.value; buildCoverColors(); };
  }
  sel.value = coverPalette;
}
function buildCoverColors(){
  const box = $('coverColors'); box.innerHTML = '';
  for(const col of coverPaletteColors(coverPalette)){
    const b = document.createElement('button'); b.className = 'sw';
    if(col.toLowerCase() === (draftCover.color||'').toLowerCase()) b.classList.add('on');
    b.style.background = col; b.setAttribute('aria-label','色を選ぶ');
    b.onclick = ()=>{ draftCover.color = col; buildCoverColors(); buildCoverPatterns(); updateCoverPreview(); };
    box.append(b);
  }
  // 自由に色を選べるカラーピッカー(パレット外の色もOK)
  const pick = document.createElement('label'); pick.className = 'sw sw-pick';
  pick.style.background = 'conic-gradient(#ff5f6d,#ffc371,#f9f871,#7ee8a2,#59c1f0,#a17ff5,#ff5f6d)';
  const inp = document.createElement('input'); inp.type = 'color';
  inp.value = /^#[0-9a-f]{6}$/i.test(draftCover.color) ? draftCover.color : '#F4B8C6';
  inp.setAttribute('aria-label','好きな色をえらぶ');
  inp.oninput = ()=>{ draftCover.color = inp.value; box.querySelectorAll('.sw').forEach(x=>x.classList.remove('on')); buildCoverPatterns(); updateCoverPreview(); };
  pick.append(inp); box.append(pick);
}
function updateCoverPreview(){
  const n = DB.notes.find(x=>x.id===editingCoverId);
  const c = $('coverPrev'); const ctx = c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);
  if(draftMode === 'page1' && n){
    drawFirstPage(ctx, n, c.width, c.height);
  } else {
    drawCover(ctx, draftCover, c.width, c.height, n ? n.title : '');
  }
}
document.querySelectorAll('#coverMode .cm-btn').forEach(b=>{
  b.onclick = ()=>{ draftMode = b.dataset.mode; updateCoverMode(); };
});
$('coverApply').onclick = ()=>{
  const n = DB.notes.find(x=>x.id===editingCoverId);
  if(n){
    n.cover = {pattern:draftCover.pattern, color:draftCover.color};
    n.coverMode = draftMode === 'page1' ? 'page1' : 'design';
    n.coverThumb = null; scheduleSave();
  }
  closeCoverSheet(); renderHome();
  toast(draftMode === 'page1' ? '1ページ目を表紙にしました' : '表紙を変更しました');
};
$('coverBg').onclick = closeCoverSheet;

/* ================================================================
   ホーム: ノートを長押しドラッグで並べ替え
================================================================ */
const reorder = { moved:false };  // 直前の操作がドラッグだったか(タップ誤発火防止)
(function initReorder(){
  const grid = $('noteGrid');
  let drag = null;

  grid.addEventListener('pointerdown', e=>{
    if(e.button && e.button !== 0) return;
    const wrap = e.target.closest('.card-wrap');
    if(!wrap || !grid.contains(wrap)) return;
    if(e.target.closest('.del,.cover-edit')) return;
    reorder.moved = false;
    drag = { wrap, startX:e.clientX, startY:e.clientY, active:false,
             pointerId:e.pointerId, holdTimer:null };
    drag.holdTimer = setTimeout(startDrag, 240); // 長押しでドラッグ開始
  });

  function startDrag(){
    if(!drag) return;
    drag.active = true; reorder.moved = true;
    const r = drag.wrap.getBoundingClientRect();
    drag.offX = drag.startX - r.left;
    drag.offY = drag.startY - r.top;
    grid.classList.add('reordering');
    drag.wrap.classList.add('dragging');
    drag.wrap.style.position = 'fixed';
    drag.wrap.style.width = r.width + 'px';
    drag.wrap.style.left = '0'; drag.wrap.style.top = '0';
    moveGhost(drag.startX, drag.startY);
    try{ drag.wrap.setPointerCapture(drag.pointerId); }catch(_){}
    if(navigator.vibrate) navigator.vibrate(10);
  }
  function moveGhost(x, y){
    drag.wrap.style.transform = `translate(${x-drag.offX}px, ${y-drag.offY}px)`;
  }
  function cardUnder(x, y){
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('.card-wrap') : null;
  }

  window.addEventListener('pointermove', e=>{
    if(!drag) return;
    if(!drag.active){
      // 長押し確定前に大きく動いたらスクロール操作とみなしキャンセル
      if(Math.abs(e.clientX-drag.startX) > 10 || Math.abs(e.clientY-drag.startY) > 10){
        clearTimeout(drag.holdTimer); drag = null;
      }
      return;
    }
    e.preventDefault();
    moveGhost(e.clientX, e.clientY);
    const target = cardUnder(e.clientX, e.clientY);
    if(target && target !== drag.wrap){
      const tr = target.getBoundingClientRect();
      const before = e.clientY < tr.top + tr.height/2 ||
        (Math.abs(e.clientY - (tr.top+tr.height/2)) < tr.height*0.3 && e.clientX < tr.left + tr.width/2);
      grid.insertBefore(drag.wrap, before ? target : target.nextSibling);
    }
  }, {passive:false});

  function endDrag(){
    if(!drag) return;
    clearTimeout(drag.holdTimer);
    if(drag.active){
      const w = drag.wrap;
      w.classList.remove('dragging');
      w.style.position = w.style.transform = w.style.left = w.style.top = w.style.width = '';
      grid.classList.remove('reordering');
      try{ w.releasePointerCapture(drag.pointerId); }catch(_){}
      // 新しい並びを order に保存
      [...grid.querySelectorAll('.card-wrap')].forEach((el,i)=>{
        const n = DB.notes.find(x=>x.id===el.dataset.id); if(n) n.order = i;
      });
      scheduleSave();
      setTimeout(()=>{ reorder.moved = false; }, 60); // 直後の click を無効化
    }
    drag = null;
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
})();

(async function init(){
  buildTplSheet();
  await load();
  // 既存ノートに柄×色をローテーションで一括付与(初回1回だけ)。
  // これでどのノートにも最初から柄が入った状態になる。
  if(!DB.coversStyled){
    DB.notes.forEach((n,i)=>{
      n.cover = {
        pattern: COVER_PATTERNS[i % COVER_PATTERNS.length].key,
        color:   COVER_COLORS[(i*3) % COVER_COLORS.length],
      };
      n.coverThumb = null; // 再描画させる
    });
    DB.coversStyled = true;
    saveNow();
  }
  // 表紙の描画は毎回作り直す(古い薄いドット等のキャッシュを残さない)
  DB.notes.forEach(n=>{ n.coverThumb = null; });
  DB.notes.forEach(migrate); // 旧形式を新形式へ
  // order 未設定のノートに、更新日時の新しい順で並び番号を付与
  let maxOrder = DB.notes.reduce((m,n)=> n.order!==undefined ? Math.max(m,n.order) : m, -1);
  [...DB.notes].filter(n=>n.order===undefined)
    .sort((a,b)=>b.updatedAt - a.updatedAt)
    .forEach(n=>{ n.order = ++maxOrder; });
  // 初回(ノートが1件も無い)ときだけ、使い方サンプルを用意
  if(DB.notes.length === 0 && !DB.sampleSeeded){
    const sample = makeSampleNote();
    sample.cover = { pattern:'dot', color: '#F4B8C6' }; // サンプルも柄入りに(ピンク)
    migrate(sample);
    sample.order = 0;
    DB.notes.push(sample);
    DB.sampleSeeded = true;   // 一度削除したら再生成しない
    saveNow();
  }
  renderHome();
})();
