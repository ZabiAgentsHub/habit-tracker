import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Modal, Animated, Dimensions,
  Vibration, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { createClient } from '@supabase/supabase-js';

// ── Supabase config ────────────────────────────────────────────────────────────
// Replace these two values once you have your Supabase project:
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';
const sb = SUPABASE_URL !== 'YOUR_SUPABASE_URL'
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    })
  : null;

// ── Notifications handler ──────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ── Constants ──────────────────────────────────────────────────────────────────
const { width: W } = Dimensions.get('window');
const SK = 'ht_v3';

const COLORS   = ['#7c6af7','#5ec4b0','#f0a050','#e05c6a','#4caf82','#60a5fa','#f472b6'];
const HEAT_CLR = ['#2a2a38','rgba(124,106,247,.3)','rgba(124,106,247,.55)','rgba(124,106,247,.8)','#7c6af7'];
const DAY_LBL  = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const QUOTES   = [
  "Every expert was once a beginner.",
  "Small steps every day lead to big results.",
  "Discipline is choosing what you want most over what you want now.",
  "The secret of getting ahead is getting started.",
  "Progress, not perfection.",
  "Your habits define your future self.",
  "Consistency is the key to extraordinary results.",
  "One day or day one — you decide.",
  "We are what we repeatedly do.",
  "Start where you are. Use what you have. Do what you can.",
];
const MILESTONES = { 3:'🔥 3-Day Streak!', 7:'⚡ 7-Day Streak!', 14:'💫 14-Day Streak!', 30:'🌟 30-Day Streak!' };

// ── Palette ────────────────────────────────────────────────────────────────────
const C = {
  bg:'#0f0f13', surface:'#1a1a24', border:'#2a2a38',
  accent:'#7c6af7', accent2:'#5ec4b0',
  text:'#e8e8f0', muted:'#7a7a9a',
  danger:'#e05c6a', success:'#4caf82',
  fire:'#f0a050', gold:'#fbbf24',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const dateKey = (d = new Date()) => d.toISOString().slice(0, 10);

function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0,0,0,0); return d;
}

function isDone(h, key) {
  return (h.log[key] || 0) >= (h.type === 'multi' ? h.target : 1);
}

function calcStreak(h) {
  let s = 0, d = new Date(); d.setHours(0,0,0,0);
  while (isDone(h, dateKey(d))) { s++; d.setDate(d.getDate()-1); }
  return s;
}

function completionRate(h, days) {
  let n = 0;
  for (let i = 0; i < days; i++) if (isDone(h, dateKey(daysAgo(i)))) n++;
  return Math.round((n / days) * 100);
}

function migrateHabit(h) {
  return {
    type: 'once', target: 1, color: COLORS[0], ci: 0, challenge: null,
    ...h,
    log: Object.fromEntries(
      Object.entries(h.log).map(([k, v]) => [k, v === true ? 1 : (Number(v) || 1)])
    ),
  };
}

// ── Seed data ──────────────────────────────────────────────────────────────────
function seedHabits() {
  const [d0,d1,d2,d3,d4] = [0,1,2,3,4].map(n => dateKey(daysAgo(n)));
  return [
    { id:'1', name:'Morning exercise', type:'once', target:1, color:COLORS[0], ci:0,
      challenge:{ days:5, startDate:d4, completedAt:null },
      log:{ [d4]:1,[d3]:1,[d2]:1,[d1]:1 }, createdAt:d4 },
    { id:'2', name:'Read 20 pages', type:'once', target:1, color:COLORS[1], ci:1,
      challenge:null, log:{ [d2]:1,[d1]:1 }, createdAt:d2 },
    { id:'3', name:'Drink water', type:'multi', target:8, color:COLORS[2], ci:2,
      challenge:null, log:{ [d1]:8,[d2]:5 }, createdAt:d0 },
  ];
}

// ── Haptics ────────────────────────────────────────────────────────────────────
const hapticLight   = () => Vibration.vibrate(30);
const hapticMedium  = () => Vibration.vibrate(60);
const hapticSuccess = () => Vibration.vibrate([0, 40, 30, 40, 30, 80]);

// ── Toast component ────────────────────────────────────────────────────────────
function Toast({ message, visible }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 80, friction: 8,
    }).start();
  }, [visible]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[s.toast, {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange:[0,1], outputRange:[-60,0] }) }],
      }]}
    >
      <Text style={s.toastTxt}>{message}</Text>
    </Animated.View>
  );
}

// ── Confetti dots ──────────────────────────────────────────────────────────────
function Confetti({ active }) {
  const anims = useRef(
    Array.from({ length: 28 }, (_, i) => ({
      y: new Animated.Value(-30),
      x: (Math.random() * W * 0.9) + W * 0.05,
      color: COLORS[i % COLORS.length],
      size: Math.random() * 6 + 5,
      delay: i * 40,
    }))
  ).current;

  useEffect(() => {
    if (!active) return;
    anims.forEach(a => {
      a.y.setValue(-30);
      Animated.timing(a.y, {
        toValue: 900,
        duration: 1400 + Math.random() * 600,
        delay: a.delay,
        useNativeDriver: true,
      }).start();
    });
  }, [active]);

  if (!active) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: a.x,
            top: 0,
            width: a.size,
            height: a.size,
            borderRadius: 2,
            backgroundColor: a.color,
            transform: [{ translateY: a.y }],
          }}
        />
      ))}
    </View>
  );
}

// ── Heatmap ────────────────────────────────────────────────────────────────────
function Heatmap({ habits }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const dow = today.getDay();
  const start = new Date(today);
  start.setDate(start.getDate() - dow - 12 * 7);

  const weeks = Array.from({ length: 13 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const key = dateKey(date);
      const isFuture = date > today;
      let heat = 0;
      if (!isFuture && habits.length > 0) {
        const pct = habits.filter(h => isDone(h, key)).length / habits.length;
        if (pct > 0)     heat = 1;
        if (pct >= 0.25) heat = 2;
        if (pct >= 0.5)  heat = 3;
        if (pct >= 0.75) heat = 4;
      }
      return { key, heat, isFuture };
    })
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {weeks.map((days, w) => (
          <View key={w} style={{ gap: 2 }}>
            {days.map(({ key, heat, isFuture }) => (
              <View
                key={key}
                style={{
                  width: 10, height: 10, borderRadius: 2,
                  backgroundColor: HEAT_CLR[heat],
                  opacity: isFuture ? 0.25 : 1,
                }}
              />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Bar chart ──────────────────────────────────────────────────────────────────
function BarChart({ habits }) {
  const data = Array.from({ length: 8 }, (_, i) => {
    const w = 7 - i;
    let done = 0;
    for (let d = 0; d < 7; d++) {
      done += habits.filter(h => isDone(h, dateKey(daysAgo(w * 7 + d)))).length;
    }
    const pct = habits.length === 0 ? 0 : (done / (habits.length * 7)) * 100;
    return { pct, label: `W${i + 1}` };
  });

  const mx = Math.max(...data.map(d => d.pct), 1);

  return (
    <View style={{ height: 90, flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
      {data.map(({ pct, label }) => (
        <View key={label} style={{ flex: 1, alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
          <View style={{
            width: '100%',
            height: Math.max(2, (pct / mx) * 72),
            backgroundColor: C.accent,
            borderRadius: 4,
            opacity: 0.4 + (pct / 100) * 0.6,
          }} />
          <Text style={{ fontSize: 9, color: C.muted }}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [habits, setHabits]           = useState([]);
  const [loaded, setLoaded]           = useState(false);
  const [selDate, setSelDate]         = useState(dateKey());
  const [activeTab, setActiveTab]     = useState('today');

  // auth + sync
  const [sbUser, setSbUser]           = useState(null);
  const [showAuth, setShowAuth]       = useState(false);
  const [authMode, setAuthMode]       = useState('signin'); // 'signin' | 'signup'
  const [authEmail, setAuthEmail]     = useState('');
  const [authPw, setAuthPw]           = useState('');
  const [authErr, setAuthErr]         = useState('');
  const [authOk, setAuthOk]           = useState('');
  const [authBusy, setAuthBusy]       = useState(false);
  const [syncState, setSyncState]     = useState('idle'); // 'idle'|'syncing'|'ok'|'err'
  const syncTimer                     = useRef(null);

  // modals
  const [showAdd, setShowAdd]               = useState(false);
  const [celebration, setCelebration]       = useState(null);
  const [showSettings, setShowSettings]     = useState(false);

  // toast
  const [toastMsg, setToastMsg]   = useState('');
  const [toastVis, setToastVis]   = useState(false);

  // add-habit form state
  const [nName, setNName]         = useState('');
  const [nType, setNType]         = useState('once');
  const [nTarget, setNTarget]     = useState(3);
  const [nCi, setNCi]             = useState(0);
  const [nCh, setNCh]             = useState(0);

  // card scale animations keyed by habitId
  const scaleAnims = useRef({}).current;

  // ── Persistence ──────────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(SK).then(raw => {
      if (raw) {
        setHabits(JSON.parse(raw).map(migrateHabit));
      } else {
        const demo = seedHabits();
        setHabits(demo);
        AsyncStorage.setItem(SK, JSON.stringify(demo));
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(SK, JSON.stringify(habits));
  }, [habits, loaded]);

  // ── Notification permission (ask once on first load) ──────────────────────
  useEffect(() => {
    if (!loaded) return;
    Notifications.requestPermissionsAsync().then(({ status }) => {
      if (status === 'granted') scheduleEveningReminder(habits);
    });
  }, [loaded]);

  // ── Supabase auth listener ────────────────────────────────────────────────
  useEffect(() => {
    if (!sb) return;
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null;
      setSbUser(user);
      if (event === 'SIGNED_IN' && user) {
        await handleSignIn(user);
      }
    });
    sb.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setSbUser(user);
      if (user) handleSignIn(user);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Sync: debounce push on every habits/challenges change ────────────────
  useEffect(() => {
    if (!loaded || !sb || !sbUser) return;
    clearTimeout(syncTimer.current);
    setSyncState('syncing');
    syncTimer.current = setTimeout(() => pushToCloud(sbUser, habits), 800);
  }, [habits, loaded]);

  async function pushToCloud(user, currentHabits) {
    if (!sb || !user) return;
    try {
      if (currentHabits.length > 0) {
        const { error } = await sb.from('habits').upsert(
          currentHabits.map(h => ({ id: h.id, user_id: user.id, data: h, updated_at: new Date().toISOString() })),
          { onConflict: 'id,user_id' }
        );
        if (error) throw error;
      }
      setSyncState('ok');
    } catch (e) {
      console.error('[Supabase] push error', e);
      setSyncState('err');
    }
  }

  async function pullFromCloud(user) {
    if (!sb || !user) return;
    const { data, error } = await sb.from('habits').select('data').eq('user_id', user.id);
    if (error) { console.error('[Supabase] pull error', error); setSyncState('err'); return; }
    const remote = (data || []).map(r => r.data);
    if (remote.length > 0) {
      const migrated = remote.map(h => ({
        type: 'once', target: 1, color: COLORS[0], ci: 0, challenge: null,
        ...h,
        log: Object.fromEntries(
          Object.entries(h.log || {}).map(([k, v]) => [k, v === true ? 1 : (Number(v) || 1)])
        ),
      }));
      setHabits(migrated);
      await AsyncStorage.setItem(SK, JSON.stringify(migrated));
    }
    setSyncState('ok');
  }

  async function handleSignIn(user) {
    const raw = await AsyncStorage.getItem(SK);
    const local = raw ? JSON.parse(raw) : [];
    if (local.length > 0) {
      Alert.alert(
        'Sync your habits',
        'You have local habits. What would you like to do?',
        [
          { text: 'Upload local data', onPress: () => pushToCloud(user, local) },
          { text: 'Load from cloud',   onPress: () => pullFromCloud(user) },
        ]
      );
    } else {
      await pullFromCloud(user);
    }
  }

  // ── Auth actions ──────────────────────────────────────────────────────────
  async function doAuth() {
    if (!sb) { Alert.alert('Setup needed', 'Add your Supabase credentials to App.js first.'); return; }
    setAuthErr(''); setAuthOk('');
    if (!authEmail.trim() || !authPw) { setAuthErr('Enter your email and password.'); return; }
    if (authPw.length < 6) { setAuthErr('Password must be at least 6 characters.'); return; }

    setAuthBusy(true);
    try {
      if (authMode === 'signin') {
        const { error } = await sb.auth.signInWithPassword({ email: authEmail.trim(), password: authPw });
        if (error) throw error;
        setShowAuth(false); setAuthEmail(''); setAuthPw('');
      } else {
        const { error } = await sb.auth.signUp({ email: authEmail.trim(), password: authPw });
        if (error) throw error;
        setAuthOk('Check your email to confirm, then sign in.');
        setAuthMode('signin');
      }
    } catch (e) {
      setAuthErr(e.message || 'Something went wrong.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function doSignOut() {
    if (!sb) return;
    await sb.auth.signOut();
    setSbUser(null);
    showToast('Signed out');
    setShowSettings(false);
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const today      = dateKey();
  const doneToday  = habits.filter(h => isDone(h, selDate)).length;
  const pct        = habits.length === 0 ? 0 : Math.round((doneToday / habits.length) * 100);
  const bestStreak = habits.reduce((m, h) => Math.max(m, calcStreak(h)), 0);
  const quote      = QUOTES[new Date().getDate() % QUOTES.length];

  const selD       = new Date(selDate + 'T00:00:00');
  const dateLabel  = selDate === today
    ? 'Today · ' + selD.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })
    : selD.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = daysAgo(6 - i);
    return { key: dateKey(d), day: DAY_LBL[d.getDay()], num: d.getDate() };
  });

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg) {
    setToastMsg(msg); setToastVis(true);
    setTimeout(() => setToastVis(false), 3000);
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  async function scheduleEveningReminder(hs) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const remaining = hs.filter(h => !isDone(h, dateKey())).length;
    if (remaining === 0) return;
    const trigger = new Date(); trigger.setHours(20, 0, 0, 0);
    if (trigger <= new Date()) trigger.setDate(trigger.getDate() + 1);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Habit Tracker 🎯',
        body: `${remaining} habit${remaining > 1 ? 's' : ''} left today. You've got this!`,
      },
      trigger,
    });
  }

  // ── Scale animation per card ──────────────────────────────────────────────
  function getScaleAnim(id) {
    if (!scaleAnims[id]) scaleAnims[id] = new Animated.Value(1);
    return scaleAnims[id];
  }

  function animateCard(id) {
    const anim = getScaleAnim(id);
    Animated.sequence([
      Animated.timing(anim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
  }

  // ── Toggle once ───────────────────────────────────────────────────────────
  const toggleOnce = useCallback((id) => {
    setHabits(prev => {
      const next = prev.map(h => {
        if (h.id !== id) return h;
        const log = { ...h.log };
        const was = isDone(h, selDate);
        if (was) {
          delete log[selDate];
          return { ...h, log };
        }
        log[selDate] = 1;
        const updated = { ...h, log };

        hapticLight();
        animateCard(id);

        // milestone check
        const s = calcStreak(updated);
        if (MILESTONES[s]) setTimeout(() => showToast(`${h.name}: ${MILESTONES[s]}`), 200);

        // challenge check
        if (updated.challenge && !updated.challenge.completedAt) {
          const { days, startDate } = updated.challenge;
          let done = 0;
          for (let i = 0; i < days; i++) {
            const d = new Date(startDate + 'T00:00:00');
            d.setDate(d.getDate() + i);
            if (isDone(updated, dateKey(d))) done++;
          }
          if (done >= days) {
            updated.challenge = { ...updated.challenge, completedAt: dateKey() };
            setTimeout(() => {
              hapticSuccess();
              setCelebration({ emoji:'🏆', title:`${days}-Day Challenge Done!`, sub:`"${h.name}" conquered. You're unstoppable!` });
            }, 400);
          }
        }

        return updated;
      });

      const allDone = next.length > 0 && next.every(h => isDone(h, selDate));
      if (allDone && !prev.every(h => isDone(h, selDate))) {
        setTimeout(() => {
          hapticSuccess();
          setCelebration({ emoji:'🎉', title:'All Done!', sub:`You crushed all ${next.length} habits today!` });
        }, 350);
      }

      scheduleEveningReminder(next);
      return next;
    });
  }, [selDate]);

  // ── Increment / decrement multi ───────────────────────────────────────────
  const incrMulti = useCallback((id) => {
    setHabits(prev => {
      const next = prev.map(h => {
        if (h.id !== id) return h;
        const was = isDone(h, selDate);
        const log = { ...h.log, [selDate]: (h.log[selDate] || 0) + 1 };
        const updated = { ...h, log };
        const nowDone = isDone(updated, selDate);

        if (!was && nowDone) {
          hapticLight();
          animateCard(id);
          const s = calcStreak(updated);
          if (MILESTONES[s]) setTimeout(() => showToast(`${h.name}: ${MILESTONES[s]}`), 200);
          if (updated.challenge && !updated.challenge.completedAt) {
            const { days, startDate } = updated.challenge;
            let done = 0;
            for (let i = 0; i < days; i++) {
              const d = new Date(startDate + 'T00:00:00');
              d.setDate(d.getDate() + i);
              if (isDone(updated, dateKey(d))) done++;
            }
            if (done >= days) {
              updated.challenge = { ...updated.challenge, completedAt: dateKey() };
              setTimeout(() => {
                hapticSuccess();
                setCelebration({ emoji:'🏆', title:`${days}-Day Challenge Done!`, sub:`"${h.name}" conquered!` });
              }, 400);
            }
          }
        } else {
          Vibration.vibrate(20);
        }
        return updated;
      });

      const allDone = next.length > 0 && next.every(h => isDone(h, selDate));
      if (allDone && !prev.every(h => isDone(h, selDate))) {
        setTimeout(() => {
          hapticSuccess();
          setCelebration({ emoji:'🎉', title:'All Done!', sub:`You crushed all ${next.length} habits today!` });
        }, 350);
      }

      scheduleEveningReminder(next);
      return next;
    });
  }, [selDate]);

  const decrMulti = useCallback((id) => {
    setHabits(prev => prev.map(h => {
      if (h.id !== id) return h;
      const c = h.log[selDate] || 0;
      if (c <= 0) return h;
      const log = { ...h.log };
      if (c === 1) delete log[selDate];
      else log[selDate] = c - 1;
      return { ...h, log };
    }));
  }, [selDate]);

  const deleteHabit = useCallback((id, name) => {
    Alert.alert('Delete habit', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () =>
        setHabits(prev => prev.filter(h => h.id !== id)) },
    ]);
  }, []);

  // ── Add habit ─────────────────────────────────────────────────────────────
  function openAdd() {
    setNName(''); setNType('once'); setNTarget(3);
    setNCi(habits.length % COLORS.length); setNCh(0);
    setShowAdd(true);
  }

  function submitHabit() {
    const name = nName.trim();
    if (!name) return;
    const habit = {
      id: Date.now().toString(), name,
      type: nType, target: nType === 'multi' ? nTarget : 1,
      color: COLORS[nCi], ci: nCi,
      challenge: nCh > 0 ? { days: nCh, startDate: dateKey(), completedAt: null } : null,
      log: {}, createdAt: dateKey(),
    };
    setHabits(prev => [...prev, habit]);
    setShowAdd(false);
    if (nCh > 0) setTimeout(() => setActiveTab('challenges'), 400);
  }

  // ── Tab content ───────────────────────────────────────────────────────────
  const sorted = [...habits].sort((a, b) => (isDone(a, selDate)?1:0) - (isDone(b, selDate)?1:0));

  function renderDots(habit) {
    return Array.from({ length: 7 }, (_, i) => {
      const dk = dateKey(daysAgo(6 - i));
      const on = isDone(habit, dk), isToday = dk === today;
      return (
        <View key={dk} style={[
          s.dot,
          on && s.dotOn,
          isToday && !on && s.dotToday,
          isToday && on  && s.dotTodayOn,
        ]} />
      );
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Toast */}
      <Toast message={toastMsg} visible={toastVis} />

      {/* Auth modal */}
      <Modal visible={showAuth} transparent animationType="slide" onRequestClose={() => setShowAuth(false)}>
        <KeyboardAvoidingView style={s.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAuth(false)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>{authMode === 'signin' ? 'Sign In' : 'Create Account'}</Text>

            {/* Tab toggle */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
              {[{ m: 'signin', l: 'Sign In' }, { m: 'signup', l: 'Create Account' }].map(({ m, l }) => (
                <TouchableOpacity
                  key={m}
                  style={[s.authTab, authMode === m && s.authTabOn]}
                  onPress={() => { setAuthMode(m); setAuthErr(''); setAuthOk(''); }}
                >
                  <Text style={[s.authTabTxt, authMode === m && s.authTabTxtOn]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fl}>Email</Text>
            <TextInput
              style={[s.fi, { marginBottom: 12 }]}
              value={authEmail} onChangeText={setAuthEmail}
              placeholder="you@example.com" placeholderTextColor={C.muted}
              keyboardType="email-address" autoCapitalize="none"
              autoComplete="email"
            />
            <Text style={s.fl}>Password</Text>
            <TextInput
              style={[s.fi, { marginBottom: 12 }]}
              value={authPw} onChangeText={setAuthPw}
              placeholder="••••••••" placeholderTextColor={C.muted}
              secureTextEntry autoComplete="password"
            />

            {!!authErr && <View style={s.authMsgErr}><Text style={{ color: C.danger, fontSize: 13 }}>{authErr}</Text></View>}
            {!!authOk  && <View style={s.authMsgOk}><Text style={{ color: C.success, fontSize: 13 }}>{authOk}</Text></View>}

            <TouchableOpacity
              style={[s.btnPrimary, authBusy && { opacity: 0.6 }]}
              onPress={doAuth} disabled={authBusy} activeOpacity={0.85}
            >
              <Text style={s.btnPrimaryTxt}>
                {authBusy ? '…' : authMode === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnPrimary, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.border, marginTop: 8 }]}
              onPress={() => setShowAuth(false)} activeOpacity={0.85}
            >
              <Text style={[s.btnPrimaryTxt, { color: C.muted }]}>Continue as Guest</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Celebration modal */}
      <Modal visible={!!celebration} transparent animationType="fade" onRequestClose={() => setCelebration(null)}>
        <View style={s.celebBackdrop}>
          <Confetti active={!!celebration} />
          <View style={s.celebBox}>
            <Text style={s.celebEmoji}>{celebration?.emoji}</Text>
            <Text style={s.celebTitle}>{celebration?.title}</Text>
            <Text style={s.celebSub}>{celebration?.sub}</Text>
            <TouchableOpacity style={s.celebBtn} onPress={() => setCelebration(null)} activeOpacity={0.8}>
              <Text style={s.celebBtnTxt}>Keep it up! →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Habit modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowAdd(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={s.sheet}>
              <View style={s.handle} />
              <Text style={s.sheetTitle}>New Habit</Text>

              {/* Name */}
              <Text style={s.fl}>Habit name</Text>
              <TextInput
                style={s.fi} value={nName} onChangeText={setNName}
                placeholder="e.g. Morning run…" placeholderTextColor={C.muted}
                maxLength={60} returnKeyType="done"
              />

              {/* Type */}
              <Text style={[s.fl, { marginTop: 14 }]}>Type</Text>
              <View style={s.toggleRow}>
                <TouchableOpacity style={[s.topt, nType==='once' && s.toptSel]} onPress={() => setNType('once')}>
                  <Text style={[s.toptTxt, nType==='once' && s.toptTxtSel]}>✓ Once per day</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.topt, nType==='multi' && s.toptSel]} onPress={() => setNType('multi')}>
                  <Text style={[s.toptTxt, nType==='multi' && s.toptTxtSel]}>🔄 Multiple times</Text>
                </TouchableOpacity>
              </View>

              {/* Target count */}
              {nType === 'multi' && (
                <>
                  <Text style={[s.fl, { marginTop: 14 }]}>Times per day</Text>
                  <View style={s.countRow}>
                    <TouchableOpacity style={s.cntBtn} onPress={() => setNTarget(t => Math.max(2, t-1))}>
                      <Text style={s.cntBtnTxt}>−</Text>
                    </TouchableOpacity>
                    <Text style={s.cntNum}>{nTarget}</Text>
                    <TouchableOpacity style={s.cntBtn} onPress={() => setNTarget(t => Math.min(20, t+1))}>
                      <Text style={s.cntBtnTxt}>+</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Color */}
              <Text style={[s.fl, { marginTop: 14 }]}>Colour</Text>
              <View style={s.colorRow}>
                {COLORS.map((c, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[s.swatch, { backgroundColor: c }, i === nCi && s.swatchSel]}
                    onPress={() => setNCi(i)}
                  />
                ))}
              </View>

              {/* Challenge */}
              <Text style={[s.fl, { marginTop: 14 }]}>Challenge (optional)</Text>
              <View style={s.chOpts}>
                {[{ d:0, lbl:'None' }, { d:3, lbl:'🏆 3-Day' }, { d:5, lbl:'🏆 5-Day' }, { d:7, lbl:'🏆 7-Day' }].map(({ d, lbl }) => (
                  <TouchableOpacity key={d} style={[s.chChip, nCh===d && s.chChipSel]} onPress={() => setNCh(d)}>
                    <Text style={[s.chChipTxt, nCh===d && s.chChipTxtSel]}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={s.btnPrimary} onPress={submitHabit} activeOpacity={0.85}>
                <Text style={s.btnPrimaryTxt}>Add Habit</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Settings modal */}
      <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowSettings(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={s.sheet}>
              <View style={s.handle} />
              <Text style={s.sheetTitle}>⚙️ Settings</Text>

              <Text style={s.fl}>Account</Text>
              {sbUser ? (
                <View style={s.acctRow}>
                  <Text style={s.acctEmail} numberOfLines={1}>{sbUser.email}</Text>
                  <TouchableOpacity style={s.acctSignout} onPress={doSignOut}>
                    <Text style={{ color: C.danger, fontSize: 13, fontWeight: '600' }}>Sign Out</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={[s.btnPrimary, { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }]}
                    onPress={() => { setShowSettings(false); setAuthMode('signin'); setShowAuth(true); }}
                  >
                    <Text style={[s.btnPrimaryTxt, { color: C.text }]}>🔐 Sign In / Create Account</Text>
                  </TouchableOpacity>
                  <Text style={s.settingsNote}>Sync your habits across devices.</Text>
                </>
              )}

              <Text style={[s.fl, { marginTop: 20 }]}>Reminders</Text>
              <TouchableOpacity
                style={[s.btnPrimary, { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }]}
                onPress={async () => {
                  const { status } = await Notifications.requestPermissionsAsync();
                  if (status === 'granted') { scheduleEveningReminder(habits); showToast('🔔 Reminders enabled!'); }
                }}
              >
                <Text style={[s.btnPrimaryTxt, { color: C.text }]}>🔔 Enable Daily Reminders</Text>
              </TouchableOpacity>
              <Text style={s.settingsNote}>Get notified at 8 PM if habits aren't complete.</Text>

              <Text style={[s.fl, { marginTop: 20 }]}>Data</Text>
              <TouchableOpacity
                style={[s.btnPrimary, { backgroundColor: 'rgba(224,92,106,.12)', borderWidth: 1, borderColor: 'rgba(224,92,106,.3)' }]}
                onPress={() => {
                  Alert.alert('Clear all data', 'This will delete all habits and history. Cannot be undone.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear', style: 'destructive', onPress: async () => {
                      if (sb && sbUser) {
                        await Promise.all([
                          sb.from('habits').delete().eq('user_id', sbUser.id),
                        ]);
                      }
                      setHabits([]); setShowSettings(false);
                      AsyncStorage.removeItem(SK);
                    }},
                  ]);
                }}
              >
                <Text style={[s.btnPrimaryTxt, { color: C.danger }]}>🗑 Clear All Data</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <Text style={s.title}>Habit Tracker</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {sbUser ? (
              <TouchableOpacity style={s.authBadge} onPress={() => setShowSettings(true)}>
                <View style={s.authAvatar}>
                  <Text style={s.authAvatarTxt}>{(sbUser.email || '').slice(0, 2).toUpperCase()}</Text>
                </View>
                <Text style={s.authBadgeName} numberOfLines={1}>{(sbUser.email || '').split('@')[0]}</Text>
                <View style={[s.syncDot,
                  syncState === 'syncing' && { backgroundColor: C.fire },
                  syncState === 'err'     && { backgroundColor: C.danger },
                ]} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.signinBtn} onPress={() => { setAuthMode('signin'); setShowAuth(true); }}>
                <Text style={s.signinBtnTxt}>Sign In</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowSettings(true)} style={s.settingsBtn}>
              <Text style={{ fontSize: 18 }}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={s.dateLabel}>{dateLabel}</Text>
      </View>

      {/* ── Today tab ── */}
      {activeTab === 'today' && (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Week strip */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {weekDays.map(({ key, day, num }) => (
              <TouchableOpacity key={key} style={s.weekDay} onPress={() => setSelDate(key)}>
                <Text style={s.weekDayLbl}>{day}</Text>
                <View style={[s.weekNum,
                  key === today && s.weekNumToday,
                  key === selDate && s.weekNumActive,
                  key === today && key === selDate && s.weekNumTodayActive,
                ]}>
                  <Text style={[s.weekNumTxt, key === selDate && s.weekNumTxtActive]}>{num}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Quote */}
          <View style={s.quoteCard}>
            <Text style={s.quoteTxt}>"{quote}"</Text>
          </View>

          {/* Progress */}
          <View style={s.progressCard}>
            <View style={s.progressHdr}>
              <Text style={s.progressTitle}>Today's Progress</Text>
              <Text style={s.progressPct}>{pct}%</Text>
            </View>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${pct}%` }]} />
            </View>
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            {[{ v: habits.length, l:'Habits' }, { v: doneToday, l:'Done Today' }, { v: bestStreak, l:'Best Streak' }].map(({ v, l }) => (
              <View key={l} style={s.statCard}>
                <Text style={s.statVal}>{v}</Text>
                <Text style={s.statLbl}>{l}</Text>
              </View>
            ))}
          </View>

          {/* Section label */}
          <Text style={s.secLbl}>
            {selDate === today ? "Today's Habits" : selD.toLocaleDateString('en-US', { month:'short', day:'numeric' }) + ' Habits'}
          </Text>

          {/* Habit list */}
          {sorted.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🌱</Text>
              <Text style={s.emptyTxt}>No habits yet. Tap + to add your first!</Text>
            </View>
          ) : sorted.map(h => {
            const done = isDone(h, selDate);
            const str  = calcStreak(h);
            const cnt  = h.log[selDate] || 0;
            const scaleAnim = getScaleAnim(h.id);

            let chBadge = null;
            if (h.challenge && !h.challenge.completedAt) {
              let cd = 0;
              for (let i = 0; i < h.challenge.days; i++) {
                const d2 = new Date(h.challenge.startDate + 'T00:00:00');
                d2.setDate(d2.getDate() + i);
                if (isDone(h, dateKey(d2))) cd++;
              }
              chBadge = `🏆 ${cd}/${h.challenge.days}`;
            }

            return (
              <Animated.View key={h.id} style={[s.card, done && s.cardDone, { transform:[{ scale: scaleAnim }] }]}>
                <View style={[s.cardBar, { backgroundColor: h.color || COLORS[0] }]} />

                {h.type === 'once' && (
                  <TouchableOpacity
                    style={[s.checkBtn, done && s.checkBtnDone]}
                    onPress={() => toggleOnce(h.id)}
                  >
                    {done && <Text style={s.checkMark}>✓</Text>}
                  </TouchableOpacity>
                )}

                <View style={s.cardBody}>
                  <Text style={[s.habitName, done && s.habitNameDone]} numberOfLines={1}>{h.name}</Text>
                  <View style={s.habitMeta}>
                    <Text style={s.streakTxt}>🔥 {str} day streak</Text>
                    {h.type === 'multi' && (
                      <View style={s.typeBadge}>
                        <Text style={s.typeBadgeTxt}>{cnt}/{h.target}×</Text>
                      </View>
                    )}
                    {!!chBadge && <Text style={s.chBadge}>{chBadge}</Text>}
                  </View>
                  <View style={s.dotRow}>{renderDots(h)}</View>
                </View>

                {h.type === 'multi' && (
                  <View style={s.multiCtr}>
                    <TouchableOpacity style={s.ctrBtn} onPress={() => decrMulti(h.id)}>
                      <Text style={[s.ctrBtnTxt, { color: C.danger }]}>−</Text>
                    </TouchableOpacity>
                    <Text style={s.ctrVal}>{cnt}/{h.target}</Text>
                    <TouchableOpacity style={s.ctrBtn} onPress={() => incrMulti(h.id)}>
                      <Text style={[s.ctrBtnTxt, { color: C.success }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity style={s.delBtn} onPress={() => deleteHabit(h.id, h.name)}>
                  <Text style={s.delBtnTxt}>✕</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {/* ── Challenges tab ── */}
      {activeTab === 'challenges' && (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {habits.filter(h => h.challenge).length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🏆</Text>
              <Text style={s.emptyTxt}>No challenges yet.{'\n'}Add a habit with a challenge to begin!</Text>
            </View>
          ) : habits.filter(h => h.challenge).map(h => {
            const { days, startDate, completedAt } = h.challenge;
            let doneDays = 0;
            const pills = Array.from({ length: days }, (_, i) => {
              const d = new Date(startDate + 'T00:00:00');
              d.setDate(d.getDate() + i);
              const on = isDone(h, dateKey(d));
              const isToday = dateKey(d) === today;
              if (on) doneDays++;
              return { on, isToday, key: i };
            });

            return (
              <View key={h.id} style={s.chCard}>
                <View style={s.chHdr}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.chName}>{h.name}</Text>
                    <Text style={s.chSub}>{days}-Day Challenge · Started {new Date(startDate+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</Text>
                  </View>
                  <View style={[s.chTag, completedAt && s.chTagDone]}>
                    <Text style={[s.chTagTxt, completedAt && s.chTagTxtDone]}>
                      {completedAt ? '✓ Done' : `${doneDays}/${days}`}
                    </Text>
                  </View>
                </View>
                <View style={s.chPills}>
                  {pills.map(({ on, isToday, key }) => (
                    <View key={key} style={[s.chPill, on && s.chPillDone, !on && isToday && s.chPillActive]} />
                  ))}
                </View>
                <Text style={s.chProg}>
                  {completedAt ? '🏆 Challenge completed!' : `${doneDays} of ${days} days done · ${days-doneDays} remaining`}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── History tab ── */}
      {activeTab === 'history' && (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={s.hCard}>
            <Text style={s.hTitle}>Activity · Last 13 Weeks</Text>
            {habits.length === 0 ? (
              <Text style={{ color: C.muted, fontSize: 13 }}>Add habits to see your activity.</Text>
            ) : (
              <>
                <Heatmap habits={habits} />
                <View style={{ flexDirection:'row', gap:5, alignItems:'center', marginTop:8 }}>
                  <Text style={{ fontSize:10, color:C.muted }}>Less</Text>
                  {HEAT_CLR.map((c, i) => (
                    <View key={i} style={{ width:10, height:10, borderRadius:2, backgroundColor:c }} />
                  ))}
                  <Text style={{ fontSize:10, color:C.muted }}>More</Text>
                </View>
              </>
            )}
          </View>

          <View style={s.hCard}>
            <Text style={s.hTitle}>Weekly Completion Rate</Text>
            {habits.length === 0
              ? <Text style={{ color:C.muted, fontSize:13 }}>No data yet.</Text>
              : <BarChart habits={habits} />
            }
          </View>

          <View style={s.hCard}>
            <Text style={s.hTitle}>Per-Habit Stats</Text>
            {habits.length === 0
              ? <Text style={{ color:C.muted, fontSize:13 }}>No habits yet.</Text>
              : habits.map(h => (
                <View key={h.id} style={s.hsRow}>
                  <View style={[s.hsDot, { backgroundColor: h.color || COLORS[0] }]} />
                  <Text style={s.hsName} numberOfLines={1}>{h.name}</Text>
                  <View style={s.hsNums}>
                    {[
                      { v: calcStreak(h), k: 'Streak' },
                      { v: completionRate(h,7)+'%', k: '7-Day' },
                      { v: completionRate(h,30)+'%', k: '30-Day' },
                    ].map(({ v, k }) => (
                      <View key={k} style={s.hsItem}>
                        <Text style={s.hsN}>{v}</Text>
                        <Text style={s.hsK}>{k}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))
            }
          </View>
        </ScrollView>
      )}

      {/* ── FAB ── */}
      {activeTab === 'today' && (
        <TouchableOpacity style={s.fab} onPress={openAdd} activeOpacity={0.85}>
          <Text style={s.fabTxt}>+</Text>
        </TouchableOpacity>
      )}

      {/* ── Tab bar ── */}
      <View style={s.tabBar}>
        {[
          { id:'today',      icon:'📋', lbl:'Today' },
          { id:'challenges', icon:'🏆', lbl:'Challenges' },
          { id:'history',    icon:'📊', lbl:'History' },
        ].map(({ id, icon, lbl }) => (
          <TouchableOpacity key={id} style={s.tabBtn} onPress={() => setActiveTab(id)}>
            <Text style={s.tabIcon}>{icon}</Text>
            <Text style={[s.tabLbl, activeTab===id && s.tabLblActive]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 14, paddingTop: 8 },

  // header
  header:    { paddingTop: Platform.OS === 'android' ? 44 : 56, paddingBottom: 10, paddingHorizontal: 20, alignItems:'center', backgroundColor: C.bg },
  headerRow: { flexDirection:'row', alignItems:'center', justifyContent:'center', width:'100%', position:'relative' },
  title:     { fontSize: 24, fontWeight: '800', color: C.accent },
  settingsBtn: { position:'absolute', right:0, padding:4 },
  dateLabel: { fontSize: 12, color: C.muted, marginTop: 3 },

  // week strip
  weekDay:            { alignItems:'center', marginRight:10, paddingVertical:4 },
  weekDayLbl:         { fontSize:10, color:C.muted, textTransform:'uppercase', letterSpacing:.5, marginBottom:4 },
  weekNum:            { width:34, height:34, borderRadius:17, borderWidth:2, borderColor:C.border, alignItems:'center', justifyContent:'center' },
  weekNumTxt:         { fontSize:13, fontWeight:'600', color:C.muted },
  weekNumToday:       { borderColor:C.accent2 },
  weekNumActive:      { borderColor:C.accent, backgroundColor:C.accent },
  weekNumTodayActive: { borderColor:C.accent2, backgroundColor:C.accent2 },
  weekNumTxtActive:   { color:'#fff' },

  // quote
  quoteCard: { backgroundColor:'rgba(124,106,247,.1)', borderWidth:1, borderColor:'rgba(124,106,247,.22)', borderRadius:12, padding:11, marginBottom:12 },
  quoteTxt:  { fontSize:12, color:C.muted, fontStyle:'italic', textAlign:'center', lineHeight:18 },

  // progress
  progressCard:   { backgroundColor:C.surface, borderWidth:1, borderColor:C.border, borderRadius:14, padding:13, marginBottom:10 },
  progressHdr:    { flexDirection:'row', justifyContent:'space-between', marginBottom:9 },
  progressTitle:  { fontSize:13, color:C.text },
  progressPct:    { fontSize:13, fontWeight:'700', color:C.accent2 },
  progressTrack:  { height:7, backgroundColor:C.border, borderRadius:99, overflow:'hidden' },
  progressFill:   { height:'100%', backgroundColor:C.accent, borderRadius:99 },

  // stats
  statsRow: { flexDirection:'row', gap:8, marginBottom:12 },
  statCard: { flex:1, backgroundColor:C.surface, borderWidth:1, borderColor:C.border, borderRadius:12, padding:11, alignItems:'center' },
  statVal:  { fontSize:22, fontWeight:'700', color:C.accent },
  statLbl:  { fontSize:10, color:C.muted, marginTop:1, textTransform:'uppercase', letterSpacing:.4 },

  secLbl: { fontSize:10, fontWeight:'700', textTransform:'uppercase', letterSpacing:.8, color:C.muted, marginBottom:10 },

  // habit card
  card:        { backgroundColor:C.surface, borderWidth:1, borderColor:C.border, borderRadius:14, padding:13, flexDirection:'row', alignItems:'center', gap:10, marginBottom:9, overflow:'hidden' },
  cardDone:    { borderColor:'rgba(76,175,130,.25)' },
  cardBar:     { position:'absolute', left:0, top:0, bottom:0, width:4, borderRadius:4 },
  checkBtn:    { width:28, height:28, borderRadius:14, borderWidth:2, borderColor:C.border, alignItems:'center', justifyContent:'center', flexShrink:0 },
  checkBtnDone:{ backgroundColor:C.success, borderColor:C.success },
  checkMark:   { color:'#fff', fontSize:14, fontWeight:'700' },
  cardBody:    { flex:1, minWidth:0 },
  habitName:   { fontSize:14, fontWeight:'500', color:C.text },
  habitNameDone:{ color:C.muted, textDecorationLine:'line-through' },
  habitMeta:   { flexDirection:'row', gap:8, alignItems:'center', marginTop:2, flexWrap:'wrap' },
  streakTxt:   { fontSize:11, color:C.fire, fontWeight:'600' },
  typeBadge:   { backgroundColor:'rgba(124,106,247,.15)', borderRadius:4, paddingHorizontal:5, paddingVertical:1 },
  typeBadgeTxt:{ fontSize:10, color:C.accent, fontWeight:'700' },
  chBadge:     { fontSize:11, color:C.gold, fontWeight:'600' },
  dotRow:      { flexDirection:'row', gap:3, marginTop:6 },
  dot:         { width:7, height:7, borderRadius:3.5, backgroundColor:C.border },
  dotOn:       { backgroundColor:C.success },
  dotToday:    { borderWidth:2, borderColor:C.accent2, backgroundColor:'transparent' },
  dotTodayOn:  { backgroundColor:C.accent2 },

  // multi counter
  multiCtr:  { flexDirection:'row', alignItems:'center', gap:5, flexShrink:0 },
  ctrBtn:    { width:26, height:26, borderRadius:13, borderWidth:2, borderColor:C.border, alignItems:'center', justifyContent:'center' },
  ctrBtnTxt: { fontSize:16, fontWeight:'700' },
  ctrVal:    { fontSize:12, fontWeight:'700', color:C.text, minWidth:30, textAlign:'center' },

  delBtn:    { padding:5 },
  delBtnTxt: { color:C.muted, fontSize:13 },

  empty:     { alignItems:'center', paddingVertical:44 },
  emptyIcon: { fontSize:42, marginBottom:10 },
  emptyTxt:  { fontSize:13, color:C.muted, textAlign:'center', lineHeight:20 },

  // FAB
  fab:    { position:'absolute', bottom:78, right:16, width:52, height:52, borderRadius:26, backgroundColor:C.accent, alignItems:'center', justifyContent:'center', elevation:6, shadowColor:'#7c6af7', shadowOffset:{width:0,height:4}, shadowOpacity:.5, shadowRadius:8 },
  fabTxt: { color:'#fff', fontSize:28, lineHeight:32, fontWeight:'300' },

  // tab bar
  tabBar: { flexDirection:'row', backgroundColor:C.surface, borderTopWidth:1, borderTopColor:C.border, paddingBottom:Platform.OS==='ios'?20:0 },
  tabBtn: { flex:1, alignItems:'center', justifyContent:'center', paddingVertical:10, gap:2 },
  tabIcon:{ fontSize:20 },
  tabLbl: { fontSize:9, fontWeight:'700', textTransform:'uppercase', letterSpacing:.5, color:C.muted },
  tabLblActive: { color:C.accent },

  // celebration
  celebBackdrop: { flex:1, backgroundColor:'rgba(0,0,0,.82)', alignItems:'center', justifyContent:'center' },
  celebBox:   { backgroundColor:C.surface, borderRadius:24, borderWidth:1, borderColor:C.border, padding:32, alignItems:'center', maxWidth:290 },
  celebEmoji: { fontSize:52, marginBottom:12 },
  celebTitle: { fontSize:22, fontWeight:'800', color:C.text, marginBottom:6, textAlign:'center' },
  celebSub:   { fontSize:14, color:C.muted, marginBottom:20, textAlign:'center', lineHeight:20 },
  celebBtn:   { backgroundColor:C.accent, borderRadius:12, paddingVertical:12, paddingHorizontal:28 },
  celebBtnTxt:{ color:'#fff', fontSize:15, fontWeight:'700' },

  // auth badge
  authBadge:    { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(124,106,247,.12)', borderWidth:1, borderColor:'rgba(124,106,247,.25)', borderRadius:99, paddingVertical:4, paddingLeft:4, paddingRight:10, maxWidth:140 },
  authAvatar:   { width:26, height:26, borderRadius:13, backgroundColor:C.accent, alignItems:'center', justifyContent:'center' },
  authAvatarTxt:{ color:'#fff', fontSize:10, fontWeight:'700' },
  authBadgeName:{ flex:1, fontSize:12, color:C.text, fontWeight:'500' },
  syncDot:      { width:7, height:7, borderRadius:3.5, backgroundColor:C.success },
  signinBtn:    { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.border, borderRadius:20, paddingVertical:5, paddingHorizontal:12 },
  signinBtnTxt: { fontSize:12, fontWeight:'600', color:C.muted },

  // auth modal
  authTab:      { flex:1, padding:10, borderRadius:10, alignItems:'center', backgroundColor:C.bg, borderWidth:1.5, borderColor:C.border },
  authTabOn:    { backgroundColor:'rgba(124,106,247,.15)', borderColor:C.accent },
  authTabTxt:   { fontSize:13, color:C.muted, fontWeight:'600' },
  authTabTxtOn: { color:C.accent },
  authMsgErr:   { backgroundColor:'rgba(224,92,106,.1)', borderWidth:1, borderColor:'rgba(224,92,106,.3)', borderRadius:8, padding:10, marginBottom:10 },
  authMsgOk:    { backgroundColor:'rgba(76,175,130,.1)', borderWidth:1, borderColor:'rgba(76,175,130,.3)', borderRadius:8, padding:10, marginBottom:10 },

  // account row in settings
  acctRow:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:C.bg, borderWidth:1, borderColor:C.border, borderRadius:12, padding:12, marginTop:8 },
  acctEmail:   { flex:1, fontSize:13, color:C.muted },
  acctSignout: { marginLeft:12, backgroundColor:'rgba(224,92,106,.12)', borderWidth:1, borderColor:'rgba(224,92,106,.28)', borderRadius:8, paddingVertical:6, paddingHorizontal:12 },

  // toast
  toast:    { position:'absolute', top:50, alignSelf:'center', backgroundColor:'#f0a050', borderRadius:99, paddingVertical:9, paddingHorizontal:22, zIndex:999, elevation:20, shadowColor:'#000', shadowOffset:{width:0,height:3}, shadowOpacity:.4, shadowRadius:8 },
  toastTxt: { color:'#0f0f13', fontSize:13, fontWeight:'700' },

  // modal / sheet
  modalBackdrop: { flex:1, backgroundColor:'rgba(0,0,0,.7)', justifyContent:'flex-end' },
  sheet:      { backgroundColor:C.surface, borderTopLeftRadius:20, borderTopRightRadius:20, padding:20, paddingBottom:40 },
  handle:     { width:36, height:4, backgroundColor:C.border, borderRadius:2, alignSelf:'center', marginBottom:16 },
  sheetTitle: { fontSize:17, fontWeight:'700', color:C.text, marginBottom:16 },
  fl:         { fontSize:11, fontWeight:'700', textTransform:'uppercase', letterSpacing:.8, color:C.muted, marginBottom:8 },
  fi:         { backgroundColor:C.bg, borderWidth:1, borderColor:C.border, borderRadius:10, paddingHorizontal:13, paddingVertical:11, color:C.text, fontSize:15 },
  toggleRow:  { flexDirection:'row', gap:8 },
  topt:       { flex:1, backgroundColor:C.bg, borderWidth:1, borderColor:C.border, borderRadius:10, padding:10, alignItems:'center' },
  toptSel:    { backgroundColor:'rgba(124,106,247,.15)', borderColor:C.accent },
  toptTxt:    { fontSize:13, color:C.muted },
  toptTxtSel: { color:C.accent, fontWeight:'600' },
  countRow:   { flexDirection:'row', alignItems:'center', gap:14 },
  cntBtn:     { width:34, height:34, borderRadius:17, borderWidth:2, borderColor:C.border, alignItems:'center', justifyContent:'center' },
  cntBtnTxt:  { fontSize:18, fontWeight:'700', color:C.text },
  cntNum:     { fontSize:22, fontWeight:'700', color:C.text, minWidth:28, textAlign:'center' },
  colorRow:   { flexDirection:'row', gap:10, flexWrap:'wrap' },
  swatch:     { width:26, height:26, borderRadius:13 },
  swatchSel:  { borderWidth:3, borderColor:'#fff' },
  chOpts:     { flexDirection:'row', gap:6 },
  chChip:     { flex:1, backgroundColor:C.bg, borderWidth:1, borderColor:C.border, borderRadius:10, padding:8, alignItems:'center' },
  chChipSel:  { backgroundColor:'rgba(251,191,36,.12)', borderColor:C.gold },
  chChipTxt:  { fontSize:12, color:C.muted },
  chChipTxtSel:{ color:C.gold, fontWeight:'600' },
  btnPrimary: { backgroundColor:C.accent, borderRadius:12, paddingVertical:13, alignItems:'center', marginTop:8 },
  btnPrimaryTxt:{ color:'#fff', fontSize:15, fontWeight:'700' },
  settingsNote: { fontSize:11, color:C.muted, marginTop:6, lineHeight:16 },

  // challenges
  chCard: { backgroundColor:C.surface, borderWidth:1, borderColor:C.border, borderRadius:14, padding:14, marginBottom:10 },
  chHdr:  { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10, gap:10 },
  chName: { fontSize:14, fontWeight:'600', color:C.text },
  chSub:  { fontSize:11, color:C.muted, marginTop:2 },
  chTag:  { backgroundColor:'rgba(240,160,80,.15)', borderWidth:1, borderColor:'rgba(240,160,80,.3)', borderRadius:99, paddingHorizontal:10, paddingVertical:3 },
  chTagDone:{ backgroundColor:'rgba(76,175,130,.15)', borderColor:'rgba(76,175,130,.3)' },
  chTagTxt: { fontSize:11, fontWeight:'700', color:C.gold },
  chTagTxtDone:{ color:C.success },
  chPills:{ flexDirection:'row', gap:5, marginBottom:8 },
  chPill: { flex:1, height:6, borderRadius:99, backgroundColor:C.border },
  chPillDone:{ backgroundColor:C.success },
  chPillActive:{ backgroundColor:C.accent },
  chProg: { fontSize:12, color:C.muted },

  // history
  hCard:  { backgroundColor:C.surface, borderWidth:1, borderColor:C.border, borderRadius:14, padding:14, marginBottom:12 },
  hTitle: { fontSize:11, fontWeight:'700', textTransform:'uppercase', letterSpacing:.8, color:C.muted, marginBottom:10 },
  hsRow:  { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:9, borderBottomWidth:1, borderBottomColor:C.border },
  hsDot:  { width:9, height:9, borderRadius:4.5 },
  hsName: { flex:1, fontSize:13 },
  hsNums: { flexDirection:'row', gap:12 },
  hsItem: { alignItems:'center' },
  hsN:    { fontSize:13, fontWeight:'700', color:C.accent2 },
  hsK:    { fontSize:9, color:C.muted, textTransform:'uppercase' },
});
