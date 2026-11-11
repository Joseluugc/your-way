import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOrganizerDashboard } from '../hooks/useOrganizerDashboard';
import type {
  OrganizerDashboardStats,
  UserRole,
} from '../database/OrganizerDashboardRepository';
import CreateEventScreen from './CreateEventScreen'; // Importamos tu formulario

const ROLE_LABELS: Record<UserRole, string> = {
  ATTENDEE: 'Asistentes',
  VIP: 'VIP',
  STAFF: 'Staff',
  EXHIBITOR: 'Expositores',
};

export default function OrganizerDashboardScreen() {
  const { stats, loading, error, refresh } = useOrganizerDashboard();
  
  // Estado para controlar la visibilidad del modal del formulario
  const [modalVisible, setModalVisible] = useState(false);

  const rankedStands = [...(stats?.stands ?? [])].sort((first, second) => {
    const ratingDifference = (second.averageRating ?? -1) - (first.averageRating ?? -1);
    return ratingDifference || second.stampCount - first.stampCount;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading && stats !== null} onRefresh={refresh} tintColor="#167B71" />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>YOUR WAY / ORGANIZACIÓN</Text>
            <Text style={styles.title}>Resumen del evento</Text>
          </View>
          <View style={styles.localBadge}>
            <View style={styles.localDot} />
            <Text style={styles.localLabel}>Datos locales</Text>
          </View>
        </View>

        {/* BOTÓN PARA ABRIR EL FORMULARIO DE EVENTOS */}
        <TouchableOpacity 
          style={styles.createButton} 
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>+ Crear Nuevo Evento</Text>
        </TouchableOpacity>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={refresh} style={styles.retryButton}>
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : null}

        {loading && stats === null ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#167B71" />
            <Text style={styles.mutedText}>Cargando estadísticas…</Text>
          </View>
        ) : stats ? (
          <>
            <View style={styles.metricsGrid}>
              <Metric label="USUARIOS" value={stats.totalUsers} tone="teal" />
              <Metric label="LEADS" value={stats.totalLeads} tone="coral" />
              <Metric label="SELLOS" value={stats.totalStamps} tone="gold" />
              <Metric label="ESTANDS" value={stats.totalStands} tone="blue" />
            </View>

            <SectionHeading title="Asistencia" detail="Usuarios registrados por perfil" />
            <View style={styles.roleList}>
              {stats.usersByRole.map((row, index) => {
                const share = stats.totalUsers === 0 ? 0 : (row.total / stats.totalUsers) * 100;
                return (
                  <View key={row.role} style={styles.roleRow}>
                    <View style={styles.roleCopy}>
                      <Text style={styles.rowTitle}>{ROLE_LABELS[row.role]}</Text>
                      <Text style={styles.rowValue}>{row.total}</Text>
                    </View>
                    <View style={styles.track}>
                      <View
                        style={[
                          styles.bar,
                          styles.roleBar,
                          { width: `${share}%`, backgroundColor: ROLE_COLORS[index] },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
              {stats.totalUsers === 0 ? <EmptyLine text="Todavía no hay usuarios registrados." /> : null}
            </View>

            <SectionHeading title="Actividad por estand" detail="Sellos y valoración media" />
            {rankedStands.length > 0 ? (
              <View style={styles.listSurface}>
                {rankedStands.map((stand, index) => (
                  <View
                    key={stand.id}
                    style={[styles.standRow, index === rankedStands.length - 1 && styles.lastRow]}
                  >
                    <View style={styles.standIdentity}>
                      <Text style={styles.rank}>{String(index + 1).padStart(2, '0')}</Text>
                      <View style={styles.standCopy}>
                        <Text numberOfLines={1} style={styles.rowTitle}>{stand.name}</Text>
                        <Text style={styles.rowDetail}>{stand.stampCount} sellos</Text>
                      </View>
                    </View>
                    <View style={styles.ratingBlock}>
                      <Text style={styles.ratingValue}>
                        {stand.averageRating === null ? '—' : stand.averageRating.toFixed(1)}
                      </Text>
                      <Text style={styles.ratingCaption}>
                        {stand.ratingCount === 1 ? 'valoración' : 'valoraciones'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyPanel text="Los estands aparecerán aquí cuando estén registrados." />
            )}

            <SectionHeading title="Aforo por zona" detail="Ocupación actual frente a capacidad" />
            {stats.zones.length > 0 ? (
              <View style={styles.zoneList}>
                {stats.zones.map((zone) => {
                  const percentage = zone.maxCapacity > 0
                    ? Math.min(Math.max((zone.currentCapacity / zone.maxCapacity) * 100, 0), 100)
                    : 0;
                  return (
                    <View key={zone.id} style={styles.zoneItem}>
                      <View style={styles.zoneTopline}>
                        <Text numberOfLines={1} style={styles.rowTitle}>{zone.name}</Text>
                        <Text style={styles.zoneCount}>
                          {zone.currentCapacity} / {zone.maxCapacity}
                        </Text>
                      </View>
                      <View style={styles.track}>
                        <View style={[styles.bar, styles.zoneBar, { width: `${percentage}%` }]} />
                      </View>
                      <Text style={styles.rowDetail}>
                        {zone.maxCapacity > 0 ? `${Math.round(percentage)}% ocupado` : 'Capacidad no definida'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <EmptyPanel text="No hay zonas configuradas todavía." />
            )}

            <Text style={styles.footerNote}>Resumen calculado desde la base local del dispositivo.</Text>
          </>
        ) : null}
      </ScrollView>

      {/* MODAL QUE CONTIENE EL FORMULARIO DE EVENTOS */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setModalVisible(false)}>
            <Text style={styles.closeText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Nuevo Evento</Text>
          <View style={{ width: 70 }} />
        </View>
        
        <CreateEventScreen 
          onClose={() => {
            setModalVisible(false);
            // Opcional: Si quieres que las gráficas se actualicen al guardar, puedes llamar a refresh()
          }} 
        />
      </Modal>

    </SafeAreaView>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: MetricTone }) {
  return (
    <View style={styles.metricCell}>
      <View style={[styles.metricAccent, { backgroundColor: TONE_COLORS[tone] }]} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value.toLocaleString('es-ES')}</Text>
    </View>
  );
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDetail}>{detail}</Text>
    </View>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <Text style={styles.emptyLine}>{text}</Text>;
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <View style={styles.emptyPanel}>
      <Text style={styles.emptyLine}>{text}</Text>
    </View>
  );
}

type MetricTone = 'teal' | 'coral' | 'gold' | 'blue';

const TONE_COLORS: Record<MetricTone, string> = {
  teal: '#167B71',
  coral: '#D26D56',
  gold: '#C58D2A',
  blue: '#4C79A7',
};

const ROLE_COLORS = ['#167B71', '#C58D2A', '#4C79A7', '#D26D56'];

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F6F4' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36 },
  header: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10, // Un poco menos de margen para acoplar el botón
  },
  eyebrow: { color: '#56736D', fontSize: 11, fontWeight: '700', letterSpacing: 0.7 },
  title: { color: '#173A35', fontSize: 25, fontWeight: '700', marginTop: 5 },
  localBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#E2EFEB',
  },
  localDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#167B71', marginRight: 6 },
  localLabel: { color: '#25635A', fontSize: 11, fontWeight: '600' },
  
  // ESTILOS NUEVOS PARA EL BOTÓN Y EL MODAL
  createButton: { backgroundColor: '#167B71', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5EBE8' },
  closeText: { color: '#167B71', fontSize: 16, fontWeight: '600' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#173A35' },
  
  errorBanner: {
    backgroundColor: '#FCEBE7',
    borderLeftWidth: 3,
    borderLeftColor: '#C94F43',
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#7D322B', fontSize: 13 },
  retryButton: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 3 },
  retryText: { color: '#913C32', fontSize: 13, fontWeight: '700' },
  loadingState: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 12 },
  mutedText: { color: '#6E817C', fontSize: 14 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginBottom: 8 },
  metricCell: {
    position: 'relative',
    width: '47%',
    minHeight: 96,
    flexGrow: 1,
    marginHorizontal: 5,
    marginBottom: 10,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    overflow: 'hidden',
  },
  metricAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  metricLabel: { color: '#6B7F79', fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  metricValue: { color: '#173A35', fontSize: 27, fontWeight: '700', marginTop: 9 },
  sectionHeading: { marginTop: 20, marginBottom: 12 },
  sectionTitle: { color: '#173A35', fontSize: 18, fontWeight: '700' },
  sectionDetail: { color: '#71827D', fontSize: 12, marginTop: 3 },
  roleList: { paddingHorizontal: 2 },
  roleRow: { marginBottom: 12 },
  roleCopy: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rowTitle: { color: '#243E39', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  rowValue: { color: '#243E39', fontSize: 14, fontWeight: '700' },
  track: { height: 7, backgroundColor: '#DFE7E3', borderRadius: 5, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 5 },
  roleBar: { minWidth: 0 },
  listSurface: { backgroundColor: '#FFFFFF', borderRadius: 7, paddingHorizontal: 14 },
  standRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5EBE8',
  },
  lastRow: { borderBottomWidth: 0 },
  standIdentity: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  rank: { width: 29, color: '#91A19B', fontSize: 12, fontWeight: '700' },
  standCopy: { flex: 1 },
  rowDetail: { color: '#7A8A85', fontSize: 11, marginTop: 3 },
  ratingBlock: { minWidth: 66, alignItems: 'flex-end' },
  ratingValue: { color: '#B77B1F', fontSize: 17, fontWeight: '700' },
  ratingCaption: { color: '#87938F', fontSize: 10, marginTop: 2 },
  zoneList: { gap: 15 },
  zoneItem: { paddingHorizontal: 2 },
  zoneTopline: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7, gap: 12 },
  zoneCount: { color: '#304A44', fontSize: 13, fontWeight: '700' },
  zoneBar: { backgroundColor: '#D26D56' },
  emptyPanel: { padding: 15, backgroundColor: '#FFFFFF', borderRadius: 7 },
  emptyLine: { color: '#7A8A85', fontSize: 13, paddingVertical: 4 },
  footerNote: { color: '#8B9994', fontSize: 11, textAlign: 'center', marginTop: 28 },
});