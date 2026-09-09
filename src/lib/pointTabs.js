// Filter pill Sales/Produksi/CSS DI DALAM konten halaman Point -- BUKAN
// baris sub-tab shell (shell.js cuma didesain 2 tingkat: tab utama+sub,
// lihat docblock panjang di sana) -- dipasang di dalam konten tiap halaman
// pages/point/{sales,produksi,css}.js sendiri.
//
// [BARU 2026-09-09 atas permintaan user, "pada menu Finance>Point tambahkan
// filter untuk Produksi dan CSS agar tetap dapat terlihat sub menu yg
// sebelumnya hilang"] Sejak Point dipindah jadi 1 sub-tab tunggal Finance
// (ke /point/sales saja, lihat lib/shell.js), Produksi & CSS sempat TIDAK
// ADA tempat lagi di tab manapun. Filter pill ini pengganti akses itu, TANPA
// menambah tingkat tab baru di shell -- shell.js sendiri diberi `altPaths`
// (lihat entry "Point" Finance di TABS) supaya tab Finance & pill "Point"
// tetap ter-highlight benar walau lagi di /point/produksi atau /point/css.

import { Router } from './router.js';

const ITEMS = [
  { key: 'sales', path: '/point/sales', label: 'Sales' },
  { key: 'produksi', path: '/point/produksi', label: 'Produksi' },
  { key: 'css', path: '/point/css', label: 'CSS' },
];

/**
 * Sisipkan baris filter pill di PALING ATAS `container` (sebelum konten
 * halaman sendiri) & pasang klik-nya. Dipanggil tiap mount(), sesudah
 * `container.innerHTML = tpl`.
 */
export function mountPointFilter(container, activeKey) {
  const el = document.createElement('div');
  el.className = 'px-3 pt-3 pb-1 flex gap-1.5';
  el.innerHTML = ITEMS.map((it) => `
    <a href="#${it.path}" data-path="${it.path}"
       class="point-filter-pill flex-1 text-center text-xs font-bold py-1.5 rounded-md ${it.key === activeKey ? 'bg-primary text-white' : 'bg-surface-raised text-ink-secondary'}">
      ${it.label}
    </a>
  `).join('');

  container.insertBefore(el, container.firstChild);

  el.querySelectorAll('.point-filter-pill').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      Router.navigate(a.dataset.path);
    });
  });
}
