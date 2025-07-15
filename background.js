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

    if (el.nodeType === Node.TEXT_NODE) {
      return escapeMarkdown(el.textContent);
    }

    const tag = el.tagName;

    if (tag === 'PRE') {
      const codeEl = el.querySelector('code');
      const codeText = codeEl ? codeEl.textContent.trim() : el.textContent.trim();
      const langClass = codeEl ? [...codeEl.classList].find(c => c.startsWith('language-')) : '';
      const lang = langClass ? langClass.replace('language-', '') : '';
      return `\n\`\`\`${lang}\n${codeText}\n\`\`\`\n`;
    }

    if (tag === 'STRONG' || tag === 'B') {
      return `**${inner()}**`;
    }

    if (tag === 'EM' || tag === 'I') {
      return `*${inner()}*`;
    }

    if (['DEL', 'S', 'STRIKE'].includes(tag)) {
      return `~~${inner()}~~`;
    }

    if (tag === 'A') {
      const href = el.getAttribute('href') || '';
      return `[${inner()}](${href})`;
    }

    if (tag === 'IMG') {
      const alt = el.getAttribute('alt') || '';
      const src = el.getAttribute('src') || '';
      return `![${alt}](${src})`;
    }

    if (tag === 'BR') return '  \n';
    if (tag === 'HR') return '\n---\n';

    if (tag === 'BLOCKQUOTE') {
      const quote = inner().split('\n').map(line => '> ' + line).join('\n');
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
      const content = inner().trim();
      return content ? content + '\n\n' : '';
    }

    return inner();

    function inner() {
      return Array.from(el.childNodes).map(child => htmlToMarkdown(child, listLevel)).join('');
    }
  }

  function getContent() {
    const messages = document.querySelectorAll('[data-message-author-role]');
    const blocks = [];

    messages.forEach((msg, index) => {
      const role = msg.getAttribute('data-message-author-role');
      const prefix = role === 'user' ? '### User' : '### ChatGPT';

      let contentEl = null;
      if (role === 'user') {
        contentEl = msg.querySelector('.whitespace-pre-wrap');
      } else if (role === 'assistant') {
        contentEl = msg.querySelector('.markdown.prose');
      }

      if (!contentEl) return;

      const markdown = htmlToMarkdown(contentEl).trim();
      blocks.push(`${prefix} Message ${index + 1}\n\n${markdown}`);
    });

    const result = blocks.join('\n\n---\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    return result.trim();
  }

  const content = getContent();
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chatgpt_conversation.md';
  a.click();
}
