import type { HouseholdData, ChoreMaster, ChoreRequest, Transaction } from '../types';

export const INITIAL_HOUSEHOLD: HouseholdData = {
  id: 'household-default',
  balance: 500,
  goalTitle: 'すきなおもちゃ・ゲーム',
  goalAmount: 3000,
  updatedAt: new Date().toISOString(),
};

export const INITIAL_CHORES: ChoreMaster[] = [
  { id: 'chore-1', title: 'お風呂そうじ', reward: 50, icon: 'bath', description: '浴槽や床をピカピカにする' },
  { id: 'chore-2', title: '食器洗い・お片付け', reward: 30, icon: 'dish', description: '食べた食器を洗って拭く' },
  { id: 'chore-3', title: 'ゴミ出し・ゴミまとめ', reward: 20, icon: 'trash', description: '家中のゴミ箱をまとめる' },
  { id: 'chore-4', title: '洗濯物をたたむ', reward: 30, icon: 'shirt', description: 'きれいにたたんで引き出しにしまう' },
  { id: 'chore-5', title: '部屋の掃除機・モップがけ', reward: 50, icon: 'sparkles', description: '床をきれいに掃除する' },
  { id: 'chore-6', title: '宿題をすべて終えた', reward: 20, icon: 'book', description: '毎日の宿題をしっかりやる' },
];

export const INITIAL_REQUESTS: ChoreRequest[] = [
  {
    id: 'req-sample-1',
    choreId: 'chore-1',
    title: 'お風呂そうじ',
    reward: 50,
    bonus: 0,
    status: 'pending',
    requestedAt: new Date(Date.now() - 3600000).toISOString(),
    comment: 'ピカピカにみがいたよ！',
  },
];

const todayStr = new Date().toISOString().split('T')[0];
const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-sample-1',
    type: 'chore',
    title: '洗濯物をたたむ (承認)',
    amount: 30,
    date: yesterdayStr,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    note: 'きれいにたためました！',
  },
  {
    id: 'tx-sample-2',
    type: 'chore',
    title: '宿題をすべて終えた (承認)',
    amount: 20,
    date: todayStr,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    note: 'がんばったね！',
  },
];
