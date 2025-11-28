const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// --- DADOS NA MEMÓRIA ---
let usersDB = {}; 
let houseStats = { 
    totalIn: 0, 
    totalOut: 0, 
    houseProfit: 0, 
    prizePool: 0,       // Valor atual do pote
    poolTarget: 100.00, // Meta para estourar (Editável)
    bonusAmount: 5.00, 
    bonusActive: true  
};
let gameHistory = []; 
let withdrawalsQueue = []; 
let depositClaims = [];

const ADMIN_PASSWORD = "admin"; 
const POOL_PERCENT = 0.20; // 20% das apostas vão para o pote

const BOARD = [
    { id: 'bra', mult: 5 }, { id: 'fra', mult: 5 }, { id: 'eng', mult: 5 },
    { id: 'ger', mult: 10 }, { id: 'spa', mult: 10 }, { id: 'por', mult: 10 }, { id: 'ned', mult: 10 },
    { id: 'cro', mult: 25 }, { id: 'bra', mult: 5 }, { id: 'fra', mult: 5 },
    { id: 'eng', mult: 5 }, { id: 'ger', mult: 10 },
    { id: 'spa', mult: 10 }, { id: 'por', mult: 10 }, { id: 'ned', mult: 10 },
    { id: 'cro', mult: 25 }, { id: 'bra', mult: 5 }, { id: 'fra', mult: 5 }, { id: 'eng', mult: 5 },
    { id: 'ger', mult: 10 }, { id: 'spa', mult: 10 }, { id: 'por', mult: 10 },
    { id: 'ned', mult: 10 }, { id: 'cro', mult: 25 }
];

let nextSpinMustWin = false;

// --- ROTAS ---

app.get('/api/config', (req, res) => {
    // Envia o valor do pote para mostrar no centro
    res.json({ board: BOARD, history: gameHistory, jackpot: houseStats.prizePool });
});

app.post('/api/me', (req, res) => {
    const { cpf } = req.body;
    const user = usersDB[cpf];
    if(user) {
        const totalDisplay = user.balance + user.bonus;
        return res.json({ success: true, balance: totalDisplay, name: user.name });
    } else {
        return res.status(401).json({ error: "Sessão expirada" });
    }
});

app.post('/api/auth', (req, res) => {
    const { cpf, password, type, name, phone } = req.body;
    if (!cpf || !password) return res.status(400).json({ error: "Preencha tudo!" });

    if (type === 'register') {
        if (usersDB[cpf]) return res.status(400).json({ error: "CPF já cadastrado." });
        usersDB[cpf] = { password, name, phone, balance: 0.00, bonus: 0.00, lastBonus: 0 };
        return res.json({ success: true, balance: 0.00, name });
    }

    if (type === 'login') {
        const user = usersDB[cpf];
        if (!user || user.password !== password) return res.status(400).json({ error: "Dados incorretos." });
        const totalDisplay = user.balance + user.bonus;
        return res.json({ success: true, balance: totalDisplay, name: user.name });
    }
});

app.post('/api/bonus/claim', (req, res) => {
    const { cpf } = req.body;
    const user = usersDB[cpf];
    if (!user) return res.status(401).json({ error: "Login necessário" });
    if (!houseStats.bonusActive) return res.status(400).json({ error: "Bônus desativado." });

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (user.lastBonus && (now - user.lastBonus) < oneDay) {
        const timeLeft = oneDay - (now - user.lastBonus);
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        return res.status(400).json({ error: `Volte em ${hours} horas.` });
    }

    user.bonus += houseStats.bonusAmount;
    user.lastBonus = now;
    const totalDisplay = user.balance + user.bonus;
    res.json({ success: true, newBalance: totalDisplay, amount: houseStats.bonusAmount });
});

app.post('/api/deposit', (req, res) => {
    const { cpf, amount } = req.body;
    const user = usersDB[cpf];
    if (!user) return res.status(401).json({ error: "Erro user" });
    if (!amount || amount <= 0) return res.status(400).json({ error: "Valor inválido" });

    user.balance += parseFloat(amount);
    houseStats.totalIn += parseFloat(amount);
    const totalDisplay = user.balance + user.bonus;
    res.json({ success: true, newBalance: totalDisplay });
});

app.post('/api/deposit/claim', (req, res) => {
    const { cpf, amount, receiptImage } = req.body;
    const user = usersDB[cpf];
    if (!user) return res.status(401).json({ error: "Erro user" });
    
    const request = {
        id: Date.now(), cpf, name: user.name, amount: parseFloat(amount), receipt: receiptImage,
        date: new Date().toLocaleString('pt-BR')
    };
    depositClaims.push(request);
    res.json({ success: true, msg: "Enviado para análise!" });
});

app.post('/api/withdraw', (req, res) => {
    const { cpf, amount, pixKey } = req.body;
    const user = usersDB[cpf];
    if (!user) return res.status(401).json({ error: "Sessão finalizada." });
    if (amount <= 0) return res.status(400).json({ error: "Valor inválido." });
    if (user.balance < amount) return res.status(400).json({ error: "Saldo Real insuficiente." });

    user.balance -= parseFloat(amount);
    const request = {
        id: Date.now(), cpf, name: user.name, amount: parseFloat(amount), pixKey,
        date: new Date().toLocaleString('pt-BR')
    };
    withdrawalsQueue.push(request);
    const totalDisplay = user.balance + user.bonus;
    res.json({ success: true, newBalance: totalDisplay });
});

// ADMIN ROUTES
app.post('/api/admin/login', (req, res) => {
    if(req.body.password === ADMIN_PASSWORD) res.json({ success: true });
    else res.status(401).json({ error: "Senha incorreta" });
});

app.get('/api/admin/stats', (req, res) => {
    res.json({ 
        stats: houseStats, 
        usersCount: Object.keys(usersDB).length, 
        nextRigged: nextSpinMustWin,
        withdrawals: withdrawalsQueue,
        claims: depositClaims
    });
});

app.post('/api/admin/action', (req, res) => {
    const { action, id, bonusAmount, bonusActive, amount, cpf, newPoolTarget } = req.body;
    
    if(action === 'force_win') { nextSpinMustWin = true; return res.json({}); }
    if(action === 'reset_stats') { houseStats.totalIn = 0; houseStats.totalOut = 0; houseStats.houseProfit = 0; houseStats.prizePool = 0; return res.json({}); }
    if(action === 'update_bonus') { houseStats.bonusAmount = parseFloat(bonusAmount); houseStats.bonusActive = bonusActive; return res.json({ msg: "Ok!" }); }
    
    // ATUALIZAR META DO POTE (NOVO)
    if(action === 'update_pool_target') {
        houseStats.poolTarget = parseFloat(newPoolTarget);
        return res.json({ msg: "Meta do pote atualizada!" });
    }

    if(action === 'approve_withdraw') { withdrawalsQueue = withdrawalsQueue.filter(w => w.id !== id); return res.json({ msg: "Pago!" }); }
    
    if(action === 'approve_deposit') {
        const user = usersDB[cpf];
        if(user) {
            user.balance += parseFloat(amount);
            houseStats.totalIn += parseFloat(amount);
            depositClaims = depositClaims.filter(c => c.id !== id);
            return res.json({ msg: "Aprovado!" });
        }
        return res.json({ error: "Usuário sumiu" });
    }
    if(action === 'reject_deposit') { depositClaims = depositClaims.filter(c => c.id !== id); return res.json({ msg: "Rejeitado" }); }
});

// SPIN
app.post('/api/spin', (req, res) => {
    const { bets, cpf } = req.body;
    const user = usersDB[cpf];
    if (!user) return res.status(401).json({ error: "Login necessário" });

    let totalBet = 0;
    let highestBetTeam = null;
    let highestBetValue = 0;

    for (const t in bets) {
        const val = parseFloat(bets[t]) || 0;
        if (val > 0) {
            totalBet += val;
            if(val > highestBetValue) { highestBetValue = val; highestBetTeam = t; }
        }
    }

    const totalFunds = user.balance + user.bonus;
    if (totalBet <= 0 || totalBet > totalFunds) return res.status(400).json({ error: "Saldo insuficiente" });

    let amountToPay = totalBet;
    if (user.bonus > 0) {
        if (user.bonus >= amountToPay) { user.bonus -= amountToPay; amountToPay = 0; } 
        else { amountToPay -= user.bonus; user.bonus = 0; }
    }
    if (amountToPay > 0) {
        user.balance -= amountToPay;
        houseStats.totalIn += amountToPay; houseStats.houseProfit += amountToPay;
        houseStats.prizePool += (amountToPay * POOL_PERCENT);
    }

    let resultIndex, resultSlot, isForcedWin = false;

    // LÓGICA DO POTE: Se passou da meta, libera prêmio
    if (nextSpinMustWin || houseStats.prizePool >= houseStats.poolTarget) {
        if (highestBetTeam) {
            const winningIndices = [];
            BOARD.forEach((slot, idx) => { if(slot.id === highestBetTeam) winningIndices.push(idx); });
            if(winningIndices.length > 0) {
                resultIndex = winningIndices[Math.floor(Math.random() * winningIndices.length)];
                resultSlot = BOARD[resultIndex];
                isForcedWin = true;
                nextSpinMustWin = false;
                if(houseStats.prizePool >= houseStats.poolTarget) houseStats.prizePool = 0; // Zera pote
            }
        }
    }

    if (!isForcedWin) {
        resultIndex = Math.floor(Math.random() * BOARD.length);
        resultSlot = BOARD[resultIndex];
    }

    gameHistory.unshift(resultSlot.id);
    if (gameHistory.length > 15) gameHistory.pop();

    const betOnWinner = parseFloat(bets[resultSlot.id]) || 0;
    const winAmount = betOnWinner > 0 ? betOnWinner * resultSlot.mult : 0;

    if (winAmount > 0) {
        user.balance += winAmount;
        houseStats.totalOut += winAmount; houseStats.houseProfit -= winAmount;
    }

    const totalDisplay = user.balance + user.bonus;
    res.json({
        resultIndex, winnerId: resultSlot.id, winAmount, newBalance: totalDisplay,
        history: gameHistory,
        jackpot: houseStats.prizePool // Envia valor atualizado do pote
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Global Cup Ultimate rodando na porta ${PORT}`));
