let offscreenReady = false;

async function ensureOffscreen() {
  if (offscreenReady) return;

  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: 'background/offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: 'Parse fetched HTML and extract text content',
    });
  }

  offscreenReady = true;
}

async function findTabForUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const pattern = `${parsedUrl.origin}${parsedUrl.pathname}*`;
    const tabs = await chrome.tabs.query({ url: pattern });
    if (tabs.length > 0) {
      return tabs.find(t => t.status === 'complete') || tabs[0];
    }
  } catch { /* ignore */ }
  return null;
}

async function extractFromTab(tabId, selector, selectorType) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel, selType) => {
      if (!sel) {
        return { content: document.body.innerText || document.body.textContent || '' };
      }
      if (selType === 'xpath') {
        const xResult = document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const el = xResult.singleNodeValue;
        if (!el) return { error: `XPath "${sel}" 未匹配到任何元素` };
        return { content: el.innerText || el.textContent || '' };
      }
      const el = document.querySelector(sel);
      if (!el) return { error: `CSS 选择器 "${sel}" 未匹配到任何元素` };
      return { content: el.innerText || el.textContent || '' };
    },
    args: [selector || null, selectorType || 'css'],
  });

  if (!results || results.length === 0) {
    throw new Error('脚本执行失败');
  }

  const result = results[0].result;
  if (result?.error) {
    throw new Error(result.error);
  }
  return result?.content || '';
}

async function fetchAndParse(url, selector, selectorType) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MayWatch/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();

  await ensureOffscreen();

  const result = await chrome.runtime.sendMessage({
    type: 'PARSE_HTML',
    html,
    selector: selector || null,
    selectorType: selectorType || 'css',
  });

  if (result?.error) {
    throw new Error(result.error);
  }

  return result?.content || '';
}

export async function fetchPageContent(url, selector, selectorType) {
  const tab = await findTabForUrl(url);

  if (tab) {
    try {
      return await extractFromTab(tab.id, selector, selectorType);
    } catch (tabErr) {
      console.warn('[MayWatch] Tab 提取失败，回退到 fetch:', tabErr.message);
    }
  }

  return await fetchAndParse(url, selector, selectorType);
}
