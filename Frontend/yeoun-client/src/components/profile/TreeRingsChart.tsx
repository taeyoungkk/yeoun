import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Path, G, Text as SvgText, Defs, TextPath } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

const regionsData = [
  { id: 'capital',    name: '수도권',   desc: '서울·경기·인천',     total: 66,  visited: 5  },
  { id: 'gangwon',   name: '강원권',   desc: '강원특별자치도',      total: 18,  visited: 2  },
  { id: 'chungbuk',  name: '충북권',   desc: '충청북도',           total: 11,  visited: 1  },
  { id: 'chungnam',  name: '충남권',   desc: '대전·세종·충남',      total: 21,  visited: 5  },
  { id: 'jeolla',    name: '전라권',   desc: '광주·전북·전남',      total: 41,  visited: 3  },
  { id: 'daegyeong', name: '대구·경북', desc: '대구·경북',          total: 31,  visited: 2  },
  { id: 'buulgyeong',name: '부울경',   desc: '부산·울산·경남',      total: 39,  visited: 3  },
  { id: 'jeju',      name: '제주권',   desc: '제주특별자치도',      total: 2,   visited: 0  },
];


const CENTER = 200;
const MAX_RADIUS = 160;
const INNER_RADIUS = 35;
const RINGS_COUNT = 10;
const SIDES = regionsData.length;
const STEP = (MAX_RADIUS - INNER_RADIUS) / RINGS_COUNT;
const ANGLE_STEP = 360 / SIDES;

const hexToRgb = (hex: string) => hex.replace('#', '').match(/\w\w/g)?.map(x => parseInt(x, 16)) || [0,0,0];
const interpolateColor = (c1: string, c2: string, factor: number) => {
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    const rgb = rgb1.map((c, i) => Math.round(c + factor * (rgb2[i] - c)));
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
};

const getRingColor = (index: number, total: number) => {
    const ratio = index / (total - 1); 
    if (ratio < 0.5) return interpolateColor('ADC178', 'A98467', ratio * 2);
    return interpolateColor('A98467', '6C584C', (ratio - 0.5) * 2);
};

function getPoint(angleDeg: number, radius: number) {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function getSmoothedPercent(angleDeg: number) {
    let shiftedAngle = angleDeg - (ANGLE_STEP / 2);
    if (shiftedAngle < 0) shiftedAngle += 360;

    let exact_i = shiftedAngle / ANGLE_STEP;
    let i1 = Math.floor(exact_i) % SIDES;
    let i2 = (i1 + 1) % SIDES;
    let t = exact_i - Math.floor(exact_i);

    let t_smooth = t * t * (3 - 2 * t);

    let p1 = regionsData[i1].visited / regionsData[i1].total;
    let p2 = regionsData[i2].visited / regionsData[i2].total;

    return p1 * (1 - t_smooth) + p2 * t_smooth;
}

function generateRingPath(ringIndex: number, isBackground: boolean) {
    let points = [];
    for (let a = 0; a <= 360; a++) {
        let percent = isBackground ? 1.0 : getSmoothedPercent(a);
        let r_ideal = INNER_RADIUS + ringIndex * STEP;
        let r_max = INNER_RADIUS + (percent * RINGS_COUNT) * STEP;

        let r_actual;
        if (isBackground) {
            r_actual = r_ideal;
        } else {
            if (r_ideal <= r_max) {
                r_actual = r_ideal;
            } else {
                let overshoot = (r_ideal - r_max) / STEP;
                r_actual = r_max + overshoot * 2.5; 
            }
        }

        let noise = Math.sin((a * 5 + ringIndex * 15) * Math.PI/180) * 1.5 
                  + Math.cos((a * 12 - ringIndex * 10) * Math.PI/180) * 1.0;
        
        r_actual += noise;
        
        let pt = getPoint(a, r_actual);
        points.push(`${pt.x},${pt.y}`);
    }
    return `M ${points.join(' L ')} Z`;
}

export const TreeRingsChart = () => {
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  const globalVisited = regionsData.reduce((sum, r) => sum + r.visited, 0);
  const globalTotal = regionsData.reduce((sum, r) => sum + r.total, 0);
  const globalPercent = Math.round((globalVisited / globalTotal) * 100);

  const selectedRegion = selectedRegionId ? regionsData.find(r => r.id === selectedRegionId) : null;

  const currentVisited = selectedRegion ? selectedRegion.visited : globalVisited;
  const currentTotal = selectedRegion ? selectedRegion.total : globalTotal;
  const currentPercent = selectedRegion ? Math.round((currentVisited / currentTotal) * 100) : globalPercent;

  // 다양한 플랫폼에서 안정적으로 작동하도록 SVG 요소에 대한 수동 터치 핸들러
  const handleTouch = (evt: any) => {
    // SVG 래퍼 중심을 기준으로 한 좌표 가져오기
    const { locationX, locationY } = evt.nativeEvent;
    // 내부적으로 맵 뷰는 400x400이지만 반응형 컨테이너에서 렌더링됩니다.
    // 하지만 터치 이벤트는 Svg 래퍼 뷰에서 발생합니다!
    // aspectRatio: 1 이므로 뷰가 정사각형이라고 가정합니다.
    const rectSize = Dimensions.get('window').width - 40; // 컨테이너의 대략적인 너비
    const scale = 400 / rectSize;
    
    // 터치 포인트를 SVG 400x400 좌표계로 변환
    const x = locationX * scale;
    const y = locationY * scale;

    const dx = x - CENTER;
    const dy = y - CENTER;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 최대 반지름을 벗어나거나 내부 반지름 안쪽인 경우 초기화
    if (distance > MAX_RADIUS + 40 || distance < INNER_RADIUS - 10) {
      setSelectedRegionId(null);
      return;
    }

    // 각도를 도로 계산 (0도는 위, 시계 방향)
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    // 이 각도가 어느 권역에 속하는지 확인
    const index = Math.floor(angle / ANGLE_STEP);
    if (index >= 0 && index < SIDES) {
      setSelectedRegionId(regionsData[index].id);
    } else {
      setSelectedRegionId(null);
    }
  };

  return (
    <View className="w-full px-5 mt-8 mb-10 items-center">
      {/* SVG 나이테 차트 */}
      <View className="w-full max-w-[400px] aspect-square mb-6 justify-center items-center">
        {/* 터치를 안정적으로 캡처하기 위해 onStartShouldSetResponder가 있는 View 사용 */}
        <View 
          className="w-full h-full relative"
          onStartShouldSetResponder={() => true}
          onResponderRelease={handleTouch}
        >
          <Svg viewBox="0 0 400 400" width="100%" height="100%">
            {/* ... SVG 내용 ... */}
            <G id="bg-rings">
              {Array.from({ length: RINGS_COUNT }).map((_, i) => {
                const r = RINGS_COUNT - i;
                return (
                  <Path
                    key={`bg-${r}`}
                    d={generateRingPath(r, true)}
                    fill="#EBF3EA"
                    stroke="#DDE5B6"
                    strokeWidth="1"
                  />
                );
              })}
            </G>
            <G id="progress-rings">
              {Array.from({ length: RINGS_COUNT }).map((_, i) => {
                const r = RINGS_COUNT - i;
                return (
                  <Path
                    key={`prog-${r}`}
                    d={generateRingPath(r, false)}
                    fill={getRingColor(r - 1, RINGS_COUNT)}
                    stroke="rgba(235, 243, 234, 0.4)"
                    strokeWidth="0.75"
                  />
                );
              })}
            </G>

            <G id="labels">
              <Defs>
                {regionsData.map((region, i) => {
                  const startAngle = i * ANGLE_STEP;
                  const endAngle = (i + 1) * ANGLE_STEP;
                  const labelRadius = MAX_RADIUS + 25;
                  
                  // Bottom half (roughly 90 to 270 degrees) needs reversed path for readability
                  const isBottom = (i * ANGLE_STEP >= 90 && i * ANGLE_STEP < 270);
                  
                  let p1, p2;
                  if (isBottom) {
                    // Reverse arc: end to start
                    p1 = getPoint(endAngle, labelRadius);
                    p2 = getPoint(startAngle, labelRadius);
                  } else {
                    // Normal arc: start to end
                    p1 = getPoint(startAngle, labelRadius);
                    p2 = getPoint(endAngle, labelRadius);
                  }

                  const largeArcFlag = 0; // Each slice is < 180 deg
                  const sweepFlag = isBottom ? 0 : 1;

                  const d = `M ${p1.x} ${p1.y} A ${labelRadius} ${labelRadius} 0 ${largeArcFlag} ${sweepFlag} ${p2.x} ${p2.y}`;
                  
                  return (
                    <Path
                      key={`path-${region.id}`}
                      id={`labelPath-${region.id}`}
                      d={d}
                      fill="none"
                    />
                  );
                })}
              </Defs>

              {regionsData.map((region) => (
                <SvgText
                  key={`label-${region.id}`}
                  fill="#6C584C"
                  fontSize="12"
                  fontWeight="900"
                >
                  <TextPath
                    href={`#labelPath-${region.id}`}
                    startOffset="50%"
                    textAnchor="middle"
                  >
                    {region.name}
                  </TextPath>
                </SvgText>
              ))}
            </G>
            <G id="interaction">
              {regionsData.map((region, i) => {
                let startAngle = i * ANGLE_STEP;
                let endAngle = (i + 1) * ANGLE_STEP;
                let p1 = getPoint(startAngle, MAX_RADIUS + 40);
                let p2 = getPoint(endAngle, MAX_RADIUS + 40);
                let wedgePath = `M ${CENTER} ${CENTER} L ${p1.x} ${p1.y} A ${MAX_RADIUS + 40} ${MAX_RADIUS + 40} 0 0 1 ${p2.x} ${p2.y} Z`;
                
                return (
                  <G key={`interaction-group-${region.id}`}>
                    {selectedRegionId === region.id && (
                      <Path d={wedgePath} fill="#6C584C" opacity="0.08" pointerEvents="none" />
                    )}
                    {/* 시각적 효과를 위해 보이지 않는 경로를 렌더링하지만 해당 요소의 onPress에 의존하지 않음 */}
                    <Path
                      d={wedgePath}
                      fill="transparent"
                      pointerEvents="none" 
                    />
                  </G>
                );
              })}
            </G>
          </Svg>

          {/* 중심 노드 */}
          <View className="absolute top-1/2 left-1/2 w-12 h-12 -ml-6 -mt-6 bg-[#6C584C] rounded-full border-4 border-[#A98467] items-center justify-center shadow-md pointer-events-none">
            <View className="w-5 h-5 rounded-full border-2 border-[#ADC178] opacity-80"></View>
          </View>
        </View>
      </View>

      {/* 정보 카드 */}
      <View className={`w-full bg-[#F0EAD2] rounded-2xl border-2 border-[#DDE5B6] p-5 mb-6 ${selectedRegionId ? 'border-[#A98467] bg-[#FDFBF7]' : ''}`}>
        <View className="flex-row justify-between items-end mb-3">
          <View className="flex-row items-center gap-3">
            <View className={`w-10 h-10 rounded-full border-2 border-[#A98467] bg-[#EBF3EA] items-center justify-center ${selectedRegionId ? 'bg-[#F0EAD2]' : ''}`}>
              <Text className="text-lg">{selectedRegionId ? '📍' : '🇰🇷'}</Text>
            </View>
            <View>
              <Text className="text-[10px] text-[#A98467] font-bold mb-[2px]">
                {selectedRegionId ? selectedRegion?.desc : '대한민국 전체'}
              </Text>
              <Text className="text-xl font-black text-[#6C584C]">
                {selectedRegionId ? selectedRegion?.name : '전국 정복률'}
              </Text>
            </View>
          </View>
          <Text className="text-2xl font-black text-[#6C584C]">{currentPercent}%</Text>
        </View>
        
        <View className="w-full h-3 bg-[#DDE5B6] rounded-full overflow-hidden mb-3">
          <LinearGradient
            colors={['#ADC178', '#A98467', '#6C584C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: `${currentPercent}%`, height: '100%', borderRadius: 6 }}
          />
        </View>
        
        <View className="flex-row justify-between items-center">
          <Text className="text-sm text-[#A98467] font-medium">
            {selectedRegionId ? `${selectedRegion?.name} 방문 시·군·구` : '총 방문 시·군·구'}
          </Text>
          <Text className="text-sm text-[#A98467] font-medium">
            <Text className="text-[#6C584C] font-bold text-base">{currentVisited.toLocaleString()}</Text> / {currentTotal.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* 하단 그리드 범례 - 사용자 스크린샷에 보이는 하단 범례 */}
      <View className="w-full flex-row flex-wrap bg-white rounded-2xl p-4 gap-y-2 gap-x-3">
        {regionsData.map(region => (
          <TouchableOpacity 
            key={region.id} 
            className="w-[45%] flex-row justify-between my-1"
            onPress={() => setSelectedRegionId(region.id)}
          >
            <Text className="text-xs text-[#6C584C] font-medium">{region.name}</Text>
            <Text className="text-xs text-[#333333] font-medium w-[50px] text-right">{region.visited}/{region.total}</Text>
          </TouchableOpacity>
        ))}
      </View>

    </View>
  );
};

