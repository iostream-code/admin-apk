// Pengganti `app.popup.*`. Popup F7 lama ditandai lewat class ".popup-xxx"
// yang dibuka via `app.popup.open('.popup-xxx')` dan ditutup lewat elemen
// ber-class ".popup-close" di dalamnya. Kita pertahankan pola ini persis
// (selector CSS + class .popup-close) supaya markup popup lama (banyak
// dipakai di point_sales.html/point_produksi.html, dst.) bisa dipindah
// nyaris tanpa diubah -- tinggal ganti pembungkus luar F7 (.popup/.view/.page)
// dengan wrapper Tailwind kita. Disalin apa adanya dari inventory-apk/src/lib/popup.js.
//
// Animasi: backdrop fade + panel scale/slide-up (lihat .app-overlay-backdrop
// dan .app-overlay-panel di src/styles/main.css). Durasi HARUS sinkron
// dengan ANIM_MS di bawah dan `duration-200` di CSS.

const ANIM_MS = 200;

export const popup = {
  open(selector) {
    const el = document.querySelector(selector);
    if (!el) {
      console.error('[popup] elemen tidak ditemukan:', selector);
      return;
    }
    el.classList.remove('hidden');
    el.classList.add('flex', 'app-overlay-backdrop');
    document.body.style.overflow = 'hidden';

    el.classList.remove('is-open');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add('is-open'));
    });
  },

  close(selector) {
    const el = selector ? document.querySelector(selector) : document.querySelector('.app-popup.is-open');
    if (!el) return;

    el.classList.remove('is-open');
    document.body.style.overflow = '';

    setTimeout(() => {
      el.classList.add('hidden');
      el.classList.remove('flex');
    }, ANIM_MS);
  },
};

document.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('.popup-close');
  if (closeBtn) {
    const popupEl = closeBtn.closest('.app-popup');
    if (popupEl) popup.close('#' + popupEl.id);
  }
});

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('app-popup') && e.target.classList.contains('is-open')) {
    popup.close('#' + e.target.id);
  }
});
