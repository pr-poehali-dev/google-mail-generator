import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';

interface Letter {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
}

interface Account {
  id: string;
  email: string;
  password: string;
  createdAt: string;
  inbox: Letter[];
}

const FIRST = ['alex', 'maria', 'nikita', 'sergey', 'anna', 'dmitry', 'olga', 'pavel', 'kate', 'leo', 'mark', 'vera', 'roman', 'ivan', 'sofia'];
const LAST = ['volkov', 'orlov', 'smirn', 'petrov', 'sokol', 'frost', 'novak', 'belov', 'morozov', 'lebed', 'zorin', 'krylov'];

const SENDERS = [
  { s: 'Google', subj: 'Подтвердите ваш аккаунт', p: 'Завершите настройку нового аккаунта Google.' },
  { s: 'YouTube', subj: 'Добро пожаловать на YouTube', p: 'Начните смотреть любимые каналы прямо сейчас.' },
  { s: 'Netflix', subj: 'Ваша подписка активна', p: 'Приятного просмотра! Откройте для себя новинки.' },
  { s: 'GitHub', subj: 'Verify your email', p: 'Please verify your email address to continue.' },
  { s: 'Spotify', subj: 'Ваш плейлист недели готов', p: 'Мы собрали 30 новых треков специально для вас.' },
  { s: 'Telegram', subj: 'Код для входа: 84021', p: 'Никому не сообщайте этот код подтверждения.' },
];

const rnd = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

function genEmail() {
  const sep = rnd(['', '.', '_']);
  const num = Math.random() > 0.4 ? Math.floor(Math.random() * 9999) : '';
  return `${rnd(FIRST)}${sep}${rnd(LAST)}${num}@gmail.com`;
}

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function genInbox(): Letter[] {
  const count = 2 + Math.floor(Math.random() * 3);
  return Array.from({ length: count }, (_, i) => {
    const m = rnd(SENDERS);
    return {
      id: crypto.randomUUID(),
      sender: m.s,
      subject: m.subj,
      preview: m.p,
      time: `${Math.floor(Math.random() * 12) + 1}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      unread: i < 2,
    };
  });
}

const STORAGE_KEY = 'gmail_gen_accounts';

const Index = () => {
  const [current, setCurrent] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [selected, setSelected] = useState<Account | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setAccounts(JSON.parse(raw));
  }, []);

  const persist = (list: Account[]) => {
    setAccounts(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  const generate = () => {
    setCurrent({
      id: crypto.randomUUID(),
      email: genEmail(),
      password: genPassword(),
      createdAt: new Date().toISOString(),
      inbox: genInbox(),
    });
    setShowPass(false);
    setSelected(null);
  };

  const save = () => {
    if (!current) return;
    if (accounts.some((a) => a.email === current.email)) return;
    persist([current, ...accounts]);
  };

  const remove = (id: string) => {
    persist(accounts.filter((a) => a.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const copy = (text: string, tag: string) => {
    navigator.clipboard.writeText(text);
    setCopied(tag);
    setTimeout(() => setCopied(null), 1400);
  };

  const isSaved = current && accounts.some((a) => a.email === current.email);
  const view = selected || current;

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
            Генератор<br />
            <span className="text-accent">Gmail-адресов</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-md">
            Создавайте адреса с паролем, смотрите входящие и храните аккаунты локально в браузере.
          </p>
        </header>

        {/* Generate button */}
        <button
          onClick={generate}
          className="group w-full rounded-2xl bg-foreground py-5 text-background font-semibold text-lg transition-all hover:opacity-90 active:scale-[0.99]"
        >
          <span className="inline-flex items-center gap-2.5">
            <Icon name="Sparkles" size={20} className="transition-transform group-hover:rotate-12" />
            Сгенерировать почту
          </span>
        </button>

        {/* Generated card */}
        {view && (
          <div key={view.id} className="mt-6 animate-scale-in rounded-3xl border border-border bg-card p-6 shadow-[0_8px_40px_-12px_hsl(220_18%_14%/0.12)]">
            {selected && (
              <div className="mb-4 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Icon name="Archive" size={14} />
                Сохранённый аккаунт
              </div>
            )}

            {/* Email */}
            <div className="mb-3">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Адрес</label>
              <div className="mt-1.5 flex items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-3.5">
                <span className="font-mono text-sm sm:text-base truncate">{view.email}</span>
                <button onClick={() => copy(view.email, 'email')} className="shrink-0 text-muted-foreground transition-colors hover:text-accent">
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
                  <button onClick={() => copy(view.password, 'pass')} className="text-muted-foreground transition-colors hover:text-accent">
                    <Icon name={copied === 'pass' ? 'Check' : 'Copy'} size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Save / new */}
            {!selected && (
              <button
                onClick={save}
                disabled={!!isSaved}
                className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 font-medium transition-colors hover:bg-secondary disabled:opacity-60"
              >
                <Icon name={isSaved ? 'Check' : 'Bookmark'} size={17} />
                {isSaved ? 'Сохранено' : 'Сохранить аккаунт'}
              </button>
            )}

            {/* Inbox */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Icon name="Inbox" size={16} className="text-accent" />
                <span className="text-sm font-semibold">Входящие</span>
                <span className="ml-auto text-xs text-muted-foreground">{view.inbox.length} писем</span>
              </div>
              <div className="space-y-2">
                {view.inbox.map((l) => (
                  <div key={l.id} className="flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-secondary">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent text-sm font-bold">
                      {l.sender[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{l.sender}</span>
                        {l.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{l.time}</span>
                      </div>
                      <p className="truncate text-sm text-foreground/80">{l.subject}</p>
                      <p className="truncate text-xs text-muted-foreground">{l.preview}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Saved accounts */}
        <section className="mt-12">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="Database" size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Сохранённые аккаунты
            </h2>
            <span className="ml-auto grid h-6 min-w-6 place-items-center rounded-full bg-secondary px-2 text-xs font-semibold">
              {accounts.length}
            </span>
          </div>

          {accounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              Пока пусто — сгенерируйте и сохраните первый аккаунт
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    selected?.id === a.id ? 'border-accent bg-accent/5' : 'border-border hover:bg-secondary'
                  }`}
                >
                  <button onClick={() => { setSelected(a); setShowPass(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="min-w-0 flex-1 text-left">
                    <div className="truncate font-mono text-sm">{a.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                    </div>
                  </button>
                  <button onClick={() => copy(a.email, `e-${a.id}`)} className="text-muted-foreground transition-colors hover:text-accent">
                    <Icon name={copied === `e-${a.id}` ? 'Check' : 'Copy'} size={16} />
                  </button>
                  <button onClick={() => remove(a.id)} className="text-muted-foreground transition-colors hover:text-destructive">
                    <Icon name="Trash2" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-16 text-center text-xs text-muted-foreground">
          Данные хранятся только в вашем браузере
        </footer>
      </div>
    </div>
  );
};

export default Index;
