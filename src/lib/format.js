// Helper format tampilan (angka, tanggal, jam) -- porting dari
// admin-finance-apk/www/js/app.js & global.js (number_format, dst), bentuk
// file disamakan dgn format.js ekspedisi-apk/inventory-apk (satu file
// terpisah, murni helper, tanpa dependency ke Cordova/F7).

export function numberFormat(number, decimals = 0, decPoint = '.', thousandsSep = ',') {
  number = (number + '').replace(/[^0-9+\-Ee.]/g, '');
  const n = !isFinite(+number) ? 0 : +number;
  const prec = !isFinite(+decimals) ? 0 : Math.abs(decimals);
  const toFixedFix = (n, prec) => {
    const k = Math.pow(10, prec);
    return '' + Math.round(n * k) / k;
  };
  let s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.');
  if (s[0].length > 3) {
    s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, thousandsSep);
  }
  if ((s[1] || '').length < prec) {
    s[1] = s[1] || '';
    s[1] += new Array(prec - s[1].length + 1).join('0');
  }
  return s.join(decPoint);
}

// abbreviateNumber -- porting dari admin-finance-apk/www/js/app.js, dipakai
// mis. utk ringkasan Point Sales/Produksi/Admin ("1.2 Juta" dst).
export function abbreviateNumber(number) {
  const SI_PREFIXES = [
    { value: 1, symbol: '' },
    { value: 1e3, symbol: ' Ribu' },
    { value: 1e6, symbol: ' Juta' },
    { value: 1e9, symbol: ' Milyar' },
    { value: 1e12, symbol: ' Triliun' },
  ];
  if (number === 0) return number;
  const tier = SI_PREFIXES.filter((n) => number >= n.value).pop();
  return (number / tier.value).toFixed(0) + tier.symbol;
}

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_SINGKAT = BULAN.map((b) => b.slice(0, 3));

/**
 * Format tanggal pendek baku: "13-Agu-26". Global supaya konsisten di semua
 * menu (sama pola dgn ekspedisi-apk/inventory-apk).
 */
export function formatDateShort(dateInput, fallback = '-') {
  if (!dateInput) return fallback;
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return fallback;
  const day = String(d.getDate()).padStart(2, '0');
  const month = BULAN_SINGKAT[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

/** Format jam pendek baku: "11:43:00" (pemisah ":"). */
export function formatTimeShort(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function formatTgl(dateStr) {
  if (!dateStr || dateStr === '-') return '-';
  let d;
  if (dateStr instanceof Date) {
    d = dateStr;
  } else {
    const str = String(dateStr).trim();
    const partsA = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (partsA) {
      d = new Date(parseInt(partsA[1]), parseInt(partsA[2]) - 1, parseInt(partsA[3]));
    } else {
      const partsB = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
      d = partsB
        ? new Date(parseInt(partsB[3]), parseInt(partsB[2]) - 1, parseInt(partsB[1]))
        : new Date(str);
    }
  }
  if (!d || isNaN(d.getTime())) return String(dateStr);
  return d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
}
