document.getElementById('mdBtn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: exportChatGPTMarkdown
    });
  });
});

function exportChatGPTMarkdown() {
function getContent() {
  const blocks = document.querySelectorAll('.markdown.prose, .request-clipboard');
  let result = '';

  blocks.forEach(el => {
    const role = el.closest('.group')?.querySelector('.font-semibold')?.textContent || '';
    const prefix = role.includes('You') ? '### User' : '### ChatGPT';

    const clone = el.cloneNode(true);

    clone.querySelectorAll('pre').forEach(pre => {
      const codeEl = pre.querySelector('code');
      if (codeEl) {
        const lang = [...codeEl.classList].find(cls => cls.startsWith('language-'))?.replace('language-', '') || '';
        const codeText = codeEl.textContent;
        const mdCode = `\`\`\`${lang}\n${codeText}\n\`\`\``;

        const newNode = document.createElement('p');
        newNode.textContent = mdCode;
        pre.replaceWith(newNode);
      }
    });

    const text = clone.innerText.trim();
    result += `${prefix}\n\n${text}\n\n`;
  });

  return result || 'No conversation content found.';
}

  const content = getContent();
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chatgpt_conversation.md';
  a.click();
}
