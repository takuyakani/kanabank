import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { Role, HouseholdData, ChoreMaster, ChoreRequest, Transaction } from '../types';
import { INITIAL_HOUSEHOLD, INITIAL_CHORES, INITIAL_REQUESTS, INITIAL_TRANSACTIONS } from '../data/initialData';
import { isFirebaseConfigured, auth, db } from '../lib/firebase';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  type Firestore
} from 'firebase/firestore';

interface AppContextType {
  role: Role | null;
  currentUser: { email: string; role: Role } | null;
  household: HouseholdData;
  chores: ChoreMaster[];
  requests: ChoreRequest[];
  transactions: Transaction[];
  isDemoMode: boolean;
  login: (email: string, pass: string, targetRole: Role) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateGoal: (title: string, amount: number) => Promise<{ success: boolean; error?: string }>;
  submitChoreRequest: (choreId: string, comment?: string) => Promise<void>;
  approveRequest: (requestId: string, bonus?: number, parentComment?: string) => Promise<void>;
  rejectRequest: (requestId: string, parentComment?: string) => Promise<void>;
  addPenalty: (title: string, amount: number, note?: string) => Promise<{ success: boolean; error?: string }>;
  addSpend: (title: string, amount: number, note?: string) => Promise<{ success: boolean; error?: string }>;
  addChoreMaster: (chore: Omit<ChoreMaster, 'id'>) => Promise<void>;
  updateChoreMaster: (chore: ChoreMaster) => Promise<void>;
  deleteChoreMaster: (id: string) => Promise<void>;
  redeemGoal: () => Promise<{ success: boolean; error?: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'kanabank_data_v1';
const LOCAL_PARENT_USER_KEY = 'kanabank_parent_user';
const LOCAL_CHILD_USER_KEY = 'kanabank_child_user';
const BROADCAST_CHANNEL_NAME = 'kanabank_sync_channel';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<Role | null>(null);
  const [currentUser, setCurrentUser] = useState<{ email: string; role: Role } | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(!isFirebaseConfigured);

  // データステート
  const [household, setHousehold] = useState<HouseholdData>(INITIAL_HOUSEHOLD);
  const [chores, setChores] = useState<ChoreMaster[]>(INITIAL_CHORES);
  const [requests, setRequests] = useState<ChoreRequest[]>(INITIAL_REQUESTS);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);

  // BroadcastChannel 参照
  const channelRef = useRef<BroadcastChannel | null>(null);

  // 現在のURLハッシュパスから初期ロールを推定（#/parent なら parent セッション、#/child なら child セッション）
  useEffect(() => {
    const hash = window.location.hash;
    const isParentPath = hash.startsWith('#/parent');
    const isChildPath = hash.startsWith('#/child');

    if (isParentPath) {
      const savedParent = localStorage.getItem(LOCAL_PARENT_USER_KEY);
      if (savedParent) {
        try {
          const parsed = JSON.parse(savedParent);
          if (parsed.role === 'parent') {
            setCurrentUser(parsed);
            setRole('parent');
          }
        } catch (e) {
          console.error(e);
        }
      }
    } else if (isChildPath) {
      const savedChild = localStorage.getItem(LOCAL_CHILD_USER_KEY);
      if (savedChild) {
        try {
          const parsed = JSON.parse(savedChild);
          if (parsed.role === 'child') {
            setCurrentUser(parsed);
            setRole('child');
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  // BroadcastChannel 及び storage イベントリスナーの設定（同一端末の複数タブ間リアルタイム同期）
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channelRef.current = channel;

      channel.onmessage = (event) => {
        if (event.data?.type === 'SYNC_DATA') {
          const data = event.data.payload;
          if (data) {
            if (data.household) setHousehold(data.household);
            if (data.chores) setChores(data.chores);
            if (data.requests) setRequests(data.requests);
            if (data.transactions) setTransactions(data.transactions);
          }
        }
      };
    }

    // fallback for window storage event
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.household) setHousehold(parsed.household);
          if (parsed.chores) setChores(parsed.chores);
          if (parsed.requests) setRequests(parsed.requests);
          if (parsed.transactions) setTransactions(parsed.transactions);
        } catch (err) {
          console.error('Storage sync error', err);
        }
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      channelRef.current?.close();
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  // 初期データロード
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setIsDemoMode(true);
      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.household) setHousehold(parsed.household);
          if (parsed.chores) setChores(parsed.chores);
          if (parsed.requests) setRequests(parsed.requests);
          if (parsed.transactions) setTransactions(parsed.transactions);
        } catch (e) {
          console.error('Failed to parse local storage data', e);
        }
      }
    } else {
      // Firebaseリスナーセットアップ
      if (!auth || !db) return;
      const firestoreDb: Firestore = db;

      const unsubscribeAuth = onAuthStateChanged(auth, (_user: User | null) => {});

      // 世帯情報リスナー
      const unsubscribeHousehold = onSnapshot(doc(firestoreDb, 'household', 'default'), (docSnap) => {
        if (docSnap.exists()) {
          setHousehold(docSnap.data() as HouseholdData);
        } else {
          setDoc(doc(firestoreDb, 'household', 'default'), INITIAL_HOUSEHOLD);
        }
      });

      // お手伝いマスターリスナー
      const unsubscribeChores = onSnapshot(collection(firestoreDb, 'chores'), (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChoreMaster));
          setChores(list);
        } else {
          INITIAL_CHORES.forEach((c) => setDoc(doc(firestoreDb, 'chores', c.id), c));
        }
      });

      // 申請リスナー
      const qRequests = query(collection(firestoreDb, 'requests'), orderBy('requestedAt', 'desc'));
      const unsubscribeRequests = onSnapshot(qRequests, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChoreRequest));
        setRequests(list);
      });

      // 履歴リスナー
      const qTransactions = query(collection(firestoreDb, 'transactions'), orderBy('createdAt', 'desc'));
      const unsubscribeTransactions = onSnapshot(qTransactions, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));
        setTransactions(list);
      });

      return () => {
        unsubscribeAuth();
        unsubscribeHousehold();
        unsubscribeChores();
        unsubscribeRequests();
        unsubscribeTransactions();
      };
    }
  }, []);

  // ローカル保存＆他タブへのブロードキャスト配信
  const broadcastAndSaveLocalData = (
    h: HouseholdData = household,
    c: ChoreMaster[] = chores,
    r: ChoreRequest[] = requests,
    t: Transaction[] = transactions
  ) => {
    const payload = { household: h, chores: c, requests: r, transactions: t };
    if (!isFirebaseConfigured) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    }
    // 他タブへ即時ブロードキャスト
    channelRef.current?.postMessage({
      type: 'SYNC_DATA',
      payload,
    });
  };

  // ログイン処理（親と子のセッションを独立管理）
  const login = async (email: string, pass: string, targetRole: Role) => {
    if (isFirebaseConfigured && auth) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        const userObj = { email: userCredential.user.email || email, role: targetRole };
        setCurrentUser(userObj);
        setRole(targetRole);

        const storageKey = targetRole === 'parent' ? LOCAL_PARENT_USER_KEY : LOCAL_CHILD_USER_KEY;
        localStorage.setItem(storageKey, JSON.stringify(userObj));
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || '認証に失敗しました。' };
      }
    } else {
      // デモモード：4文字以上のパスワードを要求
      if (pass.length < 4) {
        return { success: false, error: 'パスワードは4文字以上で入力してください。' };
      }

      const userObj = { email, role: targetRole };
      setCurrentUser(userObj);
      setRole(targetRole);

      const storageKey = targetRole === 'parent' ? LOCAL_PARENT_USER_KEY : LOCAL_CHILD_USER_KEY;
      localStorage.setItem(storageKey, JSON.stringify(userObj));
      return { success: true };
    }
  };

  // ログアウト処理（現在のロールのセッションのみ解除）
  const logout = async () => {
    if (isFirebaseConfigured && auth) {
      await firebaseSignOut(auth);
    }
    if (currentUser?.role === 'parent') {
      localStorage.removeItem(LOCAL_PARENT_USER_KEY);
    } else if (currentUser?.role === 'child') {
      localStorage.removeItem(LOCAL_CHILD_USER_KEY);
    }
    setCurrentUser(null);
    setRole(null);
  };

  // 目標の更新（バリデーション付き）
  const updateGoal = async (title: string, amount: number) => {
    const cleanAmount = Math.floor(amount);
    if (!title.trim()) {
      return { success: false, error: '目標の名前を入力してください。' };
    }
    if (cleanAmount <= 0) {
      return { success: false, error: '目標金額は1円以上で設定してください。' };
    }

    const updated = { ...household, goalTitle: title.trim(), goalAmount: cleanAmount, updatedAt: new Date().toISOString() };
    setHousehold(updated);
    broadcastAndSaveLocalData(updated);

    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, 'household', 'default'), updated, { merge: true });
    }
    return { success: true };
  };

  // お手伝い申請
  const submitChoreRequest = async (choreId: string, comment: string = '') => {
    const chore = chores.find((c) => c.id === choreId);
    if (!chore) return;

    const newReq: ChoreRequest = {
      id: `req-${Date.now()}`,
      choreId,
      title: chore.title,
      reward: chore.reward,
      bonus: 0,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      comment: comment.trim(),
    };

    const nextRequests = [newReq, ...requests];
    setRequests(nextRequests);
    broadcastAndSaveLocalData(undefined, undefined, nextRequests);

    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, 'requests', newReq.id), newReq);
    }
  };

  // 申請承認
  const approveRequest = async (requestId: string, bonus: number = 0, parentComment: string = '') => {
    const req = requests.find((r) => r.id === requestId);
    if (!req || req.status !== 'pending') return;

    const safeBonus = Math.max(0, Math.floor(bonus));
    const totalEarned = req.reward + safeBonus;
    const nowIso = new Date().toISOString();
    const todayDate = nowIso.split('T')[0];

    const currentActor = currentUser?.email || '保護者';

    const updatedReq: ChoreRequest = {
      ...req,
      status: 'approved',
      bonus: safeBonus,
      processedAt: nowIso,
      processedBy: currentActor,
      parentComment: parentComment.trim(),
    };

    const nextRequests = requests.map((r) => (r.id === requestId ? updatedReq : r));
    const nextBalance = household.balance + totalEarned;
    const updatedHousehold = { ...household, balance: nextBalance, updatedAt: nowIso };

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      type: 'chore',
      title: safeBonus > 0 ? `${req.title} (+ボーナス${safeBonus}円)` : req.title,
      amount: totalEarned,
      date: todayDate,
      createdAt: nowIso,
      createdBy: currentActor,
      note: parentComment.trim() || req.comment,
      relatedRequestId: req.id,
    };
    const nextTxs = [newTx, ...transactions];

    setRequests(nextRequests);
    setHousehold(updatedHousehold);
    setTransactions(nextTxs);
    broadcastAndSaveLocalData(updatedHousehold, undefined, nextRequests, nextTxs);

    if (isFirebaseConfigured && db) {
      await updateDoc(doc(db, 'requests', req.id), {
        status: 'approved',
        bonus: safeBonus,
        processedAt: nowIso,
        parentComment: parentComment.trim(),
      });
      await updateDoc(doc(db, 'household', 'default'), { balance: nextBalance, updatedAt: nowIso });
      await setDoc(doc(db, 'transactions', newTx.id), newTx);
    }
  };

  // 申請却下
  const rejectRequest = async (requestId: string, parentComment: string = '') => {
    const req = requests.find((r) => r.id === requestId);
    if (!req) return;

    const nowIso = new Date().toISOString();
    const updatedReq: ChoreRequest = {
      ...req,
      status: 'rejected',
      processedAt: nowIso,
      parentComment: parentComment.trim(),
    };

    const nextRequests = requests.map((r) => (r.id === requestId ? updatedReq : r));
    setRequests(nextRequests);
    broadcastAndSaveLocalData(undefined, undefined, nextRequests);

    if (isFirebaseConfigured && db) {
      await updateDoc(doc(db, 'requests', req.id), {
        status: 'rejected',
        processedAt: nowIso,
        parentComment: parentComment.trim(),
      });
    }
  };

  // 叱られペナルティ（減額バリデーション強化）
  const addPenalty = async (title: string, amount: number, note: string = '') => {
    const cleanAmount = Math.floor(amount);
    if (!title.trim()) {
      return { success: false, error: '叱られた理由を入力してください。' };
    }
    if (cleanAmount <= 0) {
      return { success: false, error: '減額する金額は1円以上を入力してください。' };
    }

    const deduction = cleanAmount;
    const nowIso = new Date().toISOString();
    const todayDate = nowIso.split('T')[0];

    const nextBalance = Math.max(0, household.balance - deduction);
    const updatedHousehold = { ...household, balance: nextBalance, updatedAt: nowIso };

    const currentActor = currentUser?.email || '保護者';

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      type: 'penalty',
      title: `叱られ・ペナルティ: ${title.trim()}`,
      amount: -deduction,
      date: todayDate,
      createdAt: nowIso,
      createdBy: currentActor,
      note: note.trim(),
    };
    const nextTxs = [newTx, ...transactions];

    setHousehold(updatedHousehold);
    setTransactions(nextTxs);
    broadcastAndSaveLocalData(updatedHousehold, undefined, undefined, nextTxs);

    if (isFirebaseConfigured && db) {
      await updateDoc(doc(db, 'household', 'default'), { balance: nextBalance, updatedAt: nowIso });
      await setDoc(doc(db, 'transactions', newTx.id), newTx);
    }
    return { success: true };
  };

  // お小遣い使用（出金バリデーション＆残高チェック強化）
  const addSpend = async (title: string, amount: number, note: string = '') => {
    const cleanAmount = Math.floor(amount);
    if (!title.trim()) {
      return { success: false, error: '使った目的・買ったものを入力してください。' };
    }
    if (cleanAmount <= 0) {
      return { success: false, error: '出金する金額は1円以上を入力してください。' };
    }
    if (cleanAmount > household.balance) {
      return { success: false, error: `残高が不足しています（現在の残高: ${household.balance}円）。` };
    }

    const spendAmount = cleanAmount;
    const nowIso = new Date().toISOString();
    const todayDate = nowIso.split('T')[0];

    const nextBalance = household.balance - spendAmount;
    const updatedHousehold = { ...household, balance: nextBalance, updatedAt: nowIso };

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      type: 'spend',
      title: `おこづかいを使用: ${title.trim()}`,
      amount: -spendAmount,
      date: todayDate,
      createdAt: nowIso,
      note: note.trim(),
    };
    const nextTxs = [newTx, ...transactions];

    setHousehold(updatedHousehold);
    setTransactions(nextTxs);
    broadcastAndSaveLocalData(updatedHousehold, undefined, undefined, nextTxs);

    if (isFirebaseConfigured && db) {
      await updateDoc(doc(db, 'household', 'default'), { balance: nextBalance, updatedAt: nowIso });
      await setDoc(doc(db, 'transactions', newTx.id), newTx);
    }
    return { success: true };
  };

  // 目標達成時の引き換え（出金＆次の目標案内）
  const redeemGoal = async () => {
    if (household.balance < household.goalAmount) {
      return { success: false, error: '目標金額に達していません。' };
    }
    const spendTitle = `目標達成！ ${household.goalTitle} を購入`;
    const spendRes = await addSpend(spendTitle, household.goalAmount, '目標達成によるお小遣い引き換え');
    if (!spendRes.success) return spendRes;

    // 次の目標としてリセット
    const nextHousehold = {
      ...household,
      balance: household.balance - household.goalAmount,
      goalTitle: 'つぎの目標を決めよう！',
      goalAmount: 3000,
      updatedAt: new Date().toISOString(),
    };
    setHousehold(nextHousehold);
    broadcastAndSaveLocalData(nextHousehold);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, 'household', 'default'), nextHousehold, { merge: true });
    }
    return { success: true };
  };

  // お手伝いマスター追加
  const addChoreMaster = async (chore: Omit<ChoreMaster, 'id'>) => {
    const newChore: ChoreMaster = {
      id: `chore-${Date.now()}`,
      ...chore,
      reward: Math.max(1, Math.floor(chore.reward)),
    };
    const nextChores = [...chores, newChore];
    setChores(nextChores);
    broadcastAndSaveLocalData(undefined, nextChores);

    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, 'chores', newChore.id), newChore);
    }
  };

  // お手伝いマスター更新
  const updateChoreMaster = async (chore: ChoreMaster) => {
    const updated = {
      ...chore,
      reward: Math.max(1, Math.floor(chore.reward)),
    };
    const nextChores = chores.map((c) => (c.id === chore.id ? updated : c));
    setChores(nextChores);
    broadcastAndSaveLocalData(undefined, nextChores);

    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, 'chores', chore.id), updated);
    }
  };

  // お手伝いマスター削除
  const deleteChoreMaster = async (id: string) => {
    const nextChores = chores.filter((c) => c.id !== id);
    setChores(nextChores);
    broadcastAndSaveLocalData(undefined, nextChores);

    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, 'chores', id));
    }
  };

  return (
    <AppContext.Provider
      value={{
        role,
        currentUser,
        household,
        chores,
        requests,
        transactions,
        isDemoMode,
        login,
        logout,
        updateGoal,
        submitChoreRequest,
        approveRequest,
        rejectRequest,
        addPenalty,
        addSpend,
        addChoreMaster,
        updateChoreMaster,
        deleteChoreMaster,
        redeemGoal,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
