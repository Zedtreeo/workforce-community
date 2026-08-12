# Letter templates

The Community Edition ships **without** default letter templates (offer /
appointment / experience / service agreement) so the repo carries no
company-specific branding.

To enable letter generation, upload your own `.docx` templates in the app under
**Letters → Templates** (they use [Carbone](https://carbone.io) `{d.field}`
placeholders). Onboarding, offers, etc. work without them — the offer-letter PDF
attachment is simply skipped until a template is configured.
