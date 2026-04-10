chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'PARSE_HTML') return;

  try {
    const result = extractText(message.html, message.selector, message.selectorType);
    sendResponse({ content: result });
  } catch (err) {
    sendResponse({ error: err.message });
  }
  return true;
});

function extractText(html, selector, selectorType) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  for (const el of doc.querySelectorAll('script, style, noscript, svg')) {
    el.remove();
  }

  if (!selector) {
    return doc.body.innerText || doc.body.textContent || '';
  }

  if (selectorType === 'xpath') {
    const xResult = doc.evaluate(selector, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    const el = xResult.singleNodeValue;
    if (!el) {
      throw new Error(`XPath "${selector}" 未匹配到任何元素`);
    }
    return el.innerText || el.textContent || '';
  }

  const target = doc.querySelector(selector);
  if (!target) {
    throw new Error(`CSS 选择器 "${selector}" 未匹配到任何元素`);
  }
  return target.innerText || target.textContent || '';
}
