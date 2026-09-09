// Navbar + tab menu -- markup & perilaku disamakan PERSIS dgn inventory-apk
// (src/lib/shell.js: PRIMARY_TABS/STOCK_SUBTABS/renderShell/showAuthedShell,
// permintaan user 2026-08-26 "kenapa submenunya berpindah ke halaman baru?
// harusnya seperti tab saja, dan posisinya juga bisa langsung dibawah menu
// utamanya"): tab TETAP (bukan halaman submenu tersendiri dgn tombol
// "Kembali" spt sebelumnya) -- klik "Point"/"Finance" pertama kali pindah ke
// sub-halaman default-nya (Sales / Payment), sub-tab (Sales/Produksi atau
// Payment/Payable) muncul LANGSUNG di bawah tab utama & tetap kelihatan
// selama masih di grup itu; klik "Point"/"Finance" LAGI selagi sudah di
// dalam grupnya cuma toggle tampil/sembunyi baris sub-tab (tidak pindah
// halaman) -- pola sama persis dgn tab "STOCK" inventory-apk.
//
// Beda dari inventory-apk: di sana cuma ADA SATU grup bertab (STOCK, 3 tab
// lain PO/PARTNER/LOGO solo tanpa sub-tab). Di sini SEMUA tab adalah grup
// bertab -- isi baris sub-tab jadi tergantung grup mana yang sedang aktif
// (lihat TABS/tabForPath() di bawah), bukan daftar statis tunggal spt
// STOCK_SUBTABS.
//
// [UPDATE 2026-08-26 atas permintaan user, "jadikan 2 tab saja Absen dan
// Ijin"] Absen tadinya solo (langsung ke halaman Validasi, tanpa sub-tab).
// Sekarang jadi grup spt Point/Finance: sub Absen (Validasi Absensi,
// default) & Ijin (Validasi Ijin) -- lihat pages/absen/validasi.js & ijin.js.
//
// [UPDATE 2026-09-09 atas permintaan user, "perbaiki juga struktur menunya,
// jadi menu utama ada Absen, Finance, SJ (diubah jadi Ekspedisi). Lalu menu
// Point taruh di menu Finance, lalu untuk menu di finance urutannya jadi
// Payment, Payable, Sales, dan Point"] Restrukturisasi total:
//   - Tab utama "Point" DIHAPUS -- isinya (Point Sales) dipindah jadi
//     sub-tab ke-4 Finance (path SAMA, `/point/sales`, modul halaman TIDAK
//     berubah, cuma posisi di navigasi). Awalnya Point Produksi/CSS SENGAJA
//     tidak ikut dipindah (dikonfirmasi user, "Point jadi 1 sub-tab tunggal
//     ke Point Sales saja") -- TAPI lihat update di bawah, ini direvisi lagi.
//   - Label tab "SJ" diganti "Ekspedisi" (key internal TETAP 'sj', cuma
//     label tampilan yang berubah -- lihat hasEkspedisiAccess check di
//     showAuthedShell() yg masih cocokkan `tab.key === 'sj'`).
//   - Urutan tab utama: Absen, Finance, Ekspedisi (Point tidak lagi tab
//     sendiri, lihat poin pertama).
//
// [UPDATE 2026-09-09 atas permintaan user, "pada menu Finance>Point
// tambahkan filter untuk Produksi dan CSS agar tetap dapat terlihat sub
// menu yg sebelumnya hilang"] Point Produksi/CSS TERNYATA masih dibutuhkan
// -- daripada bikin level tab ke-3 (sistem tab di file ini cuma didesain 2
// tingkat: utama+sub, lihat docblock atas), keduanya dibuka lewat FILTER
// PILL kecil DI DALAM konten halaman Point sendiri (Sales/Produksi/CSS,
// lihat lib/pointTabs.js, dipasang di pages/point/sales.js|produksi.js|
// css.js) -- bukan baris tab tambahan di shell ini. Konsekuensinya, sub-tab
// "Point" Finance di TABS di bawah perlu `altPaths` (path lain yang TETAP
// dianggap bagian grup Finance & entry "Point" yang sama walau bukan
// `path` utamanya) supaya tab Finance + pill "Point" tetap ter-highlight
// benar saat user pindah ke Produksi/CSS lewat filter pill itu -- lihat
// groupPathsFor()/showAuthedShell() di bawah.

import { Router } from './router.js';
import { logOut } from './auth.js';
import { hasEkspedisiAccess } from './ekspedisiAuth.js';
import { togglePanel, bindNotifPanelEvents } from './firebaseNotif.js';
import { popup } from './popup.js';

const TABS = [
  {
    key: 'absen',
    label: 'Absen',
    sub: [
      // [UPDATE 2026-09-09 atas permintaan user, "untuk submenu Absen ubah
      // jadi Validasi"] Cuma label tampilan -- path & modul halaman
      // (pages/absen/validasi.js) TIDAK berubah.
      { path: '/absen/validasi', label: 'Validasi' },
      { path: '/absen/ijin', label: 'Ijin' },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    sub: [
      // [UPDATE 2026-09-09 atas permintaan user, "Payment menjadi PayCust,
      // Payable jadi Kas, dan Sales jadi Payable"] Cuma label tampilan yg
      // berubah -- path & modul halaman (pages/finance/payment.js|
      // payable.js|sales.js) SAMA PERSIS, TIDAK ikut di-rename.
      { path: '/finance/payment', label: 'PayCust' },
      { path: '/finance/payable', label: 'Kas' },
      // [BARU 2026-09-07 atas permintaan user, "tambahkan fitur uang saku
      // sales di admin-finance-apk ke admin-apk"] Porting tab "Sales" DI
      // DALAM data_transaksi.html legacy (satu halaman dgn Payable) --
      // di sini jadi sub-tab ke-3 SENDIRI, bukan tab di dalam 1 halaman --
      // lihat docblock pages/finance/sales.js. Label sempat "Uang Saku"
      // (menghindari rancu dgn "Point > Sales"), diganti balik ke "Sales"
      // atas permintaan user susulan ("menu uang saku diganti dengan Sales
      // saja") -- konten halaman (klaim uang saku sales) TIDAK berubah,
      // cuma label tab ini. [UPDATE 2026-09-09] Label diganti lagi jadi
      // "Payable" (lihat catatan di atas) -- BUKAN tab yg sama dgn path
      // `/finance/payable` (itu sekarang berlabel "Kas") -- gampang
      // rancu krn label & path-nya sengaja "tertukar", jangan salah edit.
      { path: '/finance/sales', label: 'Payable' },
      // [BARU 2026-09-09 atas permintaan user, "menu Point taruh di menu
      // Finance"] Path & modul halaman SAMA PERSIS dgn tab "Point" lama
      // (pages/point/sales.js) -- cuma dipindah posisi jadi sub-tab ke-4
      // Finance, bukan tab utama sendiri lagi.
      // `altPaths` (BARU, update Produksi/CSS via filter pill di dalam
      // halaman, lihat docblock panjang di atas TABS) -- BUKAN sub-tab
      // terpisah, cuma daftar path LAIN yang tetap dianggap "masih di
      // entry Point/grup Finance ini" (dipakai groupPathsFor() &
      // showAuthedShell() di bawah), supaya tab Finance + pill "Point"
      // tetap ter-highlight benar walau activePath-nya /point/produksi
      // atau /point/css, bukan /point/sales.
      { path: '/point/sales', label: 'Point', altPaths: ['/point/produksi', '/point/css'] },
    ],
  },
  // [BARU 2026-09-07 atas permintaan user, "tambahkan menu baru yaitu SJ
  // yang diambil dari menu SJ yg ada di ekspedisi-apk"] Awalnya tab SOLO
  // (listing SJ Customer saja, lihat docblock lama pages/sj/list.js).
  // [UPDATE 2026-09-09 atas permintaan user, "pastikan admin juga bisa
  // menambahkan SJ baik customer, PO, maupun retur seperti yg ada di
  // ekspedisi-apk"] Jadi grup bertab spt Point/Absen/Finance -- 3 sub-tab
  // Customer/PO/Retur, tiap sub-tab py listing + tombol "+ Buat SJ" sendiri
  // (pages/sj/list.js, listPo.js, listRetur.js). Halaman CREATE (/sj/new,
  // /sj/po/new, /sj/retur-po/new) SENGAJA tidak didaftarkan di sini (bukan
  // sub-tab sendiri) -- ketiganya panggil showAuthedShell() dgn path listing
  // induknya supaya sub-tab yg relevan tetap ter-highlight selama isi form.
  // Disembunyikan (bukan cuma nonaktif) di showAuthedShell() di bawah kalau
  // akun ini tidak terdaftar sbg admin Ekspedisi (`ekspedisi_m_admin_access`)
  // -- lihat docblock panjang App\Admin\Controllers\AuthController::
  // isEkspedisiAdmin() (backend-migrasi) & lib/ekspedisiAuth.js soal token
  // terpisah modul ini.
  // [UPDATE 2026-09-09 atas permintaan user] Label tab diganti "SJ" ->
  // "Ekspedisi" (restrukturisasi menu) -- key internal 'sj' SENGAJA TETAP
  // dipertahankan (showAuthedShell() di bawah masih cocokkan `tab.key ===
  // 'sj'` utk sembunyikan tab ini kalau akun bukan admin Ekspedisi).
  {
    key: 'sj',
    label: 'Ekspedisi',
    sub: [
      { path: '/sj', label: 'Customer' },
      { path: '/sj/po', label: 'PO' },
      { path: '/sj/retur-po', label: 'Retur' },
    ],
  },
];

function defaultPathFor(tab) {
  return tab.sub ? tab.sub[0].path : tab.path;
}

// `altPaths` (lihat entry "Point" Finance di TABS) ikut dianggap bagian
// grup ini juga -- flatMap, bukan cuma `s.path`, supaya tabForPath() masih
// mengenali /point/produksi & /point/css sbg grup Finance.
function groupPathsFor(tab) {
  return tab.sub ? tab.sub.flatMap((s) => [s.path, ...(s.altPaths || [])]) : [tab.path];
}

function tabForPath(path) {
  return TABS.find((t) => groupPathsFor(t).includes(path));
}

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function formatClockDate(d) {
  const year = String(d.getFullYear()).slice(-2);
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${year}`;
}
function formatClockTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function renderShell() {
  const navbar = document.getElementById('app-navbar');

  // Gradient biru persis finance-apk (.bg-dark-gray-medium: "linear-gradient(315deg,
  // #14418F, #056BBC)", #056BBC = primary DEFAULT di tailwind.config.js) --
  // disamakan arahnya dgn utility Tailwind bg-gradient-to-br (kanan-bawah,
  // setara 315deg). Judul navbar STATIS "Admin" (sama pola dgn inventory-apk,
  // navbar-nya juga selalu "Inventory" apa pun tab/halaman aktif -- tab yg
  // menunjukkan section saat ini, bukan navbar).
  navbar.innerHTML = `
    <div class="flex items-center justify-between bg-gradient-to-br from-[#14418F] to-primary px-3 py-2 shadow-card text-white">
      <div class="flex min-w-0 items-center gap-2">
        <div id="box_internet" class="connection-indicator" title="Status koneksi"></div>
        <div class="min-w-0">
          <p class="truncate font-heading text-lg font-semibold leading-none text-white">Admin</p>
          <p id="karyawan_nama_header" class="mt-0.5 truncate text-xs text-white/70"></p>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-3">
        <!-- [BARU 2026-09-07 atas permintaan user, "pastikan firebasenya
             juga sudah terinstall"] Lonceng notifikasi -- markup & perilaku
             disalin PERSIS dari finance-v2-apk (lib/firebaseNotif.js,
             togglePanel()/bindNotifPanelEvents() di bawah). -->
        <button id="btn-notif" title="Notifikasi" aria-label="Notifikasi"
          class="relative flex h-9 w-auto shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white active:scale-95">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          <span id="notif-badge"
          class="hidden absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-[10px] font-bold leading-4 text-center text-white"></span>
        </button>
        <div class="text-right leading-tight text-white/80">
          <p id="clock_date" class="text-[11px] font-medium"></p>
          <p id="clock_time" class="text-xs font-semibold tabular-nums"></p>
        </div>
        <button id="btn-logout" title="Keluar" aria-label="Keluar"
          class="flex h-9 w-auto shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white active:scale-95">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </div>
  `;

  document.getElementById('btn-logout').addEventListener('click', () => logOut());

  renderNotifPanel();
  document.getElementById('btn-notif').addEventListener('click', () => {
    togglePanel();
    popup.open('#popup-notifikasi');
  });

  const tabs = document.getElementById('app-tabs');
  tabs.innerHTML = `
    <div>
      <div id="tabs-primary" class="flex gap-1 px-1.5 py-1 bg-white border-b border-ink-faint">
        ${TABS.map((t) => `
          <a href="#${defaultPathFor(t)}" data-key="${t.key}"
             class="hnt-tab-primary flex-1 text-center text-xs font-bold py-2 rounded-md bg-slate-100 text-slate-700">
            ${t.label}
          </a>
        `).join('')}
      </div>
      <div id="tabs-secondary" class="hidden flex gap-1 px-1.5 py-1 bg-surface-raised border-b border-ink-faint"></div>
    </div>
  `;

  tabs.querySelectorAll('.hnt-tab-primary').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = TABS.find((t) => t.key === a.dataset.key);
      if (tab.sub) {
        // Klik grup (Point/Finance) saat belum di dalam grup itu → masuk ke
        // sub-halaman default-nya. Klik saat SUDAH di dalam grup → tetap di
        // halaman saat ini, cuma buka/tutup baris sub-tab (memudahkan
        // re-lihat pilihan tanpa pindah halaman) -- pola sama persis dgn
        // tab STOCK inventory-apk.
        if (!groupPathsFor(tab).includes(Router.currentRoute.url)) {
          Router.navigate(defaultPathFor(tab));
        } else {
          document.getElementById('tabs-secondary').classList.toggle('hidden');
        }
      } else {
        Router.navigate(tab.path);
      }
    });
  });

  startClock();
}

export function showAuthedShell(activePath) {
  document.getElementById('app-navbar').classList.remove('hidden');
  document.getElementById('app-tabs').classList.remove('hidden');
  document.getElementById('karyawan_nama_header').textContent = localStorage.getItem('karyawan_nama') || '';

  const activeTab = tabForPath(activePath);
  const ekspedisiAccess = hasEkspedisiAccess();

  document.querySelectorAll('.hnt-tab-primary').forEach((a) => {
    const tab = TABS.find((t) => t.key === a.dataset.key);
    // Tab "SJ" disembunyikan total kalau akun ini tidak punya token
    // ekspedisi -- lihat catatan di TABS di atas.
    a.classList.toggle('hidden', tab.key === 'sj' && !ekspedisiAccess);
    const active = tab === activeTab;
    a.classList.toggle('bg-primary', active);
    a.classList.toggle('text-white', active);
    a.classList.toggle('bg-slate-100', !active);
    a.classList.toggle('text-slate-700', !active);
  });

  // Isi baris sub-tab TERGANTUNG grup mana yg aktif (Point atau Finance) --
  // dirender ulang tiap pindah halaman, beda dari STOCK_SUBTABS inventory-apk
  // yang statis krn cuma py satu grup. Tab tanpa sub (Absen) -> baris ini
  // disembunyikan & dikosongkan total.
  const secondaryRow = document.getElementById('tabs-secondary');
  if (activeTab && activeTab.sub) {
    secondaryRow.innerHTML = activeTab.sub.map((s) => `
      <a href="#${s.path}" data-path="${s.path}"
         class="hnt-tab-secondary flex-1 text-center text-[11px] font-bold py-1.5 rounded text-slate-700">
        ${s.label}
      </a>
    `).join('');
    secondaryRow.querySelectorAll('.hnt-tab-secondary').forEach((a) => {
      // `altPaths` (mis. entry "Point": /point/produksi & /point/css lewat
      // filter pill di dalam halaman, lihat docblock panjang di atas TABS)
      // ikut dianggap "masih di pill ini" -- bukan cuma cocokkan persis
      // s.path, supaya pill "Point" tetap ke-highlight walau activePath-nya
      // salah satu altPaths, bukan path utamanya.
      const sub = activeTab.sub.find((s) => s.path === a.dataset.path);
      const active = !!sub && [sub.path, ...(sub.altPaths || [])].includes(activePath);
      a.classList.toggle('bg-primary', active);
      a.classList.toggle('text-white', active);
      a.classList.toggle('text-slate-700', !active);
      a.addEventListener('click', (e) => {
        e.preventDefault();
        Router.navigate(a.dataset.path);
      });
    });
    secondaryRow.classList.remove('hidden');
  } else {
    secondaryRow.innerHTML = '';
    secondaryRow.classList.add('hidden');
  }
}

export function hideAuthedShell() {
  document.getElementById('app-navbar').classList.add('hidden');
  document.getElementById('app-tabs').classList.add('hidden');
}

// Popup daftar notifikasi -- markup ditaruh di #app-overlays (pola sama dgn
// finance-v2-apk), dirender sekali saat renderShell() (bukan tiap navigasi
// halaman spt tabs-secondary di atas). Isi list-nya (#notif-list) diisi
// lib/firebaseNotif.js::fetchNotifications(), dipanggil tiap panel dibuka.
function renderNotifPanel() {
  const overlays = document.getElementById('app-overlays');
  if (document.getElementById('popup-notifikasi')) return; // renderShell() cuma sekali, tapi jaga-jaga

  const el = document.createElement('div');
  el.innerHTML = `
    <div id="popup-notifikasi"
      class="app-popup hidden fixed inset-0 z-[100] items-end sm:items-center justify-center bg-black/40">
      <div class="app-overlay-panel bg-surface w-full sm:max-w-sm sm:rounded-lg rounded-t-lg h-[75vh] sm:h-[70vh] overflow-hidden flex flex-col">
        <div class="flex items-center justify-between px-4 py-3 border-b border-ink-faint shrink-0">
          <div class="font-bold text-ink-primary text-sm">Notifikasi</div>
          <div class="flex items-center gap-3">
            <button id="notif-mark-all" class="text-[11px] font-semibold text-primary">Tandai semua dibaca</button>
            <button class="popup-close text-ink-secondary text-xl leading-none">&times;</button>
          </div>
        </div>
        <ul id="notif-list" class="flex-1 overflow-y-auto"></ul>
      </div>
    </div>
  `;
  overlays.appendChild(el.firstElementChild);

  bindNotifPanelEvents();
}

let clockTimer = null;
function startClock() {
  if (clockTimer) clearInterval(clockTimer);
  const dateEl = document.getElementById('clock_date');
  const timeEl = document.getElementById('clock_time');
  const tick = () => {
    const now = new Date();
    dateEl.textContent = formatClockDate(now);
    timeEl.textContent = formatClockTime(now);
  };
  tick();
  clockTimer = setInterval(tick, 1000);
}
