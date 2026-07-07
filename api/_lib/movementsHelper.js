import { db } from './firebaseAdmin.js';

/**
 * Records a new movement and recalculates the user's activeDebt and happyPoints.
 * This runs inside a transaction or sequential operations to guarantee consistency.
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

    // 3. Recalculate debt and points
    await recalculateUserFields(customerUID);
}

/**
 * Recalculates the activeDebt and happyPoints of a user by summing all their movements.
 * 
 * @param {string} uid - User ID
 */
export async function recalculateUserFields(uid) {
    const userRef = db.collection('users').doc(uid);
    const movementsSnap = await db.collection('movements')
        .where('customerUID', '==', uid)
        .get();

    let activeDebt = 0;
    let happyPoints = 0;

    movementsSnap.forEach(doc => {
        const m = doc.data();
        const amt = Number(m.amount) || 0;
        
        if (m.type === 'purchase' || m.type === 'payment' || m.type === 'refund' || m.type === 'adjustment') {
            activeDebt += amt;
        }
        if (m.type === 'points') {
            happyPoints += amt;
        }
    });

    // Determine debt status
    let debtStatus = 'clear';
    if (activeDebt > 0) {
        debtStatus = 'pending_payment';
    }

    await userRef.update({
        activeDebt: Math.max(0, activeDebt), // Debt shouldn't be negative
        happyPoints: Math.max(0, happyPoints), // Points shouldn't be negative
        debtStatus,
        updatedAt: new Date().toISOString()
    });
}
