import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableWithoutFeedback, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { Path, G, Text as SvgText } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

const regionsData = [
  { id: 'capital', name: '수도권', desc: '서울·경기·인천', total: 1161, visited: 435 },
  { id: 'gangwon', name: '강원권', desc: '강원특별자치도', total: 196, visited: 55 },
  { id: 'chungbuk', name: '충북권', desc: '충청북도', total: 153, visited: 45 },
  { id: 'chungnam', name: '충남권', desc: '대전·세종·충남', total: 317, visited: 105 },
  { id: 'jeolla', name: '전라권', desc: '광주·전북·전남', total: 637, visited: 180 },
  { id: 'daegyeong', name: '대구·경북', desc: '대구·경북', total: 472, visited: 160 },
  { id: 'buulgyeong', name: '부울경', desc: '부산·울산·경남', total: 566, visited: 210 },
  { id: 'jeju', name: '제주권', desc: '제주특별자치도', total: 43, visited: 25 }
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

  // Manual touch handler for SVG wedges to ensure it works reliably across platforms
  const handleTouch = (evt: any) => {
    // Get Coordinates relative to the SVG wrapper center
    const { locationX, locationY } = evt.nativeEvent;
    // Map view is 400x400 internally, but it's rendered in a responsive container.
    // However, touch events are from the Svg wrapper view!
    // We assume the view is square because of aspectRatio: 1.
    const rectSize = Dimensions.get('window').width - 40; // Approx width of the container
    const scale = 400 / rectSize;
    
    // Convert touch point to SVG 400x400 coordinate space
    const x = locationX * scale;
    const y = locationY * scale;

    const dx = x - CENTER;
    const dy = y - CENTER;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If outside the max radius or inside the inner radius, reset
    if (distance > MAX_RADIUS + 40 || distance < INNER_RADIUS - 10) {
      setSelectedRegionId(null);
      return;
    }

    // Calculate angle in degrees (0 is up, clockwise)
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    // Find which region region this angle belongs to
    const index = Math.floor(angle / ANGLE_STEP);
    if (index >= 0 && index < SIDES) {
      setSelectedRegionId(regionsData[index].id);
    } else {
      setSelectedRegionId(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* SVG Tree Rings */}
      <View style={styles.svgContainer}>
        {/* We use a View with onStartShouldSetResponder to capture touches reliably */}
        <View 
          style={styles.svgWrapper}
          onStartShouldSetResponder={() => true}
          onResponderRelease={handleTouch}
        >
          <Svg viewBox="0 0 400 400" width="100%" height="100%">
            {/* ... SVG content ... */}
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
              {regionsData.map((region, i) => {
                const centerAngle = i * ANGLE_STEP + (ANGLE_STEP / 2);
                let percent = region.visited / region.total;
                let r_max = INNER_RADIUS + (percent * RINGS_COUNT) * STEP;
                let packed_offset = (10 - percent * 10) * 2.5; 
                let labelRadius = Math.max(r_max + packed_offset + 18, INNER_RADIUS + 35);
                
                let labelPos = getPoint(centerAngle, labelRadius);
                let anchor = "middle";
                if (centerAngle > 10 && centerAngle < 170) anchor = "start";
                else if (centerAngle > 190 && centerAngle < 350) anchor = "end";

                return (
                  <SvgText
                    key={`label-${region.id}`}
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor={anchor as any}
                    alignmentBaseline="middle"
                    fill="#6C584C"
                    fontSize="12"
                    fontWeight="900"
                  >
                    {region.name}
                  </SvgText>
                );
              })}
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
                    {/* Render invisible paths for visuals but don't rely on their onPress */}
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

          {/* Core Node */}
          <View style={styles.coreNode}>
            <View style={styles.coreInner}></View>
          </View>
        </View>
      </View>

      {/* Info Card */}
      <View style={[styles.infoCard, selectedRegionId ? styles.infoCardActive : {}]}>
        <View style={styles.infoCardHeader}>
          <View style={styles.infoCardHeaderLeft}>
            <View style={[styles.infoIcon, selectedRegionId ? styles.infoIconActive : {}]}>
              <Text style={styles.infoIconText}>{selectedRegionId ? '📍' : '🇰🇷'}</Text>
            </View>
            <View>
              <Text style={styles.infoSubtitle}>
                {selectedRegionId ? selectedRegion?.desc : '대한민국 전체'}
              </Text>
              <Text style={styles.infoTitle}>
                {selectedRegionId ? selectedRegion?.name : '전국 정복률'}
              </Text>
            </View>
          </View>
          <Text style={styles.infoPercent}>{currentPercent}%</Text>
        </View>
        
        <View style={styles.progressContainer}>
          <LinearGradient
            colors={['#ADC178', '#A98467', '#6C584C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBar, { width: `${currentPercent}%` }]}
          />
        </View>
        
        <View style={styles.infoFooter}>
          <Text style={styles.infoLabel}>
            {selectedRegionId ? `${selectedRegion?.name} 방문 지역` : '총 방문 읍·면·동'}
          </Text>
          <Text style={styles.infoStats}>
            <Text style={styles.infoVisited}>{currentVisited.toLocaleString()}</Text> / {currentTotal.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Grid Legend - As seen in user screenshot there is a grid legend at the bottom */}
      <View style={styles.gridLegend}>
        {regionsData.map(region => (
          <TouchableOpacity 
            key={region.id} 
            style={styles.gridLegendItem}
            onPress={() => setSelectedRegionId(region.id)}
          >
            <Text style={styles.gridLegendLabel}>{region.name}</Text>
            <Text style={styles.gridLegendValue}>{region.visited}/{region.total}</Text>
          </TouchableOpacity>
        ))}
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginTop: 0,
    marginBottom: 40,
    alignItems: 'center',
  },
  svgContainer: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 400,
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  svgWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  coreNode: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 48,
    height: 48,
    marginLeft: -24,
    marginTop: -24,
    backgroundColor: '#6C584C',
    borderRadius: 24,
    borderWidth: 4,
    borderColor: '#A98467',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    pointerEvents: 'none',
  },
  coreInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ADC178',
    opacity: 0.8,
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#F0EAD2',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#DDE5B6',
    padding: 20,
    marginBottom: 24,
  },
  infoCardActive: {
    borderColor: '#A98467',
    backgroundColor: '#FDFBF7',
  },
  infoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  infoCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#A98467',
    backgroundColor: '#EBF3EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconActive: {
    backgroundColor: '#F0EAD2',
  },
  infoIconText: {
    fontSize: 18,
  },
  infoSubtitle: {
    fontSize: 10,
    color: '#A98467',
    fontWeight: '700',
    marginBottom: 2,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#6C584C',
  },
  infoPercent: {
    fontSize: 24,
    fontWeight: '900',
    color: '#6C584C',
  },
  progressContainer: {
    width: '100%',
    height: 12,
    backgroundColor: '#DDE5B6',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
  },
  infoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#A98467',
    fontWeight: '500',
  },
  infoStats: {
    fontSize: 14,
    color: '#A98467',
    fontWeight: '500',
  },
  infoVisited: {
    color: '#6C584C',
    fontWeight: '700',
    fontSize: 16,
  },
  gridLegend: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  gridLegendItem: {
    width: '45%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  gridLegendLabel: {
    fontSize: 12,
    color: '#6C584C',
    fontWeight: '500',
  },
  gridLegendValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
    width: 50,
  }
});
