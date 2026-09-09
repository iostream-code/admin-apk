// SJ Tarik (submenu "PO" tab SJ) -- porting dari
// ekspedisi-apk/src/js/pages/adminSuratJalanPo.js. [BARU 2026-09-09 atas
// permintaan user, "pastikan admin juga bisa menambahkan SJ baik customer,
// PO, maupun retur seperti yg ada di ekspedisi-apk"] -- lihat docblock
// panjang di pages/sj/list.js (Customer) soal auth/token modul Ekspedisi,
// pola sama persis di sini.
//
// Beda dari "Customer" (list.js): backend (`GET /admin/sj-po`) balikin ARRAY
// POLOS (LIMIT 200, TANPA page/per_page/total) -- volume SJ PO masih jauh
// dari situ, jadi filter tahun/pencarian/pagination di sini SEMUA
// client-side atas `allRows` (disalin apa adanya dari sumbernya, BUKAN pola
// server-paginated punya "Customer"). SJ selalu final ('RECEIVED'/
// 'PARTIAL_RECEIVED') begitu dibuat -- TIDAK ADA kolom/aksi apa pun di
// tabel, beda dari "Customer" yg py Validasi/Serah Terima.
//
// Mode Aktif = PARTIAL_RECEIVED (masih ada sisa PO blm masuk semua),
// Riwayat = RECEIVED/CANCELLED.

import tpl from './listPo.html?raw';
import { APP_CONFIG } from '../../lib/config.js';
import { showAuthedShell } from '../../lib/shell.js';
import { hasEkspedisiAccess, ekspedisiAjax } from '../../lib/ekspedisiAuth.js';
import { Router } from '../../lib/router.js';

const EKSPEDISI_BASE = APP_CONFIG.EKSPEDISI_API_BASE_URL;

const STATUS_LABEL = { PARTIAL_RECEIVED: 'Sebagian Diterima', RECEIVED: 'Diterima', CANCELLED: 'Dibatalkan' };
const STATUS_BADGE_CLASS = {
  PARTIAL_RECEIVED: 'bg-warning text-white',
  RECEIVED: 'bg-success text-white',
  CANCELLED: 'bg-danger text-white',
};

function fotoUrl(path) {
  return /^https?:\/\//.test(path) ? path : `${EKSPEDISI_BASE}/${path}`;
}

function formatTanggal(value) {
  return value ? new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
}

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function detailBodyHtml(sj) {
  const items = sj.items || [];
  const itemRows = items.map((it) => `
    <tr>
      <td class="td-left">${escapeHtml(it.material_name) || '-'} <span class="text-xs text-ink-muted">${escapeHtml(it.unit_code) || ''}</span></td>
      <td class="td-right">${it.qty}</td>
    </tr>
  `).join('');

  return `
    <div class="card-surface p-3">
      <p class="font-bold text-ink-primary text-sm">${escapeHtml(sj.sj_number) || '-'}</p>
      <p class="text-xs text-ink-secondary mt-0.5">Supplier: ${escapeHtml(sj.supplier_name) || '-'}</p>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <p class="mat-label">Supir</p>
        <p class="text-ink-primary">${escapeHtml(sj.transporter_name) || '-'}</p>
      </div>
      <div>
        <p class="mat-label">Kendaraan</p>
        <p class="text-ink-primary">${escapeHtml(sj.vehicle_number) || '-'}</p>
      </div>
    </div>

    <div>
      <p class="mat-label">Diterima</p>
      <p class="text-ink-primary">${formatTanggal(sj.received_at || sj.sj_date) || '-'}</p>
    </div>

    ${sj.notes ? `
    <div>
      <p class="mat-label">Catatan</p>
      <p class="text-ink-primary">${escapeHtml(sj.notes)}</p>
    </div>` : ''}

    <div>
      <p class="mat-label">Status</p>
      <span class="text-xs font-semibold px-2 py-0.5 rounded ${STATUS_BADGE_CLASS[sj.status] || 'bg-ink-faint text-ink-secondary'}">${STATUS_LABEL[sj.status] || sj.status}</span>
    </div>

    ${sj.receive_photo_path ? `
    <div>
      <p class="mat-label">Bukti Terima</p>
      <img data-lightbox src="${fotoUrl(sj.receive_photo_path)}" class="h-16 w-16 rounded border border-ink-faint object-cover cursor-zoom-in" alt="Bukti terima" />
    </div>` : ''}

    <div>
      <p class="mat-label">Item</p>
      <table class="tbl-dark w-full">
        <tbody>${itemRows || '<tr><td class="tbl-empty">Tidak ada item.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

export function mount(container) {
  container.innerHTML = tpl;
  showAuthedShell('/sj/po');

  if (!hasEkspedisiAccess()) {
    jQuery('#sjpo_table_body').html('<tr><td colspan="3" class="tbl-empty">Tidak ada akses ke menu ini.</td></tr>');
    app.popup.open('#popup-sjpo-no-access');
    return function unmount() { };
  }

  jQuery('#sjpo_add').on('click', () => Router.navigate('/sj/po/new'));

  let historyMode = false;
  let query = '';
  const currentYear = new Date().getFullYear();
  let tahun = String(currentYear);
  let page = 1;
  const perPage = 20;
  let allRows = [];
  let searchTimeout = null;

  const $tahunSelect = jQuery('#sjpo_tahun');

  jQuery('#sjpo_refresh').on('click', load);
  jQuery('#sjpo_toggle_riwayat').on('click', () => {
    historyMode = !historyMode;
    page = 1;
    jQuery('#sjpo_toggle_riwayat').toggleClass('icon-btn--danger', historyMode);
    load();
  });
  jQuery('#sjpo_search').on('input', function () {
    clearTimeout(searchTimeout);
    const val = jQuery(this).val();
    searchTimeout = setTimeout(() => { query = val; page = 1; render(); }, 400);
  });
  $tahunSelect.on('change', function () {
    tahun = jQuery(this).val();
    page = 1;
    render();
  });

  function tahunOf(sj) {
    const raw = sj.received_at || sj.sj_date;
    return raw ? String(new Date(raw).getFullYear()) : null;
  }

  function filtered() {
    const q = query.trim().toLowerCase();
    return allRows.filter((sj) => {
      if (tahunOf(sj) !== tahun) return false;
      if (!q) return true;
      return (sj.sj_number || '').toLowerCase().includes(q) || (sj.supplier_name || '').toLowerCase().includes(q);
    });
  }

  function load() {
    jQuery('#sjpo_table_body').html('<tr><td colspan="3" class="tbl-empty">Memuat data...</td></tr>');
    jQuery('#sjpo_pagination').empty();

    const statusFilter = historyMode ? 'RECEIVED,CANCELLED' : 'PARTIAL_RECEIVED';
    ekspedisiAjax({ url: `${EKSPEDISI_BASE}/admin/sj-po?${new URLSearchParams({ status: statusFilter })}`, method: 'GET', dataType: 'json' },
      () => { jQuery('#sjpo_table_body').html('<tr><td colspan="3" class="tbl-empty">Tidak ada akses ke menu ini.</td></tr>'); })
      .then((rows) => { allRows = Array.isArray(rows) ? rows : []; render(); })
      .catch(() => {
        jQuery('#sjpo_table_body').html('<tr><td colspan="3" class="tbl-empty">Gagal memuat data.</td></tr>');
        jQuery('#sjpo_count').text('0');
      });
  }

  function render() {
    // Tahun yang BENERAN ada di allRows -- tahun berjalan tetap selalu ada di
    // opsi (supaya default-nya tidak pernah "hilang" dari dropdown), pola
    // sama dgn "Customer" (list.js::loadYears()), sumbernya dari memori
    // (allRows) di sini, bukan endpoint /years terpisah.
    let years = [...new Set(allRows.map(tahunOf).filter(Boolean))].sort((a, b) => b - a);
    if (!years.map(String).includes(String(currentYear))) years = [currentYear, ...years].sort((a, b) => b - a);
    $tahunSelect.html(years.map((y) => `<option value="${y}" ${String(y) === tahun ? 'selected' : ''}>${y}</option>`).join(''));

    const matched = filtered();
    jQuery('#sjpo_count').text(String(matched.length));

    if (!matched.length) {
      jQuery('#sjpo_table_body').html('<tr><td colspan="3" class="tbl-empty">Tidak ada data.</td></tr>');
      jQuery('#sjpo_pagination').empty();
      return;
    }

    const totalPages = Math.max(1, Math.ceil(matched.length / perPage));
    if (page > totalPages) page = totalPages;
    const list = matched.slice((page - 1) * perPage, page * perPage);

    const $tbody = jQuery('#sjpo_table_body').empty();
    list.forEach((sj) => {
      const $tr = jQuery(`
        <tr class="cursor-pointer hover:bg-surface-raised" title="Dobel klik untuk lihat detail">
          <td class="td-left font-bold">${escapeHtml(sj.sj_number) || '-'}</td>
          <td class="td-left">${escapeHtml(sj.supplier_name) || '-'}</td>
          <td class="td-left">${escapeHtml(sj.transporter_name) || '-'}${sj.vehicle_number ? ' &middot; ' + escapeHtml(sj.vehicle_number) : ''}</td>
        </tr>
      `);
      $tr.on('dblclick', () => openDetail(sj.id));
      $tbody.append($tr);
    });

    jQuery('#sjpod_body').off('click', '[data-lightbox]');
    jQuery('#sjpod_body').on('click', '[data-lightbox]', function () {
      app.photoBrowser.create({ photos: [jQuery(this).attr('src')] }).open();
    });

    renderPaginationBar(matched.length);
  }

  function openDetail(id) {
    ekspedisiAjax({ url: `${EKSPEDISI_BASE}/admin/sj-po/${id}`, method: 'GET', dataType: 'json' })
      .then((sj) => {
        jQuery('#sjpod_body').html(detailBodyHtml(sj));
        app.popup.open('#popup-sjpo-detail');
      })
      .catch(() => app.dialog.alert('Gagal memuat detail SJ.', 'Error'));
  }

  function renderPaginationBar(total) {
    const $bar = jQuery('#sjpo_pagination').empty();
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (totalPages <= 1) return;

    const $prev = jQuery(`<button class="icon-btn w-8 h-8" ${page <= 1 ? 'disabled' : ''}>&larr;</button>`);
    const $label = jQuery(`<p class="text-xs font-semibold text-ink-secondary min-w-[3rem] text-center">${page}/${totalPages}</p>`);
    const $next = jQuery(`<button class="icon-btn w-8 h-8" ${page >= totalPages ? 'disabled' : ''}>&rarr;</button>`);
    $prev.on('click', () => { page -= 1; render(); });
    $next.on('click', () => { page += 1; render(); });
    $bar.append($prev, $label, $next);
  }

  load();

  return function unmount() {
    if (searchTimeout) clearTimeout(searchTimeout);
  };
}
