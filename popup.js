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
    // 转义 Markdown 特殊字符
    return text.replace(/([\\`*_[\]<>~])/g, '\\$1');
  }

  function htmlToMarkdown(el, listLevel = 0) {
    if (!el) return '';

    const blockTags = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN']);
    const newlineTags = new Set(['BR', 'TR', 'HR']);
    const listTags = new Set(['UL', 'OL']);
    const tableTags = new Set(['TABLE', 'THEAD', 'TBODY', 'TR']);
    
    // 文本节点
    if (el.nodeType === Node.TEXT_NODE) {
      return escapeMarkdown(el.textContent);
    }

    // 代码块单独处理
    if (el.tagName === 'PRE') {
      const codeEl = el.querySelector('code');
      if (codeEl) {
        const langClass = [...codeEl.classList].find(c => c.startsWith('language-')) || '';
        const lang = langClass.replace('language-', '');
        const codeText = codeEl.textContent;
        return `\n\`\`\`${lang}\n${codeText}\n\`\`\`\n`;
      } else {
        // 没有code标签的pre，直接输出文本
        return `\n\`\`\`\n${el.textContent}\n\`\`\`\n`;
      }
    }

    // 粗体
    if (el.tagName === 'STRONG' || el.tagName === 'B') {
      return `**${Array.from(el.childNodes).map(child => htmlToMarkdown(child, listLevel)).join('')}**`;
    }

    // 斜体
    if (el.tagName === 'EM' || el.tagName === 'I') {
      return `*${Array.from(el.childNodes).map(child => htmlToMarkdown(child, listLevel)).join('')}*`;
    }

    // 删除线
    if (el.tagName === 'DEL' || el.tagName === 'S' || el.tagName === 'STRIKE') {
      return `~~${Array.from(el.childNodes).map(child => htmlToMarkdown(child, listLevel)).join('')}~~`;
    }

    // 链接
    if (el.tagName === 'A') {
      const href = el.getAttribute('href') || '';
      const title = Array.from(el.childNodes).map(child => htmlToMarkdown(child, listLevel)).join('');
      return `[${title}](${href})`;
    }

    // 图片
    if (el.tagName === 'IMG') {
      const alt = el.getAttribute('alt') || '';
      const src = el.getAttribute('src') || '';
      return `![${alt}](${src})`;
    }

    // 换行
    if (el.tagName === 'BR') {
      return '  \n';
    }

    // 水平线
    if (el.tagName === 'HR') {
      return '\n---\n';
    }

    // 引用块
    if (el.tagName === 'BLOCKQUOTE') {
      const quoteContent = Array.from(el.childNodes).map(child => htmlToMarkdown(child, listLevel)).join('');
      const quoted = quoteContent.split('\n').map(line => line ? '> ' + line : '> ').join('\n');
      return `\n${quoted}\n`;
    }

    // 列表
    if (el.tagName === 'UL' || el.tagName === 'OL') {
      let markdown = '\n';
      let index = 1;
      Array.from(el.children).forEach(li => {
        if (li.tagName !== 'LI') return;

        const indent = '  '.repeat(listLevel);
        let prefix = el.tagName === 'UL' ? '- ' : `${index}. `;
        index++;

        const liContent = Array.from(li.childNodes).map(child => htmlToMarkdown(child, listLevel + 1)).join('');

        // 多行列表项要缩进换行
        let liText = liContent.replace(/\n/g, '\n' + indent + '  ');

        markdown += indent + prefix + liText + '\n';
      });
      return markdown + '\n';
    }

    // 表格处理
    if (el.tagName === 'TABLE') {
      const rows = Array.from(el.querySelectorAll('tr'));
      if (rows.length === 0) return '';

      // 取第一行为表头
      const headers = Array.from(rows[0].querySelectorAll('th,td')).map(th => htmlToMarkdown(th, listLevel).trim());
      const aligns = headers.map(() => '---');

      let mdTable = '\n| ' + headers.join(' | ') + ' |\n';
      mdTable += '| ' + aligns.join(' | ') + ' |\n';

      // 后续为表格内容行
      for (let i = 1; i < rows.length; i++) {
        const cols = Array.from(rows[i].querySelectorAll('td,th')).map(td => htmlToMarkdown(td, listLevel).trim());
        mdTable += '| ' + cols.join(' | ') + ' |\n';
      }
      return mdTable + '\n';
    }

    // 块级元素换行处理
    if (blockTags.has(el.tagName)) {
      const inner = Array.from(el.childNodes).map(child => htmlToMarkdown(child, listLevel)).join('');
      return inner + '\n\n';
    }

    // 默认递归处理所有子节点
    return Array.from(el.childNodes).map(child => htmlToMarkdown(child, listLevel)).join('');
  }

  function getContent() {
    const messages = document.querySelectorAll('[data-message-author-role]');
    let result = '';

    messages.forEach((msg, index) => {
      const role = msg.getAttribute('data-message-author-role');
      const prefix = role === 'user' ? '### User' : '### ChatGPT';

      // 选择不同内容容器，用户一般在.whitespace-pre-wrap，AI一般在.markdown.prose
      let contentEl = null;
      if (role === 'user') {
        contentEl = msg.querySelector('.whitespace-pre-wrap');
      } else if (role === 'assistant') {
        contentEl = msg.querySelector('.markdown.prose');
      }

      if (!contentEl) return;

      const markdown = htmlToMarkdown(contentEl);

      result += `${prefix} Message ${index + 1}\n\n${markdown}\n---\n\n`;
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
