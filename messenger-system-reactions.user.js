// ==UserScript==
// @name         Messenger System Reactions (macOS)
// @namespace    https://messenger.com/
// @version      1.2.14
// @description  Replace Facebook-style Messenger reaction icons with system emoji glyphs.
// @author       Chloe Bubbles
// @license		 MIT
// @match        https://www.messenger.com/*
// @match        https://www.facebook.com/messages/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const REACTIONS = new Map([
    ["like", "\u{1F44D}"],     // 👍
    ["thumbs up", "\u{1F44D}"],// 👍
    ["love", "\u{2764}\u{FE0F}"], // ❤️
    ["care", "\u{1F917}"],     // 🤗
    ["haha", "\u{1F606}"],     // 😆
    ["laugh", "\u{1F606}"],    // 😆
    ["wow", "\u{1F62E}"],      // 😮
    ["sad", "\u{1F622}"],      // 😢
    ["angry", "\u{1F621}"],    // 😡
  ]);

  const DONE_ATTR = "data-vm-system-reaction";
  const KIND_ATTR = "data-vm-system-reaction-kind";
  const LABEL_ATTR = "data-vm-system-reaction-label";
  const EMOJI_ATTR = "data-vm-system-reaction-emoji";
  const SIZE_ATTR = "data-vm-system-reaction-size";
  const HIDDEN_SOURCE_ATTR = "data-vm-system-reaction-hidden-source";
  const ORIGINAL_DISPLAY_ATTR = "data-vm-system-reaction-original-display";
  const ORIGINAL_POSITION_ATTR = "data-vm-system-reaction-original-position";
  const IMAGE_KIND = "image";
  const CONTROL_KIND = "control";
  const QUICK_SEND_SIZE_PX = 20;
  const CONTROL_SELECTOR = 'button, [role="button"], a[href]';

  function normalizeLabel(value) {
    return (value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function mapLabelToEmoji(rawLabel) {
    const label = normalizeLabel(rawLabel);
    if (!label) return null;

    const emoji = extractReactionEmoji(rawLabel);
    if (emoji) return emoji;

    for (const [name, emoji] of REACTIONS) {
      if (label === name) return emoji;
    }

    return null;
  }

  function isQuickSendLabel(rawLabel) {
    // Messenger labels this control `Send a <emoji>`. Match only the label
    // start, so that other labels that contain "send" do not match.
    return /^send\b/.test(normalizeLabel(rawLabel));
  }

  // Match full emoji sequences first: skin tones, ZWJ sequences, flags, and
  // keycaps. Then match single pictographs that are not RGI sequences.
  const EMOJI_PATTERN = /\p{RGI_Emoji}|\p{Extended_Pictographic}\u{FE0F}?/gv;

  function extractReactionEmoji(rawLabel) {
    const trimmedLabel = rawLabel.trim();
    const emojiMatches = [...trimmedLabel.matchAll(EMOJI_PATTERN)];
    if (emojiMatches.length !== 1) return null;

    const label = normalizeLabel(trimmedLabel);
    const emoji = emojiMatches[0][0];
    const isOnlyEmoji = label === normalizeLabel(emoji);
    const isMessageReactionLabel = /\b(reacted|reaction|reactions)\b/.test(label);
    return isOnlyEmoji || isMessageReactionLabel || isQuickSendLabel(label)
      ? emoji
      : null;
  }

  function getPreferredSizePx(el) {
    if (!el || !(el instanceof Element)) return 20;

    const computed = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const sizeGroups = [
      [parseFloat(computed.width), parseFloat(computed.height)],
      [rect.width, rect.height],
      [Number(el.getAttribute("width")), Number(el.getAttribute("height"))],
      [parseFloat(computed.fontSize)],
    ];

    for (const group of sizeGroups) {
      const sizes = group.filter((value) => Number.isFinite(value) && value > 0);
      if (sizes.length > 0) return Math.min(...sizes);
    }

    return 20;
  }

  function applyEmojiSpanStyles(span, sizePx = 20) {
    span.style.setProperty("display", "inline-flex", "important");
    span.style.setProperty("flex", "none", "important");
    span.style.setProperty("align-items", "center", "important");
    span.style.setProperty("justify-content", "center", "important");
    span.style.setProperty(
      "font-family",
      '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif',
      "important"
    );
    span.style.setProperty("font-size", `${sizePx}px`, "important");
    span.style.setProperty("line-height", "1", "important");
    span.style.setProperty("width", `${sizePx}px`, "important");
    span.style.setProperty("height", `${sizePx}px`, "important");
    span.style.setProperty("max-width", `${sizePx}px`, "important");
    span.style.setProperty("max-height", `${sizePx}px`, "important");
    span.style.setProperty("vertical-align", "middle", "important");
    span.style.setProperty("transform", "none", "important");
    span.style.setProperty("scale", "1", "important");
    // Messenger frequently dims icon containers in list/status rows.
    // Force full-color rendering for system emoji glyphs.
    span.style.setProperty("opacity", "1", "important");
    span.style.setProperty("filter", "none", "important");
    span.style.setProperty("mix-blend-mode", "normal", "important");
    span.style.setProperty("color", "initial", "important");
    span.style.setProperty("-webkit-text-fill-color", "initial", "important");
    span.style.setProperty("text-shadow", "none", "important");
  }

  function makeEmojiSpan(kind) {
    const span = document.createElement("span");
    span.setAttribute(DONE_ATTR, "1");
    span.setAttribute(KIND_ATTR, kind);
    return span;
  }

  function updateEmojiSpan(span, emoji, label, sizePx) {
    if (span.getAttribute(EMOJI_ATTR) !== emoji) {
      span.textContent = emoji;
      span.setAttribute(EMOJI_ATTR, emoji);
    }
    span.setAttribute(LABEL_ATTR, label || "");
    span.setAttribute(SIZE_ATTR, String(sizePx));
    applyEmojiSpanStyles(span, sizePx);
  }

  function findLabel(el) {
    return (
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      el.getAttribute("alt") ||
      el.getAttribute("data-tooltip-content") ||
      ""
    );
  }

  function findControl(el) {
    if (!(el instanceof Element)) return null;
    if (el.matches(CONTROL_SELECTOR)) return el;
    return el.closest(CONTROL_SELECTOR);
  }

  function hideSource(el) {
    if (!el.hasAttribute(HIDDEN_SOURCE_ATTR)) {
      el.setAttribute(ORIGINAL_DISPLAY_ATTR, el.style.display || "");
    }
    el.setAttribute(HIDDEN_SOURCE_ATTR, "1");
    el.style.setProperty("display", "none", "important");
  }

  function restoreSource(el) {
    if (!el.hasAttribute(HIDDEN_SOURCE_ATTR)) return;

    const originalDisplay = el.getAttribute(ORIGINAL_DISPLAY_ATTR);
    if (originalDisplay) {
      el.style.display = originalDisplay;
    } else {
      el.style.removeProperty("display");
    }
    el.removeAttribute(HIDDEN_SOURCE_ATTR);
    el.removeAttribute(ORIGINAL_DISPLAY_ATTR);
  }

  function findImageEmojiSpan(img) {
    const span = img.nextElementSibling;
    if (
      span &&
      span.hasAttribute(DONE_ATTR) &&
      span.getAttribute(KIND_ATTR) === IMAGE_KIND
    ) {
      return span;
    }
    return null;
  }

  function ensureImageEmojiSpan(img) {
    const existingSpan = findImageEmojiSpan(img);
    if (existingSpan) return existingSpan;

    const span = makeEmojiSpan(IMAGE_KIND);
    img.after(span);
    return span;
  }

  function removeImageDecoration(img) {
    findImageEmojiSpan(img)?.remove();
    restoreSource(img);
  }

  function findControlEmojiSpan(control) {
    return Array.from(control.children).find(
      (child) =>
        child.hasAttribute(DONE_ATTR) &&
        child.getAttribute(KIND_ATTR) === CONTROL_KIND
    );
  }

  function ensureControlEmojiSpan(control) {
    const existingSpan = findControlEmojiSpan(control);
    if (existingSpan) return existingSpan;

    const span = makeEmojiSpan(CONTROL_KIND);
    control.append(span);
    return span;
  }

  function prepareQuickSendControl(control) {
    if (window.getComputedStyle(control).position !== "static") return;

    if (!control.hasAttribute(ORIGINAL_POSITION_ATTR)) {
      control.setAttribute(ORIGINAL_POSITION_ATTR, control.style.position || "");
    }
    control.style.setProperty("position", "relative", "important");
  }

  function restoreQuickSendControl(control) {
    if (!control.hasAttribute(ORIGINAL_POSITION_ATTR)) return;

    const originalPosition = control.getAttribute(ORIGINAL_POSITION_ATTR);
    if (originalPosition) {
      control.style.position = originalPosition;
    } else {
      control.style.removeProperty("position");
    }
    control.removeAttribute(ORIGINAL_POSITION_ATTR);
  }

  function removeControlDecoration(span) {
    const control = span.parentElement;
    span.remove();
    if (control instanceof Element) restoreQuickSendControl(control);
  }

  function removeQuickSendDecoration(img) {
    const control = findControl(img);
    const span = control && findControlEmojiSpan(control);
    if (span && span.vmSystemReactionSource === img) {
      removeControlDecoration(span);
    }
  }

  function decorateQuickSend(img, control, emoji, label) {
    // The nested image wrapper clips replacement siblings. Mount the emoji on
    // the semantic quick-send button and use the button as the layout boundary.
    removeImageDecoration(img);
    prepareQuickSendControl(control);

    const span = ensureControlEmojiSpan(control);
    span.vmSystemReactionSource = img;
    updateEmojiSpan(span, emoji, label, QUICK_SEND_SIZE_PX);
    span.style.setProperty("position", "absolute", "important");
    span.style.setProperty("inset", "0", "important");
    span.style.setProperty("margin", "auto", "important");
    span.style.setProperty("padding", "0", "important");
    span.style.setProperty("pointer-events", "none", "important");
    hideSource(img);
  }

  function findBestImageLabel(img, labelOverride = null) {
    if (labelOverride) return labelOverride;

    const control = findControl(img);
    const controlLabel = control && control !== img ? findLabel(control) : "";
    // The quick-send image can describe a different emoji. Its button label is
    // authoritative because it contains the current `Send a <emoji>` value.
    if (
      isQuickSendLabel(controlLabel) &&
      mapLabelToEmoji(controlLabel)
    ) {
      return controlLabel;
    }

    const imageLabel = findLabel(img);
    if (mapLabelToEmoji(imageLabel)) return imageLabel;

    if (mapLabelToEmoji(controlLabel)) return controlLabel;

    return imageLabel;
  }

  function getDecorationSizePx(source, span, label) {
    if (isQuickSendLabel(label)) return QUICK_SEND_SIZE_PX;

    const storedSize = Number(span?.getAttribute(SIZE_ATTR));
    if (
      source.hasAttribute(HIDDEN_SOURCE_ATTR) &&
      Number.isFinite(storedSize) &&
      storedSize > 0
    ) {
      return storedSize;
    }

    return getPreferredSizePx(source);
  }

  function decorateImageReaction(img, labelOverride = null) {
    const effectiveLabel = findBestImageLabel(img, labelOverride);
    const emoji = mapLabelToEmoji(effectiveLabel);
    if (!emoji) {
      removeQuickSendDecoration(img);
      removeImageDecoration(img);
      return;
    }

    const control = findControl(img);
    if (control && isQuickSendLabel(effectiveLabel)) {
      decorateQuickSend(img, control, emoji, effectiveLabel);
      return;
    }

    // The image can stop being a quick-send source. Remove its old button
    // overlay, or the old emoji stays on top of the new decoration.
    removeQuickSendDecoration(img);
    const span = ensureImageEmojiSpan(img);
    updateEmojiSpan(
      span,
      emoji,
      effectiveLabel,
      getDecorationSizePx(img, span, effectiveLabel)
    );
    hideSource(img);
  }

  function refreshOwnedEmojiSpan(span) {
    const kind = span.getAttribute(KIND_ATTR);
    if (kind === IMAGE_KIND) {
      const source = span.previousElementSibling;
      if (source instanceof HTMLImageElement) {
        decorateImageReaction(source);
      } else {
        span.remove();
      }
      return;
    }

    if (kind === CONTROL_KIND) {
      const source = span.vmSystemReactionSource;
      const control = span.parentElement;
      if (
        source instanceof HTMLImageElement &&
        source.isConnected &&
        control?.contains(source)
      ) {
        decorateImageReaction(source);
      } else {
        removeControlDecoration(span);
      }
    }
  }

  function process(root) {
    if (!(root instanceof Element || root instanceof Document)) return;

    const images = root.querySelectorAll(
      `img[alt], img[aria-label], img[title], img[${HIDDEN_SOURCE_ATTR}]`
    );
    for (const img of images) {
      decorateImageReaction(img);
    }

    const ownedSpans = root.querySelectorAll(`[${DONE_ATTR}]`);
    for (const span of ownedSpans) {
      refreshOwnedEmojiSpan(span);
    }
  }

  let scheduled = false;
  function scheduleProcess() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      process(document);
    });
  }

  const observer = new MutationObserver((mutations) => {
    // Removals also need a pass. Messenger can remove a reaction image and
    // keep its parent. The replacement span then stays visible without a pass.
    if (mutations.length > 0) scheduleProcess();
  });

  process(document);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-label", "title", "alt", "data-tooltip-content", "src"],
  });
})();
