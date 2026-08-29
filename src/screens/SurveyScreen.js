import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { COLORS } from '../constants';
import { useElevation } from '../hooks/useElevation';
import { useSurveyPoints } from '../hooks/useSurveyPoints';
import { formatDelta, formatElevation } from '../utils/elevation';

export default function SurveyScreen() {
  const elevation = useElevation();
  const survey = useSurveyPoints();
  const [labelInput, setLabelInput] = useState('');
  const [showLabelModal, setShowLabelModal] = useState(false);
  const pendingCapture = useRef(null);

  const handleSetBaseline = () => {
    const ok = elevation.setBaselineNow();
    if (ok) {
      survey.clearPoints();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else {
      Alert.alert('No Reading', 'Waiting for sensor data. Try again in a moment.');
    }
  };

  const handleCapturePoint = () => {
    if (elevation.baseline === null) {
      Alert.alert('No Baseline', 'Set a baseline level first.');
      return;
    }
    if (elevation.fusedElevation === null) {
      Alert.alert('No Reading', 'Sensor not ready yet.');
      return;
    }
    pendingCapture.current = {
      elevation: elevation.fusedElevation,
      delta: elevation.deltaFromBaseline,
    };
    setLabelInput(`Point ${survey.points.length + 1}`);
    setShowLabelModal(true);
  };

  const handleConfirmCapture = () => {
    if (!pendingCapture.current) return;
    survey.addPoint(
      pendingCapture.current.elevation,
      pendingCapture.current.delta,
      labelInput.trim() || `Point ${survey.points.length + 1}`
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowLabelModal(false);
    pendingCapture.current = null;
  };

  const deltaColor =
    elevation.deltaFromBaseline === null
      ? COLORS.muted
      : elevation.deltaFromBaseline > 0.01
      ? COLORS.positive
      : elevation.deltaFromBaseline < -0.01
      ? COLORS.negative
      : COLORS.neutral;

  const isReady = elevation.fusedElevation !== null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Elevation Survey</Text>
        <View style={styles.sensorBadge}>
          <View style={[styles.dot, { backgroundColor: isReady ? COLORS.positive : COLORS.muted }]} />
          <Text style={styles.sensorLabel}>
            {isReady ? (elevation.isAvailable ? 'Baro+GPS' : 'GPS Only') : 'Acquiring…'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>CURRENT ELEVATION</Text>
          <Text style={styles.bigNumber}>
            {isReady ? formatElevation(elevation.fusedElevation) : '—'}
          </Text>
          {elevation.gpsAltitude !== null && (
            <Text style={styles.subText}>
              GPS: {formatElevation(elevation.gpsAltitude)}
              {elevation.gpsAccuracy ? `  ±${elevation.gpsAccuracy.toFixed(1)}m` : ''}
            </Text>
          )}
          {elevation.smoothedPressure !== null && (
            <Text style={styles.subText}>
              Pressure: {elevation.smoothedPressure.toFixed(2)} hPa
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>BASELINE</Text>
          <Text style={styles.medNumber}>
            {elevation.baseline !== null ? formatElevation(elevation.baseline) : 'Not set'}
          </Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleSetBaseline}>
            <Text style={styles.btnText}>
              {elevation.baseline !== null ? '↺ Reset Baseline Here' : '⊕ Set Baseline Here'}
            </Text>
          </TouchableOpacity>
        </View>

        {elevation.baseline !== null && (
          <View style={[styles.card, styles.deltaCard]}>
            <Text style={styles.cardLabel}>ELEVATION DIFFERENCE</Text>
            <Text style={[styles.bigNumber, { color: deltaColor }]}>
              {formatDelta(elevation.deltaFromBaseline)}
            </Text>
            <Text style={styles.subText}>
              {elevation.deltaFromBaseline !== null
                ? elevation.deltaFromBaseline > 0
                  ? '▲ Above baseline'
                  : elevation.deltaFromBaseline < 0
                  ? '▼ Below baseline'
                  : '● At baseline'
                : ''}
            </Text>
            <TouchableOpacity style={styles.btnCapture} onPress={handleCapturePoint}>
              <Text style={styles.btnCaptureText}>📍 Capture This Point</Text>
            </TouchableOpacity>
          </View>
        )}

        {survey.points.length > 0 && (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardLabel}>SURVEY POINTS ({survey.points.length})</Text>
              <TouchableOpacity onPress={survey.clearPoints}>
                <Text style={styles.clearBtn}>Clear All</Text>
              </TouchableOpacity>
            </View>

            {survey.slopeRange !== null && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Range</Text>
                <Text style={styles.summaryValue}>{formatDelta(survey.slopeRange)}</Text>
              </View>
            )}

            {survey.points.map((pt, index) => (
              <View key={pt.id} style={styles.pointRow}>
                <View style={styles.pointIndex}>
                  <Text style={styles.pointIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.pointInfo}>
                  <Text style={styles.pointLabel}>{pt.label}</Text>
                  <Text style={styles.pointElev}>{formatElevation(pt.elevation)}</Text>
                </View>
                <Text style={[
                  styles.pointDelta,
                  { color: (pt.delta ?? 0) >= 0 ? COLORS.positive : COLORS.negative }
                ]}>
                  {formatDelta(pt.delta)}
                </Text>
                <TouchableOpacity onPress={() => survey.removePoint(pt.id)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showLabelModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Name This Point</Text>
            <TextInput
              style={styles.input}
              value={labelInput}
              onChangeText={setLabelInput}
              placeholder="e.g. Corner A, NE Stake..."
              placeholderTextColor={COLORS.muted}
              autoFocus
              selectTextOnFocus
            />
            {pendingCapture.current && (
              <Text style={styles.modalSub}>
                Δ {formatDelta(pendingCapture.current.delta)}  |  {formatElevation(pendingCapture.current.elevation)}
              </Text>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowLabelModal(false)}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleConfirmCapture}>
                <Text style={styles.btnText}>Save Point</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.neutral, letterSpacing: 0.5 },
  sensorBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sensorLabel: { fontSize: 12, color: COLORS.muted },
  scroll: { padding: 16, gap: 14 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  deltaCard: { borderColor: COLORS.accent, borderWidth: 1.5 },
  cardLabel: { fontSize: 11, fontWeight: '700', color: COLORS.muted, letterSpacing: 1.5 },
  bigNumber: { fontSize: 48, fontWeight: '800', color: COLORS.neutral, letterSpacing: -1 },
  medNumber: { fontSize: 28, fontWeight: '700', color: COLORS.neutral },
  subText: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  btnPrimary: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  btnCapture: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  btnText: { fontSize: 15, fontWeight: '700', color: COLORS.bg },
  btnCaptureText: { fontSize: 15, fontWeight: '700', color: COLORS.accent },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clearBtn: { fontSize: 13, color: COLORS.negative, fontWeight: '600' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 4,
  },
  summaryLabel: { fontSize: 13, color: COLORS.muted },
  summaryValue: { fontSize: 14, fontWeight: '700', color: COLORS.neutral },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  pointIndex: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  pointIndexText: { fontSize: 12, fontWeight: '700', color: COLORS.accent },
  pointInfo: { flex: 1 },
  pointLabel: { fontSize: 14, fontWeight: '600', color: COLORS.neutral },
  pointElev: { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  pointDelta: { fontSize: 15, fontWeight: '700', minWidth: 70, textAlign: 'right' },
  removeBtn: { padding: 4 },
  removeBtnText: { color: COLORS.muted, fontSize: 14 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 12,
    borderTopWidth: 1, borderColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.neutral },
  modalSub: { fontSize: 13, color: COLORS.muted, textAlign: 'center' },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12, padding: 14,
    fontSize: 16, color: COLORS.neutral,
    borderWidth: 1, borderColor: COLORS.border,
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btnSecondary: {
    flex: 1, borderRadius: 12, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  btnSecondaryText: { fontSize: 15, fontWeight: '600', color: COLORS.muted },
});