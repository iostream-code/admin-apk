// Finance -- Uang Saku Sales. Porting dari admin-finance-apk/www/js/data.js
// (initFinanceVisitTab/loadVisitFinanceList/renderVisitFinanceList/
// showVisitFinanceDetail/renderVisitFinanceDetailPopup/loadUangSakuData/
// handleFotoUploadVisit/validateAllVisitsFinance), yaitu tab "Sales" DI
// DALAM `data_transaksi.html` legacy (satu halaman dgn tab "Payable" yang
// sudah lebih dulu diporting ke pages/finance/payable.{js,html}) -- di sini
// jadi PageModule/route SENDIRI (`/finance/sales`, sub-tab ke-3 grup
// Finance: Payment/Payable/Sales), bukan tab di dalam 1 halaman, konsisten
// dgn pola routing app ini (beda dari legacy yg semua tab jadi 1 halaman).
//
// [UPDATE 2026-09-09 atas permintaan user, "sesuaikan lagi fitur yg ada pada
// detail kunjungan admin-apk sama seperti yg ada di admin-finance-apk"]
// Daftar kunjungan per-kota (nama perusahaan, jam, badge jenis kunjungan) --
// porting dari renderVisitFinanceDetailPopup() (data.js:2935-2988) -- SEBELUM
// ini popup cuma menghitung `totalKota`/`totalKunjungan` dari `visits` tanpa
// pernah me-render isi per-kunjungannya sama sekali (gap, bukan scope
// deferral yang disengaja). Lihat renderVisitList() di bawah. Warna badge
// jenis_kunjungan disamakan makna (bukan hex sama persis) ke token warna app
// ini: lamongan/support -> warning (oranye), gresik/follow-up -> info (biru),
// prospek -> purple-600 (tidak ada token khusus di app ini), service ->
// success (hijau), default -> ink-secondary (abu).
//
// [UPDATE 2026-09-09, "apakah pada detail kunjungan sales juga sudah dapat
// melakukan pemilihan kendaraan seperti yg ada di admin-finance-apk?"]
// "Assign Kendaraan" -- SEBELUMNYA sengaja dilewati (dianggap fitur
// ORTOGONAL thd uang saku, user cuma minta "uang saku sales") -- SEKARANG
// diporting juga atas permintaan user. Porting persis
// financeLoadVehiclePicker()/financeAssignVehicle() (data.js:3078-3140) --
// lihat loadVehiclePicker()/assignVehicle() di bawah. Tabel MILIK modul CRM
// (m_vehicle/m_vehicle_assignment_production/t_rencana_kunjungan, dipakai
// bareng dash-operasional/atlas-propoint), endpoint
// GET /vehicles-for-assign?tanggal=, POST /rencana-kunjungan/assign-vehicle
// (App\Http\Controllers\API\CrmController::getVehiclesForAssign/
// assignVehicle, backend-production, DICEK langsung ke source -- kontrak
// {tanggal,sales_id,vehicle_id} & response {id,plate_number,name,taken_by,
// taken_by_user_id} SAMA PERSIS). Merah (terkunci, disabled) = dipakai sales
// LAIN pada tanggal yang sama, hijau = tersedia/sudah punya sales ini --
// warna dipertahankan (bukan ditoken-kan) krn cuma style inline per <option>,
// sama seperti sumbernya (styling per-option tidak konsisten dirender semua
// browser/WebView, TAPI prefix emoji 🔴/🟢 tetap kelihatan di mana pun).
//
// [DEAD CODE di sumber asli, TIDAK diporting]
//   - Warning "sisa uang saku sebelumnya" (loadUangSakuData(), field
//     `sisa_uang_saku_sebelumnya`) -- DICEK ke
//     FinanceOperasionalController::getVisitDetailForFinance() (backend-production):
//     field itu TIDAK PERNAH dikirim balik sama sekali (nol referensi di
//     response), jadi di app asli pun `sisaSebelumnya` selalu `undefined||0`
//     -- banner & disable tombolnya TIDAK PERNAH benar2 aktif di produksi.
//   - Gate `localStorage.getItem('kasKecilKurang')` sebelum nampilin tombol
//     Klaim -- DICEK: key itu TIDAK PERNAH di-set di mana pun di seluruh
//     `www/` (grep nihil), jadi selalu `null`/`!== 'true'`, gate-nya selalu
//     lolos. Bukan fitur nyata, tidak diporting.
//
// [DISEDERHANAKAN] Tombol "Ambil Foto" (kamera Cordova, `navigator.camera`)
// TIDAK diporting -- upload foto di sini HANYA lewat `<input type="file">`
// (pola SAMA PERSIS dgn pages/finance/payable.js "Upload Bukti Transfer"),
// yang sudah cukup (file picker Android tetap bisa buka kamera device) &
// bisa diuji penuh di browser. Sama alasan dgn kamera yang sengaja belum
// diporting di halaman lain app ini (lihat README "Sengaja dibuang").
//
// Endpoint: POST /finance-visit-list {bulan,tahun,filter_sales},
// POST /finance-visit-detail {tanggal,sales_id}, POST /finance-visit-validate
// (multipart: visit_ids(json array string),tanggal,sales_id,user_id,
// nominal_uang_saku,foto_bukti(file, opsional)) -- SEMUA dicek langsung ke
// App\Http\Controllers\API\Accounting\FinanceOperasionalController
// (backend-production), kontraknya SAMA dgn yg dipakai admin-finance-apk asli.

import tpl from './sales.html?raw';
import { APP_CONFIG } from '../../lib/config.js';
import { numberFormat, formatDateShort } from '../../lib/format.js';
import { showAuthedShell } from '../../lib/shell.js';
import * as OperasionalSales from './operasionalSales.js';

// [CUTOVER 2026-09-07] Halaman ini TETAP panggil BACKEND_PRODUCTION_URL
// (BUKAN API_BASE_URL/backend-migrasi) -- FinanceOperasionalController
// (finance-visit-list/detail/validate) belum ada portingnya di
// backend-migrasi sama sekali, lihat catatan panjang di lib/config.js.
const IMAGE_BASE = APP_CONFIG.IMAGE_BASE_URL;
const IMG_BUKTI_ACCOUNTING = IMAGE_BASE + '/bukti_accounting/';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_SINGKAT = BULAN.map((b) => b.slice(0, 3));

function isEmpty(v) {
  return v == null || v === 'null' || v === '';
}

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Porting dari renderVisitFinanceDetailPopup() (admin-finance-apk/www/js/
// data.js:2957-2965) -- makna warna disamakan ke token app ini, lihat
// docblock atas file.
const JENIS_KUNJUNGAN_CLASS = {
  lamongan: 'text-warning',
  gresik: 'text-info',
  prospek: 'text-purple-600',
  service: 'text-success',
  'follow-up': 'text-info',
  support: 'text-warning',
};

// Group per kota lalu render tiap kunjungan (nama perusahaan, jam, badge
// jenis) -- porting persis data.js:2935-2988.
function renderVisitList(visits, isValidated) {
  const $wrap = jQuery('#fsd_visit_list').empty();
  if (!visits.length) return;

  const borderClass = isValidated ? 'border-success' : 'border-warning';
  const groupedByKota = {};
  visits.forEach((v) => {
    const kota = v.kota || 'Tidak Ada Kota';
    (groupedByKota[kota] = groupedByKota[kota] || []).push(v);
  });

  Object.keys(groupedByKota).forEach((kota) => {
    const rows = groupedByKota[kota].map((v) => {
      const jenisClass = JENIS_KUNJUNGAN_CLASS[v.jenis_kunjungan] || 'text-ink-secondary';
      const jenisLabel = v.jenis_kunjungan ? v.jenis_kunjungan.charAt(0).toUpperCase() + v.jenis_kunjungan.slice(1) : '-';
      const hourStart = v.hour_start ? v.hour_start.substring(0, 5) : '--:--';
      const hourEnd = v.hour_end ? v.hour_end.substring(0, 5) : '--:--';
      return `
        <div class="card-surface p-2.5">
          <p class="text-sm font-semibold text-primary truncate">${escapeHtml(v.nama_perusahaan) || 'Tidak ada nama'}</p>
          <div class="mt-1.5 flex items-center justify-between">
            <span class="text-xs text-ink-secondary">${hourStart} - ${hourEnd}</span>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-surface-raised ${jenisClass}">${jenisLabel}</span>
          </div>
        </div>
      `;
    }).join('');

    $wrap.append(`
      <div class="pl-3 border-l-2 ${borderClass}">
        <p class="text-sm font-semibold text-ink-primary mb-1.5">${escapeHtml(kota)}</p>
        <div class="space-y-1.5">${rows}</div>
      </div>
    `);
  });
}

export function mount(container) {
  container.innerHTML = tpl;
  showAuthedShell('/finance/sales');

  const unmountOperasionalSales = OperasionalSales.mount(container);

  let searchTimeout = null;
  let cachedRows = []; // hasil fetch terakhir (SEBELUM filter nama lokal, lihat filterBySales())
  let currentUploadFile = null; // File terpilih di popup Detail yg lagi terbuka (direset tiap openDetail())

  const $search = jQuery('#fs_search');
  const $bulan = jQuery('#fs_bulan');
  const $tahun = jQuery('#fs_tahun');

  // ===== Isi dropdown Bulan/Tahun (porting populateFilterFinance()) =====
  const nowMonth = new Date().getMonth();
  BULAN.forEach((nama, i) => {
    $bulan.append(jQuery('<option>').val(String(i + 1).padStart(2, '0')).text(nama).prop('selected', i === nowMonth));
  });
  const nowYear = new Date().getFullYear();
  for (let y = nowYear; y >= nowYear - 3; y--) {
    $tahun.append(jQuery('<option>').val(y).text(y).prop('selected', y === nowYear));
  }

  $bulan.on('change', loadList);
  $tahun.on('change', loadList);
  jQuery('#fs_refresh').on('click', loadList);
  $search.on('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => renderList(filterCached()), 300);
  });

  // Porting filter gabungan finance (username LIKE ATAU user_location LIKE)
  // -- di sini DIKIRIM ke backend (param filter_sales, sesuai kontrak
  // getVisitListForFinance()), TIDAK perlu filter tambahan di klien spt
  // pola Payment (yg backend-nya AND-kan 2 kolom terpisah) -- endpoint ini
  // sudah OR satu param saja. filterCached() cuma dipakai utk re-render
  // instan dari cache saat user ngetik (debounce), fetch ulang TETAP jalan
  // via loadList() saat filter bulan/tahun berubah.
  function filterCached() {
    const q = ($search.val() || '').trim().toLowerCase();
    if (!q) return cachedRows;
    return cachedRows.filter((r) => (r.sales_name || '').toLowerCase().includes(q));
  }

  function loadList() {
    jQuery.ajax({
      type: 'POST',
      url: APP_CONFIG.BACKEND_PRODUCTION_URL + '/finance-visit-list',
      dataType: 'JSON',
      data: {
        bulan: $bulan.val(),
        tahun: $tahun.val(),
        filter_sales: ($search.val() || '').trim(),
      },
      beforeSend() {
        jQuery('#fs_table_body').html('<tr><td colspan="6" class="tbl-empty">Memuat data...</td></tr>');
      },
      success(data) {
        if (data.status !== 'success') {
          jQuery('#fs_table_body').html(`<tr><td colspan="6" class="tbl-empty">${data.message || 'Gagal memuat data.'}</td></tr>`);
          jQuery('#fs_count').text('0');
          return;
        }
        cachedRows = data.data || [];
        renderList(cachedRows);
      },
      error() {
        jQuery('#fs_table_body').html('<tr><td colspan="6" class="tbl-empty">Gagal menghubungi server.</td></tr>');
        jQuery('#fs_count').text('0');
      },
    });
  }

  function renderList(rows) {
    jQuery('#fs_count').text(String(rows.length));

    if (!rows.length) {
      jQuery('#fs_table_body').html('<tr><td colspan="6" class="tbl-empty">Tidak ada data kunjungan.</td></tr>');
      return;
    }

    jQuery('#fs_table_body').html(rows.map((item, i) => {
      const isValid = Number(item.is_validasi_finance) === 1;
      const badge = isValid
        ? '<span class="text-xs font-semibold px-2 py-0.5 rounded bg-success text-white">Valid</span>'
        : '<span class="text-xs font-semibold px-2 py-0.5 rounded bg-warning text-white">Pending</span>';
      return `
        <tr>
          <td class="td-center">${i + 1}</td>
          <td class="td-center">${formatDateShort(item.tanggal_kunjungan)}</td>
          <td class="td-left">${item.sales_name || '-'}</td>
          <td class="td-center font-bold">${item.total_kunjungan}</td>
          <td class="td-center">${badge}</td>
          <td class="td-center">
            <button data-tanggal="${item.tanggal_kunjungan}" data-user-id="${item.user_id}"
              data-nama="${(item.sales_name || '').replace(/"/g, '&quot;')}"
              class="btn-tbl btn-tbl--muted btn-fs-detail">Detail</button>
          </td>
        </tr>
      `;
    }).join(''));
  }

  jQuery('#fs_table_body').on('click', '.btn-fs-detail', function () {
    const $el = jQuery(this);
    openDetail($el.data('tanggal'), $el.data('user-id'), String($el.data('nama')));
  });

  // ===========================================================
  // Popup Detail Kunjungan + Klaim Uang Saku
  // ===========================================================
  let currentTanggal = null;
  let currentSalesId = null;
  let currentSalesNama = null;
  let currentVisitIds = [];
  let currentIsValidated = false;

  function openDetail(tanggal, salesId, salesNama) {
    currentTanggal = tanggal;
    currentSalesId = salesId;
    currentSalesNama = salesNama;
    currentUploadFile = null;

    jQuery('#fsd_nominal_wrap').html('<i>Memuat...</i>');
    jQuery('#fsd_breakdown').html('');
    jQuery('#fsd_visit_list').empty();
    jQuery('#fsd_foto_section').html('');
    jQuery('#fsd_btn_validate').addClass('hidden');
    app.popup.open('#popup-fs-detail');

    // Independen dari fetch detail kunjungan di bawah (sama pola dgn
    // sumbernya, dipanggil begitu popup dibuka, tidak menunggu detail).
    loadVehiclePicker(tanggal, salesId);

    jQuery.ajax({
      type: 'POST',
      url: APP_CONFIG.BACKEND_PRODUCTION_URL + '/finance-visit-detail',
      dataType: 'JSON',
      data: { tanggal, sales_id: salesId },
      beforeSend() {
        app.dialog.preloader('Memuat detail...');
      },
      success(data) {
        app.dialog.close();
        if (data.status !== 'success') {
          app.dialog.alert(data.message || 'Gagal memuat detail.', 'Error');
          app.popup.close('#popup-fs-detail');
          return;
        }
        renderDetail(data);
      },
      error() {
        app.dialog.close();
        app.dialog.alert('Gagal menghubungi server.', 'Error');
        app.popup.close('#popup-fs-detail');
      },
    });
  }

  // Porting financeLoadVehiclePicker()/financeAssignVehicle()
  // (admin-finance-apk/www/js/data.js:3078-3140) -- lihat docblock atas
  // file. `salesId` di sini = user_id sales yang lagi dibuka detailnya,
  // dipakai server bandingkan dgn `taken_by_user_id` (isMine).
  function loadVehiclePicker(tanggal, salesId) {
    const $sel = jQuery('#fsd_vehicle_select');
    $sel.prop('disabled', true).html('<option value="">Memuat daftar kendaraan...</option>');

    jQuery.ajax({
      type: 'GET',
      url: `${APP_CONFIG.BACKEND_PRODUCTION_URL}/vehicles-for-assign?tanggal=${encodeURIComponent(tanggal)}`,
      dataType: 'JSON',
      success(res) {
        if (res.status !== 'success' || !res.data) {
          $sel.html('<option value="">Gagal memuat kendaraan</option>');
          return;
        }

        let optionsHtml = '<option value="">— Belum ada kendaraan —</option>';
        res.data.forEach((v) => {
          const isMine = String(v.taken_by_user_id) === String(salesId);
          const takenByOther = !isMine && v.taken_by;
          const label = escapeHtml(v.plate_number) + (v.name ? ' &middot; ' + escapeHtml(v.name) : '');

          if (takenByOther) {
            optionsHtml += `<option value="${v.id}" disabled style="color:#dc2626;">\u{1F534} ${label} — dipakai ${escapeHtml(v.taken_by)}</option>`;
          } else {
            optionsHtml += `<option value="${v.id}" ${isMine ? 'selected' : ''} style="color:#16a34a;">\u{1F7E2} ${label}</option>`;
          }
        });

        $sel.html(optionsHtml).prop('disabled', false);
      },
      error() {
        $sel.html('<option value="">Gagal memuat kendaraan</option>');
      },
    });
  }

  jQuery('#fsd_vehicle_select').on('change', function () {
    assignVehicle(jQuery(this).val(), currentTanggal, currentSalesId);
  });

  function assignVehicle(vehicleId, tanggal, salesId) {
    const $sel = jQuery('#fsd_vehicle_select').prop('disabled', true);

    jQuery.ajax({
      type: 'POST',
      url: `${APP_CONFIG.BACKEND_PRODUCTION_URL}/rencana-kunjungan/assign-vehicle`,
      dataType: 'JSON',
      data: { tanggal, sales_id: salesId, vehicle_id: vehicleId || '' },
      success(res) {
        app.dialog.alert(res.message || (res.status === 'success' ? 'Kendaraan berhasil di-assign.' : 'Gagal assign kendaraan.'));
        loadVehiclePicker(tanggal, salesId);
      },
      error() {
        app.dialog.alert('Gagal assign kendaraan. Silakan coba lagi.');
        $sel.prop('disabled', false);
      },
    });
  }

  function renderDetail(data) {
    const visits = data.data || [];
    currentVisitIds = visits.map((v) => v.id_visit);
    // [FIX 2026-09-09, "status di tabel kunjungan selalu Pending walau sudah
    // diklaim"] SEBELUMNYA cuma cek `visits[0].is_validasi_finance` -- kalau
    // hari itu kemasukan kunjungan baru (CRM baru validasi belakangan) yang
    // urutannya (ORDER BY hour_start) jatuh SEBELUM kunjungan yang sudah
    // lebih dulu diklaim, `visits[0]` bisa jadi yang BELUM tervalidasi
    // (is_validasi_finance=0) padahal kunjungan lain di hari yang sama SUDAH
    // -- popup pun ikut nampilin "Pending" terus meski sebagian/pernah
    // diklaim. Sekarang cocokkan definisi "sudah tervalidasi" dgn yang
    // dipakai backend utk baris tabel (FinanceOperasionalController::
    // getVisitListForFinance() -- baris dianggap valid HANYA kalau SEMUA
    // kunjungan hari itu sudah tervalidasi finance).
    currentIsValidated = visits.length > 0 && visits.every((v) => Number(v.is_validasi_finance) === 1);

    const kotaSet = new Set(visits.map((v) => v.kota).filter(Boolean));
    const totalKota = kotaSet.size;
    const totalKunjungan = visits.length;
    const totalUangSaku = Number(data.total_uang_saku || 0);
    const breakdown = data.uang_saku_breakdown || [];
    const fotoBukti = data.foto_bukti || null;

    const dateObj = new Date(currentTanggal);
    jQuery('#fsd_day').text(String(dateObj.getDate()).padStart(2, '0'));
    jQuery('#fsd_month').text(BULAN_SINGKAT[dateObj.getMonth()]);
    jQuery('#fsd_tanggal').text(formatDateShort(currentTanggal) + ', ' + currentSalesNama);
    jQuery('#fsd_meta').text(`${totalKota} Kota • ${totalKunjungan} Kunjungan`);

    const $daybox = jQuery('#fsd_daybox');
    const $status = jQuery('#fsd_status');
    $daybox.toggleClass('bg-success', currentIsValidated).toggleClass('bg-warning', !currentIsValidated);
    $status.toggleClass('bg-success', currentIsValidated).toggleClass('bg-warning', !currentIsValidated)
      .text(currentIsValidated ? 'Valid' : 'Pending');

    // Nominal -- porting persis loadUangSakuData(): SUDAH divalidasi -> teks
    // baca-saja (nominal final, tidak bisa diubah lagi). BELUM -> input teks
    // (delimiter ribuan manual, pola sama dgn pages/finance/payable.js
    // #pb_nominal), nilai awal dari estimasi m_kota.nominal_saku (breakdown),
    // TAPI finance boleh sesuaikan sebelum klaim.
    if (currentIsValidated) {
      jQuery('#fsd_nominal_wrap').html('Rp ' + numberFormat(totalUangSaku));
    } else {
      jQuery('#fsd_nominal_wrap').html(`
        <div class="flex items-center gap-1.5">
          <span class="text-sm">Rp</span>
          <input id="fsd_nominal_input" type="text" inputmode="numeric"
            value="${numberFormat(totalUangSaku)}"
            class="flex-1 min-w-0 rounded px-2 py-1 text-base font-bold text-success border-0" />
        </div>
      `);
      jQuery('#fsd_nominal_input').on('input', function () {
        const digits = jQuery(this).val().replace(/[^0-9]/g, '');
        jQuery(this).val(digits ? numberFormat(digits) : '');
      });
    }

    if (breakdown.length) {
      const label = currentIsValidated ? 'Detail per Kota:' : 'Estimasi per Kota (saran, boleh disesuaikan di atas):';
      jQuery('#fsd_breakdown').html(
        `<div class="font-semibold mb-1">${label}</div>` +
        breakdown.map((b) => `
          <div class="flex justify-between py-0.5">
            <span>${b.nama_kota}</span>
            <span>Rp ${numberFormat(b.nominal_saku)}</span>
          </div>
        `).join('')
      );
    } else {
      jQuery('#fsd_breakdown').html('<div class="italic opacity-80">Tidak ada data nominal kota</div>');
    }

    renderVisitList(visits, currentIsValidated);
    renderFotoSection(totalUangSaku, fotoBukti);

    // Tombol Klaim -- porting persis: HANYA muncul kalau belum tervalidasi
    // (tidak ada state "sudah tervalidasi" utk tombol ini di sumber asli,
    // lihat docblock atas file).
    jQuery('#fsd_btn_validate').toggleClass('hidden', currentIsValidated);
  }

  function renderFotoSection(totalUangSaku, fotoBukti) {
    const $section = jQuery('#fsd_foto_section');

    if (totalUangSaku <= 0) {
      $section.html('').addClass('hidden');
      return;
    }
    $section.removeClass('hidden');

    if (currentIsValidated) {
      $section.html(fotoBukti
        ? `
          <label class="mat-label">Bukti Transfer</label>
          <div class="text-center">
            <img id="fsd_foto_zoom" src="${IMG_BUKTI_ACCOUNTING}${fotoBukti}"
              class="max-h-52 inline-block rounded border border-ink-faint cursor-zoom-in" />
          </div>
        `
        : '<p class="text-xs text-ink-secondary">Tidak ada bukti foto.</p>');
      jQuery('#fsd_foto_zoom').on('click', function () {
        app.photoBrowser.create({ photos: [jQuery(this).attr('src')] }).open();
      });
      return;
    }

    // BELUM divalidasi -- form upload, pola SAMA PERSIS dgn
    // pages/finance/payable.js "Upload Bukti Transfer" (#pb_file dst).
    $section.html(`
      <label class="mat-label">Bukti Transfer (opsional)</label>
      <div id="fsd_preview_wrap" class="hidden mb-2 text-center">
        <img id="fsd_preview" class="max-h-52 inline-block rounded border border-ink-faint cursor-zoom-in" />
      </div>
      <input type="file" id="fsd_file" accept="image/*" class="hidden" />
      <label for="fsd_file" class="btn-action btn-action--primary block text-center cursor-pointer">📷 Pilih Foto Bukti</label>
      <p id="fsd_filename" class="text-xs text-ink-muted mt-1"></p>
    `);

    jQuery('#fsd_file').on('change', function () {
      const file = this.files && this.files[0];
      if (!file) return;
      currentUploadFile = file;
      jQuery('#fsd_filename').text('File: ' + file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        jQuery('#fsd_preview').attr('src', e.target.result);
        jQuery('#fsd_preview_wrap').removeClass('hidden');
      };
      reader.readAsDataURL(file);
    });
  }

  jQuery('#fsd_btn_validate').on('click', submitValidasi);

  function submitValidasi() {
    const $input = jQuery('#fsd_nominal_input');
    if (!$input.length) {
      app.dialog.alert('Input nominal tidak ditemukan. Silakan tutup & buka ulang popup ini.', 'Error');
      return;
    }
    const nominal = parseInt($input.val().replace(/[^0-9]/g, ''), 10) || 0;

    let confirmMessage = `Klaim uang saku Rp ${numberFormat(nominal)} untuk ${currentVisitIds.length} kunjungan dari ${currentSalesNama} pada tanggal ${formatDateShort(currentTanggal)}?`;
    if (!currentUploadFile) {
      confirmMessage += ' Anda belum upload bukti transfer, lanjutkan tanpa bukti?';
    }

    app.dialog.confirm(confirmMessage, 'Konfirmasi Uang Saku', () => {
      const formData = new FormData();
      formData.append('visit_ids', JSON.stringify(currentVisitIds));
      formData.append('tanggal', currentTanggal);
      formData.append('sales_id', currentSalesId);
      formData.append('user_id', localStorage.getItem('user_id'));
      formData.append('nominal_uang_saku', nominal);
      if (currentUploadFile) formData.append('foto_bukti', currentUploadFile);

      jQuery.ajax({
        type: 'POST',
        url: APP_CONFIG.BACKEND_PRODUCTION_URL + '/finance-visit-validate',
        dataType: 'JSON',
        data: formData,
        processData: false,
        contentType: false,
        beforeSend() {
          app.dialog.preloader('Memproses validasi...');
        },
        success(data) {
          app.dialog.close();
          if (data.status === 'success') {
            app.popup.close('#popup-fs-detail');
            app.dialog.alert(data.message || 'Validasi berhasil.', 'Sukses', () => loadList());
          } else {
            app.dialog.alert(data.message || 'Gagal validasi.', 'Error');
          }
        },
        error(xhr) {
          app.dialog.close();
          const msg = (xhr.responseJSON && xhr.responseJSON.message) || 'Gagal menghubungi server.';
          app.dialog.alert(String(msg), 'Error');
        },
      });
    });
  }

  loadList();

  return function unmount() {
    if (unmountOperasionalSales) unmountOperasionalSales();
  };
}
