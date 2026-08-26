import tpl from './login.html?raw';
import './login.css';
import { APP_CONFIG } from '../../lib/config.js';
import { Router } from '../../lib/router.js';
import { CURRENT_APP_VERSION_CODE } from '../../lib/app-version.js';
import { startVersionCheck } from '../../lib/version-check.js';
import { hideAuthedShell } from '../../lib/shell.js';

export function mount(container) {
  container.innerHTML = tpl;

  hideAuthedShell();

  jQuery('#btn-login').on('click', getDataUser);
  // Enter di field password langsung submit, seperti kebiasaan form login.
  jQuery('#password').on('keydown', (e) => {
    if (e.key === 'Enter') getDataUser();
  });

  // Toggle show/hide password -- pola sama persis dgn ekspedisi-apk/inventory-apk.
  jQuery('#toggle-password').on('click', function () {
    const $input = jQuery('#password');
    const isHidden = $input.attr('type') === 'password';
    $input.attr('type', isHidden ? 'text' : 'password');
    jQuery(this).attr('aria-label', isHidden ? 'Sembunyikan password' : 'Tampilkan password');
  });

  function getDataUser() {
    const username = jQuery('#username').val();
    const password = jQuery('#password').val();

    jQuery.ajax({
      type: 'POST',
      // Endpoint SAMA PERSIS admin-finance-apk asli (ServiceController::getDataLogin(),
      // backend-production) -- TANPA prefix modul apa pun, lihat catatan di config.js.
      url: APP_CONFIG.API_BASE_URL + APP_CONFIG.LOGIN_ENDPOINT,
      dataType: 'JSON',
      data: { username, password },
      beforeSend() {
        app.dialog.preloader('Sedang Memeriksa Data');
      },
      success(data) {
        app.dialog.close();

        // Backend mengembalikan 0 (bukan object) kalau kredensial salah -- dicek
        // LEBIH DULU sebelum mengakses data.user_position (beda dari urutan di
        // admin-finance-apk/www/js/login.js asli, yang mengecek user_position
        // dulu baru "data==0" DI DALAMNYA -- urutan itu membuat cabang pesan
        // "Username Atau Password Salah" tidak pernah tercapai krn
        // `(0).user_position` sudah duluan bernilai undefined != 'Admin'.
        // Diperbaiki di sini supaya kedua pesan kesalahan benar-benar tampil
        // sesuai kondisinya, tanpa mengubah keputusan bisnisnya sama sekali:
        // hanya user_position === 'Admin' yang boleh masuk.).
        if (!data || data === 0) {
          app.dialog.alert('Username Atau Password Salah');
          return;
        }

        if (data.user_position !== 'Admin') {
          app.dialog.alert('Role User Bukan Admin');
          return;
        }

        localStorage.setItem('valid_app_version', String(CURRENT_APP_VERSION_CODE));
        localStorage.setItem('user_id', data.user_id);
        localStorage.setItem('username', data.username);
        localStorage.setItem('password', data.password_real);
        localStorage.setItem('karyawan_nama', data.karyawan_nama);
        localStorage.setItem('login', 'true');
        localStorage.setItem('jabatan', data.user_position);
        localStorage.setItem('jabatan_kantor', data.jabatan);
        localStorage.setItem('sales_kota', data.kota);
        localStorage.setItem('lokasi_pabrik_user', data.lokasi_pabrik);
        localStorage.setItem('lokasi_pabrik', data.lokasi_pabrik);
        localStorage.setItem('lokasi_absen', data.lokasi_absen);
        localStorage.setItem('primary_kas', data.primary_kas);

        // TODO: initNotificationManagerAfterLogin() -- porting NotificationManager
        // (FCM) dari admin-finance-apk/www/js/notification.js belum dilakukan di
        // pass ini, lihat README.md "Status Migrasi".

        startVersionCheck();

        // Landing SEMENTARA selalu ke /point/sales (sub-halaman pertama tab
        // Point) -- admin-finance-apk asli langsung redirect ke /point-sales
        // (lokasi_pabrik_user='Pusat') atau /absensi (lainnya) berdasar role.
        // Begitu halaman2 fitur diporting, pertimbangkan balikin redirect
        // berbasis role di sini kalau memang itu perilaku yang diinginkan
        // (lihat README.md).
        Router.navigate('/point/sales');
      },
      error() {
        app.dialog.close();
        app.dialog.alert('Gagal menghubungi server, silakan coba lagi.');
      },
    });
  }

  // unmount: tidak ada listener global yang perlu dilepas di halaman ini.
  return () => { };
}
