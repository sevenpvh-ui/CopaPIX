const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// --- DADOS NA MEMÓRIA ---
let usersDB = {}; 
let houseStats = { 
    totalIn: 0, 
    totalOut: 0, 
    houseProfit: 0, 
    prizePool: 0,
    bonusAmount: 5.00, 
    bonusActive: true  
};
let gameHistory = []; 
let withdrawalsQueue = []; 

const ADMIN_PASSWORD = "admin"; 
const POOL_TARGET = 100.00;     
const POOL_PERCENT = 0.20;      

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
    res.json({ board: BOARD, history: gameHistory });
});

app.post('/api/me', (req, res) => {
    const { cpf } = req.body;
    const user = usersDB[cpf];
    if(user) {
        // Envia a soma para exibir, mas o controle é interno
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
        usersDB[cpf] = { 
            password, name, phone, 
            balance: 0.00, // Começa com ZERO real
            bonus: 0.00,   // Começa com ZERO bônus
            lastBonus: 0
        };
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

    // Adiciona no saldo de BÔNUS (não sacável)
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

    // Depósito vai para saldo REAL
    user.balance += parseFloat(amount);
    houseStats.totalIn += parseFloat(amount);

    const totalDisplay = user.balance + user.bonus;
    res.json({ success: true, newBalance: totalDisplay });
});

app.post('/api/withdraw', (req, res) => {
    const { cpf, amount, pixKey } = req.body;
    const user = usersDB[cpf];
    
    if (!user) return res.status(401).json({ error: "Sessão finalizada." });
    if (amount <= 0) return res.status(400).json({ error: "Valor inválido." });
    
    // TRAVA DE BÔNUS: Só pode sacar o saldo REAL
    if (user.balance < amount) {
        return res.status(400).json({ error: `Saldo Real insuficiente. Bônus não pode ser sacado.` });
    }

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
    res.json({ stats: houseStats, usersCount: Object.keys(usersDB).length, poolTarget: POOL_TARGET, nextRigged: nextSpinMustWin, withdrawals: withdrawalsQueue });
});

app.post('/api/admin/action', (req, res) => {
    const { action, id, bonusAmount, bonusActive } = req.body;
    
    if(action === 'force_win') { nextSpinMustWin = true; return res.json({}); }
    if(action === 'reset_stats') { houseStats.totalIn = 0; houseStats.totalOut = 0; houseStats.houseProfit = 0; houseStats.prizePool = 0; return res.json({}); }
    if(action === 'update_bonus') { houseStats.bonusAmount = parseFloat(bonusAmount); houseStats.bonusActive = bonusActive; return res.json({ msg: "Ok!" }); }
    if(action === 'approve_withdraw') { withdrawalsQueue = withdrawalsQueue.filter(w => w.id !== id); return res.json({ msg: "Pago!" }); }
});

// SPIN (LÓGICA DE GASTAR BÔNUS PRIMEIRO)
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

    // 1. Processa pagamento (Gasta Bônus Primeiro)
    let amountToPay = totalBet;
    
    // Desconta do Bônus
    if (user.bonus > 0) {
        if (user.bonus >= amountToPay) {
            user.bonus -= amountToPay;
            amountToPay = 0;
        } else {
            amountToPay -= user.bonus;
            user.bonus = 0;
        }
    }
    
    // Desconta o resto do Saldo Real
    if (amountToPay > 0) {
        user.balance -= amountToPay;
        houseStats.totalIn += amountToPay; // Só conta pra casa o dinheiro real
        houseStats.houseProfit += amountToPay;
        houseStats.prizePool += (amountToPay * POOL_PERCENT); // Pote só cresce com dinheiro real
    }

    // 2. Decide Resultado
    let resultIndex, resultSlot, isForcedWin = false;

    if (nextSpinMustWin || houseStats.prizePool >= POOL_TARGET) {
        if (highestBetTeam) {
            const winningIndices = [];
            BOARD.forEach((slot, idx) => { if(slot.id === highestBetTeam) winningIndices.push(idx); });
            if(winningIndices.length > 0) {
                resultIndex = winningIndices[Math.floor(Math.random() * winningIndices.length)];
                resultSlot = BOARD[resultIndex];
                isForcedWin = true;
                nextSpinMustWin = false;
                if(houseStats.prizePool >= POOL_TARGET) houseStats.prizePool = 0;
            }
        }
    }

    if (!isForcedWin) {
        resultIndex = Math.floor(Math.random() * BOARD.length);
        resultSlot = BOARD[resultIndex];
    }

    gameHistory.unshift(resultSlot.id);
    if (gameHistory.length > 15) gameHistory.pop();

    // 3. Calcula Prêmio
    const betOnWinner = parseFloat(bets[resultSlot.id]) || 0;
    const winAmount = betOnWinner > 0 ? betOnWinner * resultSlot.mult : 0;

    if (winAmount > 0) {
        // Prêmio vai SEMPRE para o Saldo Real (O bônus vira real ao ganhar)
        user.balance += winAmount;
        
        houseStats.totalOut += winAmount;
        houseStats.houseProfit -= winAmount;
    }

    const totalDisplay = user.balance + user.bonus;

    res.json({
        resultIndex,
        winnerId: resultSlot.id,
        winAmount,
        newBalance: totalDisplay,
        history: gameHistory 
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Global Cup Ultimate rodando na porta ${PORT}`));
