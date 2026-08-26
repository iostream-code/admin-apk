// Helper format spesifik halaman Point (Sales & Produksi) -- porting dari
// pola yang dipakai berulang di admin-finance-apk/www/js/point_sales.js &
// point_produksi.js (moment().format('DD-MMM') / format('DDMMYY') + kode SPK).
// Dipisah dari lib/format.js (yang isinya format umum dipakai lintas modul)
// krn "kode SPK" ini spesifik konteks Point, bukan format tanggal/angka umum.

const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function toDate(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return isNaN(d.getTime()) ? null : d;
}

/** "13-Agu" -- porting moment(x).format('DD-MMM'), dipakai di kolom Tgl. */
export function formatDayMonth(dateInput) {
  const d = toDate(dateInput);
  if (!d) return '-';
  return `${String(d.getDate()).padStart(2, '0')}-${BULAN_SINGKAT[d.getMonth()]}`;
}

/**
 * Kode SPK ringkas: "DDMMYY-<nomor>" -- porting persis dari admin-finance-apk:
 *   moment(dt_record).format('DDMMYY') + '-' + penjualan_id.replace(/INV_/g,'').replace(/^0+/,'')
 * (regex asli di sana `/\INV_/g` -- `\I` bukan escape valid, browser
 * memperlakukannya sbg literal 'I', jadi efeknya sama dgn `/INV_/g` di sini).
 */
export function spkLabel(penjualanId, dtRecord) {
  const d = toDate(dtRecord);
  const datePart = d
    ? `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(-2)}`
    : '------';
  const idPart = String(penjualanId || '').replace(/INV_/g, '').replace(/^0+/, '');
  return `${datePart}-${idPart}`;
}
