/**
 * Utility for mapping Korean SIG_CD (district codes) to regional categories
 * and calculating visits for the TreeRingsChart.
 */

export interface RegionStats {
  id: string;
  name: string;
  desc: string;
  total: number;
  visited: number;
}

const REGION_MAP: Record<string, string> = {
  '11': 'capital',    // Seoul
  '41': 'capital',    // Gyeonggi
  '28': 'capital',    // Incheon
  '42': 'gangwon',    // Gangwon
  '51': 'gangwon',    // Gangwon (Special Self-governing)
  '43': 'chungbuk',   // Chungbuk
  '44': 'chungnam',   // Chungnam
  '30': 'chungnam',   // Daejeon
  '36': 'chungnam',   // Sejong
  '45': 'jeolla',     // Jeonbuk
  '52': 'jeolla',     // Jeonbuk (Special Self-governing)
  '46': 'jeolla',     // Jeonnam
  '29': 'jeolla',     // Gwangju
  '47': 'daegyeong',  // Gyeongbuk
  '27': 'daegyeong',  // Daegu
  '48': 'buulgyeong', // Gyeongnam
  '26': 'buulgyeong', // Busan
  '31': 'buulgyeong', // Ulsan
  '49': 'jeju',       // Jeju
};

export const INITIAL_REGIONS_DATA: RegionStats[] = [
  { id: 'capital',    name: '수도권',   desc: '서울·경기·인천',     total: 66,  visited: 0  },
  { id: 'gangwon',   name: '강원권',   desc: '강원특별자치도',      total: 18,  visited: 0  },
  { id: 'chungbuk',  name: '충북권',   desc: '충청북도',           total: 11,  visited: 0  },
  { id: 'chungnam',  name: '충남권',   desc: '대전·세종·충남',      total: 21,  visited: 0  },
  { id: 'jeolla',    name: '전라권',   desc: '광주·전북·전남',      total: 41,  visited: 0  },
  { id: 'daegyeong', name: '대구·경북', desc: '대구·경북',          total: 31,  visited: 0  },
  { id: 'buulgyeong',name: '부울경',   desc: '부산·울산·경남',      total: 39,  visited: 0  },
  { id: 'jeju',      name: '제주권',   desc: '제주특별자치도',      total: 2,   visited: 0  },
];

export function calculateRegionStats(visitedSigCodes: string[]): RegionStats[] {
  const stats = INITIAL_REGIONS_DATA.map(r => ({ ...r }));
  
  // Group visited SIG_CDs by region
  const visitsByRegion: Record<string, Set<string>> = {};
  
  visitedSigCodes.forEach(code => {
    const prefix = code.substring(0, 2);
    const regionId = REGION_MAP[prefix];
    
    if (regionId) {
      if (!visitsByRegion[regionId]) {
        visitsByRegion[regionId] = new Set();
      }
      visitsByRegion[regionId].add(code);
    }
  });

  // Update visited counts
  return stats.map(region => ({
    ...region,
    visited: visitsByRegion[region.id]?.size || 0,
  }));
}
