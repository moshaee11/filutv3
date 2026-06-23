
import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { AppProvider } from './store';
import BillingView from './components/BillingView';
import BusinessView from './components/BusinessView';
import ManageView from './components/ManageView';
import MeView from './components/MeView';
import HomeView from './components/HomeView';
import { Home, ClipboardList, Package, User, PlusCircle, AlertTriangle } from 'lucide-react';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message || String(error) };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: '' });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-xl border border-red-100 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} className="text-red-500" />
            </div>
            <h2 className="text-xl font-black text-gray-800 mb-2">页面出错了</h2>
            <p className="text-sm text-gray-500 mb-4">不用担心，数据还在。请刷新页面重试。</p>
            <div className="bg-gray-50 rounded-xl p-3 mb-5 text-left">
              <p className="text-xs text-gray-400 font-mono break-all">{this.state.error || '未知错误'}</p>
            </div>
            <button
              onClick={this.handleReset}
              className="w-full h-12 bg-gradient-to-r from-emerald-400 to-emerald-600 text-white font-black rounded-xl shadow-lg shadow-emerald-200 active:scale-95 transition-all"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<'home' | 'billing' | 'business' | 'manage' | 'me'>('home');
  const [manageSubView, setManageSubView] = useState<string>('main');
  const [needsBackup, setNeedsBackup] = useState(false);

  useEffect(() => {
    const lastBackup = localStorage.getItem('LAST_BACKUP_TIME');
    if (!lastBackup) {
      setNeedsBackup(true);
    } else {
      const days = (Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24);
      setNeedsBackup(days > 3);
    }
  }, [activeView]);

  const renderView = () => {
    switch (activeView) {
      case 'billing': return <BillingView onBackToHome={() => setActiveView('home')} />;
      case 'business': return <BusinessView onGoToReconcile={() => { setManageSubView('reconcile'); setActiveView('manage'); }} />;
      case 'manage': return <ManageView initialSubView={manageSubView} onSubViewChange={setManageSubView} />;
      case 'me': return <MeView />;
      case 'home':
      default:
        return (
          <HomeView 
            onStartBilling={() => setActiveView('billing')} 
            onGoToReconcile={() => { setManageSubView('reconcile'); setActiveView('manage'); }}
          />
        );
    }
  };

  return (
    <ErrorBoundary>
      <AppProvider>
        <div className="flex flex-col min-h-screen bg-gray-50">
          <main className="flex-1 overflow-hidden">
            {renderView()}
          </main>
          
          {/* Navigation Bar */}
          <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-100 flex justify-around items-center px-4 py-2 safe-bottom z-50">
            {[
              { id: 'home', label: '首页', icon: Home },
              { id: 'business', label: '经营', icon: ClipboardList },
              { id: 'billing', label: '开单', icon: PlusCircle, special: true },
              { id: 'manage', label: '管理', icon: Package },
              { id: 'me', label: '我的', icon: User },
            ].map(nav => (
              <button
                key={nav.id}
                onClick={() => setActiveView(nav.id as any)}
                className={`flex flex-col items-center gap-1 transition-all ${nav.special ? '-translate-y-4' : ''} ${activeView === nav.id ? 'text-emerald-500' : 'text-gray-400'}`}
              >
                <div className="relative">
                  {nav.special ? (
                    <div className="w-14 h-14 bg-gradient-to-tr from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-200 ring-4 ring-white">
                      <nav.icon size={28} />
                    </div>
                  ) : (
                    <nav.icon size={24} strokeWidth={activeView === nav.id ? 2.5 : 2} />
                  )}
                  {nav.id === 'me' && needsBackup && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></span>
                  )}
                </div>
                <span className={`text-[10px] font-black ${nav.special ? 'mt-1' : ''}`}>{nav.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;
