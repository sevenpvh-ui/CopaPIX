const ASSETS = { 'bra': { img: 'https://flagcdn.com/w80/br.png', name: 'Brasil' }, 'fra': { img: 'https://flagcdn.com/w80/fr.png', name: 'França' }, 'eng': { img: 'https://flagcdn.com/w80/gb-eng.png', name: 'Inglaterra' }, 'ger': { img: 'https://flagcdn.com/w80/de.png', name: 'Alemanha' }, 'spa': { img: 'https://flagcdn.com/w80/es.png', name: 'Espanha' }, 'por': { img: 'https://flagcdn.com/w80/pt.png', name: 'Portugal' }, 'ned': { img: 'https://flagcdn.com/w80/nl.png', name: 'Holanda' }, 'cro': { img: 'https://flagcdn.com/w80/hr.png', name: 'Croácia' } };
const SOUNDS = { tick: new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'), win: new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'), click: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'), error: new Audio('https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3'), cash: new Audio('https://assets.mixkit.co/active_storage/sfx/2004/2004-preview.mp3') };
SOUNDS.tick.volume = 0.3; SOUNDS.win.volume = 0.6; SOUNDS.click.volume = 0.5;

const SUPPORT_NUMBER = "5511999999999"; 

let isMuted = false; let boardConfig = []; let currentUser = null; let currentLightIndex = 0; let isSpinning = false; let demoInterval = null;

const boardGrid = document.getElementById('boardGrid');
const creditDisplay = document.getElementById('creditDisplay');
const winDisplay = document.getElementById('winDisplay');
const resultMessage = document.getElementById('resultMessage');
const centerText = document.getElementById('centerText');
const jackpotDisplay = document.getElementById('jackpotDisplay'); // NOVO
const soundBtn = document.getElementById('soundBtn');
const historyList = document.getElementById('historyList');
const splashScreen = document.getElementById('splashScreen');
const liveTrack = document.getElementById('liveTrack');

const demoControls = document.getElementById('demoControls');
const realControls = document.getElementById('realControls');
const walletActions = document.getElementById('walletActions');
const btnOpenLogin = document.getElementById('btnOpenLogin');
const btnOpenRegister = document.getElementById('btnOpenRegister');
const logoutBtn = document.getElementById('logoutBtn');
const spinBtn = document.getElementById('spinBtn');
const betControls = document.getElementById('betControls');
const btnBonusDirect = document.getElementById('btnBonusDirect');

const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const depositModal = document.getElementById('depositModal');
const withdrawModal = document.getElementById('withdrawModal');
const claimModal = document.getElementById('claimModal');

const loginCpf = document.getElementById('loginCpf');
const loginPass = document.getElementById('loginPass');
const submitLogin = document.getElementById('submitLogin');
const regName = document.getElementById('regName');
const regCpf = document.getElementById('regCpf');
const regPhone = document.getElementById('regPhone');
const regPass = document.getElementById('regPass');
const check18 = document.getElementById('check18');
const checkTerms = document.getElementById('checkTerms');
const submitRegister = document.getElementById('submitRegister');

const btnOpenDeposit = document.getElementById('btnOpenDeposit');
const btnOpenWithdraw = document.getElementById('btnOpenWithdraw');
const pixArea = document.getElementById('pixArea');
const btnSimulatePay = document.getElementById('btnSimulatePay');
const btnOpenClaim = document.getElementById('btnOpenClaim');
const btnSendClaim = document.getElementById('btnSendClaim');
const claimAmount = document.getElementById('claimAmount');
const claimFile = document.getElementById('claimFile');
const btnContactSupport = document.getElementById('btnContactSupport');
const btnRequestWithdraw = document.getElementById('btnRequestWithdraw');
const withdrawPixKey = document.getElementById('withdrawPixKey');
const withdrawAmount = document.getElementById('withdrawAmount');
let selectedDeposit = 0;

async function init() {
    if(splashScreen) setTimeout(() => { splashScreen.classList.add('splash-hidden'); }, 2000);
    startLiveTicker();

    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        boardConfig = data.board;
        renderBoard(); renderControls();
        if(data.history) renderHistory(data.history);
        if(data.jackpot !== undefined) updateJackpot(data.jackpot); // Atualiza Jackpot inicial
        const savedCpf = localStorage.getItem('userCpf');
        if(savedCpf) checkSession(savedCpf); else startDemoMode();
    } catch(e) {}
}

function updateJackpot(val) {
    if(jackpotDisplay) jackpotDisplay.innerText = `R$ ${val.toFixed(2)}`;
}

// ... (Resto das funções auxiliares, playSfx, LiveTicker, CheckSession iguais) ...
// (Mantenha o código anterior, só vou mostrar onde muda no SPIN)

function playSfx(type) { if(!isMuted) SOUNDS[type].play().catch(e=>{}); }
if(soundBtn) soundBtn.onclick = () => { isMuted = !isMuted; soundBtn.innerText = isMuted ? '🔇' : '🔊'; playSfx('click'); };

const fakeNames = ["João S.", "Maria O.", "Pedro P.", "Ana C.", "Lucas M.", "Carlos B.", "Felipe D."];
const fakeAmounts = [20, 50, 10, 100, 5, 200, 25];
function startLiveTicker() { if(!liveTrack) return; for(let i=0; i<10; i++) addFakeWinner(); setInterval(addFakeWinner, 3000); }
function addFakeWinner() { if(!liveTrack) return; const name = fakeNames[Math.floor(Math.random() * fakeNames.length)]; const val = fakeAmounts[Math.floor(Math.random() * fakeAmounts.length)]; const div = document.createElement('div'); div.className = 'ticker-item'; div.innerHTML = `${name} ganhou <span>R$ ${val.toFixed(2)}</span>`; liveTrack.appendChild(div); if(liveTrack.children.length > 20) liveTrack.removeChild(liveTrack.firstChild); }

async function checkSession(cpf) { try { const res = await fetch('/api/me', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ cpf }) }); const data = await res.json(); if(data.success) { currentUser = { cpf, balance: data.balance }; updateUIState(true); } else { localStorage.removeItem('userCpf'); startDemoMode(); } } catch(e) { startDemoMode(); } }

function updateUIState(isLogged) {
    if(isLogged) {
        if(creditDisplay) creditDisplay.textContent = `R$ ${currentUser.balance.toFixed(2)}`;
        if(demoControls) demoControls.classList.add('hidden');
        if(realControls) realControls.classList.remove('hidden');
        if(walletActions) walletActions.classList.remove('hidden'); 
        stopDemoMode();
    } else {
        if(creditDisplay) creditDisplay.textContent = "R$ DEMO";
        if(demoControls) demoControls.classList.remove('hidden');
        if(realControls) realControls.classList.add('hidden');
        if(walletActions) walletActions.classList.add('hidden');
        startDemoMode();
    }
}

const handleBonus = async () => { playSfx('click'); if(!currentUser) return; try { const res = await fetch('/api/bonus/claim', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ cpf: currentUser.cpf }) }); const data = await res.json(); if(data.success) { currentUser.balance = data.newBalance; if(creditDisplay) creditDisplay.textContent = `R$ ${currentUser.balance.toFixed(2)}`; alert(`🎁 PARABÉNS! Você ganhou R$ ${data.amount.toFixed(2)} de bônus!`); playSfx('win'); confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } }); } else { alert(data.error); } } catch(e) {} };
if(btnBonusDirect) btnBonusDirect.onclick = handleBonus;

// Modais e Botoes (Iguais ao anterior, omitindo para brevidade, mas você deve manter tudo)
document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => { playSfx('click'); if(loginModal) loginModal.classList.add('hidden'); if(registerModal) registerModal.classList.add('hidden'); if(depositModal) depositModal.classList.add('hidden'); if(withdrawModal) withdrawModal.classList.add('hidden'); if(claimModal) claimModal.classList.add('hidden'); });
if(btnOpenLogin) btnOpenLogin.onclick = () => { playSfx('click'); loginModal.classList.remove('hidden'); };
if(btnOpenRegister) btnOpenRegister.onclick = () => { playSfx('click'); registerModal.classList.remove('hidden'); };
if(submitLogin) submitLogin.onclick = async () => { const cpf = loginCpf.value; const password = loginPass.value; try { const res = await fetch('/api/auth', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ cpf, password, type: 'login' }) }); const data = await res.json(); if(data.success) loginSuccessful(data, cpf); else alert(data.error); } catch(e) {} };
if(submitRegister) submitRegister.onclick = async () => { if(!check18.checked || !checkTerms.checked) return alert("Aceite os termos."); const userData = { name: regName.value, cpf: regCpf.value, phone: regPhone.value, password: regPass.value, type: 'register' }; try { const res = await fetch('/api/auth', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(userData) }); const data = await res.json(); if(data.success) loginSuccessful(data, regCpf.value); else alert(data.error); } catch(e) {} };
function loginSuccessful(data, cpf) { if(loginModal) loginModal.classList.add('hidden'); if(registerModal) registerModal.classList.add('hidden'); currentUser = { cpf: cpf, balance: data.balance }; localStorage.setItem('userCpf', cpf); updateUIState(true); playSfx('win'); }
if(logoutBtn) logoutBtn.onclick = () => { playSfx('click'); localStorage.removeItem('userCpf'); currentUser = null; updateUIState(false); document.querySelectorAll('.bet-chip input').forEach(i => i.value = ''); };
if(btnOpenDeposit) btnOpenDeposit.onclick = () => { playSfx('click'); depositModal.classList.remove('hidden'); pixArea.classList.add('hidden'); };
document.querySelectorAll('.btn-value').forEach(btn => btn.onclick = () => { playSfx('click'); selectedDeposit = parseFloat(btn.dataset.val); if(pixArea) pixArea.classList.remove('hidden'); });
if(btnSimulatePay) btnSimulatePay.onclick = async () => { try { const res = await fetch('/api/deposit', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ cpf: currentUser.cpf, amount: selectedDeposit }) }); const data = await res.json(); if(data.success) { currentUser.balance = data.newBalance; if(creditDisplay) creditDisplay.textContent = `R$ ${currentUser.balance.toFixed(2)}`; depositModal.classList.add('hidden'); playSfx('cash'); confetti({ particleCount:100, spread:70, origin:{y:0.6} }); } } catch(e) {} };
if(btnOpenClaim) btnOpenClaim.onclick = () => { playSfx('click'); if(depositModal) depositModal.classList.add('hidden'); if(claimModal) claimModal.classList.remove('hidden'); };
if(btnSendClaim) btnSendClaim.onclick = async () => { const amount = claimAmount.value; const file = claimFile.files[0]; if(!amount || !file) return alert("Preencha tudo."); const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = async () => { try { const res = await fetch('/api/deposit/claim', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ cpf: currentUser.cpf, amount, receiptImage: reader.result }) }); const data = await res.json(); if(data.success) { alert("Enviado!"); claimModal.classList.add('hidden'); } else alert(data.error); } catch(e) {} }; };
if(btnContactSupport) btnContactSupport.onclick = () => { const msg = `Olá! Depósito de R$ ${selectedDeposit} não caiu.`; window.open(`https://wa.me/${SUPPORT_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank'); };
if(btnOpenWithdraw) btnOpenWithdraw.onclick = () => { playSfx('click'); withdrawModal.classList.remove('hidden'); };
if(btnRequestWithdraw) btnRequestWithdraw.onclick = async () => { const amount = parseFloat(withdrawAmount.value); const pixKey = withdrawPixKey.value; if(!amount || !pixKey) return alert("Preencha tudo."); try { const res = await fetch('/api/withdraw', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ cpf: currentUser.cpf, amount, pixKey }) }); const data = await res.json(); if(data.success) { currentUser.balance = data.newBalance; if(creditDisplay) creditDisplay.textContent = `R$ ${currentUser.balance.toFixed(2)}`; withdrawModal.classList.add('hidden'); alert("Solicitado!"); } else alert(data.error); } catch(e) {} };

// SPIN - ATUALIZADO PARA ATUALIZAR O JACKPOT
if(spinBtn) spinBtn.onclick = async () => {
    playSfx('click'); if(isSpinning || !currentUser) return;
    const bets = {}; let total=0;
    document.querySelectorAll('.bet-chip input').forEach(i => { const v=parseFloat(i.value)||0; if(v>0){ bets[i.dataset.id]=v; total+=v; } });
    if(total===0 || total>currentUser.balance) { playSfx('error'); return alert("Verifique aposta ou saldo."); }
    
    isSpinning = true; spinBtn.disabled = true; 
    if(resultMessage) resultMessage.classList.add('hidden'); 
    if(winDisplay) winDisplay.textContent = "R$ 0.00";
    
    try {
        const res = await fetch('/api/spin', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ bets, cpf: currentUser.cpf }) });
        const data = await res.json();
        currentUser.balance = data.newBalance; 
        if(creditDisplay) creditDisplay.textContent = `R$ ${currentUser.balance.toFixed(2)}`;
        
        // ATUALIZA JACKPOT APÓS O GIRO
        updateJackpot(data.jackpot);

        await runAnimation(data.resultIndex, data.winAmount, data.winnerId, false, data.history);
    } catch(e) { isSpinning=false; spinBtn.disabled=false; }
};

// ... Funções de animação (renderBoard, etc) ...
function renderBoard() {
    if(!boardGrid) return;
    const coords = [[1,1], [1,2], [1,3], [1,4], [1,5], [1,6], [1,7], [2,7], [3,7], [4,7], [5,7], [6,7], [7,7], [7,6], [7,5], [7,4], [7,3], [7,2], [7,1], [6,1], [5,1], [4,1], [3,1], [2,1]];
    boardConfig.forEach((slot, idx) => {
        const div = document.createElement('div'); div.className = 'slot'; div.id = `slot-${idx}`;
        div.innerHTML = `<img src="${ASSETS[slot.id].img}" class="flag-img"><div class="mult-tag">x${slot.mult}</div>`;
        if(coords[idx]) { div.style.gridRow = coords[idx][0]; div.style.gridColumn = coords[idx][1]; }
        boardGrid.appendChild(div);
    });
}
function renderControls() {
    if(!betControls) return;
    const unique = {}; boardConfig.forEach(s => { if(!unique[s.id]) unique[s.id] = s; });
    for (const id in unique) {
        const div = document.createElement('div'); div.className = 'bet-chip'; div.onclick = () => { if(currentUser) playSfx('click'); };
        div.innerHTML = `<img src="${ASSETS[id].img}" class="flag-img"><input type="number" data-id="${id}" placeholder="0" />`;
        betControls.appendChild(div);
    }
}
function startDemoMode() {
    currentUser = null; 
    if(winDisplay) winDisplay.textContent = "R$ 0.00"; 
    if(centerText) centerText.innerText = "DEMO"; // Mostra DEMO se não estiver rodando jackpot
    if(demoInterval) clearInterval(demoInterval);
    demoInterval = setInterval(() => { if(!isSpinning) runAnimation(Math.floor(Math.random()*24), 0, null, true); }, 4000);
}
function stopDemoMode() {
    if(demoInterval) clearInterval(demoInterval);
    document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
    // centerText.innerText = "ULTIMATE"; // Removido para manter o Jackpot visível
}
function runAnimation(target, winAmount, winnerId, isDemo, history) {
    return new Promise(resolve => {
        isSpinning = true; let speed = isDemo?60:50, pos=currentLightIndex, rounds=0;
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
        const step = () => {
            const prev = document.getElementById(`slot-${pos}`);
            if(prev) prev.classList.remove('active');
            pos++; if(pos>=boardConfig.length) { pos=0; rounds++; }
            const curr = document.getElementById(`slot-${pos}`);
            if(curr) curr.classList.add('active');
            playSfx('tick');
            if(rounds<2) setTimeout(step, speed);
            else if(pos!==target) { speed+=20; setTimeout(step, speed); }
            else {
                if(!isDemo) { endGame(winAmount, winnerId, pos); if(history) renderHistory(history); }
                else { isSpinning=false; setTimeout(()=>{ if(!currentUser && curr) curr.classList.remove('active'); },1000); }
                resolve();
            }
        }; step();
    });
}
function endGame(amount, id, idx) {
    isSpinning = false; spinBtn.disabled = false; currentLightIndex = idx;
    if(creditDisplay) creditDisplay.textContent = `R$ ${currentUser.balance.toFixed(2)}`;
    if(amount>0) {
        if(winDisplay) winDisplay.textContent = `R$ ${amount.toFixed(2)}`;
        if(resultMessage) { resultMessage.innerHTML = `${ASSETS[id].name}<br>WIN!`; resultMessage.classList.remove('hidden'); }
        const slot = document.getElementById(`slot-${idx}`);
        if(slot) slot.classList.add('active');
        playSfx('win'); confetti({ particleCount:150, spread:80, origin:{y:0.6} });
    }
}

init();
