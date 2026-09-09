// Status login + token JWT -- porting dari admin-finance-apk/www/js/global.js
// (checkLogin/logOut), disamakan bentuk filenya dgn auth.js ekspedisi-apk/
// inventory-apk/finance-v2-apk (file terpisah, bukan digabung ke config.js).
//
// [DIKERASKAN 2026-09-07, cutover ke backend-migrasi] SEBELUMNYA file ini
// TIDAK py token/interceptor sama sekali (backend-production yg dipanggil
// app ini dulu tidak pakai skema Bearer) -- SEKARANG modul Admin
// backend-migrasi WAJIB `Authorization: Bearer <token>` di semua endpoint
// KECUALI `/admin/login` (App\Middleware\AuthMiddleware). initAuthInterceptor()
// & getToken() disalin dari finance-v2-apk/src/lib/auth.js (satu keluarga
// pola JWT lintas app di workspace ini). Tanpa ini, login akan "berhasil"
// tapi panggilan data berikutnya (Point/Ijin/Finance) langsung 401.
//
// [PENTING] 3 kelompok endpoint (Absen Validasi, 2 aksi tulis Payment,
// Finance > Uang Saku -- lihat catatan panjang di lib/config.js) SEMENTARA
// masih panggil `APP_CONFIG.BACKEND_PRODUCTION_URL` langsung, BUKAN
// `API_BASE_URL` -- interceptor ini TIDAK memasang header Authorization ke
// situ (host & path beda, tidak match AUTHED_PATH_PREFIXES di bawah),
// backend-production memang tidak butuh itu.

import { cleanupFirebaseNotif } from './firebaseNotif.js';

const TOKEN_KEY = 'token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

export function checkLogin() {
  if (localStorage.getItem('login') !== 'true') return false;
  if (!getToken()) return false;
  return true;
}

export function logOut() {
  // SEBELUM localStorage.clear() -- cleanupFirebaseNotif() masih butuh
  // userId lama utk unregister token FCM di server, pola sama persis
  // finance-v2-apk.
  cleanupFirebaseNotif();
  localStorage.clear();
  // window.location.hash (bukan window.location.href = '/login') -- app ini jalan
  // di Cordova WebView (file://), href absolut ke path polos akan gagal (mencoba
  // load file:///login yg tidak ada). Hash tetap memicu router lewat hashchange
  // (lihat router.js) tanpa reload dokumen. Pola sama persis dgn inventory-apk.
  window.location.hash = '/login';
  window.location.reload();
}

// Prefix modul backend-migrasi yang butuh JWT Bearer -- API_BASE_URL app ini
// sudah termasuk '/admin' (lihat config.js), jadi cukup cocokkan path itu.
// Ditulis eksplisit (bukan "semua ajax call tanpa syarat") supaya panggilan
// ke BACKEND_PRODUCTION_URL (3 kelompok endpoint yang belum dipindah, lihat
// catatan di config.js) TIDAK ikut kebawa header ini.
const AUTHED_PATH_PREFIXES = ['/admin'];

// [FIX 2026-09-07, "perbaiki API untuk halaman SJ karena masih muncul eror
// 403"] SEBELUMNYA dicocokkan pakai `url.indexOf(p)` (substring, MUNCUL DI
// MANA SAJA di URL) -- panggilan menu SJ ke EKSPEDISI_API_BASE_URL
// ('.../ekspedisi/admin/sj...', lihat pages/sj/list.js) KEBETULAN
// MENGANDUNG '/admin' juga (persis sesudah '/ekspedisi'), jadi prefilter di
// bawah ikut kepicu & MENIMPA header Authorization yang sudah dipasang
// ekspedisiAjax() (lib/ekspedisiAuth.js, token TERPISAH) dengan token sesi
// login UTAMA (role = kode jabatan mentah, BUKAN literal 'admin') --
// backend Ekspedisi (App\Ekspedisi\Middleware\AdminOnlyMiddleware) menolak
// token itu -> 403. Sekarang dicocokkan thd PATHNAME URL saja & WAJIB di
// AWAL path (bukan substring di tengah) -- pathname '/ekspedisi/admin/sj'
// TIDAK startsWith('/admin'), jadi tidak lagi ikut match.
function isAuthedPath(url) {
  if (!url) return false;
  let pathname;
  try {
    pathname = new URL(url, window.location.href).pathname;
  } catch (e) {
    return false;
  }
  return AUTHED_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * Pasang sekali di main.js (sebelum route manapun mount). Dua hal:
 *
 * 1. `ajaxPrefilter` di-scope ke AUTHED_PATH_PREFIXES. Token kosong (belum
 *    login, atau sedang di endpoint .../login itu sendiri) -> header
 *    dilewati begitu saja, tidak dipaksakan string 'Bearer null'.
 * 2. 401 GLOBAL (token invalid/expired) -> paksa logout + balik ke login.
 *    Guard `getToken()` (bukan cuma cek xhr.status===401 mentah) supaya 401
 *    dari percobaan LOGIN itu sendiri (password salah) tidak ikut memicu
 *    logOut()+reload yang malah menutup alert sebelum sempat kebaca user.
 */
export function initAuthInterceptor() {
  jQuery.ajaxPrefilter(function (options) {
    if (isAuthedPath(options.url)) {
      const token = getToken();
      if (token) {
        options.headers = options.headers || {};
        options.headers.Authorization = 'Bearer ' + token;
      }
    }
  });

  jQuery(document).ajaxError(function (event, xhr, settings) {
    if (xhr.status === 401 && isAuthedPath(settings.url) && getToken()) {
      logOut();
    }
  });
}
