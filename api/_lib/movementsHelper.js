import { db } from './firebaseAdmin.js';

/**
 * Records a new movement and recalculates the user's activeDebt, happyPoints, and creditScore.
 * 
 * @param {string} customerUID - The UID of the user.
 * @param {Object} movementData - The movement to create.
 * @param {string} movementData.type - 'purchase' | 'payment' | 'refund' | 'points' | 'adjustment'
 * @param {number} movementData.amount - The change amount (debt or points value).
 * @param {string} movementData.description - Summary of the movement.
 */
export async function addMovement(customerUID, movementData) {
    if (!customerUID) throw new Error("Missing customerUID");
    if (!movementData.type || movementData.amount === undefined) {
        throw new Error("Missing movement type or amount");
    }

    const userRef = db.collection('users').doc(customerUID);
    const movementRef = db.collection('movements').doc(); // Auto-generated ID

    // Run transaction to ensure atomicity
    await db.runTransaction(async (transaction) => {
        // 1. Check if user exists
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) {
            throw new Error(`User ${customerUID} does not exist`);
        }

        // 2. Create the movement document inside transaction
        const now = new Date().toISOString();
        const movementDoc = {
            movementId: movementRef.id,
            customerUID,
            type: movementData.type,
            amount: Number(movementData.amount),
            description: movementData.description || '',
            createdAt: now
        };
        transaction.set(movementRef, movementDoc);
    });

    // 3. Recalculate debt, points, and credit score
    await recalculateUserFields(customerUID);
}

/**
 * Recalculates the activeDebt, happyPoints, and creditScore of a user.
 * Credit score uses a FIFO algorithm matching payments to purchases chronologically.
 * 
 * @param {string} uid - User ID
 */
export async function recalculateUserFields(uid) {
    const userRef = db.collection('users').doc(uid);
    const movementsSnap = await db.collection('movements')
        .where('customerUID', '==', uid)
        .orderBy('createdAt', 'asc')
        .get();

    let activeDebt = 0;
    let happyPoints = 0;

    // Collect purchase and payment movements in chronological order
    const purchases = []; // { amount, date, remaining }
    const payments = [];  // { amount, date }

    movementsSnap.forEach(doc => {
        const m = doc.data();
        const amt = Number(m.amount) || 0;
        const date = m.createdAt || new Date().toISOString();

        if (m.type === 'purchase' && amt > 0) {
            purchases.push({ amount: amt, date, remaining: amt });
        }
        if (m.type === 'payment' || (m.type === 'adjustment' && amt < 0)) {
            payments.push({ amount: Math.abs(amt), date });
        }

        // Debt accounting
        if (['purchase', 'payment', 'refund', 'adjustment'].includes(m.type)) {
            activeDebt += amt;
        }
        if (m.type === 'points') {
            happyPoints += amt;
        }
    });

    // ============================================================
    // Credit Score: FIFO payment-to-purchase matching
    // ============================================================
    const STARTING_SCORE = 20;
    let score = STARTING_SCORE;
    const history = [];

    // For each payment, match against the oldest unpaid purchases
    for (const payment of payments) {
        let paymentRemaining = payment.amount;
        for (const purchase of purchases) {
            if (purchase.remaining <= 0 || paymentRemaining <= 0) continue;

            const settledAmount = Math.min(purchase.remaining, paymentRemaining);
            purchase.remaining -= settledAmount;
            paymentRemaining -= settledAmount;

            // Calculate days from purchase to payment
            const purchaseMs = new Date(purchase.date).getTime();
            const paymentMs = new Date(payment.date).getTime();
            const days = Math.max(0, Math.round((paymentMs - purchaseMs) / (1000 * 60 * 60 * 24)));

            let delta = 0;
            let reason = '';
            if (days <= 3) {
                delta = 5;
                reason = `Pago realizado en ${days} día${days !== 1 ? 's' : ''} (+5 pts — Excelente)`;
            } else if (days <= 7) {
                delta = 0;
                reason = `Pago realizado en ${days} días (0 pts — A tiempo)`;
            } else if (days <= 14) {
                delta = -5;
                reason = `Pago realizado en ${days} días (-5 pts — Con retraso)`;
            } else if (days <= 30) {
                delta = -10;
                reason = `Pago realizado en ${days} días (-10 pts — Retraso significativo)`;
            } else {
                delta = -20;
                reason = `Pago realizado en ${days} días (-20 pts — Mora)`;
            }

            score = Math.min(100, Math.max(0, score + delta));
            history.push({ date: payment.date, delta, reason });
        }
    }

    // Purchases still with remaining balance (unpaid for over 30 days)
    const now = Date.now();
    for (const purchase of purchases) {
        if (purchase.remaining <= 0) continue;
        const days = Math.round((now - new Date(purchase.date).getTime()) / (1000 * 60 * 60 * 24));
        if (days > 30) {
            score = Math.min(100, Math.max(0, score - 20));
            history.push({
                date: new Date().toISOString(),
                delta: -20,
                reason: `Deuda sin pagar por más de ${days} días (-20 pts — Impago)`
            });
        }
    }

    // Calculate tier: A >= 85, B >= 65, C >= 40, D < 40
    let tier = 'D';
    if (score >= 85) tier = 'A';
    else if (score >= 65) tier = 'B';
    else if (score >= 40) tier = 'C';

    // Determine debt status
    let debtStatus = 'clear';
    if (activeDebt > 0) debtStatus = 'pending_payment';

    // Write all updates
    const batch = db.batch();

    batch.update(userRef, {
        activeDebt: Math.max(0, activeDebt),
        happyPoints: Math.max(0, happyPoints),
        debtStatus,
        updatedAt: new Date().toISOString()
    });

    const creditRef = db.collection('creditScores').doc(uid);
    batch.set(creditRef, {
        score,
        tier,
        lastUpdated: new Date().toISOString(),
        history
    }, { merge: false }); // Full rewrite on each recalculation

    await batch.commit();
}

