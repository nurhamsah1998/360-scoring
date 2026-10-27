# PRD — 360-Scoring

> Status: **v1.0 — terimplementasi** · Pemilik: Nurhamsah · Tanggal: 27 Okt 2026

## 1. Ringkasan

360-Scoring adalah aplikasi web **penilaian kinerja 360°** multi-organisasi. Seorang karyawan dinilai oleh atasan, rekan, bawahan, dan dirinya sendiri, lalu hasilnya diringkas dalam laporan per kompetensi yang menjaga anonimitas penilai.

Project ini adalah **portofolio pribadi**, jadi prioritasnya: alur lengkap end-to-end, keamanan data yang benar (RLS), UI rapi dan responsif, serta demo yang bisa dicoba dalam satu klik.

## 2. Tujuan & Non-tujuan

**Tujuan**
- Menjalankan satu siklus 360° utuh: setup → nominasi → penilaian → tutup → rilis laporan.
- Anonimitas dijamin di level database, tidak hanya disembunyikan di UI.
- Pengunjung portofolio bisa mencoba tiga sudut pandang (Admin, Atasan, Karyawan) tanpa mendaftar.

**Non-tujuan (fase ini)**
- Email pengingat otomatis (hanya notifikasi dalam aplikasi).
- Integrasi HRIS, SSO, atau penagihan (billing).
- Aplikasi mobile native (cukup web responsif).
- Analitik lintas siklus atau tren historis.

## 3. Persona & Role

| Role | Lingkup | Kemampuan utama |
|---|---|---|
| **Admin / HR** | Satu organisasi | Kelola anggota, struktur atasan, template, siklus; melihat semua laporan |
| **Atasan** | Bawahan langsung | Menyetujui nominasi rekan bawahan; melihat laporan bawahan langsung |
| **Karyawan** | Diri sendiri | Menominasikan rekan, mengisi penilaian, melihat laporan sendiri setelah dirilis |

"Atasan" bukan role tersendiri. Ia diturunkan dari relasi `manager` di struktur organisasi. Satu user bisa menjadi anggota beberapa organisasi dengan role berbeda.

## 4. Konsep Inti

- **Organisasi**: tenant. Semua data terisolasi per organisasi.
- **Anggota**: user di dalam organisasi, dengan jabatan dan atasan langsung.
- **Template**: kuesioner yang bisa dipakai ulang. Isinya **Kompetensi**, dan tiap kompetensi berisi 3–5 **Pernyataan** berskala 1–5.
- **Siklus**: satu putaran penilaian (misalnya "Q4 2026"). Memakai satu template, yang isinya **di-snapshot** saat siklus dimulai.
- **Penugasan**: pasangan *penilai → dinilai* dengan jenis relasi `self | manager | peer | direct_report`.
- **Laporan**: agregat skor per kompetensi dan per kelompok penilai, plus komentar anonim.

## 5. Alur Pengguna

### 5.1 Onboarding organisasi
1. User mendaftar (email + password) lalu membuat organisasi. User tersebut otomatis menjadi Admin.
2. Admin menambahkan anggota dengan dua cara:
   - **Undang satu per satu**: nama, email, jabatan, atasan.
   - **Impor CSV**: kolom `name, email, job_title, manager_email`. Sistem memvalidasi, menampilkan pratinjau beserta errornya, lalu mengirim undangan.
3. Penerima undangan mengklik link, mengatur password, dan otomatis bergabung ke organisasi.

### 5.2 Siklus penilaian

```
Draft → Nominasi → Penilaian → Ditutup → Dirilis
```

| Tahap | Yang terjadi |
|---|---|
| **Draft** | Admin memilih template, peserta (yang dinilai), tenggat nominasi & penilaian, serta batas jumlah rekan (default min 3, maks 8). |
| **Nominasi** | Saat siklus dimulai: template di-snapshot, relasi atasan di-snapshot, dan penugasan `self`, `manager`, dan `direct_report` dibuat otomatis. Karyawan menominasikan rekan, lalu atasan menyetujui atau menolak. Admin bisa menambah atau menghapus nominasi. |
| **Penilaian** | Nominasi yang disetujui menjadi penugasan `peer`. Penilai mengisi form. Draft tersimpan otomatis, dan setelah dikirim tidak bisa diubah. |
| **Ditutup** | Tidak ada pengiriman baru. Laporan sudah dihitung dan bisa dilihat Admin & Atasan. |
| **Dirilis** | Karyawan bisa melihat laporannya sendiri. |

Admin bisa memajukan tahap secara manual. Tenggat bersifat informatif: ditampilkan dan memicu notifikasi, tapi tidak menutup tahap secara otomatis.

### 5.3 Mengisi penilaian
- Halaman "Tugas Saya" menampilkan daftar orang yang harus dinilai, beserta status dan tenggatnya.
- Form dibagi per kompetensi. Tiap pernyataan diberi skala 1–5 plus opsi **"Tidak dapat menilai"** (N/A). Tiap kompetensi punya satu kolom komentar opsional.
- Progres ditampilkan, dan form bisa dikirim jika semua pernyataan sudah dijawab (N/A dihitung sebagai jawaban).

### 5.4 Laporan
- **Ringkasan**: skor rata-rata "orang lain" (semua selain diri sendiri) dibanding skor diri sendiri.
- **Radar chart** per kompetensi.
- **Tabel** skor per kompetensi × kelompok (Atasan, Rekan, Bawahan, Diri sendiri).
- **Blind spot / hidden strength**: kompetensi dengan selisih terbesar antara diri sendiri dan orang lain.
- **Komentar**, dikelompokkan per kompetensi tanpa nama penilai.

## 6. Aturan Anonimitas & Akses

| Aturan | Detail |
|---|---|
| Kelompok anonim | **Rekan** dan **Bawahan**. Identitas penilai tidak pernah dikembalikan ke siapa pun, termasuk Admin. |
| Ambang minimal | Skor dan komentar suatu kelompok anonim hanya tampil jika **≥ 3 penilai sudah mengirim**. Jika kurang, kelompok itu ditampilkan sebagai "Data tidak cukup". |
| Kelompok tidak anonim | **Atasan** dan **Diri sendiri** ditampilkan apa adanya. |
| Skor "orang lain" | Dihitung dari semua penilai non-self, dan hanya tampil jika totalnya ≥ 3. |
| Data mentah | Jawaban per penilai hanya bisa dibaca oleh penilai itu sendiri. Laporan diambil lewat fungsi database (`SECURITY DEFINER`) yang hanya mengembalikan agregat. |
| Akses laporan | Admin: semua peserta. Atasan: bawahan langsung (sesuai snapshot siklus). Karyawan: dirinya sendiri, hanya setelah **Dirilis**. |

## 7. Kasus Tepi

- **Atasan berganti saat siklus berjalan**: siklus tetap memakai snapshot saat dimulai.
- **Anggota dinonaktifkan**: penugasan yang belum dikirim dibatalkan, sedangkan yang sudah dikirim tetap dihitung.
- **Karyawan tanpa atasan** (misalnya direktur): tidak ada penugasan `manager`, dan nominasinya disetujui oleh Admin.
- **Nominasi diri sendiri atau duplikat**: ditolak oleh validasi.
- **Rekan yang dinominasikan juga atasan atau bawahan**: ditolak, karena relasi itu sudah tercakup otomatis.
- **CSV dengan `manager_email` yang tidak ada atau membentuk siklus atasan**: ditandai sebagai error di pratinjau.

## 8. Notifikasi (dalam aplikasi)
- Ikon lonceng dengan badge jumlah belum dibaca.
- Pemicu: siklus masuk tahap Nominasi atau Penilaian, ada nominasi yang menunggu persetujuan (untuk atasan), nominasi disetujui atau ditolak, tenggat ≤ 2 hari lagi, dan laporan dirilis.

## 9. Mode Demo
- Halaman landing punya tombol **"Coba demo sebagai: Admin / Atasan / Karyawan"**.
- Login otomatis ke akun demo di organisasi demo yang sudah berisi data contoh: sekitar 12 anggota, 1 siklus Dirilis, dan 1 siklus Penilaian.
- Aksi destruktif (hapus organisasi, ubah email) dinonaktifkan untuk akun demo.
- Data demo direset setiap hari oleh job terjadwal.

## 10. Kebutuhan Non-fungsional
- **Bahasa**: Indonesia & Inggris, bisa diganti di UI, dan pilihan disimpan per user. Default mengikuti bahasa browser.
- **Responsif**: mobile-first, sehingga form penilaian nyaman diisi dari HP.
- **Keamanan**: RLS aktif di semua tabel, isolasi per organisasi, dan service key hanya dipakai di edge function.
- **Aksesibilitas**: label form lengkap, bisa dinavigasi dengan keyboard, dan kontras warna cukup.
- **Performa**: halaman utama dimuat < 2 detik di 4G.

## 11. Arsitektur & Stack

| Lapisan | Pilihan |
|---|---|
| Frontend | React + Vite + TypeScript, React Router, TanStack Query, Tailwind CSS, react-i18next, Recharts |
| Backend | Supabase: Postgres + RLS, Auth, Edge Functions (undangan, impor CSV, reset demo), pg_cron |
| Hosting | Netlify (SPA) |
| Repo | `github.com/nurhamsah1998/360-scoring` |

### Model data (garis besar)

```
organizations        (id, name, slug, created_by)
profiles             (user_id, full_name, locale)
memberships          (id, org_id, user_id, role[admin|member], job_title, manager_id→memberships, status[invited|active|inactive])
invitations          (id, org_id, email, name, job_title, manager_email, token, status, expires_at)
templates            (id, org_id, name)
competencies         (id, template_id, name_i18n, description_i18n, position)
statements           (id, competency_id, text_i18n, position)
cycles               (id, org_id, name, status, template_snapshot jsonb, nomination_due, review_due, peer_min, peer_max, min_raters)
cycle_participants   (cycle_id, reviewee_id→memberships, manager_id_snapshot)
nominations          (id, cycle_id, reviewee_id, peer_id, status[pending|approved|rejected], decided_by)
assignments          (id, cycle_id, reviewee_id, reviewer_id, relationship, status[pending|submitted|void], submitted_at)
responses            (assignment_id, statement_key, score[1–5|null=N/A])
comments             (assignment_id, competency_key, body)
notifications        (id, user_id, org_id, type, payload jsonb, read_at)
```

## 12. Tahapan Rilis

| Fase | Isi | Hasil yang bisa dicek |
|---|---|---|
| **1. Fondasi** | Setup Vite + Tailwind + i18n, Supabase project, auth (daftar, login, lupa password), buat organisasi, skema dasar + RLS | Link Netlify: bisa daftar, login, dan membuat organisasi |
| **2. Organisasi** | Kelola anggota, undangan, impor CSV, struktur atasan | Admin bisa mengisi organisasi |
| **3. Template & Siklus** | CRUD template, buat siklus, transisi tahap, nominasi + persetujuan | Siklus bisa berjalan sampai tahap Penilaian |
| **4. Penilaian** | Tugas Saya, form penilaian, autosave, notifikasi | Penilaian bisa diisi dan dikirim |
| **5. Laporan** | Fungsi agregat anonim, halaman laporan, radar chart, rilis | Laporan lengkap |
| **6. Demo & Polish** | Seed demo, login satu klik, reset harian, landing page | Siap dipamerkan di portofolio |

## 13. Asumsi yang Perlu Dikonfirmasi
1. **Batas email undangan.** SMTP bawaan Supabase hanya mengizinkan sedikit email per jam. Untuk demo itu cukup, tapi pemakaian nyata butuh SMTP kustom (misalnya Resend).
2. **Skala 1–5** dengan label: Sangat kurang, Kurang, Cukup, Baik, Sangat baik.
3. **Template bawaan** berisi 5 kompetensi (Komunikasi, Kerja sama, Kepemimpinan, Problem solving, Integritas) dan tersedia otomatis untuk setiap organisasi baru.
4. **Pembulatan skor**: 1 desimal.

## 14. Keputusan selama implementasi

| Topik | Keputusan |
|---|---|
| Menarik nominasi | Nominasi tidak dihapus, tetapi ditandai `withdrawn` sebagai riwayat. Nominasi yang ditarik atau ditolak bisa diajukan ulang. |
| Peserta nonaktif | Peserta yang dinonaktifkan setelah ditambahkan dilewati saat siklus dimulai, tidak dihapus. |
| Skor "orang lain" | Hanya menggabungkan atasan dan kelompok anonim yang **tampil** (≥ 3 respons), sehingga kelompok yang disembunyikan tidak bisa ditebak lewat pengurangan. |
| Skala radar | Dimulai dari 1 (bukan 0) karena skala penilaian 1–5. |
| Warna kelompok | Diri sendiri `#8B2F9C`, Atasan `#00806A`, Rekan `#C97A1E`, Bawahan `#4A90E2`. Lolos uji buta warna untuk semua pasangan. |
| Notifikasi | Dibuat oleh trigger database saat tahap berubah dan nominasi diputuskan. Pengingat tenggat tampil di "Tugas Anda". |
| Demo | Organisasi "Northwind Language Institute" dengan 3 akun login. Undangan email dan pembuatan organisasi dimatikan. Reset harian pukul 03.00 WIB lewat pg_cron. |
