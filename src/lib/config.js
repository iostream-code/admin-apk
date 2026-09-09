// Konfigurasi API app ini -- bentuk file disamakan dgn ekspedisi-apk/
// inventory-apk (src/lib/config.js atau src/js/config.js sana): satu object
// APP_CONFIG, murni konfigurasi, tidak ada fungsi apa pun di sini.
//
// [CUTOVER 2026-09-07 atas permintaan user, "sepertinya saya perlu
// mengalihkan semuanya ke backend-migrasi"] SEBELUMNYA app ini tetap ke
// backend-production sepenuhnya (lihat riwayat git file ini) -- modul Admin
// backend-migrasi (src/Admin/*, dipakai app ini) TERNYATA sudah py fondasi
// login+Point+Ijin+sebagian Finance sejak 2026-09-02/05 (dibangun terpisah,
// belum sempat disambungkan ke FE ini). Endpoint SEKARANG diprefix '/admin'
// (App\Admin\routes.php backend-migrasi), path di tiap halaman .js TIDAK
// perlu berubah (route-nya dibuat meniru persis path yang sudah dipanggil
// app ini, cukup ganti API_BASE_URL di sini) -- KECUALI LOGIN_ENDPOINT
// (lihat catatan di bawah) & 3 grup endpoint yang di sisi backend-migrasi
// BELUM ada sama sekali (masih PERLU dibangun menyusul, TIDAK bisa
// dialihkan sampai itu selesai): Absen Validasi (`/hrm/presensi/valid`,
// `/simpan-valid`, termasuk fitur baru "Surat Terlambat"), aksi tulis
// Payment (`valid-bukti-pembayaran-admin` -- `unvalid-bukti-pembayaran`
// SEMPAT ikut daftar ini, DICABUT 2026-09-07 bareng fitur reset validasi-nya
// di pages/finance/payment.js, lihat docblock file itu), dan
// Finance > Uang Saku (`finance-visit-list/detail/validate`,
// pages/finance/sales.js) -- 3 kelompok itu SEMENTARA masih ke
// BACKEND_PRODUCTION_URL di bawah sampai porting-nya selesai, lihat
// masing2 halaman.
export const APP_CONFIG = {
  API_BASE_URL: 'https://migrasi.koperindo.id/admin',

  // Fallback SEMENTARA -- endpoint yang belum ada portingnya di
  // backend-migrasi (lihat catatan di atas) TETAP panggil host lama ini
  // secara eksplisit, TIDAK ikut API_BASE_URL. Hapus constant ini begitu
  // ke-3 kelompok endpoint itu sudah dipindah semua.
  BACKEND_PRODUCTION_URL: 'https://indokoper.com/api',

  IMAGE_BASE_URL: 'https://indokoper.com', // storage foto TIDAK ikut migrasi, tetap di host lama -- lihat BASE_PATH_IMAGE_* di admin-finance-apk lama

  // POST {API_BASE_URL}{LOGIN_ENDPOINT} -> App\Admin\Controllers\AuthController::login()
  // (backend-migrasi, JWT). BUKAN lagi '/get-data-login' (ServiceController::
  // getDataLogin(), backend-production lama, literal `0` kalau gagal & TANPA
  // token) -- response SEKARANG {token, role, user:{...}}, gagal = HTTP
  // 401/403 + {message}. `user.legacy_user_id` (& field2 legacy lain yg
  // masih dipakai Point/Finance -- kota/lokasi_pabrik/dst) tetap ada di
  // response, dibaca lib/auth.js::login.js -- lihat docblock panjang
  // App\Admin\Controllers\AuthController soal 2 ruang id (shared_m_users vs
  // legacy) yang TIDAK SELALU SAMA.
  LOGIN_ENDPOINT: '/login',

  // Modul Ekspedisi (menu SJ, pages/sj/*) -- prefix '/ekspedisi', BUKAN
  // '/admin', dipakai HANYA lewat lib/ekspedisiAuth.js::ekspedisiAjax()
  // (token TERPISAH, `ekspedisi_token`, lihat catatan panjang di sana &
  // App\Admin\Controllers\AuthController soal kenapa token modul Admin
  // TIDAK BISA dipakai apa adanya utk endpoint ini).
  EKSPEDISI_API_BASE_URL: 'https://migrasi.koperindo.id/ekspedisi',
};

// Sesi app ini SEKARANG JWT Bearer penuh (SEBELUMNYA TANPA token sama
// sekali, backend-production get-data-login tidak mengembalikannya) --
// lihat lib/auth.js::initAuthInterceptor(), pola sama persis
// finance-v2-apk/ekspedisi-apk/inventory-apk. Status login TETAP disimpan
// sbg localStorage flag ("login"="true") SELAIN token, sama pola dgn
// sebelumnya (lihat auth.js).
