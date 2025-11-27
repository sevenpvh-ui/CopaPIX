const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const adminPass = document.getElementById('adminPass');
const btnAdminLogin = document.getElementById('btnAdminLogin');

// Elementos de Stats
const profitVal = document.getElementById('profitVal');
const totalIn = document.getElementById('totalIn');
const totalOut = document.getElementById('totalOut');
const poolVal = document.getElementById('poolVal');
const poolFill = document.getElementById('poolFill');
const poolTargetTxt = document.getElementById('poolTarget');

// Login
btnAdminLogin.onclick = async () => {
    const password = adminPass.value;
    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ password })
        });
        const data = await res.json();
        
        if(data.success) {
            loginScreen.classList.add('hidden');
            dashboard.classList.remove('hidden');
            loadStats();
            setInterval(loadStats, 3000); // Atualiza a cada 3s
        } else {
            alert("Senha incorreta!");
        }
    } catch(e) { console.error(e); }
};

async function loadStats() {
    try {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();
        const s = data.stats;

        // Formata valores
        profitVal.innerText = `R$ ${s.houseProfit.toFixed(2)}`;
        profitVal.className = s.houseProfit >= 0 ? 'profit' : 'loss';
        
        totalIn.innerText = `R$ ${s.totalIn.toFixed(2)}`;
        totalOut.innerText = `R$ ${s.totalOut.toFixed(2)}`;
        
        poolVal.innerText = `R$ ${s.prizePool.toFixed(2)}`;
        
        // Barra de progresso do pote
        const percent = Math.min((s.prizePool / data.poolTarget) * 100, 100);
        poolFill.style.width = `${percent}%`;
        poolTargetTxt.innerText = `Meta: R$ ${data.poolTarget.toFixed(2)}`;

        // Feedback visual se tem vitória forçada
        const btnForce = document.getElementById('btnForceWin');
        if(data.nextRigged) {
            btnForce.innerText = "⚠️ VITÓRIA ARMADA! (AGUARDANDO GIRO)";
            btnForce.style.opacity = "0.5";
        } else {
            btnForce.innerText = "⚡ FORÇAR VITÓRIA NA PRÓXIMA";
            btnForce.style.opacity = "1";
        }

    } catch(e) { console.error(e); }
}

// Botões de Ação
document.getElementById('btnForceWin').onclick = async () => {
    if(!confirm("Tem certeza? O próximo jogador VAI ganhar.")) return;
    await fetch('/api/admin/action', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ action: 'force_win' })
    });
    loadStats();
};

document.getElementById('btnReset').onclick = async () => {
    if(!confirm("Zerar todo o caixa da casa?")) return;
    await fetch('/api/admin/action', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ action: 'reset_stats' })
    });
    loadStats();
};
