# Crosscheck

Ask independent AI models the same question, compare their answers without model-name bias, vote for the most useful response, then reveal which model wrote each answer.

**This project is being built for [Pollinations Quest #19183](https://github.com/pollinations/pollinations/issues/19183).** The quest asks for an app built on Pollinations models where each user pays with their own Pollen. This prototype sends requests to the Pollinations OpenAI-compatible chat endpoint and supports the official Polli Connect consent widget or a personal API key held only in memory for the current tab.

[![Made with Pollinations](https://raw.githubusercontent.com/pollinations/pollinations/main/packages/ui/src/brand/badge-made-with.svg)](https://pollinations.ai)

## Run locally

1. In [enter.pollinations.ai](https://enter.pollinations.ai/), confirm the App Key configured in `index.html` belongs to this app. Add `http://localhost:8000/` and the final deployed site URL as redirect URIs, and allow the `text` model category.
2. The publishable `pk_...` App Key is already configured in `index.html`. It identifies Crosscheck; it is not a user API key.
3. Start a static server in this directory, for example `python -m http.server 8000`.
4. Open `http://localhost:8000/`, connect with Polli Connect, select models, and ask a question. The authorization widget caps its scoped key at 5 Pollen for 7 days. Disconnect in the widget or revoke the key in your Pollinations dashboard.

For local experimentation, the connection dialog also accepts a personal `sk_...` key. It is held in JavaScript memory only and disappears on reload. The publishable `pk_...` App Key cannot authenticate generation requests; use Polli Connect to authorize a user key instead. Never paste a secret key into a public website or commit it to this repository.

## How it works

- The current public `/models` list populates the picker; non-text and paid-only entries are filtered out.
- The cross-lab panel button selects up to six providers, and users can choose up to eight models total.
- Each request uses the exact same user prompt and runs concurrently. A single model failure does not discard other answers.
- Answers are labeled by voice until the reader reveals model identities. Readers can vote for the most useful answer before revealing them.
- The app is static HTML/CSS/JavaScript and can be hosted on any static host. No backend stores prompts, answers, or credentials.

## Quest status

This is a local prototype. To submit it for the quest, deploy it publicly, add a 16:9 screenshot (at least 1280×720 and under 5 MB) to the Pollinations app-submission form, include `#19183` in its Quest field, and link the live app and this public repository. The quest says maintainers select the best entry if multiple apps are submitted.
