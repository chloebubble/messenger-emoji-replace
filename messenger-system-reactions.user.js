// ==UserScript==
// @name         Messenger System Reactions (macOS)
// @namespace    https://messenger.com/
// @version      1.2.0
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
  const IMAGE_KIND = "image";
  const CONTROL_KIND = "control";
  const THUMBS_UP_EMOJI = "\u{1F44D}";
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

    for (const [name, emoji] of REACTIONS) {
      if (label === name || label.includes(name)) return emoji;
    }

    // If alt/title already contains an emoji, use only that glyph.
    const emojiMatch = rawLabel.trim().match(/\p{Extended_Pictographic}\u{FE0F}?/u);
    if (emojiMatch) return emojiMatch[0];

    return null;
  }

  function getPreferredSizePx(el) {
    if (!el || !(el instanceof Element)) return 20;

    const computed = window.getComputedStyle(el);
    const candidates = [
      el.getBoundingClientRect().width,
      el.getBoundingClientRect().height,
      parseFloat(computed.width),
      parseFloat(computed.height),
      parseFloat(computed.fontSize),
      Number(el.getAttribute("width")),
      Number(el.getAttribute("height")),
    ].filter((v) => Number.isFinite(v) && v > 0);

    if (candidates.length === 0) return 20;
    return Math.max(...candidates);
  }

  function applyEmojiSpanStyles(span, sizePx = 20) {
    span.style.display = "inline-flex";
    span.style.flex = "none";
    span.style.alignItems = "center";
    span.style.justifyContent = "center";
    span.style.fontFamily =
      '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    span.style.fontSize = `${sizePx}px`;
    span.style.lineHeight = "1";
    span.style.width = `${sizePx}px`;
    span.style.height = `${sizePx}px`;
    span.style.verticalAlign = "middle";
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

  function isProtectedQuickLikeControl(el, emoji, label) {
    if (emoji !== THUMBS_UP_EMOJI) return false;

    const control = findControl(el);
    if (!control) return false;

    const controlLabel = normalizeLabel(findLabel(control));
    const sourceLabel = normalizeLabel(label);
    const combinedLabel = `${controlLabel} ${sourceLabel}`.trim();
    const isBareLikeLabel = [controlLabel, sourceLabel].some((value) =>
      /^(like|thumbs up)$/.test(value)
    );
    return (
      /\b(like|thumbs up)\b/.test(combinedLabel) &&
      (/\b(send|quick reaction|quick react)\b/.test(combinedLabel) ||
        (isBareLikeLabel && isNearComposerInput(control)))
    );
  }

  function isNearComposerInput(control) {
    let container = control.parentElement;
    for (let depth = 0; container && depth < 5; depth += 1) {
      if (
        container.querySelector(
          '[contenteditable="true"], textarea, input[type="text"]'
        )
      ) {
        return true;
      }
      container = container.parentElement;
    }
    return false;
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

  function findBestImageLabel(img, labelOverride = null) {
    if (labelOverride) return labelOverride;

    const control = findControl(img);
    const controlLabel = control && control !== img ? findLabel(control) : "";
    if (mapLabelToEmoji(controlLabel)) return controlLabel;

    const ancestorLabel = findAncestorLabel(img);
    if (mapLabelToEmoji(ancestorLabel)) return ancestorLabel;

    return findLabel(img);
  }

  function findAncestorLabel(el) {
    let ancestor = el.parentElement;
    for (let depth = 0; ancestor && depth < 4; depth += 1) {
      const label = findLabel(ancestor);
      if (label) return label;
      ancestor = ancestor.parentElement;
    }
    return "";
  }

  function getDecorationSizePx(source, span) {
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
    if (!emoji || isProtectedQuickLikeControl(img, emoji, effectiveLabel)) {
      removeImageDecoration(img);
      return;
    }

    const span = ensureImageEmojiSpan(img);
    updateEmojiSpan(span, emoji, effectiveLabel, getDecorationSizePx(img, span));
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
      span.remove();
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
    for (const mutation of mutations) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        scheduleProcess();
        return;
      }
      if (mutation.type === "attributes") {
        scheduleProcess();
        return;
      }
    }
  });

  process(document);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-label", "title", "alt", "data-tooltip-content", "src"],
  });
})();
