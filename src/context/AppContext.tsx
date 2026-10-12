import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type {
  Role,
  HouseholdData,
  ChoreMaster,
  ChoreRequest,
  Transaction,
  RoutineTask,
  RoutineLog,
  FontSizePreference
} from '../types';
import {
  INITIAL_HOUSEHOLD,
  INITIAL_CHORES,
  INITIAL_REQUESTS,
  INITIAL_TRANSACTIONS,
  INITIAL_ROUTINES,
  INITIAL_ROUTINE_LOGS
} from '../data/initialData';
import {
  calculateDueDate
} from '../utils/scheduleUtils';
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
  routines: RoutineTask[];
  routineLogs: RoutineLog[];
  fontSize: FontSizePreference;
  setFontSize: (size: FontSizePreference) => void;
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
  // ルーティン関連
  addRoutine: (routine: Omit<RoutineTask, 'id' | 'createdAt'>) => Promise<void>;
  updateRoutine: (routine: RoutineTask) => Promise<void>;
  deleteRoutine: (id: string) => Promise<void>;
  reportRoutineDone: (routineId: string, targetDate: string) => Promise<void>;
  approveRoutineLog: (logId: string) => Promise<void>;
  checkAndApplyOverduePenalties: () => Promise<void>;
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
  const [routines, setRoutines] = useState<RoutineTask[]>(INITIAL_ROUTINES);
  const [routineLogs, setRoutineLogs] = useState<RoutineLog[]>(INITIAL_ROUTINE_LOGS);

  // 文字サイズステート
  const [fontSize, setFontSizeState] = useState<FontSizePreference>('medium');

  // BroadcastChannel 参照
  const channelRef = useRef<BroadcastChannel | null>(null);

  // アカウントに応じた文字サイズ保存・適用キー
  const getFontSizeStorageKey = (userEmail?: string) => {
    return `kanabank_fontsize_${userEmail || 'guest'}`;
  };

  // 文字サイズの変更
  const setFontSize = (size: FontSizePreference) => {
    setFontSizeState(size);
    const key = getFontSizeStorageKey(currentUser?.email);
    localStorage.setItem(key, size);

    // HTMLルートにクラス適用
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
      document.documentElement.classList.add(`font-size-${size}`);
    }
  };

  // ユーザー切替時の文字サイズ読み込み
  useEffect(() => {
    const key = getFontSizeStorageKey(currentUser?.email);
    const saved = localStorage.getItem(key) as FontSizePreference | null;
    const initialSize = saved || 'medium';
    setFontSizeState(initialSize);

    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
      document.documentElement.classList.add(`font-size-${initialSize}`);
    }
  }, [currentUser]);

  // 現在のURLハッシュパスから初期ロールを推定
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

  // BroadcastChannel 及び storage イベントリスナーの設定
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
            if (data.routines) setRoutines(data.routines);
            if (data.routineLogs) setRoutineLogs(data.routineLogs);
          }
        }
      };
    }

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.household) setHousehold(parsed.household);
          if (parsed.chores) setChores(parsed.chores);
          if (parsed.requests) setRequests(parsed.requests);
          if (parsed.transactions) setTransactions(parsed.transactions);
          if (parsed.routines) setRoutines(parsed.routines);
          if (parsed.routineLogs) setRoutineLogs(parsed.routineLogs);
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
          if (parsed.routines) setRoutines(parsed.routines);
          if (parsed.routineLogs) setRoutineLogs(parsed.routineLogs);
        } catch (e) {
          console.error('Failed to parse local storage data', e);
        }
      }
    } else {
      if (!auth || !db) return;
      const firestoreDb: Firestore = db;

      const unsubscribeAuth = onAuthStateChanged(auth, (_user: User | null) => {});

      const unsubscribeHousehold = onSnapshot(doc(firestoreDb, 'household', 'default'), (docSnap) => {
        if (docSnap.exists()) {
          setHousehold(docSnap.data() as HouseholdData);
        } else {
          setDoc(doc(firestoreDb, 'household', 'default'), INITIAL_HOUSEHOLD);
        }
      });

      const unsubscribeChores = onSnapshot(collection(firestoreDb, 'chores'), (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChoreMaster));
          setChores(list);
        } else {
          INITIAL_CHORES.forEach((c) => setDoc(doc(firestoreDb, 'chores', c.id), c));
        }
      });

      const qRequests = query(collection(firestoreDb, 'requests'), orderBy('requestedAt', 'desc'));
      const unsubscribeRequests = onSnapshot(qRequests, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChoreRequest));
        setRequests(list);
      });

      const qTransactions = query(collection(firestoreDb, 'transactions'), orderBy('createdAt', 'desc'));
      const unsubscribeTransactions = onSnapshot(qTransactions, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));
        setTransactions(list);
      });

      const unsubscribeRoutines = onSnapshot(collection(firestoreDb, 'routines'), (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RoutineTask));
          setRoutines(list);
        } else {
          INITIAL_ROUTINES.forEach((r) => setDoc(doc(firestoreDb, 'routines', r.id), r));
        }
      });

      const unsubscribeRoutineLogs = onSnapshot(collection(firestoreDb, 'routineLogs'), (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RoutineLog));
        setRoutineLogs(list);
      });

      return () => {
        unsubscribeAuth();
        unsubscribeHousehold();
        unsubscribeChores();
        unsubscribeRequests();
        unsubscribeTransactions();
        unsubscribeRoutines();
        unsubscribeRoutineLogs();
      };
    }
  }, []);

  // ローカル保存＆他タブへのブロードキャスト配信
  const broadcastAndSaveLocalData = (
    h: HouseholdData = household,
    c: ChoreMaster[] = chores,
    r: ChoreRequest[] = requests,
    t: Transaction[] = transactions,
    rou: RoutineTask[] = routines,
    rLogs: RoutineLog[] = routineLogs
  ) => {
    const payload = {
      household: h,
      chores: c,
      requests: r,
      transactions: t,
      routines: rou,
      routineLogs: rLogs,
    };
    if (!isFirebaseConfigured) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    }
    channelRef.current?.postMessage({
      type: 'SYNC_DATA',
      payload,
    });
  };

  // 期限切れペナルティ自動チェック（起動時やデータ更新時に判定）
  const checkAndApplyOverduePenalties = async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    let updatedLogs = [...routineLogs];
    let currentBalance = household.balance;
    let nextTxs = [...transactions];
    let hadPenalty = false;

    // 過去7日間のログを点検
    for (const rLog of updatedLogs) {
      // 未完了・未ペナルティかつ、期日を過ぎている場合
      if (
        (rLog.status === 'open' || rLog.status === 'pending') &&
        rLog.dueDate < todayStr &&
        rLog.penaltyAmount > 0
      ) {
        hadPenalty = true;
        const nowIso = new Date().toISOString();
        rLog.status = 'penalized';
        rLog.penalizedAt = nowIso;

        const deduction = rLog.penaltyAmount;
        currentBalance = Math.max(0, currentBalance - deduction);

        const newTx: Transaction = {
          id: `tx-pen-${Date.now()}-${rLog.id}`,
          type: 'penalty',
          title: `未達成ペナルティ: ${rLog.title} (${rLog.targetDate}分)`,
          amount: -deduction,
          date: todayStr,
          createdAt: nowIso,
          createdBy: 'システム自動判定',
          note: `期日(${rLog.dueDate})までに承認されませんでした`,
        };
        nextTxs = [newTx, ...nextTxs];

        if (isFirebaseConfigured && db) {
          await updateDoc(doc(db, 'routineLogs', rLog.id), {
            status: 'penalized',
            penalizedAt: nowIso,
          });
          await setDoc(doc(db, 'transactions', newTx.id), newTx);
        }
      }
    }

    if (hadPenalty) {
      const nextHousehold = { ...household, balance: currentBalance, updatedAt: new Date().toISOString() };
      setHousehold(nextHousehold);
      setTransactions(nextTxs);
      setRoutineLogs(updatedLogs);
      broadcastAndSaveLocalData(nextHousehold, undefined, undefined, nextTxs, undefined, updatedLogs);

      if (isFirebaseConfigured && db) {
        await updateDoc(doc(db, 'household', 'default'), { balance: currentBalance });
      }
    }
  };

  // ログイン処理
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

  // ログアウト処理
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

  // 目標の更新
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
        processedBy: currentActor,
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

  // 叱られペナルティ（減額）
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

  // お小遣い使用（出金）
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

    const currentActor = currentUser?.email || '保護者';

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      type: 'spend',
      title: `おこづかいを使用: ${title.trim()}`,
      amount: -spendAmount,
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

  // 目標達成時の引き換え
  const redeemGoal = async () => {
    if (household.balance < household.goalAmount) {
      return { success: false, error: '目標金額に達していません。' };
    }
    const spendTitle = `目標達成！ ${household.goalTitle} を購入`;
    const spendRes = await addSpend(spendTitle, household.goalAmount, '目標達成によるお小遣い引き換え');
    if (!spendRes.success) return spendRes;

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

  // --- ルーティン（いつもやること）管理 ---

  // ルーティン追加
  const addRoutine = async (routine: Omit<RoutineTask, 'id' | 'createdAt'>) => {
    const newRoutine: RoutineTask = {
      ...routine,
      id: `routine-${Date.now()}`,
      reward: Math.max(0, Math.floor(routine.reward || 0)),
      penaltyAmount: Math.max(0, Math.floor(routine.penaltyAmount || 0)),
      graceDays: Math.max(0, Math.floor(routine.graceDays || 0)),
      createdAt: new Date().toISOString(),
    };
    const nextRoutines = [...routines, newRoutine];
    setRoutines(nextRoutines);
    broadcastAndSaveLocalData(undefined, undefined, undefined, undefined, nextRoutines);

    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, 'routines', newRoutine.id), newRoutine);
    }
  };

  // ルーティン更新
  const updateRoutine = async (routine: RoutineTask) => {
    const updated: RoutineTask = {
      ...routine,
      reward: Math.max(0, Math.floor(routine.reward || 0)),
      penaltyAmount: Math.max(0, Math.floor(routine.penaltyAmount || 0)),
      graceDays: Math.max(0, Math.floor(routine.graceDays || 0)),
    };
    const nextRoutines = routines.map((r) => (r.id === routine.id ? updated : r));
    setRoutines(nextRoutines);
    broadcastAndSaveLocalData(undefined, undefined, undefined, undefined, nextRoutines);

    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, 'routines', routine.id), updated);
    }
  };

  // ルーティン削除
  const deleteRoutine = async (id: string) => {
    const nextRoutines = routines.filter((r) => r.id !== id);
    setRoutines(nextRoutines);
    broadcastAndSaveLocalData(undefined, undefined, undefined, undefined, nextRoutines);

    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, 'routines', id));
    }
  };

  // 子ども側からの「おわったよ！」報告
  const reportRoutineDone = async (routineId: string, targetDate: string) => {
    const routine = routines.find((r) => r.id === routineId);
    if (!routine) return;

    const logId = `${routineId}_${targetDate}`;
    const dueDate = calculateDueDate(targetDate, routine.graceDays);
    const nowIso = new Date().toISOString();

    const existingLog = routineLogs.find((l) => l.id === logId);
    const updatedLog: RoutineLog = {
      id: logId,
      routineId,
      targetDate,
      title: routine.title,
      reward: routine.reward,
      penaltyAmount: routine.penaltyAmount,
      graceDays: routine.graceDays,
      dueDate,
      status: 'pending',
      reportedAt: nowIso,
    };

    const nextLogs = existingLog
      ? routineLogs.map((l) => (l.id === logId ? updatedLog : l))
      : [updatedLog, ...routineLogs];

    setRoutineLogs(nextLogs);
    broadcastAndSaveLocalData(undefined, undefined, undefined, undefined, undefined, nextLogs);

    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, 'routineLogs', logId), updatedLog);
    }
  };

  // 親によるルーティン承認
  const approveRoutineLog = async (logId: string) => {
    const rLog = routineLogs.find((l) => l.id === logId);
    if (!rLog || rLog.status !== 'pending') return;

    const nowIso = new Date().toISOString();
    const todayDate = nowIso.split('T')[0];
    const currentActor = currentUser?.email || '保護者';

    const updatedLog: RoutineLog = {
      ...rLog,
      status: 'completed',
      approvedAt: nowIso,
      approvedBy: currentActor,
    };

    const nextLogs = routineLogs.map((l) => (l.id === logId ? updatedLog : l));
    let nextBalance = household.balance;
    let nextTxs = transactions;

    // 取引履歴（カレンダー反映用）を作成
    // ご褒美が0円の場合でも「いつもやること達成（0円）」としてカレンダーに記録
    if (rLog.reward > 0) {
      nextBalance = household.balance + rLog.reward;
    }

    const newTx: Transaction = {
      id: `tx-routine-${Date.now()}`,
      type: 'chore',
      title: `いつもやること達成: ${rLog.title}`,
      amount: rLog.reward, // 0円の場合も0として記録
      date: todayDate,
      createdAt: nowIso,
      createdBy: currentActor,
      note: `${rLog.targetDate}実施分を承認${rLog.reward === 0 ? '（習慣達成・ご褒美なし）' : ''}`,
    };
    nextTxs = [newTx, ...transactions];

    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, 'transactions', newTx.id), newTx);
    }

    const updatedHousehold = { ...household, balance: nextBalance, updatedAt: nowIso };

    setRoutineLogs(nextLogs);
    setHousehold(updatedHousehold);
    setTransactions(nextTxs);
    broadcastAndSaveLocalData(updatedHousehold, undefined, undefined, nextTxs, undefined, nextLogs);

    if (isFirebaseConfigured && db) {
      await updateDoc(doc(db, 'routineLogs', logId), {
        status: 'completed',
        approvedAt: nowIso,
        approvedBy: currentActor,
      });
      await updateDoc(doc(db, 'household', 'default'), { balance: nextBalance, updatedAt: nowIso });
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
        routines,
        routineLogs,
        fontSize,
        setFontSize,
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
        addRoutine,
        updateRoutine,
        deleteRoutine,
        reportRoutineDone,
        approveRoutineLog,
        checkAndApplyOverduePenalties,
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
