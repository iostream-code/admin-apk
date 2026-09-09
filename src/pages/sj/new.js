// Buat SJ Customer (baru) -- porting dari
// ekspedisi-apk/src/js/pages/adminNewSuratJalan.js. [BARU 2026-09-09 atas
// permintaan user, "pastikan admin juga bisa menambahkan SJ baik customer,
// PO, maupun retur seperti yg ada di ekspedisi-apk"].
//
// Panggilan API pakai ekspedisiAjax()/EKSPEDISI_API_BASE_URL (BUKAN
// api.post ala ekspedisi-apk -- token modul beda, lihat docblock panjang di
// lib/ekspedisiAuth.js & pages/sj/list.js). Foto pakai pickPhotoFile() (file
// input biasa, disalin/diduplikasi dari list.js -- app ini tidak pernah
// pasang plugin kamera Cordova, lihat docblock list.js).
//
// Supir WAJIB dipilih, nomor SJ WAJIB diinput manual (backend menurunkan
// `no_surat_jalan` dari situ & menolak kalau sudah dipakai), 1 SJ boleh
// mengangkut lini produk dari LEBIH DARI 1 SPK asal semua dari client_id yang
// SAMA (dicek FE di sini sbg feedback cepat, divalidasi ULANG di server saat
// submit) -- semua aturan ini persis sumbernya, lihat docblock lengkap di
// adminNewSuratJalan.js.

import tpl from './new.html?raw';
import { APP_CONFIG } from '../../lib/config.js';
import { showAuthedShell } from '../../lib/shell.js';
import { ekspedisiAjax } from '../../lib/ekspedisiAuth.js';
import { Router } from '../../lib/router.js';

const EKSPEDISI_BASE = APP_CONFIG.EKSPEDISI_API_BASE_URL;

// Disalin dari ekspedisi-apk/src/js/format.js::formatSpkNo() -- dipakai
// cuma di sini, tidak ditambah ke lib/format.js (konvensi app ini,
// duplikasi utk utilitas kecil sekali-pakai).
function formatSpkNo(penjualanId) {
  if (!penjualanId) return '';
  const m = String(penjualanId).match(/^INV_?(\d+)(-.+)?$/i);
  if (!m) return String(penjualanId);
  return `SPK-${parseInt(m[1], 10)}${m[2] || ''}`;
}

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Fallback browser (input type=file) -- sama persis pickPhotoFile() di
// list.js, diduplikasi (tidak diekspor dari sana).
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

export function mount(container) {
  container.innerHTML = tpl;
  showAuthedShell('/sj');

  jQuery('#sjnew_back').on('click', () => Router.navigate('/sj'));

  let spkGroups = []; // [{ penjualanId, clientId, clientNama, lines: [...] }]
  let fotoBlob = null;

  ekspedisiAjax({ url: `${EKSPEDISI_BASE}/admin/drivers?semua=1`, method: 'GET', dataType: 'json' })
    .then((drivers) => {
      const options = (drivers || [])
        .map((d) => `<option value="${d.id}">${escapeHtml(d.name)}${d.tipe === 'eksternal' ? ' (Eksternal)' : ''}</option>`)
        .join('');
      jQuery('#sjnew_driver_id').append(options);
    })
    .catch(() => { /* dropdown tetap kosong, validasi wajib tetap jalan saat submit */ });

  function renderSpkGroups() {
    const $wrap = jQuery('#sjnew_spk_groups').empty();

    if (!spkGroups.length) {
      $wrap.addClass('hidden');
      jQuery('#sjnew_jumlah_kirim_wrap').removeClass('hidden');
      return;
    }
    jQuery('#sjnew_jumlah_kirim_wrap').addClass('hidden');

    spkGroups.forEach((group) => {
      const $group = jQuery(`
        <div class="rounded-md border border-ink-faint p-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold text-ink-primary">${escapeHtml(formatSpkNo(group.penjualanId))}</p>
              <p class="text-xs text-ink-muted">${escapeHtml(group.clientNama) || '-'}</p>
            </div>
            <button type="button" class="sjnew_btn_hapus_spk text-xs font-medium text-danger">Hapus</button>
          </div>
          <div class="mt-2 space-y-2" data-lines></div>
        </div>
      `);
      const $lines = $group.find('[data-lines]');
      group.lines.forEach((line) => {
        $lines.append(`
          <div class="flex items-center gap-2">
            <div class="flex-1">
              <p class="text-sm text-ink-primary">${escapeHtml(line.penjualan_jenis) || '(tanpa nama)'}</p>
              <p class="text-xs text-ink-muted">Dipesan ${line.penjualan_qty} &middot; sisa ${line.sisa}</p>
            </div>
            <input type="number" min="0" max="${line.sisa}" placeholder="0" data-line-id="${line.penjualan_detail_performa_id}"
              class="sjnew_item_jumlah_kirim mat-input w-20 text-right" />
          </div>
        `);
      });
      $group.find('.sjnew_btn_hapus_spk').on('click', () => {
        spkGroups = spkGroups.filter((g) => g.penjualanId !== group.penjualanId);
        renderSpkGroups();
      });
      $wrap.append($group);
    });

    $wrap.removeClass('hidden');
  }

  function addSpkGroup(penjualanId) {
    const $err = jQuery('#sjnew_spk_error').addClass('hidden');

    if (!penjualanId) return;
    if (spkGroups.some((g) => g.penjualanId === penjualanId)) {
      $err.text('SPK ini sudah ditambahkan.').removeClass('hidden');
      return;
    }

    const $btn = jQuery('#sjnew_btn_tambah_spk');
    $btn.prop('disabled', true).text('...');

    ekspedisiAjax({ url: `${EKSPEDISI_BASE}/admin/sj/spk/${encodeURIComponent(penjualanId)}/items`, method: 'GET', dataType: 'json' })
      .then((result) => {
        $btn.prop('disabled', false).text('+ Tambah');

        const { client_id: clientId, client_nama: clientNama, lines } = result || {};
        if (!lines || !lines.length) {
          $err.text('SPK ini tidak punya lini produk apa pun.').removeClass('hidden');
          return;
        }

        const existingClient = spkGroups.find((g) => g.clientId != null);
        if (existingClient && clientId != null && clientId !== existingClient.clientId) {
          $err.text(`SPK ini dari klien "${clientNama}", beda dengan SPK yang sudah ditambahkan ("${existingClient.clientNama}") -- 1 SJ hanya boleh mengangkut SPK dari klien yang sama.`).removeClass('hidden');
          return;
        }

        spkGroups.push({ penjualanId, clientId, clientNama, lines });
        jQuery('#sjnew_penjualan_id').val('');
        renderSpkGroups();
      })
      .catch((xhr) => {
        $btn.prop('disabled', false).text('+ Tambah');
        $err.text((xhr && xhr.responseJSON && xhr.responseJSON.message) || 'SPK tidak ditemukan.').removeClass('hidden');
      });
  }

  jQuery('#sjnew_btn_tambah_spk').on('click', () => addSpkGroup(jQuery('#sjnew_penjualan_id').val().trim()));

  jQuery('#sjnew_btn_foto').on('click', async function () {
    const $btn = jQuery(this);
    try {
      fotoBlob = await pickPhotoFile();
      jQuery('#sjnew_foto_status').text('Foto siap diunggah.').removeClass('text-ink-muted').addClass('text-primary');
    } catch (e) {
      // batal ambil foto -- bukan error fatal, foto tetap opsional
    }
  });

  jQuery('#sjnew_form').on('submit', function (e) {
    e.preventDefault();
    const $btn = jQuery('#sjnew_btn_submit');
    const $err = jQuery('#sjnew_form_error').addClass('hidden');

    const nomorUrut = Number(jQuery('#sjnew_nomor_urut').val() || 0);
    if (!nomorUrut || nomorUrut <= 0) {
      $err.text('Nomor SJ wajib diisi (angka sesuai nomor kertas SJ fisik).').removeClass('hidden');
      return;
    }

    const items = [];
    jQuery('.sjnew_item_jumlah_kirim').each(function () {
      const val = Number(jQuery(this).val() || 0);
      if (val > 0) items.push({ penjualan_detail_performa_id: Number(jQuery(this).data('line-id')), jumlah_kirim: val });
    });

    if (spkGroups.length && !items.length) {
      $err.text('Sudah ada SPK ditambahkan -- isi jumlah kirim minimal untuk 1 produk, atau hapus semua SPK untuk SJ tanpa breakdown.').removeClass('hidden');
      return;
    }

    const driverId = jQuery('#sjnew_driver_id').val();
    if (!driverId) {
      $err.text('Supir wajib dipilih.').removeClass('hidden');
      return;
    }

    $btn.prop('disabled', true).text('Menyimpan...');

    ekspedisiAjax({
      url: `${EKSPEDISI_BASE}/admin/sj`,
      method: 'POST',
      contentType: 'application/json',
      dataType: 'json',
      data: JSON.stringify({
        nomor_urut: nomorUrut,
        items: items.length ? items : undefined,
        tujuan: jQuery('#sjnew_tujuan').val().trim(),
        driver_id: driverId,
        kendaraan: jQuery('#sjnew_kendaraan').val().trim(),
        plat: jQuery('#sjnew_plat').val().trim(),
        penerima: jQuery('#sjnew_penerima').val().trim(),
        jumlah_kirim: items.length ? undefined : (jQuery('#sjnew_jumlah_kirim').val() || undefined),
        tgl_kirim: jQuery('#sjnew_tgl_kirim').val() || undefined,
        catatan: jQuery('#sjnew_catatan').val().trim(),
      }),
    })
      .then((sj) => {
        if (!fotoBlob) return null;
        const formData = new FormData();
        formData.append('photo', fotoBlob, fotoBlob.name || 'upload.jpg');
        return ekspedisiAjax({
          url: `${EKSPEDISI_BASE}/admin/sj/${sj.id}/photo`,
          method: 'POST',
          data: formData,
          processData: false,
          contentType: false,
          dataType: 'json',
        });
      })
      .then(() => Router.navigate('/sj'))
      .catch((xhr) => {
        const msg = (xhr && xhr.responseJSON && xhr.responseJSON.message) || 'Gagal membuat surat jalan. Coba lagi.';
        $err.text(msg).removeClass('hidden');
        $btn.prop('disabled', false).text('Buat Surat Jalan');
      });
  });

  return function unmount() { };
}
