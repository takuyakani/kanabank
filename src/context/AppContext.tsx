import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type {
  Role,
  HouseholdData,
  ChoreMaster,
  ChoreRequest,
  Transaction,
  RoutineTask,
  RoutineLog,
  FontSizePreference,
  TextMode
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
  createUserWithEmailAndPassword,
  signInAnonymously,
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
  getDocs,
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
  textMode: TextMode;
  setTextMode: (mode: TextMode) => void;
  isDemoMode: boolean;
  login: (email: string, pass: string, targetRole: Role) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateGoal: (title: string, amount: number) => Promise<{ success: boolean; error?: string }>;
  updateBalance: (newBalance: number, reason?: string) => Promise<{ success: boolean; error?: string }>;
  submitChoreRequest: (choreId: string, comment?: string) => Promise<void>;
  submitCustomChoreRequest: (title: string, comment?: string, requestedReward?: number) => Promise<void>;
  approveRequest: (requestId: string, bonus?: number, parentComment?: string, customReward?: number) => Promise<void>;
  rejectRequest: (requestId: string, parentComment?: string) => Promise<void>;
  addPenalty: (title: string, amount: number, note?: string) => Promise<{ success: boolean; error?: string }>;
  addSpend: (title: string, amount: number, note?: string, spendMethod?: 'cash' | 'virtual') => Promise<{ success: boolean; error?: string }>;
  addChoreMaster: (chore: Omit<ChoreMaster, 'id'>) => Promise<void>;
  updateChoreMaster: (chore: ChoreMaster) => Promise<void>;
  deleteChoreMaster: (id: string) => Promise<void>;
  redeemGoal: () => Promise<{ success: boolean; error?: string }>;
  // ルーティン関連
  addRoutine: (routine: Omit<RoutineTask, 'id' | 'createdAt'>) => Promise<void>;
  updateRoutine: (routine: RoutineTask) => Promise<void>;
  deleteRoutine: (id: string) => Promise<void>;
  reportRoutineDone: (routineId: string, targetDate: string) => Promise<void>;
  approveRoutineLog: (logId: string) => Promise<{ success: boolean; error?: string }>;
  checkAndApplyOverduePenalties: () => Promise<void>;
  // クラウド同期状態
  syncStatus: 'connected' | 'syncing' | 'error' | 'local';
  syncErrorMessage: string | null;
  // 履歴管理
  updateTransaction: (transaction: Transaction) => Promise<{ success: boolean; error?: string }>;
  deleteTransaction: (id: string) => Promise<{ success: boolean; error?: string }>;
  clearAllTransactions: () => Promise<void>;
  restoreTransactions: (txs: Transaction[]) => Promise<void>;
  importBackupData: (backup: any) => Promise<{ success: boolean; error?: string }>;
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
  const [syncStatus, setSyncStatus] = useState<'connected' | 'syncing' | 'error' | 'local'>(
    isFirebaseConfigured ? 'syncing' : 'local'
  );
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  // データステート
  const [household, setHousehold] = useState<HouseholdData>(INITIAL_HOUSEHOLD);
  const [chores, setChores] = useState<ChoreMaster[]>(INITIAL_CHORES);
  const [requests, setRequests] = useState<ChoreRequest[]>(INITIAL_REQUESTS);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [routines, setRoutines] = useState<RoutineTask[]>(INITIAL_ROUTINES);
  const [routineLogs, setRoutineLogs] = useState<RoutineLog[]>(INITIAL_ROUTINE_LOGS);

  // 文字サイズステート
  const [fontSize, setFontSizeState] = useState<FontSizePreference>('medium');

  // 表示モードステート（ふつう / ひらがなモード）
  const [textMode, setTextModeState] = useState<TextMode>('normal');

  // BroadcastChannel 参照
  const channelRef = useRef<BroadcastChannel | null>(null);

  // アカウントに応じた文字サイズ保存・適用キー
  const getFontSizeStorageKey = (userEmail?: string) => {
    return `kanabank_fontsize_${userEmail || 'guest'}`;
  };

  // アカウントに応じた表示モード保存・適用キー
  const getTextModeStorageKey = (userEmail?: string) => {
    return `kanabank_textmode_${userEmail || 'guest'}`;
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

  // 表示モードの変更
  const setTextMode = (mode: TextMode) => {
    setTextModeState(mode);
    const key = getTextModeStorageKey(currentUser?.email);
    localStorage.setItem(key, mode);
  };

  // ユーザー切替時の文字サイズ・表示モード読み込み
  useEffect(() => {
    const key = getFontSizeStorageKey(currentUser?.email);
    const saved = localStorage.getItem(key) as FontSizePreference | null;
    const initialSize = saved || 'medium';
    setFontSizeState(initialSize);

    const modeKey = getTextModeStorageKey(currentUser?.email);
    const savedMode = localStorage.getItem(modeKey) as TextMode | null;
    setTextModeState(savedMode || 'normal');

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
    // 常にまずローカルストレージから直近のデータを読み込む（オフライン時やFirestore遅延・エラー時の即時反映保証）
    const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.household) {
          setHousehold((prev) => ({
            ...INITIAL_HOUSEHOLD,
            ...prev,
            ...parsed.household,
          }));
        }
        if (parsed.chores) setChores(parsed.chores);
        if (parsed.requests) setRequests(parsed.requests);
        if (parsed.transactions) setTransactions(parsed.transactions);
        if (parsed.routines) setRoutines(parsed.routines);
        if (parsed.routineLogs) setRoutineLogs(parsed.routineLogs);
      } catch (e) {
        console.error('Failed to parse local storage data', e);
      }
    }

    if (!isFirebaseConfigured) {
      setIsDemoMode(true);
      setSyncStatus('local');
      setSyncErrorMessage(null);
    } else {
      if (!auth || !db) return;
      const firestoreDb: Firestore = db;
      const firebaseAuth = auth;

      const handleSyncSuccess = () => {
        setSyncStatus('connected');
        setSyncErrorMessage(null);
        setIsDemoMode(false);
      };

      const handleSyncError = (err: any, contextName: string) => {
        console.warn(`Firestore ${contextName} listener error:`, err);
        setSyncStatus('error');
        const code = err?.code || '';
        if (code === 'permission-denied' || String(err).includes('Missing or insufficient permissions')) {
          setSyncErrorMessage('Firestoreセキュリティルールによりアクセスが拒否されました（権限不足 / Missing or insufficient permissions）。');
        } else if (code === 'unavailable' || String(err).includes('network')) {
          setSyncErrorMessage('Firebaseへのネットワーク接続に失敗しました（オフラインまたはCORS制限）。');
        } else {
          setSyncErrorMessage(err?.message || 'Firestore接続エラーが発生しました。');
        }
      };

      const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user: User | null) => {
        if (!user) {
          // 未認証の場合、匿名ログインが許可されていれば自動試行
          signInAnonymously(firebaseAuth).catch(() => {
            // 匿名ログイン不可設定なら無視
          });
        }
      });

      const unsubscribeHousehold = onSnapshot(
        doc(firestoreDb, 'household', 'default'),
        (docSnap) => {
          handleSyncSuccess();
          if (docSnap.exists()) {
            const remoteData = docSnap.data();
            setHousehold((prev) => {
              const merged: HouseholdData = {
                id: 'household-default',
                balance: typeof remoteData.balance === 'number' ? remoteData.balance : prev.balance,
                goalTitle: remoteData.goalTitle ? String(remoteData.goalTitle) : prev.goalTitle || INITIAL_HOUSEHOLD.goalTitle,
                goalAmount: typeof remoteData.goalAmount === 'number' && remoteData.goalAmount > 0 ? remoteData.goalAmount : prev.goalAmount || INITIAL_HOUSEHOLD.goalAmount,
                updatedAt: remoteData.updatedAt || new Date().toISOString(),
              };
              // ローカルストレージにも安全に同期キャッシュ
              try {
                const currentRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
                const currentObj = currentRaw ? JSON.parse(currentRaw) : {};
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...currentObj, household: merged }));
              } catch (e) {
                console.warn(e);
              }
              return merged;
            });
          } else {
            setDoc(doc(firestoreDb, 'household', 'default'), INITIAL_HOUSEHOLD).catch(console.warn);
          }
        },
        (err) => {
          handleSyncError(err, 'household');
        }
      );

      const unsubscribeChores = onSnapshot(
        collection(firestoreDb, 'chores'),
        (snap) => {
          handleSyncSuccess();
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChoreMaster));
            setChores(list);
          } else {
            INITIAL_CHORES.forEach((c) => setDoc(doc(firestoreDb, 'chores', c.id), c).catch(console.warn));
          }
        },
        (err) => {
          handleSyncError(err, 'chores');
        }
      );

      const qRequests = query(collection(firestoreDb, 'requests'), orderBy('requestedAt', 'desc'));
      const unsubscribeRequests = onSnapshot(
        qRequests,
        (snap) => {
          handleSyncSuccess();
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChoreRequest));
          setRequests(list);
        },
        (err) => {
          handleSyncError(err, 'requests');
        }
      );

      const qTransactions = query(collection(firestoreDb, 'transactions'), orderBy('createdAt', 'desc'));
      const unsubscribeTransactions = onSnapshot(
        qTransactions,
        (snap) => {
          handleSyncSuccess();
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));
          setTransactions(list);
        },
        (err) => {
          handleSyncError(err, 'transactions');
        }
      );

      const unsubscribeRoutines = onSnapshot(
        collection(firestoreDb, 'routines'),
        (snap) => {
          handleSyncSuccess();
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RoutineTask));
            setRoutines(list);
          } else {
            INITIAL_ROUTINES.forEach((r) => setDoc(doc(firestoreDb, 'routines', r.id), r).catch(console.warn));
          }
        },
        (err) => {
          handleSyncError(err, 'routines');
        }
      );

      const unsubscribeRoutineLogs = onSnapshot(
        collection(firestoreDb, 'routineLogs'),
        (snap) => {
          handleSyncSuccess();
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RoutineLog));
          setRoutineLogs(list);
        },
        (err) => {
          handleSyncError(err, 'routineLogs');
        }
      );

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

    // Firebase環境の有無を問わず、ローカルストレージには常にバックアップ保存
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('localStorage save error:', e);
    }

    try {
      channelRef.current?.postMessage({
        type: 'SYNC_DATA',
        payload,
      });
    } catch (e) {
      console.warn('channel postMessage error:', e);
    }
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
        let userCredential;
        try {
          userCredential = await signInWithEmailAndPassword(auth, email, pass);
        } catch (authErr: any) {
          // ユーザーが存在しないエラーの場合、自動登録を試行
          if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
            try {
              userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            } catch {
              throw authErr;
            }
          } else {
            throw authErr;
          }
        }

        const userObj = { email: userCredential?.user?.email || email, role: targetRole };
        setCurrentUser(userObj);
        setRole(targetRole);

        const storageKey = targetRole === 'parent' ? LOCAL_PARENT_USER_KEY : LOCAL_CHILD_USER_KEY;
        localStorage.setItem(storageKey, JSON.stringify(userObj));
        return { success: true };
      } catch (err: any) {
        // Firebase認証に失敗した場合でもローカルで4文字以上であればログインを許可（オフライン・開発時フォールバック）
        if (pass.length >= 4) {
          console.warn('Firebase認証エラーのためローカルモードでログインします:', err);
          const userObj = { email, role: targetRole };
          setCurrentUser(userObj);
          setRole(targetRole);

          const storageKey = targetRole === 'parent' ? LOCAL_PARENT_USER_KEY : LOCAL_CHILD_USER_KEY;
          localStorage.setItem(storageKey, JSON.stringify(userObj));
          return { success: true };
        }
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
      try {
        await firebaseSignOut(auth);
      } catch (e) {
        console.warn('Firebase signout error:', e);
      }
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

    const updated: HouseholdData = {
      ...household,
      goalTitle: title.trim(),
      goalAmount: cleanAmount,
      updatedAt: new Date().toISOString(),
    };

    // 1. ローカルステートを即時更新
    setHousehold(updated);

    // 2. ローカルストレージおよび他タブへブロードキャスト保存
    broadcastAndSaveLocalData(updated);

    // 3. Firebase Firestoreへ保存（エラー時はローカル反映を維持）
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'household', 'default'), updated, { merge: true });
      } catch (err) {
        console.warn('Firebaseへの目標更新の保存に失敗しました（ローカルには即時反映済み）:', err);
      }
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
      try {
        await setDoc(doc(db, 'requests', newReq.id), newReq);
      } catch (err) {
        console.warn('Firebaseへの申請保存エラー（ローカルには保存済み）:', err);
      }
    }
  };

  // マスターにないお手伝いの申請（自由入力）
  const submitCustomChoreRequest = async (title: string, comment: string = '', requestedReward?: number) => {
    if (!title.trim()) return;

    const newReq: ChoreRequest = {
      id: `req-${Date.now()}`,
      choreId: 'custom',
      title: title.trim(),
      reward: 0, // 親が承認時に決定
      requestedReward: typeof requestedReward === 'number' && requestedReward > 0 ? Math.floor(requestedReward) : undefined,
      bonus: 0,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      comment: comment.trim(),
    };

    const nextRequests = [newReq, ...requests];
    setRequests(nextRequests);
    broadcastAndSaveLocalData(undefined, undefined, nextRequests);

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'requests', newReq.id), newReq);
      } catch (err) {
        console.warn('Firebaseへの自由入力申請保存エラー（ローカルには保存済み）:', err);
      }
    }
  };

  // 申請承認
  const approveRequest = async (
    requestId: string,
    bonus: number = 0,
    parentComment: string = '',
    customReward?: number
  ) => {
    const req = requests.find((r) => r.id === requestId);
    if (!req || req.status !== 'pending') return;

    // 自由入力お手伝い（req.choreId === 'custom'）の場合は親が設定した customReward を基本報酬とする
    const baseReward =
      req.choreId === 'custom' && customReward !== undefined
        ? Math.max(0, Math.floor(customReward))
        : req.reward;

    const safeBonus = Math.max(0, Math.floor(bonus));
    const totalEarned = baseReward + safeBonus;
    const nowIso = new Date().toISOString();
    const todayDate = nowIso.split('T')[0];

    const currentActor = currentUser?.email || '保護者';

    const updatedReq: ChoreRequest = {
      ...req,
      reward: baseReward,
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
        reward: baseReward,
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
  const addSpend = async (title: string, amount: number, note: string = '', spendMethod?: 'cash' | 'virtual') => {
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
      spendMethod: spendMethod || 'cash',
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
      try {
        await setDoc(doc(db, 'household', 'default'), nextHousehold, { merge: true });
      } catch (e) {
        console.warn('Firebase sync error for redeemGoal:', e);
      }
    }
    return { success: true };
  };

  // 保護者による残高の直接・任意編集
  const updateBalance = async (newBalance: number, reason: string = '保護者による残高調整') => {
    const cleanBalance = Math.max(0, Math.floor(newBalance));
    const prevBalance = household.balance;
    const diff = cleanBalance - prevBalance;
    const nowIso = new Date().toISOString();
    const todayDate = nowIso.split('T')[0];

    const currentActor = currentUser?.email || '保護者';

    const nextHousehold = {
      ...household,
      balance: cleanBalance,
      updatedAt: nowIso,
    };
    setHousehold(nextHousehold);

    let nextTxs = transactions;
    if (diff !== 0) {
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        type: diff > 0 ? 'chore' : 'penalty',
        title: `残高直接調整 (${diff > 0 ? `+${diff}` : `${diff}`}円)`,
        amount: diff,
        date: todayDate,
        createdAt: nowIso,
        createdBy: currentActor,
        note: reason.trim() || `保護者による残高変更 (${prevBalance}円 → ${cleanBalance}円)`,
      };
      nextTxs = [newTx, ...transactions];
      setTransactions(nextTxs);

      if (isFirebaseConfigured && db) {
        try {
          await setDoc(doc(db, 'transactions', newTx.id), newTx);
        } catch (e) {
          console.warn('Firebase transaction sync error for updateBalance:', e);
        }
      }
    }

    broadcastAndSaveLocalData(nextHousehold, undefined, undefined, nextTxs);

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'household', 'default'), { balance: cleanBalance, updatedAt: nowIso });
      } catch (e) {
        console.warn('Firebase household update error for updateBalance:', e);
      }
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
      try {
        await setDoc(doc(db, 'chores', newChore.id), newChore, { merge: true });
      } catch (err) {
        console.warn('Firebase chores add error (local state preserved):', err);
      }
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
      try {
        await setDoc(doc(db, 'chores', chore.id), updated, { merge: true });
      } catch (err) {
        console.warn('Firebase chores update error (local state preserved):', err);
      }
    }
  };

  // お手伝いマスター削除
  const deleteChoreMaster = async (id: string) => {
    const nextChores = chores.filter((c) => c.id !== id);
    setChores(nextChores);
    broadcastAndSaveLocalData(undefined, nextChores);

    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'chores', id));
      } catch (err) {
        console.warn('Firebase chores delete error (local state preserved):', err);
      }
    }
  };

  // --- ルーティン（いつもやること）管理 ---

  // Firestore用のサニタイズ（undefinedのプロパティを完全除去）
  const cleanRoutineForFirestore = (routine: RoutineTask): Record<string, any> => {
    const data: Record<string, any> = {
      id: routine.id,
      title: routine.title,
      reward: routine.reward,
      penaltyAmount: routine.penaltyAmount,
      graceDays: routine.graceDays,
      scheduleType: routine.scheduleType,
      active: routine.active,
      createdAt: routine.createdAt,
    };
    if (routine.scheduleConfig !== undefined && routine.scheduleConfig !== null) {
      data.scheduleConfig = routine.scheduleConfig;
    }
    return data;
  };

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
      try {
        const firestoreData = cleanRoutineForFirestore(newRoutine);
        await setDoc(doc(db, 'routines', newRoutine.id), firestoreData, { merge: true });
      } catch (err) {
        console.warn('Firebase routines add error (local state preserved):', err);
      }
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
      try {
        const firestoreData = cleanRoutineForFirestore(updated);
        await setDoc(doc(db, 'routines', routine.id), firestoreData, { merge: true });
      } catch (err) {
        console.warn('Firebase routines update error (local state preserved):', err);
      }
    }
  };

  // ルーティン削除
  const deleteRoutine = async (id: string) => {
    const nextRoutines = routines.filter((r) => r.id !== id);
    setRoutines(nextRoutines);
    broadcastAndSaveLocalData(undefined, undefined, undefined, undefined, nextRoutines);

    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'routines', id));
      } catch (err) {
        console.warn('Firebase routines delete error (local state preserved):', err);
      }
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
      try {
        await setDoc(doc(db, 'routineLogs', logId), updatedLog, { merge: true });
      } catch (err) {
        console.warn('Firebase sync error for reportRoutineDone (local state preserved):', err);
      }
    }
  };

  // 親によるルーティン承認
  const approveRoutineLog = async (logId: string): Promise<{ success: boolean; error?: string }> => {
    const rLog = routineLogs.find((l) => l.id === logId);
    if (!rLog) {
      console.warn('Routine log not found:', logId);
      return { success: false, error: '対象のいつもやること報告が見つかりませんでした。' };
    }
    if (rLog.status !== 'pending') {
      return { success: false, error: 'このいつもやることは既に承認済みまたは処理されています。' };
    }

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
    const nextTxs = [newTx, ...transactions];
    const updatedHousehold = { ...household, balance: nextBalance, updatedAt: nowIso };

    // 1. ローカルステート・localStorage・BroadcastChannel を最優先で即座に同期更新（楽観的UI更新）
    setRoutineLogs(nextLogs);
    setHousehold(updatedHousehold);
    setTransactions(nextTxs);
    broadcastAndSaveLocalData(updatedHousehold, undefined, undefined, nextTxs, undefined, nextLogs);

    // 2. Firebaseへの同期（エラーが発生してもローカル反映を壊さないようtry-catchで安全に処理）
    if (isFirebaseConfigured && db) {
      try {
        await Promise.all([
          // setDoc with merge: true で、ドキュメントが存在しない場合でも安全に作成・更新
          setDoc(doc(db, 'routineLogs', logId), updatedLog, { merge: true }),
          setDoc(doc(db, 'household', 'default'), { balance: nextBalance, updatedAt: nowIso }, { merge: true }),
          setDoc(doc(db, 'transactions', newTx.id), newTx),
        ]);
      } catch (err) {
        console.warn('Firebase routineLogs approve sync error (local state preserved):', err);
      }
    }

    return { success: true };
  };

  // 単一履歴（トランザクション）の修正
  const updateTransaction = async (updatedTx: Transaction): Promise<{ success: boolean; error?: string }> => {
    const existing = transactions.find((t) => t.id === updatedTx.id);
    if (!existing) {
      return { success: false, error: '対象の履歴が見つかりません。' };
    }

    // 金額差分を残高に反映（新金額 - 旧金額）
    const diff = Math.floor(updatedTx.amount) - Math.floor(existing.amount);
    const nextBalance = Math.max(0, household.balance + diff);
    const nowIso = new Date().toISOString();
    const updatedHousehold = diff !== 0 ? { ...household, balance: nextBalance, updatedAt: nowIso } : household;

    const cleanedTx: Transaction = {
      ...updatedTx,
      amount: Math.floor(updatedTx.amount),
      title: updatedTx.title.trim(),
      note: updatedTx.note?.trim() || '',
    };

    const nextTxs = transactions.map((t) => (t.id === updatedTx.id ? cleanedTx : t));

    setTransactions(nextTxs);
    if (diff !== 0) {
      setHousehold(updatedHousehold);
    }
    broadcastAndSaveLocalData(diff !== 0 ? updatedHousehold : undefined, undefined, undefined, nextTxs);

    if (isFirebaseConfigured && db) {
      const firestoreDb: Firestore = db;
      try {
        const promises: Promise<any>[] = [
          setDoc(doc(firestoreDb, 'transactions', cleanedTx.id), cleanedTx, { merge: true }),
        ];
        if (diff !== 0) {
          promises.push(
            setDoc(doc(firestoreDb, 'household', 'default'), { balance: nextBalance, updatedAt: nowIso }, { merge: true })
          );
        }
        await Promise.all(promises);
      } catch (err) {
        console.warn('Firebase updateTransaction sync error:', err);
      }
    }

    return { success: true };
  };

  // 単一履歴（トランザクション）の削除
  const deleteTransaction = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const target = transactions.find((t) => t.id === id);
    if (!target) {
      return { success: false, error: '対象の履歴が見つかりません。' };
    }

    // 削除に伴い、対象の金額を残高から差し戻す（残高 - 対象金額）
    const nextBalance = Math.max(0, household.balance - target.amount);
    const nowIso = new Date().toISOString();
    const updatedHousehold = { ...household, balance: nextBalance, updatedAt: nowIso };

    const nextTxs = transactions.filter((t) => t.id !== id);

    setTransactions(nextTxs);
    setHousehold(updatedHousehold);
    broadcastAndSaveLocalData(updatedHousehold, undefined, undefined, nextTxs);

    if (isFirebaseConfigured && db) {
      const firestoreDb: Firestore = db;
      try {
        await Promise.all([
          deleteDoc(doc(firestoreDb, 'transactions', id)),
          setDoc(doc(firestoreDb, 'household', 'default'), { balance: nextBalance, updatedAt: nowIso }, { merge: true }),
        ]);
      } catch (err) {
        console.warn('Firebase deleteTransaction sync error:', err);
      }
    }

    return { success: true };
  };

  // 履歴（トランザクション）を全削除する保護者機能
  const clearAllTransactions = async () => {
    setTransactions([]);
    broadcastAndSaveLocalData(undefined, undefined, undefined, []);

    if (isFirebaseConfigured && db) {
      const firestoreDb: Firestore = db;
      try {
        const snap = await getDocs(collection(firestoreDb, 'transactions'));
        const deletePromises = snap.docs.map((docSnap) => deleteDoc(doc(firestoreDb, 'transactions', docSnap.id)));
        await Promise.all(deletePromises);
      } catch (err) {
        console.error('Failed to clear transactions from Firestore:', err);
      }
    }
  };

  // 削除した履歴の取り消し（Undo）・復元
  const restoreTransactions = async (txs: Transaction[]) => {
    setTransactions(txs);
    broadcastAndSaveLocalData(undefined, undefined, undefined, txs);

    if (isFirebaseConfigured && db) {
      const firestoreDb: Firestore = db;
      try {
        await Promise.all(
          txs.map((tx) => setDoc(doc(firestoreDb, 'transactions', tx.id), tx, { merge: true }))
        );
      } catch (err) {
        console.warn('Firebase sync error during restoreTransactions:', err);
      }
    }
  };

  // バックアップJSONからのデータ復元
  const importBackupData = async (backup: any): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!backup || typeof backup !== 'object') {
        return { success: false, error: 'バックアップファイルの形式が無効です。' };
      }

      const newHousehold: HouseholdData =
        backup.household && typeof backup.household.balance === 'number'
          ? { ...INITIAL_HOUSEHOLD, ...backup.household }
          : household;
      const newChores = Array.isArray(backup.chores) ? backup.chores : chores;
      const newRequests = Array.isArray(backup.requests) ? backup.requests : requests;
      const newTransactions = Array.isArray(backup.transactions) ? backup.transactions : transactions;
      const newRoutines = Array.isArray(backup.routines) ? backup.routines : routines;
      const newRoutineLogs = Array.isArray(backup.routineLogs) ? backup.routineLogs : routineLogs;

      setHousehold(newHousehold);
      setChores(newChores);
      setRequests(newRequests);
      setTransactions(newTransactions);
      setRoutines(newRoutines);
      setRoutineLogs(newRoutineLogs);

      broadcastAndSaveLocalData(
        newHousehold,
        newChores,
        newRequests,
        newTransactions,
        newRoutines,
        newRoutineLogs
      );

      if (isFirebaseConfigured && db) {
        const firestoreDb: Firestore = db;
        try {
          await setDoc(doc(firestoreDb, 'household', 'default'), newHousehold, { merge: true });
          await Promise.all([
            ...newChores.map((c: any) => setDoc(doc(firestoreDb, 'chores', c.id), c, { merge: true })),
            ...newRequests.map((r: any) => setDoc(doc(firestoreDb, 'requests', r.id), r, { merge: true })),
            ...newTransactions.map((t: any) => setDoc(doc(firestoreDb, 'transactions', t.id), t, { merge: true })),
            ...newRoutines.map((rou: any) => setDoc(doc(firestoreDb, 'routines', rou.id), rou, { merge: true })),
            ...newRoutineLogs.map((rl: any) => setDoc(doc(firestoreDb, 'routineLogs', rl.id), rl, { merge: true })),
          ]);
        } catch (err) {
          console.warn('Firebase sync error during backup restore:', err);
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error('バックアップインポートエラー:', err);
      return { success: false, error: err?.message || 'バックアップの復元に失敗しました。' };
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
        textMode,
        setTextMode,
        isDemoMode,
        syncStatus,
        syncErrorMessage,
        login,
        logout,
        updateGoal,
        updateBalance,
        submitChoreRequest,
        submitCustomChoreRequest,
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
        updateTransaction,
        deleteTransaction,
        clearAllTransactions,
        restoreTransactions,
        importBackupData,
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
