# Debugging Messenger emoji replacements

## Two different features

Messenger has message reactions and a composer quick-send control. Do not use one feature's rules for the other.

The quick-send control sits at the right side of the composer. Its default value is a thumbs-up emoji.

The control can use a custom emoji. Its accessible label has the form `Send a <emoji>`.

## Root causes from the 1.2.5 to 1.2.13 regression

The inner quick-send image can have a different label from its button.

The image showed a pencil label during this regression.

The button had the correct `Send a crayon` label. The script must use the button label for this control.

An image-sized sibling span did not work inside Messenger's quick-send wrappers. Messenger resized, offset, and clipped that span.

A fixed font size did not solve the placement problem. Strong size rules only changed the visible clipped fragment.

The final fix mounts a 20-pixel span directly on the button. Absolute centering removes the inner wrapper from layout control.

The general message-reaction path still uses image labels first. Reversing that order can cause shared-control label collisions.

## Diagnostic sequence

Use the visible symptom to isolate the failed stage:

1. A wrong emoji indicates a label-selection error.
2. A large cropped emoji indicates a size or transform error.
3. A small sliver indicates a placement or clipping error.
4. A correct centered emoji confirms label, size, and placement.

Inspect the accessible control label before changing selectors. For the quick-send control, expect `Send a <emoji>`.

Do not infer layout from the source image dimensions. Messenger can use sprite wrappers and clipped containers.

## Firefox Computer Use notes

Use the Firefox bundle ID `org.mozilla.firefox` when display-name actions fail.

Fetch fresh app state after each action. Accessibility element indexes become stale after UI changes.

A stale Firefox context menu can hide all page controls. It can also cause `-10005 noWindowsAvailable` errors.

Press `Escape` to close a stale menu. Then fetch full app state again.

Use `F6` to move focus between Firefox chrome and page content.

Prefer accessible element actions over coordinate clicks. Messenger exposes the composer as `Write to <chat>`.

Before sending a test message, verify the window title, URL, composer value, and target chat.

After sending, verify both `Message sent` and the new `You:` message node.

## Verification

1. Update the userscript manager to the latest version.
2. Fully reload Messenger.
3. Confirm that the default thumbs-up quick-send emoji is centered.
4. Select a custom quick-send emoji.
5. Confirm that the button shows the selected emoji.
6. Confirm that the emoji remains centered and approximately 20 pixels tall.
7. Send the quick emoji and confirm that Messenger sends the selected value.
8. Check normal message reactions for label collisions or changed sizes.

Run these local checks before each commit:

```sh
node --check messenger-system-reactions.user.js
git diff --check
```
