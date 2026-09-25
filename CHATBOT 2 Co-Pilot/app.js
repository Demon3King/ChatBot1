const conversation = document.querySelector('#conversation');
const form = document.querySelector('#chatForm');
const input = document.querySelector('#chatInput');
const suggestions = document.querySelector('#suggestions');
const newChatButton = document.querySelector('#newChatButton');

const responses = [
  {
    match: ['part', 'parts', 'stock', 'availability'],
    text: 'Parts are reserved for today\'s booked work except 5W-30 Synthetic, which is down to 2 units, and Civic brake pads, with 1 set left. Both are flagged low.'
  },
  {
    match: ['overview', 'today', 'happening', 'workshop'],
    text: 'The shop is moving well today: 8 jobs are in progress, 4 are ready for pickup, and 2 are waiting on approval. Bay 6 opens at 2:30 PM.'
  },
  {
    match: ['approval', 'approvals', 'waiting'],
    text: 'Two jobs need a customer decision: RO #1060 (AC compressor, $980 estimate) and RO #1062 (front suspension, $735 estimate). I can open either estimate for you.'
  },
  {
    match: ['pickup', 'ready', 'vehicle'],
    text: 'The four ready vehicles are the Toyota Hilux (Mia Chen), Mazda CX-5 (Samir Patel), Ford Transit (Northline Co.), and a Subaru Outback (Leah Brooks). Three invoices are already printed.'
  },
  {
    match: ['customer', 'mia', 'samir', 'northline'],
    text: 'I found the customer records. Mia Chen prefers SMS, Samir Patel prefers email, and Northline Co. has fleet billing enabled. Which one should I open?'
  }
];

function timeNow() {
  return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}

function appendMessage(text, from = 'assistant') {
  const item = document.createElement('div');
  item.className = `message ${from === 'user' ? 'user-message' : 'assistant-message'}`;
  item.innerHTML = from === 'user'
    ? `<div class="message-body"><span class="message-label">YOU <time>${timeNow()}</time></span><p>${text}</p></div><div class="user-mini-avatar">JM</div>`
    : `<div class="message-avatar">W</div><div class="message-body"><span class="message-label">WRENCHMATE <time>${timeNow()}</time></span><p>${text}</p></div>`;
  conversation.appendChild(item);
  item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function fallbackReplyFor(message) {
  const normalized = message.toLowerCase();
  const found = responses.find(response => response.match.some(keyword => normalized.includes(keyword)));
  return found?.text ?? 'I can help with jobs, customers, parts, pickup status, or today\'s workshop overview. Try asking about one of those.';
}

async function replyFor(message) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    if (!response.ok) throw new Error('API request failed');
    const data = await response.json();
    if (!data.reply) throw new Error('Empty API response');
    return data.reply;
  } catch (error) {
    return fallbackReplyFor(message);
  }
}

function sendMessage(message) {
  const trimmed = message.trim();
  if (!trimmed) return;
  appendMessage(trimmed, 'user');
  input.value = '';
  const typing = document.createElement('div');
  typing.className = 'message assistant-message';
  typing.innerHTML = '<div class="message-avatar">W</div><div class="message-body"><span class="message-label">WRENCHMATE <time>NOW</time></span><p class="typing">Checking the workshop board...</p></div>';
  conversation.appendChild(typing);
  typing.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  replyFor(trimmed).then(reply => {
    window.setTimeout(() => { typing.remove(); appendMessage(reply); }, 650);
  });
}

form.addEventListener('submit', event => { event.preventDefault(); sendMessage(input.value); });
suggestions.addEventListener('click', event => { const button = event.target.closest('[data-prompt]'); if (button) sendMessage(button.dataset.prompt); });
document.querySelectorAll('.job-row').forEach(row => row.addEventListener('click', () => sendMessage(row.dataset.prompt)));
newChatButton.addEventListener('click', () => { conversation.innerHTML = ''; appendMessage('Fresh board, same busy shop. What should we look into?'); input.focus(); });
