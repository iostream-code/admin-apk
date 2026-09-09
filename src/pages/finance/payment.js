// Finance -- Payment. Porting dari admin-finance-apk/www/js/notif.js
// (getDashboardNotif/openPopupValidasi/openPopupSales/openPopupALamat) +
// notif.html. `openPopupUnvalid`/`prosesUnvalidPembayaran` (reset validasi)
// SEMPAT ikut diporting, DIHAPUS lagi 2026-09-07 atas permintaan user
// ("data yg sudah divalidasi tidak bisa direset. jadi hilangkan fitur
// tersebut") -- lihat catatan di renderTable().
//
// SCOPE PASS INI (disepakati dgn user 2026-08-26): data inti -- tabel log
// pembayaran DIGABUNG 1 halaman (BUKAN 2 halaman terpisah spt
// admin-finance-apk lama), status Unvalid/Valid sempat lewat 1 dropdown
// filter (#pay_status_filter, BUKAN 2 tombol toggle terpisah spt aslinya --
// atas permintaan user "jadikan satu saja buat sebagai filter") -- DICOPOT
// lagi 2026-09-07 atas permintaan user susulan ("hilangkan filter ganti
// dengan button history disamping refresh konsepnya sama seperti yg ada di
// menu SJ"), lihat #pay_toggle_riwayat di bawah -- + 1 search box
// gabungan Perusahaan/Sales (#pay_search, jg atas permintaan user -- lihat
// catatan panjang di loadDataNotif() soal kenapa filternya jalan di FE) +
// popup Validasi (pilih bank, upload bukti mutasi kalau "Mandiri Kopra") +
// popup kecil Info Client/Sales + PAGINASI (`#pay_pagination`, ditambahkan
// 2026-08-26 atas permintaan user, pola sama persis dgn
// inventory-apk/src/pages/partner/partner.js -- 20 baris/halaman, dipotong
// DI FE dari `rowsData` yg sudah difilter, bukan fetch ulang tiap ganti
// halaman -- lihat renderTable()). BELUM diporting: popup Detail SPK
// (`detailPenjualanNotif`, ~200 baris) & popup Detail Histori Pembayaran
// (`detailPembayaranNotif`, ~500 baris, riwayat hingga 10x bayar per SPK) --
// keduanya drill-down informasi (bukan aksi wajib utk alur valid), ditunda
// ke pass berikutnya. Kolom SPK & Jumlah SENGAJA tidak bisa diklik di sini
// (sama pola dgn kolom SPK Point Produksi yang sengaja tidak diklik krn
// popup targetnya belum ada).
//
// KONTRAK BACKEND: endpoint valid-bukti-pembayaran-admin/
// get-notif-pembayaran-admin sudah dicek COCOK PERSIS dgn
// ServiceController@validBuktiPembayaranAdmin & AdminController@
// getNotifPembayaranAdmin saat ini (beda dgn kasus Ijin di
// pages/absen/ijin.js yang ternyata sudah basi) -- porting di sini APA
// ADANYA, bukan rekonstruksi kontrak baru.
//
// `asal_server` (field per-baris dari log_pembayaran.asal_server) dipakai
// APA ADANYA utk endpoint valid & preview bukti mutasi (BISA beda2 per
// baris) -- TIDAK diganti APP_CONFIG.API_BASE_URL. Foto "Bukti Pembayaran
// dari Sales" di popup manual pakai domain tetap
// (IMAGE_BASE_URL) persis kode aslinya yang hardcode 'https://indokoper.com'
// utk foto ini (beda dari foto bukti mutasi yang pakai asal_server) --
// inkonsistensi ini ADA DI ASLINYA, bukan salah ketik di sini.

import tpl from './payment.html?raw';
import { APP_CONFIG } from '../../lib/config.js';
import { numberFormat } from '../../lib/format.js';
import { showAuthedShell } from '../../lib/shell.js';

const IMAGE_BASE = APP_CONFIG.IMAGE_BASE_URL;

const BANK_OPTIONS = [
  { value: 'Mandiri Kopra', label: 'Mandiri Kopra (1410002255818 A/N Sutono)' },
  { value: 'Mandiri', label: 'Mandiri (1410005187422 A/N Sutono)' },
  { value: 'BCA', label: 'BCA (0183129551 A/N Sutono)' },
  { value: 'BRI', label: 'BRI (058401031165502 A/N Sutono)' },
  { value: 'Mandiri Bisnis', label: 'Mandiri Bisnis (Luar Pulau) (1410506070895 A/N Santoso)' },
  { value: 'Mandiri Owner', label: 'Mandiri (1180014824725 A/N Yu Shujin)' },
  { value: 'Tunai', label: 'Tunai' },
];

function isEmpty(v) {
  return v == null || v === 'null' || v === '';
}

// [UPDATE 2026-08-28 atas permintaan user, lanjutan] Percobaan pertama
// (lookup value string ke BANK_OPTIONS) TERNYATA TIDAK CUKUP: data live
// ternyata sering nyimpen `bank_validasi`/`bank_N` sbg ANGKA (bank_id dari
// tabel master `m_bank`, mis. "3", "1"), bukan nama teks -- beda dari
// db_dump.sql (offline, agak basi) yg cuma punya baris lama bertipe teks.
// `m_bank` (`getBankList` di PaymentController, endpoint POST
// /get-bank-list) adalah master data bank YANG BARU (dt_record 2026-01-20)
// dgn bank_label yg sudah gabung nama+rekening+a.n. -- itu yg dipakai utk
// resolve value ANGKA. Utk value TEKS lama (mis. "Mandiri", "BCA") tetap
// lookup ke BANK_OPTIONS spt sebelumnya (BANK_OPTIONS TIDAK diganti sumbernya
// ke m_bank krn dipakai jg utk pilihan & aturan wajib-upload-bukti-mutasi di
// popup Validasi -- lihat toggleUploadSection() -- di luar scope perubahan
// tampilan ini). `bankById` (map bank_id -> label) diisi oleh
// loadBankList() di bawah, dipanggil sekali saat mount().
function getBankLabel(value, bankById) {
  if (isEmpty(value) || value === '-') return '-';
  const byOption = BANK_OPTIONS.find((b) => b.value === value);
  if (byOption) return byOption.label;
  const byId = bankById && bankById[String(value)];
  if (byId) return byId;
  return value;
}

// [UPDATE 2026-08-26 atas permintaan user, "samakan format penulisan
// tanggal pada tab Payment sama seperti yg ada pada tab Payable"] Format
// tanggal DISAMAKAN dgn formatTanggalTransaksi() di pages/finance/payable.js
// ('DD-MMM-YYYY', mis. "20-Agu-2026") -- BEDA dari notif.js asli yg pakai
// 'DD-MM-YY HH:mm' (moment(val.datetime).format(...), termasuk jam). Jam
// pembayaran SENGAJA tidak lagi ditampilkan di kolom ini demi konsistensi
// format lintas tab Finance.
function formatDateTime(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${String(d.getDate()).padStart(2, '0')}-${BULAN_SINGKAT[d.getMonth()]}-${d.getFullYear()}`;
}

const ITEMS_PER_PAGE = 20; // pola sama dgn inventory-apk/src/pages/partner/partner.js

export function mount(container) {
  container.innerHTML = tpl;
  showAuthedShell('/finance/payment');

  // 0 = Unvalid (tampil default -- data yang PERLU DIPROSES), 1 = Valid
  // (tampil kalau tombol "Riwayat" aktif) -- pengganti localStorage('notif_value')
  // di app lama. [BERUBAH 2026-09-07] SEBELUMNYA lewat dropdown
  // #pay_status_filter, sekarang lewat toggle #pay_toggle_riwayat, konsep
  // SAMA PERSIS pages/sj/list.js (historyMode: false=aktif/perlu diproses,
  // true=riwayat/sudah selesai).
  let validAdmin = 0;
  let searchTimeout = null;
  let currentPage = 1;
  let rowsData = []; // seluruh baris HASIL filter pencarian (SEBELUM dipotong per halaman) -- lookup dari data-idx tombol Opsi/Client/Sales -> row, lihat renderTable()
  let bankById = {}; // map bank_id (m_bank, string key) -> bank_label, diisi loadBankList() -- lihat catatan di getBankLabel()

  // Porting getBankList (PaymentController::getBankList, POST /get-bank-list) --
  // dipanggil sekali saat mount, HASIL dipakai getBankLabel() utk resolve
  // bank_validasi/bank_N yg tersimpan sbg bank_id angka. Tabel tetap
  // dirender (fallback tampilkan raw value) walau fetch ini gagal/lambat --
  // begitu selesai, re-render halaman aktif supaya label ke-update.
  function loadBankList() {
    jQuery.ajax({
      type: 'POST',
      url: APP_CONFIG.API_BASE_URL + '/finance/get-bank-list',
      dataType: 'JSON',
      success(data) {
        if (Number(data.status) === 1 && Array.isArray(data.data)) {
          data.data.forEach((b) => {
            bankById[String(b.bank_id)] = b.bank_label
              || `${b.bank_nama || b.bank_kode}${b.bank_no_rekening ? ` (${b.bank_no_rekening}${b.bank_atas_nama ? ` A/N ${b.bank_atas_nama}` : ''})` : ''}`;
          });
          renderTable();
        }
      },
    });
  }

  jQuery('#pay_toggle_riwayat').on('click', () => {
    validAdmin = validAdmin === 0 ? 1 : 0;
    currentPage = 1;
    jQuery('#pay_toggle_riwayat').toggleClass('icon-btn--danger', validAdmin === 1);
    loadDataNotif();
  });

  jQuery('#pay_search').on('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      loadDataNotif();
    }, 700);
  });
  jQuery('#pay_refresh').on('click', () => {
    currentPage = 1;
    loadDataNotif();
  });

  // Porting getDashboardNotif() -- BEDA dari aslinya: search box Perusahaan
  // & Sales DIGABUNG jadi 1 (#pay_search, atas permintaan user 2026-08-26)
  // sedangkan backend (AdminController::getNotifPembayaranAdmin) menerapkan
  // 2 filter itu sbg AND terpisah (`->where('client_nama', ...)` LALU
  // `->where('karyawan_nama', ...)`) -- kalau teks yg sama dikirim ke
  // KEDUANYA sekaligus, hasilnya jadi AND (harus cocok di kedua kolom
  // sekaligus), bukan OR (cocok di salah satu) spt yg diharapkan dari satu
  // search box gabungan. Makanya filter gabungan ini dilakukan DI FE
  // (cocok client_nama ATAU karyawan_nama) SETELAH data diambil apa adanya
  // per status (valid_admin) dari backend -- bukan dikirim ke param
  // perusahaan_notif_value/sales_notif_filter sama sekali (keduanya selalu
  // 'empty' ke backend).
  // Kolom "Aksi" cuma relevan di mode Unvalid (satu-satunya isinya, tombol
  // Valid) -- lihat catatan panjang di renderTable() soal kenapa DICOPOT
  // SELURUHNYA (bukan cuma dikosongkan) di mode Riwayat/Valid, pola SAMA
  // PERSIS pages/sj/list.js (showAksi). Dipakai jg utk colspan pesan
  // loading/error/kosong di bawah supaya tetap selebar tabel yang lagi
  // ditampilkan.
  function colCount() {
    return validAdmin === 0 ? 10 : 9;
  }

  function loadDataNotif() {
    jQuery('#pay_thead_row').find('th').eq(9).toggle(validAdmin === 0);

    jQuery.ajax({
      type: 'POST',
      url: APP_CONFIG.API_BASE_URL + '/finance/get-notif-pembayaran-admin',
      dataType: 'JSON',
      data: {
        karyawan_id: localStorage.getItem('user_id'),
        valid_admin: validAdmin,
        perusahaan_notif_value: 'empty',
        sales_notif_filter: 'empty',
      },
      beforeSend() {
        jQuery('#pay_table_body').html(`<tr><td colspan="${colCount()}" class="tbl-empty">Memuat data...</td></tr>`);
      },
      success(data) {
        if (Number(data.status) !== 1) {
          jQuery('#pay_table_body').html(`<tr><td colspan="${colCount()}" class="tbl-empty">Gagal memuat data. ${data.message || ''}</td></tr>`);
          jQuery('#pay_count').text('0');
          return;
        }

        const searchText = (jQuery('#pay_search').val() || '').trim().toLowerCase();
        const allRows = data.data || [];
        rowsData = searchText
          ? allRows.filter((v) => String(v.client_nama || '').toLowerCase().includes(searchText)
            || String(v.karyawan_nama || '').toLowerCase().includes(searchText))
          : allRows;
        renderTable();
      },
      error() {
        jQuery('#pay_table_body').html(`<tr><td colspan="${colCount()}" class="tbl-empty">Gagal menghubungi server.</td></tr>`);
        jQuery('#pay_count').text('0');
      },
    });
  }

  // Render halaman saat ini dari `rowsData` (SELURUH baris hasil filter
  // pencarian, sudah tersedia di memori -- tidak fetch ulang ke server tiap
  // ganti halaman). `idx` pada tombol Opsi/Client/Sales dihitung sbg indeks
  // ABSOLUT di `rowsData` (bukan indeks lokal per halaman), supaya lookup
  // `rowsData[idx]` di handler klik tetap benar di halaman mana pun.
  function renderTable() {
    const total = rowsData.length;
    jQuery('#pay_count').text(String(total));

    if (!total) {
      jQuery('#pay_table_body').html(`<tr><td colspan="${colCount()}" class="tbl-empty">Data Kosong.</td></tr>`);
      jQuery('#pay_pagination').html('');
      return;
    }

    const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageRows = rowsData.slice(start, start + ITEMS_PER_PAGE);

    // [BERUBAH 2026-09-07 atas permintaan user, "data yg sudah divalidasi
    // tidak bisa direset. jadi hilangkan fitur tersebut"] Kolom "Aksi"
    // SEKARANG cuma berisi tombol "Valid" di mode Unvalid -- tombol
    // "Unvalid"/reset (openPopupUnvalid/prosesUnvalidPembayaran, popup
    // #popup-payment-unvalid) DIHAPUS SELURUHNYA, bukan cuma disembunyikan
    // (backend tidak pernah benar2 bisa reset data yang sudah tervalidasi).
    // Kolom Aksi ikut DICOPOT SELURUHNYA di mode Riwayat/Valid (tidak ada
    // isinya lagi sama sekali) -- pola SAMA PERSIS pages/sj/list.js (showAksi).
    const showAksi = validAdmin === 0;

    const bodyHtml = pageRows.map((val, localIdx) => {
      const idx = start + localIdx;
      const lunas = parseFloat(val.penjualan_grandtotal - val.penjualan_jumlah_pembayaran) <= 0;
      const rowCls = lunas ? 'bg-primary/5' : '';
      const nUrut = String(val.foto_urutan || 'foto_1').replace('foto_', '');
      const bank = val['bank_' + nUrut] || '-';
      const ket = val['keterangan_' + nUrut] || '-';

      return `
        <tr class="${rowCls}">
          <td class="td-center">${idx + 1}</td>
          <td class="td-center">${formatDateTime(val.datetime || val.penjualan_tanggal)}</td>
          <td class="td-left">${spkLabel(val)}</td>
          <td class="td-left btn-pay-client" data-idx="${idx}" style="cursor:pointer;color:#056BBC;">${val.client_nama}</td>
          <td class="td-left btn-pay-sales" data-idx="${idx}" style="cursor:pointer;color:#056BBC;">${val.karyawan_nama}</td>
          <td class="td-left">${(val.urutan_payment || '').replace('Pembayaran', 'Bayar')}</td>
          <td class="td-right">${numberFormat(val.jumlah_payment)}</td>
          <td class="td-left">${ket}</td>
          <td class="td-center">${getBankLabel(val.bank_validasi || bank, bankById)}</td>
          ${showAksi ? `<td class="td-center"><button data-idx="${idx}" class="btn-tbl btn-tbl--muted btn-pay-validasi">Valid</button></td>` : ''}
        </tr>
      `;
    }).join('');

    jQuery('#pay_table_body').html(bodyHtml);
    jQuery('#pay_pagination').html(createPaginationButtons(currentPage, totalPages));
  }

  // Pola sama persis dgn inventory-apk/src/pages/partner/partner.js
  // (createPaginationButtons()) -- Prev/Next + indikator "halaman / total".
  function createPaginationButtons(current, total) {
    if (total <= 1) return '';
    return `
      <div class="flex items-center justify-between gap-2">
        <button class="pag-btn px-3 py-1.5 text-sm font-bold rounded border border-ink-faint ${current <= 1 ? 'opacity-30 pointer-events-none' : ''}" data-page="${current - 1}">‹ Prev</button>
        <span class="text-sm font-semibold text-ink-secondary">${current} / ${total}</span>
        <button class="pag-btn px-3 py-1.5 text-sm font-bold rounded border border-ink-faint ${current >= total ? 'opacity-30 pointer-events-none' : ''}" data-page="${current + 1}">Next ›</button>
      </div>
    `;
  }

  jQuery('#pay_pagination').on('click', '.pag-btn', function () {
    currentPage = parseInt(jQuery(this).data('page'), 10);
    renderTable();
  });

  // Porting label SPK (moment(tanggal).format('DDMMYY') + '-' + id tanpa
  // prefix INV_/leading zero) -- kolom ini SENGAJA tidak diklik (lihat
  // catatan scope di atas), cuma label.
  function spkLabel(val) {
    const tgl = val.penjualan_tanggal ? new Date(val.penjualan_tanggal) : null;
    const tglStr = tgl && !isNaN(tgl.getTime())
      ? String(tgl.getDate()).padStart(2, '0') + String(tgl.getMonth() + 1).padStart(2, '0') + String(tgl.getFullYear()).slice(-2)
      : '-';
    const idClean = String(val.penjualan_id || '').replace(/INV_/g, '').replace(/^0+/, '');
    return `${tglStr}-${idClean}`;
  }

  // ===========================================================
  // Popup Info Client / Sales (porting openPopupALamat/openPopupSales)
  // ===========================================================
  jQuery('#pay_table_body').on('click', '.btn-pay-client', function () {
    const val = rowsData[jQuery(this).data('idx')];
    if (!val) return;
    jQuery('#pay_alamat_nama').text(val.client_nama || '-');
    jQuery('#pay_alamat_cp').text(val.client_cp || '-');
    app.popup.open('#popup-payment-alamat');
  });

  jQuery('#pay_table_body').on('click', '.btn-pay-sales', function () {
    const val = rowsData[jQuery(this).data('idx')];
    if (!val) return;
    jQuery('#pay_sales_nama').text(val.karyawan_nama || '-');
    jQuery('#pay_sales_hp').text(val.karyawan_hp || '-');
    jQuery('#pay_sales_alamat').text(val.karyawan_alamat || '-');
    app.popup.open('#popup-payment-sales');
  });

  // ===========================================================
  // Popup Validasi Pembayaran (porting openPopupValidasi/
  // toggleUploadBuktiMutasi/previewBuktiPembayaran/prosesValidasiPembayaran)
  // ===========================================================
  jQuery('#pay_table_body').on('click', '.btn-pay-validasi', function () {
    const val = rowsData[jQuery(this).data('idx')];
    if (val) openPopupValidasi(val);
  });

  function openPopupValidasi(val) {
    const nUrut = String(val.foto_urutan || 'foto_1').replace('foto_', '');
    const isiFoto = val[val.foto_urutan];
    const fotoSrc = !isEmpty(isiFoto) ? IMAGE_BASE + '/foto_pembayaran/' + isiFoto : IMAGE_BASE + '/noimage.jpg';
    const preselectBank = val['bank_' + nUrut] || '';

    const bankOptionsHtml = BANK_OPTIONS.map((b) =>
      `<option value="${b.value}" ${b.value === preselectBank ? 'selected' : ''}>${b.label}</option>`,
    ).join('');

    jQuery('#pay_validasi_body').html(`
      <div class="card-surface overflow-hidden">
        <div class="bg-surface-raised text-center text-xs font-bold text-ink-secondary py-1.5">Bukti Pembayaran dari Sales</div>
        <div class="p-2 text-center">
          <img data-zoom-src="${fotoSrc}" src="${fotoSrc}" class="max-h-40 inline-block rounded cursor-zoom-in img-zoom-pay" />
        </div>
      </div>
      <div>
        <label class="mat-label">Rekening Pembayaran *</label>
        <select id="pay_bank_validasi" class="mat-input">
          <option value="">-- Pilih Rekening --</option>
          ${bankOptionsHtml}
        </select>
      </div>
      <div>
        <label class="mat-label">Nominal Pembayaran *</label>
        <input id="pay_nominal" type="text" inputmode="numeric" class="mat-input text-right font-bold"
          value="${numberFormat(val.jumlah_payment)}" />
      </div>
      <div id="pay_upload_section" class="hidden">
        <label class="mat-label">Upload Bukti Mutasi *</label>
        <div id="pay_upload_preview_wrap" class="hidden mb-2 text-center">
          <img id="pay_upload_preview" class="max-h-64 inline-block rounded border border-ink-faint cursor-zoom-in img-zoom-pay" />
        </div>
        <input type="file" id="pay_upload_input" accept="image/*" class="hidden" />
        <label for="pay_upload_input" class="btn-action btn-action--primary block text-center cursor-pointer">📷 Pilih Foto Bukti Mutasi</label>
        <p id="pay_upload_filename" class="text-xs text-ink-muted mt-1"></p>
        <p class="text-xs text-warning mt-2">⚠️ Wajib upload bukti mutasi untuk rekening Mandiri Kopra.</p>
      </div>
      <div id="pay_no_upload_info" class="hidden card-surface p-2.5 text-center text-xs text-success">
        ✅ Upload bukti mutasi tidak diperlukan untuk rekening ini.
      </div>
      <button id="pay_btn_submit_validasi" class="btn-action btn-action--success w-full mt-1">Validasi Pembayaran</button>
    `);

    if (preselectBank) toggleUploadSection(preselectBank);
    app.popup.open('#popup-payment-validasi');

    jQuery('#pay_validasi_body').data('current-val', val);
  }

  function toggleUploadSection(bankValue) {
    if (bankValue === 'Mandiri Kopra') {
      jQuery('#pay_upload_section').removeClass('hidden');
      jQuery('#pay_no_upload_info').addClass('hidden');
    } else if (!bankValue) {
      jQuery('#pay_upload_section').addClass('hidden');
      jQuery('#pay_no_upload_info').addClass('hidden');
    } else {
      jQuery('#pay_upload_section').addClass('hidden');
      jQuery('#pay_no_upload_info').removeClass('hidden');
      jQuery('#pay_upload_input').val('');
      jQuery('#pay_upload_preview_wrap').addClass('hidden');
      jQuery('#pay_upload_filename').text('');
    }
  }

  jQuery('#pay_validasi_body').on('change', '#pay_bank_validasi', function () {
    toggleUploadSection(jQuery(this).val());
  });

  jQuery('#pay_validasi_body').on('input', '#pay_nominal', function () {
    const digits = jQuery(this).val().replace(/[^0-9]/g, '');
    jQuery(this).val(digits ? numberFormat(digits) : '');
  });

  jQuery('#pay_validasi_body').on('change', '#pay_upload_input', function () {
    const file = this.files && this.files[0];
    if (!file) return;
    jQuery('#pay_upload_filename').text('File: ' + file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      jQuery('#pay_upload_preview').attr('src', e.target.result);
      jQuery('#pay_upload_preview_wrap').removeClass('hidden');
    };
    reader.readAsDataURL(file);
  });

  jQuery('#pay_validasi_body').on('click', '.img-zoom-pay', function () {
    app.photoBrowser.create({ photos: [jQuery(this).data('zoom-src') || jQuery(this).attr('src')] }).open();
  });

  jQuery('#pay_validasi_body').on('click', '#pay_btn_submit_validasi', () => prosesValidasiPembayaran());

  // Porting prosesValidasiPembayaran().
  function prosesValidasiPembayaran() {
    const val = jQuery('#pay_validasi_body').data('current-val');
    const bankValue = jQuery('#pay_bank_validasi').val();
    if (!bankValue) {
      app.dialog.alert('Harap pilih rekening pembayaran!', 'Peringatan');
      return;
    }

    const nominalClean = jQuery('#pay_nominal').val().replace(/[^0-9]/g, '');
    if (!nominalClean) {
      app.dialog.alert('Harap isi nominal pembayaran!', 'Peringatan');
      return;
    }
    if (nominalClean === '0' && String(val.jumlah_payment) !== '0') {
      app.dialog.alert('Nominal pembayaran tidak boleh 0!', 'Peringatan');
      return;
    }

    const fileInput = document.getElementById('pay_upload_input');
    const hasFile = fileInput.files && fileInput.files[0];
    if (bankValue === 'Mandiri Kopra' && !hasFile) {
      app.dialog.alert('Harap upload bukti mutasi untuk rekening Mandiri Kopra!', 'Peringatan');
      return;
    }

    let confirmText = `Apakah Anda yakin ingin memvalidasi pembayaran ini?<br><br>`
      + `<strong>Rekening:</strong> ${bankValue}<br>`
      + `<strong>Nominal:</strong> Rp ${numberFormat(nominalClean)}<br>`
      + `<strong>Bukti Mutasi:</strong> ${bankValue === 'Mandiri Kopra' ? 'Sudah diupload' : 'Tidak diperlukan'}`;

    app.dialog.confirm(confirmText, 'Konfirmasi Validasi', () => {
      const formData = new FormData();
      formData.append('penjualan_id', val.penjualan_id);
      formData.append('id_log_pembayaran', val.id_log_pembayaran);
      formData.append('valid_value', 1);
      formData.append('user_record', localStorage.getItem('karyawan_nama'));
      formData.append('bank_validasi', bankValue);
      formData.append('jumlah_bukti_payment', nominalClean);
      if (bankValue === 'Mandiri Kopra' && hasFile) {
        formData.append('bukti_pembayaran', fileInput.files[0]);
      }

      jQuery.ajax({
        type: 'POST',
        url: val.asal_server + '/api/valid-bukti-pembayaran-admin',
        data: formData,
        processData: false,
        contentType: false,
        headers: { Accept: 'application/json' },
        beforeSend() {
          app.dialog.preloader('Proses Validasi Pembayaran...');
        },
        success(data) {
          app.dialog.close();
          if (Number(data.status) === 1) {
            app.popup.close('#popup-payment-validasi');
            app.dialog.alert('Berhasil memvalidasi pembayaran!', 'Sukses');
            loadDataNotif();
          } else {
            app.dialog.alert(data.message || 'Gagal validasi pembayaran', 'Error');
          }
        },
        error(xhr) {
          app.dialog.close();
          const msg = (xhr.responseJSON && (xhr.responseJSON.message || Object.values(xhr.responseJSON.errors || {})[0]))
            || 'Terjadi kesalahan saat memproses validasi.';
          app.dialog.alert(String(msg), 'Error');
        },
      });
    });
  }

  // [DIHAPUS 2026-09-07 atas permintaan user, "data yg sudah divalidasi
  // tidak bisa direset. jadi hilangkan fitur tersebut"] Popup Unvalid/Reset
  // (openPopupUnvalid/prosesUnvalidPembayaran, endpoint
  // unvalid-bukti-pembayaran, popup #popup-payment-unvalid di payment.html)
  // -- backend tidak pernah benar2 bisa reset data yang sudah tervalidasi,
  // jadi fiturnya dicabut seluruhnya (bukan cuma disembunyikan). Baris Valid
  // di mode Riwayat sekarang TANPA aksi apa pun (lihat showAksi di
  // renderTable()), sama pola dgn baris tervalidasi di pages/sj/list.js.

  loadBankList();
  loadDataNotif();

  return function unmount() {
    if (searchTimeout) clearTimeout(searchTimeout);
  };
}
