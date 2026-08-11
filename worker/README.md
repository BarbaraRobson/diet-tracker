# Diet Tracker estimator Worker

This Worker keeps the OpenAI API key off the phone and out of the GitHub Pages site. It accepts a food description, asks OpenAI for category-unit estimates, and returns suggestions that must be reviewed before being saved as a meal.

## Security design

- `OPENAI_API_KEY` is a Cloudflare Secret, never browser code.
- `APP_ACCESS_TOKEN` is a second Cloudflare Secret. It protects the endpoint from casual unauthorised use. It is not a replacement for the OpenAI key.
- Only the published Diet Tracker origin and the local preview origin receive CORS responses.
- Food and category text are treated as data, not instructions.
- Requests are capped to 12 per 10 minutes per Worker isolate. Configure a Cloudflare rate-limiting rule as an additional boundary.
- The Worker requests structured JSON and verifies category IDs and numeric ranges before returning an estimate.
- OpenAI Responses are sent with `store: false`.

## Set up Cloudflare

1. Create or sign in to a [Cloudflare account](https://dash.cloudflare.com/).
2. In **Workers & Pages**, choose **Create application**, then **Create Worker**.
3. Name it `diet-tracker-estimator`, then open **Edit code**.
4. Replace the default Worker code with [src/index.js](src/index.js) and click **Deploy**.
5. Open the Worker **Settings**, then **Variables and Secrets**.
6. Add a **Secret** named `OPENAI_API_KEY`. Its value is in the ignored local file `worker/.dev.vars`; copy only the value after the equals sign. Do not put it in GitHub, the app, or a normal Cloudflare variable.
7. Add a second **Secret** named `APP_ACCESS_TOKEN`. Generate a long random value with a password manager and retain it privately. This is the value the Diet Tracker app will use to reach the Worker.
8. Under the Worker **Triggers**, copy the `*.workers.dev` address and append `/estimate`. This is the endpoint to enter into the app's Personal estimator settings once that UI is added.
9. In Cloudflare **Security > WAF > Rate limiting rules**, create a rule for this Worker URL that limits `POST /estimate` to a small personal-use threshold, such as 20 requests per 10 minutes per IP address. This supplements the Worke{�u���Ys lightweight in-memory limit.
10. Test only after both secrets are present. A successful request must have an `Origin` of `https://barbararobson.github.io`, an `Authorization: Bearer ...` header containing the access token, and JSON containing `foodText` plus the app's category list.

## Local development

The real `.dev.vars` file is ignored by Git. It currently contains only `OPENAI_API_KEY`. Before local Worker testing, add a locally generated `APP_ACCESS_TOKEN` to that same ignored file. The included [.dev.vars.example](.dev.vars.example) shows the format.

With Node.js available:

```powershell
cd "C:\Users\brobson\CSIRO Diet Tracker\worker"
npx wrangler dev
```

Do not run `wrangler secret put` with an OpenAI key on a shared screen or paste the key into source code.

<!-- metadata: GPT-5 Codex; time: 2026-08-11 Australia/Sydney; date: 2026-08-11; prompt: Start a personal branch and set up a secure Cloudflare Worker backed unit estimator without exposing the OpenAI API key. -->
