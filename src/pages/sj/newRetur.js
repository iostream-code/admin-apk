// Buat SJ Retur (submenu "Retur", baru) -- porting dari
// ekspedisi-apk/src/js/pages/adminNewReturSuratJalanPo.js. [BARU 2026-09-09
// atas permintaan user, "pastikan admin juga bisa menambahkan SJ baik
// customer, PO, maupun retur seperti yg ada di ekspedisi-apk"] -- pola
// IDENTIK dgn newPo.js (submenu "PO", lihat docblock di sana): 1 SJ = 1
// retur, submit multipart (foto wajib), SJ langsung final
// ('RECEIVED'/'PARTIAL_RECEIVED') dalam 1 langkah. Sumber data retur PO
// (pur_t_retur_purchase, status APPROVED + retur_action=REPLACEMENT).

import tpl from './newRetur.html?raw';
import { APP_CONFIG } from '../../lib/config.js';
import { showAuthedShell } from '../../lib/shell.js';
import { ekspedisiAjax } from '../../lib/ekspedisiAuth.js';
import { Router } from '../../lib/router.js';

const EKSPEDISI_BASE = APP_CONFIG.EKSPEDISI_API_BASE_URL;

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Sama persis pickPhotoFile() di list.js/new.js/newPo.js -- diduplikasi (konvensi app ini).
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

// Disalin dari renderPhotoField() adminNewReturSuratJalanPo.js (duplikasi
// disengaja, sama pola dgn newPo.js).
function renderPhotoField($container, label) {
  const $field = jQuery(`
    <div>
      <label class="mat-label">${label}</label>
      <div class="flex items-center gap-3">
        <button type="button" class="sjnewretur_btn_foto icon-btn !w-auto px-4 text-xs font-bold">Ambil Foto</button>
        <img data-lightbox class="hidden h-14 w-14 cursor-zoom-in rounded-md border border-ink-faint object-cover" />
      </div>
    </div>
  `);
  $container.append($field);

  const $btn = $field.find('.sjnewretur_btn_foto');
  const $thumb = $field.find('img');
  let blob = null;

  $btn.on('click', async () => {
    try {
      blob = await pickPhotoFile();
    } catch (e) {
      return;
    }
    $thumb.attr('src', URL.createObjectURL(blob)).removeClass('hidden');
    $btn.text('Ganti Foto');
  });

  return { getBlob: () => blob };
}

export function mount(container) {
  container.innerHTML = tpl;
  showAuthedShell('/sj/retur-po');

  jQuery('#sjnewretur_back').on('click', () => Router.navigate('/sj/retur-po'));

  const $main = jQuery('#sjnewretur_main');

  Promise.all([
    ekspedisiAjax({ url: `${EKSPEDISI_BASE}/admin/sj-retur-po/outstanding-po`, method: 'GET', dataType: 'json' }),
    ekspedisiAjax({ url: `${EKSPEDISI_BASE}/admin/drivers?semua=1`, method: 'GET', dataType: 'json' }),
  ])
    .then(([outstanding, drivers]) => render(outstanding || [], drivers || []))
    .catch(() => render([], []));

  function render(outstanding, drivers) {
    if (!outstanding.length) {
      $main.html(`
        <div class="card-surface p-4 text-center text-sm text-ink-secondary">
          Tidak ada retur berstatus <b>APPROVED</b> yang masih punya sisa qty untuk diterima saat ini.
        </div>
      `);
      return;
    }

    const returOptions = outstanding
      .map((r) => `<option value="${r.retur_id}">${escapeHtml(r.retur_number)} &mdash; ${escapeHtml(r.supplier_name)}${r.po_number ? ' (' + escapeHtml(r.po_number) + ')' : ''}</option>`)
      .join('');
    const driverOptions = drivers
      .map((d) => `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}${d.tipe === 'eksternal' ? ' (Eksternal)' : ''}</option>`)
      .join('');

    $main.html(`
      <form id="sjnewretur_form" class="space-y-3">
        <div class="card-surface p-3 space-y-3">
          <p class="mat-label">Retur Purchase</p>
          <div>
            <label class="mat-label" for="sjnewretur_retur_id">Pilih Retur</label>
            <select id="sjnewretur_retur_id" required class="mat-input">
              <option value="" disabled selected>-- Pilih Retur --</option>
              ${returOptions}
            </select>
          </div>
          <div id="sjnewretur_items" class="hidden space-y-2"></div>
        </div>

        <div class="card-surface p-3 space-y-3">
          <p class="mat-label">Detail Pengiriman</p>
          <div>
            <label class="mat-label" for="sjnewretur_driver_name">Supir</label>
            ${drivers.length
        ? `<select id="sjnewretur_driver_name" required class="mat-input">
                <option value="" disabled selected>-- Pilih supir --</option>
                ${driverOptions}
              </select>`
        : `<input id="sjnewretur_driver_name" type="text" required placeholder="Nama supir" class="mat-input" />`}
          </div>
          <div>
            <label class="mat-label" for="sjnewretur_vehicle_number">Nomor Kendaraan</label>
            <input id="sjnewretur_vehicle_number" type="text" required placeholder="Contoh: P 1234 XY" class="mat-input" />
          </div>
          <div>
            <label class="mat-label" for="sjnewretur_notes">Catatan (opsional)</label>
            <textarea id="sjnewretur_notes" rows="2" class="mat-input" style="height:auto;"></textarea>
          </div>
          <div id="sjnewretur_photo_field"></div>
          <p id="sjnewretur_form_error" class="hidden rounded-md bg-danger/10 px-3 py-2 text-xs font-medium text-danger"></p>
          <button type="submit" id="sjnewretur_btn_submit" class="btn-action btn-action--primary">Simpan &amp; Tandai Diterima</button>
        </div>
      </form>
    `);

    const photoField = renderPhotoField($main.find('#sjnewretur_photo_field'), 'Foto Bukti Terima (wajib)');

    $main.find('#sjnewretur_photo_field [data-lightbox]').on('click', function () {
      app.photoBrowser.create({ photos: [jQuery(this).attr('src')] }).open();
    });

    function renderReturItems(returId) {
      const r = outstanding.find((x) => String(x.retur_id) === String(returId));
      const $wrap = jQuery('#sjnewretur_items').empty();
      if (!r) { $wrap.addClass('hidden'); return; }

      r.items.forEach((it) => {
        $wrap.append(`
          <div class="flex items-center gap-2 rounded-md border border-ink-faint p-3" data-retur-detail-id="${it.retur_detail_id}">
            <div class="flex-1">
              <p class="text-sm text-ink-primary">${escapeHtml(it.material_name)} <span class="text-xs text-ink-muted">${escapeHtml(it.unit_code)}</span></p>
              <p class="text-xs text-ink-muted">Sisa Retur: ${it.qty_outstanding}</p>
            </div>
            <input type="number" min="0" max="${it.qty_outstanding}" step="0.01" value="${it.qty_outstanding}"
              class="sjnewretur_item_qty mat-input w-24 text-right" />
          </div>
        `);
      });
      $wrap.removeClass('hidden');
    }

    $main.find('#sjnewretur_retur_id').on('change', function () { renderReturItems(jQuery(this).val()); });

    $main.find('#sjnewretur_form').on('submit', function (e) {
      e.preventDefault();
      const $btn = jQuery('#sjnewretur_btn_submit');
      const $err = jQuery('#sjnewretur_form_error').addClass('hidden');

      const returId = jQuery('#sjnewretur_retur_id').val();
      if (!returId) { $err.text('Pilih retur terlebih dahulu.').removeClass('hidden'); return; }

      const items = [];
      $main.find('[data-retur-detail-id]').each(function () {
        const detailId = jQuery(this).data('retur-detail-id');
        const qty = Number(jQuery(this).find('.sjnewretur_item_qty').val() || 0);
        if (qty > 0) items.push({ retur_detail_id: detailId, qty });
      });
      if (!items.length) { $err.text('Isi qty minimal untuk 1 item.').removeClass('hidden'); return; }

      const driverName = (jQuery('#sjnewretur_driver_name').val() || '').trim();
      if (!driverName) { $err.text('Supir wajib dipilih/diisi.').removeClass('hidden'); return; }
      const vehicleNumber = (jQuery('#sjnewretur_vehicle_number').val() || '').trim();
      if (!vehicleNumber) { $err.text('Nomor kendaraan wajib diisi.').removeClass('hidden'); return; }
      const photoBlob = photoField.getBlob();
      if (!photoBlob) { $err.text('Foto bukti terima wajib diambil.').removeClass('hidden'); return; }

      $btn.prop('disabled', true).text('Menyimpan...');

      const formData = new FormData();
      formData.append('driver_name', driverName);
      formData.append('vehicle_number', vehicleNumber);
      formData.append('notes', (jQuery('#sjnewretur_notes').val() || '').trim());
      formData.append('items', JSON.stringify(items));
      formData.append('photo', photoBlob, photoBlob.name || 'upload.jpg');

      ekspedisiAjax({
        url: `${EKSPEDISI_BASE}/admin/sj-retur-po`,
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        dataType: 'json',
      })
        .then(() => Router.navigate('/sj/retur-po'))
        .catch((xhr) => {
          $err.text((xhr && xhr.responseJSON && xhr.responseJSON.message) || 'Gagal menyimpan SJ. Coba lagi.').removeClass('hidden');
          $btn.prop('disabled', false).text('Simpan & Tandai Diterima');
        });
    });
  }

  return function unmount() { };
}
