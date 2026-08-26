// Finance -- Payable. Porting dari admin-finance-apk (tab "Payable" DI DALAM
// data_transaksi.html, driven by www/js/data.js -- BUKAN "Kas Payable"
// id_kas_acc=9 dari checkKasMinimum() spt yg sempat diduga sebelumnya. User
// mengonfirmasi 2026-08-26: "Finance>Payable" = tab Payable itu, isinya
// Saldo + filter Kas/Bulan/Tahun + tabel transaksi (No/Tanggal/Kategori/
// Keterangan/Nominal/Admin), porting `getDataTransaksi()`/`comboKasFilter()`/
// `getBulanTransaksi()`/`getYearTransaksi()`.
//
// SCOPE PASS INI (disepakati dgn user): data inti READ-ONLY -- saldo, filter
// Kas/Bulan/Tahun, tabel transaksi. Edit/Delete/Valid transaksi (termasuk
// transfer antar kas, custom dropdown tipe transaksi berwarna) TETAP
// DITUNDA -- fitur itu jauh lebih besar & belum disepakati detail scope-nya.
//
// [UPDATE 2026-08-26 atas permintaan user] Satu potongan kecil dari
// `openTambahPopup()`/`simpanTransaksi()` asli SUDAH diporting: tombol
// **"Upload Bukti Transfer/Nota"**, HANYA muncul saat filter Kas sedang di
// "Kas Kecil" (dideteksi dari teks label kas terpilih mengandung "kecil",
// BUKAN id_kas_acc hardcode -- lihat toggleUploadBuktiButton()). Form
// disederhanakan (disepakati dgn user) jadi: Kategori (scoped ke kas
// terpilih via `/get-kategori-acc`) + Nominal + Keterangan + foto (file
// input biasa, BUKAN kamera Cordova) -- TANPA tipe transaksi Payment/
// Operasional (di-hardcode 'Operasional'), TANPA data perusahaan/ekspedisi,
// TANPA transfer antar-kas eksplisit (endpoint `tambahTransaksiAcc` yg
// menentukan kas Debet/Kredit-nya sendiri dari kategori yg dipilih, lihat
// catatan di submitUploadBukti()).
//
// [TEMUAN 2026-08-26, lihat riwayat git utk detail lengkap] Endpoint yang
// dipakai fitur ini (`/get-kas-acc`, `/get-transaksi-acc-with-kas-transfer`,
// `/get-transaksi-kas-acc`, `/get-data-amount-kas`) di routes/api.php
// backend-production SEMUA menunjuk ke namespace `API\Accounting\*`
// (KasController/TransaksiOperasionalController/TransaksiKasController)
// yang TIDAK ADA di checkout backend-production ini (tidak ada folder
// `Accounting` di `app/Http/Controllers/API/`) -- implementasi nyata
// method2 itu ada di controller FLAT `AccountingController.php`/
// `NewAccountingController.php` yang TIDAK dirouting sama sekali.
// Kemungkinan penyebab: rencana refactor pemecahan `AccountingController`
// (`operasional-apk/docs/superpowers/plans/
// 2026-05-29-refactor-accounting-controller.md`) yang dikerjakan di
// checkout staging terpisah (via FTP), belum tentu pernah disatukan balik
// ke repo backend-production ini -- TIDAK BISA dipastikan dari checkout
// lokal apakah endpoint ini live di server atau belum.
//
// API DISAMBUNGKAN atas permintaan eksplisit user (2026-08-26) MESKI status
// backend di atas belum terkonfirmasi -- kalau ternyata endpoint ini belum
// live, halaman akan gagal (lihat error handler tiap fungsi ajax, semua
// sudah punya pesan "Gagal menghubungi server" & tidak membiarkan UI diam
// tanpa feedback). Kalau nanti terbukti bermasalah, cek temuan di atas dulu
// sebelum menganggap ini bug porting.

import tpl from './payable.html?raw';
import { APP_CONFIG } from '../../lib/config.js';
import { numberFormat } from '../../lib/format.js';
import { showAuthedShell } from '../../lib/shell.js';

export function mount(container) {
  container.innerHTML = tpl;
  showAuthedShell('/finance/payable');

  const $bulan = jQuery('#payable_filter_bulan');
  const $tahun = jQuery('#payable_filter_tahun');
  const $kas = jQuery('#payable_filter_kas');

  // Porting getBulanTransaksi()/getYearTransaksi() -- murni generate opsi di
  // FE, TIDAK butuh API, jadi tetap dijalankan meski BACKEND_CONFIRMED=false.
  const BULAN_NAMA = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const nowMonth = new Date().getMonth();
  BULAN_NAMA.forEach((nama, i) => {
    $bulan.append(jQuery('<option>').val(i + 1).text(nama).prop('selected', i === nowMonth));
  });

  const endYear = new Date().getFullYear();
  for (let y = endYear; y > 2010; y--) {
    $tahun.append(jQuery('<option>').val(y).text(y).prop('selected', y === endYear));
  }

  jQuery('#payable_refresh').on('click', () => {
    loadSaldoDanKas();
    loadDataTransaksi();
  });

  $kas.on('change', () => {
    toggleUploadBuktiButton();
    loadDataTransaksi();
  });
  $bulan.on('change', loadDataTransaksi);
  $tahun.on('change', loadDataTransaksi);

  // Tombol "Upload Bukti Transfer/Nota" HANYA relevan utk Kas Kecil (atas
  // permintaan user) -- dideteksi dari teks label opsi yg sedang terpilih
  // mengandung "kecil" (case-insensitive), BUKAN id_kas_acc hardcode (id
  // pastinya bisa beda per lingkungan/kapan saja ditambah kas baru).
  function toggleUploadBuktiButton() {
    const label = $kas.find('option:selected').text() || '';
    jQuery('#payable_btn_upload_bukti').toggleClass('hidden', !/kecil/i.test(label));
  }

  // Porting comboKasFilter() -- isi dropdown #payable_filter_kas dari
  // /get-kas-acc, pre-select localStorage('primary_kas').
  function loadKasOptions() {
    jQuery.ajax({
      type: 'POST',
      url: APP_CONFIG.API_BASE_URL + '/get-kas-acc',
      dataType: 'JSON',
      data: { user_id: localStorage.getItem('user_id') },
      success(data) {
        const rows = data.data || [];
        const primaryKas = localStorage.getItem('primary_kas');
        $kas.html(rows.map((item) =>
          `<option value="${item.id_kas_acc}" ${String(item.id_kas_acc) === String(primaryKas) ? 'selected' : ''}>${item.kas_acc}</option>`,
        ).join(''));
        toggleUploadBuktiButton();
      },
      error() {
        $kas.html('<option value="">Gagal memuat daftar kas</option>');
        toggleUploadBuktiButton();
      },
    });
  }

  // Porting bagian LIVE dari getDataTransaksiKas() (data_kas.js asli) yang
  // dipanggil app.js saat page:afterin data-transaksi -- SATU-SATUNYA baris
  // yang bukan dead/commented code di fungsi itu cuma set #kecil_value_kas
  // dari field `kas_kecil`, TIDAK PERNAH mengikuti filter_kas yang sedang
  // dipilih (kuirk asli, diporting apa adanya -- bukan dibetulkan di sini).
  function loadSaldoDanKas() {
    loadKasOptions();
    jQuery.ajax({
      type: 'POST',
      url: APP_CONFIG.API_BASE_URL + '/get-transaksi-kas-acc',
      dataType: 'JSON',
      data: {
        user_id: localStorage.getItem('user_id'),
        kas_out: localStorage.getItem('primary_kas'),
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        lokasi_pabrik: localStorage.getItem('lokasi_pabrik'),
      },
      success(data) {
        const saldo = parseFloat(data.kas_kecil || 0);
        // Atas permintaan user: Saldo biru kalau plus, merah kalau minus.
        jQuery('#payable_saldo')
          .text('Rp ' + numberFormat(saldo))
          .toggleClass('text-primary', saldo >= 0)
          .toggleClass('text-danger', saldo < 0);
      },
      error() {
        jQuery('#payable_saldo').text('-');
      },
    });
  }

  // Porting getDataTransaksi() -- versi READ-ONLY: kolom Opsi (Detail/Edit/
  // Delete/Valid/Bayar cicilan) & seluruh logic warna baris/reminder/cicilan
  // DIBUANG sesuai scope pass ini (lihat catatan atas file), Nominal
  // ditampilkan APA ADANYA dari `nominal_acc` (bukan hasil hitungan sisa
  // cicilan spt aslinya -- tidak relevan tanpa fitur Bayar).
  function loadDataTransaksi() {
    jQuery.ajax({
      type: 'POST',
      url: APP_CONFIG.API_BASE_URL + '/get-transaksi-acc-with-kas-transfer',
      dataType: 'JSON',
      data: {
        user_id: localStorage.getItem('user_id'),
        kas: $kas.val() || localStorage.getItem('primary_kas'),
        month: $bulan.val(),
        year: $tahun.val(),
        id_transaksi: 'empty',
        lokasi_pabrik: localStorage.getItem('lokasi_pabrik'),
      },
      beforeSend() {
        jQuery('#payable_table_body').html('<tr><td colspan="6" class="tbl-empty">Memuat data...</td></tr>');
      },
      success(data) {
        const rows = data.data || [];
        jQuery('#payable_count').text(String(rows.length));

        if (!rows.length) {
          jQuery('#payable_table_body').html('<tr><td colspan="6" class="tbl-empty">Tidak Ada Data.</td></tr>');
          setTotalCards(0, 0);
          return;
        }

        // Kartu Debet/Kredit/Total (ditambahkan 2026-08-26 atas permintaan
        // user) -- dikelompokkan per `type_acc` ('Debet'/'Kredit'), BUKAN
        // porting apa adanya dari akumulasi nominal_debet/nominal_kredit di
        // getDataTransaksi() asli (nama variabel itu MENYESATKAN -- di
        // aslinya keduanya menjumlah SEMUA baris tanpa syarat type_acc sama
        // sekali, jadi tidak benar2 memisahkan Debet vs Kredit). Total
        // Keseluruhan = Debet - Kredit (konvensi akuntansi standar).
        let totalDebet = 0;
        let totalKredit = 0;

        const bodyHtml = rows.map((val, i) => {
          const nominal = parseFloat(val.nominal_acc || 0);
          const isDebet = val.type_acc === 'Debet';
          if (isDebet) totalDebet += nominal;
          else totalKredit += nominal;

          // Tanda baris Debet -- biru muda, atas permintaan user.
          const rowCls = isDebet ? 'bg-blue-50' : '';

          return `
            <tr class="${rowCls}">
              <td class="td-center">${i + 1}</td>
              <td class="td-center">${formatTanggalTransaksi(val.tanggal_transaksi)}</td>
              <td class="td-left">${val.kategori_acc || '-'}</td>
              <td class="td-left">${val.keterangan || '-'}</td>
              <td class="td-center">${numberFormat(val.nominal_acc)}</td>
              <td class="td-center">${numberFormat(val.admin_acc)}</td>
            </tr>
          `;
        }).join('');

        jQuery('#payable_table_body').html(bodyHtml);
        setTotalCards(totalDebet, totalKredit);
      },
      error() {
        jQuery('#payable_table_body').html('<tr><td colspan="6" class="tbl-empty">Gagal menghubungi server.</td></tr>');
        jQuery('#payable_count').text('0');
        setTotalCards(0, 0);
      },
    });
  }

  function setTotalCards(totalDebet, totalKredit) {
    const totalKeseluruhan = totalDebet - totalKredit;
    jQuery('#payable_total_debet').text(numberFormat(totalDebet));
    jQuery('#payable_total_kredit').text(numberFormat(totalKredit));
    // Atas permintaan user: tanpa tanda "+" kalau lebih (hijau), tanda "-"
    // kalau kurang (merah) -- numberFormat() sendiri sudah tidak pernah
    // menambah "+" & otomatis menyertakan "-" utk angka negatif, jadi
    // tinggal toggle warnanya di sini.
    jQuery('#payable_total_keseluruhan')
      .text(numberFormat(totalKeseluruhan))
      .toggleClass('text-success', totalKeseluruhan >= 0)
      .toggleClass('text-danger', totalKeseluruhan < 0);
  }

  function formatTanggalTransaksi(dateInput) {
    if (!dateInput) return '-';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${String(d.getDate()).padStart(2, '0')}-${BULAN_SINGKAT[d.getMonth()]}-${d.getFullYear()}`;
  }

  // ===========================================================
  // Upload Bukti Transfer/Nota (Kas Kecil) -- lihat catatan scope di atas
  // file. Porting/penyederhanaan dari openTambahPopup()/simpanTransaksi().
  // ===========================================================
  jQuery('#payable_btn_upload_bukti').on('click', openUploadBuktiPopup);

  function openUploadBuktiPopup() {
    jQuery('#pb_kategori').val('');
    jQuery('#pb_nominal').val('');
    jQuery('#pb_keterangan').val('');
    jQuery('#pb_file').val('');
    jQuery('#pb_filename').text('');
    jQuery('#pb_preview_wrap').addClass('hidden');
    jQuery('#pb_btn_submit').prop('disabled', false).css('opacity', '1');

    loadKategoriForKasKecil();
    app.popup.open('#popup-payable-upload-bukti');
  }

  // Porting sebagian comboKategoriTambah() -- kategori di-scope ke kas yang
  // SEDANG dipilih di filter (Kas Kecil), sesuai `getKategoriAcc()` backend
  // yang filter `where('kredit', $request->kas)`.
  function loadKategoriForKasKecil() {
    const $kategori = jQuery('#pb_kategori');
    $kategori.html('<option value="">Memuat kategori...</option>');

    jQuery.ajax({
      type: 'POST',
      url: APP_CONFIG.API_BASE_URL + '/get-kategori-acc',
      dataType: 'JSON',
      data: {
        user_id: localStorage.getItem('user_id'),
        kas: $kas.val(),
      },
      success(data) {
        const rows = data.data || [];
        if (!rows.length) {
          $kategori.html('<option value="">Tidak ada kategori utk kas ini</option>');
          return;
        }
        $kategori.html(
          '<option value="">-- Pilih Kategori --</option>'
          + rows.map((k) => `<option value="${k.id_kategori_acc}">${k.kategori_acc}</option>`).join(''),
        );
      },
      error() {
        $kategori.html('<option value="">Gagal memuat kategori</option>');
      },
    });
  }

  jQuery('#pb_nominal').on('input', function () {
    const digits = jQuery(this).val().replace(/[^0-9]/g, '');
    jQuery(this).val(digits ? numberFormat(digits) : '');
  });

  jQuery('#pb_file').on('change', function () {
    const file = this.files && this.files[0];
    if (!file) return;
    jQuery('#pb_filename').text('File: ' + file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      jQuery('#pb_preview').attr('src', e.target.result);
      jQuery('#pb_preview_wrap').removeClass('hidden');
    };
    reader.readAsDataURL(file);
  });

  jQuery('#pb_btn_submit').on('click', submitUploadBukti);

  // Porting simpanTransaksi() -- disederhanakan (tanpa tipe transaksi
  // Payment/Operasional, data perusahaan/ekspedisi). `tambah_tipe_transaksi`
  // di-hardcode 'Operasional' krn toggle-nya sengaja tidak diporting.
  // `kas` TIDAK menentukan Debet/Kredit-nya secara langsung di backend --
  // itu ditentukan dari kolom debet/kredit kategori yang dipilih
  // (`AccountingController::tambahTransaksiAcc()`), field `kas` di sini
  // cuma diteruskan apa adanya spt kode asli (`formData.append('kas', ...)`).
  function submitUploadBukti() {
    const kategori = jQuery('#pb_kategori').val();
    const nominalClean = jQuery('#pb_nominal').val().replace(/[^0-9]/g, '');
    const keterangan = jQuery('#pb_keterangan').val().trim();
    const fileInput = document.getElementById('pb_file');
    const hasFile = fileInput.files && fileInput.files[0];

    if (!kategori) {
      app.dialog.alert('Harap pilih kategori.', 'Peringatan');
      return;
    }
    if (!nominalClean) {
      app.dialog.alert('Harap isi nominal.', 'Peringatan');
      return;
    }
    if (!keterangan) {
      app.dialog.alert('Harap isi keterangan.', 'Peringatan');
      return;
    }
    if (!hasFile) {
      app.dialog.alert('Harap upload foto bukti transfer/nota.', 'Peringatan');
      return;
    }

    app.dialog.confirm('Simpan transaksi ini?', () => {
      const $btn = jQuery('#pb_btn_submit');
      $btn.prop('disabled', true).css('opacity', '0.5');

      const formData = new FormData();
      formData.append('tambah_kategori', kategori);
      formData.append('tambah_nominal', nominalClean);
      formData.append('tambah_keterangan', keterangan);
      formData.append('tambah_tipe_transaksi', 'Operasional');
      formData.append('tambah_file_acc_1', fileInput.files[0]);
      formData.append('kas', $kas.val());
      formData.append('user_id', localStorage.getItem('user_id'));
      formData.append('user_record', localStorage.getItem('karyawan_nama'));
      formData.append('lokasi_pabrik', localStorage.getItem('lokasi_pabrik'));

      jQuery.ajax({
        type: 'POST',
        url: APP_CONFIG.API_BASE_URL + '/tambah-transaksi-acc',
        data: formData,
        processData: false,
        contentType: false,
        headers: { Accept: 'application/json' },
        beforeSend() {
          app.dialog.preloader('Menyimpan...');
        },
        success(data) {
          app.dialog.close();
          if (data.status === 'success') {
            app.popup.close('#popup-payable-upload-bukti');
            app.dialog.alert('Transaksi berhasil disimpan.', 'Sukses');
            loadSaldoDanKas();
            loadDataTransaksi();
          } else {
            app.dialog.alert(data.message || 'Gagal menyimpan transaksi.', 'Error');
            $btn.prop('disabled', false).css('opacity', '1');
          }
        },
        error(xhr) {
          app.dialog.close();
          const msg = (xhr.responseJSON && (xhr.responseJSON.message || Object.values(xhr.responseJSON.errors || {})[0]))
            || 'Gagal menghubungi server.';
          app.dialog.alert(String(msg), 'Error');
          $btn.prop('disabled', false).css('opacity', '1');
        },
      });
    });
  }

  loadSaldoDanKas();
  loadDataTransaksi();

  return function unmount() { };
}
