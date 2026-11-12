# Piece Plus AI Worker

This Worker runs **Cloudflare Workers AI** via an `AI` binding and validates
Supabase JWTs server-side before model inference. The code never stores an API key in the browser.

## Deploy

1. Create a Cloudflare Workers project on the Free plan.
2. Add an `AI` binding named `AI`. The Worker runs model `@cf/zai-org/glm-4.7-flash`.
3. Configure worker environment vars `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` pointing at the **dedicated Piece Plus project**.
4. Deploy `worker.js` and test an authenticated POST to `/feedback` from the configured production origin.
5. In `cloud-config.js`, set the Worker URL to the deployed endpoint.

## Security / spending controls

- Requests must pass Supabase authentication; CORS origin checks do **not** substitute for authentication.
- No user private text is committed to GitHub.
- Cloudflare Free's AI allowance is capped, not unlimited. A valid account can still use the daily allocation rapidly; consider a per-user limit enforced with Durable Objects or D1 before allowing broader registrations.
- Reject excessively large inputs and keep output capped.
- Never enable Workers Paid or automatic overage billing without explicit approval.
- AI requests send entered question/answer content to the model provider. It is not a private offline model.
