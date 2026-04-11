// Deployment Timestamp: 2026-04-11T03:55:00Z
import * as React from 'react';
import { useState, useEffect, Component } from 'react';
import { 
  Home, CheckCircle2, Inbox, Layout, Search, MessageSquare, Plus, Target, Menu, X, ChevronRight, 
  Bell, Settings, User, PlusCircle, Users, MoreVertical, Trash2, Calendar, Flag, AlertTriangle,
  Clock, CheckCircle, Briefcase, ChevronLeft, Filter, LogOut, LogIn, Sun, Moon, MessageCircle, Mail, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import { auth, db } from './firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, updateDoc, deleteDoc, getDoc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { signInWithRedirect, signInWithPopup, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, signOut, sendPasswordResetEmail, User as FirebaseUser } from 'firebase/auth';

type Task = {
  id: string; title: string; completed: boolean; project: string; dueDate?: string;
  dueTime?: string; reminderTime?: string; priority: 'Baja' | 'Media' | 'Alta'; status: 'Todo' | 'InProgress' | 'Done'; assigneeId?: string;
};
type ProjectMemberPermission = 'add_tasks' | 'delete_tasks' | 'edit_dates' | 'edit_names';
type ProjectMember = { id: string; name: string; email: string; photoUrl: string; role: string; permissions: ProjectMemberPermission[]; };
type Goal = { id: string; title: string; progress: number; category: string; };
type ProjectStatus = 'Pendiente' | 'Activo' | 'Finalizado';
type Milestone = { id: string; title: string; dueDate: string; completed: boolean; };
type Project = { id: string; name: string; status: ProjectStatus; avisoId?: string; milestones: Milestone[]; description: string; tasks: string[]; members: ProjectMember[]; };
type View = 'Home' | 'MyTasks' | 'Inbox' | 'Goals' | 'Projects' | 'Portfolios' | 'Team' | 'Dashboard';
type MyTasksSubView = 'List' | 'Board' | 'Calendar';
type Notification = { id: string; title: string; message: string; time: string; read: boolean; type: 'task_added' | 'task_completed' | 'task_deleted' | 'status_changed'; };
type NotifSettings = { email: boolean; whatsapp: boolean; dailyEmailTime: string; dailyTaskTime: string; };
type UserProfile = { name: string; lastName?: string; email: string; photoUrl: string; role: string; phone?: string; teamId?: string; };
type AppConfig = { theme: 'light' | 'dark'; language: 'es' | 'en'; compactView: boolean; };
type Portfolio = { id: string; name: string; projectIds: string[]; userId: string; };
type ProjectStatusSemaphore = 'Red' | 'Yellow' | 'Green';

const BoardCard = ({ task, onStatusChange, onDelete, onAssign, teamMembers, currentUserId, currentUserName }: {
  task: Task; onStatusChange: (id: string, status: Task['status']) => void; onDelete: (id: string) => void;
  onAssign: (id: string, assigneeId: string) => void; teamMembers: ProjectMember[]; currentUserId?: string; currentUserName?: string; key?: string;
}) => (
  <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
    className={`p-4 rounded-lg border shadow-sm hover:shadow-md transition-all group ${document.documentElement.classList.contains('dark') ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
    <div className="flex justify-between items-start mb-2">
      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${document.documentElement.classList.contains('dark') ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{task.project}</span>
      <div className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${task.priority === 'Alta' ? 'bg-rose-500' : task.priority === 'Media' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        <button onClick={() => onDelete(task.id)} className="p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12} /></button>
      </div>
    </div>
    <h4 className={`text-sm font-semibold mb-3 ${task.completed ? 'text-slate-400 line-through' : (document.documentElement.classList.contains('dark') ? 'text-slate-200' : 'text-slate-800')}`}>{task.title}</h4>
    <div className="flex items-center justify-between mt-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1 text-[10px] text-slate-400"><Calendar size={10} />{task.dueDate}</div>
        <div className="flex items-center gap-1">
          <User size={10} className="text-slate-400" />
          <select value={task.assigneeId || ''} onChange={(e) => onAssign(task.id, e.target.value)}
            className={`text-[10px] font-bold bg-transparent outline-none hover:text-indigo-600 cursor-pointer ${document.documentElement.classList.contains('dark') ? 'text-slate-400' : 'text-slate-500'}`}>
            <option value="">Sin asignar</option>
            {currentUserId && <option value={currentUserId}>{currentUserName || 'Tú'}</option>}
            {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <select value={task.status} onChange={(e) => onStatusChange(task.id, e.target.value as Task['status'])}
        className={`text-[10px] font-bold border-none rounded px-1 py-0.5 outline-none cursor-pointer ${document.documentElement.classList.contains('dark') ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
        <option value="Todo">Por hacer</option>
        <option value="InProgress">En progreso</option>
        <option value="Done">Completado</option>
      </select>
    </div>
  </motion.div>
);

const Logo = ({ size = 32, className = "" }: { size?: number; className?: string }) => (
  <div className={`relative flex items-center justify-center ${className}`} style={{ width: size * 2, height: size * 2 }}>
    <div className="absolute inset-0 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100 transform rotate-6"></div>
    <div className="absolute inset-0 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-100 transform -rotate-3 opacity-80"></div>
    <div className="relative z-10 flex items-center justify-center bg-white rounded-xl p-2 shadow-sm"><Target size={size} className="text-indigo-600" /></div>
  </div>
);

const LoadingSpinner = () => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6">
    <Logo size={40} className="animate-bounce" />
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full" />
    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">Cargando Tus Metas...</p>
  </div>
);

const LoginScreen = ({ authEmail, setAuthEmail, authPassword, setAuthPassword, handleEmailAuth, handleLogin, handleResetPassword, isRegistering, setIsRegistering, authError, isActionLoading, isAuthLoading }: any) => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200 p-10 text-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-50 rounded-full -ml-12 -mb-12 opacity-50"></div>
      {isAuthLoading && (
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-100 overflow-hidden">
          <motion.div animate={{ x: ['-100%', '100%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="w-1/3 h-full bg-indigo-600" />
        </div>
      )}
      <Logo size={32} className="mx-auto mb-8" />
      <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">TUS-METAS.</h1>
      <p className="text-slate-500 mb-10 text-sm">Gestiona tus proyectos y alcanza tus objetivos de forma profesional.</p>
      <form onSubmit={handleEmailAuth} className="space-y-4 mb-6 text-left">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Email</label>
          <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="tu@email.com"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50" required disabled={isActionLoading} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Contraseña</label>
          <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="••••••••"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50" required disabled={isActionLoading} />
          {!isRegistering && (
            <div className="flex justify-end mt-1">
              <button type="button" onClick={handleResetPassword} className="text-[10px] font-bold text-indigo-600 hover:underline">¿Olvidaste tu contraseña?</button>
            </div>
          )}
        </div>
        {authError && (
          <div className="p-3 bg-rose-50 text-rose-600 text-xs rounded-lg border border-rose-100 flex items-center gap-2">
            <AlertTriangle size={14} />{authError}
          </div>
        )}
        <button type="submit" disabled={isActionLoading}
          className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {isActionLoading && <Clock size={18} className="animate-spin" />}
          {isRegistering ? 'CREAR MI CUENTA AHORA' : 'ENTRAR A MI PANEL'}
        </button>
        <button type="button" onClick={() => setIsRegistering(!isRegistering)} disabled={isActionLoading}
          className="w-full py-3 text-sm text-indigo-600 font-bold hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100">
          {isRegistering ? '← Volver a Iniciar Sesión' : '¿No tienes cuenta? REGÍSTRATE AQUÍ'}
        </button>
      </form>
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
        <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">O también</span></div>
      </div>
      <button onClick={handleLogin} disabled={isActionLoading}
        className="w-full py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 group disabled:opacity-70 disabled:cursor-not-allowed">
        <div className="bg-slate-100 p-1 rounded-full group-hover:scale-110 transition-transform">
          {isActionLoading ? <Clock size={18} className="animate-spin text-slate-600" /> : <LogIn size={18} className="text-slate-600" />}
        </div>
        Continuar con Google
      </button>
      <p className="mt-8 text-[10px] text-slate-400">Al iniciar sesión, aceptas nuestros términos de servicio y política de privacidad.</p>
      <div className="mt-6 pt-6 border-t border-slate-100 text-left">
        <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Estado del Sistema</p>
        <div className="space-y-1">
          <div className="flex justify-between text-[9px]"><span className="text-slate-500">Proyecto:</span><span className="text-slate-900 font-mono">circular-fusion-407818</span></div>
          <div className="flex justify-between text-[9px]"><span className="text-slate-500">Auth Domain:</span><span className="text-slate-900 font-mono">circular-fusion-407818.firebaseapp.com</span></div>
          <div className="flex justify-between text-[9px]"><span className="text-slate-500">URL Actual:</span><span className="text-slate-900 font-mono">{window.location.hostname}</span></div>
        </div>
        {authError?.includes('unauthorized-domain') && (
          <div className="mt-3 p-2 bg-amber-50 border border-amber-100 rounded text-[9px] text-amber-700 leading-tight">
            <strong>Acción requerida:</strong> Ve a tu Consola de Firebase &gt; Authentication &gt; Settings &gt; Authorized Domains y añade <strong>{window.location.hostname}</strong> a la lista.
          </div>
        )}
      </div>
    </motion.div>
  </div>
);

class ErrorBoundary extends Component<any, any> {
  constructor(props: any) { super(props); (this as any).state = { hasError: false, errorInfo: '' }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, errorInfo: error.message || String(error) }; }
  componentDidCatch(error: any, errorInfo: any) { console.error("ErrorBoundary caught an error", error, errorInfo); }
  render() {
    const self = this as any;
    if (self.state.hasError) {
      let displayMessage = "Algo salió mal. Por favor, intenta recargar la página.";
      try { const parsed = JSON.parse(self.state.errorInfo); if (parsed.error) displayMessage = `Error de base de datos: ${parsed.error}`; } catch (e) { if (self.state.errorInfo) displayMessage = self.state.errorInfo; }
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6"><AlertTriangle size={32} /></div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">¡Ups! Ocurrió un error</h2>
            <p className="text-slate-600 mb-6 text-sm">{displayMessage}</p>
            <button onClick={() => window.location.reload()} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">Recargar aplicación</button>
          </div>
        </div>
      );
    }
    return self.props.children;
  }
}

const Pomodoro = () => {
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'work' | 'break'>('work');
  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      interval = setInterval(() => {
        if (seconds > 0) { setSeconds(seconds - 1); }
        else if (minutes > 0) { setMinutes(minutes - 1); setSeconds(59); }
        else {
          setIsActive(false);
          if (mode === 'work') { setMode('break'); setMinutes(5); } else { setMode('work'); setMinutes(25); }
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(mode === 'work' ? '¡Tiempo de descanso!' : '¡A trabajar!');
        }
      }, 1000);
    } else { clearInterval(interval); }
    return () => clearInterval(interval);
  }, [isActive, seconds, minutes, mode]);
  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => { setIsActive(false); setMinutes(mode === 'work' ? 25 : 5); setSeconds(0); };
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center group hover:border-indigo-500 transition-all">
      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all"><Clock size={24} /></div>
      <h3 className="font-bold text-slate-800 mb-1">Pomodoro</h3>
      <p className="text-xs text-slate-500 mb-4">{mode === 'work' ? 'Enfoque' : 'Descanso'}</p>
      <div className="text-3xl font-black text-indigo-600 mb-4 tabular-nums">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</div>
      <div className="flex gap-2 w-full">
        <button onClick={toggleTimer} className={`flex-grow py-2 ${isActive ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'} text-xs font-bold rounded-lg border border-slate-100`}>{isActive ? 'Pausar' : 'Empezar'}</button>
        <button onClick={resetTimer} className="px-3 py-2 bg-slate-50 text-slate-400 text-xs font-bold rounded-lg border border-slate-100 hover:text-slate-600"><X size={14} /></button>
      </div>
    </div>
  );
};

const Dashboard = ({ tasks, projects, goals }: { tasks: Task[]; projects: Project[]; goals: Goal[] }) => {
  const priorityData = [
    { name: 'Alta', value: tasks.filter(t => t.priority === 'Alta').length, color: '#f43f5e' },
    { name: 'Media', value: tasks.filter(t => t.priority === 'Media').length, color: '#f59e0b' },
    { name: 'Baja', value: tasks.filter(t => t.priority === 'Baja').length, color: '#10b981' },
  ];
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    return { date: dateStr.split('-').slice(1).join('/'), completed: tasks.filter(t => t.completed && t.dueDate === dateStr).length };
  });
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Tareas</p><p className="text-3xl font-black text-slate-900 dark:text-slate-100">{tasks.length}</p></div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Completadas</p><p className="text-3xl font-black text-emerald-600">{tasks.filter(t => t.completed).length}</p></div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Proyectos</p><p className="text-3xl font-black text-indigo-600">{projects.length}</p></div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Objetivos</p><p className="text-3xl font-black text-amber-600">{goals.length}</p></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-6 uppercase tracking-wider">Actividad (Últimos 7 días)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last7Days}>
                <defs><linearGradient id="colorComp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="completed" stroke="#10b981" fillOpacity={1} fill="url(#colorComp)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-6 uppercase tracking-wider">Distribución por Prioridad</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={priorityData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {priorityData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {priorityData.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-[10px] font-bold text-slate-500 uppercase">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePosition, setInvitePosition] = useState('');
  const [inviteRole, setInviteRole] = useState('Miembro');
  const [isInviteSuccessOpen, setIsInviteSuccessOpen] = useState(false);
  const [lastInvited, setLastInvited] = useState<{name: string; email: string} | null>(null);

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<View>('Home');
  const [myTasksSubView, setMyTasksSubView] = useState<MyTasksSubView>('List');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projectTaskFilter, setProjectTaskFilter] = useState({ search: '', date: '', assignee: '', priority: '' });
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: '', lastName: '', email: '', photoUrl: 'https://picsum.photos/seed/user/200/200', role: 'Administrador', phone: '' });
  const [appConfig, setAppConfig] = useState<AppConfig>({ theme: 'light', language: 'es', compactView: false });
  const [notifSettings, setNotifSettings] = useState<NotifSettings>({ email: true, whatsapp: false, dailyEmailTime: '08:00', dailyTaskTime: '09:00' });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<string | null>(null);
  const [isAddingProjectToPortfolio, setIsAddingProjectToPortfolio] = useState(false);

  enum OperationType { CREATE = 'create', UPDATE = 'update', DELETE = 'delete', LIST = 'list', GET = 'get', WRITE = 'write' }

  interface FirestoreErrorInfo {
    error: string; operationType: OperationType; path: string | null;
    authInfo: { userId: string | undefined; email: string | null | undefined; emailVerified: boolean | undefined; isAnonymous: boolean | undefined; tenantId: string | null | undefined; providerInfo: { providerId: string; displayName: string | null; email: string | null; photoUrl: string | null; }[]; }
  }

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: { userId: auth.currentUser?.uid, email: auth.currentUser?.email, emailVerified: auth.currentUser?.emailVerified, isAnonymous: auth.currentUser?.isAnonymous, tenantId: auth.currentUser?.tenantId, providerInfo: auth.currentUser?.providerData.map(provider => ({ providerId: provider.providerId, displayName: provider.displayName, email: provider.email, photoUrl: provider.photoURL })) || [] },
      operationType, path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  };

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskProject, setNewTaskProject] = useState('General');
  const [newTaskPriority, setNewTaskPriority] = useState<'Baja' | 'Media' | 'Alta'>('Media');
  const [newTaskDueDate, setNewTaskDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTaskDueTime, setNewTaskDueTime] = useState('12:00');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectMilestones, setNewProjectMilestones] = useState<{title: string; dueDate: string}[]>([]);
  const [newTaskReminder, setNewTaskReminder] = useState('');
  const [teamMembers, setTeamMembers] = useState<ProjectMember[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState('Personal');
  const [isAddingMemberToProject, setIsAddingMemberToProject] = useState<string | null>(null);

  const deleteProject = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'projects', id));
      addNotification('Proyecto eliminado', 'Se eliminó el proyecto correctamente', 'task_deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
    }
  };

  const createProject = async () => {
    if (!user || !teamId || !newProjectName.trim()) return;
    const newProject = {
      name: newProjectName, description: newProjectDescription, status: 'Activo', userId: user.uid, teamId: teamId, createdAt: serverTimestamp(),
      members: [{ id: user.uid, name: `${userProfile.name || ''} ${userProfile.lastName || ''}`.trim() || user.displayName || 'Tú', email: user.email, photoUrl: userProfile.photoUrl || user.photoURL || 'https://picsum.photos/seed/user/200/200', role: 'Administrador', permissions: ['add_tasks', 'delete_tasks', 'edit_dates', 'edit_names'] }],
      milestones: newProjectMilestones.map((m, index) => ({ id: `m-${Date.now()}-${index}`, title: m.title, dueDate: m.dueDate, completed: false })),
      tasks: []
    };
    try {
      await addDoc(collection(db, 'projects'), newProject);
      addNotification('Proyecto Creado', `${userProfile.name || user.displayName || 'Usuario'} ha creado el proyecto "${newProjectName}"`, 'status_changed');
      setIsProjectModalOpen(false); setNewProjectName(''); setNewProjectDescription(''); setNewProjectMilestones([]);
      setActiveView('Projects'); setSelectedProject(newProjectName);
    } catch (error) { handleFirestoreError(error, OperationType.CREATE, 'projects'); }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => { if (isAuthLoading) { setIsAuthLoading(false); } }, 8000);
    const isPending = sessionStorage.getItem('pendingGoogleAuth') === 'true';
    if (isPending) setIsAuthLoading(true);
    getRedirectResult(auth).then((result) => {
      sessionStorage.removeItem('pendingGoogleAuth');
      if (result?.user) { setUser(result.user); }
      setIsAuthLoading(false); clearTimeout(timeoutId);
    }).catch((error) => {
      sessionStorage.removeItem('pendingGoogleAuth');
      let msg = `Error de Redirección (${error.code}): `;
      if (error.code === 'auth/unauthorized-domain') msg = "¡DOMINIO NO AUTORIZADO! Debes añadir el dominio actual en la Consola de Firebase > Authentication > Settings > Authorized Domains.";
      else if (error.code === 'auth/popup-closed-by-user') msg = "";
      else msg += error.message;
      if (msg) setAuthError(msg);
      setIsAuthLoading(false); clearTimeout(timeoutId);
    });
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) sessionStorage.removeItem('pendingGoogleAuth');
      setIsAuthLoading(false); clearTimeout(timeoutId);
    });
    return () => { unsubscribe(); clearTimeout(timeoutId); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchOrCreateProfile = async () => {
      if (!user) return;
      const userDocRef = doc(db, 'users', user.uid);
      try {
        const userDoc = await getDoc(userDocRef);
        let profileData: UserProfile;
        if (userDoc.exists()) {
          const data = userDoc.data();
          profileData = { name: data.name || user.displayName || 'Usuario', lastName: data.lastName || '', email: data.email || user.email || '', photoUrl: data.photoUrl || user.photoURL || 'https://picsum.photos/seed/user/200/200', role: data.role || 'Administrador', phone: data.phone || '', teamId: data.teamId || null } as any;
        } else {
          profileData = { name: user.displayName || 'Usuario', lastName: '', email: user.email || '', photoUrl: user.photoURL || 'https://picsum.photos/seed/user/200/200', role: 'Administrador', phone: '', teamId: user.uid };
          await setDoc(userDocRef, { ...profileData, theme: 'light', language: 'es', compactView: false, notifEmail: true, notifWhatsapp: false, createdAt: serverTimestamp() });
        }
        setUserProfile(profileData);
        setAppConfig({ theme: (profileData as any).theme || 'light', language: (profileData as any).language || 'es', compactView: (profileData as any).compactView || false });
        setNotifSettings({ email: (profileData as any).notifEmail ?? true, whatsapp: (profileData as any).notifWhatsapp ?? false, dailyEmailTime: '08:00', dailyTaskTime: '09:00' });
        let currentTeamId = profileData.teamId;
        if (!currentTeamId) {
          const teamQ = query(collection(db, 'team'), where('email', '==', user.email));
          const teamSnapshot = await getDocs(teamQ);
          if (!teamSnapshot.empty) { const teamDoc = teamSnapshot.docs[0].data(); currentTeamId = teamDoc.teamId || teamDoc.invitedBy || user.uid; if (teamDoc.role) profileData.role = teamDoc.role; }
          else currentTeamId = user.uid;
          await updateDoc(userDocRef, { teamId: currentTeamId, role: profileData.role || 'Administrador' });
          profileData.teamId = currentTeamId; setUserProfile({ ...profileData });
        }
        setTeamId(currentTeamId);
      } catch (error) { console.error('Firestore: Error fetching/creating profile', error); }
    };
    fetchOrCreateProfile();
  }, [user]);

  useEffect(() => {
    if (!user || !teamId) return;
    const q = query(collection(db, 'notifications'), where('teamId', '==', teamId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notification[];
      setNotifications(notifs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
    }, (error) => { handleFirestoreError(error, OperationType.LIST, 'notifications'); });
    return () => unsubscribe();
  }, [user, teamId]);

  useEffect(() => {
    if (!user || !teamId) { setTasks([]); return; }
    const q = query(collection(db, 'tasks'), where('teamId', '==', teamId));
    const unsubscribe = onSnapshot(q, (snapshot) => { setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[]); }, (error) => { handleFirestoreError(error, OperationType.LIST, 'tasks'); });
    return () => unsubscribe();
  }, [user, teamId]);

  useEffect(() => {
    if (!user || !teamId) { setGoals([]); return; }
    const q = query(collection(db, 'goals'), where('teamId', '==', teamId));
    const unsubscribe = onSnapshot(q, (snapshot) => { setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Goal[]); }, (error) => { handleFirestoreError(error, OperationType.LIST, 'goals'); });
    return () => unsubscribe();
  }, [user, teamId]);

  useEffect(() => {
    if (!user || !teamId) { setProjects([]); return; }
    const q = query(collection(db, 'projects'), where('teamId', '==', teamId));
    const unsubscribe = onSnapshot(q, (snapshot) => { setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[]); }, (error) => { handleFirestoreError(error, OperationType.LIST, 'projects'); });
    return () => unsubscribe();
  }, [user, teamId]);

  useEffect(() => {
    if (!user || !teamId) { setPortfolios([]); return; }
    const q = query(collection(db, 'portfolios'), where('teamId', '==', teamId));
    const unsubscribe = onSnapshot(q, (snapshot) => { setPortfolios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Portfolio[]); }, (error) => { handleFirestoreError(error, OperationType.LIST, 'portfolios'); });
    return () => unsubscribe();
  }, [user, teamId]);

  useEffect(() => {
    if (!user || !teamId) { setTeamMembers([]); setAdminProfile(null); return; }
    if (teamId !== user.uid) { getDoc(doc(db, 'users', teamId)).then(docSnap => { if (docSnap.exists()) setAdminProfile({ id: docSnap.id, ...docSnap.data() }); }).catch(err => console.error('Error fetching admin profile:', err)); }
    else setAdminProfile(null);
    const q = query(collection(db, 'team'), where('teamId', '==', teamId));
    const unsubscribe = onSnapshot(q, (snapshot) => { setTeamMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[]); }, (error) => { handleFirestoreError(error, OperationType.LIST, 'team'); });
    return () => unsubscribe();
  }, [user, teamId]);

  useEffect(() => {
    if (activeView === 'Inbox' && user) {
      notifications.forEach(async (n) => { if (!n.read) { try { await updateDoc(doc(db, 'notifications', n.id), { read: true }); } catch (error) { handleFirestoreError(error, OperationType.UPDATE, `notifications/${n.id}`); } } });
    }
  }, [activeView, user, notifications.length]);

  const formatTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr); const now = new Date(); const diff = now.getTime() - date.getTime(); const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Ahora'; if (mins < 60) return `Hace ${mins} min`; const hours = Math.floor(mins / 60);
      if (hours < 24) return `Hace ${hours} h`; return date.toLocaleDateString();
    } catch { return timeStr; }
  };

  const handleLogin = async () => {
    setAuthError(null); setIsActionLoading(true);
    const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
    sessionStorage.setItem('pendingGoogleAuth', 'true');
    try {
      await signInWithPopup(auth, provider); sessionStorage.removeItem('pendingGoogleAuth'); setIsActionLoading(false);
    } catch (error: any) {
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request' || !error.code) {
        try { await signInWithRedirect(auth, provider); } catch (redirError: any) { setAuthError(`Error de Google (Redirect): ${redirError.code || redirError.message || 'Error desconocido'}`); setIsActionLoading(false); sessionStorage.removeItem('pendingGoogleAuth'); }
      } else { setAuthError(`Error de Google (Popup): ${error.code || error.message || 'Error desconocido'}`); setIsActionLoading(false); sessionStorage.removeItem('pendingGoogleAuth'); }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthError(null); setIsActionLoading(true);
    try {
      if (isRegistering) await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      else await signInWithEmailAndPassword(auth, authEmail, authPassword);
    } catch (error: any) {
      let msg = `Error (${error.code}): `;
      if (error.code === 'auth/user-not-found') msg += 'Usuario no encontrado.';
      else if (error.code === 'auth/wrong-password') msg += 'Contraseña incorrecta.';
      else if (error.code === 'auth/invalid-credential') msg += 'Credenciales inválidas.';
      else if (error.code === 'auth/email-already-in-use') msg += 'El email ya está en uso.';
      else if (error.code === 'auth/weak-password') msg += 'La contraseña es muy débil (mínimo 6 caracteres)';
      else if (error.code === 'auth/invalid-email') msg += 'Email inválido';
      else if (error.code === 'auth/unauthorized-domain') msg += 'Dominio no autorizado en Firebase Console';
      else msg += error.message;
      setAuthError(msg); setIsActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!authEmail) { setAuthError('Por favor, ingresa tu email primero.'); return; }
    setIsActionLoading(true);
    try { await sendPasswordResetEmail(auth, authEmail); setAuthError('Se ha enviado un correo para restablecer tu contraseña.'); setIsActionLoading(false); }
    catch (error: any) { setAuthError(`Error al enviar correo: ${error.code}`); setIsActionLoading(false); }
  };

  const handleLogout = async () => {
    try { await signOut(auth); setUser(null); setActiveView('Home'); }
    catch (error) { handleFirestoreError(error, OperationType.WRITE, 'auth/logout'); }
  };

  const saveProfile = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { ...userProfile, theme: appConfig.theme, language: appConfig.language, compactView: appConfig.compactView, notifEmail: notifSettings.email, notifWhatsapp: notifSettings.whatsapp });
      addNotification('Perfil actualizado', 'Tus cambios han sido guardados correctamente.', 'status_changed'); setIsProfileOpen(false);
    } catch (error) { handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`); }
  };

  const addNotification = async (title: string, message: string, type: Notification['type'], project?: string, taskTitle?: string) => {
    if (!user || !teamId) return;
    const newNotif = { title, message, time: new Date().toISOString(), read: false, type, userId: user.uid, teamId: teamId, userName: userProfile.name || user.displayName || 'Usuario', project: project || 'General', taskTitle: taskTitle || '' };
    try {
      await addDoc(collection(db, 'notifications'), newNotif);
      if (notifSettings.email) {
        await addDoc(collection(db, 'mail'), { to: user.email, userId: user.uid, teamId: teamId, message: { subject: `TUS-METAS: ${title}`, text: message, html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;"><h2 style="color: #4f46e5; margin-bottom: 16px;">${title}</h2><p style="color: #475569; font-size: 16px; line-height: 1.5;">${message}</p><hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" /><p style="color: #94a3b8; font-size: 12px;">Este es un mensaje automático de TUS-METAS.</p></div>` }, createdAt: new Date().toISOString() });
      }
      if (notifSettings.whatsapp) { const encodedMsg = encodeURIComponent(`*TUS-METAS*\n\n*${title}*\n${message}`); window.open(`https://wa.me/?text=${encodedMsg}`, '_blank'); }
    } catch (error) { handleFirestoreError(error, OperationType.CREATE, 'notifications/mail'); }
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id); if (!task) return;
    const newCompleted = !task.completed;
    try {
      await updateDoc(doc(db, 'tasks', id), { completed: newCompleted, status: newCompleted ? 'Done' : 'Todo' });
      if (newCompleted) addNotification('Tarea completada', `${userProfile.name || user?.displayName || 'Usuario'} ha completado la tarea "${task.title}" del proyecto "${task.project}"`, 'task_completed', task.project, task.title);
    } catch (error) { handleFirestoreError(error, OperationType.UPDATE, `tasks/${id}`); }
  };

  const updateTaskStatus = async (id: string, newStatus: Task['status']) => {
    const task = tasks.find(t => t.id === id); if (!task) return;
    try {
      await updateDoc(doc(db, 'tasks', id), { status: newStatus, completed: newStatus === 'Done' });
      if (task.status !== newStatus) addNotification('Estado actualizado', `${userProfile.name || user?.displayName || 'Usuario'} cambió el estado de "${task.title}" a "${newStatus}" en el proyecto "${task.project}"`, 'status_changed');
    } catch (error) { handleFirestoreError(error, OperationType.UPDATE, `tasks/${id}`); }
  };

  const deleteTask = async (id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    try { await deleteDoc(doc(db, 'tasks', id)); if (taskToDelete) addNotification('Tarea eliminada', `${userProfile.name || user?.displayName || 'Usuario'} eliminó la tarea "${taskToDelete.title}" del proyecto "${taskToDelete.project}"`, 'task_deleted'); }
    catch (error) { handleFirestoreError(error, OperationType.DELETE, `tasks/${id}`); }
  };

  const addTask = async () => {
    if (!newTaskTitle.trim() || !user || !teamId) return;
    const projectToUse = selectedProject || newTaskProject;
    const newTask = { title: newTaskTitle, completed: false, project: projectToUse, priority: newTaskPriority, dueDate: newTaskDueDate, dueTime: newTaskDueTime, reminderTime: newTaskReminder, status: 'Todo', userId: user.uid, teamId: teamId, assigneeId: user.uid, createdBy: userProfile.name || user.displayName || 'Usuario' };
    try {
      await addDoc(collection(db, 'tasks'), newTask);
      addNotification('Nueva tarea', `${userProfile.name || user.displayName || 'Usuario'} añadió la tarea "${newTaskTitle}" al proyecto "${projectToUse}"`, 'task_added', projectToUse, newTaskTitle);
      setNewTaskTitle(''); setNewTaskPriority('Media'); setNewTaskDueTime('12:00'); setNewTaskReminder(''); setIsQuickAddOpen(false);
    } catch (error) { handleFirestoreError(error, OperationType.CREATE, 'tasks'); }
  };

  const updateTaskTitle = async (id: string, title: string) => {
    const task = tasks.find(t => t.id === id);
    try { await updateDoc(doc(db, 'tasks', id), { title }); if (task && task.title !== title) addNotification('Tarea modificada', `Título cambiado de "${task.title}" a "${title}"`, 'status_changed'); }
    catch (error) { handleFirestoreError(error, OperationType.UPDATE, `tasks/${id}`); }
  };

  const updateTaskDueDate = async (id: string, dueDate: string) => {
    const task = tasks.find(t => t.id === id);
    try { await updateDoc(doc(db, 'tasks', id), { dueDate }); if (task && task.dueDate !== dueDate) addNotification('Fecha modificada', `Fecha de "${task.title}" cambiada a ${dueDate}`, 'status_changed'); }
    catch (error) { handleFirestoreError(error, OperationType.UPDATE, `tasks/${id}`); }
  };

  const updateTaskPriority = async (id: string, priority: Task['priority']) => {
    const task = tasks.find(t => t.id === id);
    try { await updateDoc(doc(db, 'tasks', id), { priority }); if (task && task.priority !== priority) addNotification('Prioridad modificada', `Prioridad de "${task.title}" cambiada a ${priority}`, 'status_changed'); }
    catch (error) { handleFirestoreError(error, OperationType.UPDATE, `tasks/${id}`); }
  };

  const updateTaskAssignee = async (id: string, assigneeId: string) => {
    const task = tasks.find(t => t.id === id); const member = teamMembers.find(m => m.id === assigneeId);
    try { await updateDoc(doc(db, 'tasks', id), { assigneeId }); if (task && task.assigneeId !== assigneeId) addNotification('Tarea asignada', `Tarea "${task.title}" asignada a ${member ? member.name : 'Alguien'}`, 'status_changed'); }
    catch (error) { handleFirestoreError(error, OperationType.UPDATE, `tasks/${id}`); }
  };

  const addGoal = async () => {
    if (!newGoalTitle.trim() || !user || !teamId) return;
    const newGoal = { title: newGoalTitle, progress: 0, category: newGoalCategory, userId: user.uid, teamId: teamId };
    try { await addDoc(collection(db, 'goals'), newGoal); addNotification('Nuevo objetivo', `Se añadió el objetivo: ${newGoalTitle}`, 'task_added'); setNewGoalTitle(''); setIsGoalModalOpen(false); }
    catch (error) { handleFirestoreError(error, OperationType.CREATE, 'goals'); }
  };

  const shareViaWhatsApp = (name: string, email: string) => {
    const appUrl = window.location.origin;
    const message = `¡Hola ${name}! Te invito a unirte a mi equipo en *TUS-METAS*. \n\nRegístrate aquí para empezar a colaborar: ${appUrl}\n\n(Invitación enviada a: ${email})`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const shareViaEmail = (name: string, email: string) => {
    const appUrl = window.location.origin;
    const subject = `Invitación a TUS-METAS`;
    const body = `Hola ${name},\n\nTe invito a unirte a mi equipo en TUS-METAS.\n\nRegístrate aquí: ${appUrl}\n\n¡Te espero!`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const inviteMember = async () => {
    if (!user || !teamId || !inviteEmail.trim() || !inviteName.trim()) return;
    try {
      await addDoc(collection(db, 'team'), { email: inviteEmail, name: inviteName, position: invitePosition, photoUrl: `https://picsum.photos/seed/${inviteName}/200/200`, role: inviteRole, invitedBy: user.uid, teamId: teamId, status: 'invited', permissions: ['add_tasks'], createdAt: serverTimestamp() });
      addNotification('Miembro Invitado', `${userProfile.name || user.displayName || 'Usuario'} ha invitado a ${inviteName} (${invitePosition}) al equipo.`, 'status_changed');
      setLastInvited({ name: inviteName, email: inviteEmail }); setIsInviteSuccessOpen(true);
      setInviteEmail(''); setInviteName(''); setInvitePosition(''); setInviteRole('Miembro');
    } catch (error) { handleFirestoreError(error, OperationType.CREATE, 'team'); }
  };

  const deleteTeamMember = async (id: string) => {
    try { await deleteDoc(doc(db, 'team', id)); addNotification('Miembro eliminado', 'Se eliminó al miembro del equipo', 'status_changed'); }
    catch (error) { handleFirestoreError(error, OperationType.DELETE, 'team'); }
  };

  const deleteGoal = async (id: string) => {
    const goalToDelete = goals.find(g => g.id === id);
    try { await deleteDoc(doc(db, 'goals', id)); if (goalToDelete) addNotification('Objetivo eliminado', `Se eliminó el objetivo: ${goalToDelete.title}`, 'task_deleted'); }
    catch (error) { handleFirestoreError(error, OperationType.DELETE, `goals/${id}`); }
  };

  const updateGoalProgress = async (id: string, progress: number) => {
    const goal = goals.find(g => g.id === id); const newProgress = Math.min(100, Math.max(0, progress));
    try { await updateDoc(doc(db, 'goals', id), { progress: newProgress }); if (goal && goal.progress !== newProgress) addNotification('Progreso actualizado', `Progreso de "${goal.title}" cambiado al ${newProgress}%`, 'status_changed'); }
    catch (error) { handleFirestoreError(error, OperationType.UPDATE, `goals/${id}`); }
  };

  const convertAvisoToProject = async (notif: Notification) => {
    if (userProfile.role === 'Observador' || !user) return;
    const isTechnical = notif.message.toLowerCase().includes('técnico') || notif.message.toLowerCase().includes('error') || notif.message.toLowerCase().includes('sitio web');
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const newProject = { name: notif.title, status: 'Pendiente', avisoId: notif.id, description: notif.message, milestones: [{ id: 'm-init', title: 'Análisis inicial de Aviso', dueDate: today, completed: false }, { id: 'm-crit', title: 'Hito Crítico: Resolución', dueDate: nextWeek, completed: false }], tasks: [], members: [{ id: 'u-me', name: userProfile.name, email: userProfile.email, photoUrl: userProfile.photoUrl, role: userProfile.role, permissions: ['add_tasks', 'delete_tasks', 'edit_dates', 'edit_names'] }], userId: user.uid, teamId: teamId };
    try {
      await addDoc(collection(db, 'projects'), newProject);
      if (isTechnical) { const techTasks = [{ title: `Diagnóstico: ${notif.title}`, completed: false, project: notif.title, priority: 'Alta', dueDate: today, status: 'Todo', userId: user.uid, teamId: teamId }, { title: `Implementación técnica`, completed: false, project: notif.title, priority: 'Media', dueDate: nextWeek, status: 'Todo', userId: user.uid, teamId: teamId }]; for (const t of techTasks) await addDoc(collection(db, 'tasks'), t); }
      addNotification('Proyecto Creado', `Se generó el proyecto "${notif.title}" desde un aviso.`, 'status_changed');
      setActiveView('Projects'); setSelectedProject(notif.title);
    } catch (error) { console.error('Error converting aviso to project:', error); }
  };

  const updateProjectStatus = async (id: string, status: ProjectStatus) => {
    if (userProfile.role === 'Observador') return;
    try { await updateDoc(doc(db, 'projects', id), { status }); } catch (error) { console.error('Error updating project status:', error); }
  };

  const toggleMilestone = async (projectId: string, milestoneId: string) => {
    if (userProfile.role === 'Observador') return;
    const project = projects.find(p => p.id === projectId); if (!project) return;
    const newMilestones = project.milestones.map(m => m.id === milestoneId ? { ...m, completed: !m.completed } : m);
    try { await updateDoc(doc(db, 'projects', projectId), { milestones: newMilestones }); } catch (error) { console.error('Error toggling milestone:', error); }
  };

  const unlinkAviso = () => { alert("Operación denegada. Los cambios en el origen deben realizarse en el sector Avisos. Aquí solo gestionamos la ejecución del Proyecto"); };

  const addProjectMember = async (projectId: string, member: ProjectMember) => {
    if (userProfile.role === 'Observador') return;
    const project = projects.find(p => p.id === projectId); if (!project) return;
    if (project.members.some(m => m.email === member.email)) { alert("Este miembro ya está en el proyecto"); return; }
    const newMember: ProjectMember = { ...member, id: member.id || Math.random().toString(36).substr(2, 9), permissions: ['add_tasks'] };
    try { await updateDoc(doc(db, 'projects', projectId), { members: [...project.members, newMember] }); addNotification('Miembro añadido', `${userProfile.name || user?.displayName || 'Usuario'} añadió a ${member.name} al proyecto "${project.name}"`, 'status_changed'); }
    catch (error) { handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`); }
  };

  const toggleMemberPermission = async (projectId: string, memberId: string, permission: ProjectMemberPermission) => {
    if (userProfile.role !== 'Administrador') return;
    const project = projects.find(p => p.id === projectId); if (!project) return;
    const newMembers = project.members.map(m => { if (m.id === memberId) { const hasPermission = m.permissions.includes(permission); return { ...m, permissions: hasPermission ? m.permissions.filter(p => p !== permission) : [...m.permissions, permission] }; } return m; });
    try { await updateDoc(doc(db, 'projects', projectId), { members: newMembers }); } catch (error) { console.error('Error toggling member permission:', error); }
  };

  const assignTask = async (taskId: string, memberId: string) => {
    try { await updateDoc(doc(db, 'tasks', taskId), { assigneeId: memberId }); } catch (error) { console.error('Error assigning task:', error); }
  };

  const checkProjectPermission = (projectName: string, permission: ProjectMemberPermission) => {
    if (userProfile.role === 'Administrador') return true;
    const project = projects.find(p => p.name === projectName); if (!project) return false;
    const member = project.members.find(m => m.email === userProfile.email);
    return member?.permissions.includes(permission) || false;
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const reader = new FileReader(); reader.onloadend = () => { setUserProfile(prev => ({ ...prev, photoUrl: reader.result as string })); }; reader.readAsDataURL(file); }
  };

  const getProjectProgress = (projectId: string) => {
    const projectTasks = tasks.filter(t => { const p = projects.find(proj => proj.id === projectId); return t.project === p?.name; });
    if (projectTasks.length === 0) return 0;
    return Math.round((projectTasks.filter(t => t.completed).length / projectTasks.length) * 100);
  };

  const getProjectStatusSemaphore = (projectId: string): ProjectStatusSemaphore => {
    const project = projects.find(p => p.id === projectId); if (!project) return 'Green';
    const projectTasks = tasks.filter(t => t.project === project.name); if (projectTasks.length === 0) return 'Green';
    const today = new Date().toISOString().split('T')[0];
    const hasOverdue = projectTasks.some(t => !t.completed && t.dueDate && t.dueDate < today);
    if (hasOverdue) return 'Red';
    const onTimeTasks = projectTasks.filter(t => !t.completed && t.dueDate && t.dueDate >= today).length;
    const totalIncomplete = projectTasks.filter(t => !t.completed).length;
    if (totalIncomplete === 0) return 'Green';
    return (onTimeTasks / totalIncomplete) >= 0.8 ? 'Green' : 'Yellow';
  };

  const addProjectToPortfolio = async (portfolioId: string, projectId: string) => {
    const portfolio = portfolios.find(p => p.id === portfolioId); if (!portfolio || portfolio.projectIds.includes(projectId)) return;
    try { await updateDoc(doc(db, 'portfolios', portfolioId), { projectIds: [...portfolio.projectIds, projectId] }); } catch (error) { console.error('Error adding project to portfolio:', error); }
  };

  const removeProjectFromPortfolio = async (portfolioId: string, projectId: string) => {
    const portfolio = portfolios.find(p => p.id === portfolioId); if (!portfolio) return;
    try { await updateDoc(doc(db, 'portfolios', portfolioId), { projectIds: portfolio.projectIds.filter(id => id !== projectId) }); } catch (error) { console.error('Error removing project from portfolio:', error); }
  };

  const createPortfolio = async (name: string) => {
    if (!user || !teamId) return;
    try { await addDoc(collection(db, 'portfolios'), { name, projectIds: [], userId: user.uid, teamId: teamId }); } catch (error) { console.error('Error creating portfolio:', error); }
  };

  const notifiedTasksRef = React.useRef<Set<string>>(new Set());
  const tasksRef = React.useRef<Task[]>([]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  useEffect(() => {
    if (!user) return;
    const checkReminders = () => {
      const now = new Date();
      tasksRef.current.forEach(task => {
        if (task.reminderTime && !task.completed && !notifiedTasksRef.current.has(task.id)) {
          const reminderDate = new Date(task.reminderTime);
          if (Math.abs(now.getTime() - reminderDate.getTime()) < 60000) {
            notifiedTasksRef.current.add(task.id);
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') { try { new Notification(`Recordatorio: ${task.title}`, { body: `Es hora de: ${task.title} (${task.project})`, icon: 'https://api.dicebear.com/7.x/initials/png?seed=TM&backgroundColor=4f46e5' }); } catch (e) { console.error("Error showing notification:", e); } }
            addNotification('Alarma', `Recordatorio para: ${task.title}`, 'status_changed');
          }
        }
      });
    };
    const interval = setInterval(checkReminders, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => { if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission().catch(console.error); }, []);

  const generateDailyDigest = () => {
    const today = new Date().toISOString().split('T')[0];
    const todaysTasks = tasks.filter(t => t.dueDate === today && !t.completed);
    if (todaysTasks.length === 0) return null;
    const taskList = todaysTasks.map(t => `- [${t.priority}] ${t.title} (${t.dueTime || 'Sin hora'})`).join('\n');
    return { subject: `TUS-METAS: Resumen para hoy ${today}`, body: `Hola ${userProfile.name},\n\nAquí tienes tus tareas para hoy (${today}):\n\n${taskList}\n\n¡Que tengas un día productivo!\n\nEnviado desde TUS-METAS.` };
  };

  const sendDailyEmail = () => {
    const digest = generateDailyDigest();
    if (!digest) { alert('No tienes tareas pendientes para hoy.'); return; }
    window.location.href = `mailto:${user?.email}?subject=${encodeURIComponent(digest.subject)}&body=${encodeURIComponent(digest.body)}`;
  };

  const SidebarItem = ({ view, icon: Icon, label, badge }: { view: View; icon: any; label: string; badge?: number }) => (
    <button onClick={() => setActiveView(view)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all relative ${activeView === view ? (appConfig.theme === 'dark' ? 'bg-indigo-900/40 text-indigo-400 shadow-sm' : 'bg-indigo-50 text-indigo-600 shadow-sm') : (appConfig.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100')}`}>
      <Icon size={18} />
      {isSidebarOpen && <span>{label}</span>}
      {badge !== undefined && badge > 0 && (
        <span className={`absolute ${isSidebarOpen ? 'right-3' : 'right-1 top-1'} bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] flex items-center justify-center`}>{badge > 9 ? '9+' : badge}</span>
      )}
    </button>
  );

  useEffect(() => { if (appConfig.theme === 'dark') document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark'); }, [appConfig.theme]);

  if (isAuthLoading) return <LoadingSpinner />;

  if (!user) {
    return (
      <LoginScreen authEmail={authEmail} setAuthEmail={setAuthEmail} authPassword={authPassword} setAuthPassword={setAuthPassword}
        handleEmailAuth={handleEmailAuth} handleLogin={handleLogin} handleResetPassword={handleResetPassword}
        isRegistering={isRegistering} setIsRegistering={setIsRegistering} authError={authError} isActionLoading={isActionLoading} isAuthLoading={isAuthLoading} />
    );
  }

  return (
    <div className={`flex h-screen font-sans transition-colors duration-300 ${appConfig.theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Sidebar */}
      <motion.aside animate={{ width: isSidebarOpen ? 260 : 80 }}
        className={`border-r flex flex-col h-full relative z-20 transition-colors ${appConfig.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
        <div className="p-4 flex items-center justify-between">
          {isSidebarOpen && (
            <div className="flex items-center gap-3">
              <Logo size={14} className="scale-75" />
              <span className={`text-lg font-black tracking-tighter uppercase ${appConfig.theme === 'dark' ? 'text-indigo-400' : 'text-indigo-900'}`}>TUS-METAS</span>
            </div>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 hover:bg-slate-200 rounded-md text-slate-500">
            {isSidebarOpen ? <Menu size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>
        <div className="flex-grow px-3 py-4 space-y-1">
          <SidebarItem view="Home" icon={Home} label="Inicio" />
          <SidebarItem view="Dashboard" icon={Layout} label="Panel de Control" />
          <SidebarItem view="MyTasks" icon={CheckCircle2} label="Mis tareas" />
          <SidebarItem view="Inbox" icon={Inbox} label="Bandeja de entrada" badge={notifications.filter(n => !n.read).length} />
          <SidebarItem view="Team" icon={Users} label="Mi Equipo" />
          <SidebarItem view="Goals" icon={Target} label="Objetivos" />
          <SidebarItem view="Projects" icon={Layout} label="Proyectos" />
          <SidebarItem view="Portfolios" icon={Briefcase} label="Portafolios" />
        </div>
        <div className="p-4 border-t border-slate-200">
          <button onClick={() => setIsQuickAddOpen(true)} className="flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg py-2.5 font-semibold shadow-md hover:bg-indigo-700 transition-all w-full">
            <Plus size={20} />{isSidebarOpen && <span>Agregado rápido</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col overflow-hidden">
        {/* Header */}
        <header className={`h-14 border-b flex items-center justify-between px-6 shrink-0 transition-colors ${appConfig.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <h2 className={`text-lg font-semibold ${appConfig.theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
            {activeView === 'Home' && 'Inicio'}{activeView === 'Dashboard' && 'Panel de Control'}{activeView === 'MyTasks' && 'Mis tareas'}
            {activeView === 'Inbox' && 'Bandeja de entrada'}{activeView === 'Goals' && 'Objetivos'}{activeView === 'Projects' && 'Proyectos'}
            {activeView === 'Portfolios' && 'Portafolios'}{activeView === 'Team' && 'Mi Equipo'}
          </h2>
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Buscar..." className={`pl-9 pr-4 py-1.5 border-transparent rounded-full text-sm focus:ring-2 focus:ring-indigo-500 transition-all w-64 ${appConfig.theme === 'dark' ? 'bg-slate-800 text-slate-200 focus:bg-slate-700' : 'bg-slate-100 text-slate-800 focus:bg-white'}`} />
            </div>
            <button onClick={() => setAppConfig(prev => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }))} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-all">
              {appConfig.theme === 'light' ? <Moon size={20} /> : <Sun size={20} className="text-amber-400" />}
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"><Settings size={20} /></button>
            <div onClick={() => setIsProfileOpen(true)} className="w-8 h-8 rounded-full overflow-hidden border-2 border-indigo-100 cursor-pointer hover:border-indigo-300 transition-all">
              <img src={userProfile.photoUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className={`flex-grow overflow-y-auto p-6 transition-colors ${appConfig.theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50/50'}`}>
          <AnimatePresence mode="wait">

            {/* DASHBOARD */}
            {activeView === 'Dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                <Dashboard tasks={tasks} projects={projects} goals={goals} />
              </motion.div>
            )}

            {/* HOME */}
            {activeView === 'Home' && (
              <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-5xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-grow bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Resumen de hoy</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100"><span className="block text-2xl font-bold text-indigo-700">{tasks.filter(t => !t.completed).length}</span><span className="text-xs text-indigo-600 font-medium">Tareas pendientes</span></div>
                      <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100"><span className="block text-2xl font-bold text-emerald-700">{tasks.filter(t => t.completed).length}</span><span className="text-xs text-emerald-600 font-medium">Tareas completadas</span></div>
                      <div className="p-4 bg-amber-50 rounded-lg border border-amber-100"><span className="block text-2xl font-bold text-amber-700">{goals.length}</span><span className="text-xs text-amber-600 font-medium">Objetivos activos</span></div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <Pomodoro />
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center group hover:border-indigo-500 transition-all">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all"><Inbox size={24} /></div>
                    <h3 className="font-bold text-slate-800 mb-1">Resumen Diario</h3>
                    <p className="text-xs text-slate-500 mb-4">Recibe tus tareas por email</p>
                    <button onClick={sendDailyEmail} className="w-full py-2 bg-slate-50 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-50 border border-slate-100">Enviar ahora</button>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center group hover:border-emerald-500 transition-all">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-all"><Calendar size={24} /></div>
                    <h3 className="font-bold text-slate-800 mb-1">Calendario</h3>
                    <p className="text-xs text-slate-500 mb-4">Ver tareas por horario</p>
                    <button onClick={() => { setActiveView('MyTasks'); setMyTasksSubView('Calendar'); }} className="w-full py-2 bg-slate-50 text-emerald-600 text-xs font-bold rounded-lg hover:bg-emerald-50 border border-slate-100">Ver calendario</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-800">Tareas recientes</h3>
                      <button onClick={() => setActiveView('MyTasks')} className="text-xs font-semibold text-indigo-600 hover:underline">Ver todas</button>
                    </div>
                    <div className="space-y-3">
                      {tasks.slice(0, 5).map(task => (
                        <div key={task.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg group transition-colors">
                          <button onClick={() => toggleTask(task.id)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 hover:border-indigo-500'}`}>
                            {task.completed && <CheckCircle2 size={12} className="text-white" />}
                          </button>
                          <span className={`text-sm flex-grow ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-800">Progreso de objetivos</h3>
                      <button onClick={() => setActiveView('Goals')} className="text-xs font-semibold text-indigo-600 hover:underline">Ver todos</button>
                    </div>
                    <div className="space-y-6">
                      {goals.slice(0, 3).map(goal => (
                        <div key={goal.id} className="space-y-2">
                          <div className="flex justify-between text-sm"><span className="font-medium text-slate-700">{goal.title}</span><span className="text-indigo-600 font-bold">{goal.progress || 0}%</span></div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${goal.progress || 0}%` }} className="h-full bg-indigo-500 rounded-full" /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 col-span-1 lg:col-span-2">
                    <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-slate-800 flex items-center gap-2"><User size={18} className="text-indigo-600" />Tareas asignadas a mí</h3></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tasks.filter(t => t.assigneeId === user?.uid).length > 0 ? (
                        tasks.filter(t => t.assigneeId === user?.uid).map(task => (
                          <div key={task.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 group">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-white text-slate-500 rounded border border-slate-100">{task.project}</span>
                              <div className={`w-2 h-2 rounded-full ${task.priority === 'Alta' ? 'bg-rose-500' : task.priority === 'Media' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 mb-2 truncate">{task.title}</h4>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium"><Calendar size={10} />{task.dueDate}</div>
                              <button onClick={() => toggleTask(task.id)} className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${task.completed ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>{task.completed ? 'Completada' : 'Pendiente'}</button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200"><p className="text-xs text-slate-400 font-medium italic">No tienes tareas asignadas por otros aún</p></div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* MY TASKS */}
            {activeView === 'MyTasks' && (
              <motion.div key="tasks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto h-full flex flex-col">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                      {(['List', 'Board', 'Calendar'] as MyTasksSubView[]).map(v => (
                        <button key={v} onClick={() => setMyTasksSubView(v)} className={`text-sm font-semibold pb-1 transition-all ${myTasksSubView === v ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                          {v === 'List' ? 'Lista' : v === 'Board' ? 'Tablero' : 'Calendario'}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setIsQuickAddOpen(true)} className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700"><Plus size={14} /> Añadir tarea</button>
                  </div>
                  <div className="flex-grow overflow-auto p-4">
                    {myTasksSubView === 'List' && (
                      <div className="space-y-8">
                        {Object.entries(tasks.reduce((acc, task) => { const project = task.project || 'Sin Proyecto'; if (!acc[project]) acc[project] = []; acc[project].push(task); return acc; }, {} as Record<string, Task[]>)).map(([projectName, projectTasks]: [string, any]) => (
                          <div key={projectName} className="space-y-3">
                            <div className="flex items-center gap-2 px-2">
                              <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                              <h4 className={`text-sm font-bold uppercase tracking-wider ${appConfig.theme === 'dark' ? 'text-slate-300' : 'text-slate-800'}`}>{projectName}</h4>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${appConfig.theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>{(projectTasks as Task[]).length}</span>
                            </div>
                            <div className={`rounded-2xl border divide-y overflow-hidden ${appConfig.theme === 'dark' ? 'bg-slate-900 border-slate-800 divide-slate-800' : 'bg-white border-slate-200 divide-slate-100'}`}>
                              {(projectTasks as Task[]).map(task => (
                                <div key={task.id} className={`flex items-center gap-3 p-4 group transition-colors ${appConfig.theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                                  <button onClick={() => toggleTask(task.id)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 hover:border-indigo-500'}`}>
                                    {task.completed && <CheckCircle2 size={12} className="text-white" />}
                                  </button>
                                  <div className="flex-grow flex items-center gap-4">
                                    <h4 className={`text-sm font-bold ${task.completed ? 'text-slate-400 line-through' : (appConfig.theme === 'dark' ? 'text-slate-200' : 'text-slate-800')}`}>{task.title}</h4>
                                    <div className="flex items-center gap-4 ml-auto">
                                      <div className="flex items-center gap-1 text-[10px] text-slate-400"><Calendar size={12} />{task.dueDate}</div>
                                      <div className={`flex items-center gap-1 text-[10px] font-bold ${task.priority === 'Alta' ? 'text-rose-500' : task.priority === 'Media' ? 'text-amber-500' : 'text-emerald-500'}`}><Flag size={12} />{task.priority}</div>
                                      <div className="flex items-center gap-1">
                                        <User size={12} className="text-slate-400" />
                                        <select value={task.assigneeId || ''} onChange={(e) => updateTaskAssignee(task.id, e.target.value)} className={`text-[10px] font-bold bg-transparent outline-none hover:text-indigo-600 cursor-pointer ${appConfig.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                          <option value="">Sin asignar</option>
                                          <option value={user?.uid}>{userProfile.name || 'Tú'}</option>
                                          {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                  <button onClick={() => deleteTask(task.id)} className="p-1 text-rose-400 hover:text-rose-600 sm:text-slate-300 sm:hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {myTasksSubView === 'Board' && (
                      <div className="flex gap-6 h-full min-w-[800px]">
                        {(['Todo', 'InProgress', 'Done'] as Task['status'][]).map(status => (
                          <div key={status} className="flex-1 flex flex-col gap-4">
                            <div className="flex items-center justify-between px-2">
                              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {status === 'Todo' ? `Por hacer (${tasks.filter(t => t.status === 'Todo').length})` : status === 'InProgress' ? `En progreso (${tasks.filter(t => t.status === 'InProgress').length})` : `Completado (${tasks.filter(t => t.status === 'Done').length})`}
                              </h5>
                              {status === 'Todo' && <button onClick={() => setIsQuickAddOpen(true)} className="p-1 hover:bg-slate-200 rounded text-slate-400"><Plus size={14} /></button>}
                            </div>
                            <div className="space-y-3">
                              {tasks.filter(t => t.status === status).map(task => (
                                <BoardCard key={task.id} task={task} onStatusChange={updateTaskStatus} onDelete={deleteTask} onAssign={updateTaskAssignee} teamMembers={teamMembers} currentUserId={user?.uid} currentUserName={userProfile.name} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {myTasksSubView === 'Calendar' && (
                      <div className="space-y-8">
                        {Array.from(new Set(tasks.map(t => t.dueDate).filter(Boolean))).sort().map(date => (
                          <div key={date} className="space-y-4">
                            <div className="flex items-center gap-4 sticky top-0 bg-white z-10 py-2">
                              <div className="flex flex-col items-center justify-center w-12 h-12 bg-indigo-600 text-white rounded-xl shadow-md">
                                <span className="text-[10px] font-bold uppercase">{new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short' })}</span>
                                <span className="text-lg font-black leading-none">{new Date(date + 'T12:00:00').getDate()}</span>
                              </div>
                              <div className="flex flex-col">
                                <h5 className="text-sm font-bold text-slate-800">{new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long' })}</h5>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{tasks.filter(t => t.dueDate === date).length} Tareas</p>
                              </div>
                              <div className="h-px flex-grow bg-slate-100"></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-16">
                              {tasks.filter(t => t.dueDate === date).sort((a, b) => (a.dueTime || '00:00').localeCompare(b.dueTime || '00:00')).map(task => (
                                <div key={task.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all group relative">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full"><Clock size={10} />{task.dueTime || 'Sin hora'}</div>
                                    <div className={`w-2 h-2 rounded-full ${task.priority === 'Alta' ? 'bg-rose-500' : task.priority === 'Media' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                  </div>
                                  <h6 className={`text-xs font-bold mb-1 ${task.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title}</h6>
                                  <p className="text-[10px] text-slate-500 mb-3">{task.project}</p>
                                  {task.reminderTime && <div className="flex items-center gap-1 text-[9px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-md mb-3"><Bell size={10} />Alarma: {new Date(task.reminderTime).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>}
                                  <div className="flex justify-end gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => toggleTask(task.id)} className={`p-1.5 rounded-lg border transition-all ${task.completed ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-500 hover:text-indigo-600'}`}><CheckCircle size={14} /></button>
                                    <button onClick={() => deleteTask(task.id)} className="p-1.5 bg-white text-rose-400 border border-rose-100 rounded-lg hover:border-rose-500 hover:text-rose-600 transition-all sm:text-slate-400 sm:border-slate-200"><Trash2 size={14} /></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* GOALS */}
            {activeView === 'Goals' && (
              <motion.div key="goals" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {goals.map(goal => (
                  <div key={goal.id} className={`p-6 rounded-xl shadow-sm border flex flex-col group relative transition-all ${appConfig.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <button onClick={() => deleteGoal(goal.id)} className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                    <div className="flex justify-between items-start mb-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${appConfig.theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Target size={20} /></div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${appConfig.theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>{goal.category}</span>
                    </div>
                    <h4 className={`font-bold mb-2 ${appConfig.theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>{goal.title}</h4>
                    <div className="mt-auto pt-6 space-y-3">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-500">Progreso</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateGoalProgress(goal.id, (goal.progress || 0) - 5)} className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${appConfig.theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>-</button>
                          <span className="text-indigo-600 w-8 text-center">{goal.progress || 0}%</span>
                          <button onClick={() => updateGoalProgress(goal.id, (goal.progress || 0) + 5)} className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${appConfig.theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>+</button>
                        </div>
                      </div>
                      <div className={`w-full h-2 rounded-full overflow-hidden ${appConfig.theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${goal.progress || 0}%` }} className="h-full bg-indigo-500 rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={() => setIsGoalModalOpen(true)} className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition-all ${appConfig.theme === 'dark' ? 'border-slate-800 text-slate-600 hover:border-indigo-500/50 hover:text-indigo-400' : 'border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500'}`}>
                  <PlusCircle size={32} /><span className="font-semibold">Nuevo objetivo</span>
                </button>
              </motion.div>
            )}

            {/* PROJECTS */}
            {activeView === 'Projects' && (
              <motion.div key="projects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto space-y-6">
                {!selectedProject ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(project => {
                      const projectTasks = tasks.filter(t => t.project === project.name);
                      const completedCount = projectTasks.filter(t => t.completed).length;
                      const progress = projectTasks.length > 0 ? Math.round((completedCount / projectTasks.length) * 100) : 0;
                      return (
                        <div key={project.id} onClick={() => setSelectedProject(project.name)} className={`relative p-6 rounded-xl shadow-sm border hover:shadow-md transition-all cursor-pointer group ${appConfig.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                          <div className="flex justify-between items-start mb-4">
                          {userProfile.role === 'Administrador' && (
                            <button onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }} className="absolute top-3 left-3 p-1.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                          )}
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${appConfig.theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Layout size={20} /></div>
                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${project.status === 'Finalizado' ? (appConfig.theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : project.status === 'Activo' ? (appConfig.theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600') : (appConfig.theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')}`}>{project.status}</span>
                              {project.avisoId && <span className="text-[8px] font-bold text-indigo-400">Vinculado a Aviso #{project.avisoId.slice(0, 4)}</span>}
                            </div>
                          </div>
                          <h4 className={`font-bold mb-1 group-hover:text-indigo-600 transition-colors ${appConfig.theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>{project.name}</h4>
                          <p className="text-xs text-slate-500 mb-6 line-clamp-2">{project.description}</p>
                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">Progreso</span><span className="text-indigo-600">{progress}%</span></div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-indigo-500 rounded-full" /></div>
                          </div>
                        </div>
                      );
                    })}
                    {userProfile.role === 'Administrador' && (
                      <button onClick={() => setIsProjectModalOpen(true)} className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-all">
                        <PlusCircle size={32} /><span className="font-semibold text-sm">Nuevo proyecto</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {projects.filter(p => p.name === selectedProject).map(project => {
                      const filteredTasks = tasks.filter(t => {
                        if (t.project !== project.name) return false;
                        const matchesSearch = t.title.toLowerCase().includes(projectTaskFilter.search.toLowerCase());
                        const matchesDate = !projectTaskFilter.date || t.dueDate === projectTaskFilter.date;
                        const matchesAssignee = !projectTaskFilter.assignee || t.assigneeId === projectTaskFilter.assignee;
                        const matchesPriority = !projectTaskFilter.priority || t.priority === projectTaskFilter.priority;
                        return matchesSearch && matchesDate && matchesAssignee && matchesPriority;
                      });
                      const canAdd = checkProjectPermission(project.name, 'add_tasks');
                      const canDelete = checkProjectPermission(project.name, 'delete_tasks');
                      const canEditDates = checkProjectPermission(project.name, 'edit_dates');
                      const canEditNames = checkProjectPermission(project.name, 'edit_names');
                      return (
                        <div key={project.id} className="space-y-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <button onClick={() => setSelectedProject(null)} className="p-2 hover:bg-white rounded-full text-slate-500 transition-all"><ChevronRight size={20} className="rotate-180" /></button>
                              <div>
                                <div className="flex items-center gap-3">
                                  <h3 className="text-xl font-bold text-slate-800">{project.name}</h3>
                                  {project.avisoId && <button onClick={unlinkAviso} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-bold hover:bg-indigo-100">ID Aviso: {project.avisoId}</button>}
                                </div>
                                <p className="text-xs text-slate-500">{project.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {userProfile.role !== 'Observador' && (
                                <select value={project.status} onChange={(e) => updateProjectStatus(project.id, e.target.value as ProjectStatus)} className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500">
                                  <option value="Pendiente">Pendiente</option><option value="Activo">Activo</option><option value="Finalizado">Finalizado</option>
                                </select>
                              )}
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap gap-3 items-center">
                            <div className="relative flex-grow min-w-[200px]">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input type="text" placeholder="Filtrar por nombre..." value={projectTaskFilter.search} onChange={(e) => setProjectTaskFilter(prev => ({ ...prev, search: e.target.value }))} className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border-transparent rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all" />
                            </div>
                            <input type="date" value={projectTaskFilter.date} onChange={(e) => setProjectTaskFilter(prev => ({ ...prev, date: e.target.value }))} className="px-3 py-1.5 bg-slate-50 border-transparent rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all" />
                            <select value={projectTaskFilter.assignee} onChange={(e) => setProjectTaskFilter(prev => ({ ...prev, assignee: e.target.value }))} className="px-3 py-1.5 bg-slate-50 border-transparent rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none">
                              <option value="">Todos los responsables</option>
                              {project.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                            <select value={projectTaskFilter.priority} onChange={(e) => setProjectTaskFilter(prev => ({ ...prev, priority: e.target.value }))} className="px-3 py-1.5 bg-slate-50 border-transparent rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none">
                              <option value="">Todas las prioridades</option><option value="Alta">Alta</option><option value="Media">Media</option><option value="Baja">Baja</option>
                            </select>
                            <button onClick={() => setProjectTaskFilter({ search: '', date: '', assignee: '', priority: '' })} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-all" title="Limpiar filtros"><X size={16} /></button>
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-4">
                              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                                  <h4 className="text-sm font-bold text-slate-800">Tareas del Proyecto ({filteredTasks.length})</h4>
                                  {canAdd && <button onClick={() => setIsQuickAddOpen(true)} className="text-xs font-bold text-indigo-600 hover:underline">+ Añadir</button>}
                                </div>
                                <div className="divide-y divide-slate-100">
                                  {filteredTasks.map(task => (
                                    <div key={task.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 group transition-colors">
                                      <button disabled={userProfile.role === 'Observador'} onClick={() => toggleTask(task.id)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 hover:border-indigo-500'} ${userProfile.role === 'Observador' ? 'cursor-not-allowed' : ''}`}>
                                        {task.completed && <CheckCircle2 size={12} className="text-white" />}
                                      </button>
                                      <div className="flex-grow">
                                        {canEditNames ? (
                                          <input type="text" value={task.title} onChange={(e) => updateTaskTitle(task.id, e.target.value)} className={`text-sm font-medium bg-transparent border-none outline-none focus:ring-0 w-full ${task.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`} />
                                        ) : (
                                          <h4 className={`text-sm font-medium ${task.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title}</h4>
                                        )}
                                        <div className="flex items-center gap-3 mt-1">
                                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                            <Calendar size={10} />
                                            {canEditDates ? <input type="date" value={task.dueDate} onChange={(e) => updateTaskDueDate(task.id, e.target.value)} className="bg-transparent border-none p-0 text-[10px] outline-none focus:ring-0 text-slate-400" /> : task.dueDate}
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <Flag size={10} className={task.priority === 'Alta' ? 'text-rose-500' : task.priority === 'Media' ? 'text-amber-500' : 'text-emerald-500'} />
                                            <select value={task.priority} onChange={(e) => updateTaskPriority(task.id, e.target.value as Task['priority'])} disabled={userProfile.role === 'Observador'} className={`text-[9px] font-bold bg-transparent border-none p-0 outline-none cursor-pointer ${task.priority === 'Alta' ? 'text-rose-500' : task.priority === 'Media' ? 'text-amber-500' : 'text-emerald-500'}`}>
                                              <option value="Alta">Alta</option><option value="Media">Media</option><option value="Baja">Baja</option>
                                            </select>
                                          </div>
                                          <select value={task.assigneeId || ''} onChange={(e) => assignTask(task.id, e.target.value)} disabled={userProfile.role === 'Observador'} className="text-[9px] font-bold bg-slate-100 border-none rounded px-1.5 py-0.5 text-slate-500 outline-none cursor-pointer hover:bg-slate-200">
                                            <option value="">Sin asignar</option>
                                            {project.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                          </select>
                                          <select value={task.status} onChange={(e) => updateTaskStatus(task.id, e.target.value as Task['status'])} disabled={userProfile.role === 'Observador'} className="text-[9px] font-bold bg-indigo-50 text-indigo-600 border-none rounded px-1.5 py-0.5 outline-none cursor-pointer hover:bg-indigo-100">
                                            <option value="Todo">Por hacer</option><option value="InProgress">En curso</option><option value="Done">Hecho</option>
                                          </select>
                                        </div>
                                      </div>
                                      {canDelete && <button onClick={() => deleteTask(task.id)} className="p-1.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>}
                                    </div>
                                  ))}
                                  {filteredTasks.length === 0 && <div className="p-8 text-center text-slate-400 italic text-sm">No se encontraron tareas con los filtros aplicados.</div>}
                                </div>
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2"><User size={16} className="text-indigo-600" />Miembros</h4>
                                  {userProfile.role !== 'Observador' && <button onClick={() => setIsAddingMemberToProject(project.id)} className="text-[10px] font-bold text-indigo-600 hover:underline">+ Invitar</button>}
                                </div>
                                <div className="space-y-4">
                                  {project.members.map(member => (
                                    <div key={member.id} className="space-y-2">
                                      <div className="flex items-center gap-3">
                                        <img src={member.photoUrl} alt={member.name} className="w-8 h-8 rounded-full border border-slate-100" referrerPolicy="no-referrer" />
                                        <div className="flex-grow"><p className="text-xs font-bold text-slate-800">{member.name}</p><p className="text-[10px] text-slate-400">{member.role}</p></div>
                                      </div>
                                      {userProfile.role === 'Administrador' && (
                                        <div className="flex flex-wrap gap-1 pt-1">
                                          {[{ id: 'add_tasks', label: 'Añadir' }, { id: 'delete_tasks', label: 'Eliminar' }, { id: 'edit_dates', label: 'Fechas' }, { id: 'edit_names', label: 'Nombres' }].map(p => (
                                            <button key={p.id} onClick={() => toggleMemberPermission(project.id, member.id, p.id as ProjectMemberPermission)} className={`text-[8px] font-bold px-1.5 py-0.5 rounded transition-all ${member.permissions.includes(p.id as ProjectMemberPermission) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>{p.label}</button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><Flag size={16} className="text-indigo-600" />Hitos Críticos</h4>
                                <div className="space-y-4">
                                  {project.milestones.map(m => (
                                    <div key={m.id} className="flex gap-3">
                                      <button disabled={userProfile.role === 'Observador'} onClick={() => toggleMilestone(project.id, m.id)} className={`mt-1 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${m.completed ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                        {m.completed && <CheckCircle2 size={10} className="text-white" />}
                                      </button>
                                      <div><p className={`text-xs font-bold ${m.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{m.title}</p><p className="text-[10px] text-slate-400">Vence: {m.dueDate}</p></div>
                                    </div>
                                  ))}
                                  {project.milestones.length === 0 && <p className="text-xs text-slate-400 italic">No hay hitos definidos.</p>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* INBOX */}
            {activeView === 'Inbox' && (
              <motion.div key="inbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className={`text-base font-bold ${appConfig.theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>Bandeja de entrada e Historial</h3>
                    <p className="text-[10px] text-slate-400">Registro de actividades y cambios en tus proyectos.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select onChange={async (e) => { const val = e.target.value; if (!val || !user || !teamId) return; const now = new Date(); let cutoff = new Date(); if (val === 'hoy') cutoff.setHours(0,0,0,0); else if (val === 'semana') cutoff.setDate(now.getDate() - 7); else if (val === 'mes') cutoff.setMonth(now.getMonth() - 1); const toDelete = val === 'todo' ? notifications : notifications.filter(n => new Date(n.time) >= cutoff); for (const n of toDelete) { try { await deleteDoc(doc(db, 'notifications', n.id)); } catch(err) {} } e.target.value = ''; }} className={`text-[10px] font-bold border rounded-lg px-2 py-1 outline-none cursor-pointer ${appConfig.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`} defaultValue="">
                      <option value="" disabled>Borrar historial...</option>
                      <option value="hoy">Hoy</option>
                      <option value="semana">Última semana</option>
                      <option value="mes">Último mes</option>
                      <option value="todo">Todo</option>
                    </select>
                    <button onClick={async () => { if (!user) return; notifications.forEach(async (n) => { if (!n.read) await updateDoc(doc(db, 'notifications', n.id), { read: true }); }); }} className="text-[10px] font-bold text-indigo-600 hover:underline">Marcar leído</button>
                  </div>
                </div>
                <div className={`rounded-xl shadow-sm border overflow-hidden divide-y transition-all ${appConfig.theme === 'dark' ? 'bg-slate-900 border-slate-800 divide-slate-800' : 'bg-white border-slate-200 divide-slate-100'}`}>
                  {notifications.length > 0 ? (
                    notifications.map(notif => (
                      <div key={notif.id} className={`p-3 flex gap-3 transition-colors ${!notif.read ? (appConfig.theme === 'dark' ? 'bg-indigo-900/20' : 'bg-indigo-50/30') : ''} ${appConfig.theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${notif.type === 'task_added' ? (appConfig.theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600') : notif.type === 'task_completed' ? (appConfig.theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600') : notif.type === 'task_deleted' ? (appConfig.theme === 'dark' ? 'bg-rose-900/30 text-rose-400' : 'bg-rose-100 text-rose-600') : (appConfig.theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-100 text-indigo-600')}`}>
                          {notif.type === 'task_added' && <PlusCircle size={14} />}{notif.type === 'task_completed' && <CheckCircle2 size={14} />}{notif.type === 'task_deleted' && <Trash2 size={14} />}{notif.type === 'status_changed' && <Clock size={14} />}
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className={`text-xs font-bold ${!notif.read ? (appConfig.theme === 'dark' ? 'text-slate-100' : 'text-slate-900') : (appConfig.theme === 'dark' ? 'text-slate-400' : 'text-slate-600')}`}>{notif.title}</h4>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${appConfig.theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>{notif.project || 'General'}</span>
                              <span className="text-[9px] text-slate-400">Por: {notif.userName || 'Usuario'}</span>
                            </div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider shrink-0 ml-2">{formatTime(notif.time)}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{notif.message}</p>
                          {notif.type === 'status_changed' && notif.message.includes('Aviso') && (
                            <button onClick={() => convertAvisoToProject(notif)} className="mt-1 text-[9px] font-bold bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-all">Convertir en Proyecto</button>
                          )}
                        </div>
                        {!notif.read && <div className="w-2 h-2 bg-indigo-600 rounded-full mt-1 shrink-0" />}
                      </div>
                    ))
                  ) : (
                    <div className="p-16 text-center text-slate-400">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"><Inbox size={32} className="opacity-20" /></div>
                      <p className="font-bold text-slate-300">Tu bandeja está vacía</p>
                      <p className="text-[10px] mt-1">Las actividades de tu equipo aparecerán aquí.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* PORTFOLIOS */}
            {activeView === 'Portfolios' && (
              <motion.div key="portfolios" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {!selectedPortfolio ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-slate-800">Mis Portafolios</h3>
                      <button onClick={() => { const name = prompt('Nombre del nuevo portafolio:'); if (name) createPortfolio(name); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"><Plus size={18} />Nuevo Portafolio</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {portfolios.map(portfolio => (
                        <div key={portfolio.id} onClick={() => setSelectedPortfolio(portfolio.id)} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group">
                          <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all"><Briefcase size={24} /></div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{portfolio.projectIds.length} Proyectos</span>
                          </div>
                          <h4 className="text-lg font-bold text-slate-800 mb-2">{portfolio.name}</h4>
                          <div className="flex -space-x-2 overflow-hidden">
                            {portfolio.projectIds.slice(0, 3).map(pid => { const p = projects.find(proj => proj.id === pid); return <div key={pid} className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">{p?.name.charAt(0)}</div>; })}
                            {portfolio.projectIds.length > 3 && <div className="w-8 h-8 rounded-full bg-slate-50 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-400">+{portfolio.projectIds.length - 3}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {portfolios.filter(p => p.id === selectedPortfolio).map(portfolio => (
                      <div key={portfolio.id} className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <button onClick={() => setSelectedPortfolio(null)} className="p-2 hover:bg-white rounded-full text-slate-500 transition-all"><ChevronLeft size={20} /></button>
                            <div><h3 className="text-xl font-bold text-slate-800">{portfolio.name}</h3><p className="text-xs text-slate-500">Panel de Control de Portafolio</p></div>
                          </div>
                          <button onClick={() => setIsAddingProjectToPortfolio(true)} className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition-all"><Plus size={18} />Gestionar Proyectos</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {portfolio.projectIds.map(pid => {
                            const project = projects.find(p => p.id === pid); if (!project) return null;
                            const progress = getProjectProgress(pid); const semaphore = getProjectStatusSemaphore(pid);
                            return (
                              <div key={pid} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full shadow-sm ${semaphore === 'Red' ? 'bg-rose-500 shadow-rose-200 animate-pulse' : semaphore === 'Yellow' ? 'bg-amber-500 shadow-amber-200' : 'bg-emerald-500 shadow-emerald-200'}`} />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{semaphore === 'Red' ? 'Crítico' : semaphore === 'Yellow' ? 'En Riesgo' : 'Saludable'}</span>
                                  </div>
                                  <button onClick={() => removeProjectFromPortfolio(portfolio.id, pid)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-all" title="Quitar del portafolio"><X size={14} /></button>
                                </div>
                                <h4 className="text-lg font-bold text-slate-800 mb-1">{project.name}</h4>
                                <p className="text-xs text-slate-500 mb-6 line-clamp-2">{project.description}</p>
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400 uppercase">Progreso Real</span><span className="text-indigo-600">{progress}%</span></div>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-indigo-500 rounded-full" /></div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3 pt-2">
                                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100"><p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Tareas</p><p className="text-sm font-bold text-slate-700">{tasks.filter(t => t.project === project.name && t.completed).length} / {tasks.filter(t => t.project === project.name).length}</p></div>
                                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100"><p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Estado</p><p className={`text-sm font-bold ${project.status === 'Finalizado' ? 'text-emerald-600' : project.status === 'Activo' ? 'text-blue-600' : 'text-slate-500'}`}>{project.status}</p></div>
                                  </div>
                                </div>
                                <button onClick={() => { setSelectedProject(project.name); setActiveView('Projects'); }} className="w-full mt-6 py-2 bg-slate-50 text-slate-600 text-xs font-bold rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100">Ver Detalles del Proyecto</button>
                              </div>
                            );
                          })}
                          {portfolio.projectIds.length === 0 && (
                            <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                              <Briefcase size={48} className="mx-auto mb-4 text-slate-300" />
                              <p className="text-slate-500 font-medium">Este portafolio no tiene proyectos asignados.</p>
                              <button onClick={() => setIsAddingProjectToPortfolio(true)} className="mt-4 text-indigo-600 font-bold hover:underline">Añadir mi primer proyecto</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* TEAM */}
            {activeView === 'Team' && (
              <motion.div key="team" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-5xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className={`text-2xl font-bold ${appConfig.theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>Mi Equipo</h3>
                    <p className="text-slate-500">Gestiona los miembros de tu organización y sus permisos.</p>
                  </div>
                </div>

                {(userProfile.role === 'Administrador' || userProfile.role === 'Editor') && (
                  <div className={`rounded-3xl p-8 shadow-xl relative overflow-hidden transition-all ${appConfig.theme === 'dark' ? 'bg-indigo-900/40 border border-indigo-500/30 shadow-indigo-950/50' : 'bg-indigo-600 text-white shadow-indigo-100'}`}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                    <div className="relative z-10">
                      <h4 className={`text-xl font-bold mb-2 ${appConfig.theme === 'dark' ? 'text-indigo-100' : 'text-white'}`}>¿Quieres agregar a alguien?</h4>
                      <p className={`mb-6 max-w-md ${appConfig.theme === 'dark' ? 'text-indigo-300' : 'text-indigo-100'}`}>Solo necesitas ingresar su correo electrónico. No importa si aún no tiene cuenta.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                        {[{ label: 'Nombre Completo', value: inviteName, setter: setInviteName, placeholder: 'Juan Pérez', type: 'text' }, { label: 'Correo Electrónico', value: inviteEmail, setter: setInviteEmail, placeholder: 'correo@ejemplo.com', type: 'email' }, { label: 'Cargo / Posición', value: invitePosition, setter: setInvitePosition, placeholder: 'Ej: Desarrollador Senior', type: 'text' }].map(field => (
                          <div key={field.label} className="space-y-1">
                            <label className={`text-[10px] font-bold uppercase ${appConfig.theme === 'dark' ? 'text-indigo-400' : 'text-indigo-200'}`}>{field.label}</label>
                            <input type={field.type} value={field.value} onChange={(e) => field.setter(e.target.value)} placeholder={field.placeholder}
                              className={`w-full px-4 py-2.5 rounded-xl transition-all text-sm focus:outline-none ${appConfig.theme === 'dark' ? 'bg-slate-800/50 border border-slate-700 text-slate-200 placeholder:text-slate-600 focus:bg-slate-800' : 'bg-white/20 border border-white/30 text-white placeholder:text-indigo-200 focus:bg-white/30'}`} />
                          </div>
                        ))}
                        <div className="space-y-1">
                          <label className={`text-[10px] font-bold uppercase ${appConfig.theme === 'dark' ? 'text-indigo-400' : 'text-indigo-200'}`}>Rol Inicial</label>
                          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className={`w-full px-4 py-2.5 rounded-xl transition-all text-sm appearance-none focus:outline-none ${appConfig.theme === 'dark' ? 'bg-slate-800/50 border border-slate-700 text-slate-200 focus:bg-slate-800' : 'bg-white/20 border border-white/30 text-white focus:bg-white/30'}`}>
                            <option value="Miembro">Miembro</option><option value="Editor">Editor</option><option value="Administrador">Administrador</option><option value="Visualizador">Visualizador</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button onClick={inviteMember} disabled={!inviteEmail.trim() || !inviteName.trim()} className={`px-10 py-3 rounded-xl font-bold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${appConfig.theme === 'dark' ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-white text-indigo-600 hover:bg-indigo-50'}`}>Invitar al Equipo</button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className={`p-6 rounded-2xl shadow-sm border-2 relative overflow-hidden transition-all ${appConfig.theme === 'dark' ? 'bg-slate-900 border-indigo-500/30' : 'bg-white border-indigo-100'}`}>
                    <div className="absolute top-0 right-0 p-2"><span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Tú</span></div>
                    <div className="flex items-center gap-4 mb-4">
                      <img src={userProfile.photoUrl} alt="Me" className="w-14 h-14 rounded-full border-2 border-white shadow-sm" referrerPolicy="no-referrer" />
                      <div><h4 className={`font-bold ${appConfig.theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>{userProfile.name} {userProfile.lastName}</h4><p className="text-xs text-slate-500">{userProfile.email}</p></div>
                    </div>
                    <div className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg ${appConfig.theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Settings size={14} />{userProfile.role}</div>
                  </div>

                  {adminProfile && (
                    <div className={`p-6 rounded-2xl shadow-sm border relative transition-all ${appConfig.theme === 'dark' ? 'bg-slate-900 border-indigo-500/50' : 'bg-white border-indigo-200'}`}>
                      <div className="absolute top-0 right-0 p-2"><span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Admin</span></div>
                      <div className="flex items-center gap-4 mb-4">
                        <img src={adminProfile.photoUrl} alt={adminProfile.name} className="w-14 h-14 rounded-full border-2 border-white shadow-sm" referrerPolicy="no-referrer" />
                        <div><h4 className={`font-bold ${appConfig.theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>{adminProfile.name} {adminProfile.lastName}</h4><p className="text-xs text-slate-500">{adminProfile.email}</p></div>
                      </div>
                      <div className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg ${appConfig.theme === 'dark' ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-600'}`}><Shield size={14} />Administrador del Equipo</div>
                    </div>
                  )}

                  {teamMembers.filter(m => m.email !== user?.email).map(member => (
                    <div key={member.id} className={`p-6 rounded-2xl shadow-sm border transition-all group ${appConfig.theme === 'dark' ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-200 hover:border-indigo-200'}`}>
                      <div className="flex items-center gap-4 mb-4">
                        <img src={member.photoUrl} alt={member.name} className="w-14 h-14 rounded-full border-2 border-white shadow-sm" referrerPolicy="no-referrer" />
                        <div className="flex-grow">
                          <h4 className={`font-bold ${appConfig.theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>{member.name}</h4>
                          <p className="text-[10px] text-slate-500 font-medium">{member.position || 'Sin cargo'}</p>
                          <p className="text-[10px] text-slate-400">{member.email}</p>
                        </div>
                        <button onClick={() => deleteTeamMember(member.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Rol</label>
                          <select value={member.role} onChange={async (e) => { try { await updateDoc(doc(db, 'team', member.id), { role: e.target.value }); addNotification('Rol actualizado', `Rol de ${member.name} cambiado a ${e.target.value}`, 'status_changed'); } catch (error) { handleFirestoreError(error, OperationType.UPDATE, `team/${member.id}`); } }}
                            className={`w-full text-xs font-bold border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 ${appConfig.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                            <option value="Miembro">Miembro</option><option value="Editor">Editor</option><option value="Administrador">Administrador</option><option value="Visualizador">Visualizador</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Permisos</label>
                          <div className="flex flex-wrap gap-1.5">
                            {[{ id: 'add_tasks', label: 'Añadir' }, { id: 'delete_tasks', label: 'Eliminar' }, { id: 'edit_dates', label: 'Fechas' }, { id: 'edit_names', label: 'Nombres' }].map(perm => {
                              const hasPerm = member.permissions?.includes(perm.id as ProjectMemberPermission);
                              return (
                                <button key={perm.id} onClick={async () => { const newPerms = hasPerm ? (member.permissions || []).filter(p => p !== perm.id) : [...(member.permissions || []), perm.id as ProjectMemberPermission]; try { await updateDoc(doc(db, 'team', member.id), { permissions: newPerms }); } catch (error) { handleFirestoreError(error, OperationType.UPDATE, `team/${member.id}`); } }}
                                  className={`text-[9px] font-bold px-2 py-1 rounded-md transition-all ${hasPerm ? 'bg-indigo-600 text-white shadow-sm' : (appConfig.theme === 'dark' ? 'bg-slate-800 text-slate-500 hover:bg-slate-700' : 'bg-slate-100 text-slate-400 hover:bg-slate-200')}`}>
                                  {perm.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {member.status === 'invited' && (
                          <div className="pt-3 flex gap-2 border-t border-slate-50">
                            <button onClick={() => shareViaWhatsApp(member.name, member.email)} className="flex-grow flex items-center justify-center gap-1.5 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-all"><MessageCircle size={12} />WhatsApp</button>
                            <button onClick={() => shareViaEmail(member.name, member.email)} className="flex-grow flex items-center justify-center gap-1.5 py-2 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-100 transition-all"><Mail size={12} />Email</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {teamMembers.length === 0 && (
                  <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6"><Users size={32} className="text-slate-400" /></div>
                    <h4 className="text-xl font-bold text-slate-800 mb-2">Aún no tienes equipo</h4>
                    <p className="text-slate-500 max-w-md mx-auto">Usa el formulario de arriba para invitar a tus colaboradores por correo electrónico.</p>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      {/* Member Selector Modal */}
      <AnimatePresence>
        {isAddingMemberToProject && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddingMemberToProject(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">Añadir Miembro al Proyecto</h3>
                <button onClick={() => setIsAddingMemberToProject(null)} className="p-1 hover:bg-slate-100 rounded-md"><X size={20} className="text-slate-400" /></button>
              </div>
              <div className="p-6 max-h-[400px] overflow-y-auto space-y-3">
                {teamMembers.length > 0 ? teamMembers.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all">
                    <div className="flex items-center gap-3">
                      <img src={member.photoUrl} alt={member.name} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                      <div><p className="text-sm font-bold text-slate-800">{member.name}</p><p className="text-[10px] text-slate-400">{member.role} • {member.position}</p></div>
                    </div>
                    <button onClick={() => { addProjectMember(isAddingMemberToProject, member as any); setIsAddingMemberToProject(null); }} className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-all">Añadir</button>
                  </div>
                )) : (
                  <div className="text-center py-10">
                    <p className="text-sm text-slate-500">No hay miembros en tu equipo aún.</p>
                    <button onClick={() => { setIsAddingMemberToProject(null); setActiveView('Team'); }} className="text-xs font-bold text-indigo-600 hover:underline mt-2">Ir a Mi Equipo</button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Project Selector Modal */}
      <AnimatePresence>
        {isAddingProjectToPortfolio && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddingProjectToPortfolio(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">Gestionar Proyectos</h3>
                <button onClick={() => setIsAddingProjectToPortfolio(false)} className="p-1 hover:bg-slate-100 rounded-md"><X size={20} className="text-slate-400" /></button>
              </div>
              <div className="p-6 max-h-[400px] overflow-y-auto space-y-2">
                {projects.map(project => {
                  const portfolio = portfolios.find(p => p.id === selectedPortfolio);
                  const isIncluded = portfolio?.projectIds.includes(project.id);
                  return (
                    <div key={project.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all">
                      <div><p className="text-sm font-bold text-slate-800">{project.name}</p><p className="text-[10px] text-slate-400">{project.status}</p></div>
                      <button onClick={() => { if (selectedPortfolio) { isIncluded ? removeProjectFromPortfolio(selectedPortfolio, project.id) : addProjectToPortfolio(selectedPortfolio, project.id); } }}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${isIncluded ? 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100'}`}>
                        {isIncluded ? 'Quitar' : 'Añadir'}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button onClick={() => setIsAddingProjectToPortfolio(false)} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Listo</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSettingsOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2"><Settings size={20} className="text-indigo-600" /><h3 className="text-lg font-bold text-slate-800">Configuración</h3></div>
                <button onClick={() => setIsSettingsOpen(false)} className="p-1 hover:bg-slate-100 rounded-md"><X size={20} className="text-slate-400" /></button>
              </div>
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Apariencia y Preferencias</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500">Tema</label>
                      <select value={appConfig.theme} onChange={(e) => setAppConfig(prev => ({ ...prev, theme: e.target.value as any }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"><option value="light">Claro</option><option value="dark">Oscuro</option></select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500">Idioma</label>
                      <select value={appConfig.language} onChange={(e) => setAppConfig(prev => ({ ...prev, language: e.target.value as any }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"><option value="es">Español</option><option value="en">English</option></select>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Rol de Usuario (Simulación)</h4>
                  <div className="flex gap-2">
                    {['Administrador', 'Ejecutor', 'Observador'].map(role => (
                      <button key={role} onClick={() => setUserProfile(prev => ({ ...prev, role }))} className={`flex-grow py-2 text-[10px] font-bold rounded-lg border transition-all ${userProfile.role === role ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{role}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Aplicación</h4>
                  <div className="space-y-3">
                    {deferredPrompt && (
                      <button onClick={handleInstallClick} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"><PlusCircle size={18} />Instalar Aplicación en Escritorio</button>
                    )}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3"><div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm"><Logo size={14} /></div><div><p className="text-xs font-bold text-slate-800">TUS-METAS v1.0.0</p><p className="text-[10px] text-slate-500">Tu asistente de productividad</p></div></div>
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full uppercase">Actualizado</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Notificaciones</h4>
                  <div className="space-y-4">
                    {[{ key: 'email', icon: Inbox, color: 'blue', label: 'Correo Electrónico', desc: 'Recibir novedades por mail' }, { key: 'whatsapp', icon: MessageSquare, color: 'emerald', label: 'WhatsApp', desc: 'Recibir novedades por WhatsApp' }].map(item => (
                      <div key={item.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 bg-${item.color}-100 text-${item.color}-600 rounded-lg flex items-center justify-center`}><item.icon size={18} /></div>
                          <div><p className="text-sm font-bold text-slate-700">{item.label}</p><p className="text-[10px] text-slate-500">{item.desc}</p></div>
                        </div>
                        <button onClick={() => setNotifSettings(prev => ({ ...prev, [item.key]: !prev[item.key as keyof NotifSettings] }))} className={`w-10 h-5 rounded-full transition-colors relative ${notifSettings[item.key as keyof NotifSettings] ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                          <motion.div animate={{ x: notifSettings[item.key as keyof NotifSettings] ? 22 : 2 }} className="absolute top-1 w-3 h-3 bg-white rounded-full" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-4">Zona de Peligro</h4>
                  <button className="w-full py-2 px-4 border border-rose-200 text-rose-600 text-xs font-bold rounded-lg hover:bg-rose-50 transition-colors">Eliminar cuenta permanentemente</button>
                </div>
              </div>
              <div className="p-4 bg-slate-50 flex justify-end">
                <button onClick={() => setIsSettingsOpen(false)} className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-md transition-all">Guardar cambios</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {isProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsProfileOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2"><User size={20} className="text-indigo-600" /><h3 className="text-lg font-bold text-slate-800">Mi Perfil</h3></div>
                <button onClick={() => setIsProfileOpen(false)} className="p-1 hover:bg-slate-100 rounded-md"><X size={20} className="text-slate-400" /></button>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-indigo-50 shadow-lg"><img src={userProfile.photoUrl} alt="Profile Large" className="w-full h-full object-cover" referrerPolicy="no-referrer" /></div>
                    <label className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full shadow-md hover:bg-indigo-700 transition-all cursor-pointer"><Plus size={16} /><input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} /></label>
                  </div>
                  <div className="text-center"><h4 className="text-xl font-bold text-slate-800">{userProfile.name}</h4><p className="text-sm text-slate-500">{userProfile.role}</p></div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase">Nombre</label><input type="text" value={userProfile.name} onChange={(e) => setUserProfile(prev => ({ ...prev, name: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                    <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase">Apellido</label><input type="text" value={userProfile.lastName || ''} onChange={(e) => setUserProfile(prev => ({ ...prev, lastName: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                  </div>
                  <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase">Correo electrónico</label><input type="email" readOnly value={userProfile.email} className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 outline-none cursor-not-allowed" /></div>
                  <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase">Teléfono / WhatsApp</label><input type="tel" placeholder="+54 9 11 ..." value={userProfile.phone || ''} onChange={(e) => setUserProfile(prev => ({ ...prev, phone: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <button onClick={saveProfile} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 mb-2">Guardar cambios</button>
                  <button onClick={handleLogout} className="w-full py-2.5 text-rose-600 text-sm font-bold rounded-lg hover:bg-rose-50 transition-all">Cerrar sesión</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Goal Modal */}
      <AnimatePresence>
        {isGoalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsGoalModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2"><Target size={20} className="text-indigo-600" /><h3 className="text-lg font-bold text-slate-800">Nuevo Objetivo</h3></div>
                <button onClick={() => setIsGoalModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-md"><X size={20} className="text-slate-400" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Título del objetivo</label>
                  <input autoFocus type="text" value={newGoalTitle} onChange={(e) => setNewGoalTitle(e.target.value)} placeholder="Ej: Aprender React Avanzado" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" onKeyDown={(e) => e.key === 'Enter' && addGoal()} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Categoría</label>
                  <select value={newGoalCategory} onChange={(e) => setNewGoalCategory(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm">
                    <option value="Personal">Personal</option><option value="Negocios">Negocios</option><option value="Producto">Producto</option><option value="Marketing">Marketing</option><option value="Salud">Salud</option>
                  </select>
                </div>
              </div>
              <div className="p-6 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setIsGoalModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancelar</button>
                <button onClick={addGoal} className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-md transition-all">Crear objetivo</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invite Success Modal */}
      <AnimatePresence>
        {isInviteSuccessOpen && lastInvited && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsInviteSuccessOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden text-center p-8">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 size={40} /></div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">¡Invitación Registrada!</h3>
              <p className="text-slate-500 mb-8">Has invitado a <span className="font-bold text-slate-800">{lastInvited.name}</span>. Ahora puedes enviarle el enlace directamente.</p>
              <div className="grid grid-cols-1 gap-3 mb-6">
                <button onClick={() => shareViaWhatsApp(lastInvited.name, lastInvited.email)} className="flex items-center justify-center gap-3 w-full py-4 bg-[#25D366] text-white rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-emerald-100"><MessageCircle size={20} />Compartir por WhatsApp</button>
                <button onClick={() => shareViaEmail(lastInvited.name, lastInvited.email)} className="flex items-center justify-center gap-3 w-full py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-900 transition-all shadow-lg shadow-slate-200"><Mail size={20} />Enviar por Email</button>
              </div>
              <button onClick={() => setIsInviteSuccessOpen(false)} className="text-sm font-bold text-slate-400 hover:text-slate-600">Cerrar y continuar</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Project Modal */}
      <AnimatePresence>
        {isProjectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsProjectModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white w-full max-w-lg rounded-2xl shadow-2xl relative z-10 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">Crear Nuevo Proyecto</h3>
                <button onClick={() => setIsProjectModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-md"><X size={20} className="text-slate-400" /></button>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nombre del Proyecto</label><input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="Ej: Lanzamiento Web 2024" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Descripción</label><textarea value={newProjectDescription} onChange={(e) => setNewProjectDescription(e.target.value)} placeholder="Breve descripción de los objetivos..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all h-24 resize-none" /></div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Hitos del Proyecto</label>
                    <button onClick={() => setNewProjectMilestones([...newProjectMilestones, { title: '', dueDate: new Date().toISOString().split('T')[0] }])} className="text-[10px] font-bold text-indigo-600 hover:underline">+ Añadir Hito</button>
                  </div>
                  <div className="space-y-2">
                    {newProjectMilestones.map((m, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <input type="text" value={m.title} onChange={(e) => { const updated = [...newProjectMilestones]; updated[idx].title = e.target.value; setNewProjectMilestones(updated); }} placeholder="Título del hito" className="flex-grow bg-transparent border-none text-xs focus:ring-0" />
                        <input type="date" value={m.dueDate} onChange={(e) => { const updated = [...newProjectMilestones]; updated[idx].dueDate = e.target.value; setNewProjectMilestones(updated); }} className="bg-transparent border-none text-[10px] focus:ring-0 text-slate-500" />
                        <button onClick={() => setNewProjectMilestones(newProjectMilestones.filter((_, i) => i !== idx))} className="p-1 text-slate-300 hover:text-rose-500"><X size={14} /></button>
                      </div>
                    ))}
                    {newProjectMilestones.length === 0 && <p className="text-[10px] text-slate-400 italic text-center py-2">No has añadido hitos aún.</p>}
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setIsProjectModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancelar</button>
                <button onClick={createProject} disabled={!newProjectName.trim()} className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed">Crear Proyecto</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Add Modal */}
      <AnimatePresence>
        {isQuickAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsQuickAddOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white w-full max-w-lg rounded-2xl shadow-2xl relative z-10 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">Agregado rápido</h3>
                <button onClick={() => setIsQuickAddOpen(false)} className="p-1 hover:bg-slate-100 rounded-md"><X size={20} className="text-slate-400" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">¿Qué hay que hacer?</label><input autoFocus type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Nombre de la tarea..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" onKeyDown={(e) => e.key === 'Enter' && addTask()} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Fecha</label><input type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Hora</label><input type="time" value={newTaskDueTime} onChange={(e) => setNewTaskDueTime(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm" /></div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Recordatorio / Alarma (Opcional)</label>
                  <div className="flex gap-2">
                    <input type="date" onChange={(e) => { const date = e.target.value; const time = newTaskReminder ? newTaskReminder.split('T')[1] || '12:00' : '12:00'; setNewTaskReminder(`${date}T${time}`); }} className="flex-grow px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm" />
                    <input type="time" onChange={(e) => { const time = e.target.value; const date = newTaskReminder ? newTaskReminder.split('T')[0] || new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]; setNewTaskReminder(`${date}T${time}`); }} className="w-32 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm" />
                  </div>
                  {newTaskReminder && (
                    <div className="flex items-center justify-between bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 mt-2">
                      <span className="text-[10px] font-bold text-indigo-600">Programado para: {new Date(newTaskReminder).toLocaleString()}</span>
                      <button onClick={() => setNewTaskReminder('')} className="p-1 text-rose-500 hover:bg-rose-100 rounded"><X size={14} /></button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Proyecto</label>
                    <select value={newTaskProject} onChange={(e) => setNewTaskProject(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm">
                      <option value="General">General</option>
                      {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Prioridad</label>
                    <div className="flex gap-2">
                      {(['Baja', 'Media', 'Alta'] as const).map(p => (
                        <button key={p} onClick={() => setNewTaskPriority(p)} className={`flex-grow py-2 text-xs font-bold rounded-md border transition-all ${newTaskPriority === p ? (p === 'Baja' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : p === 'Media' ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-rose-100 text-rose-700 border-rose-300') : (p === 'Baja' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : p === 'Media' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-rose-50 text-rose-600 border-rose-100')}`}>{p}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setIsQuickAddOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancelar</button>
                <button onClick={addTask} className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-md transition-all">Crear tarea</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Button (Mobile) */}
      <button onClick={() => setIsQuickAddOpen(true)} className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-40"><Plus size={28} /></button>
    </div>
  );
}

export default function Root() {
  return <ErrorBoundary><App /></ErrorBoundary>;
}