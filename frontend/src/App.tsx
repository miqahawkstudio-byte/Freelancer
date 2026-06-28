import { useState, useCallback } from 'react';
import type { Screen } from './types';
import type { CompressedImage } from './lib/imageUtils';
import Navigation from './components/Navigation';
import DiaryScreen from './components/screens/DiaryScreen';
import CameraScreen from './components/screens/CameraScreen';
import ResultScreen from './components/screens/ResultScreen';
import HistoryScreen from './components/screens/HistoryScreen';
import ProfileScreen from './components/screens/ProfileScreen';
import SettingsScreen from './components/screens/SettingsScreen';
import ManualEntryScreen from './components/screens/ManualEntryScreen';

const SHOW_NAV: Screen[] = ['diary', 'camera', 'history', 'profile'];

export default function App() {
  const [screen, setScreen] = useState<Screen>('diary');
  const [pendingImage, setPendingImage] = useState<CompressedImage | null>(null);
  const [diaryKey, setDiaryKey] = useState(0);

  const navigate = useCallback((s: Screen) => setScreen(s), []);

  function handleImageCaptured(img: CompressedImage) {
    setPendingImage(img);
    setScreen('result');
  }

  function handleMealSaved() {
    setPendingImage(null);
    setDiaryKey(k => k + 1);
    setScreen('diary');
  }

  function handleManualSaved() {
    setDiaryKey(k => k + 1);
    setScreen('diary');
  }

  return (
    <div className="h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-[480px] h-full flex flex-col bg-white shadow-2xl">
        <main className="flex-1 overflow-y-auto min-h-0">
          {screen === 'diary' && (
            <DiaryScreen key={diaryKey} onNavigate={navigate} />
          )}
          {screen === 'camera' && (
            <CameraScreen
              onImageCaptured={handleImageCaptured}
              onManualEntry={() => navigate('manual')}
              onBack={() => navigate('diary')}
            />
          )}
          {screen === 'result' && pendingImage && (
            <ResultScreen
              image={pendingImage}
              onSave={handleMealSaved}
              onBack={() => navigate('camera')}
              onGoSettings={() => navigate('settings')}
            />
          )}
          {screen === 'result' && !pendingImage && (
            <div className="flex items-center justify-center h-full">
              <button onClick={() => navigate('camera')} className="text-green-600 font-medium">
                ← Powrót do aparatu
              </button>
            </div>
          )}
          {screen === 'history' && <HistoryScreen />}
          {screen === 'profile' && <ProfileScreen onNavigate={navigate} />}
          {screen === 'settings' && <SettingsScreen onBack={() => navigate('profile')} />}
          {screen === 'manual' && (
            <ManualEntryScreen onSave={handleManualSaved} onBack={() => navigate('diary')} />
          )}
        </main>

        {SHOW_NAV.includes(screen) && (
          <Navigation current={screen} onNavigate={navigate} />
        )}
      </div>
    </div>
  );
}
