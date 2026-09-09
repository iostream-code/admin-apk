// Menu SJ (Surat Jalan) -- [BARU 2026-09-07 atas permintaan user, "tambahkan
// menu baru yaitu SJ yang diambil dari menu SJ yg ada di ekspedisi-apk"].
// Porting dari ekspedisi-apk/src/js/pages/adminSuratJalan.js (varian
// Customer, BUKAN varian PO -- lihat komentar di sana soal ekspedisi-apk
// juga punya tab "SPK"/sj-po/sj-retur-po terpisah, TIDAK diminta user di
// sini, jadi tidak ikut diporting).
//
// **Auth**: endpoint modul Ekspedisi (`/ekspedisi/admin/sj*`) TIDAK bisa
// dipanggil pakai token sesi login utama app ini (klaim `role` beda makna
// total) -- dipanggil via ekspedisiAjax() (lib/ekspedisiAuth.js) yang pasang
// `ekspedisi_token` terpisah, didapat dari response login utama kalau akun
// ini terdaftar di `ekspedisi_m_admin_access`. Kalau token itu tidak ada
// (akun bukan admin Ekspedisi) atau server balikin 401/403 (mis. token
// kedaluwarsa), halaman ini nampilkan popup "Tidak Ada Akses" & TIDAK
// mencoba fetch data sama sekali -- BUKAN redirect/logout paksa dari sesi
// login utama (401 di sini beda arti dari 401 lib/auth.js, lihat docblock
// ekspedisiAjax()).
//
// **Fase 1 (2026-09-07)**: list + search + filter tahun + toggle Riwayat +
// paginasi + modal Detail (dobel klik baris) + aksi Validasi/Serah Terima.
// **[UPDATE 2026-09-09 atas permintaan user, "pastikan admin juga bisa
// menambahkan SJ baik customer, PO, maupun retur seperti yg ada di
// ekspedisi-apk"]** Tombol "+ Buat SJ" ditambahkan (navigasi ke /sj/new,
// porting adminNewSuratJalan.js -- lihat pages/sj/new.js) & tab SJ jadi
// bertab (Customer/PO/Retur, lihat lib/shell.js) -- listing/create PO & Retur
// ada di pages/sj/listPo.js+newPo.js dan listRetur.js+newRetur.js.
//
// **Foto Validasi/Serah Terima**: sumber (`camera.js::takePhoto()`) py 2
// jalur (native `navigator.camera` Cordova ATAU fallback `<input type=file>`
// browser) -- app ini (admin-apk) TIDAK PERNAH pasang plugin kamera Cordova
// sama sekali (lihat precedent pages/finance/payable.js & sales.js, "Ambil
// Foto" native SENGAJA tidak diporting ke sana juga) -- jadi di sini
// LANGSUNG cuma jalur `<input type=file>` (pickPhotoFile() di bawah), tanpa
// deteksi/cabang native. File picker Android tetap bisa buka kamera device,
// cukup utk kebutuhan ini (sama alasan dgn sales.js).
//
// Endpoint (App\Ekspedisi\Controllers\SuratJalanController, backend-migrasi,
// prefix '/ekspedisi' SUDAH termasuk dalam APP_CONFIG.EKSPEDISI_API_BASE_URL):
// GET /admin/sj/years, GET /admin/sj (query: belum_tervalidasi=1 ATAU
// status=tervalidasi, q, tahun, page, per_page) -> {data,total}, POST
// /admin/sj/{id}/validasi (multipart, field 'photo'), POST
// /admin/sj/{id}/serah-terima (multipart, field 'photo').

import tpl from './list.html?raw';
import { APP_CONFIG } from '../../lib/config.js';
import { showAuthedShell } from '../../lib/shell.js';
import { hasEkspedisiAccess, ekspedisiAjax } from '../../lib/ekspedisiAuth.js';
import { Router } from '../../lib/router.js';

const EKSPEDISI_BASE = APP_CONFIG.EKSPEDISI_API_BASE_URL;

const STATUS_LABEL = { draft: 'Draft', terkirim: 'Terkirim', tervalidasi: 'Tervalidasi' };
const STATUS_BADGE_CLASS = {
  draft: 'bg-warning text-white',
  terkirim: 'bg-primary text-white',
  tervalidasi: 'bg-success text-white',
};

// Baris migrasi legacy (`asal='migrasi_legacy'`) simpan path foto sbg URL
// ABSOLUT ke host lama -- baris native path-nya RELATIF ke base modul ini
// sendiri. Sama persis fotoUrl() ekspedisi-apk.
function fotoUrl(path) {
  return /^https?:\/\//.test(path) ? path : `${EKSPEDISI_BASE}/${path}`;
}

function formatTanggal(value) {
  return value ? new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
}

function buildSpkLabel(sj) {
  const ids = [...new Set((sj.items || []).map((it) => it.penjualan_id).filter(Boolean))];
  return (ids.length ? ids : (sj.penjualan_id ? [sj.penjualan_id] : [])).join(', ');
}

function buildKirimLinesHtml(sj) {
  if ((sj.items || []).length) {
    return sj.items.map((it) => `<p>${it.penjualan_jenis || '(tanpa nama)'}: ${it.jumlah_kirim}</p>`).join('');
  }
  return sj.jumlah_kirim ? `<p>${sj.jumlah_kirim} unit</p>` : '<p class="text-ink-muted">-</p>';
}

function clientLabel(sj) {
  return (sj.client_names || []).length ? sj.client_names.join(' | ') : '-';
}

function tripPhotoMap(sj) {
  const map = {};
  (sj.trip_photos || []).forEach((p) => { map[p.type] = p.path; });
  return map;
}

// Sama urutan prioritas dgn fotoEntries() ekspedisi-apk -- lihat docblock
// panjang di sana soal kenapa trip_photos diprioritaskan drpd kolom sj.foto_*.
function fotoEntries(sj) {
  const trip = tripPhotoMap(sj);
  return [
    { label: 'Foto Berangkat', path: trip.berangkat },
    { label: 'Foto Serah Terima', path: trip.serah_terima || sj.foto_serah_terima },
    { label: 'Foto SJ', path: trip.sj || sj.foto_surat_jalan },
    { label: 'Foto Validasi', path: sj.foto_validasi },
  ].filter((f) => f.path);
}

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function detailBodyHtml(sj) {
  const spkLabel = buildSpkLabel(sj);
  const tglDibuat = formatTanggal(sj.created_at);
  const tglKirim = formatTanggal(sj.tgl_kirim);
  const fotos = fotoEntries(sj);

  return `
    <div class="card-surface p-3">
      <p class="font-bold text-ink-primary text-sm">${escapeHtml(sj.no_surat_jalan) || '(belum di-generate)'}
        ${sj.asal === 'migrasi_legacy' ? '<span class="ml-1 text-[10px] font-semibold text-ink-muted">(Data Lama)</span>' : ''}
      </p>
      <p class="text-xs text-ink-secondary mt-0.5">${sj.trip_id ? 'Dari trip #' + sj.trip_id : 'Dibuat manual'}${spkLabel ? ' &middot; SPK ' + escapeHtml(spkLabel) : ''}</p>
    </div>

    <div>
      <p class="mat-label">Tujuan</p>
      <p class="text-ink-primary">${escapeHtml(sj.tujuan) || '-'}</p>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <p class="mat-label">Supir &amp; Kendaraan</p>
        <p class="text-ink-primary">${escapeHtml(sj.nama_supir) || 'Belum ada supir'}</p>
        <p class="text-xs text-ink-secondary">${escapeHtml(sj.kendaraan) || '-'}${sj.plat ? ' (' + escapeHtml(sj.plat) + ')' : ''}</p>
      </div>
      <div>
        <p class="mat-label">Penerima</p>
        <p class="text-ink-primary">${escapeHtml(sj.penerima) || '-'}</p>
      </div>
    </div>

    <div>
      <p class="mat-label">Rincian Kirim</p>
      <div class="text-ink-primary">${buildKirimLinesHtml(sj)}</div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <p class="mat-label">Dikirim</p>
        <p class="text-ink-primary">${tglKirim || '-'}</p>
      </div>
      <div>
        <p class="mat-label">Dibuat</p>
        <p class="text-ink-primary">${tglDibuat || '-'}</p>
      </div>
    </div>

    <div>
      <p class="mat-label">Status</p>
      <span class="text-xs font-semibold px-2 py-0.5 rounded ${STATUS_BADGE_CLASS[sj.status] || 'bg-ink-faint text-ink-secondary'}">${STATUS_LABEL[sj.status] || sj.status}</span>
      ${sj.status === 'tervalidasi' ? `<p class="mt-1 text-xs text-ink-secondary">${escapeHtml(sj.nama_validator) || ''}${sj.divalidasi_at ? ' &middot; ' + formatTanggal(sj.divalidasi_at) : ''}</p>` : ''}
    </div>

    <div>
      <p class="mat-label">Foto</p>
      <div class="flex flex-wrap gap-3">
        ${fotos.map((f) => `
          <div class="flex flex-col items-center gap-1 sjd-foto-item" data-src="${fotoUrl(f.path)}">
            <img src="${fotoUrl(f.path)}" class="h-16 w-16 rounded border border-ink-faint object-cover cursor-zoom-in" title="${f.label}" alt="${f.label}" />
            <span class="text-[10px] text-ink-muted">${f.label}</span>
          </div>
        `).join('')}
        ${fotos.length ? '' : '<p class="text-xs text-ink-muted">Belum ada foto.</p>'}
      </div>
    </div>
  `;
}

// Fallback browser (input type=file) -- lihat docblock atas file soal kenapa
// tanpa cabang native navigator.camera.
function pickPhotoFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = () => {
      input.remove();
      if (input.files && input.files[0]) resolve(input.files[0]);
      else reject(new Error('Tidak ada foto dipilih'));
    };
    input.click();
  });
}

function uploadSjPhoto(sjId, action, file) {
  const formData = new FormData();
  formData.append('photo', file, file.name || 'upload.jpg');
  return ekspedisiAjax({
    url: `${EKSPEDISI_BASE}/admin/sj/${sjId}/${action}`,
    method: 'POST',
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'json',
  });
}

export function mount(container) {
  container.innerHTML = tpl;
  showAuthedShell('/sj');

  if (!hasEkspedisiAccess()) {
    jQuery('#sj_table_body').html('<tr><td colspan="5" class="tbl-empty">Tidak ada akses ke menu ini.</td></tr>');
    app.popup.open('#popup-sj-no-access');
    return function unmount() { };
  }

  let historyMode = false;
  let query = '';
  const currentYear = new Date().getFullYear();
  let tahun = String(currentYear);
  let page = 1;
  const perPage = 20;
  let searchTimeout = null;

  const $tahunSelect = jQuery('#sj_tahun');

  loadYears().then(load);

  jQuery('#sj_add').on('click', () => Router.navigate('/sj/new'));
  jQuery('#sj_refresh').on('click', load);
  jQuery('#sj_toggle_riwayat').on('click', () => {
    historyMode = !historyMode;
    page = 1;
    jQuery('#sj_toggle_riwayat').toggleClass('icon-btn--danger', historyMode);
    load();
  });
  jQuery('#sj_search').on('input', function () {
    clearTimeout(searchTimeout);
    const val = jQuery(this).val();
    searchTimeout = setTimeout(() => { query = val; page = 1; load(); }, 400);
  });
  $tahunSelect.on('change', function () {
    tahun = jQuery(this).val();
    page = 1;
    load();
  });

  // Dropdown tahun -- server cuma balikin tahun yang BENERAN ada baris-nya
  // (App\Ekspedisi\Support\SuratJalan::availableYears()), tahun berjalan
  // ditambahkan manual kalau belum ada supaya default-nya tidak pernah
  // "hilang" dari dropdown. Gagal diam-diam (dropdown cuma jadi tahun
  // berjalan doang) -- BUKAN alasan gagalkan seluruh halaman.
  function loadYears() {
    return ekspedisiAjax({ url: `${EKSPEDISI_BASE}/admin/sj/years`, method: 'GET', dataType: 'json' },
      () => { jQuery('#sj_table_body').html('<tr><td colspan="5" class="tbl-empty">Tidak ada akses ke menu ini.</td></tr>'); })
      .then((years) => {
        years = Array.isArray(years) ? years : [];
        if (!years.map(String).includes(String(currentYear))) {
          years = [currentYear, ...years].sort((a, b) => b - a);
        }
        $tahunSelect.html(years.map((y) => `<option value="${y}" ${String(y) === tahun ? 'selected' : ''}>${y}</option>`).join(''));
      })
      .catch(() => {
        $tahunSelect.html(`<option value="${currentYear}">${currentYear}</option>`);
      });
  }

  function load() {
    jQuery('#sj_table_body').html('<tr><td colspan="5" class="tbl-empty">Memuat data...</td></tr>');
    jQuery('#sj_pagination').empty();

    const params = new URLSearchParams({
      ...(historyMode ? { status: 'tervalidasi' } : { belum_tervalidasi: '1' }),
      ...(query ? { q: query } : {}),
      ...(tahun ? { tahun } : {}),
      page: String(page),
      per_page: String(perPage),
    });

    ekspedisiAjax({ url: `${EKSPEDISI_BASE}/admin/sj?${params}`, method: 'GET', dataType: 'json' }, () => {
      jQuery('#sj_table_body').html('<tr><td colspan="5" class="tbl-empty">Tidak ada akses ke menu ini.</td></tr>');
    })
      .then((result) => render(result || { data: [], total: 0 }))
      .catch(() => {
        jQuery('#sj_table_body').html('<tr><td colspan="5" class="tbl-empty">Gagal memuat data.</td></tr>');
        jQuery('#sj_count').text('0');
      });
  }

  function render({ data: list, total }) {
    jQuery('#sj_count').text(String(total || 0));
    list = list || [];

    // Kolom "Aksi" cuma relevan di mode aktif -- dicopot SELURUHNYA (bukan
    // cuma dikosongkan) di mode Riwayat, sama pola dgn adminSuratJalan.js.
    const showAksi = !historyMode;
    jQuery('#sj_thead_row').find('th').eq(4).toggle(showAksi);

    if (!list.length) {
      jQuery('#sj_table_body').html(`<tr><td colspan="${showAksi ? 5 : 4}" class="tbl-empty">Tidak ada data.</td></tr>`);
      return;
    }

    const $tbody = jQuery('#sj_table_body').empty();

    list.forEach((sj) => {
      // Baris VIRTUAL "nomor terlewat" (App\Ekspedisi\Support\SuratJalan::
      // listWithGaps()) -- tidak ada di DB, TANPA aksi apa pun.
      if (sj.missing) {
        $tbody.append(`
          <tr class="bg-danger/10">
            <td class="td-left font-bold text-danger">${escapeHtml(sj.no_surat_jalan)}</td>
            <td class="text-danger" colspan="${showAksi ? 3 : 3}">Nomor ini belum pernah diinput -- kemungkinan kertas SJ terlewat/hilang.</td>
            ${showAksi ? '<td></td>' : ''}
          </tr>
        `);
        return;
      }

      const tglKirim = formatTanggal(sj.tgl_kirim);
      const $tr = jQuery(`
        <tr class="cursor-pointer hover:bg-surface-raised" title="Dobel klik untuk lihat detail">
          <td class="td-left font-bold">${escapeHtml(sj.no_surat_jalan) || '(belum ada nomor)'}</td>
          <td class="td-left">${escapeHtml(clientLabel(sj))}</td>
          <td class="td-center">${tglKirim || '-'}</td>
          <td class="td-left" style="max-width:140px;white-space:normal;">${escapeHtml(sj.catatan) || '-'}</td>
          ${showAksi ? '<td class="td-center"><div class="flex gap-1 justify-center" data-aksi></div></td>' : ''}
        </tr>
      `);

      $tr.on('dblclick', () => {
        jQuery('#sjd_body').html(detailBodyHtml(sj));
        app.popup.open('#popup-sj-detail');
      });
      jQuery('#sjd_body').off('click', '.sjd-foto-item');
      jQuery('#sjd_body').on('click', '.sjd-foto-item', function () {
        app.photoBrowser.create({ photos: [jQuery(this).data('src')] }).open();
      });

      if (showAksi && sj.status !== 'tervalidasi' && sj.driver_tipe === 'eksternal') {
        // Supir eksternal tidak checkpoint apa pun lewat app -- admin bisa
        // sekalian lampirkan bukti serah terima di sini, OPSIONAL, tidak
        // mempengaruhi status (beda dari Validasi).
        const $btnSt = jQuery('<button class="btn-tbl btn-tbl--muted">Serah Terima</button>');
        $btnSt.on('click', async (e) => {
          e.stopPropagation();
          let file;
          try {
            file = await pickPhotoFile();
          } catch (err) {
            return;
          }
          $btnSt.prop('disabled', true).text('...');
          uploadSjPhoto(sj.id, 'serah-terima', file)
            .then((updated) => {
              Object.assign(sj, updated);
              $btnSt.prop('disabled', false).text('Serah Terima');
            })
            .catch((xhr) => {
              app.dialog.alert((xhr && xhr.responseJSON && xhr.responseJSON.message) || 'Gagal mengunggah foto serah terima. Coba lagi.', 'Error');
              $btnSt.prop('disabled', false).text('Serah Terima');
            });
        });
        $tr.find('[data-aksi]').append($btnSt);
      }

      if (showAksi && sj.status !== 'tervalidasi') {
        const $btn = jQuery('<button class="btn-tbl btn-tbl--primary">Validasi</button>');
        $btn.on('click', async (e) => {
          e.stopPropagation();
          let file;
          try {
            file = await pickPhotoFile();
          } catch (err) {
            return;
          }
          $btn.prop('disabled', true).text('...');
          uploadSjPhoto(sj.id, 'validasi', file)
            .then((updated) => {
              Object.assign(sj, updated);
              $btn.remove();
            })
            .catch((xhr) => {
              app.dialog.alert((xhr && xhr.responseJSON && xhr.responseJSON.message) || 'Gagal memvalidasi surat jalan. Coba lagi.', 'Error');
              $btn.prop('disabled', false).text('Validasi');
            });
        });
        $tr.find('[data-aksi]').append($btn);
      }

      $tbody.append($tr);
    });

    renderPaginationBar(total || 0);
  }

  function renderPaginationBar(total) {
    const $bar = jQuery('#sj_pagination').empty();
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (totalPages <= 1) return;

    const $prev = jQuery(`<button class="icon-btn w-8 h-8" ${page <= 1 ? 'disabled' : ''}>&larr;</button>`);
    const $label = jQuery(`<p class="text-xs font-semibold text-ink-secondary min-w-[3rem] text-center">${page}/${totalPages}</p>`);
    const $next = jQuery(`<button class="icon-btn w-8 h-8" ${page >= totalPages ? 'disabled' : ''}>&rarr;</button>`);
    $prev.on('click', () => { page -= 1; load(); });
    $next.on('click', () => { page += 1; load(); });
    $bar.append($prev, $label, $next);
  }

  return function unmount() {
    if (searchTimeout) clearTimeout(searchTimeout);
  };
}
