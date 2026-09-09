import tpl from './login.html?raw';
import './login.css';
import { APP_CONFIG } from '../../lib/config.js';
import { Router } from '../../lib/router.js';
import { CURRENT_APP_VERSION_CODE } from '../../lib/app-version.js';
import { startVersionCheck } from '../../lib/version-check.js';
import { hideAuthedShell } from '../../lib/shell.js';
import { setEkspedisiToken, clearEkspedisiToken } from '../../lib/ekspedisiAuth.js';
import { initFirebaseNotif } from '../../lib/firebaseNotif.js';

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
      // [CUTOVER 2026-09-07] backend-migrasi (App\Admin\Controllers\AuthController::login()),
      // BUKAN lagi ServiceController::getDataLogin() (backend-production) --
      // lihat catatan panjang di lib/config.js.
      url: APP_CONFIG.API_BASE_URL + APP_CONFIG.LOGIN_ENDPOINT,
      dataType: 'JSON',
      data: { username, password },
      beforeSend() {
        app.dialog.preloader('Sedang Memeriksa Data');
      },
      // Backend-migrasi signal kegagalan lewat HTTP status (401/403/422 +
      // {message}), BUKAN lagi literal `0` ala ServiceController::getDataLogin()
      // lama -- makanya semua kasus gagal (username tidak ditemukan, password
      // salah, status pegawai tidak aktif) masuk error() di bawah, BUKAN
      // success(). Pola SAMA PERSIS dgn finance-v2-apk/ekspedisi-apk/
      // inventory-apk/login.js.
      success(data) {
        app.dialog.close();

        const user = data.user || {};

        // Gerbang "Role User Bukan Admin" DIPERTAHANKAN apa adanya --
        // sumbernya sekarang user.user_position, field bridge legacy (lihat
        // docblock AuthController::fetchLegacyBridge()), null kalau akun ini
        // tidak py padanan tabel legacy (akan gagal gerbang ini juga, wajar).
        if (user.user_position !== 'Admin') {
          app.dialog.alert('Role User Bukan Admin');
          return;
        }

        localStorage.setItem('valid_app_version', String(CURRENT_APP_VERSION_CODE));
        // Token JWT modul Admin -- dibaca ulang oleh
        // lib/auth.js::initAuthInterceptor() (dipasang sekali di main.js) utk
        // di-auto-attach ke SEMUA panggilan /admin/* berikutnya. Tanpa ini,
        // panggilan setelah login akan 401.
        localStorage.setItem('token', data.token);
        // [PENTING] user_id di sini SENGAJA user.legacy_user_id (id tabel
        // LEGACY `users`), BUKAN user.id (id shared_m_users, dari JWT sub) --
        // Point/Ijin/Finance semua masih query tabel legacy & terima
        // parameter karyawan_id/user_id dlm ruang id LEGACY (2 ruang id ini
        // TIDAK SELALU SAMA utk akun yg sama, lihat docblock panjang
        // AuthController backend-migrasi) -- kalau field ini null (akun
        // tidak py padanan legacy), fitur2 itu otomatis dapat data kosong,
        // bukan error keras.
        localStorage.setItem('user_id', user.legacy_user_id);
        localStorage.setItem('username', user.username);
        // [DIHAPUS 2026-09-07] `localStorage.setItem('password', ...)` --
        // backend-migrasi TIDAK mengembalikan password plaintext sama sekali
        // (login lama, ServiceController::getDataLogin(), sengaja/tidak
        // sengaja mengembalikannya). Dicek dulu: key 'password' TIDAK PERNAH
        // dibaca di mana pun di app ini (grep nihil) -- aman dihapus, bukan
        // regresi fitur, sekalian menghindari nyimpen password plaintext di
        // localStorage yang sebelumnya memang tidak perlu.
        localStorage.setItem('karyawan_nama', user.karyawan_nama || user.name);
        localStorage.setItem('login', 'true');
        localStorage.setItem('jabatan', user.user_position);
        localStorage.setItem('jabatan_kantor', user.jabatan_kantor);
        localStorage.setItem('sales_kota', user.kota);
        localStorage.setItem('lokasi_pabrik_user', user.lokasi_pabrik);
        localStorage.setItem('lokasi_pabrik', user.lokasi_pabrik);
        localStorage.setItem('lokasi_absen', user.lokasi_absen);
        localStorage.setItem('primary_kas', user.primary_kas);

        // Token modul Ekspedisi (menu SJ) -- lihat docblock panjang
        // lib/ekspedisiAuth.js. Null kalau akun ini tidak terdaftar sbg admin
        // Ekspedisi (`ekspedisi_m_admin_access`) -- shell.js cukup sembunyikan
        // tab SJ utk akun itu, bukan error keras.
        if (data.ekspedisi_token) {
          setEkspedisiToken(data.ekspedisi_token);
        } else {
          clearEkspedisiToken();
        }

        // [BARU 2026-09-07 atas permintaan user, "pastikan firebasenya juga
        // sudah terinstall"] forceRefresh=true -- baru login, minta izin +
        // daftar token dari awal (lihat docblock initFirebaseNotif()).
        // user.legacy_user_id SAMA dgn yang disimpan localStorage.user_id di
        // atas (ruang id LEGACY, `users.user_id`) -- lihat docblock
        // App\Admin\Controllers\NotificationController soal kenapa ruang id
        // ini yang dipakai, bukan JWT sub.
        initFirebaseNotif(user.legacy_user_id, true);

        startVersionCheck();

        // Landing SEMENTARA selalu ke /point/sales (sub-halaman pertama tab
        // Point) -- admin-finance-apk asli langsung redirect ke /point-sales
        // (lokasi_pabrik_user='Pusat') atau /absensi (lainnya) berdasar role.
        // Begitu halaman2 fitur diporting, pertimbangkan balikin redirect
        // berbasis role di sini kalau memang itu perilaku yang diinginkan
        // (lihat README.md).
        Router.navigate('/point/sales');
      },
      error(xhr) {
        app.dialog.close();
        const res = xhr.responseJSON;
        app.dialog.alert((res && res.message) || 'Gagal menghubungi server, silakan coba lagi.');
      },
    });
  }

  // unmount: tidak ada listener global yang perlu dilepas di halaman ini.
  return () => { };
}
