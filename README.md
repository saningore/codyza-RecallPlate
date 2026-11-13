# RecallPlate

RecallPlate searches published U.S. food recall records.

Searches use:

- openFDA food enforcement reports, from 2004, updated weekly
- FDA’s food safety recalls RSS feed for newer notices
- The USDA FSIS Recall API for meat, poultry, processed egg products, and public health alerts. FSIS rejects the application user agent, so those requests use a browser user agent.

The site repeats the text those sources return. It does not write a recall explanation. An empty result is not a statement that a food is safe. FDA Ongoing and USDA Active stay in separate groups from Completed, Terminated, and Closed records. Public health alerts stay out of the recall list.

## Run locally

Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and search `milk`, `peanut butter`, `chicken`, or `cheese`.

An optional openFDA key belongs in `.env.local`, which is not committed:

```
OPENFDA_API_KEY=
```

Without a key, openFDA allows 1,000 requests a day for the server address. The key stays on the server.

`RECALLPLATE_USE_FIXTURES=1` is refused. The server will not start with sample recalls.

## Checks

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run check:ready
```

`npm run check:ready` reads one live FDA milk record. If USDA does not respond, the script says so and still exits after the FDA read.

Powered by Codyza.
