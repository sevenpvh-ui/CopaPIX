const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const adminPass = document.getElementById('adminPass');
const btnAdminLogin = document.getElementById('btnAdminLogin');

const profitVal = document.getElementById('profitVal');
const totalIn = document.getElementById('totalIn');
const totalOut = document.getElementById('totalOut');
const poolVal = document.getElementById('poolVal');
const poolFill = document.getElementById('poolFill');
const poolTargetTxt = document.getElementById('poolTarget');

const bonusAmountInput = document.getElementById('bonusAmountInput');
const bonusActiveInput = document.getElementById('bonusActiveInput');
const btnSaveBonus = document.getElementById('btnSaveBonus');

btnAdminLogin.onclick = async () => {
    const password = adminPass.value;
    try {
        const res = await fetch('/api/admin/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ password }) });
        const data = await res.json();
        if(data.success) {
            loginScreen.classList.add('hidden'); dashboard.classList.remove('hidden');
            loadStats(); setInterval(loadStats, 3000);
        } else { alert("Senha incorreta!"); }
    } catch(e) {}
};

async function loadStats() {
    try {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();
        const s = data.stats;

        profitVal.innerText = `R$ ${s.houseProfit.toFixed(2)}`;
        profitVal.className = s.houseProfit >= 0 ? 'profit' : 'loss';
        totalIn.innerText = `R$ ${s.totalIn.toFixed(2)}`;
        totalOut.innerText = `R$ ${s.totalOut.toFixed(2)}`;
        poolVal.innerText = `R$ ${s.prizePool.toFixed(2)}`;
        
        const percent = Math.min((s.prizePool / data.poolTarget) * 100, 100);
        poolFill.style.width = `${percent}%`;
        poolTargetTxt.innerText = `Meta: R$ ${data.poolTarget.toFixed(2)}`;

        // Tabela Saques
        const tbody = document.getElementById('withdrawTable');
        const noData = document.getElementById('noWithdrawals');
        tbody.innerHTML = '';
        if (data.withdrawals && data.withdrawals.length > 0) {
            noData.classList.add('hidden');
            data.withdrawals.forEach(w => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td style="color: #777; font-size: 0.8rem;">${w.date.split(' ')[1]}</td><td style="color: white; font-weight: bold;">${w.name}</td><td style="color: #f59e0b; font-family: monospace;">${w.pixKey}</td><td style="font-weight: bold; color: #ef4444;">R$ ${w.amount.toFixed(2)}</td><td><button class="btn-pay" onclick="approveWithdraw(${w.id})">PAGAR</button></td>`;
                tbody.appendChild(tr);
            });
        } else { noData.classList.remove('hidden'); }

        const btnForce = document.getElementById('btnForceWin');
        if(data.nextRigged) { btnForce.innerText = "⚠️ VITÓRIA ARMADA!"; btnForce.style.background = "#f59e0b"; btnForce.style.color = "black"; } 
        else { btnForce.innerText = "⚡ FORÇAR VITÓRIA NA PRÓXIMA"; btnForce.style.background = "linear-gradient(135deg, #8b5cf6, #6d28d9)"; btnForce.style.color = "white"; }

    } catch(e) {}
}

window.approveWithdraw = async (id) => {
    if(!confirm("Já realizou o PIX?")) return;
    await fetch('/api/admin/action', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'approve_withdraw', id }) });
    loadStats();
};

document.getElementById('btnForceWin').onclick = async () => {
    if(!confirm("Manipular próxima rodada?")) return;
    await fetch('/api/admin/action', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'force_win' }) });
    loadStats();
};

document.getElementById('btnReset').onclick = async () => {
    if(!confirm("Zerar caixa?")) return;
    await fetch('/api/admin/action', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'reset_stats' }) });
    loadStats();
};

// Salvar Config Bônus
btnSaveBonus.onclick = async () => {
    const amount = bonusAmountInput.value;
    const active = bonusActiveInput.checked;
    await fetch('/api/admin/action', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ action: 'update_bonus', bonusAmount: amount, bonusActive: active })
    });
    alert("Bônus atualizado!");
};
