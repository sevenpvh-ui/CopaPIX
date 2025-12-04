const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const adminPass = document.getElementById('adminPass');
const btnAdminLogin = document.getElementById('btnAdminLogin');

const profitVal = document.getElementById('profitVal');
const totalIn = document.getElementById('totalIn');
const totalOut = document.getElementById('totalOut');
const poolVal = document.getElementById('poolVal');
const poolFill = document.getElementById('poolFill');

// Config Pote
const poolTargetInput = document.getElementById('poolTargetInput');
const btnSaveTarget = document.getElementById('btnSaveTarget');

// Config Bônus
const bonusAmountInput = document.getElementById('bonusAmountInput');
const bonusActiveInput = document.getElementById('bonusActiveInput');
const btnSaveBonus = document.getElementById('btnSaveBonus');

const imgModal = document.getElementById('imgModal');
const receiptImg = document.getElementById('receiptImg');

btnAdminLogin.onclick = async () => {
    const password = adminPass.value;
    try {
        const res = await fetch('/api/admin/login', { 
            method: 'POST', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({ password }) 
        });
        const data = await res.json();
        if(data.success) {
            loginScreen.classList.add('hidden'); 
            dashboard.classList.remove('hidden');
            loadStats(); 
            setInterval(loadStats, 3000);
        } else { 
            alert("Senha incorreta!"); 
        }
    } catch(e) {
        console.error("Erro no login:", e);
        alert("Erro de conexão com o servidor.");
    }
};

async function loadStats() {
    try {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();
        const s = data.stats;

        if(profitVal) {
            profitVal.innerText = `R$ ${s.houseProfit.toFixed(2)}`;
            profitVal.className = s.houseProfit >= 0 ? 'profit' : 'loss';
        }
        if(totalIn) totalIn.innerText = `R$ ${s.totalIn.toFixed(2)}`;
        if(totalOut) totalOut.innerText = `R$ ${s.totalOut.toFixed(2)}`;
        if(poolVal) poolVal.innerText = `R$ ${s.prizePool.toFixed(2)}`;
        
        if(poolFill) {
            const percent = Math.min((s.prizePool / data.poolTarget) * 100, 100);
            poolFill.style.width = `${percent}%`;
        }
        
        if(poolTargetInput) poolTargetInput.placeholder = `Meta: ${data.poolTarget}`;

        if(document.activeElement !== bonusAmountInput && bonusAmountInput) {
            bonusAmountInput.value = s.bonusAmount;
            bonusActiveInput.checked = s.bonusActive;
        }

        // Tabela Saques
        const tbody = document.getElementById('withdrawTable');
        const noData = document.getElementById('noWithdrawals');
        if(tbody) {
            tbody.innerHTML = '';
            if (data.withdrawals && data.withdrawals.length > 0) {
                if(noData) noData.classList.add('hidden');
                data.withdrawals.forEach(w => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td style="color: #777;">${w.date.split(' ')[1]}</td><td style="color: white; font-weight: bold;">${w.name}</td><td style="color: #f59e0b; font-family: monospace;">${w.pixKey}</td><td style="font-weight: bold; color: #ef4444;">R$ ${w.amount.toFixed(2)}</td><td><button class="btn-pay" onclick="approveWithdraw(${w.id})">PAGAR</button></td>`;
                    tbody.appendChild(tr);
                });
            } else { 
                if(noData) noData.classList.remove('hidden'); 
            }
        }

        // Tabela Auditoria
        const claimsBody = document.getElementById('claimsTable');
        const noClaims = document.getElementById('noClaims');
        if(claimsBody) {
            claimsBody.innerHTML = '';
            if (data.claims && data.claims.length > 0) {
                if(noClaims) noClaims.classList.add('hidden');
                data.claims.forEach(c => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td style="color: #777;">${c.date.split(' ')[1]}</td><td style="color: white;">${c.name}</td><td style="font-weight: bold; color: #10b981;">R$ ${c.amount.toFixed(2)}</td><td><button class="btn-view" onclick="viewReceipt('${c.receipt}')">VER FOTO</button></td><td><button class="btn-pay" onclick="approveDeposit(${c.id}, '${c.cpf}', ${c.amount})">✔</button> <button class="btn-reject" onclick="rejectDeposit(${c.id})">✖</button></td>`;
                    claimsBody.appendChild(tr);
                });
            } else { 
                if(noClaims) noClaims.classList.remove('hidden'); 
            }
        }

        const btnForce = document.getElementById('btnForceWin');
        if(btnForce) {
            if(data.nextRigged) { 
                btnForce.innerText = "⚠️ VITÓRIA ARMADA!"; 
                btnForce.style.background = "#f59e0b"; 
                btnForce.style.color = "black"; 
            } else { 
                btnForce.innerText = "⚡ FORÇAR VITÓRIA"; 
                btnForce.style.background = "linear-gradient(135deg, #8b5cf6, #6d28d9)"; 
                btnForce.style.color = "white"; 
            }
        }

    } catch(e) { console.error(e); }
}

if(btnSaveTarget) {
    btnSaveTarget.onclick = async () => {
        const newVal = poolTargetInput.value;
        if(!newVal || newVal <= 0) return alert("Valor inválido");
        await fetch('/api/admin/action', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'update_pool_target', newPoolTarget: newVal }) });
        alert("Meta atualizada!"); poolTargetInput.value = ''; loadStats();
    };
}

if(btnSaveBonus) {
    btnSaveBonus.onclick = async () => {
        const amount = bonusAmountInput.value; const active = bonusActiveInput.checked;
        await fetch('/api/admin/action', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'update_bonus', bonusAmount: amount, bonusActive: active }) });
        alert("Bônus atualizado!"); loadStats();
    };
}

window.approveWithdraw = async (id) => { if(!confirm("Já realizou o PIX?")) return; await fetch('/api/admin/action', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'approve_withdraw', id }) }); loadStats(); };
window.viewReceipt = (base64) => { if(receiptImg) { receiptImg.src = base64; imgModal.classList.remove('hidden'); } };
window.approveDeposit = async (id, cpf, amount) => { if(!confirm(`Confirma que recebeu R$ ${amount}?`)) return; await fetch('/api/admin/action', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'approve_deposit', id, cpf, amount }) }); loadStats(); };
window.rejectDeposit = async (id) => { if(!confirm("Rejeitar?")) return; await fetch('/api/admin/action', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'reject_deposit', id }) }); loadStats(); };

const btnForce = document.getElementById('btnForceWin');
if(btnForce) btnForce.onclick = async () => { if(!confirm("Manipular?")) return; await fetch('/api/admin/action', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'force_win' }) }); loadStats(); };

const btnReset = document.getElementById('btnReset');
if(btnReset) btnReset.onclick = async () => { if(!confirm("Zerar?")) return; await fetch('/api/admin/action', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'reset_stats' }) }); loadStats(); };
