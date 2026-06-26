import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '@/components/ui/icon';

const API = 'https://functions.poehali.dev/1d68f812-2215-421d-945b-63c68fadee83';
const STORAGE_KEY = 'gmail_gen_accounts_v2';
const LIFETIME_MS = 40 * 60 * 1000; // 40 минут
const POLL_INTERVAL = 15000; // 15 секунд

interface Letter {
  id: string;
  from: { address: string; name: string };
  subject: string;
  intro: string;
  createdAt: string;
  seen: boolean;
}

interface Account {
  id: string;
  email: string;
  password: string;
  token: string;
  createdAt: number;
  inbox: Letter[];
}

const STORAGE_KEY_DOMAINS = 'mailtm_domains_cache';

async function fetchDomains(): Promise<string[]> {
  const cached = sessionStorage.getItem(STORAGE_KEY_DOMAINS);
  if (cached) return JSON.parse(cached);
  const r = await fetch(`${API}?action=domains`);
  const data = await r.json();
  const list = (data['hydra:member'] || []).map((d: { domain: string }) => d.domain);
  if (list.length) sessionStorage.setItem(STORAGE_KEY_DOMAINS, JSON.stringify(list));
  return list;
}

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function genUsername() {
  const adj = ['fast', 'dark', 'cool', 'grey', 'soft', 'wild', 'neo', 'air', 'ice', 'red'];
  const noun = ['wolf', 'fox', 'bird', 'oak', 'ray', 'pike', 'crow', 'elk', 'ant', 'fly'];
  const num = Math.floor(Math.random() * 9999);
  return `${adj[Math.floor(Math.random() * adj.length)]}${noun[Math.floor(Math.random() * noun.length)]}${num}`;
}

function fmtTime(ms: number) {
  if (ms <= 0) return '00:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  return `${Math.floor(m / 60)} ч назад`;
}

const copy = (text: string) => {
  try {
    navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
};

const Index = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [current, setCurrent] = useState<Account | null>(null);
  const [selected, setSelected] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Тик таймера каждую секунду
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Загрузка из localStorage
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const list: Account[] = JSON.parse(raw);
      const alive = list.filter((a) => Date.now() - a.createdAt < LIFETIME_MS);
      setAccounts(alive);
      if (alive.length !== list.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(alive));
    }
  }, []);

  const persist = (list: Account[]) => {
    setAccounts(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  const updateAccountInbox = useCallback((id: string, inbox: Letter[]) => {
    setAccounts((prev) => {
      const updated = prev.map((a) => a.id === id ? { ...a, inbox } : a);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    setCurrent((prev) => prev?.id === id ? { ...prev, inbox } : prev);
    setSelected((prev) => prev?.id === id ? { ...prev, inbox } : prev);
  }, []);

  // Поллинг писем для активного аккаунта
  const startPolling = useCallback((account: Account) => {
    if (pollRef.current) clearInterval(pollRef.current);
    const fetchMail = async () => {
      try {
        setPolling(true);
        const r = await fetch(`${API}?action=messages&token=${encodeURIComponent(account.token)}`);
        const data = await r.json();
        const letters: Letter[] = (data['hydra:member'] || []).map((m: {
          id: string;
          from: { address: string; name: string };
          subject: string;
          intro: string;
          createdAt: string;
          seen: boolean;
        }) => ({
          id: m.id,
          from: m.from,
          subject: m.subject,
          intro: m.intro,
          createdAt: m.createdAt,
          seen: m.seen,
        }));
        updateAccountInbox(account.id, letters);
      } catch {
        // тихо
      } finally {
        setPolling(false);
      }
    };
    fetchMail();
    pollRef.current = setInterval(fetchMail, POLL_INTERVAL);
  }, [updateAccountInbox]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const domains = await fetchDomains();
      if (!domains.length) throw new Error('Нет доступных доменов');
      const domain = domains[0];
      const username = genUsername();
      const address = `${username}@${domain}`;
      const password = genPassword();

      const r = await fetch(`${API}?action=create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password }),
      });
      const data = await r.json();
      if (!data.token) throw new Error(data['hydra:description'] || 'Ошибка создания ящика');

      const account: Account = {
        id: data.account.id,
        email: address,
        password,
        token: data.token,
        createdAt: Date.now(),
        inbox: [],
      };

      persist([account, ...accounts]);
      setCurrent(account);
      setSelected(null);
      setShowPass(false);
      startPolling(account);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось создать ящик');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (a: Account) => {
    setSelected(a);
    setCurrent(null);
    setShowPass(false);
    startPolling(a);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = (id: string) => {
    persist(accounts.filter((a) => a.id !== id));
    if (selected?.id === id) setSelected(null);
    if (current?.id === id) setCurrent(null);
  };

  const doCopy = (text: string, tag: string) => {
    copy(text);
    setCopied(tag);
    setTimeout(() => setCopied(null), 1400);
  };

  const view = selected || current;
  const isSaved = current && accounts.some((a) => a.id === current.id);
  const remaining = view ? Math.max(0, LIFETIME_MS - (now - view.createdAt)) : 0;
  const isExpired = view ? remaining === 0 : false;
  const timerPct = view ? (remaining / LIFETIME_MS) * 100 : 100;

  return (
    <div className="min-h-screen grain">
      <div className="mx-auto max-w-2xl px-5 py-12 sm:py-20">

        {/* Header */}
        <header className="mb-12 animate-fade-in">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-foreground text-background">
              <Icon name="Mail" size={18} />
            </div>
            <span className="font-semibold tracking-tight">MailForge</span>
          </div>
          <h1 className="text-[2.6rem] sm:text-5xl font-black leading-[1.05] tracking-tight">
            Временная<br />
            <span className="text-accent">почта на 40 мин</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-md">
            Реальный почтовый ящик — письма приходят по-настоящему. Ящик живёт 40 минут, данные хранятся только в браузере.
          </p>
        </header>

        {/* Generate button */}
        <button
          onClick={generate}
          disabled={loading}
          className="group w-full rounded-2xl bg-foreground py-5 text-background font-semibold text-lg transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
        >
          <span className="inline-flex items-center gap-2.5">
            {loading
              ? <><Icon name="Loader2" size={20} className="animate-spin" /> Создаём ящик...</>
              : <><Icon name="Sparkles" size={20} className="transition-transform group-hover:rotate-12" /> Создать новый ящик</>
            }
          </span>
        </button>

        {error && (
          <div className="mt-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <Icon name="AlertCircle" size={16} /> {error}
          </div>
        )}

        {/* Active mailbox */}
        {view && (
          <div key={view.id} className="mt-6 animate-scale-in rounded-3xl border border-border bg-card p-6 shadow-[0_8px_40px_-12px_hsl(220_18%_14%/0.12)]">

            {/* Timer */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {isExpired ? 'Ящик истёк' : 'Осталось'}
                </span>
                <span className={`font-mono text-sm font-semibold ${isExpired ? 'text-destructive' : remaining < 5 * 60000 ? 'text-destructive' : 'text-foreground'}`}>
                  {isExpired ? '—' : fmtTime(remaining)}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${isExpired ? 'bg-destructive' : timerPct < 20 ? 'bg-destructive' : 'bg-accent'}`}
                  style={{ width: `${timerPct}%` }}
                />
              </div>
            </div>

            {/* Email */}
            <div className="mb-3">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Адрес</label>
              <div className="mt-1.5 flex items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-3.5">
                <span className="font-mono text-sm sm:text-base truncate">{view.email}</span>
                <button onClick={() => doCopy(view.email, 'email')} className="shrink-0 text-muted-foreground transition-colors hover:text-accent">
                  <Icon name={copied === 'email' ? 'Check' : 'Copy'} size={18} />
                </button>
              </div>
            </div>

            {/* Password */}
            <div className="mb-5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Пароль</label>
              <div className="mt-1.5 flex items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-3.5">
                <span className="font-mono text-sm sm:text-base truncate">
                  {showPass ? view.password : '•'.repeat(view.password.length)}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <button onClick={() => setShowPass((v) => !v)} className="text-muted-foreground transition-colors hover:text-accent">
                    <Icon name={showPass ? 'EyeOff' : 'Eye'} size={18} />
                  </button>
                  <button onClick={() => doCopy(view.password, 'pass')} className="text-muted-foreground transition-colors hover:text-accent">
                    <Icon name={copied === 'pass' ? 'Check' : 'Copy'} size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Inbox */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Icon name="Inbox" size={16} className="text-accent" />
                <span className="text-sm font-semibold">Входящие</span>
                {polling && <Icon name="RefreshCw" size={12} className="animate-spin text-muted-foreground" />}
                <span className="ml-auto text-xs text-muted-foreground">
                  {view.inbox.length ? `${view.inbox.length} писем` : 'ждём письма...'}
                </span>
              </div>

              {view.inbox.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border py-8 text-center">
                  <Icon name="MailOpen" size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Используйте этот адрес для регистрации</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Письма появятся автоматически</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {view.inbox.map((l) => (
                    <div key={l.id} className="flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-secondary">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent text-sm font-bold">
                        {(l.from.name || l.from.address)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{l.from.name || l.from.address}</span>
                          {!l.seen && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">{timeAgo(l.createdAt)}</span>
                        </div>
                        <p className="truncate text-sm text-foreground/80">{l.subject}</p>
                        <p className="truncate text-xs text-muted-foreground">{l.intro}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Saved accounts */}
        <section className="mt-12">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="Database" size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Мои ящики
            </h2>
            <span className="ml-auto grid h-6 min-w-6 place-items-center rounded-full bg-secondary px-2 text-xs font-semibold">
              {accounts.length}
            </span>
          </div>

          {accounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              Создайте первый временный ящик
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => {
                const rem = Math.max(0, LIFETIME_MS - (now - a.createdAt));
                const expired = rem === 0;
                const active = (selected?.id ?? current?.id) === a.id;
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                      active ? 'border-accent bg-accent/5' : 'border-border hover:bg-secondary'
                    }`}
                  >
                    <button onClick={() => handleSelect(a)} className="min-w-0 flex-1 text-left">
                      <div className={`truncate font-mono text-sm ${expired ? 'line-through text-muted-foreground' : ''}`}>
                        {a.email}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        {expired
                          ? <><Icon name="Clock" size={11} /><span className="text-destructive">Истёк</span></>
                          : <><Icon name="Clock" size={11} />{fmtTime(rem)}</>
                        }
                        {a.inbox.length > 0 && (
                          <><span>·</span><Icon name="Mail" size={11} />{a.inbox.length}</>
                        )}
                      </div>
                    </button>
                    <button onClick={() => doCopy(a.email, `e-${a.id}`)} className="text-muted-foreground transition-colors hover:text-accent">
                      <Icon name={copied === `e-${a.id}` ? 'Check' : 'Copy'} size={16} />
                    </button>
                    <button onClick={() => remove(a.id)} className="text-muted-foreground transition-colors hover:text-destructive">
                      <Icon name="Trash2" size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <footer className="mt-16 text-center text-xs text-muted-foreground">
          Данные хранятся только в вашем браузере · Письма обновляются каждые 15 сек
        </footer>
      </div>
    </div>
  );
};

export default Index;
