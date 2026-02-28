// ==UserScript==
// @name         Messenger System Reactions (macOS)
// @namespace    https://messenger.com/
// @version      1.0.0
// @description  Replace Facebook-style Messenger reaction icons with system emoji glyphs.
// @author       Chloe Bubbles
// @license		 MIT
// @match        https://www.messenger.com/*
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

    // If alt/title already contains an emoji, use it directly.
    if (/\p{Extended_Pictographic}/u.test(label)) return rawLabel.trim();

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

  function makeEmojiSpan(emoji, sizePx = 20) {
    const span = document.createElement("span");
    span.textContent = emoji;
    span.setAttribute(DONE_ATTR, "1");
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
    return span;
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

  function replaceImageReaction(img) {
    if (img.hasAttribute(DONE_ATTR)) return;
    const label = findLabel(img);
    const emoji = mapLabelToEmoji(label);
    if (!emoji) return;

    const span = makeEmojiSpan(emoji, getPreferredSizePx(img));
    if (img.parentElement) {
      img.parentElement.replaceChild(span, img);
    }
  }

  function replaceButtonReaction(el) {
    if (el.hasAttribute(DONE_ATTR)) return;

    const label = findLabel(el);
    const emoji = mapLabelToEmoji(label);
    if (!emoji) return;

    // Prefer replacing an icon image inside the control first.
    const iconImg = el.querySelector("img[alt], img[aria-label], img[title]");
    if (iconImg) {
      const span = makeEmojiSpan(emoji, getPreferredSizePx(iconImg));
      iconImg.replaceWith(span);
      el.setAttribute(DONE_ATTR, "1");
      return;
    }

    // Fallback: if no icon image exists, replace element text.
    if (!el.textContent || el.textContent.trim() === "") {
      el.textContent = emoji;
      el.style.fontFamily =
        '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      el.style.lineHeight = "1";
      el.setAttribute(DONE_ATTR, "1");
    }
  }

  function process(root) {
    if (!(root instanceof Element || root instanceof Document)) return;

    const images = root.querySelectorAll("img[alt], img[aria-label], img[title]");
    for (const img of images) {
      replaceImageReaction(img);
    }

    const controls = root.querySelectorAll(
      'button[aria-label], div[role="button"][aria-label], span[aria-label], [title], [data-tooltip-content]'
    );
    for (const el of controls) {
      replaceButtonReaction(el);
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
    attributeFilter: ["aria-label", "title", "alt", "data-tooltip-content"],
  });
})();
