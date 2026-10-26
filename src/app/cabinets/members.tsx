import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCabinets } from '@/data/cabinets';
import { usePrefs } from '@/data/prefs';
import { removeMember, setMemberRole, useMembers, type Member } from '@/data/sharing';
import { canEdit, isOwner, type MemberRole } from '@/domain/sharing';
import { useT } from '@/i18n';
import { BackBar } from '@/ui/BackBar';
import { Button } from '@/ui/Button';
import { FitTitle } from '@/ui/FitTitle';
import { Icon } from '@/ui/Icon';
import { Choice } from '@/ui/Rows';
import { Sheet } from '@/ui/Sheet';
import { Toast } from '@/ui/Toast';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/**
 * «Учасники» (docs/screens.md): who shares the cabinet and what each may do.
 * The owner changes a role or takes someone out from the ⋮ on their row.
 * A cabinet nobody was invited to yet has only its owner, this person.
 */
export default function MembersScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cabinet = useCabinets()?.find((c) => c.id === id);
  const synced = useMembers(id);
  const myName = usePrefs((s) => s.name);
  const [picked, setPicked] = useState<Member | null>(null);
  const [failed, setFailed] = useState(false);

  if (!cabinet) return null;
  const people: Pick<Member, 'userId' | 'name' | 'role' | 'me'>[] =
    synced.length > 0 ? synced : [{ userId: 'me', name: myName, role: 'owner', me: true }];
  const owner = isOwner(cabinet.role);

  const act = async (fn: () => Promise<void>) => {
    setPicked(null);
    try {
      await fn();
    } catch {
      setFailed(true);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar label={cabinet.name} />
      <ScrollView contentContainerStyle={styles.content}>
        <FitTitle>{t('members.title')}</FitTitle>
        <Text style={[type.bodyMedium, styles.muted]}>
          {t('members.subtitle', { name: cabinet.name, count: people.length })}
        </Text>

        <View style={styles.card}>
          {people.map((m, i) => (
            <View key={m.userId}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={[type.stepTitle, styles.initial]}>{initial(m.name)}</Text>
                </View>
                <View style={styles.fill}>
                  <Text style={type.cardTitle} numberOfLines={1}>
                    {m.name || t('members.noName')}
                    {m.me ? <Text style={styles.muted}>{`  ${t('members.you')}`}</Text> : null}
                  </Text>
                  <Text style={type.label}>{t(ROLE_LINE[m.role])}</Text>
                </View>
                {owner && !m.me && m.role !== 'owner' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('members.manage', { name: m.name })}
                    hitSlop={12}
                    onPress={() => setPicked(m as Member)}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <Icon name="dots-vertical" size={22} color={colors.inkMuted} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        <Text style={[type.label, styles.note]}>{t('members.note')}</Text>
      </ScrollView>

      {canEdit(cabinet.role) ? (
        <View style={styles.footer}>
          <Button
            label={t('cabinet.invite')}
            icon="user-plus"
            onPress={() => router.push(`/cabinets/invite?id=${cabinet.id}` as Href)}
          />
        </View>
      ) : null}

      {picked ? (
        <RoleSheet
          member={picked}
          cabinetName={cabinet.name}
          onRole={(role) => act(() => setMemberRole(cabinet.id, picked.userId, role))}
          onRemove={() => act(() => removeMember(cabinet.id, picked.userId))}
          onClose={() => setPicked(null)}
        />
      ) : null}
      {failed ? <Toast text={t('sharing.offline')} onHide={() => setFailed(false)} bottom={96} /> : null}
    </SafeAreaView>
  );
}

const ROLE_LINE = {
  owner: 'members.owner',
  admin: 'members.admin',
  member: 'members.member',
} as const satisfies Record<MemberRole, string>;

const initial = (name: string) => (name.trim()[0] ?? '?').toLocaleUpperCase();

/** The ⋮ of a person: what they may do here, or out of the cabinet. */
function RoleSheet({
  member,
  cabinetName,
  onRole,
  onRemove,
  onClose,
}: {
  member: Member;
  cabinetName: string;
  onRole: (role: 'admin' | 'member') => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Sheet onClose={onClose}>
      <View>
        <Text style={type.sectionTitle}>{member.name || t('members.noName')}</Text>
        <Text style={[type.bodyMedium, styles.muted]}>{t('members.canIn', { name: cabinetName })}</Text>
      </View>
      <View style={styles.choices}>
        {(['admin', 'member'] as const).map((role) => (
          <Choice
            key={role}
            label={t(role === 'admin' ? 'members.adminRole' : 'members.memberRole')}
            hint={t(role === 'admin' ? 'members.adminHint' : 'members.memberHint')}
            picked={member.role === role}
            onPress={() => (member.role === role ? onClose() : onRole(role))}
          />
        ))}
      </View>
      <Button label={t('members.remove')} icon="user-minus" variant="danger" onPress={onRemove} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  fill: { flex: 1 },
  muted: { color: colors.inkMuted },
  pressed: { opacity: 0.6 },
  card: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    ...cardShadow,
  },
  divider: { height: 1, backgroundColor: colors.line, marginLeft: 14 + 44 + spacing.md },
  row: {
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: colors.primary },
  note: { marginTop: spacing.lg },
  choices: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
