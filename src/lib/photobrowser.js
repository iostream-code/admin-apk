// Pengganti `app.photoBrowser.create({photos:[...]}).open()` -- dipakai utk
// preview/zoom foto di SEMUA menu (logo customer & foto produk di Point
// Sales/CSS, bukti pembayaran/mutasi di Payment, bukti Uang Saku, foto SJ,
// lampiran Ijin, dst -- lihat `grep -rl photoBrowser src/pages`). Awalnya
// disalin apa adanya dari inventory-apk/src/lib/photobrowser.js (lightbox 1
// gambar, TANPA kontrol apa pun selain tutup).
//
// [DIPERKAYA 2026-09-07 atas permintaan user, "pastikan untuk semua fitur
// preview gambar di semua menu punya fitur untuk zoom in/out dan rotate"]
// Semua pemanggil SUDAH lewat satu modul ini (window.app.photoBrowser, lihat
// app-shim.js) -- jadi kontrol zoom/rotate cukup ditambah SEKALI di sini,
// otomatis berlaku ke semua menu di atas TANPA perlu ubah pemanggilnya
// sama sekali (signature `create({photos}).open()` TIDAK berubah).
//
// Kontrol: tombol +/- (step 25%, 100%-400%), tombol Putar (90 derajat per
// klik), tombol Reset, + gesture: pinch 2 jari (zoom), drag 1 jari saat
// sudah di-zoom (pan), double-tap/double-click gambar (toggle 100%<->200%),
// scroll wheel di browser (zoom, memudahkan dev/testing). Ditulis pakai
// Pointer Events (BUKAN Touch/Mouse Events terpisah) -- satu set handler utk
// mouse (browser dev) & touch (device asli), termasuk multi-pointer utk
// pinch.
//
// [PENTING] Transform zoom/rotate/pan ditaruh di elemen <img> SENDIRI
// (`#pb_img`, inline style.transform, lihat applyTransform()) -- BUKAN di
// elemen ber-class `.app-overlay-panel` (animasi buka/tutup popup, lihat
// main.css) spt awalnya. Class itu SEKARANG dipindah ke wrapper `#pb_panel`
// yang membungkus stage+toolbar -- kalau ditaruh di elemen yang SAMA dgn
// `#pb_img`, inline style.transform kita akan bentrok/ketimpa transisi
// `scale-95`/`translate-y-3` Tailwind milik class itu (sama-sama menulis CSS
// property `transform`).

const overlays = document.getElementById('app-overlays');
const ANIM_MS = 200;
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.5;
const DOUBLE_TAP_MS = 300;
const DRAG_THRESHOLD_PX = 4;

const ICON_MINUS = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const ICON_PLUS = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const ICON_ROTATE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>`;
const ICON_RESET = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;

function distance(pts) {
  const [a, b] = pts;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export const photoBrowser = {
  create({ photos = [] } = {}) {
    return {
      open() {
        if (!photos.length) return;

        let scale = 1;
        let rotation = 0; // derajat, kelipatan 90
        let translateX = 0;
        let translateY = 0;

        const el = document.createElement('div');
        el.className = 'app-overlay-backdrop fixed inset-0 z-[250] bg-black/90';
        el.innerHTML = `
          <div id="pb_panel" class="app-overlay-panel flex h-full w-full flex-col">
            <div id="pb_stage" class="relative flex-1 overflow-hidden flex items-center justify-center" style="touch-action:none;">
              <img id="pb_img" src="${photos[0]}" draggable="false"
                class="max-w-full max-h-full object-contain select-none pb-img" />
            </div>
            <div class="relative z-10 flex items-center justify-center gap-2 pb-6 pt-2">
              <button id="pb_zoom_out" title="Perkecil" class="pb-ctrl-btn">${ICON_MINUS}</button>
              <span id="pb_zoom_label" class="min-w-[3.5rem] text-center text-xs font-semibold text-white">100%</span>
              <button id="pb_zoom_in" title="Perbesar" class="pb-ctrl-btn">${ICON_PLUS}</button>
              <button id="pb_rotate" title="Putar" class="pb-ctrl-btn ml-2">${ICON_ROTATE}</button>
              <button id="pb_reset" title="Reset" class="pb-ctrl-btn">${ICON_RESET}</button>
            </div>
          </div>
          <button id="pb_close" aria-label="Tutup" class="absolute top-4 right-4 z-10 text-white text-2xl leading-none">&times;</button>
        `;

        const img = el.querySelector('#pb_img');
        const stage = el.querySelector('#pb_stage');
        const zoomLabel = el.querySelector('#pb_zoom_label');

        function applyTransform() {
          // Urutan WAJIB translate-scale-rotate (translate paling luar) --
          // supaya tx/ty tetap dalam satuan PIKSEL LAYAR (screen space) apa
          // pun scale-nya saat ini, sehingga drag 1px gerakan jari = 1px
          // gerakan gambar, tidak ikut membesar/mengecil saat di-zoom.
          img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${rotation}deg)`;
          img.style.cursor = scale > ZOOM_MIN ? 'grab' : 'zoom-in';
        }

        function setScale(next) {
          scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
          if (scale === ZOOM_MIN) {
            translateX = 0;
            translateY = 0;
          }
          zoomLabel.textContent = Math.round(scale * 100) + '%';
          applyTransform();
        }

        function resetAll() {
          scale = 1;
          rotation = 0;
          translateX = 0;
          translateY = 0;
          zoomLabel.textContent = '100%';
          applyTransform();
        }

        el.querySelector('#pb_zoom_out').addEventListener('click', () => setScale(scale - ZOOM_STEP));
        el.querySelector('#pb_zoom_in').addEventListener('click', () => setScale(scale + ZOOM_STEP));
        el.querySelector('#pb_rotate').addEventListener('click', () => {
          rotation = (rotation + 90) % 360;
          applyTransform();
        });
        el.querySelector('#pb_reset').addEventListener('click', resetAll);

        // Scroll wheel (browser dev/testing) -- device asli pakai pinch, di
        // bawah.
        stage.addEventListener('wheel', (e) => {
          e.preventDefault();
          setScale(scale + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
        }, { passive: false });

        // ===========================================================
        // Pointer Events -- satu set handler utk mouse (browser) & touch
        // (device asli), termasuk multi-pointer utk pinch 2 jari.
        // ===========================================================
        const activePointers = new Map(); // pointerId -> {x, y}
        let dragStart = null; // {x, y, tx, ty} -- drag 1 jari (pan)
        let pinchStartDistance = null;
        let pinchStartScale = 1;
        let didDrag = false;
        let lastTapAt = 0;

        function pointsFromMap() {
          return Array.from(activePointers.values());
        }

        img.addEventListener('pointerdown', (e) => {
          img.setPointerCapture(e.pointerId);
          activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          didDrag = false;
          // Matikan transisi CSS (.pb-img) SELAMA gesture jari aktif --
          // supaya pan/pinch mengikuti jari 1:1 tanpa lag. Dinyalakan lagi
          // di endPointer() begitu jari diangkat, supaya perubahan lewat
          // TOMBOL (+/-/putar/reset) & toggle double-tap tetap halus.
          img.style.transition = 'none';

          if (activePointers.size === 2) {
            dragStart = null;
            pinchStartDistance = distance(pointsFromMap());
            pinchStartScale = scale;
          } else if (activePointers.size === 1) {
            dragStart = { x: e.clientX, y: e.clientY, tx: translateX, ty: translateY };
          }
        });

        img.addEventListener('pointermove', (e) => {
          if (!activePointers.has(e.pointerId)) return;
          activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

          if (activePointers.size === 2 && pinchStartDistance) {
            const ratio = distance(pointsFromMap()) / pinchStartDistance;
            setScale(pinchStartScale * ratio);
            return;
          }

          if (activePointers.size === 1 && dragStart && scale > ZOOM_MIN) {
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;
            if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) didDrag = true;
            translateX = dragStart.tx + dx;
            translateY = dragStart.ty + dy;
            applyTransform();
          }
        });

        function endPointer(e) {
          activePointers.delete(e.pointerId);
          if (activePointers.size < 2) pinchStartDistance = null;

          if (activePointers.size === 0) {
            img.style.transition = ''; // balikin ke transisi CSS .pb-img default
            if (!didDrag) {
              const now = Date.now();
              if (now - lastTapAt < DOUBLE_TAP_MS) {
                setScale(scale > ZOOM_MIN ? ZOOM_MIN : 2);
                lastTapAt = 0;
              } else {
                lastTapAt = now;
              }
            }
            dragStart = null;
            didDrag = false;
          }
        }
        img.addEventListener('pointerup', endPointer);
        img.addEventListener('pointercancel', endPointer);

        // ===========================================================
        // Tutup
        // ===========================================================
        const close = () => {
          el.classList.remove('is-open');
          document.body.style.overflow = '';
          setTimeout(() => el.remove(), ANIM_MS);
        };
        el.querySelector('#pb_close').addEventListener('click', close);
        // Tap area gelap di sekitar gambar (bukan gambarnya sendiri, itu
        // dipakai gesture zoom/pan di atas) -- tutup lightbox.
        stage.addEventListener('click', (e) => { if (e.target === stage) close(); });

        overlays.appendChild(el);
        document.body.style.overflow = 'hidden';

        requestAnimationFrame(() => {
          requestAnimationFrame(() => el.classList.add('is-open'));
        });
      },
    };
  },
};
