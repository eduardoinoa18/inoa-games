// Live party console on the hub (#party): host a phone-controller room, join one, start an online game.
import { net, partyPanel, resume, endParty } from './engine/net.js';
const $ = id => document.getElementById(id);
const render = () => { const on = net.role === 'host' && net.code; $('pcLive').hidden = !on; $('pcShow').hidden = !on; $('pcHost').textContent = on ? '✖ End party' : '📱 Start a party'; if (on) { $('pcCode').textContent = net.code; $('pcDots').innerHTML = net.pads().map(p => `<i title="${p.name}" style="background:${p.color}"></i>`).join(''); } };
net.on('change', render); net.on('status', render);
$('pcHost').onclick = () => { if (net.role === 'host') endParty(); else partyPanel({ hint: 'Scan with each phone, then pick any game: the room follows you.' }); };
$('pcShow').onclick = () => partyPanel({});
$('pcJoin').onsubmit = e => { e.preventDefault(); const c = $('pcJoinCode').value.toUpperCase().replace(/[^A-Z]/g, ''); if (c.length === 4) location.href = 'pad.html?r=' + c; else $('pcJoinCode').focus(); };
resume().then(render); render();
window.__NET = net;
