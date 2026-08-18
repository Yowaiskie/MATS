import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type {
  EventIncome,
  EventExpense,
  EventFundTransfer,
  EventFinanceCategory,
} from '@/types/eventFinance'
import { auditService } from './auditService'

const INCOMES_COL = 'eventIncome'
const EXPENSES_COL = 'eventExpenses'
const TRANSFERS_COL = 'eventFundTransfers'
const CATEGORIES_COL = 'eventFinanceCategories'

/**
 * Checks if the financial period for a given date is closed (from main finance module).
 */
async function checkPeriodClosedTx(tx: any, dateStr: string) {
  const periodId = dateStr.slice(0, 7)
  const periodRef = doc(db, 'financePeriods', periodId)
  const periodDoc = await tx.get(periodRef)
  if (periodDoc.exists() && periodDoc.data().status === 'closed') {
    throw new Error(`The financial period ${periodId} is closed.`)
  }
}

export const eventFinanceService = {
  async getEventIncomes(eventId: string): Promise<EventIncome[]> {
    const q = query(
      collection(db, INCOMES_COL),
      where('eventId', '==', eventId),
      orderBy('date', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as EventIncome))
  },

  async addEventIncome(
    income: Omit<EventIncome, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid' | 'createdByName'>,
    uid: string,
    name: string
  ): Promise<string> {
    const payload = {
      ...income,
      isArchived: false,
      createdByUid: uid,
      createdByName: name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    const docRef = await addDoc(collection(db, INCOMES_COL), payload)
    await auditService.logAction(
      'EVENT_INCOME_ADD',
      'events',
      `Added event income of $${income.amount} to event ${income.eventId}`,
      name,
      { eventId: income.eventId, incomeId: docRef.id }
    )
    return docRef.id
  },

  async updateEventIncome(
    id: string,
    updates: Partial<EventIncome>,
    eventId: string,
    _uid: string,
    name: string
  ): Promise<void> {
    await updateDoc(doc(db, INCOMES_COL, id), {
      ...updates,
      updatedAt: serverTimestamp(),
      lastEditedBy: name,
      lastEditedAt: new Date().toISOString()
    })
    await auditService.logAction(
      'EVENT_INCOME_UPDATE',
      'events',
      `Updated event income ${id}`,
      name,
      { eventId, incomeId: id }
    )
  },

  async archiveEventIncome(id: string, eventId: string, _uid: string, name: string): Promise<void> {
    await updateDoc(doc(db, INCOMES_COL, id), {
      isArchived: true,
      archivedBy: name,
      archivedAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    })
    await auditService.logAction(
      'EVENT_INCOME_DELETE',
      'events',
      `Archived event income ${id}`,
      name,
      { eventId, incomeId: id }
    )
  },

  async deleteEventIncome(id: string, eventId: string, _uid: string, name: string): Promise<void> {
    await deleteDoc(doc(db, INCOMES_COL, id))
    await auditService.logAction(
      'EVENT_INCOME_DELETE',
      'events',
      `Permanently deleted event income ${id}`,
      name,
      { eventId, incomeId: id }
    )
  },

  async getEventExpenses(eventId: string): Promise<EventExpense[]> {
    const q = query(
      collection(db, EXPENSES_COL),
      where('eventId', '==', eventId),
      orderBy('date', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as EventExpense))
  },

  async addEventExpense(
    expense: Omit<EventExpense, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid' | 'createdByName'>,
    uid: string,
    name: string,
    eventName?: string
  ): Promise<string> {
    if (expense.fundSource === 'main_funds') {
      let createdExpenseId = ''
      await runTransaction(db, async (tx) => {
        // Validate Event
        const eventRef = doc(db, 'events', expense.eventId)
        const eventDoc = await tx.get(eventRef)
        const resolvedEventName = eventName || (eventDoc.exists() ? (eventDoc.data().title || eventDoc.data().name || 'Event') : 'Event')

        // Validate Period
        await checkPeriodClosedTx(tx, expense.date)

        // Generate Reference Number for Main Finance Expense
        const yearMonth = expense.date.slice(0, 7).replace('-', '')
        const counterId = `finance_exp_${yearMonth}`
        const counterRef = doc(db, 'counters', counterId)
        const counterDoc = await tx.get(counterRef)
        let nextSeq = 1
        if (counterDoc.exists()) {
          nextSeq = (counterDoc.data().currentSeq || 0) + 1
        }
        tx.set(counterRef, { currentSeq: nextSeq }, { merge: true })
        const paddedSeq = String(nextSeq).padStart(5, '0')
        const referenceNumber = `EXP-${yearMonth}-${paddedSeq}`

        const mainExpenseRef = doc(collection(db, 'financeExpenses'))
        const eventExpenseRef = doc(collection(db, EXPENSES_COL))
        createdExpenseId = eventExpenseRef.id

        tx.set(mainExpenseRef, {
          amount: Number(expense.amount),
          categoryId: expense.mainFinanceCategoryId || '',
          spentByUid: uid,
          spentByName: expense.spentByName,
          date: expense.date,
          description: `[Event: ${resolvedEventName}] ${expense.spentOn}${expense.description ? ` - ${expense.description}` : ''}`,
          referenceNumber,
          periodId: expense.date.slice(0, 7),
          isArchived: false,
          createdByUid: uid,
          createdByName: name,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          sourceType: 'event_expense',
          sourceEventId: expense.eventId,
          sourceEventExpenseId: eventExpenseRef.id,
          sourceEventName: resolvedEventName
        })

        tx.set(eventExpenseRef, {
          ...expense,
          amount: Number(expense.amount),
          fundSource: 'main_funds',
          mainFinanceExpenseId: mainExpenseRef.id,
          isArchived: false,
          createdByUid: uid,
          createdByName: name,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      })

      await auditService.logAction(
        'EVENT_EXPENSE_ADD',
        'events',
        `Added event expense of ₱${expense.amount} to event ${expense.eventId} (Funded from Main Funds)`,
        name,
        { eventId: expense.eventId, expenseId: createdExpenseId, fundSource: 'main_funds' }
      )
      return createdExpenseId
    }

    const payload = {
      ...expense,
      fundSource: 'event',
      isArchived: false,
      createdByUid: uid,
      createdByName: name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    const docRef = await addDoc(collection(db, EXPENSES_COL), payload)
    await auditService.logAction(
      'EVENT_EXPENSE_ADD',
      'events',
      `Added event expense of ₱${expense.amount} to event ${expense.eventId}`,
      name,
      { eventId: expense.eventId, expenseId: docRef.id }
    )
    return docRef.id
  },

  async updateEventExpense(
    id: string,
    updates: Partial<EventExpense>,
    eventId: string,
    _uid: string,
    name: string
  ): Promise<void> {
    const expenseRef = doc(db, EXPENSES_COL, id)
    const expenseDoc = await getDoc(expenseRef)
    
    await updateDoc(expenseRef, {
      ...updates,
      updatedAt: serverTimestamp(),
      lastEditedBy: name,
      lastEditedAt: new Date().toISOString()
    })

    if (expenseDoc.exists()) {
      const data = expenseDoc.data()
      const mainExpenseId = updates.mainFinanceExpenseId || data.mainFinanceExpenseId
      if (mainExpenseId) {
        const mainExpenseRef = doc(db, 'financeExpenses', mainExpenseId)
        const mainExpDoc = await getDoc(mainExpenseRef)
        if (mainExpDoc.exists()) {
          const mainUpdates: any = {
            updatedAt: serverTimestamp(),
            updatedByUid: _uid,
            updatedByName: name
          }
          if (updates.amount !== undefined) mainUpdates.amount = Number(updates.amount)
          if (updates.date) {
            mainUpdates.date = updates.date
            mainUpdates.periodId = updates.date.slice(0, 7)
          }
          if (updates.mainFinanceCategoryId) mainUpdates.categoryId = updates.mainFinanceCategoryId
          if (updates.spentByName) mainUpdates.spentByName = updates.spentByName
          if (updates.spentOn !== undefined || updates.description !== undefined) {
            const spentOn = updates.spentOn || data.spentOn || ''
            const desc = updates.description !== undefined ? updates.description : (data.description || '')
            const eventName = mainExpDoc.data().sourceEventName || 'Event'
            mainUpdates.description = `[Event: ${eventName}] ${spentOn}${desc ? ` - ${desc}` : ''}`
          }
          await updateDoc(mainExpenseRef, mainUpdates)
        }
      }
    }

    await auditService.logAction(
      'EVENT_EXPENSE_UPDATE',
      'events',
      `Updated event expense ${id}`,
      name,
      { eventId, expenseId: id }
    )
  },

  async archiveEventExpense(id: string, eventId: string, _uid: string, name: string): Promise<void> {
    const expenseRef = doc(db, EXPENSES_COL, id)
    const expenseDoc = await getDoc(expenseRef)

    await updateDoc(expenseRef, {
      isArchived: true,
      archivedBy: name,
      archivedAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    })

    if (expenseDoc.exists() && expenseDoc.data().mainFinanceExpenseId) {
      const mainExpenseRef = doc(db, 'financeExpenses', expenseDoc.data().mainFinanceExpenseId)
      await updateDoc(mainExpenseRef, {
        isArchived: true,
        archivedByUid: _uid,
        archivedByName: name,
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    }

    await auditService.logAction(
      'EVENT_EXPENSE_DELETE',
      'events',
      `Archived event expense ${id}`,
      name,
      { eventId, expenseId: id }
    )
  },

  async deleteEventExpense(id: string, eventId: string, _uid: string, name: string): Promise<void> {
    const expenseRef = doc(db, EXPENSES_COL, id)
    const expenseDoc = await getDoc(expenseRef)

    await deleteDoc(expenseRef)

    if (expenseDoc.exists() && expenseDoc.data().mainFinanceExpenseId) {
      const mainExpenseRef = doc(db, 'financeExpenses', expenseDoc.data().mainFinanceExpenseId)
      await deleteDoc(mainExpenseRef)
    }

    await auditService.logAction(
      'EVENT_EXPENSE_DELETE',
      'events',
      `Permanently deleted event expense ${id}`,
      name,
      { eventId, expenseId: id }
    )
  },

  async getEventFinanceCategories(eventId: string, type?: 'income' | 'expense'): Promise<EventFinanceCategory[]> {
    let q
    if (type) {
      q = query(collection(db, CATEGORIES_COL), where('eventId', '==', eventId), where('type', '==', type))
    } else {
      q = query(collection(db, CATEGORIES_COL), where('eventId', '==', eventId))
    }
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as EventFinanceCategory))
  },

  async addEventFinanceCategory(
    eventId: string,
    categoryName: string,
    type: 'income' | 'expense',
    uid: string,
    name: string
  ): Promise<string> {
    const payload = {
      eventId,
      name: categoryName,
      type,
      isArchived: false,
      createdByUid: uid,
      createdByName: name,
      createdAt: serverTimestamp(),
    }
    const docRef = await addDoc(collection(db, CATEGORIES_COL), payload)
    await auditService.logAction(
      'EVENT_FINANCE_CATEGORY_CREATE',
      'events',
      `Created event finance category '${categoryName}' for event ${eventId}`,
      name,
      { eventId, categoryId: docRef.id }
    )
    return docRef.id
  },

  async getEventFundTransfers(eventId: string): Promise<EventFundTransfer[]> {
    const q = query(
      collection(db, TRANSFERS_COL),
      where('eventId', '==', eventId),
      orderBy('date', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as EventFundTransfer))
  },

  async transferToMainFunds(
    eventId: string,
    eventName: string,
    amount: number,
    mainFundCategoryId: string,
    date: string,
    remarks: string,
    uid: string,
    name: string
  ): Promise<void> {
    // We execute the queries before the transaction to calculate the balance because 
    // Firestore Web SDK runTransaction does not support querying inside the transaction.
    // However, to ensure atomicity against concurrent transfers, we will read a special
    // lock/balance mechanism if one existed, but here we will rely on fetching the current totals.
    // We fetch the current totals, then inside the transaction we verify the event document exists.
    
    // 1. Pre-fetch relevant records to calculate available balance.
    const [incomes, expenses, transfers] = await Promise.all([
      this.getEventIncomes(eventId),
      this.getEventExpenses(eventId),
      this.getEventFundTransfers(eventId)
    ])

    const totalIncome = incomes.filter(i => i.encashmentStatus !== 'pending').reduce((sum, i) => sum + i.amount, 0)
    const totalExpenses = expenses.filter(e => e.encashmentStatus !== 'pending').reduce((sum, e) => sum + e.amount, 0)
    const totalTransfers = transfers.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.amount, 0)
    
    const availableBalance = totalIncome - totalExpenses - totalTransfers

    if (amount <= 0) throw new Error('Transfer amount must be greater than zero.')
    if (amount > availableBalance) throw new Error('Transfer amount exceeds available balance.')

    await runTransaction(db, async (tx) => {
      // Validate Event exists
      const eventRef = doc(db, 'events', eventId)
      const eventDoc = await tx.get(eventRef)
      if (!eventDoc.exists()) throw new Error('Event does not exist.')

      // Validate Main Finance Category exists
      const catRef = doc(db, 'financeCategories', mainFundCategoryId)
      const catDoc = await tx.get(catRef)
      if (!catDoc.exists() || catDoc.data().isArchived) {
        throw new Error('Destination main finance category does not exist or is archived.')
      }

      // Check closed period for main finance
      await checkPeriodClosedTx(tx, date)

      // Generate Reference Number for Main Finance Income
      const yearMonth = date.slice(0, 7).replace('-', '') // "202607"
      const counterId = `finance_inc_${yearMonth}`
      const counterRef = doc(db, 'counters', counterId)
      const counterDoc = await tx.get(counterRef)
      let nextSeq = 1
      if (counterDoc.exists()) {
        nextSeq = (counterDoc.data().currentSeq || 0) + 1
      }
      tx.set(counterRef, { currentSeq: nextSeq }, { merge: true })
      const paddedSeq = String(nextSeq).padStart(5, '0')
      const referenceNumber = `INC-${yearMonth}-${paddedSeq}`

      // Create EventFundTransfer record
      const transferRef = doc(collection(db, TRANSFERS_COL))
      tx.set(transferRef, {
        eventId,
        eventName,
        amount,
        mainFundCategoryId,
        date,
        remarks,
        status: 'completed',
        createdByUid: uid,
        createdByName: name,
        createdAt: serverTimestamp(),
      })

      // Create Main Finance Income record
      const mainIncomeRef = doc(collection(db, 'financeIncome'))
      tx.set(mainIncomeRef, {
        amount,
        source: `Event Surplus: ${eventName}`,
        categoryId: mainFundCategoryId,
        receivedFrom: eventName,
        date,
        description: remarks,
        referenceNumber,
        periodId: date.slice(0, 7),
        isArchived: false,
        createdByUid: uid,
        createdByName: name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Integration Tracing
        sourceType: 'event_transfer',
        sourceEventId: eventId,
        sourceTransferId: transferRef.id
      })
    })

    // Log the successful transfer outside the transaction
    await auditService.logAction(
      'EVENT_TRANSFER_CREATE',
      'events',
      `Transferred $${amount} from event '${eventName}' to main funds.`,
      name,
      { eventId, amount }
    )
  },

  async reverseTransfer(id: string, eventId: string, uid: string, name: string): Promise<void> {
    // In a full implementation, reversing a transfer would require reversing the corresponding main finance income.
    // For this implementation, we will update the transfer status and rely on manual voiding of the main income if needed, 
    // or we can query the main income by sourceTransferId and void it in a batch.
    
    // Find the associated financeIncome record
    const q = query(collection(db, 'financeIncome'), where('sourceTransferId', '==', id))
    const snap = await getDocs(q)

    await runTransaction(db, async (tx) => {
      const transferRef = doc(db, TRANSFERS_COL, id)
      const transferDoc = await tx.get(transferRef)
      if (!transferDoc.exists()) throw new Error('Transfer does not exist.')
      if (transferDoc.data().status === 'reversed') throw new Error('Transfer is already reversed.')

      tx.update(transferRef, { status: 'reversed' })

      if (!snap.empty) {
        // Void/Archive the linked main finance income
        snap.docs.forEach(docSnap => {
          tx.update(docSnap.ref, {
            isArchived: true,
            updatedAt: serverTimestamp(),
            archivedAt: serverTimestamp(),
            archivedByUid: uid,
            archivedByName: name
          })
        })
      }
    })

    await auditService.logAction(
      'EVENT_TRANSFER_REVERSE',
      'events',
      `Reversed transfer ${id} for event ${eventId}`,
      name,
      { eventId, transferId: id }
    )
  }
}
