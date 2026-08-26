/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,html}',
  ],
  theme: {
    extend: {
      // Warna primary = BIRU, diambil PERSIS dari gradient .bg-dark-gray-medium /
      // .btn-primary-theme finance-apk (www/css/app.css: "linear-gradient(315deg,
      // #14418F, #056BBC)") -- itu warna tema biru finance-apk yang sebenarnya,
      // walau nama classnya menyesatkan ("dark-gray"). DEFAULT=#056BBC (biru
      // terang, sisi gradient yang dipakai utk tombol/aksi solid) dan
      // light=#3B82F6 (blue-500 Tailwind biasa, finance-apk sendiri tidak
      // mendefinisikan tint terang) -- bentuk token (DEFAULT/light) disamakan
      // dgn inventory-apk/tailwind.config.js, cuma nilainya yang beda.
      colors: {
        primary: {
          DEFAULT: '#056BBC',
          light: '#3B82F6',
        },
        danger: '#dc2626',
        warning: '#d97706',
        success: '#16a34a',
        info: '#2563eb',
        // surface/ink disamakan ke palet ekspedisi-apk/inventory-apk (satu
        // keluarga warna netral lintas app di workspace ini, cuma brand primary
        // yang beda per app).
        surface: {
          base: '#f5f7fa',
          DEFAULT: '#ffffff',
          raised: '#f8fafc',
          overlay: '#e2e8f0',
        },
        ink: {
          primary: '#0b1220',
          secondary: '#475569',
          muted: '#94a3b8',
          faint: '#cbd5e1',
        },
      },
      borderRadius: {
        sm: '5px',
        md: '8px',
        lg: '12px',
      },
      fontFamily: {
        heading: ['"Exo 2"', 'sans-serif'],
        body: ['Barlow', 'sans-serif'],
      },
      // shadow-card dipakai topbar (shell.js), disamakan dgn ekspedisi-apk/
      // inventory-apk -- shadow di-tint warna ink (bukan black polos).
      boxShadow: {
        card: '0 1px 2px 0 rgba(11,18,32,0.06), 0 1px 3px 0 rgba(11,18,32,0.08)',
      },
    },
  },
  plugins: [],
};
