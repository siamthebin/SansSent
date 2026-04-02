import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, orderBy, getDocs, writeBatch, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Send, ArrowUpRight, ArrowDownLeft, Search, Loader2 } from 'lucide-react';

interface DashboardProps {
  user: User;
}

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  balance: number;
}

interface Transaction {
  id: string;
  senderId: string;
  senderEmail: string;
  receiverId: string;
  receiverEmail: string;
  amount: number;
  timestamp: any;
}

export default function Dashboard({ user }: DashboardProps) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Listen to user balance
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setUserData(doc.data() as UserData);
      }
    });
    return () => unsub();
  }, [user.uid]);

  // Listen to transactions
  useEffect(() => {
    // We need two queries because Firestore doesn't support OR queries easily with orderBy in older SDKs, 
    // but we can listen to both sent and received and merge them.
    const sentQuery = query(collection(db, 'transactions'), where('senderId', '==', user.uid));
    const receivedQuery = query(collection(db, 'transactions'), where('receiverId', '==', user.uid));

    const handleSnapshots = () => {
      // In a real app we'd merge the streams better, but for simplicity we'll just fetch both on any change
      // Actually, let's just use onSnapshot on both and merge in state
    };

    const unsubSent = onSnapshot(sentQuery, (snap) => {
      const sent = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      updateTransactions(sent, 'sent');
    });

    const unsubReceived = onSnapshot(receivedQuery, (snap) => {
      const received = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      updateTransactions(received, 'received');
    });

    let allSent: Transaction[] = [];
    let allReceived: Transaction[] = [];

    function updateTransactions(newTxs: Transaction[], type: 'sent' | 'received') {
      if (type === 'sent') allSent = newTxs;
      if (type === 'received') allReceived = newTxs;
      
      const merged = [...allSent, ...allReceived].sort((a, b) => {
        const timeA = a.timestamp?.toMillis() || 0;
        const timeB = b.timestamp?.toMillis() || 0;
        return timeB - timeA;
      });
      
      // Deduplicate just in case (e.g. sending to self)
      const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
      setTransactions(unique);
    }

    return () => {
      unsubSent();
      unsubReceived();
    };
  }, [user.uid]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!recipientEmail || !amount) {
      setError('Please fill in all fields');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (userData && numAmount > userData.balance) {
      setError('Insufficient funds');
      return;
    }

    if (recipientEmail.toLowerCase() === userData?.email?.toLowerCase()) {
      setError('You cannot send money to yourself');
      return;
    }

    setIsSending(true);

    try {
      // Find recipient
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', recipientEmail.toLowerCase()), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Recipient not found');
        setIsSending(false);
        return;
      }

      const recipientDoc = querySnapshot.docs[0];
      const recipientData = recipientDoc.data() as UserData;

      // Perform batch write
      const batch = writeBatch(db);

      // 1. Decrease sender balance
      const senderRef = doc(db, 'users', user.uid);
      batch.update(senderRef, {
        balance: (userData?.balance || 0) - numAmount
      });

      // 2. Increase receiver balance
      const receiverRef = doc(db, 'users', recipientData.uid);
      batch.update(receiverRef, {
        balance: recipientData.balance + numAmount
      });

      // 3. Create transaction record
      const newTxRef = doc(collection(db, 'transactions'));
      batch.set(newTxRef, {
        senderId: user.uid,
        senderEmail: userData?.email || 'unknown@email.com',
        receiverId: recipientData.uid,
        receiverEmail: recipientData.email,
        amount: numAmount,
        timestamp: serverTimestamp()
      });

      await batch.commit();

      setSuccess(`Successfully sent $${numAmount.toLocaleString()} to ${recipientData.displayName}`);
      setAmount('');
      setRecipientEmail('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while sending money');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Balance Card */}
      <div className="bg-gray-900 rounded-3xl p-8 border border-gray-800">
        <p className="text-gray-400 font-medium mb-2">Total Balance</p>
        <h2 className="text-5xl sm:text-6xl font-bold tracking-tighter">
          ${userData?.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Send Money Form */}
        <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 h-fit">
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Send className="w-5 h-5" /> Send Money
          </h3>
          
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Recipient Email</label>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full bg-black border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-white transition-colors"
                  placeholder="email@example.com"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-black border border-gray-800 rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-white transition-colors"
                placeholder="0.00"
                required
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            {success && <p className="text-emerald-400 text-sm">{success}</p>}

            <button
              type="submit"
              disabled={isSending}
              className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Now'}
            </button>
          </form>
        </div>

        {/* Transactions List */}
        <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800">
          <h3 className="text-xl font-semibold mb-6">Recent Transactions</h3>
          
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {transactions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No transactions yet.</p>
            ) : (
              transactions.map((tx) => {
                const isSent = tx.senderId === user.uid;
                return (
                  <div key={tx.id} className="flex items-center justify-between p-4 bg-black rounded-2xl border border-gray-800">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${isSent ? 'bg-gray-800 text-white' : 'bg-emerald-900/30 text-emerald-400'}`}>
                        {isSent ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-medium">{isSent ? tx.receiverEmail : tx.senderEmail}</p>
                        <p className="text-xs text-gray-500">
                          {tx.timestamp ? new Date(tx.timestamp.toMillis()).toLocaleString() : 'Just now'}
                        </p>
                      </div>
                    </div>
                    <div className={`font-semibold ${isSent ? 'text-white' : 'text-emerald-400'}`}>
                      {isSent ? '-' : '+'}${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
