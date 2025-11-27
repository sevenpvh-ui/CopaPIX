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
    error: new Audio('https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3')
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
// NOVO: LISTA DE HISTÓRICO
const historyList = document.getElementById('historyList');

const demoControls = document.getElementById('demoControls');
const realControls = document.getElementById('realControls');
const playNowBtn = document.getElementById('playNowBtn');
const loginModal = document.getElementById('loginModal');
const doLoginBtn = document.getElementById('doLoginBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const logoutBtn = document.getElementById('logoutBtn');
const spinBtn = document.getElementById('spinBtn');
const betControls = document.getElementById('betControls');
const cpfInput = document.getElementById('cpfInput');
const passInput = document.getElementById('passInput');

async function init() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        boardConfig = data.board;
        renderBoard();
        renderControls();
        // RENDERIZA HISTÓRICO INICIAL (SE TIVER)
        if(data.history) renderHistory(data.history);
        startDemoMode();
    } catch(e) { console.error(e); }
}

// --- FUNÇÃO DE RENDERIZAR HISTÓRICO ---
function renderHistory(historyArray) {
    historyList.innerHTML = ''; // Limpa
    // Pega os últimos 10 para caber na tela
    const recent = historyArray.slice(0, 10);
    
    recent.forEach(teamId => {
        const asset = ASSETS[teamId];
        const div = document.createElement('div');
        div.className = 'history-bubble';
        div.innerHTML = `<img src="${asset.img}" alt="${teamId}">`;
        historyList.appendChild(div);
    });
}

function playSfx(type) {
    if (isMuted) return;
    const audio = SOUNDS[type];
    if (audio) { audio.currentTime = 0; audio.play().catch(e => {}); }
}

soundBtn.onclick = () => { isMuted = !isMuted; soundBtn.innerText = isMuted ? '🔇' : '🔊'; playSfx('click'); };

function renderBoard() {
    const coords = [
        [1,1], [1,2], [1,3], [1,4], [1,5], [1,6], [1,7],
        [2,7], [3,7], [4,7], [5,7], [6,7],
        [7,7], [7,6], [7,5], [7,4], [7,3], [7,2], [7,1],
        [6,1], [5,1], [4,1], [3,1], [2,1]
    ];
    boardConfig.forEach((slot, index) => {
        const div = document.createElement('div');
        div.className = 'slot';
        div.id = `slot-${index}`;
        const asset = ASSETS[slot.id];
        div.innerHTML = `<img src="${asset.img}" class="flag-img"><div class="mult-tag">x${slot.mult}</div>`;
        if (coords[index]) { div.style.gridRow = coords[index][0]; div.style.gridColumn = coords[index][1]; }
        boardGrid.appendChild(div);
    });
}

function renderControls() {
    const unique = {};
    boardConfig.forEach(s => { if(!unique[s.id]) unique[s.id] = s; });
    for (const id in unique) {
        const team = unique[id];
        const asset = ASSETS[id];
        const div = document.createElement('div');
        div.className = 'bet-chip';
        div.onclick = () => { if(currentUser) playSfx('click'); };
        div.innerHTML = `
            <img src="${asset.img}" class="flag-img">
            <input type="number" data-id="${id}" placeholder="0" />
        `;
        betControls.appendChild(div);
    }
}

function startDemoMode() {
    currentUser = null;
    creditDisplay.textContent = "R$ DEMO";
    winDisplay.textContent = "R$ 0.00";
    centerText.innerText = "DEMO";
    demoControls.classList.remove('hidden');
    realControls.classList.add('hidden');
    if(demoInterval) clearInterval(demoInterval);
    demoInterval = setInterval(() => {
        if(!isSpinning && !currentUser) {
            const randomTarget = Math.floor(Math.random() * boardConfig.length);
            runAnimation(randomTarget, 0, null, true);
        }
    }, 4000);
}

function stopDemoMode() {
    if(demoInterval) clearInterval(demoInterval);
    document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
    centerText.innerText = "ULTIMATE";
}

playNowBtn.onclick = () => { playSfx('click'); loginModal.classList.remove('hidden'); };
closeModalBtn.onclick = () => { playSfx('click'); loginModal.classList.add('hidden'); };

doLoginBtn.onclick = async () => {
    playSfx('click');
    const cpf = cpfInput.value;
    const password = passInput.value;
    try {
        let res = await fetch('/api/auth', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ cpf, password, type: 'register' })
        });
        let data = await res.json();
        if(data.error) {
            res = await fetch('/api/auth', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ cpf, password, type: 'login' })
            });
            data = await res.json();
        }
        if(data.success) {
            loginModal.classList.add('hidden');
            stopDemoMode();
            currentUser = { cpf, balance: data.balance };
            creditDisplay.textContent = `R$ ${data.balance.toFixed(2)}`;
            demoControls.classList.add('hidden');
            realControls.classList.remove('hidden');
            playSfx('win');
        } else {
            playSfx('error');
            alert(data.error || "Erro ao entrar");
        }
    } catch(e) { console.error(e); }
};

logoutBtn.onclick = () => {
    playSfx('click');
    startDemoMode();
    document.querySelectorAll('.bet-chip input').forEach(i => i.value = '');
};

spinBtn.onclick = async () => {
    playSfx('click');
    if (isSpinning || !currentUser) return;
    const inputs = document.querySelectorAll('.bet-chip input');
    const bets = {};
    let totalBet = 0;
    inputs.forEach(inp => {
        const val = parseFloat(inp.value) || 0;
        if (val > 0) { bets[inp.dataset.id] = val; totalBet += val; }
    });
    if (totalBet === 0) { playSfx('error'); return alert("Faça uma aposta!"); }
    if (totalBet > currentUser.balance) { playSfx('error'); return alert("Saldo insuficiente!"); }

    isSpinning = true;
    spinBtn.disabled = true;
    resultMessage.classList.add('hidden');
    winDisplay.textContent = "R$ 0.00";

    try {
        const res = await fetch('/api/spin', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ bets, cpf: currentUser.cpf })
        });
        const data = await res.json();
        currentUser.balance = data.newBalance;
        creditDisplay.textContent = `R$ ${currentUser.balance.toFixed(2)}`;
        
        // Renderiza histórico APÓS receber resposta (mas antes da animação acabar, ou depois? Melhor depois)
        // Vamos passar o histórico para a função endGame para atualizar só no final
        await runAnimation(data.resultIndex, data.winAmount, data.winnerId, false, data.history);
        
    } catch(e) { console.error(e); isSpinning = false; spinBtn.disabled = false; }
};

function runAnimation(targetIndex, winAmount, winnerId, isDemo, historyArray) {
    return new Promise(resolve => {
        isSpinning = true;
        let speed = isDemo ? 60 : 50;
        let pos = currentLightIndex;
        let rounds = 0;
        const totalRounds = 2;

        document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));

        const step = () => {
            const prev = document.getElementById(`slot-${pos}`);
            if(prev) prev.classList.remove('active');
            pos++;
            if (pos >= boardConfig.length) pos = 0;
            if (pos === 0) rounds++;
            const curr = document.getElementById(`slot-${pos}`);
            if(curr) curr.classList.add('active');
            playSfx('tick');

            if (rounds < totalRounds) {
                setTimeout(step, speed);
            } else if (rounds === totalRounds && pos !== targetIndex) {
                speed += 20;
                setTimeout(step, speed);
            } else if (pos === targetIndex) {
                if(!isDemo) {
                    endGame(winAmount, winnerId, pos);
                    if(historyArray) renderHistory(historyArray); // Atualiza histórico
                } else {
                    isSpinning = false;
                    setTimeout(() => { if(!currentUser) curr.classList.remove('active'); }, 1000);
                }
                resolve();
            } else {
                setTimeout(step, speed);
            }
        };
        step();
    });
}

function endGame(winAmount, winnerId, index) {
    isSpinning = false;
    spinBtn.disabled = false;
    currentLightIndex = index;
    creditDisplay.textContent = `R$ ${currentUser.balance.toFixed(2)}`;

    if (winAmount > 0) {
        winDisplay.textContent = `R$ ${winAmount.toFixed(2)}`;
        resultMessage.innerHTML = `${ASSETS[winnerId].name}<br>WIN!`;
        resultMessage.classList.remove('hidden');
        document.getElementById(`slot-${index}`).classList.add('active');
        playSfx('win');
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }
}

init();
