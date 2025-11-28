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
    prizePool: 0,       
    poolTarget: 100.00, 
    bonusAmount: 5.00, 
    bonusActive: true  
};
let gameHistory = []; 
let withdrawalsQueue = []; 
let depositClaims = [];

const ADMIN_PASSWORD = "admin"; 
const POOL_PERCENT = 0.20; 

// --- TABULEIRO COM JACKPOT (24 Posições) ---
// Substituímos os cantos (0, 6, 12, 18) por 'jackpot'
const BOARD = [
    // TOPO (0-6)
    { id: 'jackpot', mult: 0 }, // Canto Superior Esquerdo
    { id: 'fra', mult: 5 }, 
    { id: 'eng', mult: 5 },
    { id: 'ger', mult: 10 }, 
    { id: 'spa', mult: 10 }, 
    { id: 'por', mult: 10 }, 
    { id: 'jackpot', mult: 0 }, // Canto Superior Direito

    // DIREITA (7-11)
    { id: 'bra', mult: 5 }, 
    { id: 'fra', mult: 5 },
    { id: 'eng', mult: 5 }, 
    { id: 'ger', mult: 10 },
    { id: 'ned', mult: 10 },

    // BAIXO (12-18)
    { id: 'jackpot', mult: 0 }, // Canto Inferior Direito
    { id: 'por', mult: 10 }, 
    { id: 'ned', mult: 10 },
    { id: 'bra', mult: 5 }, 
    { id: 'fra', mult: 5 }, 
    { id: 'eng', mult: 5 },
    { id: 'jackpot', mult: 0 }, // Canto Inferior Esquerdo

    // ESQUERDA (19-23)
    { id: 'ger', mult: 10 }, 
    { id: 'spa', mult: 10 }, 
    { id: 'por', mult: 10 },
    { id: 'ned', mult: 10 }, 
    { id: 'bra', mult: 5 }
];

let nextSpinMustWin = false;

// --- ROTAS ---

app.get('/api/config', (req, res) => {
    // Envia jackpot real para atualizar o visual se quiser, ou mantemos o fake no front
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
        usersDB[cpf] = { 
            password, name, phone, 
            balance: 0.00, 
            bonus: 0.00,   
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
    res.json({ 
        stats: houseStats, 
        usersCount: Object.keys(usersDB).length, 
        nextRigged: nextSpinMustWin,
        withdrawals: withdrawalsQueue,
        claims: depositClaims,
        poolTarget: houseStats.poolTarget // Adicionado explicitamente
    });
});

app.post('/api/admin/action', (req, res) => {
    const { action, id, bonusAmount, bonusActive, amount, cpf, newPoolTarget } = req.body;
    
    if(action === 'force_win') { nextSpinMustWin = true; return res.json({}); }
    if(action === 'reset_stats') { houseStats.totalIn = 0; houseStats.totalOut = 0; houseStats.houseProfit = 0; houseStats.prizePool = 0; return res.json({}); }
    
    if(action === 'update_bonus') {
        houseStats.bonusAmount = parseFloat(bonusAmount);
        houseStats.bonusActive = bonusActive;
        return res.json({ msg: "Ok!" });
    }

    if(action === 'update_pool_target') {
        houseStats.poolTarget = parseFloat(newPoolTarget);
        return res.json({ msg: "Meta atualizada!" });
    }

    if(action === 'approve_withdraw') {
        withdrawalsQueue = withdrawalsQueue.filter(w => w.id !== id);
        return res.json({ msg: "Pago!" });
    }

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

    if(action === 'reject_deposit') {
        depositClaims = depositClaims.filter(c => c.id !== id);
        return res.json({ msg: "Rejeitado" });
    }
});

// SPIN
app.post('/api/spin', (req, res) => {
    const { bets, cpf } = req.body;
    const user = usersDB[cpf];
    
    if (!user) return res.status(401).json({ error: "Login necessário" });

    let totalBet = 0;
    let highestBetTeam = null;
    let highestBetValue = 0;

    // Calcula aposta
    for (const t in bets) {
        const val = parseFloat(bets[t]) || 0;
        if (val > 0) {
            totalBet += val;
            if(val > highestBetValue) { highestBetValue = val; highestBetTeam = t; }
        }
    }

    const totalFunds = user.balance + user.bonus;
    if (totalBet <= 0 || totalBet > totalFunds) return res.status(400).json({ error: "Saldo insuficiente" });

    // 1. Cobrança
    let amountToPay = totalBet;
    if (user.bonus > 0) {
        if (user.bonus >= amountToPay) {
            user.bonus -= amountToPay;
            amountToPay = 0;
        } else {
            amountToPay -= user.bonus;
            user.bonus = 0;
        }
    }
    
    if (amountToPay > 0) {
        user.balance -= amountToPay;
        houseStats.totalIn += amountToPay; 
        houseStats.houseProfit += amountToPay;
        houseStats.prizePool += (amountToPay * POOL_PERCENT);
    }

    // 2. Sorteio
    let resultIndex, resultSlot, isForcedWin = false;
    let winAmount = 0;

    // --- LÓGICA DO JACKPOT ---
    // Se o Pote estourou ou Admin mandou, alguém vai ganhar o Pote
    // Para ganhar o pote, a luz TEM QUE parar num slot 'jackpot'
    if (nextSpinMustWin || houseStats.prizePool >= houseStats.poolTarget) {
        // Encontra onde estão os Jackpots
        const jackpotIndices = [];
        BOARD.forEach((slot, idx) => { if(slot.id === 'jackpot') jackpotIndices.push(idx); });
        
        if(jackpotIndices.length > 0) {
            // Sorteia um dos Jackpots para parar a luz
            resultIndex = jackpotIndices[Math.floor(Math.random() * jackpotIndices.length)];
            resultSlot = BOARD[resultIndex];
            
            // O jogador leva o Pote!
            winAmount = houseStats.prizePool;
            houseStats.prizePool = 0; // Zera o pote
            isForcedWin = true;
            nextSpinMustWin = false;
        }
    }

    if (!isForcedWin) {
        // Sorteio Normal
        resultIndex = Math.floor(Math.random() * BOARD.length);
        resultSlot = BOARD[resultIndex];

        if(resultSlot.id !== 'jackpot') {
            // Se caiu num país, vê se ele apostou nele
            const betOnWinner = parseFloat(bets[resultSlot.id]) || 0;
            winAmount = betOnWinner > 0 ? betOnWinner * resultSlot.mult : 0;
        } else {
            // Caiu no Jackpot mas não era hora de pagar = Perdeu tudo
            winAmount = 0;
        }
    }

    // Histórico: Se for jackpot, salvamos algo especial ou ignoramos? Vamos salvar como 'jackpot'
    gameHistory.unshift(resultSlot.id);
    if (gameHistory.length > 15) gameHistory.pop();

    if (winAmount > 0) {
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
        history: gameHistory,
        jackpot: houseStats.prizePool // Retorna zero se pagou, ou valor atual
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Global Cup Ultimate rodando na porta ${PORT}`));
