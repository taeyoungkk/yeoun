export interface BankConfig {
  id: string;
  name: string;
  initial: string;
  color: string;
  textColor: string;
}

export const KOREAN_BANKS: Record<string, BankConfig> = {
  kb: { id: 'kb', name: '국민은행', initial: 'KB', color: '#FFD600', textColor: '#4A4A4A' },
  shinhan: { id: 'shinhan', name: '신한은행', initial: '신한', color: '#0046FF', textColor: '#FFFFFF' },
  woori: { id: 'woori', name: '우리은행', initial: '우리', color: '#007FFF', textColor: '#FFFFFF' },
  hana: { id: 'hana', name: '하나은행', initial: '하나', color: '#008485', textColor: '#FFFFFF' },
  nh: { id: 'nh', name: '농협은행', initial: 'NH', color: '#002C5F', textColor: '#FFFFFF' },
  kakao: { id: 'kakao', name: '카카오뱅크', initial: '카카오', color: '#FAE100', textColor: '#3C1E1E' },
  toss: { id: 'toss', name: '토스뱅크', initial: 'toss', color: '#0050FF', textColor: '#FFFFFF' },
  ibk: { id: 'ibk', name: '기업은행', initial: 'IBK', color: '#0055A6', textColor: '#FFFFFF' },
  samsung: { id: 'samsung', name: '삼성카드', initial: '삼성', color: '#0061A0', textColor: '#FFFFFF' },
  hyundai: { id: 'hyundai', name: '현대카드', initial: '현대', color: '#000000', textColor: '#FFFFFF' },
  lotte: { id: 'lotte', name: '롯데카드', initial: '롯데', color: '#ED1A3B', textColor: '#FFFFFF' },
  bc: { id: 'bc', name: 'BC카드', initial: 'BC', color: '#D41F32', textColor: '#FFFFFF' },
};

export const BANK_LIST = Object.values(KOREAN_BANKS);
