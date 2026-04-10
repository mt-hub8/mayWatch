async function hmacSha256Base64(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(message),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(''));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function generateSign(secret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const stringToSign = `${timestamp}\n${secret}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(stringToSign),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(''));
  const sign = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return { timestamp, sign };
}

function buildMessage(change) {
  const time = new Date(change.detectedAt).toLocaleString('zh-CN');
  const lines = [
    [{ tag: 'text', text: '任务: ' }, { tag: 'text', text: change.taskName }],
    [{ tag: 'text', text: '页面: ' }, { tag: 'a', text: change.url, href: change.url }],
    [{ tag: 'text', text: `时间: ${time}` }],
    [{ tag: 'text', text: `变化: +${change.summary.addedLines} 新增 / -${change.summary.removedLines} 删除` }],
  ];

  if (change.isNumeric) {
    lines.push([{ tag: 'text', text: `当前值: ${change.numericValue}` }]);
  }

  return {
    msg_type: 'post',
    content: {
      post: {
        zh_cn: {
          title: '🔔 MayWatch 变化提醒',
          content: lines,
        },
      },
    },
  };
}

export async function sendFeishuNotification(webhookUrl, secret, change) {
  if (!webhookUrl) return;

  const payload = buildMessage(change);

  if (secret) {
    const { timestamp, sign } = await generateSign(secret);
    payload.timestamp = timestamp;
    payload.sign = sign;
  }

  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (data.code !== 0 && data.StatusCode !== 0) {
      console.warn('[MayWatch] 飞书通知失败:', data);
    }
    return data;
  } catch (err) {
    console.warn('[MayWatch] 飞书通知异常:', err.message);
    return null;
  }
}

export async function testFeishuWebhook(webhookUrl, secret) {
  const fakeChange = {
    taskName: 'MayWatch 测试',
    url: 'https://example.com',
    detectedAt: Date.now(),
    summary: { addedLines: 3, removedLines: 1 },
    isNumeric: true,
    numericValue: 42,
  };
  return sendFeishuNotification(webhookUrl, secret, fakeChange);
}
