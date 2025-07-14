document.getElementById('mdBtn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: exportChatGPTMarkdown
    });
  });
});

function exportChatGPTMarkdown() {
  function escapeMarkdown(text) {
    return text.replace(/([\\`*_[\]<>~])/g, '\\$1');
  }

  function htmlToMarkdown(el, listLevel = 0) {
    if (!el) return '';

    const blockTags = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN']);
    const newlineTags = new Set(['BR', 'TR', 'HR']);
    const listTags = new Set(['UL', 'OL']);
    const tableTags = new Set(['TABLE', 'THEAD', 'TBODY', 'TR']);

    if (el.nodeType === Node.TEXT_NODE) {
      return escapeMarkdown(el.textContent);
    }

    if (el.tagName === 'PRE') {
      const codeEl = el.querySelector('code');
      if (codeEl) {
        const langClass = [...codeEl.classList].find(c => c.startsWith('language-')) || '';
        const lang = langClass.replace('language-', '');
        const codeText = codeEl.textContent.trim();
        return `\n\`\`\`${lang}\n${codeText}\n\`\`\`\n`;
      } else {
        return `\n\`\`\`\n${el.textContent.trim()}\n\`\`\`\n`;
      }
    }

    if (el.tagName === 'STRONG' || el.tagName === 'B') {
      return `**${Array.from(el.childNodes).map(child => htmlToMarkdown(child, listLevel)).join('')}**`;
    }

    if (el.tagName === 'EM' || el.tagName === 'I') {
      return `*${Array.from(el.childNodes).map(child => htmlToMarkdown(child, listLevel)).join('')}*`;
    }

    if (el.tagName === 'DEL' || el.tagName === 'S' || el.tagName === 'STRIKE') {
      return `~~${Array.from(el.childNodes).map(child => htmlToMarkdown(child, listLevel)).join('')}~~`;
    }

    if (el.tagName === 'A') {
      const href = el.getAttribute('href') || '';
      const title = Array.from(el.childNodes).map(child => htmlToMarkdown(child, listLevel)).join('');
      return `[${title}](${href})`;
    }

    if (el.tagName === 'IMG') {
      const alt = el.getAttribute('alt') || '';
      const src = el.getAttribute('src') || '';
      return `![${alt}](${src})`;
    }

    if (el.tagName === 'BR') {
      return '  \n';
    }

    if (el.tagName === 'HR') {
      return '\n---\n';
    }

    if (el.tagName === 'BLOCKQUOTE') {
      const quoteContent = Array.from(el.childNodes).map(child => htmlToMarkdown(child, listLevel)).join('').trim();
      const quoted = quoteContent.split('\n').map(line => line ? '> ' + line : '> ').join('\n');
      return `\n${quoted}\n`;
    }

    if (el.tagName === 'UL' || el.tagName === 'OL') {
      let markdown = '\n';
      let index = 1;
      Array.from(el.children).forEach(li => {
        if (li.tagName !== 'LI') return;

        const indent = '  '.repeat(listLevel);
        const prefix = el.tagName === 'UL' ? '- ' : `${index}. `;
        index++;

        const liContent = Array.from(li.childNodes).map(child => htmlToMarkdown(child, listLevel + 1)).join('').trim();
        const liText = liContent.replace(/\n/g, '\n' + indent + '  ');

        markdown += indent + prefix + liText + '\n';
      });
      return markdown + '\n';
    }

    if (el.tagName === 'TABLE') {
      const rows = Array.from(el.querySelectorAll('tr'));
      if (rows.length === 0) return '';

      const headers = Array.from(rows[0].querySelectorAll('th,td')).map(th => htmlToMarkdown(th, listLevel).trim());
      const aligns = headers.map(() => '---');

      let mdTable = '\n| ' + headers.join(' | ') + ' |\n';
      mdTable += '| ' + aligns.join(' | ') + ' |\n';

      for (let i = 1; i < rows.length; i++) {
        const cols = Array.from(rows[i].querySelectorAll('td,th')).map(td => htmlToMarkdown(td, listLevel).trim());
        mdTable += '| ' + cols.join(' | ') + ' |\n';
      }
      return mdTable + '\n';
    }

    if (blockTags.has(el.tagName)) {
      const inner = Array.from(el.childNodes).map(child => htmlToMarkdown(child, listLevel)).join('').trim();
      return inner + '\n';
    }

    return Array.from(el.childNodes).map(child => htmlToMarkdown(child, listLevel)).join('');
  }

  function getContent() {
    const messages = document.querySelectorAll('[data-message-author-role]');
    let result = '';

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
      result += `${prefix} Message ${index + 1}\n\n${markdown}\n\n---\n\n`;
    });

    result = result.replace(/[ \t]+\n/g, '\n');      // 去掉行尾多余空格
    result = result.replace(/\n{3,}/g, '\n\n');       // 合并多个空行为两个
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
