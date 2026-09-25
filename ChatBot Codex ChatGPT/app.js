const form=document.getElementById('chatForm');
const input=document.getElementById('chatInput');
const messages=document.getElementById('dynamicMessages');
const chatBody=document.getElementById('chatBody');
const toast=document.getElementById('toast');
const history=[];
let toastTimer;

function notify(message){toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2800)}
function formatReply(text){
  const safe=text.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  return safe.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\*(.+?)\*/g,'<i>$1</i>').replace(/`(.+?)`/g,'<code>$1</code>').replace(/\n/g,'<br>');
}
async function send(text){
  const value=text.trim();if(!value)return;
  const user=document.createElement('div');user.className='user-message';user.textContent=value;messages.appendChild(user);
  history.push({role:'user',content:value});input.value='';input.style.height='auto';input.disabled=true;
  const wait=document.createElement('div');wait.className='assistant-reply';wait.innerHTML='<div class="bot-avatar">✳</div><div class="typing"><i></i><i></i><i></i></div>';messages.appendChild(wait);chatBody.scrollTop=chatBody.scrollHeight;
  try{
    const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);
    history.push({role:'assistant',content:data.reply});wait.innerHTML=`<div class="bot-avatar">✳</div><div class="reply-content">${formatReply(data.reply)}</div>`;
  }catch(error){history.pop();wait.innerHTML=`<div class="bot-avatar">✳</div><div class="reply-content">I couldn't reach the workshop AI. ${formatReply(error.message)}<br><span style="color:#8b958e">Check that the local server is running and your Groq key is configured.</span></div>`}
  finally{input.disabled=false;input.focus();chatBody.scrollTop=chatBody.scrollHeight}
}
form.addEventListener('submit',e=>{e.preventDefault();send(input.value)});
input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(input.value)}});
input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,80)+'px'});
document.querySelectorAll('[data-prompt]').forEach(button=>button.addEventListener('click',()=>send(button.dataset.prompt)));
document.getElementById('allBookings').addEventListener('click',()=>send("Show me today's schedule"));
document.getElementById('viewSchedule').addEventListener('click',()=>send("Show me today's schedule"));
document.querySelectorAll('.nav-item').forEach(item=>item.addEventListener('click',e=>{if(!item.classList.contains('active')){e.preventDefault();notify(`${item.textContent.trim()} view is part of the workshop dashboard demo`)}}));
document.querySelector('.attach-button').addEventListener('click',()=>notify('File attachments are not available in this local demo.'));
document.addEventListener('click',e=>{if(e.target.classList.contains('draft-button'))notify('Draft saved for review in this chat.')});
