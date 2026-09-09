import $ from 'jquery';
window.$ = window.jQuery = $;

import './styles/main.css';
import './lib/app-shim.js'; // harus di-import sebelum page module manapun (menyediakan window.app)

import { Router, startRouter } from './lib/router.js';
import { renderShell } from './lib/shell.js';
import { checkLogin, initAuthInterceptor } from './lib/auth.js';
import { startVersionCheck } from './lib/version-check.js';
import { initFirebaseNotif } from './lib/firebaseNotif.js';

// Auto-attach Authorization: Bearer ke semua panggilan /admin/* -- lihat
// docblock lib/auth.js. WAJIB dipasang sebelum route manapun mount (pola
// sama persis finance-v2-apk/ekspedisi-apk/inventory-apk).
initAuthInterceptor();

import * as LoginPage from './pages/login/login.js';
import * as PointSalesPage from './pages/point/sales.js';
import * as PointProduksiPage from './pages/point/produksi.js';
import * as PointCssPage from './pages/point/css.js';
import * as AbsenValidasiPage from './pages/absen/validasi.js';
import * as AbsenIjinPage from './pages/absen/ijin.js';
import * as FinancePaymentPage from './pages/finance/payment.js';
import * as FinancePayablePage from './pages/finance/payable.js';
import * as FinanceSalesPage from './pages/finance/sales.js';
import * as SjListPage from './pages/sj/list.js';
import * as SjListPoPage from './pages/sj/listPo.js';
import * as SjListReturPage from './pages/sj/listRetur.js';
import * as SjNewPage from './pages/sj/new.js';
import * as SjNewPoPage from './pages/sj/newPo.js';
import * as SjNewReturPage from './pages/sj/newRetur.js';

// Point Sales, Point Produksi, Absen (Validasi Absensi + Validasi Ijin) &
// Finance (Payment + Payable) SUDAH diporting (2026-08-26, lihat komentar
// scope di masing2 file pages/point/*.js, pages/absen/*.js,
// pages/finance/*.js). Finance Payable READ-ONLY saja pass ini & endpoint-nya
// SENGAJA belum disambungkan (BACKEND_CONFIRMED=false di payable.js) --
// lihat catatan panjang di file itu soal endpoint kas/accounting yang
// tampaknya belum ada di backend-production ini.
// [BARU 2026-09-07] Finance > Uang Saku (pages/finance/sales.{js,html}) --
// porting fitur "uang saku Sales" (tab "Sales" DI DALAM data_transaksi.html
// legacy, satu halaman dgn Payable) jadi route sendiri. "Assign Kendaraan"
// (fitur lain yg kebetulan ditaruh di popup yg sama di app lama) SENGAJA
// TIDAK ikut diporting -- lihat docblock pages/finance/sales.js.

renderShell();

Router.register('/login', {
  mount: (container) => LoginPage.mount(container),
});

function authedRoute(PageModule) {
  return {
    mount: (container) => {
      if (!checkLogin()) { Router.navigate('/login'); return () => { }; }
      return PageModule.mount(container);
    },
  };
}

// Navigasi sepenuhnya lewat tab tetap (lib/shell.js: Point/Absen/Finance +
// sub-tab Sales/Produksi atau Payment/Payable) -- TIDAK ADA lagi halaman
// hub/submenu tersendiri (permintaan user 2026-08-26, "harusnya seperti tab
// saja, posisinya langsung dibawah menu utamanya"). Modul admin-finance-apk
// lain yang tidak disebut user (Point Admin, Point SJ + History-nya, Absensi
// Sales, Data Gaji / Gaji Sales / Gaji Borongan, Data Transaksi lama,
// Notifikasi) SENGAJA dibuang, bukan cuma disembunyikan -- cek riwayat git
// file ini kalau nanti dibutuhkan lagi.
Router.register('/point/sales', authedRoute(PointSalesPage));
Router.register('/point/produksi', authedRoute(PointProduksiPage));
Router.register('/point/css', authedRoute(PointCssPage));
Router.register('/absen/validasi', authedRoute(AbsenValidasiPage));
Router.register('/absen/ijin', authedRoute(AbsenIjinPage));
Router.register('/finance/payment', authedRoute(FinancePaymentPage));
Router.register('/finance/payable', authedRoute(FinancePayablePage));
Router.register('/finance/sales', authedRoute(FinanceSalesPage));
Router.register('/sj', authedRoute(SjListPage));
Router.register('/sj/po', authedRoute(SjListPoPage));
Router.register('/sj/retur-po', authedRoute(SjListReturPage));
Router.register('/sj/new', authedRoute(SjNewPage));
Router.register('/sj/po/new', authedRoute(SjNewPoPage));
Router.register('/sj/retur-po/new', authedRoute(SjNewReturPage));

// Landing default = /point/sales (sub-halaman pertama grup Point) -- pola
// sama dgn inventory-apk (default '/home', sub-halaman pertama grup STOCK).
startRouter(checkLogin() ? '/point/sales' : '/login');

// Refresh halaman saat masih login (bukan baru login) juga tetap perlu
// version-check jalan -- login.js hanya start-kan untuk kasus baru login.
if (checkLogin()) startVersionCheck();

// [BARU 2026-09-07 atas permintaan user, "pastikan firebasenya juga sudah
// terinstall"] forceRefresh=false -- refresh halaman/buka app lagi selagi
// masih login, cuma pasang listener + refresh badge, TANPA minta izin ulang
// (login.js sudah startkan versi forceRefresh=true utk kasus baru login).
// Sama alasannya utk startVersionCheck() di atas.
if (checkLogin()) initFirebaseNotif(localStorage.getItem('user_id'), false);
