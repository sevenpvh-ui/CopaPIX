const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const adminPass = document.getElementById('adminPass');
const btnAdminLogin = document.getElementById('btnAdminLogin');

const profitVal = document.getElementById('profitVal');
const totalIn = document.getElementById('totalIn');
const totalOut = document.getElementById('totalOut');
const poolVal = document.getElementById('poolVal');

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
            setInterval(loadStats, 3000);
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

        // Tabela de Saques
        const tbody = document.getElementById('withdrawTable');
        const noData = document.getElementById('noWithdrawals');
        tbody.innerHTML = '';
        
        if (data.withdrawals && data.withdrawals.length > 0) {
            noData.classList.add('hidden');
            data.withdrawals.forEach(w => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-size: 0.8rem;">${w.date}</td>
                    <td style="color: white;">${w.name}</td>
                    <td style="color: #f59e0b;">${w.pixKey}</td>
                    <td style="font-weight: bold; color: #ef4444;">R$ ${w.amount.toFixed(2)}</td>
                    <td><button onclick="approveWithdraw(${w.id})" style="background: #10b981; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; color: black; font-weight: bold;">PAGAR</button></td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            noData.classList.remove('hidden');
        }

        const btnForce = document.getElementById('btnForceWin');
        if(data.nextRigged) {
            btnForce.innerText = "⚠️ ARMADO!"; btnForce.style.opacity = "0.5";
        } else {
            btnForce.innerText = "⚡ FORÇAR VITÓRIA"; btnForce.style.opacity = "1";
        }

    } catch(e) {}
}

window.approveWithdraw = async (id) => {
    if(!confirm("Já realizou o PIX para o cliente?")) return;
    await fetch('/api/admin/action', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ action: 'approve_withdraw', id })
    });
    loadStats();
};

document.getElementById('btnForceWin').onclick = async () => {
    if(!confirm("Próximo giro será vitória?")) return;
    await fetch('/api/admin/action', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'force_win' }) });
    loadStats();
};

document.getElementById('btnReset').onclick = async () => {
    if(!confirm("Zerar estatísticas?")) return;
    await fetch('/api/admin/action', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'reset_stats' }) });
    loadStats();
};
