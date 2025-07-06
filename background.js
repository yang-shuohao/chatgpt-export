chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "export-chatgpt-md",
    title: "Export ChatGPT as Markdown",
    contexts: ["all"],
    documentUrlPatterns: ["https://chatgpt.com/*"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "export-chatgpt-md") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: exportChatGPTMarkdown
    });
  }
});

function exportChatGPTMarkdown() {
  function getContent() {
    const blocks = document.querySelectorAll('.markdown.prose, .request-clipboard');
    let result = '';
    blocks.forEach(el => {
      const role = el.closest('.group')?.querySelector('.font-semibold')?.textContent || '';
      const prefix = role.includes('You') ? '### User' : '### ChatGPT';
      result += `${prefix}\n\n${el.innerText.trim()}\n\n`;
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
