chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "export-chatgpt-md",
    title: "Export ChatGPT as Markdown",
    contexts: ["all"],
    documentUrlPatterns: ["https://chatgpt.com/*"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "export-chatgpt-md" && tab.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: exportChatGPTMarkdown
    });
  }
});

function exportChatGPTMarkdown() {
  function escapeMarkdown(text) {
    return text.replace(/([\\`*_[\]<>~])/g, '\\$1');
  }

  function htmlToMarkdown(el, listLevel = 0) {
    if (!el) return '';

    const blockTags = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN']);
    const tableTags = new Set(['TABLE', 'THEAD', 'TBODY', 'TR']);

    if (el.nodeType === Node.TEXT_NODE) {
      return escapeMarkdown(el.textContent.trim());
    }

    const tag = el.tagName;

    if (tag === 'PRE') {
      const codeEl = el.querySelector('code');
      const codeText = codeEl ? codeEl.textContent : el.textContent;
      const langClass = codeEl ? [...codeEl.classList].find(c => c.startsWith('language-')) : '';
      const lang = langClass ? langClass.replace('language-', '') : '';
      return `\n\`\`\`${lang}\n${codeText.trim()}\n\`\`\`\n`;
    }

    if (tag === 'STRONG' || tag === 'B') {
      return `**${innerContent()}**`;
    }

    if (tag === 'EM' || tag === 'I') {
      return `*${innerContent()}*`;
    }

    if (['DEL', 'S', 'STRIKE'].includes(tag)) {
      return `~~${innerContent()}~~`;
    }

    if (tag === 'A') {
      const href = el.getAttribute('href') || '';
      return `[${innerContent()}](${href})`;
    }

    if (tag === 'IMG') {
      const alt = el.getAttribute('alt') || '';
      const src = el.getAttribute('src') || '';
      return `![${alt}](${src})`;
    }

    if (tag === 'BR') return '  \n';
    if (tag === 'HR') return '\n---\n';

    if (tag === 'BLOCKQUOTE') {
      const quote = innerContent().split('\n').map(line => '> ' + line).join('\n');
      return `\n${quote}\n`;
    }

    if (tag === 'UL' || tag === 'OL') {
      let index = 1;
      return '\n' + Array.from(el.children).map(li => {
        if (li.tagName !== 'LI') return '';
        const indent = '  '.repeat(listLevel);
        const prefix = tag === 'UL' ? '- ' : `${index++}. `;
        let content = htmlToMarkdown(li, listLevel + 1).trim();
        content = content.replace(/\n/g, '\n' + indent + '  ');
        return `${indent}${prefix}${content}`;
      }).join('\n') + '\n';
    }

    if (tag === 'TABLE') {
      const rows = Array.from(el.querySelectorAll('tr'));
      if (rows.length === 0) return '';
      const headers = Array.from(rows[0].children).map(th => htmlToMarkdown(th, listLevel).trim());
      const aligns = headers.map(() => '---');
      let md = '\n| ' + headers.join(' | ') + ' |\n';
      md += '| ' + aligns.join(' | ') + ' |\n';
      for (let i = 1; i < rows.length; i++) {
        const cols = Array.from(rows[i].children).map(td => htmlToMarkdown(td, listLevel).trim());
        md += '| ' + cols.join(' | ') + ' |\n';
      }
      return md + '\n';
    }

    if (blockTags.has(tag)) {
      const inner = innerContent().trim();
      return inner ? inner + '\n\n' : '';
    }

    return innerContent();

    function innerContent() {
      return Array.from(el.childNodes).map(child => htmlToMarkdown(child, listLevel)).join('').trim();
    }
  }

  function getContent() {
    const messages = document.querySelectorAll('[data-message-author-role]');
    let result = '';

    messages.forEach((msg, index) => {
      const role = msg.getAttribute('data-message-author-role');
      const prefix = role === 'user' ? '### User' : '### ChatGPT';
      let contentEl = role === 'user'
        ? msg.querySelector('.whitespace-pre-wrap')
        : msg.querySelector('.markdown.prose');

      if (!contentEl) return;

      const markdown = htmlToMarkdown(contentEl).trim();
      result += `${prefix} Message ${index + 1}\n\n${markdown}\n\n---\n\n`;
    });

    return result || 'No conversation content found.';
  }

  const content = getContent();
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chatgpt_conversation.md';
  a.click();
}
