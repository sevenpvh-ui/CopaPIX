const ASSETS = {
    'bra': { img: 'https://flagcdn.com/w80/br.png', name: 'Brasil' },
    'fra': { img: 'https://flagcdn.com/w80/fr.png', name: 'França' },
    'eng': { img: 'https://flagcdn.com/w80/gb-eng.png', name: 'Inglaterra' },
    'ger': { img: 'https://flagcdn.com/w80/de.png', name: 'Alemanha' },
    'spa': { img: 'https://flagcdn.com/w80/es.png', name: 'Espanha' },
    'por': { img: 'https://flagcdn.com/w80/pt.png', name: 'Portugal' },
    'ned': { img: 'https://flagcdn.com/w80/nl.png', name: 'Holanda' },
    'cro': { img: 'https://flagcdn.com/w80/hr.png', name: 'Croácia' }
};

const SOUNDS = {
    tick: new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'),
    win: new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'),
    click: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
    error: new Audio('https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3'),
    cash: new Audio('https://assets.mixkit.co/active_storage/sfx/2004/2004-preview.mp3')
};
SOUNDS.tick.volume = 0.3; SOUNDS.win.volume = 0.6; SOUNDS.click.volume = 0.5;

let isMuted = false;
let boardConfig = [];
let currentUser = null;
let currentLightIndex = 0;
let isSpinning = false;
let demoInterval = null;

const boardGrid = document.getElementById('boardGrid');
const creditDisplay = document.getElementById('creditDisplay');
const winDisplay = document.getElementById('winDisplay');
const resultMessage = document.getElementById('resultMessage');
const centerText = document.getElementById('centerText');
const soundBtn = document.getElementById('soundBtn');
const historyList = document.getElementById('historyList');

// Controles
const demoControls = document.getElementById('demoControls');
const realControls = document.getElementById('realControls');
const btnOpenLogin = document.getElementById('btnOpenLogin');
const btnOpenRegister = document.getElementById('btnOpenRegister');
const logoutBtn = document.getElementById('logoutBtn');
const spinBtn = document.getElementById('spinBtn');
const betControls = document.getElementById('betControls');

// Modais
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const depositModal = document.getElementById('depositModal');
const withdrawModal = document.getElementById('withdrawModal'); // NOVO

// Inputs
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

// Botoes Header
const btnOpenDeposit = document.getElementById('btnOpenDeposit');
const btnOpenWithdraw = document.getElementById('btnOpenWithdraw'); // NOVO
const pixArea = document.getElementById('pixArea');
const btnSimulatePay = document.getElementById('btnSimulatePay');
const btnRequestWithdraw = document.getElementById('btnRequestWithdraw'); // NOVO
const withdrawPixKey = document.getElementById('withdrawPixKey');
const withdrawAmount = document.getElementById('withdrawAmount');
let selectedDeposit = 0;

async function init() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        boardConfig = data.board;
        renderBoard();
        renderControls();
        if(data.history) renderHistory(data.history);
        startDemoMode();
    } catch(e) { console.error(e); }
}

function renderHistory(h) {
    historyList.innerHTML = '';
    h.slice(0, 10).forEach(id => {
        const div = document.createElement('div');
        div.className = 'history-bubble';
        div.innerHTML = `<img src="${ASSETS[id].img}">`;
        historyList.appendChild(div);
    });
}

function playSfx(type) { if(!isMuted) SOUNDS[type].play().catch(e=>{}); }
soundBtn.onclick = () => { isMuted = !isMuted; soundBtn.innerText = isMuted ? '🔇' : '🔊'; playSfx('click'); };

function renderBoard() {
    const coords = [[1,1], [1,2], [1,3], [1,4], [1,5], [1,6], [1,7], [2,7], [3,7], [4,7], [5,7], [6,7], [7,7], [7,6], [7,5], [7,4], [7,3], [7,2], [7,1], [6,1], [5,1], [4,1], [3,1], [2,1]];
    boardConfig.forEach((slot, idx) => {
        const div = document.createElement('div'); div.className = 'slot'; div.id = `slot-${idx}`;
        div.innerHTML = `<img src="${ASSETS[slot.id].img}" class="flag-img"><div class="mult-tag">x${slot.mult}</div>`;
        if(coords[idx]) { div.style.gridRow = coords[idx][0]; div.style.gridColumn = coords[idx][1]; }
        boardGrid.appendChild(div);
    });
}

function renderControls() {
    const unique = {};
    boardConfig.forEach(s => { if(!unique[s.id]) unique[s.id] = s; });
    for (const id in unique) {
        const div = document.createElement('div'); div.className = 'bet-chip';
        div.onclick = () => { if(currentUser) playSfx('click'); };
        div.innerHTML = `<img src="${ASSETS[id].img}" class="flag-img"><input type="number" data-id="${id}" placeholder="0" />`;
        betControls.appendChild(div);
    }
}

function startDemoMode() {
    currentUser = null; creditDisplay.textContent = "R$ DEMO"; winDisplay.textContent = "R$ 0.00"; centerText.innerText = "DEMO";
    demoControls.classList.remove('hidden'); realControls.classList.add('hidden');
    btnOpenDeposit.classList.add('hidden'); btnOpenWithdraw.classList.add('hidden'); // Esconde botoes
    if(demoInterval) clearInterval(demoInterval);
    demoInterval = setInterval(() => { if(!isSpinning) runAnimation(Math.floor(Math.random()*24), 0, null, true); }, 4000);
}

function stopDemoMode() {
    if(demoInterval) clearInterval(demoInterval);
    document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
    centerText.innerText = "ULTIMATE";
}

document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => {
    playSfx('click');
    loginModal.classList.add('hidden'); registerModal.classList.add('hidden');
    depositModal.classList.add('hidden'); withdrawModal.classList.add('hidden');
});

btnOpenLogin.onclick = () => { playSfx('click'); loginModal.classList.remove('hidden'); };
btnOpenRegister.onclick = () => { playSfx('click'); registerModal.classList.remove('hidden'); };

submitLogin.onclick = async () => {
    const cpf = loginCpf.value; const password = loginPass.value;
    try {
        const res = await fetch('/api/auth', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ cpf, password, type: 'login' }) });
        const data = await res.json();
        if(data.success) loginSuccessful(data); else alert(data.error);
    } catch(e) {}
};

submitRegister.onclick = async () => {
    if(!check18.checked || !checkTerms.checked) return alert("Aceite os termos.");
    const userData = { name: regName.value, cpf: regCpf.value, phone: regPhone.value, password: regPass.value, type: 'register' };
    try {
        const res = await fetch('/api/auth', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(userData) });
        const data = await res.json();
        if(data.success) loginSuccessful(data); else alert(data.error);
    } catch(e) {}
};

function loginSuccessful(data) {
    loginModal.classList.add('hidden'); registerModal.classList.add('hidden');
    stopDemoMode();
    currentUser = { cpf: loginCpf.value || regCpf.value, balance: data.balance };
    creditDisplay.textContent = `R$ ${data.balance.toFixed(2)}`;
    demoControls.classList.add('hidden'); realControls.classList.remove('hidden');
    btnOpenDeposit.classList.remove('hidden'); btnOpenWithdraw.classList.remove('hidden');
    playSfx('win');
}

logoutBtn.onclick = () => {
    playSfx('click'); startDemoMode();
    document.querySelectorAll('.bet-chip input').forEach(i => i.value = '');
};

// Depósito
btnOpenDeposit.onclick = () => { playSfx('click'); depositModal.classList.remove('hidden'); pixArea.classList.add('hidden'); };
document.querySelectorAll('.btn-value').forEach(btn => btn.onclick = () => { playSfx('click'); selectedDeposit = parseFloat(btn.dataset.val); pixArea.classList.remove('hidden'); });
btnSimulatePay.onclick = async () => {
    try {
        const res = await fetch('/api/deposit', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ cpf: currentUser.cpf, amount: selectedDeposit }) });
        const data = await res.json();
        if(data.success) { currentUser.balance = data.newBalance; creditDisplay.textContent = `R$ ${currentUser.balance.toFixed(2)}`; depositModal.classList.add('hidden'); playSfx('cash'); confetti({ particleCount:100, spread:70, origin:{y:0.6} }); }
    } catch(e) {}
};

// --- SAQUE ---
btnOpenWithdraw.onclick = () => { playSfx('click'); withdrawModal.classList.remove('hidden'); };
btnRequestWithdraw.onclick = async () => {
    const amount = parseFloat(withdrawAmount.value);
    const pixKey = withdrawPixKey.value;
    if(!amount || !pixKey) return alert("Preencha tudo!");
    
    try {
        const res = await fetch('/api/withdraw', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ cpf: currentUser.cpf, amount, pixKey })
        });
        const data = await res.json();
        if(data.success) {
            currentUser.balance = data.newBalance;
            creditDisplay.textContent = `R$ ${currentUser.balance.toFixed(2)}`;
            withdrawModal.classList.add('hidden');
            alert("Saque solicitado! Aguarde aprovação.");
        } else {
            alert(data.error);
        }
    } catch(e) {}
};

spinBtn.onclick = async () => {
    playSfx('click'); if(isSpinning || !currentUser) return;
    const bets = {}; let total=0;
    document.querySelectorAll('.bet-chip input').forEach(i => { const v=parseFloat(i.value)||0; if(v>0){ bets[i.dataset.id]=v; total+=v; } });
    if(total===0 || total>currentUser.balance) { playSfx('error'); return alert("Aposta inválida!"); }
    
    isSpinning = true; spinBtn.disabled = true; resultMessage.classList.add('hidden'); winDisplay.textContent = "R$ 0.00";
    try {
        const res = await fetch('/api/spin', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ bets, cpf: currentUser.cpf }) });
        const data = await res.json();
        currentUser.balance = data.newBalance; creditDisplay.textContent = `R$ ${currentUser.balance.toFixed(2)}`;
        await runAnimation(data.resultIndex, data.winAmount, data.winnerId, false, data.history);
    } catch(e) { isSpinning=false; spinBtn.disabled=false; }
};

function runAnimation(target, winAmount, winnerId, isDemo, history) {
    return new Promise(resolve => {
        isSpinning = true; let speed = isDemo?60:50, pos=currentLightIndex, rounds=0;
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
        const step = () => {
            document.getElementById(`slot-${pos}`).classList.remove('active');
            pos++; if(pos>=boardConfig.length) { pos=0; rounds++; }
            document.getElementById(`slot-${pos}`).classList.add('active');
            playSfx('tick');
            if(rounds<2) setTimeout(step, speed);
            else if(pos!==target) { speed+=20; setTimeout(step, speed); }
            else {
                if(!isDemo) { endGame(winAmount, winnerId, pos); if(history) renderHistory(history); }
                else { isSpinning=false; setTimeout(()=>{ if(!currentUser) document.getElementById(`slot-${pos}`).classList.remove('active'); },1000); }
                resolve();
            }
        }; step();
    });
}

function endGame(amount, id, idx) {
    isSpinning = false; spinBtn.disabled = false; currentLightIndex = idx;
    creditDisplay.textContent = `R$ ${currentUser.balance.toFixed(2)}`;
    if(amount>0) {
        winDisplay.textContent = `R$ ${amount.toFixed(2)}`;
        resultMessage.innerHTML = `${ASSETS[id].name}<br>WIN!`;
        resultMessage.classList.remove('hidden');
        document.getElementById(`slot-${idx}`).classList.add('active');
        playSfx('win'); confetti({ particleCount:150, spread:80, origin:{y:0.6} });
    }
}

init();
