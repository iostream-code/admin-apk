// Status login -- porting dari admin-finance-apk/www/js/global.js
// (checkLogin/logOut), disamakan bentuk filenya dgn auth.js ekspedisi-apk/
// inventory-apk (file terpisah, bukan digabung ke config.js).
//
// TIDAK ADA token/interceptor Authorization di sini (beda dari
// ekspedisi-apk/inventory-apk) -- backend-production yang dipanggil app ini
// tidak pakai skema Bearer token, lihat catatan di config.js.

export function checkLogin() {
  return localStorage.getItem('login') === 'true';
}

export function logOut() {
  localStorage.clear();
  // window.location.hash (bukan window.location.href = '/login') -- app ini jalan
  // di Cordova WebView (file://), href absolut ke path polos akan gagal (mencoba
  // load file:///login yg tidak ada). Hash tetap memicu router lewat hashchange
  // (lihat router.js) tanpa reload dokumen. Pola sama persis dgn inventory-apk.
  window.location.hash = '/login';
  window.location.reload();
}
