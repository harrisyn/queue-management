# Local development: Mail testing with Mailpit

This repository includes a Mailpit service in `docker-compose.yml` so you can capture and inspect emails sent by the backend during development (OTP codes, notifications, etc.).

- Mailpit SMTP (container): mailpit:1025
- Mailpit Web UI (host): http://localhost:8025

How to use:
1. Start the dev environment:
```bash
docker-compose up -d --build
```
2. Open Mailpit UI at http://localhost:8025 to view incoming messages.
3. When the backend sends OTP emails, they'll appear in Mailpit. If using the nodemailer test account, send mail preview URLs are also returned by the backend logs and responses (getTestMessageUrl).

If you prefer a different SMTP provider in dev or staging, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` in the backend environment (see `backend/.env.example`).

