// "Kompatibilitas shim" -- supaya file JS lama dari admin-finance-apk
// (point_sales.js, point_produksi.js, point_admin.js, point_sj.js,
// absen.js, absen_sales.js, absen_borongan.js, data_gaji*.js,
// data_transaksi.js, history_point_*.js, kunjungan_sales.js, notif.js) yang
// masih memanggil `app.dialog.alert(...)`, `app.views.main.router.navigate(...)`,
// dst. bisa dipindah ke sini belakangan dengan perubahan seminim mungkin,
// TANPA harus menulis ulang setiap pemanggilan `app.*` satu per satu.
//
// Ini bukan berarti kita masih pakai Framework7 -- semua implementasi di
// balik `app.dialog`, dst. adalah kode kita sendiri (lihat dialog.js/toast.js).
// Pola & bentuk file disalin dari inventory-apk/src/lib/app-shim.js.
//
// `app.popup`/`app.photoBrowser` ditambah 2026-08-26 saat porting Point
// Sales/Produksi (banyak popup: detail SPK, validasi client, kirim alamat,
// zoom foto produk/logo) -- pola sama persis dgn inventory-apk.

import { dialog } from './dialog.js';
import { toast } from './toast.js';
import { popup } from './popup.js';
import { photoBrowser } from './photobrowser.js';
import { Router } from './router.js';

window.app = {
  dialog,
  toast,
  popup,
  photoBrowser,
  views: {
    main: {
      router: {
        navigate: (path, opts) => Router.navigate(path, opts),
        get currentRoute() { return Router.currentRoute; },
      },
    },
  },
};
