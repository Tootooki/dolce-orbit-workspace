'use strict';
(() => {
const screen=document.getElementById('unlockScreen');
const message=document.getElementById('unlockMessage');
const form=document.getElementById('unlockForm');
const input=document.getElementById('accessKey');
const decode=value=>{const base=value.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(base+'='.repeat((4-base.length%4)%4)),c=>c.charCodeAt(0));};
let unlocking=false;
async function unlock(value){
 if(unlocking)return;unlocking=true;form.hidden=true;message.textContent='Unlocking your private task data…';
 try{
  const bytes=decode(value.trim());if(bytes.length!==32)throw Error('Invalid key');
  const response=await fetch('encrypted-data.json',{cache:'no-cache'});if(!response.ok)throw Error('Dataset unavailable');
  const payload=await response.json();
  const key=await crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['decrypt']);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(payload.iv)},key,decode(payload.ciphertext));
  const dataset=JSON.parse(new TextDecoder().decode(plain));if(!Array.isArray(dataset.areas)||dataset.task_count!==374)throw Error('Invalid dataset');
  window.TASK_DATA=dataset;
  try{sessionStorage.setItem('orbit-workspace-access',value.trim());}catch{}
  const script=document.createElement('script');script.src='app.js';script.onload=()=>{screen.remove();};script.onerror=()=>{message.textContent='The workspace could not load. Refresh to try again.';};document.head.append(script);
 }catch{
  message.textContent='Open your full private link, or enter the workspace access key.';form.hidden=false;unlocking=false;
 }
}
form.addEventListener('submit',event=>{event.preventDefault();unlock(input.value);});
let value=new URLSearchParams(location.hash.slice(1)).get('key');
if(!value)try{value=sessionStorage.getItem('orbit-workspace-access');}catch{}
if(value)unlock(value);else{message.textContent='Open your full private link, or enter the workspace access key.';form.hidden=false;}
})();
