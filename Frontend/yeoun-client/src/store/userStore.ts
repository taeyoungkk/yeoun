export const globalUserState = {
  email: 'example@gmail.com',
  phone: '010-0000-0000',
  nickname: '여운',
  joinDate: '2026/03/09',
  friendsCount: 5,
  avatarUrl: null as string | null,
  // Settings
  receiptNotif: true,
  endNotif: true,
  photoPerm: false,
  locationPerm: true,
  showPhotoPins: true,
  showPaymentPins: false,
  showMemoPins: false,
};

// Minimal shared store for profile and settings screens.
const listeners: Array<() => void> = [];

export const subscribeUser = (listener: () => void) => {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx > -1) {
      listeners.splice(idx, 1);
    }
  };
};

export const updateUser = (newData: Partial<typeof globalUserState>) => {
  Object.assign(globalUserState, newData);
  listeners.forEach((listener) => listener());
};
