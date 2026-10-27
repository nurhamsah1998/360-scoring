# Email templates (Supabase → Authentication → Emails → Templates)

The app verifies with a **6-digit code** instead of a link. Paste these into the two templates below.
Keep **Confirm email** turned on (Authentication → Sign In / Providers → Email).

## Confirm signup

**Subject:** `Your 360 Scoring code: {{ .Token }}`

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#17202E">
  <h2 style="margin:0 0 8px">Confirm your email</h2>
  <p style="margin:0 0 20px;color:#5B6779">Enter this code in 360 Scoring to finish creating your account.<br>
  Masukkan kode ini di 360 Scoring untuk menyelesaikan pendaftaran.</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:0 0 20px">{{ .Token }}</p>
  <p style="margin:0;color:#5B6779;font-size:13px">The code expires in 1 hour. If you didn't sign up, ignore this email.<br>
  Kode berlaku 1 jam. Abaikan email ini jika Anda tidak mendaftar.</p>
</div>
```

## Reset password

**Subject:** `Your 360 Scoring reset code: {{ .Token }}`

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#17202E">
  <h2 style="margin:0 0 8px">Reset your password</h2>
  <p style="margin:0 0 20px;color:#5B6779">Enter this code in 360 Scoring to choose a new password.<br>
  Masukkan kode ini di 360 Scoring untuk membuat kata sandi baru.</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:0 0 20px">{{ .Token }}</p>
  <p style="margin:0;color:#5B6779;font-size:13px">The code expires in 1 hour. If you didn't ask for this, ignore this email.<br>
  Kode berlaku 1 jam. Abaikan email ini jika Anda tidak memintanya.</p>
</div>
```

## Notes

- The code length is set under Authentication → Providers → Email → *Email OTP length* (default 6). The app accepts 6 digits or more.
- Supabase's built-in email service sends only a few emails per hour. For real use, set up custom SMTP (e.g. Resend) under Authentication → Emails → SMTP Settings.
- Invitations still use a link (Invite user template) — no change needed.
