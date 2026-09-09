// Integrasi push notification (FCM) -- [BARU 2026-09-07 atas permintaan
// user, "pastikan firebasenya juga sudah terinstall"] SALINAN nyaris persis
// dari finance-v2-apk/src/lib/firebaseNotif.js (modul pertama yang dapat
// integrasi FCM di backend-migrasi), plugin cordova-plugin-firebasex (SAMA
// versi/variable set, lihat config.xml). Backend: App\Admin\Controllers\
// NotificationController + App\Support\FirebaseService (backend-migrasi,
// endpoint `/admin/fcm/*` & `/admin/notifications/*`, sama pola pemasangan
// dgn modul Finance -- lihat lib/auth.js soal auto-attach Bearer token
// untuk prefix '/admin').
//
// Sama scope-nya dgn finance-v2-apk: inti (badge unread + panel list + mark
// read) saja, BELUM wiring ke event bisnis spesifik modul Admin (mis.
// notifikasi validasi Point/Ijin/Finance tersimpan) -- backend BELUM
// mengirim notifikasi apa pun ke sini, tinggal dipanggil controller lain
// (App\Admin\Controllers\*) kapan pun dibutuhkan menyusul.
//
// [BLOCKER, TIDAK BISA diselesaikan dari sesi ini] `google-services.json` di
// root repo ini BELUM ADA SAMA SEKALI (beda dari finance-v2-apk yang sudah
// py file ini dgn entry `com.koperindo.finance`) -- widget id app ini
// (`com.koperindo.admin`, lihat config.xml) perlu didaftarkan sbg Android
// app BARU di Firebase Console project yang sama ("migrasi-internal", lihat
// project_info di finance-v2-apk/google-services.json) SEBELUM
// FirebasePlugin.getToken() bisa berhasil di build APK asli. Kode di sini
// sudah lengkap & siap pakai begitu file itu ditambahkan ke root repo ini.

import { APP_CONFIG } from './config.js';

const state = {
  userId: null,
  unreadCount: 0,
  notifications: [],
  initialized: false,
};

// Path RELATIF (tanpa leading slash) -- WAJIB, sama alasan dgn base:'' di
// vite.config.js: app ini jalan dari file:// di WebView Android/iOS, path
// absolut ("/sound/...") akan salah resolve ke root filesystem device, bukan
// ke www/sound/. File-nya di public/sound/notification.mp3 (disalin apa
// adanya dari finance-v2-apk), Vite copy (publicDir) ke www/sound/notification.mp3
// saat build.
const NOTIF_SOUND_PATH = 'sound/notification.mp3';
let notifAudio = null;

// Guard suara notifikasi (sama pola dgn finance-v2-apk): JANGAN putar suara
// kalau tidak ada unread SAMA SEKALI dan tidak ada notif yang baru dibuat
// dalam 1 jam terakhir -- cuma exists-or-not (bukan hitung berapa/berapa
// lama), lihat hasUnreadOrRecentNotif() di bawah.
const SOUND_CONDITION_WINDOW_MS = 60 * 60 * 1000;

function log(message, data) {
  console.log('[firebaseNotif] ' + message, data ?? '');
}

function playNotificationSound() {
  try {
    if (!notifAudio) notifAudio = new Audio(NOTIF_SOUND_PATH);
    notifAudio.currentTime = 0;
    notifAudio.play().catch((err) => log('Gagal memutar suara notifikasi', err));
  } catch (e) {
    log('Gagal memutar suara notifikasi', e);
  }
}

function api(endpoint, method, data) {
  return jQuery.ajax({
    type: method,
    url: APP_CONFIG.API_BASE_URL + endpoint,
    dataType: 'json',
    data,
  });
}

function updateBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (state.unreadCount > 0) {
    badge.textContent = state.unreadCount > 99 ? '99+' : String(state.unreadCount);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr.replace(' ', 'T'));
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Notif yang SUDAH dibaca SENGAJA tidak dirender lagi sama sekali (sama pola
// dgn finance-v2-apk) -- panel ini isinya cuma "yang masih perlu
// diperhatikan", bukan riwayat lengkap. state.notifications sendiri TETAP
// menyimpan semua (dibaca+belum) apa adanya dari fetch, filter hanya terjadi
// di sini supaya hasUnreadOrRecentNotif() (guard suara) masih bisa lihat
// data lengkapnya.
function unreadNotifications() {
  return state.notifications.filter((n) => Number(n.is_read) === 0);
}

function renderList() {
  const list = document.getElementById('notif-list');
  if (!list) return;

  const unread = unreadNotifications();

  if (unread.length === 0) {
    list.innerHTML = '<li class="tbl-empty p-4 text-center text-xs text-ink-secondary">Tidak ada notifikasi</li>';
    return;
  }

  list.innerHTML = unread.map((n) => `
    <li data-id="${n.id}"
      class="notif-item flex flex-col gap-0.5 px-4 py-3 border-b border-ink-faint cursor-pointer active:bg-slate-50 bg-blue-50/60">
      <div class="flex items-center justify-between gap-2">
        <span class="font-semibold text-xs text-ink-primary truncate">${n.title}</span>
        <span class="shrink-0 w-2 h-2 rounded-full bg-primary"></span>
      </div>
      <p class="text-xs text-ink-secondary">${n.message}</p>
      <span class="text-[10px] text-ink-faint">${formatRelativeDate(n.dt_record)}</span>
    </li>
  `).join('');
}

/**
 * @param {Array} list Notifikasi hasil fetch (state.notifications) -- dibaca
 *   ATAU belum, dicek keduanya di sini (bukan cuma unread) supaya notif yang
 *   sempat kebaca cepat (mis. auto mark-as-read lain) tapi masih baru (<1
 *   jam) tetap dianggap "ada" utk guard suara.
 */
function hasUnreadOrRecentNotif(list) {
  const cutoff = Date.now() - SOUND_CONDITION_WINDOW_MS;
  return list.some((n) => {
    if (Number(n.is_read) === 0) return true;
    if (!n.dt_record) return false;
    return new Date(n.dt_record.replace(' ', 'T')).getTime() >= cutoff;
  });
}

function fetchUnreadCount() {
  if (!state.userId) return;
  api('/notifications/unread-count', 'GET', { user_id: state.userId })
    .done((res) => {
      if (!res || !res.success) return;
      state.unreadCount = res.count || 0;
      updateBadge();
    })
    .fail((xhr) => log('Gagal ambil unread-count', xhr.status));
}

/**
 * @param {(list: Array) => void} [onDone] Dipanggil sesudah state.notifications
 *   ter-update -- dipakai handleIncomingMessage() utk cek hasUnreadOrRecentNotif()
 *   sebelum mutuskan putar suara, TANPA nge-fetch dua kali.
 */
function fetchNotifications(onDone) {
  if (!state.userId) return;
  api('/notifications', 'GET', { user_id: state.userId, per_page: 50 })
    .done((res) => {
      if (!res || !res.success) return;
      state.notifications = (res.data && res.data.data) || [];
      renderList();
      if (onDone) onDone(state.notifications);
    })
    .fail((xhr) => log('Gagal ambil daftar notifikasi', xhr.status));
}

function markAsRead(id) {
  const notif = state.notifications.find((n) => String(n.id) === String(id));
  if (!notif || Number(notif.is_read) === 1) return;

  api(`/notifications/${id}/read`, 'POST', { user_id: state.userId }).done(() => {
    notif.is_read = 1;
    state.unreadCount = Math.max(0, state.unreadCount - 1);
    updateBadge();
    renderList();
  });
}

function markAllAsRead() {
  if (!state.userId) return;
  api('/notifications/mark-all-read', 'POST', { user_id: state.userId }).done(() => {
    state.notifications.forEach((n) => { n.is_read = 1; });
    state.unreadCount = 0;
    updateBadge();
    renderList();
  });
}

function isFirebasePluginAvailable() {
  return typeof window.FirebasePlugin !== 'undefined';
}

// Dipanggil dari KEDUA titik pasang onMessageReceived (registerToken() -- baru
// login, dan initFirebaseNotif() cabang startup) supaya perilakunya identik,
// tidak didup di 2 tempat.
function handleIncomingMessage(payload) {
  log('Notifikasi diterima', payload);
  fetchUnreadCount();
  fetchNotifications((list) => {
    if (hasUnreadOrRecentNotif(list)) playNotificationSound();
  });
}

function registerToken() {
  if (!isFirebasePluginAvailable()) {
    log('cordova-plugin-firebasex tidak tersedia (browser dev, atau plugin belum ter-install) -- lewati registrasi token.');
    return;
  }

  window.FirebasePlugin.grantPermission((granted) => {
    if (!granted) {
      log('Izin notifikasi ditolak user.');
      return;
    }

    window.FirebasePlugin.getToken((token) => {
      if (!token || !state.userId) return;
      api('/fcm/register', 'POST', { user_id: state.userId, fcm_token: token })
        .done(() => log('Token FCM terdaftar.'))
        .fail((xhr) => log('Gagal daftar token FCM', xhr.status));
    }, (error) => log('Gagal ambil token FCM', error));

    window.FirebasePlugin.onTokenRefresh((token) => {
      if (!state.userId) return;
      api('/fcm/register', 'POST', { user_id: state.userId, fcm_token: token });
    }, (error) => log('Error onTokenRefresh', error));

    window.FirebasePlugin.onMessageReceived(handleIncomingMessage, (error) => log('Error onMessageReceived', error));
  }, (error) => log('Gagal minta izin notifikasi', error));
}

/**
 * Panggil sekali setelah login berhasil (forceRefresh=true, minta izin +
 * daftar token dari awal) ATAU saat startup app sementara sesi masih login
 * (forceRefresh=false, cuma pasang listener + refresh badge, TANPA minta
 * izin ulang tiap buka app).
 */
export function initFirebaseNotif(userId, forceRefresh) {
  if (!userId) return;

  state.userId = userId;
  state.initialized = true;

  fetchUnreadCount();

  if (forceRefresh) {
    registerToken();
  } else if (isFirebasePluginAvailable()) {
    // Startup: listener tetap perlu dipasang ulang tiap kali app dibuka
    // (instance JS baru), TAPI tanpa grantPermission()/getToken() ulang --
    // token yang sudah terdaftar di server tetap valid sampai di-refresh
    // sendiri oleh plugin (onTokenRefresh).
    window.FirebasePlugin.onMessageReceived(handleIncomingMessage, (error) => log('Error onMessageReceived', error));
  }
}

/**
 * Panggil saat logout, SEBELUM localStorage di-clear (butuh userId lama utk
 * hapus token di server) -- fire-and-forget, kegagalan unregister tidak
 * menghalangi proses logout tetap lanjut (bukan skenario yang harus
 * diblokir, device yang sudah logout wajar tidak lagi dapat notifikasi
 * baru walau unregister-nya gagal, token akan ketimpa/kadaluwarsa sendiri).
 */
export function cleanupFirebaseNotif() {
  if (state.userId) {
    api('/fcm/unregister', 'POST', { user_id: state.userId });
  }
  state.userId = null;
  state.unreadCount = 0;
  state.notifications = [];
  state.initialized = false;
}

export function togglePanel() {
  fetchNotifications();
  return true; // dipanggil dari shell.js yang urus buka/tutup popup-nya sendiri (lib/popup.js)
}

export function bindNotifPanelEvents() {
  const list = document.getElementById('notif-list');
  if (list) {
    list.addEventListener('click', (e) => {
      const item = e.target.closest('.notif-item');
      if (item) markAsRead(item.dataset.id);
    });
  }

  const markAllBtn = document.getElementById('notif-mark-all');
  if (markAllBtn) {
    markAllBtn.addEventListener('click', markAllAsRead);
  }
}
