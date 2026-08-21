# Messenger System Reactions

Userscript that replaces Facebook-style Messenger reaction icons with system emoji glyphs.

It also replaces the composer quick-send emoji. Messenger calls this control `Send a <emoji>`.

## Supported URLs

- `https://www.messenger.com/*`
- `https://www.facebook.com/messages/*`

## Install

Install [`messenger-system-reactions.user.js`](messenger-system-reactions.user.js) in your userscript manager.

Open a supported Messenger URL. Reload the page after each userscript update.

## Implementation notes

- Message reactions use their image label first. This avoids labels from shared parent controls.
- The composer quick-send button uses its `Send a <emoji>` control label first.
- The quick-send replacement uses a fixed 20-pixel size.
- The quick-send replacement mounts directly on the button.
- The source image stays hidden while the replacement is active.
- Inline `!important` rules stop Messenger from changing the replacement size.

See [docs/debugging.md](docs/debugging.md) for the regression history and test procedure.
