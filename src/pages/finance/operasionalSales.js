// Popup "Operasional Sales" -- porting dari admin-finance-apk/www/js/data.js
// (openOperasionalSalesModal/loadOperasionalSalesFinanceList/
// groupOperasionalSalesByDateSales/renderOperasionalSalesFinanceList/
// openOpsGroupDetail/showOpsSummary/openTambahTransaksiOpsModal/
// loadKategoriOps/loadSalesListOps/openDetailTransaksiOps/
// approveTransaksiOps/rejectTransaksiOps/submitFormTambahTransaksiOps),
// dipicu dari tombol di sebelah "Muat Ulang" pada halaman
// pages/finance/sales.js (permintaan user 2026-09-09, "tambahkan juga fitur
// popup operasional sales seperti yg ada di admin-finance-apk", lalu
// "untuk popup operasional sales tambahkan saja button disamping button
// refresh untuk trigger popupnya"). BUKAN halaman/route sendiri -- markup
// (operasionalSales.html) di-append ke container halaman Sales via mount()
// di bawah, dipanggil dari pages/finance/sales.js::mount().
//
// Fitur ini TERPISAH dari "Uang Saku" (Detail Kunjungan, sales.js) meski
// sama-sama nulis ke tabel `t_keuangan_sales` -- di sini ledger UMUM biaya
// operasional sales (transport/konsumsi/penginapan/pengembalian/dst, INPUT
// manual oleh sales dari app sales-koperindo-apk ATAU langsung oleh Finance
// lewat popup Tambah di sini) dgn alur approve/reject, TIDAK terikat ke
// kunjungan tertentu. Lihat riset di riwayat percakapan utk detail lengkap.
//
// [DILUAR SCOPE, TIDAK diporting krn sudah TERBUKTI dead code di sumber
// asli] `openCameraOps()`/`window.opsFotoBase64` (Cordova camera) -- app
// ini TIDAK PERNAH pasang plugin kamera (pola sama dgn semua upload foto
// lain di app ini), Foto Bukti di sini HANYA lewat `<input type="file">`
// (pola sama dgn "Upload Bukti Transfer" pages/finance/payable.js).
//
// [FIX drpd sumber asli] Tombol "Tolak" (rejectTransaksiOps()) di sumber
// pakai `app.dialog.prompt()` utk minta alasan penolakan -- method itu TIDAK
// ADA di shim dialog.js app ini (cuma preloader/alert/confirm/close, lihat
// docblock panjang soal ini di pages/absen/validasi.js::confirmSuratTerlambat()
// -- kasus SAMA PERSIS pernah bikin 1 tombol gagal total di app ini). Diganti
// popup kustom (#popup-ops-tolak, textarea) sebelum kirim ke
// /finance-operasional-sales-reject, bukan native prompt().
//
// Endpoint (SEMUA App\Http\Controllers\API\Accounting\FinanceOperasionalController,
// backend-production, DICEK langsung ke source): POST
// /finance-operasional-sales-list {tahun,bulan?} -> {data[],summary},
// POST /finance-operasional-sales-detail {id}, POST
// /finance-operasional-sales-approve {id,approved_by,catatan_finance?},
// POST /finance-operasional-sales-reject {id,approved_by,catatan_finance
// (wajib)}, POST /finance-operasional-sales-input (multipart:
// user_id,kategori_id,nominal,deskripsi?,approved_by,foto_bukti(file,opsional)),
// POST /finance-operasional-sales-kategori, POST
// /finance-operasional-sales-users. Foto disimpan di `bukti_accounting/`
// (host lama) -- pakai IMG_BUKTI_ACCOUNTING sama persis sales.js.

import tpl from './operasionalSales.html?raw';
import { APP_CONFIG } from '../../lib/config.js';
import { numberFormat, formatDateShort, formatTgl } from '../../lib/format.js';

const IMAGE_BASE = APP_CONFIG.IMAGE_BASE_URL;
const IMG_BUKTI_ACCOUNTING = IMAGE_BASE + '/bukti_accounting/';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const STATUS_BADGE = {
  pending: '<span class="text-xs font-semibold px-2 py-0.5 rounded bg-warning text-white">PENDING</span>',
  approved: '<span class="text-xs font-semibold px-2 py-0.5 rounded bg-success text-white">APPROVED</span>',
  rejected: '<span class="text-xs font-semibold px-2 py-0.5 rounded bg-danger text-white">REJECTED</span>',
};

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fotoUrl(path) {
  return path ? `${IMG_BUKTI_ACCOUNTING}${path}` : null;
}

export function mount(container) {
  container.insertAdjacentHTML('beforeend', tpl);

  let cachedData = [];
  let cachedGroups = {};
  let currentGroupKey = null;
  let currentDetailId = null;
  let currentTolakId = null;
  let salesListData = [];
  let kategoriListData = [];
  let selectedSalesId = null;

  const $bulan = jQuery('#ops_bulan');
  const $tahun = jQuery('#ops_tahun');

  $bulan.append('<option value="all">Semua Bulan</option>');
  const nowMonth = new Date().getMonth();
  BULAN.forEach((nama, i) => {
    $bulan.append(jQuery('<option>').val(String(i + 1).padStart(2, '0')).text(nama).prop('selected', i === nowMonth));
  });
  const nowYear = new Date().getFullYear();
  for (let y = nowYear; y >= nowYear - 3; y--) {
    $tahun.append(jQuery('<option>').val(y).text(y).prop('selected', y === nowYear));
  }

  jQuery('#fs_btn_operasional').on('click', openList);

  function openList() {
    app.popup.open('#popup-ops-list');
    loadList();
    if (!salesListData.length) loadSalesListOps();
    if (!kategoriListData.length) loadKategoriOps();
  }

  jQuery('#ops_bulan, #ops_tahun').on('change', loadList);
  jQuery('#ops_refresh').on('click', loadList);
  jQuery('#ops_search').on('input', () => renderList(filterCached()));
  jQuery('#ops_btn_add').on('click', openTambahModal);

  // [BARU 2026-09-09 atas permintaan user, "untuk searchbox jadikan button
  // disamping tombol plus saja"] Toggle tampil/sembunyi baris pencarian --
  // nutup baris (klik lagi tombolnya) sekalian reset pencarian & render
  // ulang daftar penuh, konsisten dgn search yg "dibersihkan" tiap ditutup.
  jQuery('#ops_btn_search').on('click', function () {
    const $row = jQuery('#ops_search_row');
    const willShow = $row.hasClass('hidden');
    $row.toggleClass('hidden', !willShow);
    jQuery(this).toggleClass('icon-btn--primary', willShow);
    if (willShow) {
      jQuery('#ops_search').val('').trigger('focus');
    } else {
      jQuery('#ops_search').val('');
      renderList(filterCached());
    }
  });

  function filterCached() {
    const q = (jQuery('#ops_search').val() || '').trim().toLowerCase();
    if (!q) return cachedData;
    return cachedData.filter((item) => (item.sales_name || '').toLowerCase().includes(q));
  }

  function loadList() {
    jQuery('#ops_table_body').html('<tr><td colspan="7" class="tbl-empty">Memuat data...</td></tr>');

    const bulan = $bulan.val();
    const reqData = { tahun: $tahun.val() };
    if (bulan && bulan !== 'all') reqData.bulan = bulan;

    jQuery.ajax({
      type: 'POST',
      url: `${APP_CONFIG.BACKEND_PRODUCTION_URL}/finance-operasional-sales-list`,
      dataType: 'JSON',
      data: reqData,
      success(result) {
        if (result.status !== 'success') {
          jQuery('#ops_table_body').html(`<tr><td colspan="7" class="tbl-empty">${escapeHtml(result.message) || 'Gagal memuat data.'}</td></tr>`);
          return;
        }
        cachedData = result.data || [];
        renderList(filterCached());
        showSummary(cachedData);
      },
      error() {
        jQuery('#ops_table_body').html('<tr><td colspan="7" class="tbl-empty">Gagal menghubungi server.</td></tr>');
      },
    });
  }

  // Porting groupOperasionalSalesByDateSales() -- 1 baris rekap = total
  // Masuk/Keluar per Sales+Tanggal, klik Detail buka rincian per transaksi.
  function groupByDateSales(data) {
    const groups = {};
    const order = [];
    (data || []).forEach((item) => {
      const key = `${item.sales_name || '-'}|${item.tanggal_transaksi || ''}`;
      if (!groups[key]) {
        groups[key] = {
          key, salesName: item.sales_name || '-', tanggal: item.tanggal_transaksi,
          totalMasuk: 0, totalKeluar: 0, hasPending: false, hasRejected: false, items: [],
        };
        order.push(key);
      }
      const g = groups[key];
      const nominal = parseFloat(item.nominal) || 0;
      if (item.jenis_transaksi === 'masuk') g.totalMasuk += nominal;
      else g.totalKeluar += nominal;
      if (item.status_approval === 'pending') g.hasPending = true;
      if (item.status_approval === 'rejected') g.hasRejected = true;
      g.items.push(item);
    });
    return order.map((key) => groups[key]);
  }

  // Rekap cepat (card Pengeluaran/Terpakai + Selisih di section-title) --
  // scope SAMA persis dgn tabel di bawahnya (data yg lagi tampil, ikut
  // filter bulan/tahun/nama), bukan seluruh data tanpa filter.
  //
  // [REVISI 2026-09-09 atas permintaan user, "card Pengeluaran (dari sisi
  // Admin) dan card Terpakai (yg dipakai oleh Sales, atau pengeluaran
  // Sales), section-title-nya merupakan selisih uang yg belum di-refund
  // oleh Sales"]:
  //   - Pengeluaran (Admin) = total jenis_transaksi='masuk' TAPI BUKAN
  //     kategori 'pengembalian' -- uang yg SUDAH dikasihkan admin ke sales
  //     (uang_saku dst). Pengembalian dikecualikan krn itu uang BALIK dari
  //     sales, bukan pengeluaran baru dari admin.
  //   - Terpakai (Sales) = total jenis_transaksi='keluar' -- uang yg SUDAH
  //     dipakai sales utk biaya operasional beneran.
  //   - Selisih = Pengeluaran - Terpakai = sisa uang yg masih dipegang
  //     sales, BELUM di-refund.
  //
  // [FIX 2026-09-09 atas permintaan user, "pastikan data yg ter reject
  // tidak terhitung pada nominal tersebut"] Transaksi `status_approval
  // === 'rejected'` DIKECUALIKAN dari ketiga nominal (Pengeluaran/
  // Terpakai/Selisih) -- yang ditolak Finance BUKAN pengeluaran/pemakaian
  // yg beneran terjadi, jadi tidak boleh ikut kehitung. Pending & approved
  // TETAP ikut (belum ada alasan mengecualikan itu).
  function renderTotals(rows) {
    let totalPengeluaran = 0;
    let totalTerpakai = 0;
    rows.filter((item) => item.status_approval !== 'rejected').forEach((item) => {
      const nominal = parseFloat(item.nominal) || 0;
      if (item.jenis_transaksi === 'keluar') {
        totalTerpakai += nominal;
      } else if (item.kategori_kode !== 'pengembalian') {
        totalPengeluaran += nominal;
      }
    });

    jQuery('#ops_total_pengeluaran').text('Rp ' + numberFormat(totalPengeluaran));
    jQuery('#ops_total_terpakai').text('Rp ' + numberFormat(totalTerpakai));

    // [UPDATE 2026-09-09 atas permintaan user, "nominal selisih berwarna
    // merah jika minus, berwarna hijau jika tidak minus"]
    const selisih = totalPengeluaran - totalTerpakai;
    jQuery('#ops_selisih').text((selisih < 0 ? '-Rp ' : 'Rp ') + numberFormat(Math.abs(selisih)))
      .toggleClass('text-danger font-bold', selisih < 0)
      .toggleClass('text-success font-bold', selisih >= 0);
  }

  function renderList(rows) {
    jQuery('#ops_count').text(String(rows.length));
    renderTotals(rows);

    if (!rows.length) {
      jQuery('#ops_table_body').html('<tr><td colspan="7" class="tbl-empty">Tidak ada data transaksi operasional sales.</td></tr>');
      cachedGroups = {};
      return;
    }

    const groups = groupByDateSales(rows);
    cachedGroups = {};
    groups.forEach((g) => { cachedGroups[g.key] = g; });

    const $tbody = jQuery('#ops_table_body').empty();
    groups.forEach((g, index) => {
      const selisih = g.totalMasuk - g.totalKeluar;
      const selisihClass = selisih < 0 ? 'text-danger' : (selisih > 0 ? 'text-success' : 'text-ink-primary');
      const rowClass = g.hasPending ? 'bg-warning/10' : (g.hasRejected ? 'bg-danger/10' : '');

      const $tr = jQuery(`
        <tr class="${rowClass}">
          <td class="td-center">${index + 1}</td>
          <td class="td-center">${formatDateShort(g.tanggal)}</td>
          <td class="td-left">${escapeHtml(g.salesName)}</td>
          <td class="td-right text-success font-semibold">${numberFormat(g.totalMasuk)}</td>
          <td class="td-right text-danger font-semibold">${numberFormat(g.totalKeluar)}</td>
          <td class="td-right font-bold ${selisihClass}">${numberFormat(selisih)}</td>
          <td class="td-center"><button class="btn-tbl btn-tbl--muted btn-ops-group-detail">Detail (${g.items.length})</button></td>
        </tr>
      `);
      $tr.find('.btn-ops-group-detail').on('click', () => openGroupDetail(g.key));
      $tbody.append($tr);
    });

    // Kalau popup rincian grup lagi kebuka & masih merujuk grup yang sama,
    // refresh sekalian isinya (pola sama dgn sumbernya) -- pasca
    // approve/reject dari dalam grup itu.
    if (currentGroupKey && cachedGroups[currentGroupKey] && !jQuery('#popup-ops-group-detail').hasClass('hidden')) {
      openGroupDetail(currentGroupKey);
    }
  }

  function openGroupDetail(key) {
    const g = cachedGroups[key];
    if (!g) {
      app.dialog.alert('Data rincian tidak ditemukan, coba muat ulang dulu.', 'Error');
      return;
    }
    currentGroupKey = key;

    jQuery('#opsg_title').text(`${g.salesName} — ${formatDateShort(g.tanggal)}`);
    jQuery('#opsg_masuk').text('Rp ' + numberFormat(g.totalMasuk));
    jQuery('#opsg_keluar').text('Rp ' + numberFormat(g.totalKeluar));

    const $tbody = jQuery('#opsg_table_body').empty();
    g.items.forEach((item, index) => {
      const isMasuk = item.jenis_transaksi === 'masuk';
      const $tr = jQuery(`
        <tr>
          <td class="td-center">${index + 1}</td>
          <td class="td-center font-semibold ${isMasuk ? 'text-success' : 'text-danger'}">${isMasuk ? 'Masuk' : 'Keluar'}</td>
          <td class="td-left">
            <div class="font-semibold">${escapeHtml(item.kategori_nama) || '-'}</div>
            ${item.deskripsi ? `<div class="text-xs text-ink-muted">${escapeHtml(item.deskripsi)}</div>` : ''}
          </td>
          <td class="td-right font-semibold">${numberFormat(item.nominal)}</td>
          <td class="td-center"><button class="btn-tbl btn-tbl--muted btn-ops-detail">Detail</button></td>
        </tr>
      `);
      $tr.find('.btn-ops-detail').on('click', () => openDetailTransaksi(item.id));
      $tbody.append($tr);
    });

    app.popup.open('#popup-ops-group-detail');
  }

  // Porting showOpsSummary() -- cuma tampil kalau ADA transaksi approved,
  // dihitung per sales, baris dgn total 0 disembunyikan (persis sumbernya).
  function showSummary(data) {
    const approved = (data || []).filter((item) => item.status_approval === 'approved');
    if (!approved.length) return;

    const bySales = {};
    let grandMasuk = 0;
    let grandKeluar = 0;
    approved.forEach((item) => {
      const nama = item.sales_name || '-';
      const nominal = parseFloat(item.nominal) || 0;
      if (!bySales[nama]) bySales[nama] = { masuk: 0, keluar: 0 };
      if (item.jenis_transaksi === 'masuk') { bySales[nama].masuk += nominal; grandMasuk += nominal; }
      else { bySales[nama].keluar += nominal; grandKeluar += nominal; }
    });

    const rows = Object.keys(bySales)
      .map((nama) => ({ nama, ...bySales[nama], total: bySales[nama].masuk - bySales[nama].keluar }))
      .filter((r) => r.total !== 0);
    if (!rows.length) return;

    const grandTotal = grandMasuk - grandKeluar;
    jQuery('#opss_masuk').text(numberFormat(grandMasuk));
    jQuery('#opss_keluar').text(numberFormat(grandKeluar));
    jQuery('#opss_sisa').text(numberFormat(Math.abs(grandTotal)));
    jQuery('#opss_sisa_card').toggleClass('bg-success', grandTotal >= 0).toggleClass('bg-danger', grandTotal < 0);

    jQuery('#opss_table_body').html(rows.map((r) => `
      <tr>
        <td class="td-left">${escapeHtml(r.nama)}</td>
        <td class="td-right text-success font-semibold">${numberFormat(r.masuk)}</td>
        <td class="td-right text-danger font-semibold">${numberFormat(r.keluar)}</td>
        <td class="td-right font-bold ${r.total < 0 ? 'text-danger' : 'text-success'}">${numberFormat(Math.abs(r.total))}</td>
      </tr>
    `).join(''));

    app.popup.open('#popup-ops-summary');
  }

  // ===========================================================
  // Master data (kategori & daftar sales) -- utk popup Tambah Transaksi
  // ===========================================================
  function loadKategoriOps() {
    jQuery.ajax({
      type: 'POST',
      url: `${APP_CONFIG.BACKEND_PRODUCTION_URL}/finance-operasional-sales-kategori`,
      dataType: 'JSON',
      success(result) {
        kategoriListData = (result.status === 'success' && result.data) || [];
        populateKategoriSelect();
      },
      error() { jQuery('#opst_kategori').html('<option value="">Gagal memuat kategori</option>'); },
    });
  }

  function populateKategoriSelect() {
    if (!kategoriListData.length) {
      jQuery('#opst_kategori').html('<option value="">Tidak ada kategori</option>');
      return;
    }
    jQuery('#opst_kategori').html(
      '<option value="">-- Pilih Kategori --</option>'
      + kategoriListData.map((k) => `<option value="${k.id}">${escapeHtml(k.nama)}</option>`).join(''),
    );
  }

  function loadSalesListOps() {
    jQuery.ajax({
      type: 'POST',
      url: `${APP_CONFIG.BACKEND_PRODUCTION_URL}/finance-operasional-sales-users`,
      dataType: 'JSON',
      success(result) { salesListData = (result.status === 'success' && result.data) || []; },
    });
  }

  // ===========================================================
  // Popup Tambah Transaksi
  // ===========================================================
  function openTambahModal() {
    resetTambahForm();
    if (!salesListData.length) loadSalesListOps();
    if (!kategoriListData.length) loadKategoriOps();
    else populateKategoriSelect();
    app.popup.open('#popup-ops-tambah');
  }

  function resetTambahForm() {
    selectedSalesId = null;
    jQuery('#opst_sales_text').val('');
    jQuery('#opst_kategori').val('');
    jQuery('#opst_nominal').val('');
    jQuery('#opst_keterangan').val('');
    jQuery('#opst_file').val('');
    jQuery('#opst_filename').text('');
    jQuery('#opst_preview_wrap').addClass('hidden');
    jQuery('#opst_error').addClass('hidden');
    jQuery('#opst_btn_submit').prop('disabled', false).text('Simpan');
  }

  jQuery('#opst_btn_pilih_sales').on('click', openPilihSales);

  function openPilihSales() {
    jQuery('#opsp_search').val('');
    renderPilihSalesList(salesListData);
    app.popup.open('#popup-ops-pilih-sales');
  }

  jQuery('#opsp_search').on('input', function () {
    const q = jQuery(this).val().trim().toLowerCase();
    renderPilihSalesList(q ? salesListData.filter((s) => (s.username || '').toLowerCase().includes(q)) : salesListData);
  });

  function renderPilihSalesList(list) {
    const $list = jQuery('#opsp_list').empty();
    if (!list.length) {
      $list.html('<p class="tbl-empty">Tidak ada sales.</p>');
      return;
    }
    list.forEach((s) => {
      const $row = jQuery(`<div class="py-2.5 cursor-pointer hover:bg-surface-raised px-1">${escapeHtml(s.username)}</div>`);
      $row.on('click', () => {
        selectedSalesId = s.user_id;
        jQuery('#opst_sales_text').val(s.username);
        app.popup.close('#popup-ops-pilih-sales');
      });
      $list.append($row);
    });
  }

  jQuery('#opst_nominal').on('input', function () {
    const digits = jQuery(this).val().replace(/[^0-9]/g, '');
    jQuery(this).val(digits ? numberFormat(digits) : '');
  });

  jQuery('#opst_file').on('change', function () {
    const file = this.files && this.files[0];
    if (!file) return;
    jQuery('#opst_filename').text('File: ' + file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      jQuery('#opst_preview').attr('src', e.target.result);
      jQuery('#opst_preview_wrap').removeClass('hidden');
    };
    reader.readAsDataURL(file);
  });
  jQuery('#opst_preview').on('click', function () {
    app.photoBrowser.create({ photos: [jQuery(this).attr('src')] }).open();
  });

  jQuery('#opst_btn_submit').on('click', submitTambahTransaksi);

  function submitTambahTransaksi() {
    const $err = jQuery('#opst_error').addClass('hidden');
    const kategoriId = jQuery('#opst_kategori').val();
    const nominal = parseInt(jQuery('#opst_nominal').val().replace(/[^0-9]/g, ''), 10) || 0;
    const fileInput = document.getElementById('opst_file');

    if (!selectedSalesId) { $err.text('Pilih sales terlebih dahulu.').removeClass('hidden'); return; }
    if (!kategoriId) { $err.text('Pilih kategori terlebih dahulu.').removeClass('hidden'); return; }
    if (nominal <= 0) { $err.text('Nominal harus lebih dari 0.').removeClass('hidden'); return; }

    const $btn = jQuery('#opst_btn_submit').prop('disabled', true).text('Menyimpan...');

    const formData = new FormData();
    formData.append('user_id', selectedSalesId);
    formData.append('kategori_id', kategoriId);
    formData.append('nominal', nominal);
    formData.append('deskripsi', (jQuery('#opst_keterangan').val() || '').trim());
    formData.append('approved_by', localStorage.getItem('user_id'));
    if (fileInput.files && fileInput.files[0]) formData.append('foto_bukti', fileInput.files[0]);

    jQuery.ajax({
      type: 'POST',
      url: `${APP_CONFIG.BACKEND_PRODUCTION_URL}/finance-operasional-sales-input`,
      dataType: 'JSON',
      data: formData,
      processData: false,
      contentType: false,
      success(result) {
        if (result.status === 'success') {
          app.popup.close('#popup-ops-tambah');
          app.dialog.alert(result.message || 'Transaksi berhasil ditambahkan.', 'Sukses', () => loadList());
        } else {
          $err.text(result.message || 'Gagal menambahkan transaksi.').removeClass('hidden');
          $btn.prop('disabled', false).text('Simpan');
        }
      },
      error(xhr) {
        $err.text((xhr.responseJSON && xhr.responseJSON.message) || 'Gagal menghubungi server.').removeClass('hidden');
        $btn.prop('disabled', false).text('Simpan');
      },
    });
  }

  // ===========================================================
  // Popup Detail Transaksi + Approve/Reject
  // ===========================================================
  function openDetailTransaksi(id) {
    currentDetailId = id;
    jQuery('#opsd_body').html('<p class="tbl-empty">Memuat...</p>');
    jQuery('#opsd_actions').addClass('hidden').removeClass('flex');
    app.popup.open('#popup-ops-detail');

    jQuery.ajax({
      type: 'POST',
      url: `${APP_CONFIG.BACKEND_PRODUCTION_URL}/finance-operasional-sales-detail`,
      dataType: 'JSON',
      data: { id },
      success(result) {
        if (result.status !== 'success') {
          app.dialog.alert(result.message || 'Gagal memuat detail.', 'Error');
          app.popup.close('#popup-ops-detail');
          return;
        }
        renderDetailTransaksi(result.data);
      },
      error() {
        app.dialog.alert('Gagal menghubungi server.', 'Error');
        app.popup.close('#popup-ops-detail');
      },
    });
  }

  function renderDetailTransaksi(data) {
    const isMasuk = data.jenis_transaksi === 'masuk';
    const foto = fotoUrl(data.foto_bukti);

    jQuery('#opsd_body').html(`
      <div class="flex items-center justify-between">
        <p class="mat-label mb-0">Status</p>
        ${STATUS_BADGE[data.status_approval] || data.status_approval}
      </div>
      <div>
        <p class="mat-label">Tanggal</p>
        <p class="text-ink-primary font-semibold">${formatTgl(data.tanggal_transaksi)}</p>
      </div>
      <div>
        <p class="mat-label">Sales</p>
        <p class="text-ink-primary">${escapeHtml(data.sales_name) || '-'}</p>
      </div>
      <div>
        <p class="mat-label">Kategori</p>
        <p class="text-ink-primary">${escapeHtml(data.kategori_nama) || '-'}</p>
      </div>
      ${data.deskripsi ? `
      <div>
        <p class="mat-label">Uraian</p>
        <p class="text-ink-primary">${escapeHtml(data.deskripsi)}</p>
      </div>` : ''}
      <div class="card-surface p-3" style="border-left:4px solid ${isMasuk ? 'var(--color-success)' : 'var(--color-danger)'};">
        <p class="mat-label">Nominal</p>
        <p class="text-xl font-bold text-ink-primary">Rp ${numberFormat(data.nominal)}</p>
        <span class="text-xs font-semibold px-2 py-0.5 rounded ${isMasuk ? 'bg-success' : 'bg-danger'} text-white mt-1 inline-block">${isMasuk ? 'Masuk' : 'Keluar'}</span>
      </div>
      ${foto ? `
      <div>
        <p class="mat-label">Foto Bukti</p>
        <img data-lightbox src="${foto}" class="w-full max-w-[240px] rounded border border-ink-faint object-cover cursor-zoom-in" />
      </div>` : ''}
      ${data.status_approval !== 'pending' ? `
      <div class="card-surface p-3">
        <p class="mat-label">${data.status_approval === 'approved' ? 'Disetujui Oleh' : 'Ditolak Oleh'}</p>
        <p class="text-ink-primary">${escapeHtml(data.approved_by_name) || '-'}</p>
        <p class="text-xs text-ink-muted mt-0.5">${data.dt_approved ? new Date(data.dt_approved).toLocaleString('id-ID') : '-'}</p>
        ${data.catatan_finance ? `<p class="mat-label mt-2">Catatan</p><p class="text-ink-primary">${escapeHtml(data.catatan_finance)}</p>` : ''}
      </div>` : ''}
    `);

    jQuery('#opsd_body [data-lightbox]').on('click', function () {
      app.photoBrowser.create({ photos: [jQuery(this).attr('src')] }).open();
    });

    jQuery('#opsd_actions').toggleClass('hidden', data.status_approval !== 'pending').toggleClass('flex', data.status_approval === 'pending');
  }

  jQuery('#opsd_btn_setujui').on('click', () => approveTransaksi(currentDetailId));
  jQuery('#opsd_btn_tolak').on('click', () => openTolak(currentDetailId));

  function approveTransaksi(id) {
    app.dialog.confirm('Apakah Anda yakin ingin menyetujui transaksi ini?', 'Konfirmasi', () => {
      jQuery.ajax({
        type: 'POST',
        url: `${APP_CONFIG.BACKEND_PRODUCTION_URL}/finance-operasional-sales-approve`,
        dataType: 'JSON',
        data: { id, approved_by: localStorage.getItem('user_id'), catatan_finance: 'Approved' },
        success(result) {
          if (result.status === 'success') {
            app.popup.close('#popup-ops-detail');
            app.dialog.alert(result.message || 'Transaksi berhasil disetujui.', 'Sukses', () => loadList());
          } else {
            app.dialog.alert(result.message || 'Gagal menyetujui transaksi.', 'Error');
          }
        },
        error() { app.dialog.alert('Gagal menghubungi server.', 'Error'); },
      });
    });
  }

  function openTolak(id) {
    currentTolakId = id;
    jQuery('#opstl_catatan').val('');
    app.popup.open('#popup-ops-tolak');
  }

  jQuery('#opstl_btn_submit').on('click', function () {
    const catatan = (jQuery('#opstl_catatan').val() || '').trim();
    if (!catatan) {
      app.dialog.alert('Alasan penolakan harus diisi.', 'Peringatan');
      return;
    }
    const $btn = jQuery(this).prop('disabled', true).text('Mengirim...');

    jQuery.ajax({
      type: 'POST',
      url: `${APP_CONFIG.BACKEND_PRODUCTION_URL}/finance-operasional-sales-reject`,
      dataType: 'JSON',
      data: { id: currentTolakId, approved_by: localStorage.getItem('user_id'), catatan_finance: catatan },
      success(result) {
        $btn.prop('disabled', false).text('Kirim');
        if (result.status === 'success') {
          app.popup.close('#popup-ops-tolak');
          app.popup.close('#popup-ops-detail');
          app.dialog.alert(result.message || 'Transaksi berhasil ditolak.', 'Sukses', () => loadList());
        } else {
          app.dialog.alert(result.message || 'Gagal menolak transaksi.', 'Error');
        }
      },
      error() {
        $btn.prop('disabled', false).text('Kirim');
        app.dialog.alert('Gagal menghubungi server.', 'Error');
      },
    });
  });

  return function unmount() { };
}
