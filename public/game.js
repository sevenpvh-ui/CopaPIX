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

let boardConfig = [];
let currentUser = null; // null = Modo Demo
let currentLightIndex = 0;
let isSpinning = false;
let demoInterval = null;

// Elementos
const boardGrid = document.getElementById('boardGrid');
const creditDisplay = document.getElementById('creditDisplay');
const winDisplay = document.getElementById('winDisplay');
const resultMessage = document.getElementById('resultMessage');
const centerText = document.getElementById('centerText');

// Controles
const demoControls = document.getElementById('demoControls');
const realControls = document.getElementById('realControls');
const playNowBtn = document.getElementById('playNowBtn');
const loginModal = document.getElementById('loginModal');
const doLoginBtn = document.getElementById('doLoginBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const logoutBtn = document.getElementById('logoutBtn');
const spinBtn = document.getElementById('spinBtn');
const betControls = document.getElementById('betControls');

// Inputs
const cpfInput = document.getElementById('cpfInput');
const passInput = document.getElementById('passInput');

async function init() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        boardConfig = data.board;
        renderBoard();
        renderControls();
        
        // Inicia no Modo Demo
        startDemoMode();
        
    } catch(e) { console.error(e); }
}

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
        div.innerHTML = `
            <img src="${asset.img}" class="flag-img">
            <input type="number" data-id="${id}" placeholder="0" />
        `;
        betControls.appendChild(div);
    }
}

// --- LÓGICA DO MODO DEMO ---
function startDemoMode() {
    currentUser = null;
    creditDisplay.textContent = "R$ DEMO";
    winDisplay.textContent = "R$ 0.00";
    centerText.innerText = "DEMO";
    
    // UI Change
    demoControls.classList.remove('hidden');
    realControls.classList.add('hidden');

    // Loop de atração
    if(demoInterval) clearInterval(demoInterval);
    demoInterval = setInterval(() => {
        if(!isSpinning && !currentUser) {
            // Gira aleatoriamente sem valer nada
            const randomTarget = Math.floor(Math.random() * boardConfig.length);
            runAnimation(randomTarget, 0, null, true); // true = isDemo
        }
    }, 4000); // Gira a cada 4 segundos
}

function stopDemoMode() {
    if(demoInterval) clearInterval(demoInterval);
    document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
    centerText.innerText = "ULTIMATE";
}

// --- LÓGICA DE AUTENTICAÇÃO ---
playNowBtn.onclick = () => { loginModal.classList.remove('hidden'); };
closeModalBtn.onclick = () => { loginModal.classList.add('hidden'); };

doLoginBtn.onclick = async () => {
    const cpf = cpfInput.value;
    const password = passInput.value;

    // Tenta Registro primeiro (para simplificar UX)
    // Se der erro de "já existe", tenta login.
    // Lógica simplificada: Backend decide. Enviaremos 'register' primeiro.
    
    try {
        let res = await fetch('/api/auth', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ cpf, password, type: 'register' })
        });
        let data = await res.json();

        // Se falhar registro (já existe), tenta login
        if(data.error) {
            res = await fetch('/api/auth', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ cpf, password, type: 'login' })
            });
            data = await res.json();
        }

        if(data.success) {
            // Login Sucesso!
            loginModal.classList.add('hidden');
            stopDemoMode();
            currentUser = { cpf, balance: data.balance };
            creditDisplay.textContent = `R$ ${data.balance.toFixed(2)}`;
            
            // UI Change
            demoControls.classList.add('hidden');
            realControls.classList.remove('hidden');
        } else {
            alert(data.error || "Erro ao entrar");
        }

    } catch(e) { console.error(e); }
};

logoutBtn.onclick = () => {
    startDemoMode();
    // Limpa inputs
    document.querySelectorAll('.bet-chip input').forEach(i => i.value = '');
};

// --- LÓGICA DE JOGO REAL ---
spinBtn.onclick = async () => {
    if (isSpinning || !currentUser) return;

    const inputs = document.querySelectorAll('.bet-chip input');
    const bets = {};
    let totalBet = 0;

    inputs.forEach(inp => {
        const val = parseFloat(inp.value) || 0;
        if (val > 0) { bets[inp.dataset.id] = val; totalBet += val; }
    });

    if (totalBet === 0) return alert("Faça uma aposta!");
    if (totalBet > currentUser.balance) return alert("Saldo insuficiente!");

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

        await runAnimation(data.resultIndex, data.winAmount, data.winnerId, false);

    } catch(e) { console.error(e); isSpinning = false; spinBtn.disabled = false; }
};

function runAnimation(targetIndex, winAmount, winnerId, isDemo) {
    return new Promise(resolve => {
        isSpinning = true;
        let speed = isDemo ? 60 : 50;
        let pos = currentLightIndex;
        let rounds = 0;
        const totalRounds = 2; // Demo é mais rápido

        document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));

        const step = () => {
            const prev = document.getElementById(`slot-${pos}`);
            if(prev) prev.classList.remove('active');

            pos++;
            if (pos >= boardConfig.length) pos = 0;
            if (pos === 0) rounds++;

            const curr = document.getElementById(`slot-${pos}`);
            if(curr) curr.classList.add('active');

            if (rounds < totalRounds) {
                setTimeout(step, speed);
            } else if (rounds === totalRounds && pos !== targetIndex) {
                speed += 20;
                setTimeout(step, speed);
            } else if (pos === targetIndex) {
                if(!isDemo) endGame(winAmount, winnerId, pos);
                else {
                    isSpinning = false; // Demo acabou
                    setTimeout(() => { 
                         // Apaga luz após um tempo na demo
                         if(!currentUser) curr.classList.remove('active'); 
                    }, 1000);
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
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }
}

init();
