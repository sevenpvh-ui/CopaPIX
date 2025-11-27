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
    totalIn: 0,       // Total apostado
    totalOut: 0,      // Total pago em prêmios
    houseProfit: 0,   // Lucro líquido
    prizePool: 0      // O "Pote" dos 20%
};

// CONFIGURAÇÕES DO ADMIN
const ADMIN_PASSWORD = "admin"; // Senha para entrar no painel
const POOL_TARGET = 100.00;     // Meta para soltar o prêmio (R$ 100)
const POOL_PERCENT = 0.20;      // 20% vai para o pote

// TIMES
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

// --- VARIÁVEL DE CONTROLE DO ADMIN ---
let nextSpinMustWin = false; // Se true, o próximo giro é vitória garantida

app.get('/api/config', (req, res) => {
    res.json({ board: BOARD });
});

// --- ROTAS DE AUTH ---
app.post('/api/auth', (req, res) => {
    const { cpf, password, type } = req.body;
    if (!cpf || !password) return res.status(400).json({ error: "Preencha tudo" });

    if (type === 'register') {
        if (usersDB[cpf]) return res.status(400).json({ error: "CPF já existe" });
        usersDB[cpf] = { password, balance: 1000.00, history: 0 }; // history = total apostado
        return res.json({ success: true, balance: 1000.00 });
    }
    if (type === 'login') {
        const user = usersDB[cpf];
        if (!user || user.password !== password) return res.status(400).json({ error: "Erro no login" });
        return res.json({ success: true, balance: user.balance });
    }
});

// --- ROTA DE ADMINISTRAÇÃO ---
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if(password === ADMIN_PASSWORD) res.json({ success: true });
    else res.status(401).json({ error: "Senha incorreta" });
});

app.get('/api/admin/stats', (req, res) => {
    // Retorna estatísticas para o painel
    res.json({
        stats: houseStats,
        usersCount: Object.keys(usersDB).length,
        poolTarget: POOL_TARGET,
        nextRigged: nextSpinMustWin
    });
});

app.post('/api/admin/action', (req, res) => {
    const { action } = req.body;
    
    if(action === 'force_win') {
        nextSpinMustWin = true;
        return res.json({ msg: "Próxima rodada será VITÓRIA!" });
    }
    if(action === 'reset_stats') {
        houseStats = { totalIn: 0, totalOut: 0, houseProfit: 0, prizePool: 0 };
        return res.json({ msg: "Caixa zerado!" });
    }
});

// --- O JOGO (Lógica de Pote) ---
app.post('/api/spin', (req, res) => {
    const { bets, cpf } = req.body;
    const user = usersDB[cpf];
    if (!user) return res.status(401).json({ error: "Login necessário" });

    let totalBet = 0;
    // Identifica qual time o usuário apostou MAIS (para focar a vitória nele se precisar)
    let highestBetTeam = null;
    let highestBetValue = 0;

    for (const t in bets) {
        const val = parseFloat(bets[t]) || 0;
        if (val > 0) {
            totalBet += val;
            if(val > highestBetValue) {
                highestBetValue = val;
                highestBetTeam = t;
            }
        }
    }

    if (totalBet <= 0 || totalBet > user.balance) return res.status(400).json({ error: "Inválido" });

    // 1. Processa a entrada de dinheiro
    user.balance -= totalBet;
    user.history += totalBet;
    
    houseStats.totalIn += totalBet;
    houseStats.houseProfit += totalBet; // Entrou tudo
    
    // Separa 20% para o Pote
    const poolContribution = totalBet * POOL_PERCENT;
    houseStats.prizePool += poolContribution;

    // 2. Decide o Resultado
    let resultIndex;
    let resultSlot;
    let isForcedWin = false;

    // LÓGICA DO POTE OU COMANDO ADMIN
    // Se o Admin mandou ganhar OU se o Pote está cheio (R$ 100)
    if (nextSpinMustWin || houseStats.prizePool >= POOL_TARGET) {
        if (highestBetTeam) {
            // Procura um slot no tabuleiro que tenha esse time
            const winningIndices = [];
            BOARD.forEach((slot, idx) => {
                if(slot.id === highestBetTeam) winningIndices.push(idx);
            });
            
            // Escolhe um slot vencedor desse time
            if(winningIndices.length > 0) {
                resultIndex = winningIndices[Math.floor(Math.random() * winningIndices.length)];
                resultSlot = BOARD[resultIndex];
                isForcedWin = true;
                
                // Reseta triggers
                nextSpinMustWin = false;
                if(houseStats.prizePool >= POOL_TARGET) {
                    houseStats.prizePool = 0; // Pote esvazia pois pagou
                }
            }
        }
    }

    // Se não foi forçado, sorteio normal (RNG)
    if (!isForcedWin) {
        resultIndex = Math.floor(Math.random() * BOARD.length);
        resultSlot = BOARD[resultIndex];
    }

    // 3. Calcula Prêmio
    const betOnWinner = parseFloat(bets[resultSlot.id]) || 0;
    const winAmount = betOnWinner > 0 ? betOnWinner * resultSlot.mult : 0;

    if (winAmount > 0) {
        user.balance += winAmount;
        houseStats.totalOut += winAmount;
        houseStats.houseProfit -= winAmount; // Saiu do lucro
    }

    res.json({
        resultIndex,
        winnerId: resultSlot.id,
        winAmount,
        newBalance: user.balance
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Global Cup + Admin rodando na porta ${PORT}`));
