// Token JWT terpisah khusus menu SJ (pages/sj/*) -- backend-migrasi (modul
// Ekspedisi) mensyaratkan klaim `role` literal 'admin' di token
// (App\Ekspedisi\Middleware\AdminOnlyMiddleware), BEDA TOTAL artinya dari
// klaim `role` di token sesi login utama app ini (modul Admin, isinya kode
// jabatan mentah spt 'STAFF'/'MANAJER'/dst) -- token modul Admin TIDAK BISA
// dipakai apa adanya utk panggil endpoint Ekspedisi.
//
// Token ini didapat dari response login UTAMA (field `ekspedisi_token`,
// dicek server-side dalam SATU request yg sama oleh App\Admin\Controllers\
// AuthController::isEkspedisiAdmin() -- query `ekspedisi_m_admin_access`)
// -- TIDAK ADA panggilan HTTP kedua, lihat pages/login/login.js. Pola & nama
// file disalin dari finance-v2-apk/src/lib/paytraAuth.js (satu keluarga
// pola "token modul kedua dari 1 request login" di workspace ini).
//
// localStorage key diberi prefix 'ekspedisi_' supaya TIDAK bentrok dgn key
// sesi login utama (user_id/username/login/dst) -- localStorage.clear() di
// logOut() (lib/auth.js) tetap otomatis membersihkan key ini juga saat
// logout dari app.

const TOKEN_KEY = 'ekspedisi_token';

export function getEkspedisiToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

export function hasEkspedisiAccess() {
  return !!getEkspedisiToken();
}

export function setEkspedisiToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export function clearEkspedisiToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Wrapper jQuery.ajax yang otomatis pasang header `Authorization: Bearer
 * <token>` -- dipakai HANYA oleh pages/sj/*.js (bukan ajaxPrefilter global
 * spt lib/auth.js, krn cuma menu SJ yg perlu token ini). 401 -> panggil
 * onUnauthorized() (mis. tampilkan "Tidak Ada Akses"), TIDAK menghapus
 * sesi login UTAMA app ini (beda dari 401 di lib/auth.js yg logout total).
 */
export function ekspedisiAjax(options, onUnauthorized) {
  const token = getEkspedisiToken();
  const headers = Object.assign({}, options.headers || {});
  if (token) headers.Authorization = 'Bearer ' + token;

  const userError = options.error;
  return jQuery.ajax(Object.assign({}, options, {
    headers,
    error(xhr, status, err) {
      if (xhr.status === 401 || xhr.status === 403) {
        if (onUnauthorized) onUnauthorized(xhr);
        return;
      }
      if (userError) userError(xhr, status, err);
    },
  }));
}
