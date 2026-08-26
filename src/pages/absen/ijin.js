// Absen -- Validasi Ijin.
//
// [TEMUAN 2026-08-26, dikonfirmasi ke user sebelum porting] Section
// "Validasi Ijin" di absensi.html admin-finance-apk LAMA sudah basi
// terhadap backend saat ini:
// - getDataValidIjin() lama kirim {is_approved:0} & baca field
//   karyawan_nama/tanggal_ijin/is_approved/dokumen_ijin/id_ijin -- SEMUA itu
//   sudah tidak ada di response IjinController::getDataIjinHrd() sekarang
//   (backend-production, sudah direfactor: filter month/year/status, field
//   tanggal_awal/tanggal_akhir/status 'pending'|'disetujui'|'ditolak',
//   relasi user/jenisIjin, computed hari_tunggu/is_finance_overdue).
// - validasiIjin() lama kirim {id_ijin,is_approved,karyawan_nama} ke
//   update-validasi -- endpoint SEKARANG minta {id_ijin,validated_by(user
//   id),status:'disetujui'|'ditolak'}.
// User memutuskan (disepakati, bukan asumsi): porting section ini pakai
// KONTRAK BACKEND TERBARU, bukan logic JS lama yang sudah tidak nyambung.
//
// [SPLIT 2026-08-26 atas permintaan user, "jadikan 2 tab saja Absen dan
// Ijin"] Sebelumnya digabung 1 file dgn pages/absen/validasi.js (dulu
// pages/absen/absen.js) -- sekarang jadi PageModule sendiri, didaftarkan
// sbg sub-tab kedua grup "Absen" di lib/shell.js.
//
// [UPDATE 2026-08-26, keputusan produk dari user] Kolom Alasan dihapus dari
// tabel utama (cuma tampil di popup Detail, dirender sbg blok label-di-atas
// via infoBlock() -- bukan sejajar kiri-kanan spt field lain). Tombol popup
// Detail diganti dari 2 tombol Setujui/Tolak jadi 1 tombol "Konfirmasi Sudah
// Mengetahui" -- app Admin ini BUKAN pemegang wewenang approve/reject ijin
// (itu wewenang HRD/Manajer di app/dashboard lain), di sini cuma konfirmasi
// admin sudah tahu ada pengajuan. Lihat komentar di konfirmasiIjin() di
// bawah utk catatan teknis kenapa tetap kirim status='disetujui'.

import tpl from './ijin.html?raw';
import { APP_CONFIG } from '../../lib/config.js';
import { formatDateShort } from '../../lib/format.js';
import { showAuthedShell } from '../../lib/shell.js';

const IMAGE_BASE = APP_CONFIG.IMAGE_BASE_URL;
const IMG_IJIN = IMAGE_BASE + '/bukti_ijin';

function isEmpty(v) {
  return v == null || v === 'null' || v === '';
}

function infoRow(label, value, valueCls = '') {
  return `
    <div class="flex justify-between py-1 border-b border-ink-faint text-xs">
      <span class="text-ink-secondary">${label}</span>
      <span class="font-semibold ${valueCls}">${value}</span>
    </div>
  `;
}

// Varian blok utk field teks panjang (mis. Alasan) -- label di baris atas,
// isi di baris BAWAHNYA (bukan sejajar kiri-kanan spt infoRow()), supaya
// teks panjang tidak terpotong/kepepet di kolom kanan yang sempit.
function infoBlock(label, value, valueCls = '') {
  return `
    <div class="py-1.5 border-b border-ink-faint text-xs">
      <div class="text-ink-secondary mb-1">${label}</div>
      <div class="font-semibold whitespace-pre-wrap ${valueCls}">${value}</div>
    </div>
  `;
}

function badgeStatus(status) {
  if (status === 'disetujui') return '<span class="text-success font-semibold">✅ Disetujui</span>';
  if (status === 'ditolak') return '<span class="text-danger font-semibold">❌ Ditolak</span>';
  return '<span class="text-warning font-semibold">Pending</span>';
}

export function mount(container) {
  container.innerHTML = tpl;
  showAuthedShell('/absen/ijin');

  let ijinRows = []; // lookup dari data-idx tombol Detail -> row

  jQuery('#ij_refresh').on('click', loadDataValidIjin);

  function loadDataValidIjin() {
    jQuery.ajax({
      type: 'POST',
      url: APP_CONFIG.API_BASE_URL + '/hrm/ijin/data-hrd',
      dataType: 'JSON',
      data: { status: 'pending' },
      beforeSend() {
        jQuery('#ij_table_body').html('<tr><td colspan="7" class="tbl-empty">Memuat data...</td></tr>');
      },
      success(data) {
        if (data.status !== 'success') {
          jQuery('#ij_table_body').html(`<tr><td colspan="7" class="tbl-empty">Gagal memuat data. ${data.message || ''}</td></tr>`);
          return;
        }

        ijinRows = data.data || [];
        jQuery('#ij_count').text(String(ijinRows.length));

        if (!ijinRows.length) {
          jQuery('#ij_table_body').html('<tr><td colspan="7" class="tbl-empty">Tidak ada ijin pending.</td></tr>');
          return;
        }

        const rowsHtml = ijinRows.map((row, i) => {
          const nama = (row.user && row.user.nama_lengkap) || '-';
          const jenis = (row.jenisIjin && row.jenisIjin.nama) || '-';
          const tglIjin = row.tanggal_awal === row.tanggal_akhir
            ? formatDateShort(row.tanggal_awal)
            : `${formatDateShort(row.tanggal_awal)} s/d ${formatDateShort(row.tanggal_akhir)}`;
          const hariTunggu = row.hari_tunggu != null ? row.hari_tunggu : 0;
          const warnCls = row.is_finance_overdue ? 'text-danger font-bold' : (hariTunggu >= 2 ? 'text-warning font-bold' : '');
          const aksi = row.status === 'pending'
            ? `<button data-idx="${i}" class="btn-tbl btn-tbl--primary btn-ijin-detail">Detail</button>`
            : '-';

          return `
            <tr>
              <td class="td-center">${i + 1}</td>
              <td class="td-left">${nama}</td>
              <td class="td-center">${tglIjin}</td>
              <td class="td-center">${jenis}</td>
              <td class="td-center ${warnCls}">${hariTunggu} hari</td>
              <td class="td-center">${badgeStatus(row.status)}</td>
              <td class="td-center">${aksi}</td>
            </tr>
          `;
        }).join('');

        jQuery('#ij_table_body').html(rowsHtml);
      },
      error() {
        jQuery('#ij_table_body').html('<tr><td colspan="7" class="tbl-empty">Gagal menghubungi server.</td></tr>');
      },
    });
  }

  jQuery('#ij_table_body').on('click', '.btn-ijin-detail', function () {
    const row = ijinRows[jQuery(this).data('idx')];
    if (row) openIjinDetail(row);
  });

  function openIjinDetail(row) {
    const nama = (row.user && row.user.nama_lengkap) || '-';
    const jenis = (row.jenisIjin && row.jenisIjin.nama) || '-';
    const tglIjin = row.tanggal_awal === row.tanggal_akhir
      ? formatDateShort(row.tanggal_awal)
      : `${formatDateShort(row.tanggal_awal)} s/d ${formatDateShort(row.tanggal_akhir)}`;
    const dokUrl = !isEmpty(row.dokumen_path) ? IMG_IJIN + '/' + row.dokumen_path : null;
    const mendesakInfo = row.is_mendesak
      ? infoRow('Mendesak', row.alasan_mendesak || 'Ya', 'text-warning')
      : '';

    const html = `
      ${dokUrl ? `
        <div class="text-center">
          <img data-zoom-src="${dokUrl}" src="${dokUrl}" class="max-h-56 inline-block rounded cursor-zoom-in img-zoom-ij" />
        </div>
      ` : ''}
      <div class="card-surface p-3">
        ${infoRow('Nama', nama)}
        ${infoRow('Tgl Ijin', tglIjin)}
        ${infoRow('Jenis', jenis)}
        ${infoBlock('Alasan', row.alasan || '-')}
        ${mendesakInfo}
        ${infoRow('Diajukan', formatDateShort(row.created_at))}
        ${infoRow('Hari Tunggu', `${row.hari_tunggu || 0} hari`, row.is_finance_overdue ? 'text-danger' : '')}
      </div>
      <div class="pt-1">
        <button data-act="konfirmasi" class="btn-action btn-action--success w-full">Konfirmasi</button>
      </div>
    `;

    jQuery('#ij_body').html(html);
    jQuery('#ij_body .btn-action').data('id-ijin', row.id);
    app.popup.open('#popup-detail-ijin');
  }

  jQuery('#ij_body').on('click', '.img-zoom-ij', function () {
    app.photoBrowser.create({ photos: [jQuery(this).data('zoom-src')] }).open();
  });

  jQuery('#ij_body').on('click', 'button[data-act="konfirmasi"]', function () {
    konfirmasiIjin(jQuery(this).data('id-ijin'));
  });

  // Tombol di sini BUKAN approve/reject (admin app ini bukan pemegang
  // wewenang menyetujui/menolak ijin -- itu wewenang HRD/Manajer di
  // dashboard/app lain) -- cuma konfirmasi "sudah diketahui admin". Secara
  // teknis TETAP mengirim status='disetujui' ke update-validasi (disepakati
  // dgn user 2026-08-26) krn backend saat ini tidak punya status/field
  // terpisah utk "sudah dibaca" tanpa mengubah status ijinnya -- itu
  // satu2nya cara ijin keluar dari daftar pending di tab ini sekarang.
  function konfirmasiIjin(idIjin) {
    app.dialog.confirm('Konfirmasi bahwa Anda telah mengetahui pengajuan ijin ini?', () => {
      jQuery.ajax({
        type: 'POST',
        url: APP_CONFIG.API_BASE_URL + '/hrm/ijin/update-validasi',
        dataType: 'JSON',
        data: {
          id_ijin: idIjin,
          status: 'disetujui',
          validated_by: localStorage.getItem('user_id'),
        },
        beforeSend() {
          app.dialog.preloader('Menyimpan...');
        },
        success(data) {
          app.dialog.close();
          if (data.status === 'success') {
            app.popup.close('#popup-detail-ijin');
            app.dialog.alert('Ijin telah dikonfirmasi diketahui ✅');
            loadDataValidIjin();
          } else {
            app.dialog.alert(data.message || 'Gagal mengonfirmasi ijin', 'Error');
          }
        },
        error() {
          app.dialog.close();
          app.dialog.alert('Gagal menghubungi server.', 'Error');
        },
      });
    });
  }

  loadDataValidIjin();

  return function unmount() { };
}
