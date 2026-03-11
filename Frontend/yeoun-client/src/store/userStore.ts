export const globalUserState = {
  email: 'example@gmail.com',
  phone: '010-0000-0000',
  nickname: '지우',
  joinDate: '2026/03/09',
  friendsCount: 5,
  avatarUrl: null as string | null,
  // 설정
  receiptNotif: true,
  endNotif: true,
  photoPerm: false,
  locationPerm: true,
};

// 컴포넌트 재렌더링을 위한 옵저버
const listeners: (() => void)[] = [];

export const subscribeUser = (listener: () => void) => {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx > -1) listeners.splice(idx, 1);
  };
};

export const updateUser = (newData: Partial<typeof globalUserState>) => {
  Object.assign(globalUserState, newData);
  listeners.forEach(l => l());
};
