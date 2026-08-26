// Point Sales -- porting dari admin-finance-apk/www/js/point_sales.js
// (getSalesAdmin/pointSales/detailPenjualanOwner/kirimAlamatSales/
// openValidasiClientPopup/dst) + point_sales.html.
//
// SCOPE PASS INI (disepakati dgn user 2026-08-26): data inti saja --
// tabel Sales Admin + filter bulan/tahun, drill-down Point per karyawan
// (list SPK + total), detail SPK (produk + logo customer), validasi client
// (cari + valid/reject, TANPA tombol WhatsApp). BELUM diporting (butuh
// plugin native, tidak bisa diuji di browser): upload foto bukti bayar/
// pelunasan (kamera), download/share PDF rekap. Tombol/menu utk fitur itu
// SENGAJA tidak ditampilkan sama sekali di sini (bukan cuma disembunyikan)
// -- lihat riwayat git admin-finance-apk kalau perlu ditelusuri lagi.
//
// [DIHAPUS 2026-08-26 atas permintaan user, "pada menu point seharusnya
// tidak ada fitur untuk mengatur pengiriman apapun"] Tombol "Kirim" +
// popup Input Alamat (porting kirimAlamatSales()) DIBUANG TOTAL dari
// halaman ini -- bukan cuma disembunyikan. Endpoint `/get-data-Alamat`
// TIDAK dipanggil sama sekali lagi di sini.

import tpl from './sales.html?raw';
import { APP_CONFIG } from '../../lib/config.js';
import { numberFormat } from '../../lib/format.js';
import { formatDayMonth, spkLabel } from './pointFormat.js';
import { showAuthedShell } from '../../lib/shell.js';

const IMAGE_BASE = APP_CONFIG.IMAGE_BASE_URL; // 'https://indokoper.com' -- porting BASE_PATH_IMAGE_CUSTOMER dst
const NOIMAGE = IMAGE_BASE + '/noimage.jpg';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function mount(container) {
  container.innerHTML = tpl;
  showAuthedShell('/point/sales');

  // State per-sesi halaman ini (pengganti hidden input #karyawan_id_hidden/
  // #karyawan_nama_hidden admin-finance-apk asli) -- karyawan yang sedang
  // dibuka detail Point-nya, dipakai lagi oleh loadClientsByKeyword() &
  // reload setelah validasi.
  let currentKaryawanId = null;
  let currentKaryawanNama = null;
  let searchTimeout = null;

  const $bulan = jQuery('#ps_bulan');
  const $year = jQuery('#ps_year');

  // ===== Isi dropdown Bulan (porting getBulanPointSales()) =====
  const nowMonth = new Date().getMonth(); // 0-based
  BULAN.forEach((nama, i) => {
    $bulan.append(jQuery('<option>').val(i + 1).text(nama).prop('selected', i === nowMonth));
  });

  // ===== Isi dropdown Tahun (porting getYearSalesAdmin()) =====
  const endYear = new Date().getFullYear();
  for (let y = endYear; y > 2010; y--) {
    $year.append(jQuery('<option>').val(y).text(y).prop('selected', y === endYear));
  }

  $bulan.on('change', loadSalesAdmin);
  $year.on('change', loadSalesAdmin);

  // ===========================================================
  // Tabel utama: Sales Admin (Nama, Total, tombol Point)
  // ===========================================================
  function loadSalesAdmin() {
    jQuery.ajax({
      type: 'POST',
      url: APP_CONFIG.API_BASE_URL + '/get-sales-admin',
      dataType: 'JSON',
      data: {
        karyawan_id: localStorage.getItem('user_id'),
        point_bulan_admin: $bulan.val(),
        year: $year.val(),
      },
      beforeSend() {
        jQuery('#ps_table_body').html('<tr><td colspan="3" class="tbl-empty">Memuat data...</td></tr>');
      },
      success(data) {
        const rows = data.data || [];
        if (!rows.length) {
          jQuery('#ps_table_body').html('<tr><td colspan="3" class="tbl-empty">Tidak ada data.</td></tr>');
          return;
        }

        const html = rows.map((item) => {
          const totalInfo = (data.get_total && data.get_total[item.karyawan_id]) || null;
          const bonus = totalInfo ? totalInfo.total.bonus : null;
          const pointBtn = bonus != null
            ? `<button data-kid="${item.karyawan_id}" data-kname="${escapeAttr(item.karyawan_nama)}" class="btn-tbl btn-tbl--primary btn-point">Point</button>`
            : '';
          return `
            <tr>
              <td class="td-left btn-nama-sales" data-nama="${escapeAttr(item.karyawan_nama)}" data-hp="${escapeAttr(item.karyawan_hp || '-')}" data-alamat="${escapeAttr(item.karyawan_alamat || '-')}" style="cursor:pointer;">${item.karyawan_nama}</td>
              <td class="td-center">${numberFormat(bonus || 0)}</td>
              <td class="td-center">${pointBtn}</td>
            </tr>
          `;
        }).join('');

        jQuery('#ps_table_body').html(html);
      },
      error() {
        jQuery('#ps_table_body').html('<tr><td colspan="3" class="tbl-empty">Gagal memuat data.</td></tr>');
      },
    });
  }

  jQuery('#ps_table_body').on('click', '.btn-nama-sales', function () {
    const $el = jQuery(this);
    jQuery('#dsa_nama').text($el.data('nama'));
    jQuery('#dsa_hp').text($el.data('hp'));
    jQuery('#dsa_alamat').text($el.data('alamat'));
    app.popup.open('#popup-detail-sales-admin');
  });

  jQuery('#ps_table_body').on('click', '.btn-point', function () {
    currentKaryawanId = jQuery(this).data('kid');
    currentKaryawanNama = jQuery(this).data('kname');
    jQuery('#pd_karyawan_nama').text(currentKaryawanNama);
    app.popup.open('#popup-point-detail');
    loadPointDetail();
  });

  // ===========================================================
  // Popup Point per karyawan: list SPK (porting pointSales())
  // ===========================================================
  function loadPointDetail() {
    jQuery.ajax({
      type: 'POST',
      url: APP_CONFIG.API_BASE_URL + '/download-point-admin',
      dataType: 'JSON',
      data: {
        karyawan_id: currentKaryawanId,
        month: $bulan.val(),
        year: $year.val(),
      },
      beforeSend() {
        jQuery('#pd_table_body').html('<tr><td colspan="8" class="tbl-empty">Memuat data...</td></tr>');
      },
      success(data) {
        const rows = data.data || [];
        let no = 0;
        let totalNilai = 0;
        let totalPoint = 0;

        const bodyRows = rows.map((item) => {
          const kurangBayar = parseFloat(item.penjualan_grandtotal) - parseFloat(item.penjualan_jumlah_pembayaran);
          if (kurangBayar > 0) return ''; // porting: baris kurang_bayar>0 disembunyikan (belum lunas)

          no++;
          const nilaiJual = parseFloat(item.penjualan_grandtotal) || 0;
          const persentase = parseFloat(item.presentase_omset) || 0;
          const totalRow = (nilaiJual * persentase) / 100;
          totalNilai += nilaiJual;
          totalPoint += totalRow;

          const validCell = item.point_valid_manager == 1
            ? '<span class="btn-tbl btn-tbl--success">Valid</span>'
            : `<button class="btn-tbl btn-tbl--muted btn-validasi"
                 data-penjualan-id="${item.penjualan_id}"
                 data-client-id="${item.client_id}"
                 data-client-nama="${escapeAttr(item.client_nama)}"
                 data-logo="${escapeAttr(item.customer_logo || '')}"
                 data-persentase="${persentase}"
                 data-alamat="${escapeAttr(item.client_alamat || '-')}">Detail</button>`;

          return `
            <tr>
              <td class="td-center">${no}</td>
              <td class="td-center">${formatDayMonth(item.penjualan_tanggal)}</td>
              <td class="td-center btn-spk-detail" data-penjualan-id="${item.penjualan_id}" style="cursor:pointer;"><b>${spkLabel(item.penjualan_id, item.dt_record)}</b></td>
              <td class="td-left">${item.client_nama}</td>
              <td class="td-center">${numberFormat(nilaiJual)}</td>
              <td class="td-center">${persentase}</td>
              <td class="td-center">${numberFormat(totalRow)}</td>
              <td class="td-center">${validCell}</td>
            </tr>
          `;
        }).join('');

        const totalRowHtml = `
          <tr>
            <td class="td-center" colspan="4"><b>Total</b></td>
            <td class="td-center"><b>${numberFormat(totalNilai)}</b></td>
            <td class="td-center"></td>
            <td class="td-center"><b>${numberFormat(totalPoint)}</b></td>
            <td class="td-center"></td>
          </tr>
        `;

        jQuery('#pd_table_body').html((bodyRows || '<tr><td colspan="8" class="tbl-empty">Tidak ada data.</td></tr>') + totalRowHtml);
      },
      error() {
        jQuery('#pd_table_body').html('<tr><td colspan="8" class="tbl-empty">Gagal memuat data.</td></tr>');
      },
    });
  }

  // ===========================================================
  // Popup Detail SPK: produk + logo customer (porting detailPenjualanOwner())
  // ===========================================================
  jQuery('#pd_table_body').on('click', '.btn-spk-detail', function () {
    const penjualanId = jQuery(this).data('penjualan-id');
    app.popup.open('#popup-spk-detail');
    loadSpkDetail(penjualanId);
  });

  function loadSpkDetail(penjualanId) {
    jQuery.ajax({
      type: 'POST',
      url: APP_CONFIG.API_BASE_URL + '/get-penjualan-detail-performa',
      dataType: 'JSON',
      data: {
        karyawan_id: localStorage.getItem('user_id'),
        penjualan_id: penjualanId,
      },
      beforeSend() {
        jQuery('#spk_detail_body').html('<p class="tbl-empty">Memuat data...</p>');
      },
      success(data) {
        const rows = data.data || [];
        if (!rows.length) {
          jQuery('#spk_detail_body').html('<p class="tbl-empty">Tidak ada data.</p>');
          return;
        }

        const produkHtml = rows.map((val, i) => {
          const keterangan = val.keterangan || '';
          const pathImage = String(val.gambar || '').substring(0, 5) === 'koper'
            ? IMAGE_BASE + '/product_image_new/'
            : IMAGE_BASE + '/performa_image/';
          const src = pathImage + val.gambar;
          return `
            <div class="card-surface overflow-hidden">
              <div class="bg-surface-raised text-center text-xs font-bold text-ink-secondary py-1.5">Produk #${i + 1}</div>
              <div class="p-2 flex gap-2">
                <div class="w-1/3 flex-shrink-0 text-center">
                  <img data-zoom-src="${src}" src="${src}" class="w-full rounded cursor-zoom-in img-zoom" />
                  <p class="text-[11px] text-ink-secondary mt-1">${val.penjualan_jenis || ''}</p>
                </div>
                <div class="flex-1 text-xs text-ink-primary whitespace-pre-wrap">
                  ${val.produk_keterangan_kustom || ''}
                  ${keterangan ? `<br><span class="text-danger">${keterangan}</span>` : ''}
                </div>
              </div>
              <div class="text-center text-xs font-semibold text-ink-secondary py-1.5 border-t border-ink-faint">Qty: ${val.penjualan_qty}</div>
            </div>
          `;
        }).join('');

        const logoSection = (label, path) => {
          if (!path) return '';
          const src = IMAGE_BASE + '/customer_logo/' + path;
          return `
            <div class="card-surface overflow-hidden">
              <div class="bg-surface-raised text-center text-xs font-bold text-ink-secondary py-1.5">${label}</div>
              <div class="p-3 text-center">
                <img data-zoom-src="${src}" src="${src}" class="inline-block max-w-[70%] rounded cursor-zoom-in img-zoom" />
              </div>
            </div>
          `;
        };

        const first = rows[0];
        const logosHtml = [
          logoSection('Customer Logo', first.customer_logo),
          logoSection('Logo Bordir', first.customer_logo_bordir),
          logoSection('Logo Tambahan', first.customer_logo_tambahan),
        ].join('');

        jQuery('#spk_detail_body').html(produkHtml + logosHtml);
      },
      error() {
        jQuery('#spk_detail_body').html('<p class="tbl-empty">Gagal memuat data.</p>');
      },
    });
  }

  jQuery('#spk_detail_body').on('click', '.img-zoom', function () {
    app.photoBrowser.create({ photos: [jQuery(this).data('zoom-src')] }).open();
  });

  // ===========================================================
  // Popup Validasi Client (porting openValidasiClientPopup/searchClientValidasi/
  // loadClientsByKeyword/validasiClientAction/processValidasiClient).
  // TANPA tombol WhatsApp (disepakati, lihat catatan scope di atas).
  // ===========================================================
  jQuery('#pd_table_body').on('click', '.btn-validasi', function () {
    const $el = jQuery(this);
    jQuery('#vc_penjualan_id').val($el.data('penjualan-id'));
    jQuery('#vc_client_id').val($el.data('client-id'));
    jQuery('#vc_persentase').val($el.data('persentase'));
    jQuery('#vc_nama').text($el.data('client-nama') || '-');
    jQuery('#vc_alamat').text($el.data('alamat') || '-');

    const logo = $el.data('logo');
    jQuery('#vc_logo').attr('src', logo ? IMAGE_BASE + '/customer_logo/' + logo : NOIMAGE);

    jQuery('#vc_search').val('');
    jQuery('#vc_results').html('<p class="tbl-empty">Ketik minimal 2 karakter untuk mencari...</p>');

    app.popup.open('#popup-validasi-client');
  });

  // 'input' (bukan 'keyup' spt onkeyup="searchClientValidasi()" di
  // admin-finance-apk asli) -- supaya paste/autofill/IME ikut memicu
  // pencarian, tidak cuma keystroke fisik.
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
        karyawan_id: currentKaryawanId,
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
          app.dialog.alert(msg, 'Sukses', () => loadPointDetail());
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

  loadSalesAdmin();

  return function unmount() {
    if (searchTimeout) clearTimeout(searchTimeout);
  };
}
