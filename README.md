# admin-apk

Migrasi dari [`admin-finance-apk`](../admin-finance-apk) (Cordova + Framework7 + jQuery,
`www/` polos) ke Cordova + jQuery + Tailwind + Vite, mengikuti pola
[`inventory-apk`](../inventory-apk) / [`ekspedisi-apk`](../ekspedisi-apk). App ID diganti
`io.cordova.hellocordova` → `com.koperindo.admin`. Dibangun mulai 2026-08-26.

Ini migrasi **setup/tooling + UI** (Framework7 → Tailwind), bukan rewrite fitur.
Beda dari `inventory-apk`/`ekspedisi-apk`: app ini **tetap memanggil
`backend-production` sepenuhnya**, TIDAK pindah ke `backend-migrasi` (modul
Admin/Finance belum ada portingnya di sana) -- lihat `src/lib/config.js`.

## Status per 2026-08-26

### Sudah jalan

- **Scaffold penuh**: Vite + Tailwind + Cordova config, `com.koperindo.admin`,
  tema biru (lihat "Tema" di bawah).
- **Login** -- `POST /get-data-login`, endpoint & field localStorage sama
  persis dgn admin-finance-apk asli (lihat `src/pages/login/`).
- **Navigasi tab tetap**, persis pola inventory-apk (`src/lib/shell.js`):
  - Tab utama: **Point** (grup, sub-tab Sales & Produksi), **Absen** (grup,
    sub-tab Absen & Ijin), **Finance** (grup, sub-tab Payment & Payable).
    Absen tadinya solo (langsung ke halaman Validasi gabungan) -- dipecah
    jadi grup 2 sub-tab atas permintaan user 2026-08-26 ("jadikan 2 tab saja
    Absen dan Ijin").
  - Klik tab grup yang belum aktif → pindah ke sub-halaman default-nya; klik
    lagi selagi sudah di grup itu → cuma toggle tampil/sembunyi baris
    sub-tab, TIDAK pindah halaman (pola sama persis tab "STOCK" inventory-apk).
  - Markup: `<a>` polos tanpa ikon, `bg-slate-100 text-slate-700` (aktif →
    `bg-primary text-white`), 2 tingkat ukuran (primary lebih besar,
    secondary lebih kecil). Judul navbar **statis** "Admin" (tidak berubah
    per halaman) -- sama seperti navbar inventory-apk yang selalu "Inventory".
  - Sebelum bentuk ini, sempat ada 2 versi lain (halaman hub/submenu dgn
    tombol "Kembali", lalu gaya ekspedisi-apk) -- keduanya diganti krn user
    minta disamakan persis dgn inventory-apk.
- [UPDATE 2026-08-26 atas permintaan user] **Konsistensi UI lintas halaman**:
  - **Tinggi filter/tombol refresh diseragamkan** -- `.search-input`,
    `.mat-input` (h-11→h-10), & `.icon-btn` (w-9/h-9→w-10/h-10) di
    `src/styles/main.css` SEKARANG SAMA-SAMA 40px, supaya baris filter yang
    menggabungkan search box + dropdown + tombol refresh (Absen, Payment,
    Payable) rata tingginya -- sebelumnya 3 komponen itu py tinggi
    beda-beda (36/40/44px).
  - **Tombol konfirmasi TANPA ikon/emoji**, cukup label teksnya -- pola
    acuan: popup Detail Ijin (`pages/absen/ijin.js`), tombolnya diubah dari
    "✅ Konfirmasi Sudah Mengetahui" jadi cukup **"Konfirmasi"**. Diterapkan
    juga ke tombol serupa di halaman lain: Payment (`pages/finance/
    payment.js`) "✅ Validasi Pembayaran" → "Validasi Pembayaran", "❌ Reset
    Validasi (Unvalid)" → "Reset Validasi (Unvalid)"; Payable
    (`pages/finance/payable.html`) "✅ Simpan Transaksi" → "Simpan
    Transaksi". Tombol pemicu upload foto ("📷 Pilih Foto Bukti...") TIDAK
    ikut diubah -- itu tombol pemicu file picker, bukan tombol konfirmasi.
- **Point Sales** (`src/pages/point/sales.{js,html}`) -- data inti:
  - Tabel Sales Admin (filter bulan/tahun) → popup **Point** per karyawan
    (list SPK yang sudah lunas saja, total nilai jual & point) → popup
    **Detail SPK** (produk, keterangan, qty, logo customer/bordir/tambahan,
    zoom foto) → popup **Validasi Client** (cari client, tombol VALID/REJECT).
  - Endpoint: `/get-sales-admin`, `/download-point-admin`,
    `/get-penjualan-detail-performa`, `/get-all-clients`, `/update-validasi-client`.
- **Point Produksi** (`src/pages/point/produksi.{js,html}`) -- data inti:
  - Tabel produksi (filter bulan/tahun), kalkulasi poin per cabang/jenis
    produk persis logika aslinya (Jakarta = 100 flat, cabang lain: "HC" di
    `penjualan_jenis` = 200, selain itu 100).
  - Endpoint: `/download-point-produksi`.
  - Kolom SPK **sengaja tidak bisa diklik** -- di admin-finance-apk asli itu
    memanggil `detailPenjualanPointProduksi(...)`, fungsi yang **tidak
    pernah didefinisikan di mana pun** (sudah dicek: grep seluruh
    `admin-finance-apk/www/js/`, nihil) dan popup targetnya juga tidak ada
    markup-nya -- bukan oversight di sini, memang tidak ada apa pun untuk
    diporting.
  - Diuji dgn mock API (Playwright + route interception): alur tabel →
    drill-down popup → detail SPK → cari & validasi client → reload, semua
    jalan tanpa error console, termasuk verifikasi manual angka total.
  - [UPDATE 2026-08-26 atas permintaan user] **Filter Cabang** (`#pp_cabang`)
    + **Validasi Client per-baris** (kolom Opsi) DITAMBAHKAN -- FITUR BARU,
    TIDAK ADA di `point_produksi.js` admin-finance-apk asli sama sekali
    (dicek: nol referensi validasi/cabang di file itu). Filter Cabang diisi
    DI FE dari nilai `bantuan_cabang` yg muncul di data bulan/tahun yg
    sedang dimuat (backend `donwloadPointProduksi()` tidak punya param
    cabang), filter diterapkan client-side tanpa fetch ulang. Popup Validasi
    Client SAMA PERSIS dgn punya `pages/point/sales.js` (`/get-all-clients`,
    `/update-validasi-client`) TAPI dipicu LANGSUNG per-baris SPK di tabel
    utama -- **bukan per-user** spt Sales (yang perlu buka popup Point per
    karyawan dulu), krn tabel Produksi memang sudah flat/tidak dikelompokkan
    per user. Field `point_valid_manager`/`client_id`/`customer_logo`/
    `presentase_omset` SUDAH ada di response `download-point-produksi`
    (join yg sama ke `t_penjualan_header`/`m_client` yg dipakai Sales), cuma
    belum pernah dibaca/ditampilkan FE manapun sebelum ini.
  - Diuji dgn mock API (Playwright): filter Cabang menyaring baris dgn
    benar, badge "Valid" vs tombol "Detail" tampil sesuai
    `point_valid_manager`, popup Validasi Client terbuka dari baris tabel
    utama, tanpa error console.
- **Absen** -- grup 2 sub-tab, masing2 PageModule terpisah (tadinya 1 halaman
  gabungan, dipecah 2026-08-26 atas permintaan user):
  - **Absen** (`/absen/validasi`, `src/pages/absen/validasi.{js,html}`) --
    Tabel Validasi Absensi (cari nama + filter posisi Semua/Produksi/Staff,
    filter ini TERBUKTI ikut mem-filter tab Validasi juga di app lama, bukan
    cuma tab Gaji yang dibuang) -- porting `getDataValid()`/
    `hitungBarisValidasi()`: grouping entri normal+lembur per user+tanggal
    jadi 1 baris (tombol Detail & Lembur berdampingan), popup Detail (foto
    selfie/masuk/istirahat/keluar, maps, breakdown gaji/lembur/potongan/
    tunjangan, tombol Valid/Tolak → `/hrm/presensi/simpan-valid` dgn guard
    `already_validated`/`not_found`).
    Endpoint: `/hrm/presensi/valid`, `/hrm/presensi/simpan-valid`. Field
    `Gaji/Jam`/`Durasi Lembur` di popup detail entri Lembur SELALU tampil
    "-" -- ini SAMA PERSIS di admin-finance-apk asli (2 argumen itu selalu
    dikirim string kosong dari `hitungBarisValidasi()`), bukan regresi
    porting.
  - [UPDATE 2026-08-26 atas permintaan user] Tombol "Izin" (Ijin Setengah
    Hari) DIPINDAH dari checkbox di dalam popup Detail jadi tombol
    tersendiri di kolom Opsi tabel (`btnIzin()`/`confirmSetengahHari()`) --
    aksi cepat langsung dari baris tabel (`is_valid=1, is_setengah_hari=1`
    ke `/hrm/presensi/simpan-valid`), tanpa perlu buka popup Detail dulu.
    Dialog konfirmasi menyebutkan konsekuensinya (gaji pokok dipotong 50% &
    tidak dapat uang disiplin Rp50.000/periode) -- perhitungan sebenarnya
    TETAP sepenuhnya di backend, FE cuma mengirim flag & menampilkan
    peringatan. Popup Detail (tombol Valid/Tolak) sekarang SELALU kirim
    `is_setengah_hari=0`.
  - **Ijin** (`/absen/ijin`, `src/pages/absen/ijin.{js,html}`) -- **PAKAI
    KONTRAK BACKEND TERBARU, BUKAN porting apa adanya** dari
    `getDataValidIjin()`/`validasiIjin()` lama: ditemukan saat porting bahwa
    versi lama (params `is_approved`, field `tanggal_ijin`/`dokumen_ijin`/
    `id_ijin`) sudah tidak nyambung sama sekali dgn
    `IjinController::getDataIjinHrd()`/`updateValidasi()` versi sekarang di
    backend-production (sudah direfactor: `status` pending/disetujui/
    ditolak, field `tanggal_awal`/`tanggal_akhir`, relasi `user`/
    `jenisIjin`, `validated_by`=user id). Dikonfirmasi ke user dulu sebelum
    dikerjakan (2026-08-26) -- halaman ini query `status=pending` saja &
    submit lewat kontrak baru itu.
  - Diuji dgn mock API (Playwright + route interception): grouping normal+
    lembur, entri Borongan, filter lokasi_pabrik client-side, popup Detail
    (varian Normal/Lembur/Borongan) → Valid → guard sukses, popup Detail
    Ijin → Setujui, navigasi grup/sub-tab Absen↔Ijin (termasuk toggle klik tab
    primer selagi sudah di dalam grup), semua jalan tanpa error console
    selain 404 foto dummy (URL foto di data mock memang tidak nyata).
  - [UPDATE 2026-08-26] Judul section di KEDUA sub-tab distandarkan jadi
    format `Data | <jumlah_data>` (span `.section-count`, id `av_count` /
    `ij_count`) -- badge bulat merah/kuning (`ij_badge_pending`/
    `ij_badge_overdue`) di tab Ijin DIHAPUS atas permintaan user, cukup 1
    angka polos spt tab Absen. `overdue_finance_count` dari response
    `/hrm/ijin/data-hrd` sudah tidak dipakai lagi di FE (field per-baris
    `is_finance_overdue` TETAP dipakai utk highlight warna kolom Tunggu).
  - [UPDATE 2026-08-26] Tabel Ijin: kolom **Alasan dihapus dari tabel**
    (cuma tampil di popup Detail) supaya tabel tidak melebar krn teks
    panjang. Di popup Detail, Alasan dirender BLOK (label di baris atas,
    teks di baris bawahnya -- helper `infoBlock()`), beda dari field lain
    yang tetap sejajar kiri-kanan (`infoRow()`).
  - [UPDATE 2026-08-26, keputusan produk] Popup Detail Ijin TIDAK lagi py 2
    tombol Setujui/Tolak -- diganti 1 tombol **"Konfirmasi Sudah
    Mengetahui"**, krn app Admin ini BUKAN pemegang wewenang
    menyetujui/menolak ijin (itu wewenang HRD/Manajer di app/dashboard
    lain) -- di sini cuma konfirmasi admin sudah tahu ada pengajuan.
    **Catatan teknis**: tombol ini TETAP mengirim `status:'disetujui'` ke
    `/hrm/ijin/update-validasi` (disepakati eksplisit dgn user) krn backend
    saat ini tidak punya status/field terpisah utk "sudah dibaca tanpa
    mengubah status" -- itu satu2nya cara ijin keluar dari daftar pending
    di tab ini sekarang. Kalau nanti backend dapat field "dibaca_admin"
    terpisah, ganti jalur ini supaya tidak lagi memakai status approval.

- **Finance Payment** (`src/pages/finance/payment.{js,html}`) -- porting dari
  `notif.js`/`notif.html` (nama lama "Notifikasi Pembayaran", TIDAK ada
  hubungannya dgn modul push-notif/FCM yg SENGAJA dibuang -- lihat catatan di
  bagian "Sengaja dibuang"). Scope data inti (disepakati dgn user
  2026-08-26):
  - Tabel log pembayaran, porting `getDashboardNotif()`.
  - [UPDATE 2026-08-26 atas permintaan user] Toggle Unvalid/Valid (tadinya 2
    tombol) diganti **1 dropdown filter** (`#pay_status_filter`, sama pola
    dgn dropdown posisi di Absen) -- "jadikan satu saja buat sebagai
    filter". Search box Cari Perusahaan & Cari Sales (tadinya 2 input)
    DIGABUNG jadi **1 search box** (`#pay_search`). Backend
    (`AdminController::getNotifPembayaranAdmin`) menerapkan kedua filter itu
    sbg AND terpisah (bukan OR) -- kalau teks yg sama dikirim ke keduanya
    sekaligus hasilnya jadi salah (harus cocok di KEDUA kolom). Jadi filter
    gabungan ini dijalankan DI FE (cocok `client_nama` ATAU `karyawan_nama`)
    SETELAH data diambil apa adanya per status, bukan dikirim ke param
    `perusahaan_notif_value`/`sales_notif_filter` (selalu `'empty'` ke
    backend) -- lihat komentar panjang di `loadDataNotif()`.
  - Popup **Info Client** & **Info Sales** (porting `openPopupALamat()`/
    `openPopupSales()`) -- data langsung dari baris tabel, tanpa request
    tambahan.
  - Popup **Validasi Pembayaran** (status Unvalid → tombol Valid): pilih
    rekening, isi nominal, upload bukti mutasi **wajib khusus rekening
    "Mandiri Kopra"** (`<input type="file">` biasa + `FormData`
    multipart -- BUKAN kamera Cordova, jadi bisa diuji penuh di browser) →
    `POST {asal_server}/api/valid-bukti-pembayaran-admin`.
  - Popup **Unvalid/Reset** (status Valid → tombol Unvalid): preview bukti
    mutasi (kalau ada) + tombol reset → `POST {asal_server}/api/unvalid-bukti-pembayaran`.
  - **Kolom SPK & Jumlah sengaja tidak bisa diklik** -- popup drill-down
    aslinya (`detailPenjualanNotif()` ~200 baris, `detailPembayaranNotif()`
    ~500 baris riwayat hingga 10x bayar/SPK) DITUNDA ke pass berikutnya
    (disepakati dgn user), keduanya cuma informasi tambahan, bukan bagian
    alur wajib valid/unvalid.
  - **Kontrak backend SUDAH dicek COCOK** dgn `ServiceController::
    validBuktiPembayaranAdmin()`/`unvalidBuktiPembayaran()` &
    `AdminController::getNotifPembayaranAdmin()` saat ini -- beda dari kasus
    Ijin (`pages/absen/ijin.js`) yang ternyata basi, di sini porting APA
    ADANYA. `asal_server` (field per-baris, BISA beda2) dipakai apa adanya
    utk endpoint & preview bukti mutasi -- tidak diganti `APP_CONFIG.API_BASE_URL`.
  - [UPDATE 2026-08-26 atas permintaan user] **Paginasi** ditambahkan
    (`#pay_pagination`, 20 baris/halaman) -- pola sama persis dgn
    `inventory-apk/src/pages/partner/partner.js` (`createPaginationButtons()`:
    Prev/Next + indikator "halaman / total"). Dipotong DI FE dari `rowsData`
    yg sudah difilter pencarian, TIDAK fetch ulang ke server tiap ganti
    halaman. Indeks `data-idx` tombol Opsi/Client/Sales dihitung ABSOLUT
    thd `rowsData` (bukan indeks lokal per halaman) via `renderTable()`,
    supaya lookup tetap benar di halaman berapa pun.
  - Diuji dgn mock API (Playwright + route interception, termasuk upload
    file via `setInputFiles`): toggle Unvalid↔Valid, popup Info Client/Sales,
    popup Validasi (pilih Mandiri Kopra → wajib upload → preview → submit;
    rekening lain → tanpa upload) & Unvalid/Reset, filter gabungan cocok
    client_nama ATAU karyawan_nama, **paginasi 45 baris → 3 halaman (20/20/5)**
    dgn tombol Opsi tetap merujuk baris yg benar di halaman ke-2/3, semua
    jalan tanpa error console selain 404 foto dummy.
- **Finance Payable** (`src/pages/finance/payable.{js,html}`) -- **BUKAN**
  `id_kas_acc=9`/`checkKasMinimum()` spt sempat diduga sebelumnya di README
  ini. Dikoreksi 2026-08-26 setelah user klarifikasi: "Payable" adalah tab
  internal `#tab-payable` DI DALAM `data_transaksi.html` admin-finance-apk
  lama (nav tab "Finance" asli), driven by `www/js/data.js`
  (`getDataTransaksi()`/`comboKasFilter()`/`getBulanTransaksi()`/
  `getYearTransaksi()`). Scope pass ini (disepakati dgn user): **data inti
  READ-ONLY** -- Saldo, filter Kas/Bulan/Tahun, tabel transaksi (No/Tanggal/
  Kategori/Keterangan/Nominal/Admin), + kartu **Debet/Kredit/Total**.
  Tambah/Edit/Delete/Valid transaksi (termasuk transfer antar kas, saldo
  guard, upload foto bukti via kamera/file, custom dropdown tipe transaksi
  berwarna) DITUNDA -- jauh lebih besar & scope-nya belum disepakati detail.
  - **[TEMUAN, lihat riwayat git utk detail lengkap]** Endpoint yang dipakai
    fitur ini (`/get-kas-acc`, `/get-transaksi-acc-with-kas-transfer`,
    `/get-transaksi-kas-acc`, `/get-data-amount-kas`) di `routes/api.php`
    backend-production SEMUA menunjuk ke namespace `API\Accounting\*`
    (`KasController`/`TransaksiOperasionalController`/`TransaksiKasController`)
    yang **TIDAK ADA SAMA SEKALI** di checkout backend-production ini --
    implementasi NYATA method2 itu ada di controller flat
    `AccountingController.php`/`NewAccountingController.php` yang **tidak
    dirouting sama sekali**. Kemungkinan penyebab: rencana refactor
    pemecahan `AccountingController` (`operasional-apk/docs/superpowers/
    plans/2026-05-29-refactor-accounting-controller.md`) dikerjakan di
    checkout staging terpisah (FTP), belum tentu pernah disatukan balik ke
    repo ini.
  - [UPDATE 2026-08-26] **API DISAMBUNGKAN** atas permintaan eksplisit user
    MESKI status endpoint di atas belum terkonfirmasi (flag
    `BACKEND_CONFIRMED` yg sebelumnya menjaga ini SUDAH DIHAPUS dari
    `payable.js`) -- kalau nanti terbukti endpoint ini belum live di
    production, cek temuan di atas dulu sebelum menganggap ini bug porting;
    tiap fungsi ajax sudah py error handler ("Gagal menghubungi server")
    jadi kegagalan tidak diam2 tanpa feedback ke user.
  - [UPDATE 2026-08-26 atas permintaan user] **Baris Debet ditandai biru
    muda** (`bg-blue-50`, dari field `type_acc === 'Debet'`) + **kartu
    ringkasan** Debet/Kredit/Total. Total Debet & Kredit dihitung DI FE dari
    `nominal_acc` per baris dikelompokkan by `type_acc` -- BUKAN porting apa
    adanya dari `nominal_debet`/`nominal_kredit` di `getDataTransaksi()`
    asli (nama variabel itu MENYESATKAN: di aslinya KEDUANYA menjumlah
    SEMUA baris tanpa syarat `type_acc` sama sekali, jadi tidak benar2
    memisahkan Debet vs Kredit). Total Keseluruhan = Debet − Kredit
    (konvensi akuntansi standar).
  - [UPDATE 2026-08-26 atas permintaan user] Kartu Debet/Kredit/Total
    **DIGABUNG jadi SATU card dgn kartu Saldo** (tadinya 2 card terpisah),
    padding & ukuran teks diperkecil (`p-2.5`, judul `text-lg`, kartu-kartu
    kecil `text-sm`, `leading-tight`) supaya tidak makan tempat vertikal
    berlebihan. **Warna kondisional**: Saldo biru (`text-primary`) kalau
    ≥ 0, merah (`text-danger`) kalau < 0; Total hijau (`text-success`)
    kalau ≥ 0 (TANPA tanda "+"), merah (`text-danger`) kalau < 0 -- tanda
    "-" utk nilai negatif sudah otomatis dari `numberFormat()` (tidak pernah
    menambah "+" utk positif), jadi FE cuma toggle class warnanya
    (`setTotalCards()`/handler `loadSaldoDanKas()`).
  - Diuji dgn mock API (Playwright), termasuk kasus NEGATIF (saldo kas
    minus, Kredit > Debet): Saldo & Total berganti `text-danger` + tanda
    "-" saat negatif, kembali `text-primary`/`text-success` tanpa tanda
    saat positif; kartu Debet/Kredit/Total terhitung benar dari data
    campuran, baris Debet ter-highlight biru muda, navigasi sub-tab
    Payment↔Payable jalan tanpa error console.
  - [UPDATE 2026-08-26 atas permintaan user] **Tombol "Upload Bukti
    Transfer/Nota"** ditambahkan -- HANYA muncul saat filter Kas sedang di
    **Kas Kecil** (dideteksi dari label opsi terpilih mengandung "kecil",
    bukan `id_kas_acc` hardcode, lihat `toggleUploadBuktiButton()`).
    [UPDATE lanjutan] Tombolnya sendiri DIPINDAH sejajar dgn baris
    section-title "Data | count" (kanan), dijadikan **ikon saja**
    (`.icon-btn.icon-btn--primary`, ikon paperclip, tanpa teks) -- tadinya
    tombol lebar penuh terpisah di atas tabel. Popup
    berisi form ringkas (disepakati dgn user setelah dijelaskan bahwa
    backend `tambahTransaksiAcc()` **mewajibkan** kategori -- itu yg
    menentukan kas Debet/Kredit-nya, tidak bisa cuma foto): **Kategori**
    (di-scope ke kas terpilih via `/get-kategori-acc`, filter backend
    `where('kredit', $kas)`) + **Nominal** + **Keterangan** + **foto bukti**
    (`<input type="file">` biasa, BUKAN kamera Cordova) → `POST
    /tambah-transaksi-acc` (multipart). Tipe transaksi Payment/Operasional,
    data perusahaan/ekspedisi, dan transfer antar-kas eksplisit dari
    `openTambahPopup()`/`simpanTransaksi()` asli SENGAJA TIDAK diporting --
    `tambah_tipe_transaksi` di-hardcode `'Operasional'`. Endpoint ini ada di
    keluarga `API\Accounting\*` yg sama dgn temuan namespace-hilang di atas
    -- risiko yg sama berlaku (lihat catatan panjang di `payable.js`).
  - Diuji dgn mock API (Playwright, termasuk upload file via
    `setInputFiles`): tombol tersembunyi utk Kas Utama, muncul utk Kas
    Kecil, dropdown Kategori terisi dari `/get-kategori-acc`, validasi
    kosong (kategori/nominal/keterangan/foto wajib), submit sukses →
    refresh Saldo & tabel, semua tanpa error console.
- [UPDATE 2026-08-26 atas permintaan user, "samakan format penulisan
  tanggal pada tab Payment sama seperti yg ada pada tab Payable"] Kolom
  Tanggal di **Payment** (`formatDateTime()`) diubah dari `DD-MM-YY HH:mm`
  (porting `moment(val.datetime).format(...)` asli, termasuk jam) jadi
  `DD-MMM-YYYY` (mis. "20-Agu-2026") -- SAMA PERSIS dgn
  `formatTanggalTransaksi()` di Payable. Jam pembayaran sengaja tidak lagi
  ditampilkan di kolom ini demi konsistensi format lintas tab Finance.

Semua 6 route (`/point/sales`, `/point/produksi`, `/absen/validasi`,
`/absen/ijin`, `/finance/payment`, `/finance/payable`) sekarang py
`PageModule` sungguhan & tersambung API -- `src/lib/placeholder.js` (generik
utk route yang belum diporting) SUDAH DIHAPUS krn tidak dipakai lagi di mana
pun.

### Sengaja dibuang (bukan ditunda)

Berikut fitur admin-finance-apk yang **tidak diporting sama sekali**, atas
permintaan eksplisit user -- kalau nanti dibutuhkan lagi, cek riwayat git:

- **Dari menu**: Point Admin, Point SJ + History-nya, Absensi Sales, Data
  Gaji / Gaji Sales / Gaji Borongan, Data Transaksi (kas) versi lama,
  Notifikasi (NotificationManager/FCM) -- `google-services.json` tetap
  disalin ke root repo kalau-kalau dibutuhkan lagi, tapi belum dipakai.
- **Dari Point Sales & Point Produksi**: tombol "Kirim" + popup Input Alamat
  (porting `kirimAlamatSales()`/`kirimAlamatProduksi()`, endpoint
  `/get-data-Alamat`) -- user bilang "menu Point seharusnya tidak ada fitur
  untuk mengatur pengiriman apapun". Dibuang total, bukan disembunyikan.
- **Butuh plugin native, belum diporting krn tidak bisa diuji di browser**:
  upload foto bukti bayar/pelunasan (kamera), download/share PDF rekap,
  konfirmasi foto produksi. Tombol/menunya sengaja tidak ditampilkan sama
  sekali. Kalau nanti diminta lagi, perlu tambah `cordova-plugin-camera` +
  `cordova-pdf-generator` ke `config.xml`/`package.json` dan diuji lewat
  build APK asli (bukan `npm run dev`).

### Keputusan yang perlu diambil ulang nanti

- Redirect otomatis berbasis role (`lokasi_pabrik_user` Pusat → Point,
  lainnya → Absen, seperti admin-finance-apk asli) vs. landing default
  sekarang yang selalu `/point/sales` (lihat `login.js`/`main.js`).
- Klarifikasi konten "Finance → Payable" (lihat tabel di atas).

## Menjalankan

```bash
npm install
npm run dev              # dev server Vite, http://localhost:5173
npm run build             # build ke www/ (dibaca Cordova)
npm run cordova:android    # build + jalankan ke device/emulator Android
npm run version:patch      # bump versi (config.xml + package.json + src/lib/app-version.js)
```

## Struktur

```
admin-apk/
├── config.xml, bump-version.cjs, fix-platform-type.cjs   # scaffold Cordova, pola sama persis dgn inventory-apk/ekspedisi-apk
├── resources/          # icon.png + drawable-*-icon.png -- SAMA PERSIS (byte-identik) dgn admin-finance-apk/finance-apk
├── src/
│   ├── index.html, main.js
│   ├── lib/
│   │   ├── config.js         # APP_CONFIG murni (API_BASE_URL ke backend-production, LOGIN_ENDPOINT) -- TIDAK ADA fungsi apa pun di sini
│   │   ├── auth.js           # checkLogin/logOut -- TANPA token (backend-production tidak pakai Bearer di endpoint ini)
│   │   ├── format.js         # numberFormat/abbreviateNumber/formatDateShort/formatTimeShort/formatTgl, porting dari www/js/app.js & global.js lama
│   │   ├── app-version.js    # auto-generate oleh bump-version.cjs, jangan edit manual
│   │   ├── version-check.js  # cek versi (POST /config/check-version, app_name='admin') + indikator koneksi #box_internet
│   │   ├── router.js         # router hash-based pengganti Framework7 router
│   │   ├── shell.js          # navbar (judul statis "Admin") + tab TETAP (Point/Absen/Finance + sub-tab), persis pola inventory-apk
│   │   ├── dialog.js         # pengganti app.dialog.alert/confirm/preloader/close
│   │   ├── toast.js          # pengganti app.toast.create({...}).open()
│   │   ├── popup.js          # pengganti app.popup.open/close('.selector'|'#id') -- popup Point/Detail SPK/Validasi Client
│   │   ├── photobrowser.js   # pengganti app.photoBrowser.create({photos}).open() -- zoom foto produk/logo
│   │   └── app-shim.js       # window.app = {dialog, toast, popup, photoBrowser, views.main.router} -- kompatibilitas kode lama saat diporting
│   ├── pages/
│   │   ├── login/            # form login + quotes/footer, gaya sama dgn inventory-apk/ekspedisi-apk
│   │   ├── point/            # Point Sales & Produksi (lihat "Status") + pointFormat.js (helper spkLabel/formatDayMonth berbagi)
│   │   ├── absen/             # grup 2 sub-tab (lihat "Status"): validasi.{js,html} (presensi), ijin.{js,html} (PAKAI kontrak backend terbaru, bukan porting apa adanya)
│   │   └── finance/           # payment.{js,html} & payable.{js,html} (lihat "Status") -- payable read-only, API sengaja belum disambungkan (BACKEND_CONFIRMED=false)
│   └── styles/main.css       # Tailwind + design tokens (--color-primary dst) + komponen (card-surface, tbl-*, mat-*, btn-tbl--*, dst)
├── public/img/logo/           # logo_new.png, disalin dari admin-finance-apk/www/img/logo/
└── google-services.json       # disalin dari admin-finance-apk, BELUM dipakai (fitur notifikasi belum diporting)
```

## Tema

Warna primary **biru**, diambil dari gradient `.bg-dark-gray-medium` /
`.btn-primary-theme` di `finance-apk/www/css/app.css`
(`linear-gradient(315deg, #14418F, #056BBC)`) -- warna tema biru finance-apk yang
sebenarnya, walau nama class-nya menyesatkan ("dark-gray"). `#056BBC` dipakai
sbg `primary` (tombol/aksi), `#14418F` sbg ujung gradient topbar. Lihat
`tailwind.config.js` untuk detail token.
