// Konfigurasi API app ini -- bentuk file disamakan dgn ekspedisi-apk/
// inventory-apk (src/lib/config.js atau src/js/config.js sana): satu object
// APP_CONFIG, murni konfigurasi, tidak ada fungsi apa pun di sini.
//
// BEDA PENTING dari ekspedisi-apk/inventory-apk: app ini (migrasi dari
// admin-finance-apk) TETAP ke backend-production sepenuhnya, BUKAN
// backend-migrasi. Modul Admin/Finance (get-data-login, point sales/produksi/
// admin, absensi, data gaji, data transaksi kas, dst.) belum ada portingnya
// di backend-migrasi (yang saat ini baru punya modul Inventory/Ekspedisi/
// Partner/Purchasing) -- lihat ROADMAP.md (root workspace) kalau ini berubah
// nanti. Endpoint dipanggil TANPA prefix modul apa pun (persis seperti
// admin-finance-apk/www/js/global.js: BASE_API + '/get-data-login', dst),
// BUKAN pola '+ /inventory' atau '+ /ekspedisi' seperti dua app tsb.
export const APP_CONFIG = {
  API_BASE_URL: 'https://indokoper.com/api', // sama persis dgn BASE_API di admin-finance-apk/www/js/global.js

  IMAGE_BASE_URL: 'https://indokoper.com', // dipakai utk susun URL foto (BASE_PATH_IMAGE_* di admin-finance-apk lama)

  // POST {API_BASE_URL}{LOGIN_ENDPOINT} -> ServiceController::getDataLogin() (backend-production).
  // Endpoint SAMA yang dipakai admin-finance-apk & ~9 app lain di workspace ini
  // (lihat ROADMAP.md) -- JANGAN diubah sendiri di sini, perubahan endpoint ini
  // berdampak luas lintas app.
  LOGIN_ENDPOINT: '/get-data-login', // POST { username, password } -> data login (lihat login.js)
};

// Auth di app ini TIDAK pakai token JWT Bearer -- backend-production (endpoint
// get-data-login) tidak mengembalikan token, cuma flag "berhasil/tidak" +
// data user. Status login disimpan sbg localStorage flag ("login"="true"),
// sama persis pola admin-finance-apk asli (lihat auth.js). Beda dari
// ekspedisi-apk/inventory-apk yang backend-migrasinya JWT Bearer penuh.
