// Absen -- Validasi Absensi. Porting dari admin-finance-apk/www/js/absen.js
// (bagian tab Validasi SAJA: btnShowValid/getDataValid/hitungBarisValidasi/
// getDetailDataValid/simpanValid) + absensi.html. Tab "Gaji"
// (getDataKaryawan/klaim gaji/dst) SENGAJA TIDAK diporting -- sudah
// diputuskan dibuang total (lihat README.md "Sengaja dibuang").
// Filter "Posisi" (Semua/Produksi/Staff) DIPERTAHANKAN krn terbukti (lihat
// reloadTabAbsenAktif() di absen.js asli) ikut mem-filter tab Validasi juga,
// bukan cuma tab Gaji yang dibuang. Opsi "IT" ikut disembunyikan sama seperti
// aslinya (lihat komentar filter posisi di absensi.html lama).
//
// [SPLIT 2026-08-26 atas permintaan user, "jadikan 2 tab saja Absen dan
// Ijin"] Sebelumnya halaman /absen menggabung Validasi Absensi + Validasi
// Ijin dalam SATU halaman (satu file absen.js). Dipecah jadi 2 PageModule
// terpisah (/absen/validasi ini + pages/absen/ijin.js), didaftarkan sbg
// sub-tab grup "Absen" di lib/shell.js -- pola sama persis dgn grup
// Point/Finance (bukan konsep baru). Ijin ijin.js utk section Validasi Ijin
// (kontrak backend terbaru, lihat catatan di file itu).
//
// [CATATAN] gaji_per_jam & durasi_lembur di popup detail utk entri LEMBUR
// SELALU '-' bahkan di admin-finance-apk asli -- getDetailDataValid() di
// sana dipanggil dgn 2 argumen itu SELALU string kosong ('') dari
// hitungBarisValidasi() (lihat onclick btnHtml), jadi field ini memang belum
// pernah benar2 terisi di app lama manapun. Bukan regresi di sini, sengaja
// dibiarkan '-' juga.

import tpl from './validasi.html?raw';
import { APP_CONFIG } from '../../lib/config.js';
import { numberFormat, formatDateShort } from '../../lib/format.js';
import { showAuthedShell } from '../../lib/shell.js';

const IMAGE_BASE = APP_CONFIG.IMAGE_BASE_URL;
const IMG_ABSEN = IMAGE_BASE + '/absen';
const IMG_SELFIE = IMAGE_BASE + '/public_selfie';
const NOIMAGE_ABSEN = IMG_ABSEN + '/noimage.jpg';
const NOIMAGE_SELFIE = IMG_SELFIE + '/noimage.jpg';

function isEmpty(v) {
  return v == null || v === 'null' || v === '';
}

export function mount(container) {
  container.innerHTML = tpl;
  showAuthedShell('/absen/validasi');

  let searchTimeout = null;
  let rowsData = []; // lookup dari data-idx tombol Detail/Lembur -> {val, hasil}

  // Konteks entri presensi yang sedang dibuka di popup detail -- dibaca oleh
  // simpanValid() saat tombol Valid/Tolak ditekan (pengganti localStorage
  // absensi_id/user_id_disiplin/karyawan_nama di app lama).
  let currentAbsensiId = null;
  let currentUserId = null;
  let currentKaryawanNama = null;

  const $search = jQuery('#av_search');
  const $posisi = jQuery('#av_posisi');

  $search.on('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadDataValid, 700);
  });
  $posisi.on('change', loadDataValid);
  jQuery('#av_refresh').on('click', loadDataValid);

  // Porting hitungBarisValidasi() -- hitung nominal turunan (gaji/lembur/
  // potongan/tunjangan/total) dari satu baris presensi. Backend
  // (PresensiController::getDataAbsenValid) sudah menghitung ulang tiap
  // baris pakai hitungGajiPerRow() yang sama dgn tab Gaji lama & mengirim
  // hasilnya sbg *_calc -- FE di sini cuma membaca, tidak menghitung ulang.
  function hitungBaris(val) {
    const isLembur = val.flag_absensi === 'lembur';
    const adaJamKeluar = !isEmpty(val.jam_masuk) && !isEmpty(val.jam_keluar);
    const isBorongan = val.status === 'borongan';

    let gajiPokok = 0;
    let lembur = 0;
    let tunjangan = 0;
    let potongan = 0;
    let total = 0;
    let lmbr1Detail = 0;
    let lmbr2 = 0;

    if (adaJamKeluar) {
      if (isBorongan) {
        gajiPokok = parseFloat(val.gaji_borongan || 0);
        total = gajiPokok;
      } else if (isLembur) {
        lembur = parseFloat(val.lembur_calc || 0);
        lmbr1Detail = parseFloat(val.lembur_1_calc || lembur);
        lmbr2 = parseFloat(val.lembur_2_calc || 0);
        total = lembur;
      } else {
        gajiPokok = parseFloat(val.gaji_pokok_calc || 0);
        lembur = parseFloat(val.lembur_calc || 0);
        lmbr1Detail = parseFloat(val.lembur_1_calc || lembur);
        lmbr2 = parseFloat(val.lembur_2_calc || 0);
        tunjangan = parseFloat(val.tunjangan_calc || 0);
        potongan = parseFloat(val.potongan_calc || 0);
        total = parseFloat(val.total_calc || 0);
      }
    }

    let statusTerlambat = val.status_terlambat_text || '';
    if (!adaJamKeluar) statusTerlambat = 'Belum Valid';
    else if (isLembur) statusTerlambat = 'Lembur';

    return {
      is_lembur: isLembur,
      ada_jam_keluar: adaJamKeluar,
      gaji_pokok: gajiPokok,
      lembur,
      tunjangan,
      potongan_nominal: potongan,
      total,
      status_terlambat: statusTerlambat,
      lmbr1_detail: lmbr1Detail,
      lmbr2,
    };
  }

  function btnOpsi(idx, label, enabled) {
    const cls = enabled ? 'btn-tbl--muted' : 'btn-tbl--danger';
    return `<button data-idx="${idx}" class="btn-tbl ${cls} btn-presensi-detail" style="width:64px;flex:0 0 64px;">${label}</button>`;
  }

  // Tombol aksi cepat "Izin" (Ijin Setengah Hari) langsung dari kolom Opsi --
  // porting/perluasan dari checkbox "Ijin Setengah Hari" yang tadinya ada di
  // dalam popup Detail (dipindah ke sini atas permintaan user 2026-08-26,
  // "taruh jadi button di opsi saja"). Beda dari checkbox lama: tombol ini
  // langsung memicu simpan-valid (is_valid=1, is_setengah_hari=1) tanpa perlu
  // buka popup Detail dulu.
  function btnIzin(idx) {
    return `<button data-idx="${idx}" class="btn-tbl btn-tbl--warning btn-izin-setengah-hari" style="width:56px;flex:0 0 56px;">Izin</button>`;
  }

  function loadDataValid() {
    const karyawanNama = $search.val() ? $search.val().trim() : 'empty';

    jQuery.ajax({
      type: 'POST',
      url: APP_CONFIG.API_BASE_URL + '/hrm/presensi/valid',
      dataType: 'JSON',
      data: {
        posisi: $posisi.val(),
        karyawan_nama: karyawanNama || 'empty',
      },
      beforeSend() {
        jQuery('#av_table_body').html('<tr><td colspan="9" class="tbl-empty">Memuat data...</td></tr>');
      },
      success(data) {
        if (data.status !== 'success') {
          jQuery('#av_table_body').html(`<tr><td colspan="9" class="tbl-empty">Gagal memuat data. ${data.message || 'Silakan coba lagi.'}</td></tr>`);
          jQuery('#av_count').text('0');
          return;
        }

        // Porting filter `localStorage.getItem("lokasi_pabrik") ==
        // val.lokasi_pabrik` -- backend TIDAK menyaring baris per pabrik
        // sendiri di endpoint ini, filter dilakukan di FE (lihat komentar
        // FIX 2026-08-03 di getDataAbsenValid() backend, pola yg sama
        // dipakai PayrollController/SpController).
        const lokasiPabrik = localStorage.getItem('lokasi_pabrik');
        const rows = (data.data || []).filter((v) => v.lokasi_pabrik == lokasiPabrik);

        if (!rows.length) {
          jQuery('#av_table_body').html('<tr><td colspan="9" class="tbl-empty">Tidak ada data.</td></tr>');
          jQuery('#av_count').text('0');
          return;
        }

        // Pre-pass: kelompokkan per user+tanggal, supaya entri LEMBUR yang
        // punya pasangan entri normal di hari yang sama digabung jadi 1
        // baris (tombol Detail & Lembur berdampingan).
        const lemburLookup = {};
        const normalKeys = {};
        rows.forEach((v) => {
          const key = v.user_id + '_' + v.tanggal_absen;
          if (v.flag_absensi === 'lembur') lemburLookup[key] = v;
          else normalKeys[key] = true;
        });

        rowsData = [];
        let no = 0;
        let calcTotal = 0;
        const bodyRows = [];

        rows.forEach((val) => {
          const key = val.user_id + '_' + val.tanggal_absen;
          const isLemburEntry = val.flag_absensi === 'lembur';

          // Entri lembur yang PUNYA pasangan normal hari yang sama -- jangan
          // dirender sbg baris sendiri, cuma kontribusi tombol "Lembur" +
          // total ke baris normal-nya (di bawah).
          if (isLemburEntry && normalKeys[key]) {
            const hasilSkip = hitungBaris(val);
            if (hasilSkip.ada_jam_keluar) calcTotal += hasilSkip.total;
            return;
          }

          no++;
          const hasil = hitungBaris(val);
          const lemburPasangan = lemburLookup[key];
          let hasilLembur = null;
          let lemburDisplay = hasil.lembur;
          if (lemburPasangan && !isLemburEntry) {
            hasilLembur = hitungBaris(lemburPasangan);
            lemburDisplay = hasilLembur.total;
          }

          const idx = rowsData.push({ val, hasil }) - 1;

          let opsi = '';
          if (!isLemburEntry) {
            // Tombol Detail/Lembur tetap butuh jam_keluar terisi (popup detail
            // menampilkan foto+lokasi keluar), tapi tombol Izin HARUS tetap
            // muncul walau belum checkout -- baris presensi hari ini (lihat
            // OR tanggal_absen=hari-ini di backend getDataAbsenValid()) justru
            // dikirim FE supaya karyawan yg baru presensi masuk & mau ambil
            // Ijin Setengah Hari bisa langsung ditandai di sini tanpa nunggu
            // dia checkout dulu.
            if (!isEmpty(val.jam_keluar)) {
              opsi += btnOpsi(idx, hasil.is_lembur ? 'Lembur' : 'Detail', hasil.ada_jam_keluar);
            }
            opsi += btnIzin(idx);
          }
          if (lemburPasangan && !isLemburEntry && !isEmpty(lemburPasangan.jam_keluar)) {
            const idxLembur = rowsData.push({ val: lemburPasangan, hasil: hasilLembur }) - 1;
            opsi += btnOpsi(idxLembur, 'Lembur', hasilLembur.ada_jam_keluar);
          } else if (isLemburEntry && !isEmpty(val.jam_keluar)) {
            opsi += btnOpsi(idx, 'Lembur', hasil.ada_jam_keluar);
          }

          const rowStyle = hasil.is_lembur ? 'style="background:#fff8dc;"' : '';
          const lemburCls = lemburDisplay > 0 ? 'font-bold text-warning' : '';

          bodyRows.push(`
            <tr ${rowStyle}>
              <td class="td-center">${no}</td>
              <td class="td-center">${formatDateShort(val.tanggal_absen)}</td>
              <td class="td-left">${val.karyawan_nama}</td>
              <td class="td-center">${numberFormat(hasil.is_lembur ? 0 : hasil.gaji_pokok)}</td>
              <td class="td-center ${lemburCls}">${numberFormat(lemburDisplay)}</td>
              <td class="td-center">${numberFormat(hasil.potongan_nominal)}</td>
              <td class="td-center">${numberFormat(hasil.tunjangan)}</td>
              <td class="td-center">${numberFormat(hasil.total)}</td>
              <td class="td-left"><div class="flex gap-1">${opsi}</div></td>
            </tr>
          `);

          if (hasil.ada_jam_keluar) calcTotal += hasil.total;
        });

        bodyRows.push(`
          <tr>
            <td colspan="7"></td>
            <td class="td-center font-bold">${numberFormat(calcTotal)}</td>
            <td></td>
          </tr>
        `);

        jQuery('#av_count').text(String(no));
        jQuery('#av_table_body').html(bodyRows.join(''));
      },
      error() {
        jQuery('#av_table_body').html('<tr><td colspan="9" class="tbl-empty">Gagal menghubungi server. Periksa koneksi internet.</td></tr>');
        jQuery('#av_count').text('0');
      },
    });
  }

  jQuery('#av_table_body').on('click', '.btn-presensi-detail', function () {
    const idx = jQuery(this).data('idx');
    const entry = rowsData[idx];
    if (entry) openPresensiDetail(entry.val, entry.hasil);
  });

  jQuery('#av_table_body').on('click', '.btn-izin-setengah-hari', function () {
    const idx = jQuery(this).data('idx');
    const entry = rowsData[idx];
    if (entry) confirmSetengahHari(entry.val);
  });

  // Aksi cepat "Izin" (kolom Opsi) -- tandai entri sbg Ijin Setengah Hari
  // langsung dari tabel, tanpa perlu buka popup Detail dulu. Konsekuensi
  // (gaji pokok dipotong 50% & tidak dapat uang disiplin Rp50.000/periode)
  // ditampilkan di dialog konfirmasi supaya admin sadar sebelum submit --
  // perhitungan sebenarnya tetap sepenuhnya di backend (hitungGajiPerRow()/
  // logic disiplin), FE di sini cuma mengirim flag is_setengah_hari=1.
  function confirmSetengahHari(val) {
    app.dialog.confirm(
      `⚠️ Tandai ${val.karyawan_nama} untuk Ijin Setengah Hari?`,
      () => {
        jQuery.ajax({
          type: 'POST',
          url: APP_CONFIG.API_BASE_URL + '/hrm/presensi/simpan-valid',
          dataType: 'JSON',
          data: {
            is_valid: 1,
            absensi_id: val.absensi_id,
            user_id: val.user_id,
            karyawan_nama: val.karyawan_nama,
            is_setengah_hari: 1,
          },
          beforeSend() {
            app.dialog.preloader('Harap Tunggu');
          },
          success(data) {
            app.dialog.close();
            if (data.status === 'done') {
              app.dialog.alert('Berhasil ditandai sebagai Ijin Setengah Hari');
              loadDataValid();
            } else if (data.status === 'already_validated' || data.status === 'not_found') {
              app.dialog.alert(data.message || 'Data ini sudah divalidasi sebelumnya.', 'Perhatian');
              loadDataValid();
            } else {
              app.dialog.alert(data.message || 'Gagal memproses.');
            }
          },
          error() {
            app.dialog.close();
            app.dialog.alert('Gagal menghubungi server.', 'Error');
          },
        });
      },
    );
  }

  // Porting getDetailDataValid() -- dibangun ulang dari objek data (bukan
  // ~20 argumen posisi terpisah spt onclick app lama), isi popup sepenuhnya
  // dirender dinamis (bukan toggle show/hide banyak id baris) supaya beda
  // struktur Normal vs Lembur lebih gampang dijaga.
  function openPresensiDetail(val, hasil) {
    currentAbsensiId = val.absensi_id;
    currentUserId = val.user_id;
    currentKaryawanNama = val.karyawan_nama;

    jQuery('#dp_nama').text(val.karyawan_nama || '');
    jQuery('#dp_body').html(buildPresensiDetailHtml(val, hasil));
    jQuery('#popup-detail-presensi button[data-act="valid"], #popup-detail-presensi button[data-act="tolak"]')
      .prop('disabled', false).css('opacity', '1');

    app.popup.open('#popup-detail-presensi');
  }

  function mapFrame(lat, lng) {
    if (isEmpty(lat) || isEmpty(lng)) {
      return '<div class="text-xs text-ink-muted flex items-center justify-center h-full">Lokasi Tidak Ada</div>';
    }
    return `<iframe class="w-full h-full border-0" src="https://maps.google.com/maps?q=${lat},${lng}&hl=id&z=14&output=embed"></iframe>`;
  }

  function infoRow(label, value, valueCls = '') {
    return `
      <div class="flex justify-between py-1 border-b border-ink-faint text-xs">
        <span class="text-ink-secondary">${label}</span>
        <span class="font-semibold ${valueCls}">${value}</span>
      </div>
    `;
  }

  function buildPresensiDetailHtml(val, hasil) {
    const isLembur = hasil.is_lembur;
    const fotoSelfie = !isEmpty(val.foto_karyawan) ? IMG_SELFIE + '/' + val.foto_karyawan : NOIMAGE_SELFIE;
    const fotoMasuk = !isEmpty(val.foto_masuk) ? IMG_ABSEN + '/' + val.foto_masuk : NOIMAGE_ABSEN;
    const fotoKeluar = !isEmpty(val.foto_keluar) ? IMG_ABSEN + '/' + val.foto_keluar : NOIMAGE_ABSEN;
    const fotoIstirahat = !isEmpty(val.foto_rest_masuk) ? IMG_ABSEN + '/' + val.foto_rest_masuk : NOIMAGE_ABSEN;

    const gridCols = isLembur ? 'grid-cols-2' : 'grid-cols-3';
    const istirahatCol = !isLembur ? `
      <div class="py-1.5 border-r border-ink-faint">Istirahat</div>
    ` : '';
    const istirahatImgCol = !isLembur ? `
      <div class="p-1.5 border-r border-ink-faint text-center">
        <img data-zoom-src="${fotoIstirahat}" src="${fotoIstirahat}" class="w-full rounded cursor-zoom-in img-zoom-dp" />
      </div>
    ` : '';
    const istirahatMapCol = !isLembur ? `
      <div class="py-1.5 border-r border-ink-faint">Lokasi Istirahat</div>
    ` : '';
    const istirahatMapFrame = !isLembur ? `
      <div class="border-r border-ink-faint">${mapFrame(val.lat_rest_masuk, val.long_rest_masuk)}</div>
    ` : '';

    let infoRows = '';
    infoRows += infoRow('Tanggal Masuk', formatDateShort(val.tanggal_absen));
    infoRows += infoRow('Tanggal Keluar', formatDateShort(val.tanggal_absen_keluar || val.tanggal_absen));
    infoRows += infoRow('Jam Masuk', !isEmpty(val.jam_masuk) ? val.jam_masuk : 'Belum Absen', isEmpty(val.jam_masuk) ? 'text-danger' : '');
    if (!isLembur) {
      infoRows += infoRow('Istirahat Masuk', !isEmpty(val.jam_istirahat_masuk) ? val.jam_istirahat_masuk : '-');
    }
    infoRows += infoRow('Jam Keluar', !isEmpty(val.jam_keluar) ? val.jam_keluar : 'Belum Absen', isEmpty(val.jam_keluar) ? 'text-danger' : '');
    infoRows += infoRow('Tipe', isLembur ? 'Lembur' : 'Normal');

    if (isLembur) {
      infoRows += infoRow('Gaji/Jam', '-');
      infoRows += infoRow('Durasi Lembur', '-');
    } else {
      infoRows += infoRow('Gaji', numberFormat(hasil.gaji_pokok));
      const potCls = hasil.status_terlambat === 'Terlambat' || hasil.status_terlambat === 'Di Tolak' ? 'text-danger' : '';
      infoRows += infoRow('Potongan', numberFormat(hasil.potongan_nominal), potCls);
      infoRows += infoRow('Tunjangan', numberFormat(hasil.tunjangan));
    }
    infoRows += infoRow('TOTAL', numberFormat(hasil.total), 'font-bold');
    if (!isLembur) {
      const statusCls = hasil.status_terlambat === 'Terlambat' || hasil.status_terlambat === 'Di Tolak'
        ? 'text-danger'
        : hasil.status_terlambat === 'Valid' ? 'text-success' : '';
      infoRows += infoRow('Status', hasil.status_terlambat, statusCls);
    }

    return `
      <div class="card-surface overflow-hidden">
        <div class="bg-surface-raised text-center text-xs font-bold text-ink-secondary py-1.5">Foto Selfie</div>
        <div class="p-2 text-center">
          <img data-zoom-src="${fotoSelfie}" src="${fotoSelfie}" class="max-h-40 inline-block rounded cursor-zoom-in img-zoom-dp" />
        </div>
      </div>
      <div class="card-surface overflow-hidden">
        <div class="grid ${gridCols} text-center text-[11px] font-bold text-ink-secondary border-b border-ink-faint">
          <div class="py-1.5 border-r border-ink-faint">Masuk</div>
          ${istirahatCol}
          <div class="py-1.5">Keluar</div>
        </div>
        <div class="grid ${gridCols}">
          <div class="p-1.5 border-r border-ink-faint text-center">
            <img data-zoom-src="${fotoMasuk}" src="${fotoMasuk}" class="w-full rounded cursor-zoom-in img-zoom-dp" />
          </div>
          ${istirahatImgCol}
          <div class="p-1.5 text-center">
            <img data-zoom-src="${fotoKeluar}" src="${fotoKeluar}" class="w-full rounded cursor-zoom-in img-zoom-dp" />
          </div>
        </div>
        <div class="grid ${gridCols} text-center text-[11px] font-bold text-ink-secondary border-t border-b border-ink-faint">
          <div class="py-1.5 border-r border-ink-faint">Lokasi Masuk</div>
          ${istirahatMapCol}
          <div class="py-1.5">Lokasi Keluar</div>
        </div>
        <div class="grid ${gridCols}" style="height:120px;">
          <div class="border-r border-ink-faint">${mapFrame(val.lat_masuk, val.long_masuk)}</div>
          ${istirahatMapFrame}
          <div>${mapFrame(val.lat_keluar, val.long_keluar)}</div>
        </div>
      </div>
      <div class="card-surface p-3">
        ${infoRows}
      </div>
      <div class="flex gap-2 pt-1">
        <button data-act="valid" class="btn-action btn-action--success flex-1">Valid</button>
        <button data-act="tolak" class="btn-action btn-action--danger flex-1">Tolak</button>
      </div>
    `;
  }

  jQuery('#dp_body').on('click', '.img-zoom-dp', function () {
    app.photoBrowser.create({ photos: [jQuery(this).data('zoom-src')] }).open();
  });

  jQuery('#dp_body').on('click', 'button[data-act="valid"]', () => simpanValid(1));
  jQuery('#dp_body').on('click', 'button[data-act="tolak"]', () => simpanValid(2));

  // Porting simpanValid() -- termasuk guard already_validated/not_found dari
  // backend & disable tombol Valid/Tolak selama request berjalan (cegah
  // double-tap memicu 2 request menyusul). Checkbox "Ijin Setengah Hari" yang
  // tadinya ada di sini SUDAH DIPINDAH jadi tombol "Izin" sendiri di kolom
  // Opsi (lihat confirmSetengahHari() di atas) -- Valid/Tolak di popup ini
  // sekarang SELALU is_setengah_hari=0.
  function simpanValid(validValue) {
    const labelValid = validValue === 1 ? 'Validasi' : 'Tolak';
    const confirmMsg = `Yakin ${labelValid} Absensi ini?`;

    app.dialog.confirm(confirmMsg, () => {
      const $btns = jQuery('#dp_body button[data-act="valid"], #dp_body button[data-act="tolak"]');
      $btns.prop('disabled', true).css('opacity', '0.5');

      jQuery.ajax({
        type: 'POST',
        url: APP_CONFIG.API_BASE_URL + '/hrm/presensi/simpan-valid',
        dataType: 'JSON',
        data: {
          is_valid: validValue,
          absensi_id: currentAbsensiId,
          user_id: currentUserId,
          karyawan_nama: currentKaryawanNama,
          is_setengah_hari: 0,
        },
        beforeSend() {
          app.dialog.preloader('Harap Tunggu');
        },
        success(data) {
          app.dialog.close();
          if (data.status === 'done') {
            app.dialog.alert('Berhasil Validasi Absensi');
            app.popup.close('#popup-detail-presensi');
            loadDataValid();
          } else if (data.status === 'already_validated' || data.status === 'not_found') {
            app.dialog.alert(data.message || 'Data ini sudah divalidasi sebelumnya.', 'Perhatian');
            app.popup.close('#popup-detail-presensi');
            loadDataValid();
          } else {
            app.dialog.alert(data.message || 'Gagal Validasi Absensi');
            $btns.prop('disabled', false).css('opacity', '1');
          }
        },
        error() {
          app.dialog.close();
          app.dialog.alert('Gagal menghubungi server.', 'Error');
          $btns.prop('disabled', false).css('opacity', '1');
        },
      });
    });
  }

  loadDataValid();

  return function unmount() {
    if (searchTimeout) clearTimeout(searchTimeout);
  };
}
