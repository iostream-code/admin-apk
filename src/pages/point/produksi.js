// Point Produksi -- porting dari admin-finance-apk/www/js/point_produksi.js
// (pointProduksi/getYearProduksiAdmin) + point_produksi.html.
//
// SCOPE PASS INI (sama seperti sales.js, disepakati dgn user 2026-08-26):
// tabel data + filter bulan/tahun, kalkulasi poin. BELUM diporting:
// konfirmasi foto (kamera, openCameraPointProduksi/confirmFotoPointProduksi),
// download/share PDF (downloadPointProduksi) -- keduanya butuh plugin
// native, tombol/menu-nya SENGAJA tidak ditampilkan sama sekali di sini.
//
// [DIHAPUS 2026-08-26 atas permintaan user, "pada menu point seharusnya
// tidak ada fitur untuk mengatur pengiriman apapun"] Tombol "Kirim" + popup
// Input Alamat (porting kirimAlamatProduksi()) DIBUANG TOTAL dari halaman
// ini -- bukan cuma disembunyikan. Endpoint `/get-data-Alamat` TIDAK
// dipanggil sama sekali lagi di sini.
//
// Kolom SPK SENGAJA TIDAK bisa diklik (beda dari Point Sales) -- di
// admin-finance-apk asli, klik SPK di halaman ini memanggil
// `detailPenjualanPointProduksi(...)`, fungsi yang TIDAK PERNAH didefinisikan
// di mana pun (dicek: grep seluruh www/js, tidak ada) DAN popup targetnya
// (`.detail-penjualan-point-produksi`) juga tidak ada markup-nya sama sekali
// -- klik itu di app asli cuma melempar error konsol tanpa efek apa pun.
// Bukan oversight di sini, memang tidak ada apa pun utk diporting.
//
// [UPDATE 2026-08-26 atas permintaan user] Dua fitur BARU ditambahkan
// (tidak ada di admin-finance-apk asli sama sekali -- point_produksi.js
// asli nol referensi validasi/cabang):
// 1. **Filter Cabang** (`#pp_cabang`) -- dropdown diisi DI FE dari nilai
//    `bantuan_cabang` yang MUNCUL di data bulan/tahun yang sedang dimuat
//    (bukan endpoint terpisah, krn `donwloadPointProduksi()` backend tidak
//    punya param cabang sama sekali) -- filter diterapkan client-side,
//    tanpa fetch ulang.
// 2. **Validasi Client per-baris** (kolom Opsi) -- porting popup Validasi
//    Client (cari + VALID/REJECT) yang SAMA PERSIS dgn pages/point/sales.js
//    (endpoint `/get-all-clients` & `/update-validasi-client`), TAPI beda
//    dari Sales: di sini validasi langsung PER BARIS SPK di tabel utama
//    (bukan per-karyawan lewat popup Point dulu spt Sales), krn tabel
//    Produksi memang sudah flat (tidak dikelompokkan per user). Field
//    `point_valid_manager`/`client_id`/`customer_logo`/`presentase_omset`
//    SUDAH ada di response `download-point-produksi` (backend join yg sama
//    ke `t_penjualan_header`/`m_client` yang dipakai Sales), cuma belum
//    pernah dibaca/ditampilkan FE manapun sebelum ini.

import tpl from './produksi.html?raw';
import { APP_CONFIG } from '../../lib/config.js';
import { numberFormat } from '../../lib/format.js';
import { formatDayMonth, spkLabel } from './pointFormat.js';
import { showAuthedShell } from '../../lib/shell.js';

const IMAGE_BASE = APP_CONFIG.IMAGE_BASE_URL;
const NOIMAGE = IMAGE_BASE + '/noimage.jpg';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** Porting persis logika poin di pointProduksi() admin-finance-apk. */
function hitungPoint(item) {
  const isHc = String(item.penjualan_jenis || '').indexOf('HC') !== -1;
  if (item.bantuan_cabang === 'Jakarta') {
    // Sengaja SIMETRIS di sumber aslinya (HC maupun bukan, sama-sama 100 di
    // cabang Jakarta) -- bukan disederhanakan di sini, memang begitu logikanya.
    return isHc ? 100 : 100;
  }
  return isHc ? 200 : 100;
}

export function mount(container) {
  container.innerHTML = tpl;
  showAuthedShell('/point/produksi');

  let searchTimeout = null;
  let allRows = []; // seluruh baris hasil fetch bulan/tahun (SEBELUM filter cabang)

  const $bulan = jQuery('#pp_bulan');
  const $year = jQuery('#pp_year');
  const $cabang = jQuery('#pp_cabang');

  const nowMonth = new Date().getMonth();
  BULAN.forEach((nama, i) => {
    $bulan.append(jQuery('<option>').val(i + 1).text(nama).prop('selected', i === nowMonth));
  });

  const endYear = new Date().getFullYear();
  for (let y = endYear; y > 2010; y--) {
    $year.append(jQuery('<option>').val(y).text(y).prop('selected', y === endYear));
  }

  $bulan.on('change', loadPointProduksi);
  $year.on('change', loadPointProduksi);
  $cabang.on('change', renderTable);

  function loadPointProduksi() {
    jQuery.ajax({
      type: 'POST',
      url: APP_CONFIG.API_BASE_URL + '/download-point-produksi',
      dataType: 'JSON',
      data: { month: $bulan.val(), year: $year.val() },
      beforeSend() {
        jQuery('#pp_table_body').html('<tr><td colspan="9" class="tbl-empty">Memuat data...</td></tr>');
      },
      success(data) {
        // Porting filter admin-finance-apk: cuma baris yang produksi &
        // pengirimannya SELESAI yang ditampilkan. "status_pengirman" (bukan
        // "pengiriman") memang nama field asli dari backend, bukan typo.
        allRows = (data.data || []).filter((item) =>
          item.status_produksi === 'selesai' && item.status_pengirman === 'selesai');

        rebuildCabangOptions();
        renderTable();
      },
      error() {
        allRows = [];
        jQuery('#pp_table_body').html('<tr><td colspan="9" class="tbl-empty">Gagal memuat data.</td></tr>');
      },
    });
  }

  // Filter Cabang -- opsi diisi DI FE dari nilai bantuan_cabang yang muncul
  // di data bulan/tahun yang sedang dimuat (lihat catatan scope di atas).
  function rebuildCabangOptions() {
    const currentVal = $cabang.val();
    const cabangSet = new Set(allRows.map((item) => item.bantuan_cabang).filter(Boolean));
    const cabangList = Array.from(cabangSet).sort();

    $cabang.html('<option value="">Semua Cabang</option>'
      + cabangList.map((c) => `<option value="${escapeAttr(c)}">${c}</option>`).join(''));

    if (currentVal && cabangList.includes(currentVal)) $cabang.val(currentVal);
  }

  function renderTable() {
    const cabangFilter = $cabang.val();
    const rows = cabangFilter ? allRows.filter((item) => item.bantuan_cabang === cabangFilter) : allRows;

    let total = 0;
    const bodyRows = rows.map((item) => {
      const point = hitungPoint(item);
      const qty = parseFloat(item.penjualan_qty) || 0;
      const totalRow = qty * point;
      total += totalRow;

      const validCell = item.point_valid_manager == 1
        ? '<span class="btn-tbl btn-tbl--success">Valid</span>'
        : `<button class="btn-tbl btn-tbl--muted btn-validasi"
             data-penjualan-id="${item.penjualan_id}"
             data-client-id="${item.client_id}"
             data-client-nama="${escapeAttr(item.client_nama)}"
             data-logo="${escapeAttr(item.customer_logo || '')}"
             data-persentase="${item.presentase_omset || 0}"
             data-alamat="${escapeAttr(item.client_alamat || '-')}"
             data-karyawan-id="${item.karyawan_id || ''}">Detail</button>`;

      return `
        <tr>
          <td class="td-center">${formatDayMonth(item.tgl_surat_jalan_selesai)}</td>
          <td class="td-center"><b>${spkLabel(item.penjualan_id, item.dt_record)}</b></td>
          <td class="td-left">${item.client_nama}</td>
          <td class="td-left">${item.penjualan_jenis}</td>
          <td class="td-center">${point}</td>
          <td class="td-center">${item.penjualan_qty}</td>
          <td class="td-center">${numberFormat(totalRow)}</td>
          <td class="td-center">${item.bantuan_cabang || '-'}</td>
          <td class="td-center">${validCell}</td>
        </tr>
      `;
    }).join('');

    jQuery('#pp_total').text('Total: ' + numberFormat(total));
    jQuery('#pp_table_body').html(bodyRows || '<tr><td colspan="9" class="tbl-empty">Tidak ada data.</td></tr>');
  }

  // ===========================================================
  // Popup Validasi Client -- SAMA PERSIS dgn pages/point/sales.js
  // (openValidasiClientPopup/searchClientValidasi/loadClientsByKeyword/
  // processValidasiClient), TAPI dipicu langsung dari baris tabel utama
  // (bukan dari popup Point per-karyawan spt Sales -- lihat catatan scope).
  // ===========================================================
  jQuery('#pp_table_body').on('click', '.btn-validasi', function () {
    const $el = jQuery(this);
    jQuery('#vc_penjualan_id').val($el.data('penjualan-id'));
    jQuery('#vc_client_id').val($el.data('client-id'));
    jQuery('#vc_persentase').val($el.data('persentase'));
    jQuery('#vc_nama').text($el.data('client-nama') || '-');
    jQuery('#vc_alamat').text($el.data('alamat') || '-');
    jQuery('#popup-validasi-client').data('karyawan-id', $el.data('karyawan-id') || '');

    const logo = $el.data('logo');
    jQuery('#vc_logo').attr('src', logo ? IMAGE_BASE + '/customer_logo/' + logo : NOIMAGE);

    jQuery('#vc_search').val('');
    jQuery('#vc_results').html('<p class="tbl-empty">Ketik minimal 2 karakter untuk mencari...</p>');

    app.popup.open('#popup-validasi-client');
  });

  jQuery('#vc_search').on('input', function () {
    const keyword = jQuery(this).val().trim();
    if (searchTimeout) clearTimeout(searchTimeout);

    if (keyword.length < 2) {
      jQuery('#vc_results').html('<p class="tbl-empty">Ketik minimal 2 karakter untuk mencari...</p>');
      return;
    }

    searchTimeout = setTimeout(() => loadClientsByKeyword(keyword), 500);
  });

  function loadClientsByKeyword(keyword) {
    jQuery.ajax({
      type: 'POST',
      url: APP_CONFIG.API_BASE_URL + '/get-all-clients',
      dataType: 'JSON',
      data: {
        perusahaan_penjualan_value: keyword || 'empty',
        karyawan_id: jQuery('#popup-validasi-client').data('karyawan-id') || '',
        client_id: jQuery('#vc_client_id').val(),
      },
      beforeSend() {
        jQuery('#vc_results').html('<p class="tbl-empty">Mencari...</p>');
      },
      success(data) {
        const clients = (data.success && data.data) || [];
        if (!clients.length) {
          jQuery('#vc_results').html('<p class="tbl-empty">Client tidak ditemukan</p>');
          return;
        }
        jQuery('#vc_results').html(clients.map((c) => {
          const logoSrc = c.customer_logo ? IMAGE_BASE + '/customer_logo/' + c.customer_logo : NOIMAGE;
          return `
            <div class="card-surface p-2.5 flex gap-2.5">
              <img src="${logoSrc}" class="w-12 h-12 object-contain rounded flex-shrink-0" onerror="this.src='${NOIMAGE}'" />
              <div class="min-w-0">
                <p class="text-sm font-bold text-ink-primary truncate">${c.client_nama}</p>
                <p class="text-xs text-ink-secondary mt-0.5">${c.client_telp || '-'}</p>
                <p class="text-[11px] text-ink-muted mt-0.5">${truncate(c.client_alamat || '-', 60)}</p>
              </div>
            </div>
          `;
        }).join(''));
      },
      error() {
        jQuery('#vc_results').html('<p class="tbl-empty">Gagal memuat data client.</p>');
      },
    });
  }

  jQuery('#vc_btn_valid').on('click', () => {
    app.dialog.confirm('Apakah Anda yakin ingin MEMVALIDASI client ini?', 'Konfirmasi Validasi', () => {
      processValidasiClient('valid', jQuery('#vc_persentase').val());
    });
  });

  jQuery('#vc_btn_reject').on('click', () => {
    app.dialog.confirm('Apakah Anda yakin ingin MENOLAK client ini?', 'Konfirmasi Reject', () => {
      processValidasiClient('reject', 1);
    });
  });

  function processValidasiClient(isValid, persentase) {
    const penjualanId = jQuery('#vc_penjualan_id').val();
    if (!penjualanId) {
      app.dialog.alert('Data tidak lengkap', 'Error');
      return;
    }

    jQuery.ajax({
      type: 'POST',
      url: APP_CONFIG.API_BASE_URL + '/update-validasi-client',
      dataType: 'JSON',
      data: {
        penjualan_id: penjualanId,
        is_valid: isValid,
        presentase_omset: persentase,
        user_record: localStorage.getItem('karyawan_nama'),
      },
      beforeSend() {
        app.dialog.preloader('Memproses validasi...');
      },
      success(data) {
        app.dialog.close();
        if (data.status === 'success') {
          app.popup.close('#popup-validasi-client');
          const msg = isValid === 'valid' ? 'Client berhasil divalidasi!' : 'Client berhasil direject!';
          app.dialog.alert(msg, 'Sukses', () => loadPointProduksi());
        } else {
          app.dialog.alert(data.message || 'Gagal memproses validasi', 'Error');
        }
      },
      error() {
        app.dialog.close();
        app.dialog.alert('Terjadi kesalahan saat memproses validasi', 'Error');
      },
    });
  }

  // ===========================================================
  // Helper lokal
  // ===========================================================
  function escapeAttr(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function truncate(text, maxLength) {
    if (!text) return '-';
    return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
  }

  loadPointProduksi();

  return function unmount() {
    if (searchTimeout) clearTimeout(searchTimeout);
  };
}
