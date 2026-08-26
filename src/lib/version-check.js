// Cek versi app -- porting dari admin-finance-apk/www/js/global.js
// (checkAppVersion(), dipanggil tiap 30 detik lewat setInterval). Endpoint
// & payload SAMA PERSIS dgn aslinya: POST {BASE_API}/config/check-version,
// { app_name: 'admin', current_version_code }, TANPA prefix modul apa pun
// (beda dari inventory-apk/ekspedisi-apk yg backend-migrasinya pakai prefix
// '/inventory'+'/config/check-version' dst -- app ini tetap backend-production).
//
// Sekaligus dipakai sbg indikator koneksi (#box_internet) -- pola sama dgn
// ekspedisi-apk/inventory-apk: berhasil/gagalnya request check-version yang
// SUDAH jalan tiap 30 detik ini sekalian jadi sinyal "ada internet atau
// tidak", tidak perlu polling terpisah. Beda dari admin-finance-apk lama yg
// indikator #box_internet-nya sempat mati total sejak checkInternet()
// dihapus (lihat catatan 2026-08-10 di global.js) -- di sini dihidupkan lagi
// lewat jalur ini.

import { APP_CONFIG } from './config.js';
import { logOut } from './auth.js';

const APP_NAME = 'admin';
const CHECK_INTERVAL_MS = 30000;

let intervalId = null;

function setConnectionIndicator(isConnected) {
  const box = document.getElementById('box_internet');
  if (!box) return;
  box.classList.toggle('connected', isConnected);
  box.classList.toggle('disconnected', !isConnected);
}

function checkAppVersion() {
  jQuery.ajax({
    type: 'POST',
    url: APP_CONFIG.API_BASE_URL + '/config/check-version',
    dataType: 'JSON',
    data: {
      app_name: APP_NAME,
      current_version_code: localStorage.getItem('valid_app_version'),
    },
    success(data) {
      setConnectionIndicator(true);

      if (data.status === 'success' && !data.is_valid) {
        app.dialog.alert(data.config.config_keterangan, () => {
          logOut();
        });
      }
    },
    error() {
      // Request gagal (timeout/tidak ada internet/server tidak terjangkau) tetap
      // dipakai sbg sinyal "putus" utk indikator, tapi TIDAK menampilkan alert
      // apa pun ke user -- jangan ganggu cuma karena satu kali polling gagal.
      setConnectionIndicator(false);
    },
  });
}

export function startVersionCheck() {
  if (intervalId) clearInterval(intervalId);
  checkAppVersion(); // cek langsung sekali saat dipanggil, jangan tunggu 30 detik pertama
  intervalId = setInterval(checkAppVersion, CHECK_INTERVAL_MS);
}

export function stopVersionCheck() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}
