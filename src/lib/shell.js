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
// lain PO/PARTNER/LOGO solo tanpa sub-tab). Di sini SEMUA TIGA tab (Point,
// Absen, Finance) adalah grup bertab -- isi baris sub-tab jadi tergantung
// grup mana yang sedang aktif (lihat TABS/tabForPath() di bawah), bukan
// daftar statis tunggal spt STOCK_SUBTABS.
//
// [UPDATE 2026-08-26 atas permintaan user, "jadikan 2 tab saja Absen dan
// Ijin"] Absen tadinya solo (langsung ke halaman Validasi, tanpa sub-tab).
// Sekarang jadi grup spt Point/Finance: sub Absen (Validasi Absensi,
// default) & Ijin (Validasi Ijin) -- lihat pages/absen/validasi.js & ijin.js.

import { Router } from './router.js';
import { logOut } from './auth.js';

const TABS = [
  {
    key: 'point',
    label: 'Point',
    sub: [
      { path: '/point/sales', label: 'Sales' },
      { path: '/point/produksi', label: 'Produksi' },
    ],
  },
  {
    key: 'absen',
    label: 'Absen',
    sub: [
      { path: '/absen/validasi', label: 'Absen' },
      { path: '/absen/ijin', label: 'Ijin' },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    sub: [
      { path: '/finance/payment', label: 'Payment' },
      { path: '/finance/payable', label: 'Payable' },
    ],
  },
];

function defaultPathFor(tab) {
  return tab.sub ? tab.sub[0].path : tab.path;
}

function groupPathsFor(tab) {
  return tab.sub ? tab.sub.map((s) => s.path) : [tab.path];
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
        <div class="text-right leading-tight text-white/80">
          <p id="clock_date" class="text-[11px] font-medium"></p>
          <p id="clock_time" class="text-xs font-semibold tabular-nums"></p>
        </div>
        <button id="btn-logout" title="Keluar" aria-label="Keluar"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white active:scale-95">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </div>
  `;

  document.getElementById('btn-logout').addEventListener('click', () => logOut());

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

  document.querySelectorAll('.hnt-tab-primary').forEach((a) => {
    const tab = TABS.find((t) => t.key === a.dataset.key);
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
      const active = a.dataset.path === activePath;
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
